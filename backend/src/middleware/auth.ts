import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt";
import { prisma } from "../db";

export interface AuthedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

/** Requires a valid `Authorization: Bearer <token>` header. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Requires the authenticated user to be a member of the :treeId route param's
 * family tree. Attaches `req.membership` for downstream handlers.
 */
export async function requireTreeMembership(
  req: AuthedRequest & { membership?: { role: string; id: string } },
  res: Response,
  next: NextFunction
) {
  const treeId = req.params.treeId || req.params.id;
  if (!treeId) return res.status(400).json({ error: "Missing family tree id" });
  const membership = await prisma.membership.findUnique({
    where: { userId_familyTreeId: { userId: req.userId!, familyTreeId: treeId } },
  });
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this family tree" });
  }
  req.membership = membership;
  next();
}
