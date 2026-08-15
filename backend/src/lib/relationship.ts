/**
 * Genealogical relationship engine.
 *
 * Given a "core person" (the reference point the family tree is viewed from)
 * and the raw parent-child / partnership edges of a family tree, this module
 * computes for every other person:
 *  - how many generations up/down they sit relative to core
 *  - a plain-English relationship label ("Paternal Grandmother", "1st Cousin
 *    (1x removed)", "Half-Brother", ...)
 *  - which side of the family they belong to: paternal / maternal / core
 *    (core = direct line — ancestors/descendants of core aren't "a side")
 *  - whether the connection is by blood or by marriage
 *
 * This is what lets the risk dashboard say "diabetes shows up 4x on the
 * paternal side vs 1x on the maternal side."
 */

export type Side = "paternal" | "maternal" | "core" | "unknown";

export interface PersonLite {
  id: string;
  sex?: string | null; // "MALE" | "FEMALE" | otherwise treated as unknown
}

export interface RelEdge {
  parentId: string;
  childId: string;
}

export interface PartnerEdge {
  personAId: string;
  personBId: string;
}

export interface RelationResult {
  personId: string;
  generation: number; // 0 = core's generation, negative = older, positive = younger
  relationLabel: string;
  side: Side;
  isBloodRelative: boolean;
  distanceFromCore: number; // sum of generation-steps to nearest common ancestor; used for sorting/layout
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function genderedParent(sex: string | null | undefined): string {
  if (sex === "MALE") return "father";
  if (sex === "FEMALE") return "mother";
  return "parent";
}

function genderedChild(sex: string | null | undefined): string {
  if (sex === "MALE") return "son";
  if (sex === "FEMALE") return "daughter";
  return "child";
}

function genderedSibling(sex: string | null | undefined): string {
  if (sex === "MALE") return "brother";
  if (sex === "FEMALE") return "sister";
  return "sibling";
}

function genderedAuntUncle(sex: string | null | undefined): string {
  if (sex === "MALE") return "uncle";
  if (sex === "FEMALE") return "aunt";
  return "aunt/uncle";
}

function genderedNieceNephew(sex: string | null | undefined): string {
  if (sex === "MALE") return "nephew";
  if (sex === "FEMALE") return "niece";
  return "niece/nephew";
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ancestorLabel(depth: number, sex: string | null | undefined): string {
  if (depth === 1) return cap(genderedParent(sex));
  const greats = "Great-".repeat(Math.max(0, depth - 2));
  return `${greats}Grand${genderedParent(sex)}`;
}

function descendantLabel(depth: number, sex: string | null | undefined): string {
  if (depth === 1) return cap(genderedChild(sex));
  const greats = "Great-".repeat(Math.max(0, depth - 2));
  return `${greats}Grand${genderedChild(sex)}`;
}

function collateralLabel(g1: number, g2: number, sex: string | null | undefined): string {
  // g1 = generations from core up to the common ancestor
  // g2 = generations from the target person up to the common ancestor
  if (g1 === 1 && g2 === 1) return cap(genderedSibling(sex));
  if (g1 === 2 && g2 === 1) {
    const greats = "Great-".repeat(Math.max(0, g1 - 2));
    return `${greats}${cap(genderedAuntUncle(sex))}`;
  }
  if (g1 >= 3 && g2 === 1) {
    const greats = "Great-".repeat(g1 - 2);
    return `${greats}${cap(genderedAuntUncle(sex))}`;
  }
  if (g1 === 1 && g2 === 2) return cap(genderedNieceNephew(sex));
  if (g1 === 1 && g2 >= 3) {
    const greats = "Great-".repeat(g2 - 3);
    return `${greats}Grand${genderedNieceNephew(sex)}`;
  }
  // both >= 2: cousins
  const degree = Math.min(g1, g2) - 1;
  const removed = Math.abs(g1 - g2);
  return `${ordinal(degree)} Cousin${removed > 0 ? ` (${removed}x removed)` : ""}`;
}

export function computeFamilyRelations(
  corePersonId: string,
  people: PersonLite[],
  relationships: RelEdge[],
  partnerships: PartnerEdge[]
): Map<string, RelationResult> {
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const { parentId, childId } of relationships) {
    if (!parentsOf.has(childId)) parentsOf.set(childId, []);
    parentsOf.get(childId)!.push(parentId);
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
    childrenOf.get(parentId)!.push(childId);
  }

  const ancestorMapCache = new Map<string, Map<string, number>>();
  function getAncestorMap(id: string): Map<string, number> {
    const cached = ancestorMapCache.get(id);
    if (cached) return cached;
    const map = new Map<string, number>([[id, 0]]);
    const queue: [string, number][] = [[id, 0]];
    while (queue.length) {
      const [cur, d] = queue.shift()!;
      for (const parentId of parentsOf.get(cur) || []) {
        const existing = map.get(parentId);
        if (existing === undefined || existing > d + 1) {
          map.set(parentId, d + 1);
          queue.push([parentId, d + 1]);
        }
      }
    }
    ancestorMapCache.set(id, map);
    return map;
  }

  const results = new Map<string, RelationResult>();
  results.set(corePersonId, {
    personId: corePersonId,
    generation: 0,
    relationLabel: "Core Person",
    side: "core",
    isBloodRelative: true,
    distanceFromCore: 0,
  });

  const coreAncestorMap = getAncestorMap(corePersonId);
  const coreParents = parentsOf.get(corePersonId) || [];
  const father =
    coreParents.find((id) => peopleById.get(id)?.sex === "MALE") ?? coreParents[0];
  const mother =
    coreParents.find((id) => id !== father && peopleById.get(id)?.sex === "FEMALE") ??
    coreParents.find((id) => id !== father);
  const paternalSet = father ? new Set(getAncestorMap(father).keys()) : new Set<string>();
  const maternalSet = mother ? new Set(getAncestorMap(mother).keys()) : new Set<string>();

  function classifyAncestor(ancestorId: string): Side {
    if (paternalSet.has(ancestorId)) return "paternal";
    if (maternalSet.has(ancestorId)) return "maternal";
    return "unknown";
  }

  for (const person of people) {
    if (person.id === corePersonId) continue;
    const pMap = getAncestorMap(person.id);
    type Candidate = { ancestorId: string; g1: number; g2: number; total: number };
    const candidates: Candidate[] = [];
    for (const [ancestorId, g1] of coreAncestorMap.entries()) {
      const g2 = pMap.get(ancestorId);
      if (g2 !== undefined) candidates.push({ ancestorId, g1, g2, total: g1 + g2 });
    }

    if (candidates.length === 0) {
      // No shared ancestor found on record — likely connected only by marriage,
      // or a disconnected branch. Left for the partnership pass / manual review.
      continue;
    }

    const minTotal = Math.min(...candidates.map((c) => c.total));
    const best = candidates.filter((c) => c.total === minTotal);
    const { g1, g2 } = best[0];

    let side: Side;
    if (g1 === 0) {
      side = "core"; // person is a descendant of core
    } else if (g2 === 0) {
      side = classifyAncestor(person.id); // person is an ancestor of core
    } else {
      const sides = new Set(best.map((c) => classifyAncestor(c.ancestorId)));
      if (sides.has("paternal") && sides.has("maternal")) side = "core"; // shares both parents (full sibling line)
      else if (sides.has("paternal")) side = "paternal";
      else if (sides.has("maternal")) side = "maternal";
      else side = "unknown";
    }

    let relationLabel: string;
    const sex = person.sex;
    if (g1 === 0) relationLabel = descendantLabel(g2, sex);
    else if (g2 === 0) relationLabel = ancestorLabel(g1, sex);
    else relationLabel = collateralLabel(g1, g2, sex);

    results.set(person.id, {
      personId: person.id,
      generation: g2 - g1,
      relationLabel,
      side,
      isBloodRelative: true,
      distanceFromCore: minTotal,
    });
  }

  // Second pass: label spouses/partners of already-related people as
  // "Spouse of X" so married-in relatives still show up on the tree with a
  // sensible side, without being counted as blood relatives.
  for (const { personAId, personBId } of partnerships) {
    const a = results.get(personAId);
    const b = results.get(personBId);
    if (a && !b) {
      results.set(personBId, {
        personId: personBId,
        generation: a.generation,
        relationLabel: a.personId === corePersonId ? "Spouse" : `Spouse of ${a.relationLabel}`,
        side: a.side,
        isBloodRelative: false,
        distanceFromCore: a.distanceFromCore + 0.5,
      });
    } else if (b && !a) {
      results.set(personAId, {
        personId: personAId,
        generation: b.generation,
        relationLabel: b.personId === corePersonId ? "Spouse" : `Spouse of ${b.relationLabel}`,
        side: b.side,
        isBloodRelative: false,
        distanceFromCore: b.distanceFromCore + 0.5,
      });
    }
  }

  return results;
}
