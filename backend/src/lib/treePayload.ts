import { prisma } from "../db";
import { computeFamilyRelations, RelationResult } from "./relationship";
import { buildRiskSummary, RiskSummary } from "./risk";

function displayName(p: { firstName: string; lastName: string | null }): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

const defaultRelation = (personId: string): RelationResult => ({
  personId,
  generation: 0,
  relationLabel: "Unplaced",
  side: "unknown",
  isBloodRelative: false,
  distanceFromCore: 999,
});

/**
 * Loads a full family tree (people, relationships, partnerships, health
 * conditions) and annotates every person with their computed relationship
 * to the core person (or `perspectivePersonId` if viewing from someone else).
 */
export async function loadTreeDetail(treeId: string, perspectivePersonId?: string) {
  const tree = await prisma.familyTree.findUnique({ where: { id: treeId } });
  if (!tree) return null;

  const [people, relationships, partnerships] = await Promise.all([
    prisma.person.findMany({ where: { familyTreeId: treeId }, include: { conditions: true } }),
    prisma.relationship.findMany({
      where: { parent: { familyTreeId: treeId } },
    }),
    prisma.partnership.findMany({ where: { personA: { familyTreeId: treeId } } }),
  ]);

  const coreId = perspectivePersonId || tree.corePersonId || undefined;
  const relations =
    coreId && people.some((p) => p.id === coreId)
      ? computeFamilyRelations(
          coreId,
          people.map((p) => ({ id: p.id, sex: p.sex })),
          relationships,
          partnerships.map((pt) => ({ personAId: pt.personAId, personBId: pt.personBId }))
        )
      : new Map<string, RelationResult>();

  const peopleDto = people.map((p) => {
    const relation = relations.get(p.id) || defaultRelation(p.id);
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      displayName: displayName(p),
      sex: p.sex,
      birthDate: p.birthDate,
      isDeceased: p.isDeceased,
      deathDate: p.deathDate,
      causeOfDeath: p.causeOfDeath,
      notes: p.notes,
      isCore: p.id === coreId,
      relation,
      conditions: p.conditions.map((c) => ({
        id: c.id,
        conditionName: c.conditionName,
        category: c.category,
        ageAtDiagnosis: c.ageAtDiagnosis,
        isCauseOfDeath: c.isCauseOfDeath,
        source: c.source,
        notes: c.notes,
      })),
    };
  });

  return {
    tree: {
      id: tree.id,
      name: tree.name,
      inviteCode: tree.inviteCode,
      corePersonId: tree.corePersonId,
      viewingFromPersonId: coreId ?? null,
    },
    people: peopleDto,
    relationships: relationships.map((r) => ({ id: r.id, parentId: r.parentId, childId: r.childId })),
    partnerships: partnerships.map((pt) => ({
      id: pt.id,
      personAId: pt.personAId,
      personBId: pt.personBId,
      status: pt.status,
    })),
  };
}

export async function buildRiskSummaryForTree(
  treeId: string,
  perspectivePersonId?: string
): Promise<RiskSummary | null> {
  const detail = await loadTreeDetail(treeId, perspectivePersonId);
  if (!detail || !detail.tree.viewingFromPersonId) return null;

  const people = await prisma.person.findMany({
    where: { familyTreeId: treeId },
    include: { conditions: true },
  });
  const relationships = await prisma.relationship.findMany({
    where: { parent: { familyTreeId: treeId } },
  });
  const partnerships = await prisma.partnership.findMany({
    where: { personA: { familyTreeId: treeId } },
  });

  const relations = computeFamilyRelations(
    detail.tree.viewingFromPersonId,
    people.map((p) => ({ id: p.id, sex: p.sex })),
    relationships,
    partnerships.map((pt) => ({ personAId: pt.personAId, personBId: pt.personBId }))
  );

  const conditions = people.flatMap((p) =>
    p.conditions.map((c) => ({
      personId: p.id,
      conditionName: c.conditionName,
      category: c.category,
      ageAtDiagnosis: c.ageAtDiagnosis,
      isCauseOfDeath: c.isCauseOfDeath,
    }))
  );

  return buildRiskSummary(
    relations,
    people.map((p) => ({ id: p.id, displayName: displayName(p) })),
    conditions
  );
}
