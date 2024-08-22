import { allOk, badRequest, OperationOutcomeError } from '@medplum/core';
import { FhirRequest, FhirResponse } from '@medplum/fhir-router';
import {
  CodeSystem,
  Coding,
  ValueSet,
  ValueSetComposeInclude,
  ValueSetComposeIncludeFilter,
  ValueSetExpansionContains,
} from '@medplum/fhirtypes';
import { getAuthenticatedContext, getRequestContext } from '../../context';
import { DatabaseMode } from '../../database';
import { Column, Condition, Conjunction, escapeLikeString, Literal, SelectQuery, SqlFunction } from '../sql';
import { validateCodings } from './codesystemvalidatecode';
import { getOperationDefinition } from './definitions';
import { buildOutputParameters, parseInputParameters } from './utils/parameters';
import {
  abstractProperty,
  addDescendants,
  addPropertyFilter,
  findAncestor,
  findTerminologyResource,
  getParentProperty,
} from './utils/terminology';

const operation = getOperationDefinition('ValueSet', 'expand');

type ValueSetExpandParameters = {
  url?: string;
  filter?: string;
  offset?: number;
  count?: number;
  excludeNotForUI?: boolean;
  valueSet?: ValueSet;
};

/**
 * Implements FHIR ValueSet expansion.
 * @see https://www.hl7.org/fhir/operation-valueset-expand.html
 * @param req - The incoming request.
 * @returns The server response.
 */
export async function expandOperator(req: FhirRequest): Promise<FhirResponse> {
  const params = parseInputParameters<ValueSetExpandParameters>(operation, req);

  const filter = params.filter;
  if (filter !== undefined && typeof filter !== 'string') {
    return [badRequest('Invalid filter')];
  }
  let valueSet = params.valueSet;
  if (!valueSet) {
    let url = params.url;
    if (!url) {
      return [badRequest('Missing url')];
    }

    const pipeIndex = url.indexOf('|');
    if (pipeIndex >= 0) {
      url = url.substring(0, pipeIndex);
    }

    valueSet = await findTerminologyResource<ValueSet>('ValueSet', url);
  }

  if (params.filter && !params.count) {
    params.count = 10; // Default to small page size for typeahead queries
  }
  const result = await expandValueSet(valueSet, params);

  return [allOk, buildOutputParameters(operation, result)];
}

const MAX_EXPANSION_SIZE = 1000;

export function filterCodings(codings: Coding[], params: ValueSetExpandParameters): Coding[] {
  const filter = params.filter?.trim().toLowerCase();
  if (!filter) {
    return codings;
  }
  return codings.filter((c) => c.display?.toLowerCase().includes(filter));
}

export async function expandValueSet(valueSet: ValueSet, params: ValueSetExpandParameters): Promise<ValueSet> {
  let expandedSet: ValueSetExpansionContains[];

  const expansion = valueSet.expansion;
  if (expansion?.contains?.length && !expansion.parameter && expansion.total === expansion.contains.length) {
    // Full expansion is already available, use that
    expandedSet = filterCodings(expansion.contains, params);
  } else {
    expandedSet = await computeExpansion(valueSet, params);
  }
  if (expandedSet.length >= MAX_EXPANSION_SIZE) {
    valueSet.expansion = {
      total: MAX_EXPANSION_SIZE + 1,
      timestamp: new Date().toISOString(),
      contains: expandedSet.slice(0, MAX_EXPANSION_SIZE),
    };
  } else {
    valueSet.expansion = {
      total: expandedSet.length,
      timestamp: new Date().toISOString(),
      contains: expandedSet.slice(0, params.count),
    };
  }
  return valueSet;
}

async function computeExpansion(
  valueSet: ValueSet,
  params: ValueSetExpandParameters,
  terminologyResources: Record<string, CodeSystem | ValueSet> = Object.create(null)
): Promise<ValueSetExpansionContains[]> {
  if (!valueSet.compose?.include.length) {
    throw new OperationOutcomeError(badRequest('Missing ValueSet definition', 'ValueSet.compose.include'));
  }

  const maxCount = params.count ?? MAX_EXPANSION_SIZE;
  const expansion: ValueSetExpansionContains[] = [];
  for (const include of valueSet.compose.include) {
    if (include.valueSet) {
      for (const url of include.valueSet) {
        const includedValueSet = await findTerminologyResource<ValueSet>('ValueSet', url);
        terminologyResources[includedValueSet.url as string] = includedValueSet;

        const nestedExpansion = await computeExpansion(
          includedValueSet,
          {
            ...params,
            count: maxCount - expansion.length,
          },
          terminologyResources
        );
        expansion.push(...nestedExpansion);

        if (expansion.length >= maxCount) {
          // Skip further expansion
          break;
        }
      }
      continue;
    }
    if (!include.system) {
      throw new OperationOutcomeError(
        badRequest('Missing system URL for ValueSet include', 'ValueSet.compose.include.system')
      );
    }

    if (expansion.length >= maxCount) {
      // Skip further expansion
      break;
    }

    const codeSystem =
      (terminologyResources[include.system] as CodeSystem) ??
      (await findTerminologyResource('CodeSystem', include.system));
    terminologyResources[include.system] = codeSystem;

    if (include.concept) {
      const filteredCodings = filterCodings(include.concept, params);
      const validCodings = await validateCodings(codeSystem, filteredCodings);
      for (const c of validCodings) {
        if (c) {
          c.id = undefined;
          expansion.push(c);
        }
      }
    } else {
      await includeInExpansion(include, expansion, codeSystem, params);
    }
  }

  return expansion;
}

