import type { Person, PartnershipEdge, RelationshipEdge } from "../types";

export interface FamilyUnit {
  id: string;
  memberIds: string[]; // 1 (single) or 2 (partnered) person ids
  children: FamilyUnit[];
}

const SIDE_PRIORITY: Record<string, number> = { paternal: 0, core: 1, maternal: 2, unknown: 3 };

/**
 * Groups people into "family units" (an individual, or a couple) and nests
 * them into a forest of trees (topmost recorded ancestors down to their
 * descendants) — the shape a classic org-chart-style family tree renders
 * from.
 *
 * A person's ancestry can legitimately reconverge on the same couple from
 * two different directions (e.g. a person's parents share a great-grandparent),
 * or a couple can each have their own separately-recorded parents. Since this
 * renders as a strict tree (not a general DAG), each *unit* is placed under
 * exactly one parent unit — whichever member's side of the family (paternal /
 * core / maternal) ranks first — rather than being duplicated under both. The
 * other lineage still appears in the forest as its own (childless-looking)
 * root rather than being dropped.
 */
export function buildFamilyForest(
  people: Person[],
  relationships: RelationshipEdge[],
  partnerships: PartnershipEdge[]
): FamilyUnit[] {
  const peopleIds = new Set(people.map((p) => p.id));
  const peopleById = new Map(people.map((p) => [p.id, p]));

  const parentsOf = new Map<string, string[]>();
  for (const { parentId, childId } of relationships) {
    if (!peopleIds.has(parentId) || !peopleIds.has(childId)) continue;
    if (!parentsOf.has(childId)) parentsOf.set(childId, []);
    parentsOf.get(childId)!.push(parentId);
  }

  const partnerOf = new Map<string, string[]>();
  for (const { personAId, personBId } of partnerships) {
    if (!peopleIds.has(personAId) || !peopleIds.has(personBId)) continue;
    if (!partnerOf.has(personAId)) partnerOf.set(personAId, []);
    partnerOf.get(personAId)!.push(personBId);
    if (!partnerOf.has(personBId)) partnerOf.set(personBId, []);
    partnerOf.get(personBId)!.push(personAId);
  }

  // Group into units (a couple, or a single person with no recorded partner).
  const personToUnit = new Map<string, string>();
  const units = new Map<string, FamilyUnit>();
  const visited = new Set<string>();

  for (const person of people) {
    if (visited.has(person.id)) continue;
    const partnerCandidates = (partnerOf.get(person.id) || []).filter((id) => !visited.has(id));
    const partnerId = partnerCandidates[0];
    const memberIds = partnerId ? [person.id, partnerId] : [person.id];
    const unitId = memberIds.slice().sort().join("+");
    visited.add(person.id);
    if (partnerId) visited.add(partnerId);
    const unit: FamilyUnit = { id: unitId, memberIds, children: [] };
    units.set(unitId, unit);
    for (const m of memberIds) personToUnit.set(m, unitId);
  }

  function sideOf(personId: string): string {
    return peopleById.get(personId)?.relation.side || "unknown";
  }

  // For each unit, pick exactly one parent unit (if any member has parents
  // on record). When members have parents leading to different units,
  // prefer paternal > core > maternal > unknown, then lower person id, so
  // the choice is stable across renders.
  const unitParent = new Map<string, string>(); // unitId -> parentUnitId

  for (const unit of units.values()) {
    type Candidate = { parentUnitId: string; priority: number; tiebreak: string };
    const candidates: Candidate[] = [];
    for (const memberId of unit.memberIds) {
      const parents = parentsOf.get(memberId);
      if (!parents || parents.length === 0) continue;
      // If this member's recorded parents span more than one unit (rare —
      // parents not linked as partners), just use the first parent's unit.
      const parentUnitId = personToUnit.get(parents[0]);
      if (!parentUnitId || parentUnitId === unit.id) continue; // ignore self-loops from bad data
      candidates.push({ parentUnitId, priority: SIDE_PRIORITY[sideOf(memberId)] ?? 3, tiebreak: memberId });
    }
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => a.priority - b.priority || a.tiebreak.localeCompare(b.tiebreak));
    unitParent.set(unit.id, candidates[0].parentUnitId);
  }

  // Attach each unit to its chosen parent's children list.
  for (const unit of units.values()) {
    const parentUnitId = unitParent.get(unit.id);
    if (!parentUnitId) continue;
    const parentUnit = units.get(parentUnitId);
    if (parentUnit) parentUnit.children.push(unit);
  }

  // Roots: units nobody claimed as a child.
  const roots = Array.from(units.values()).filter((unit) => !unitParent.has(unit.id));

  // Sort roots and children for stable, sensible left-to-right ordering:
  // paternal-leaning branches left, maternal-leaning right.
  function unitSideWeight(unit: FamilyUnit): number {
    return Math.min(...unit.memberIds.map((m) => SIDE_PRIORITY[sideOf(m)] ?? 3));
  }
  function sortUnits(list: FamilyUnit[]) {
    list.sort((a, b) => unitSideWeight(a) - unitSideWeight(b));
    for (const u of list) sortUnits(u.children);
  }
  sortUnits(roots);

  return roots;
}
