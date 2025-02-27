/*
 * This is a generated file
 * Do not edit manually.
 */

import { CodeableConcept } from './CodeableConcept';
import { Coverage } from './Coverage';
import { Device } from './Device';
import { Extension } from './Extension';
import { HealthcareService } from './HealthcareService';
import { Identifier } from './Identifier';
import { Location } from './Location';
import { Meta } from './Meta';
import { Narrative } from './Narrative';
import { Organization } from './Organization';
import { Patient } from './Patient';
import { Period } from './Period';
import { Practitioner } from './Practitioner';
import { PractitionerRole } from './PractitionerRole';
import { Reference } from './Reference';
import { RelatedPerson } from './RelatedPerson';
import { Resource } from './Resource';

/**
 * A financial tool for tracking value accrued for a particular purpose.
 * In the healthcare field, used to track charges for a patient, cost
 * centers, etc.
 */
export interface Account {

  /**
   * This is a Account resource
   */
  readonly resourceType: 'Account';

  /**
   * The logical id of the resource, as used in the URL for the resource.
   * Once assigned, this value never changes.
   */
  id?: string;

  /**
   * The metadata about the resource. This is content that is maintained by
   * the infrastructure. Changes to the content might not always be
   * associated with version changes to the resource.
   */
  meta?: Meta;

  /**
   * A reference to a set of rules that were followed when the resource was
   * constructed, and which must be understood when processing the content.
   * Often, this is a reference to an implementation guide that defines the
   * special rules along with other profiles etc.
   */
  implicitRules?: string;

  /**
   * The base language in which the resource is written.
   */
  language?: string;

  /**
   * A human-readable narrative that contains a summary of the resource and
   * can be used to represent the content of the resource to a human. The
   * narrative need not encode all the structured data, but is required to
   * contain sufficient detail to make it &quot;clinically safe&quot; for a human to
   * just read the narrative. Resource definitions may define what content
   * should be represented in the narrative to ensure clinical safety.
   */
  text?: Narrative;

  /**
   * These resources do not have an independent existence apart from the
   * resource that contains them - they cannot be identified independently,
   * and nor can they have their own independent transaction scope.
   */
  contained?: Resource[];

  /**
   * May be used to represent additional information that is not part of
   * the basic definition of the resource. To make the use of extensions
   * safe and manageable, there is a strict set of governance  applied to
   * the definition and use of extensions. Though any implementer can
   * define an extension, there is a set of requirements that SHALL be met
   * as part of the definition of the extension.
   */
  extension?: Extension[];

  /**
   * May be used to represent additional information that is not part of
   * the basic definition of the resource and that modifies the
   * understanding of the element that contains it and/or the understanding
   * of the containing element's descendants. Usually modifier elements
   * provide negation or qualification. To make the use of extensions safe
   * and manageable, there is a strict set of governance applied to the
   * definition and use of extensions. Though any implementer is allowed to
   * define an extension, there is a set of requirements that SHALL be met
   * as part of the definition of the extension. Applications processing a
   * resource are required to check for modifier extensions.
   *
   * Modifier extensions SHALL NOT change the meaning of any elements on
   * Resource or DomainResource (including cannot change the meaning of
   * modifierExtension itself).
   */
  modifierExtension?: Extension[];

  /**
   * Unique identifier used to reference the account.  Might or might not
   * be intended for human use (e.g. credit card number).
   */
  identifier?: Identifier[];

  /**
   * Indicates whether the account is presently used/usable or not.
   */
  status: 'active' | 'inactive' | 'entered-in-error' | 'on-hold' | 'unknown';

  /**
   * Categorizes the account for reporting and searching purposes.
   */
  type?: CodeableConcept;

  /**
   * Name used for the account when displaying it to humans in reports,
   * etc.
   */
  name?: string;

  /**
   * Identifies the entity which incurs the expenses. While the immediate
   * recipients of services or goods might be entities related to the
   * subject, the expenses were ultimately incurred by the subject of the
   * Account.
   */
  subject?: Reference<Patient | Device | Practitioner | PractitionerRole | Location | HealthcareService | Organization>[];