const hierarchyOps: ValueSetComposeIncludeFilter['op'][] = ['is-a', 'is-not-a', 'descendent-of'];

async function includeInExpansion(
  include: ValueSetComposeInclude,
  expansion: ValueSetExpansionContains[],
  codeSystem: CodeSystem,
  params: ValueSetExpandParameters
): Promise<void> {
  const db = getAuthenticatedContext().repo.getDatabaseClient(DatabaseMode.READER);

  const hierarchyFilter = include.filter?.find((f) => hierarchyOps.includes(f.op));
  if (hierarchyFilter) {
    // Hydrate parent property ID to optimize expensive DB queries for hierarchy expansion
    const parentProp = getParentProperty(codeSystem);
    const propId = (
      await new SelectQuery('CodeSystem_Property')
        .column('id')
        .where('system', '=', codeSystem.id)
        .where('code', '=', parentProp.code)
        .execute(db)
    )[0]?.id;
    if (propId) {
      parentProp.id = propId;
      codeSystem.property?.unshift?.(parentProp);
    }
  }

  const query = expansionQuery(include, codeSystem, params);
  if (!query) {
    return;
  }

  const results = await query.execute(db);
  const system = codeSystem.url;
  for (const { code, display } of results) {
    expansion.push({ system, code, display });
  }
}

export function expansionQuery(
  include: ValueSetComposeInclude,
  codeSystem: CodeSystem,
  params?: ValueSetExpandParameters
): SelectQuery | undefined {
  const ctx = getRequestContext();
  let query = new SelectQuery('Coding')
    .column('id')
    .column('code')
    .column('display')
    .where('system', '=', codeSystem.id);

  if (include.filter?.length) {
    for (const condition of include.filter) {
      switch (condition.op) {
        case 'is-a':
        case 'descendent-of':
          if (params?.filter) {
            const base = new SelectQuery('Coding', undefined, 'origin')
              .column('id')
              .column('code')
              .column('display')
              .where(new Column('origin', 'system'), '=', codeSystem.id)
              .where(new Column('origin', 'code'), '=', new Column('Coding', 'code'));
            const ancestorQuery = findAncestor(base, codeSystem, condition.value);
            query.whereExpr(new SqlFunction('EXISTS', [ancestorQuery]));
          } else {
            query = addDescendants(query, codeSystem, condition.value);
          }
          if (condition.op !== 'is-a') {
            query.where('code', '!=', condition.value);
          }
          break;
        case '=':
          query = addPropertyFilter(query, condition.property, '=', condition.value);
          break;
        case 'in':
          query = addPropertyFilter(query, condition.property, 'IN', condition.value.split(','));
          break;
        default:
          ctx.logger.warn('Unknown filter type in ValueSet', { filter: condition });
          return undefined; // Unknown filter type, don't make DB query with incorrect filters
      }
    }
  }

  if (params) {
    query = addExpansionFilters(query, params);
  }
  return query;
}

function addExpansionFilters(query: SelectQuery, params: ValueSetExpandParameters): SelectQuery {
  if (params.filter) {
    query
      .whereExpr(
        new Conjunction(
          params.filter.split(/\s+/g).map((filter) => new Condition('display', 'LIKE', `%${escapeLikeString(filter)}%`))
        )
      )
      .orderByExpr(
        new SqlFunction('strict_word_similarity', [
          new Column(undefined, 'display'),
          new Literal(`'${params.filter}'`),
        ]),
        true
      );
  }
  if (params.excludeNotForUI) {
    query = addAbstractFilter(query);
  }

  query.limit((params.count ?? MAX_EXPANSION_SIZE) + 1).offset(params.offset ?? 0);
  return query;
}

function addAbstractFilter(query: SelectQuery): SelectQuery {
  const propertyTable = query.getNextJoinAlias();
  query.join(
    'LEFT JOIN',
    'Coding_Property',
    propertyTable,
    new Conjunction([
      new Condition(new Column(query.tableName, 'id'), '=', new Column(propertyTable, 'coding')),
      new Condition(new Column(propertyTable, 'value'), '=', 'true'),
    ])
  );
  query.where(new Column(propertyTable, 'value'), '=', null);

  const codeSystemProperty = query.getNextJoinAlias();
  query.join(
    'LEFT JOIN',
    'CodeSystem_Property',
    codeSystemProperty,
    new Conjunction([
      new Condition(new Column(codeSystemProperty, 'id'), '=', new Column(propertyTable, 'property')),
      new Condition(new Column(codeSystemProperty, 'uri'), '=', abstractProperty),
    ])
  );

  return query;
}
