import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { treesRouter } from "./routes/trees";
import { peopleRouter } from "./routes/people";
import { relationshipsRouter, partnershipsRouter } from "./routes/relationships";
import { personConditionsRouter, conditionsRouter } from "./routes/conditions";
import { gedcomImportRouter } from "./routes/gedcomImport";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
// GEDCOM exports from genealogy sites can run a few MB, well past the 100kb
// default — everything else in this API sends tiny payloads, so raising the
// limit globally is low-risk.
app.use(express.json({ limit: "20mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/trees", treesRouter);
app.use("/api/trees/:treeId/people", peopleRouter);
app.use("/api/trees/:treeId/people/:personId/conditions", personConditionsRouter);
app.use("/api/trees/:treeId/conditions", conditionsRouter);
app.use("/api/trees/:treeId/relationships", relationshipsRouter);
app.use("/api/trees/:treeId/partnerships", partnershipsRouter);
app.use("/api/trees/:treeId/import/gedcom", gedcomImportRouter);

// Central error handler — keeps stack traces out of API responses.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end" });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`FamilyHealth Tree API listening on http://localhost:${port}`);
});