  /**
   * The date range of services associated with this account.
   */
  servicePeriod?: Period;

  /**
   * The party(s) that are responsible for covering the payment of this
   * account, and what order should they be applied to the account.
   */
  coverage?: AccountCoverage[];

  /**
   * Indicates the service area, hospital, department, etc. with
   * responsibility for managing the Account.
   */
  owner?: Reference<Organization>;

  /**
   * Provides additional information about what the account tracks and how
   * it is used.
   */
  description?: string;

  /**
   * The parties responsible for balancing the account if other payment
   * options fall short.
   */
  guarantor?: AccountGuarantor[];

  /**
   * Reference to a parent Account.
   */
  partOf?: Reference<Account>;
}

/**
 * The party(s) that are responsible for covering the payment of this
 * account, and what order should they be applied to the account.
 */
export interface AccountCoverage {

  /**
   * Unique id for the element within a resource (for internal references).
   * This may be any string value that does not contain spaces.
   */
  id?: string;

  /**
   * May be used to represent additional information that is not part of
   * the basic definition of the element. To make the use of extensions
   * safe and manageable, there is a strict set of governance  applied to
   * the definition and use of extensions. Though any implementer can
   * define an extension, there is a set of requirements that SHALL be met
   * as part of the definition of the extension.
   */
  extension?: Extension[];

  /**
   * May be used to represent additional information that is not part of
   * the basic definition of the element and that modifies the
   * understanding of the element in which it is contained and/or the
   * understanding of the containing element's descendants. Usually
   * modifier elements provide negation or qualification. To make the use
   * of extensions safe and manageable, there is a strict set of governance
   * applied to the definition and use of extensions. Though any
   * implementer can define an extension, there is a set of requirements
   * that SHALL be met as part of the definition of the extension.
   * Applications processing a resource are required to check for modifier
   * extensions.
   *
   * Modifier extensions SHALL NOT change the meaning of any elements on
   * Resource or DomainResource (including cannot change the meaning of
   * modifierExtension itself).
   */
  modifierExtension?: Extension[];

  /**
   * The party(s) that contribute to payment (or part of) of the charges
   * applied to this account (including self-pay).
   *
   * A coverage may only be responsible for specific types of charges, and
   * the sequence of the coverages in the account could be important when
   * processing billing.
   */
  coverage: Reference<Coverage>;

  /**
   * The priority of the coverage in the context of this account.
   */
  priority?: number;
}

/**
 * The parties responsible for balancing the account if other payment
 * options fall short.
 */
export interface AccountGuarantor {

  /**
   * Unique id for the element within a resource (for internal references).
   * This may be any string value that does not contain spaces.
   */
  id?: string;

  /**
   * May be used to represent additional information that is not part of
   * the basic definition of the element. To make the use of extensions
   * safe and manageable, there is a strict set of governance  applied to
   * the definition and use of extensions. Though any implementer can
   * define an extension, there is a set of requirements that SHALL be met
   * as part of the definition of the extension.
   */
  extension?: Extension[];

  /**
   * May be used to represent additional information that is not part of
   * the basic definition of the element and that modifies the
   * understanding of the element in which it is contained and/or the
   * understanding of the containing element's descendants. Usually
   * modifier elements provide negation or qualification. To make the use
   * of extensions safe and manageable, there is a strict set of governance
   * applied to the definition and use of extensions. Though any
   * implementer can define an extension, there is a set of requirements
   * that SHALL be met as part of the definition of the extension.
   * Applications processing a resource are required to check for modifier
   * extensions.
   *
   * Modifier extensions SHALL NOT change the meaning of any elements on
   * Resource or DomainResource (including cannot change the meaning of
   * modifierExtension itself).
   */
  modifierExtension?: Extension[];

  /**
   * The entity who is responsible.
   */
  party: Reference<Patient | RelatedPerson | Organization>;

  /**
   * A guarantor may be placed on credit hold or otherwise have their role
   * temporarily suspended.
   */
  onHold?: boolean;

  /**
   * The timeframe during which the guarantor accepts responsibility for
   * the account.
   */
  period?: Period;
}
