# FamilyHealth Tree

A collaborative family-tree app for collecting family medical history — conditions,
causes of death (e.g. from death certificates), and how each person connects back to
a chosen "core person" — so a family can spot patterns like "diabetes is much more
common on Dad's side than Mum's side."

## Why it's built this way (for a future sale)

- **Multi-tenant from day one.** Every family's data lives in its own `FamilyTree`
  record, isolated by membership — this is what lets you sell it as a SaaS product
  to many families later without a rewrite.
- **Multi-user per family.** A tree has an invite code; relatives join with it and
  everyone edits the same shared tree, each attributed to their own account.
- **Standard, boring, portable stack.** Node/Express + TypeScript + Prisma (Postgres)
  on the backend, React + Vite + TypeScript on the frontend. No exotic dependencies,
  easy to hand off or hire for. Postgres from the start (rather than a local SQLite
  file) because most hosting resets its disk on every deploy/restart — a real
  deployment needs a database that survives that.
- **The genealogy + risk logic is the actual product.** `backend/src/lib/relationship.ts`
  computes, relative to whichever person is set as "core": generation, precise
  relationship label (e.g. "Maternal Great-Aunt", "2nd Cousin"), and which side of
  the family (paternal / maternal / core line) each person sits on — purely from
  parent-child edges. `backend/src/lib/risk.ts` uses that to aggregate condition
  frequency by side, which is the headline feature.
- **GEDCOM import** (`backend/src/lib/gedcomParser.ts`). Most people building a
  serious family tree already have one in Ancestry/MyHeritage/FamilySearch/Gramps.
  Rather than making them re-type everyone, a tree's "Import GEDCOM" button parses
  their export and pre-fills names, sex, birth/death dates, cause of death (GEDCOM's
  `CAUS` tag), and every parent-child/spouse link — with a preview step before
  anything is written. GEDCOM has no field for health conditions, so that part stays
  manual, which is the actual value-add of this app on top of a genealogy export.

## Repository layout

```
backend/    Express API + Prisma (SQLite) + relationship/risk engine
frontend/   React + Vite SPA: tree canvas, person editor, risk dashboard
```

See `backend/README.md` and `frontend/README.md` for how to run each.

## Quick start (local dev)

```bash
# 1. Backend — needs DATABASE_URL pointing at a Postgres instance (a free
# Neon or Supabase database works fine) before these commands will connect
cd backend
cp .env.example .env
npm install
npm run prisma:migrate   # applies the schema
npm run seed              # optional: loads a demo family so you have something to look at
npm run dev                # http://localhost:4000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev                # http://localhost:5173
```

Demo login after seeding: `demo@example.com` / `password123`.

## Core data model

- **User** — an account. Can belong to multiple family trees.
- **FamilyTree** — one family's workspace. Has an invite code and a "core person"
  (the reference point the tree is viewed/analysed from).
- **Membership** — links a User to a FamilyTree (role: OWNER/EDITOR), optionally
  linked to the Person record that *is* that user in the tree.
- **Person** — a family member: name, sex, birth/death dates, deceased flag, cause
  of death, notes. Doesn't need to be a living user — most people in a medical
  history tree never log in.
- **Relationship** — a parent → child edge. Two edges per person gives two parents.
- **Partnership** — a spouse/partner edge between two people (for tree layout and
  "married in, not a blood relative" logic).
- **HealthCondition** — belongs to a Person: condition name, category, age at
  diagnosis, whether it was a/the cause of death, and a source
  (self-reported / death certificate / medical record / family recollection).

## Deploying

See `DEPLOYMENT.md` for a from-scratch guide to a free hosted setup (Neon
Postgres + Render), including exactly which dashboard fields/env vars to set.

## Product roadmap ideas (not built yet, noted for a future owner)

- Billing (Stripe) per family tree, email invites (invite codes work without
  it, but email is friendlier), a custom domain.
- PDF/GEDCOM *export*, and GEDCOM import merge/dedup against existing people
  (today's import always creates new people — see `backend/src/lib/gedcomParser.ts`).
- Photo attachments per person.
- Configurable condition taxonomy / ICD-10 codes for clinical-grade exports.
