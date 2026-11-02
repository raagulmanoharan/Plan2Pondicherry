# Pondy — Plan2Pondicherry

Puducherry trip planning on a geographic 3D map. MapLibre renders OpenStreetMap geography streamed by OpenFreeMap: streets, coastline, parks, labels, and mapped building footprints. Search eight editorial destinations and save, reorder, or export a day plan.

## Run and verify

Node.js 22.12+ or 24 recommended.

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:e2e
```

Playwright uses `/usr/bin/chromium`; override with `CHROMIUM_PATH`. Browser regression tests use a small, explicitly synthetic vector tile fixture to verify rendering, controls, failure handling, and itinerary interactions independently of a third-party tile service. These tests do not establish Puducherry coverage or validate geographic accuracy. To check actual map coverage, open the app with access to `tiles.openfreemap.org` and inspect the heritage quarter at zoom 16–19.

## Map sources and accuracy

- [OpenStreetMap](https://www.openstreetmap.org/copyright): mapped roads, building polygons, land use, water, and labels. ODbL attribution is displayed on the map.
- [OpenFreeMap](https://openfreemap.org/quick_start/): geographic vector tiles and Liberty basemap using the OpenMapTiles schema. No API key or backend is required. Internet access to the provider is required.
- [MapLibre](https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/): browser renderer. Buildings use `render_height` and `render_min_height` from the tile provider; missing values fall back to 8 m and 0 m. Provider values can themselves be estimates. This is **not a surveyed digital twin**, a photorealistic mesh, or a guarantee of complete building coverage.

Building colors are presentation styling, not sampled real façade colors. Roof forms, architectural details, vegetation, and individual façades are not reconstructed. Walk mode is an eye-level geographic prototype with mapped road corridors and footprint collision. It supports WASD / arrows, drag-to-look, and touch controls. Flat ground, estimated widths/heights, incomplete tile coverage, and missing captured façades remain limitations. It is not validated navigation or a finished photorealistic city. Road names come from the map source; destination coordinates remain approximate editorial seed data. Dotted itinerary lines and distances connect stops directly, not along roads. Confirm access and opening hours independently.

Plans are saved in browser localStorage. If WebGL or the tile provider is unavailable, discovery and day planning remain usable; a map error explains the failure without substituting invented streets.

## Sources investigated on 2026-11-02

[The source investigation](docs/map-sources.md) records candidates, licenses, coverage checks, and remaining work for photorealistic reconstruction. In particular, the downloaded AMRUT archive labeled “Puducherry” contains Karaikal and Yanam features, not Puducherry city in the pilot bounding box, so it is not used in this map.

## Vercel

`vercel.json` builds the static Vite application from the repository root with `npm ci` and `npm run build`. No environment variables are required. Geographic tiles load directly from OpenFreeMap in the visitor's browser. Keep the provider attribution visible, including on mobile.

Core files: `src/data.js` (editorial destinations and itinerary calculations), `src/scene.js` (geographic renderer), `src/main.js` (UI and persistence), `tests/map-fixture.js` (synthetic browser-test data).

## Walkable-city production pipeline

See [the executable pipeline and source catalog](docs/city-pipeline.md) for OSM acquisition, scene compilation, online image acquisition, COLMAP/OpenMVS reconstruction job plans, source licensing, captured GLB admission, and verification. `city/online-sources.json` identifies online references and a Pondicherry street-model lead. No complete geographic pilot or photo-textured street reconstruction has been acquired in this session.
