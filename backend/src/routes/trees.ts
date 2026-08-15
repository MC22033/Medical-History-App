import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { generateInviteCode } from "../lib/inviteCode";
import { requireAuth, requireTreeMembership, AuthedRequest } from "../middleware/auth";
import { loadTreeDetail, buildRiskSummaryForTree } from "../lib/treePayload";

export const treesRouter = Router();
treesRouter.use(requireAuth);

// List all family trees the current user belongs to.
treesRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.userId! },
      include: { familyTree: true },
    });
    res.json({
      trees: memberships.map((m) => ({
        id: m.familyTree.id,
        name: m.familyTree.name,
        role: m.role,
        inviteCode: m.familyTree.inviteCode,
        createdAt: m.familyTree.createdAt,
      })),
    });
  })
);

const createTreeSchema = z.object({
  treeName: z.string().min(1).max(200),
  corePersonFirstName: z.string().min(1).max(100),
  corePersonLastName: z.string().max(100).optional(),
  corePersonSex: z.enum(["MALE", "FEMALE", "UNKNOWN"]).optional(),
});

// Create a new family tree, seeded with a "core person" record representing
// whoever is starting the tree (usually the creator themself).
treesRouter.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = createTreeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { treeName, corePersonFirstName, corePersonLastName, corePersonSex } = parsed.data;

    let inviteCode = generateInviteCode();
    // Extremely unlikely to collide, but guard anyway.
    while (await prisma.familyTree.findUnique({ where: { inviteCode } })) {
      inviteCode = generateInviteCode();
    }

    const tree = await prisma.familyTree.create({
      data: { name: treeName, inviteCode },
    });
    const corePerson = await prisma.person.create({
      data: {
        familyTreeId: tree.id,
        firstName: corePersonFirstName,
        lastName: corePersonLastName,
        sex: corePersonSex,
      },
    });
    await prisma.familyTree.update({ where: { id: tree.id }, data: { corePersonId: corePerson.id } });
    await prisma.membership.create({
      data: {
        userId: req.userId!,
        familyTreeId: tree.id,
        role: "OWNER",
        linkedPersonId: corePerson.id,
      },
    });

    const detail = await loadTreeDetail(tree.id);
    res.status(201).json(detail);
  })
);

const joinSchema = z.object({ inviteCode: z.string().min(1) });

treesRouter.post(
  "/join",
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invite code is required" });

    const tree = await prisma.familyTree.findUnique({
      where: { inviteCode: parsed.data.inviteCode.trim().toUpperCase() },
    });
    if (!tree) return res.status(404).json({ error: "No family tree found for that invite code" });

    const existing = await prisma.membership.findUnique({
      where: { userId_familyTreeId: { userId: req.userId!, familyTreeId: tree.id } },
    });
    if (existing) return res.json({ treeId: tree.id, alreadyMember: true });

    await prisma.membership.create({
      data: { userId: req.userId!, familyTreeId: tree.id, role: "EDITOR" },
    });
    res.status(201).json({ treeId: tree.id, alreadyMember: false });
  })
);

treesRouter.get(
  "/:treeId",
  requireTreeMembership,
  asyncHandler(async (req, res) => {
    const perspective = typeof req.query.perspective === "string" ? req.query.perspective : undefined;
    const detail = await loadTreeDetail(req.params.treeId, perspective);
    if (!detail) return res.status(404).json({ error: "Family tree not found" });
    res.json(detail);
  })
);

const updateTreeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  corePersonId: z.string().optional(),
});

treesRouter.patch(
  "/:treeId",
  requireTreeMembership,
  asyncHandler(async (req, res) => {
    const parsed = updateTreeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    if (parsed.data.corePersonId) {
      const person = await prisma.person.findFirst({
        where: { id: parsed.data.corePersonId, familyTreeId: req.params.treeId },
      });
      if (!person) return res.status(400).json({ error: "corePersonId must belong to this family tree" });
    }

    await prisma.familyTree.update({
      where: { id: req.params.treeId },
      data: {
        name: parsed.data.name,
        corePersonId: parsed.data.corePersonId,
      },
    });
    const detail = await loadTreeDetail(req.params.treeId);
    res.json(detail);
  })
);

treesRouter.get(
  "/:treeId/risk-summary",
  requireTreeMembership,
  asyncHandler(async (req, res) => {
    const perspective = typeof req.query.perspective === "string" ? req.query.perspective : undefined;
    const summary = await buildRiskSummaryForTree(req.params.treeId, perspective);
    if (!summary) {
      return res
        .status(400)
        .json({ error: "This tree needs a core person set before a risk summary can be computed" });
    }
    res.json(summary);
  })
);
