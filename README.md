# Pondy — Plan2Pondicherry

A local-first Puducherry trip-planning MVP. Interactive Three.js city illustration, approximate landmark locations, search and category filters, place details, and a reorderable itinerary with local persistence and text export.

## Run

Node.js 22.12+ or 24 recommended.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

Browser regression checks: `npm run test:e2e`. The Playwright configuration uses system Chromium at `/usr/bin/chromium`; set `CHROMIUM_PATH` to another installed Chromium executable when needed. Checks cover desktop discovery, itinerary persistence/reordering/export, and mobile layout.

Vite serves development on port 5173 by default. No API keys or backend are required. Google Fonts are optional; system fonts are used if unavailable. The application and 3D geometry otherwise use local assets.

## Accuracy and scope

This is **not a digital twin or navigation service**. All streets, buildings, trees, and coastline are illustrative generated geometry, not OSM data. The eight editorial place entries use approximate coordinates and unverified visitor information. Straight-line itinerary connections and direct distances are not walking routes. Confirm opening hours and access independently. There are no live business listings or photos.

Plans are saved only in this browser's localStorage. Export downloads a text plan. If WebGL is unavailable, place discovery and itinerary features remain usable.

## Next data integration

1. Audit an explicitly bounded pilot district and import rights-cleared OSM roads/buildings with provenance and ODbL attribution.
2. Replace illustrative geometry with actual footprints, heights where available, and marked estimates elsewhere.
3. Add pedestrian routing through a supported routing engine; never label straight lines as walking directions.
4. Verify landmark entrances, hours, access, and business records with source dates.
5. Add rights-cleared street imagery and surveyed facades. Do not extract Google Street View imagery for reconstruction without applicable permission.

Core files: `src/data.js` (editorial data and itinerary calculations), `src/scene.js` (Three.js illustration), `src/main.js` (UI and persistence).

## Street exploration and Vercel

Use “Explore at street level” to enter an eye-level coastal scene. Drag to look; use WASD, arrow keys, or the on-screen pad to move. Building collision and scene bounds prevent walking through blocks or out to sea. This is illustrative exploration, not geographic navigation. Repeated geometry uses GPU instancing; device pixel ratio is capped and rendering pauses while the tab is hidden. Water motion honors reduced-motion settings.

`vercel.json` configures a static Vite deployment. In Vercel, import this repository, use the repository root, and deploy. No environment variables are required. Alternatively, run `npx vercel` from this directory with your Vercel account. A Vercel project/deployment has not been created by this repository configuration alone.
