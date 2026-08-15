// Mirrors the DTOs returned by the backend (backend/src/lib/treePayload.ts,
// backend/src/lib/relationship.ts, backend/src/lib/risk.ts).

export type Sex = "MALE" | "FEMALE" | "UNKNOWN" | null;
export type Side = "paternal" | "maternal" | "core" | "unknown";
export type ConditionSource =
  | "SELF_REPORTED"
  | "DEATH_CERTIFICATE"
  | "MEDICAL_RECORD"
  | "FAMILY_RECOLLECTION"
  | null;
export type PartnerStatus = "MARRIED" | "PARTNERED" | "DIVORCED" | "SEPARATED" | "WIDOWED" | null;

export interface Relation {
  personId: string;
  generation: number;
  relationLabel: string;
  side: Side;
  isBloodRelative: boolean;
  distanceFromCore: number;
}

export interface HealthCondition {
  id: string;
  conditionName: string;
  category: string | null;
  ageAtDiagnosis: number | null;
  isCauseOfDeath: boolean;
  source: ConditionSource;
  notes: string | null;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string | null;
  displayName: string;
  sex: Sex;
  birthDate: string | null;
  isDeceased: boolean;
  deathDate: string | null;
  causeOfDeath: string | null;
  notes: string | null;
  isCore: boolean;
  relation: Relation;
  conditions: HealthCondition[];
}

export interface RelationshipEdge {
  id: string;
  parentId: string;
  childId: string;
}

export interface PartnershipEdge {
  id: string;
  personAId: string;
  personBId: string;
  status: PartnerStatus;
}

export interface TreeSummary {
  id: string;
  name: string;
  role: "OWNER" | "EDITOR";
  inviteCode: string;
  createdAt: string;
}

export interface TreeDetail {
  tree: {
    id: string;
    name: string;
    inviteCode: string;
    corePersonId: string | null;
    viewingFromPersonId: string | null;
  };
  people: Person[];
  relationships: RelationshipEdge[];
  partnerships: PartnershipEdge[];
}

export interface ConditionOccurrence {
  personId: string;
  personName: string;
  relationLabel: string;
  ageAtDiagnosis: number | null;
  isCauseOfDeath: boolean;
}

export interface ConditionSummary {
  conditionName: string;
  category: string | null;
  count: number;
  occurrences: ConditionOccurrence[];
}

export interface SideSummary {
  side: Side;
  bloodRelativeCount: number;
  affectedPersonCount: number;
  conditions: ConditionSummary[];
}

export interface ConditionComparisonRow {
  conditionName: string;
  category: string | null;
  paternalCount: number;
  maternalCount: number;
  coreCount: number;
  totalCount: number;
}

export interface RiskSummary {
  sides: Record<Side, SideSummary>;
  comparison: ConditionComparisonRow[];
}
