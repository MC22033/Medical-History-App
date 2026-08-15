import { RelationResult, Side } from "./relationship";

export interface ConditionLite {
  personId: string;
  conditionName: string;
  category?: string | null;
  ageAtDiagnosis?: number | null;
  isCauseOfDeath: boolean;
}

export interface PersonForRisk {
  id: string;
  displayName: string;
}

export interface ConditionOccurrence {
  personId: string;
  personName: string;
  relationLabel: string;
  ageAtDiagnosis?: number | null;
  isCauseOfDeath: boolean;
}

export interface ConditionSummary {
  conditionName: string;
  category?: string | null;
  count: number;
  occurrences: ConditionOccurrence[];
}

export interface SideSummary {
  side: Side;
  bloodRelativeCount: number; // how many blood relatives are recorded on this side (denominator for rate)
  affectedPersonCount: number; // distinct people on this side with >=1 condition
  conditions: ConditionSummary[];
}

export interface ConditionComparisonRow {
  conditionName: string;
  category?: string | null;
  paternalCount: number;
  maternalCount: number;
  coreCount: number;
  totalCount: number;
}

export interface RiskSummary {
  sides: Record<Side, SideSummary>;
  comparison: ConditionComparisonRow[];
}

const SIDES: Side[] = ["paternal", "maternal", "core", "unknown"];

/**
 * Aggregates health conditions by side of the family (relative to the tree's
 * core person). Only blood relatives count toward the paternal/maternal
 * comparison — a condition on an in-law doesn't indicate inherited risk.
 */
export function buildRiskSummary(
  relations: Map<string, RelationResult>,
  people: PersonForRisk[],
  conditions: ConditionLite[]
): RiskSummary {
  const peopleById = new Map(people.map((p) => [p.id, p]));

  const sides: Record<Side, SideSummary> = {
    paternal: { side: "paternal", bloodRelativeCount: 0, affectedPersonCount: 0, conditions: [] },
    maternal: { side: "maternal", bloodRelativeCount: 0, affectedPersonCount: 0, conditions: [] },
    core: { side: "core", bloodRelativeCount: 0, affectedPersonCount: 0, conditions: [] },
    unknown: { side: "unknown", bloodRelativeCount: 0, affectedPersonCount: 0, conditions: [] },
  };

  for (const relation of relations.values()) {
    if (relation.isBloodRelative) sides[relation.side].bloodRelativeCount += 1;
  }

  // conditionName -> side -> summary accumulator
  const bySideAndCondition = new Map<Side, Map<string, ConditionSummary>>();
  for (const side of SIDES) bySideAndCondition.set(side, new Map());

  const affectedPeoplePerSide = new Map<Side, Set<string>>();
  for (const side of SIDES) affectedPeoplePerSide.set(side, new Set());

  for (const condition of conditions) {
    const relation = relations.get(condition.personId);
    if (!relation || !relation.isBloodRelative) continue; // skip in-laws / unlinked people for risk purposes
    const person = peopleById.get(condition.personId);
    if (!person) continue;

    const sideMap = bySideAndCondition.get(relation.side)!;
    const key = condition.conditionName.trim().toLowerCase();
    if (!sideMap.has(key)) {
      sideMap.set(key, {
        conditionName: condition.conditionName,
        category: condition.category,
        count: 0,
        occurrences: [],
      });
    }
    const summary = sideMap.get(key)!;
    summary.count += 1;
    summary.occurrences.push({
      personId: person.id,
      personName: person.displayName,
      relationLabel: relation.relationLabel,
      ageAtDiagnosis: condition.ageAtDiagnosis,
      isCauseOfDeath: condition.isCauseOfDeath,
    });

    affectedPeoplePerSide.get(relation.side)!.add(condition.personId);
  }

  for (const side of SIDES) {
    sides[side].conditions = Array.from(bySideAndCondition.get(side)!.values()).sort(
      (a, b) => b.count - a.count
    );
    sides[side].affectedPersonCount = affectedPeoplePerSide.get(side)!.size;
  }

  // Build a combined comparison table across all conditions seen anywhere.
  const allConditionKeys = new Map<string, { name: string; category?: string | null }>();
  for (const side of SIDES) {
    for (const summary of bySideAndCondition.get(side)!.values()) {
      const key = summary.conditionName.trim().toLowerCase();
      if (!allConditionKeys.has(key)) {
        allConditionKeys.set(key, { name: summary.conditionName, category: summary.category });
      }
    }
  }

  const comparison: ConditionComparisonRow[] = Array.from(allConditionKeys.entries()).map(
    ([key, meta]) => {
      const paternalCount = bySideAndCondition.get("paternal")!.get(key)?.count ?? 0;
      const maternalCount = bySideAndCondition.get("maternal")!.get(key)?.count ?? 0;
      const coreCount = bySideAndCondition.get("core")!.get(key)?.count ?? 0;
      const unknownCount = bySideAndCondition.get("unknown")!.get(key)?.count ?? 0;
      return {
        conditionName: meta.name,
        category: meta.category,
        paternalCount,
        maternalCount,
        coreCount,
        totalCount: paternalCount + maternalCount + coreCount + unknownCount,
      };
    }
  );
  comparison.sort((a, b) => b.totalCount - a.totalCount);

  return { sides, comparison };
}
