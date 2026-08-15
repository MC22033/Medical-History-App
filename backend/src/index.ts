import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { treesRouter } from "./routes/trees";
import { peopleRouter } from "./routes/people";
import { relationshipsRouter, partnershipsRouter } from "./routes/relationships";
import { personConditionsRouter, conditionsRouter } from "./routes/conditions";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/trees", treesRouter);
app.use("/api/trees/:treeId/people", peopleRouter);
app.use("/api/trees/:treeId/people/:personId/conditions", personConditionsRouter);
app.use("/api/trees/:treeId/conditions", conditionsRouter);
app.use("/api/trees/:treeId/relationships", relationshipsRouter);
app.use("/api/trees/:treeId/partnerships", partnershipsRouter);

// Central error handler — keeps stack traces out of API responses.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end" });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`FamilyHealth Tree API listening on http://localhost:${port}`);
});
