# Frontend — FamilyHealth Tree

React 19 + TypeScript + Vite. No UI framework dependency — plain CSS with a
small design-token system in `src/index.css` so the whole app (and any future
white-labeling for a specific customer) stays easy to re-skin.

## Setup

```bash
cp .env.example .env   # points at the backend; defaults to http://localhost:4000/api
npm install
npm run dev              # http://localhost:5173
```

Requires the backend running (see `../backend/README.md`).

## Structure

```
src/
  api/client.ts              Typed fetch wrapper for every backend endpoint
  context/AuthContext.tsx    JWT session state
  types.ts                   DTOs mirroring the backend's API shapes
  lib/treeLayout.ts          Groups people into couples and nests them into
                              a forest for rendering — the tricky part being
                              that a real family tree isn't a strict tree
                              (lineages reconverge); see the comments there.
  components/
    FamilyTreeCanvas.tsx      The org-chart-style tree (pure CSS connectors)
    PersonCard.tsx            One person's card, color-coded by side
    PersonEditorDrawer.tsx    Edit details / family links / health conditions
    RiskChart.tsx             Grouped bar chart, paternal vs maternal vs core
  pages/
    DashboardPage.tsx         List / create / join family trees
    TreePage.tsx               The tree view for one family
    RiskPage.tsx                The risk dashboard
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — typecheck (`tsc -b`) + production build to `dist/`
- `npm run preview` — serve the production build locally
- `npm run lint` — oxlint
