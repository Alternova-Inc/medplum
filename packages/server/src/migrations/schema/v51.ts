/*
 * Generated by @medplum/generator
 * Do not edit manually.
 */

import { PoolClient } from 'pg';

const SIMPLE = 'simple';
const ENGLISH = 'english';

export async function run(client: PoolClient): Promise<void> {
  const fields = [
    ['HumanName', 'name', SIMPLE],
    ['HumanName', 'given', SIMPLE],
    ['HumanName', 'family', SIMPLE],
    ['Address', 'address', SIMPLE],
    ['Address', 'city', SIMPLE],
    ['Address', 'country', SIMPLE],
    ['Address', 'postalCode', SIMPLE],
    ['Address', 'state', SIMPLE],
    ['Address', 'use', SIMPLE],
    ['ValueSetElement', 'display', ENGLISH],
  ];
  for (const [table, column, lang] of fields) {
    await client.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${table}_idx_tsv" ON "${table}" USING gin (to_tsvector('${lang}', "${column}"))`
    );
  }
}
