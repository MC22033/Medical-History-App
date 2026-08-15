import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, requireTreeMembership } from "../middleware/auth";
import { loadTreeDetail } from "../lib/treePayload";

const conditionSchema = z.object({
  conditionName: z.string().min(1).max(200),
  category: z.string().max(100).optional().nullable(),
  ageAtDiagnosis: z.number().int().min(0).max(130).optional().nullable(),
  isCauseOfDeath: z.boolean().optional(),
  source: z
    .enum(["SELF_REPORTED", "DEATH_CERTIFICATE", "MEDICAL_RECORD", "FAMILY_RECOLLECTION"])
    .optional()
    .nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// Nested under /trees/:treeId/people/:personId/conditions
export const personConditionsRouter = Router({ mergeParams: true });
personConditionsRouter.use(requireAuth, requireTreeMembership);

personConditionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = conditionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const person = await prisma.person.findFirst({
      where: { id: req.params.personId, familyTreeId: req.params.treeId },
    });
    if (!person) return res.status(404).json({ error: "Person not found in this family tree" });

    await prisma.healthCondition.create({ data: { personId: person.id, ...parsed.data } });
    res.status(201).json(await loadTreeDetail(req.params.treeId));
  })
);

// Mounted under /trees/:treeId/conditions/:conditionId
export const conditionsRouter = Router({ mergeParams: true });
conditionsRouter.use(requireAuth, requireTreeMembership);

const updateConditionSchema = conditionSchema.partial();

conditionsRouter.patch(
  "/:conditionId",
  asyncHandler(async (req, res) => {
    const parsed = updateConditionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const condition = await prisma.healthCondition.findFirst({
      where: { id: req.params.conditionId, person: { familyTreeId: req.params.treeId } },
    });
    if (!condition) return res.status(404).json({ error: "Health condition not found" });

    await prisma.healthCondition.update({ where: { id: condition.id }, data: parsed.data });
    res.json(await loadTreeDetail(req.params.treeId));
  })
);

conditionsRouter.delete(
  "/:conditionId",
  asyncHandler(async (req, res) => {
    const condition = await prisma.healthCondition.findFirst({
      where: { id: req.params.conditionId, person: { familyTreeId: req.params.treeId } },
    });
    if (!condition) return res.status(404).json({ error: "Health condition not found" });

    await prisma.healthCondition.delete({ where: { id: condition.id } });
    res.json(await loadTreeDetail(req.params.treeId));
  })
);
