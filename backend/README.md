# Backend — FamilyHealth Tree API

Express + TypeScript + Prisma (SQLite by default).

## Setup

```bash
cp .env.example .env
npm install
npm run prisma:migrate   # creates dev.db and applies the schema
npm run seed              # optional demo data (demo@example.com / password123)
npm run dev                # http://localhost:4000
```

## Scripts

- `npm run dev` — start with hot reload (tsx watch)
- `npm run build` / `npm start` — compile to `dist/` and run it
- `npm run prisma:migrate` — create/apply a migration after editing `prisma/schema.prisma`
- `npm run seed` — load the demo family tree
- `npm run typecheck` — `tsc --noEmit`

## API overview

All routes except `/api/auth/*` require `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | create an account |
| POST | `/api/auth/login` | get a token |
| GET | `/api/auth/me` | current user |
| GET | `/api/trees` | list my family trees |
| POST | `/api/trees` | create a tree (seeds a core person) |
| POST | `/api/trees/join` | join a tree by invite code |
| GET | `/api/trees/:treeId?perspective=<personId>` | full tree + computed relations, optionally viewed from someone other than the stored core person |
| PATCH | `/api/trees/:treeId` | rename tree / change core person |
| GET | `/api/trees/:treeId/risk-summary?perspective=<personId>` | condition counts by paternal/maternal/core side |
| POST/PATCH/DELETE | `/api/trees/:treeId/people[/:personId]` | manage people |
| POST/DELETE | `/api/trees/:treeId/relationships[/:relationshipId]` | parent → child edges |
| POST/DELETE | `/api/trees/:treeId/partnerships[/:partnershipId]` | spouse/partner edges |
| POST | `/api/trees/:treeId/people/:personId/conditions` | add a health condition |
| PATCH/DELETE | `/api/trees/:treeId/conditions/:conditionId` | edit/remove a condition |
| POST | `/api/trees/:treeId/import/gedcom/preview` | parse an uploaded GEDCOM file, return what would be imported (writes nothing) |
| POST | `/api/trees/:treeId/import/gedcom/commit` | actually create the people/relationships/partnerships from a previewed parse result |

The relationship/side/label computation lives in `src/lib/relationship.ts`; the
risk aggregation lives in `src/lib/risk.ts`. Both are pure functions with no
Prisma dependency, so they're straightforward to unit test.
