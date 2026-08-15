import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, requireTreeMembership } from "../middleware/auth";
import { loadTreeDetail } from "../lib/treePayload";

export const relationshipsRouter = Router({ mergeParams: true });
relationshipsRouter.use(requireAuth, requireTreeMembership);

async function wouldCreateCycle(treeId: string, parentId: string, childId: string): Promise<boolean> {
  if (parentId === childId) return true;
  // Would `childId` end up being its own ancestor? Walk up from parentId.
  const edges = await prisma.relationship.findMany({ where: { parent: { familyTreeId: treeId } } });
  const parentsOf = new Map<string, string[]>();
  for (const e of edges) {
    if (!parentsOf.has(e.childId)) parentsOf.set(e.childId, []);
    parentsOf.get(e.childId)!.push(e.parentId);
  }
  const seen = new Set<string>();
  const queue = [parentId];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === childId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const p of parentsOf.get(cur) || []) queue.push(p);
  }
  return false;
}

const relationshipSchema = z.object({
  parentId: z.string().min(1),
  childId: z.string().min(1),
});

relationshipsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = relationshipSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "parentId and childId are required" });
    const { parentId, childId } = parsed.data;

    const [parent, child] = await Promise.all([
      prisma.person.findFirst({ where: { id: parentId, familyTreeId: req.params.treeId } }),
      prisma.person.findFirst({ where: { id: childId, familyTreeId: req.params.treeId } }),
    ]);
    if (!parent || !child) return res.status(400).json({ error: "Both people must belong to this family tree" });

    if (await wouldCreateCycle(req.params.treeId, parentId, childId)) {
      return res.status(400).json({ error: "That would create a cycle in the family tree" });
    }

    const existing = await prisma.relationship.findUnique({
      where: { parentId_childId: { parentId, childId } },
    });
    if (existing) return res.status(409).json({ error: "That parent-child link already exists" });

    await prisma.relationship.create({ data: { parentId, childId } });
    res.status(201).json(await loadTreeDetail(req.params.treeId));
  })
);

relationshipsRouter.delete(
  "/:relationshipId",
  asyncHandler(async (req, res) => {
    const rel = await prisma.relationship.findFirst({
      where: { id: req.params.relationshipId, parent: { familyTreeId: req.params.treeId } },
    });
    if (!rel) return res.status(404).json({ error: "Relationship not found" });
    await prisma.relationship.delete({ where: { id: rel.id } });
    res.json(await loadTreeDetail(req.params.treeId));
  })
);

export const partnershipsRouter = Router({ mergeParams: true });
partnershipsRouter.use(requireAuth, requireTreeMembership);

const partnershipSchema = z.object({
  personAId: z.string().min(1),
  personBId: z.string().min(1),
  status: z.enum(["MARRIED", "PARTNERED", "DIVORCED", "SEPARATED", "WIDOWED"]).optional(),
});

partnershipsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = partnershipSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "personAId and personBId are required" });
    let { personAId, personBId, status } = parsed.data;
    if (personAId === personBId) return res.status(400).json({ error: "A person can't be partnered with themself" });
    if (personAId > personBId) [personAId, personBId] = [personBId, personAId];

    const [a, b] = await Promise.all([
      prisma.person.findFirst({ where: { id: personAId, familyTreeId: req.params.treeId } }),
      prisma.person.findFirst({ where: { id: personBId, familyTreeId: req.params.treeId } }),
    ]);
    if (!a || !b) return res.status(400).json({ error: "Both people must belong to this family tree" });

    const existing = await prisma.partnership.findUnique({
      where: { personAId_personBId: { personAId, personBId } },
    });
    if (existing) return res.status(409).json({ error: "That partnership already exists" });

    await prisma.partnership.create({ data: { personAId, personBId, status } });
    res.status(201).json(await loadTreeDetail(req.params.treeId));
  })
);

partnershipsRouter.delete(
  "/:partnershipId",
  asyncHandler(async (req, res) => {
    const partnership = await prisma.partnership.findFirst({
      where: { id: req.params.partnershipId, personA: { familyTreeId: req.params.treeId } },
    });
    if (!partnership) return res.status(404).json({ error: "Partnership not found" });
    await prisma.partnership.delete({ where: { id: partnership.id } });
    res.json(await loadTreeDetail(req.params.treeId));
  })
);
