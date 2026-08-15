import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, requireTreeMembership } from "../middleware/auth";
import { loadTreeDetail } from "../lib/treePayload";

export const peopleRouter = Router({ mergeParams: true });
peopleRouter.use(requireAuth, requireTreeMembership);

const personSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional().nullable(),
  sex: z.enum(["MALE", "FEMALE", "UNKNOWN"]).optional().nullable(),
  birthDate: z.string().max(50).optional().nullable(),
  isDeceased: z.boolean().optional(),
  deathDate: z.string().max(50).optional().nullable(),
  causeOfDeath: z.string().max(500).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

peopleRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = personSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    await prisma.person.create({
      data: { familyTreeId: req.params.treeId, ...parsed.data },
    });
    res.status(201).json(await loadTreeDetail(req.params.treeId));
  })
);

const updatePersonSchema = personSchema.partial();

peopleRouter.patch(
  "/:personId",
  asyncHandler(async (req, res) => {
    const parsed = updatePersonSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const person = await prisma.person.findFirst({
      where: { id: req.params.personId, familyTreeId: req.params.treeId },
    });
    if (!person) return res.status(404).json({ error: "Person not found in this family tree" });

    await prisma.person.update({ where: { id: person.id }, data: parsed.data });
    res.json(await loadTreeDetail(req.params.treeId));
  })
);

peopleRouter.delete(
  "/:personId",
  asyncHandler(async (req, res) => {
    const person = await prisma.person.findFirst({
      where: { id: req.params.personId, familyTreeId: req.params.treeId },
    });
    if (!person) return res.status(404).json({ error: "Person not found in this family tree" });

    const tree = await prisma.familyTree.findUnique({ where: { id: req.params.treeId } });
    if (tree?.corePersonId === person.id) {
      return res.status(400).json({
        error: "This person is set as the tree's core person. Set a different core person before deleting them.",
      });
    }

    await prisma.person.delete({ where: { id: person.id } });
    res.json(await loadTreeDetail(req.params.treeId));
  })
);
