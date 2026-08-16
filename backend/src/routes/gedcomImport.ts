import { randomUUID } from "crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, requireTreeMembership } from "../middleware/auth";
import { loadTreeDetail } from "../lib/treePayload";
import { parseGedcom } from "../lib/gedcomParser";

export const gedcomImportRouter = Router({ mergeParams: true });
gedcomImportRouter.use(requireAuth, requireTreeMembership);

const MAX_IMPORT_PEOPLE = 2000;

const previewSchema = z.object({ gedcomText: z.string().min(1) });

// Parses the uploaded file and returns what *would* be imported, without
// writing anything — the frontend shows this as a confirmation step before
// committing.
gedcomImportRouter.post(
  "/preview",
  asyncHandler(async (req, res) => {
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "gedcomText is required" });

    let result;
    try {
      result = parseGedcom(parsed.data.gedcomText);
    } catch {
      return res.status(400).json({ error: "Failed to parse that file. Make sure it's a valid GEDCOM (.ged) export." });
    }

    if (result.people.length === 0) {
      return res
        .status(400)
        .json({ error: "No individuals found in this file. Make sure it's a valid GEDCOM (.ged) export." });
    }
    if (result.people.length > MAX_IMPORT_PEOPLE) {
      return res.status(400).json({
        error: `That file has ${result.people.length} people — this import supports up to ${MAX_IMPORT_PEOPLE} at a time. Export a smaller branch of the tree and try again.`,
      });
    }

    res.json(result);
  })
);

const commitSchema = z.object({
  people: z
    .array(
      z.object({
        gedcomId: z.string(),
        firstName: z.string(),
        lastName: z.string().optional(),
        sex: z.enum(["MALE", "FEMALE", "UNKNOWN"]).optional(),
        birthDate: z.string().optional(),
        isDeceased: z.boolean(),
        deathDate: z.string().optional(),
        causeOfDeath: z.string().optional(),
      })
    )
    .min(1)
    .max(MAX_IMPORT_PEOPLE),
  relationships: z.array(z.object({ parentGedcomId: z.string(), childGedcomId: z.string() })),
  partnerships: z.array(z.object({ aGedcomId: z.string(), bGedcomId: z.string(), status: z.string().optional() })),
});

// Actually creates the people/relationships/partnerships described by a
// previously-previewed parse result. Everyone is imported as a brand new
// Person — this does not try to match/merge against people already in the
// tree.
gedcomImportRouter.post(
  "/commit",
  asyncHandler(async (req, res) => {
    const parsed = commitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid import payload" });
    const { people, relationships, partnerships } = parsed.data;
    const treeId = req.params.treeId;

    const idMap = new Map<string, string>();
    const personRows = people.map((p) => {
      const id = randomUUID();
      idMap.set(p.gedcomId, id);
      return {
        id,
        familyTreeId: treeId,
        firstName: p.firstName.trim() || "Unknown",
        lastName: p.lastName?.trim() || null,
        sex: p.sex || null,
        birthDate: p.birthDate || null,
        isDeceased: p.isDeceased,
        deathDate: p.isDeceased ? p.deathDate || null : null,
        causeOfDeath: p.isDeceased ? p.causeOfDeath || null : null,
      };
    });

    const seenRels = new Set<string>();
    const relRows: { parentId: string; childId: string }[] = [];
    for (const r of relationships) {
      const parentId = idMap.get(r.parentGedcomId);
      const childId = idMap.get(r.childGedcomId);
      if (!parentId || !childId || parentId === childId) continue;
      const key = `${parentId}|${childId}`;
      if (seenRels.has(key)) continue;
      seenRels.add(key);
      relRows.push({ parentId, childId });
    }

    const seenPartners = new Set<string>();
    const partnerRows: { personAId: string; personBId: string; status: string | null }[] = [];
    for (const pt of partnerships) {
      let a = idMap.get(pt.aGedcomId);
      let b = idMap.get(pt.bGedcomId);
      if (!a || !b || a === b) continue;
      if (a > b) [a, b] = [b, a];
      const key = `${a}|${b}`;
      if (seenPartners.has(key)) continue;
      seenPartners.add(key);
      partnerRows.push({ personAId: a, personBId: b, status: pt.status || null });
    }

    await prisma.$transaction([
      prisma.person.createMany({ data: personRows }),
      ...(relRows.length ? [prisma.relationship.createMany({ data: relRows })] : []),
      ...(partnerRows.length ? [prisma.partnership.createMany({ data: partnerRows })] : []),
    ]);

    res.status(201).json({ imported: { people: personRows.length, relationships: relRows.length, partnerships: partnerRows.length }, tree: await loadTreeDetail(treeId) });
  })
);
