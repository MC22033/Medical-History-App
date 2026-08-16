# Deploying FamilyHealth Tree (free tier: Neon + Render)

A from-scratch guide to getting this app running on a real, always-on web
address — no terminal required once it's set up. Uses two free services:

- **[Neon](https://neon.tech)** — hosts the Postgres database
- **[Render](https://render.com)** — hosts the backend API and the frontend site

Both have generous free tiers and connect directly to a GitHub repo, so
pushing new code (or asking Claude to) redeploys automatically.

**Free tier trade-off to know up front:** Render's free web services "spin
down" after ~15 minutes with no traffic, and take 30-60 seconds to wake back
up on the next request. Fine for a personal/family app; if that cold start
becomes annoying, Render's cheapest paid tier (~$7/mo) removes it.

---

## Phase 1 — Database (Neon)

1. Go to **[neon.tech](https://neon.tech)** → **Sign up** (GitHub login is easiest).
2. Create a project — any name (e.g. "familyhealth-tree"), default region is fine.
3. On the project dashboard, find **Connection string** (usually shown right
   away, or under **Connect**). Copy it — it looks like:
   ```
   postgresql://neondb_owner:AbC123@ep-cool-name-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Save that string somewhere for Phase 2 — it's the `DATABASE_URL`.

That's the whole database step. Nothing to configure inside it — the app
creates its own tables on first deploy.

---

## Phase 2 — Backend (Render Web Service)

1. Go to **[render.com](https://render.com)** → **Sign up** (GitHub login again).
2. **New +** → **Web Service**.
3. Connect your GitHub account if asked, then pick the `Medical-History-App` repo.
4. Fill in:
   - **Name:** `familyhealth-backend` (or anything)
   - **Branch:** `claude/family-medical-history-app-5jhbt1` (or `main`, once merged)
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run migrate:deploy && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from Phase 1 |
   | `JWT_SECRET` | any long random string (mash the keyboard, 30+ characters) |
   | `CORS_ORIGIN` | leave as `*` for now — tighten it in Phase 4 |
6. **Create Web Service.** First deploy takes a few minutes — watch the log.
7. Once it says "Live," copy the URL at the top of the page (something like
   `https://familyhealth-backend.onrender.com`). That's your API's address —
   save it for Phase 3.
8. Sanity check: open `https://familyhealth-backend.onrender.com/api/health`
   in a browser — it should show `{"ok":true}`.

---

## Phase 3 — Frontend (Render Static Site)

1. Back on Render: **New +** → **Static Site**.
2. Same repo, same branch.
3. Fill in:
   - **Name:** `familyhealth-app` (this becomes part of your URL)
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | your backend URL from Phase 2, with `/api` on the end — e.g. `https://familyhealth-backend.onrender.com/api` |
5. **Create Static Site.** Once live, you'll get a URL like
   `https://familyhealth-app.onrender.com` — **this is the link you'll actually use and share.**

---

## Phase 4 — Connect them properly

Right now the backend accepts requests from anywhere (`CORS_ORIGIN=*`), which
works but is loose. Tighten it:

1. Go back to the **backend** service on Render → **Environment**.
2. Change `CORS_ORIGIN` to your frontend's exact URL from Phase 3, e.g.
   `https://familyhealth-app.onrender.com` (no trailing slash).
3. Save — Render redeploys automatically.

---

## Phase 5 — Test it

Open your frontend URL (`https://familyhealth-app.onrender.com`) and log in
with `demo@example.com` / `password123` — same demo data as local, now
running on a real, always-on address.

Remember the free-tier cold start: if nobody's used it in a while, the first
load can take 30-60 seconds while the backend wakes up. Refresh if a login
attempt seems to hang.

---

## Updating after code changes

Both Render services are connected to the GitHub branch — every time new
code is pushed to it, Render automatically rebuilds and redeploys both
within a minute or two. Nothing manual required.

## Creating a real account (not the demo one)

The demo login is just seeded test data. To start your own real family tree:
go to the frontend URL, click **"New here? Create an account,"** and sign up
with your own email — completely separate from the demo family.
