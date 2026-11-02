# Walkable Puducherry pipeline

This change adds an eye-level geographic walking prototype and an offline pipeline for richer captured street chunks. It does not claim that a photorealistic Puducherry city has been reconstructed.

## What runs today

Three.js renders a flat-ground district with road ribbons from mapped centerlines, extruded geographic footprints (including courtyards), and individually mapped tree positions. The camera is 1.7 m above ground. Drag to look, WASD / arrows to walk, Shift to move faster, or use the touch pad. Collision checks prevent crossing footprint walls, water polygons, and district bounds; movement stays on mapped road / park corridors. Missing tree records do not become random trees. Sidewalks, road widths, and missing building heights are estimates, not a surveyed navigability model. Elevated buildings are handled approximately; stairs, terrain, bridges, and building interiors are not implemented.

The app first requests `/city/pilot.json`. When no compiled pilot is published, it compiles **the loaded geographic tile cache** into a 700 × 700 m walking preview around the current map center. Tile geometry may be clipped and incomplete. The user sees an error if there are no mapped road corridors or a safe spawn; the app does not invent a grid to hide missing data. A complete, reviewed offline extract is the intended production source.

## Stage 1: acquire the geographic pilot

Configuration: `city/pilot.config.json`. The pilot covers White Town, Bharathi Park, and the Promenade area, in local metric coordinates around 11.9325 N, 79.833 E.

```sh
npm run city:fetch -- --out work/osm-pilot.json
npm run city:build -- --input work/osm-pilot.json
npm run city:validate
```

`city:fetch` downloads OSM elements from Overpass with a bounded query. Its receipt records the endpoint, bounding box, acquisition timestamp, and checksum. It does not download imagery. An existing OSM JSON or WGS84 GeoJSON FeatureCollection can be imported instead. Roads, buildings, natural=tree points, water, and parks are normalized into `public/city/pilot.json`, with a separate quality/count report. `height` tags, floor-based height estimates, provider heights, and default estimates are distinguished; widths record whether they are estimated. The renderer preserves OSM attribution.

The network policy in this session returned HTTP 403 for the Overpass and OpenFreeMap hosts at the time of the attempted live acquisition. Consequently no complete Puducherry pilot extract is bundled in this commit. Tests use synthetic fixtures. A successful build does not validate local geographic coverage. Once network access is enabled, rerun acquisition and inspect the pilot before describing it as geographically reviewed.

## Stage 2: find and acquire online imagery

`city/online-sources.json` records actual source pages, creators, declared licenses, dates, and intended use. The first two references are Wikimedia Commons photographs with checked CC BY-SA 3.0 file pages:

- [Aayi mandapam 2](https://commons.wikimedia.org/wiki/File:Aayi_mandapam_2.jpg), Shyamal, 2019-04-20.
- [Eglise de Notre Dame des Anges — PONDICHERRY](https://commons.wikimedia.org/wiki/File:Eglise_de_Notre_Dame_des_Anges_-_PONDICHERRY.JPG), Aravindaraja, 2012-09-22.

```sh
npm run city:images
```

This downloads images into `work/imagery` and records attribution, SHA-256, byte size, and acquisition time. Downloads to the image host returned HTTP 403 in this session, so those originals are not bundled. The catalog flags these as **reference-only**, not a reconstructable sequence. They depict different places at different dates; feeding them together to photogrammetry would not reconstruct a street.

Online leads worth checking next:

- [Francois Martin street, East, Pondicherry, India](https://sketchfab.com/models/f7febe66b9bb43dfb579dd6241fac849/embed), by nicolas14. Listing found; license, authorized download, actual dimensions, texture quality, georeferencing, and coverage are unverified. Do not extract the viewer's private asset files.
- [KartaView](https://kartaview.org/) imagery sequences. Its [terms](https://kartaview.org/terms) declare CC BY-SA 4.0 imagery and spatial data. Actual Puducherry sequence coverage, overlap, source authors, and API availability still need checking before downloading a useful sequence.
- [Commons street photographs](https://commons.wikimedia.org/wiki/Category:Streets_in_Pondicherry). Check each file's license and capture date. A reference photo is not a metric survey or evidence of unseen façades.

The Google Street View link in walking mode opens the official service at the player's approximate coordinates; it does not extract or texture models with Google content. Google's [Maps Platform terms](https://cloud.google.com/maps-platform/terms) restrict extracting imagery and creating standalone content from Maps content. A different licensing agreement would need to explicitly cover the intended reconstruction use.

## Stage 3: reconstruct captured street chunks

Use a coherent, overlapping multi-view sequence of the **same block**, not an assortment of travel photos. Match capture dates, remove severe blur and moving obstructions, and inspect whether façades, both sides of roads, and junctions are covered. Record creator, source, license, local file, SHA-256, sequence identifier, and `reconstructionReady: true` for each admitted image. The script requires at least 20 reviewed images as an operational minimum; 20 images does not guarantee successful or complete reconstruction.

```sh
npm run city:reconstruct -- --manifest work/imagery/sequence.json --images work/imagery/sequence --out work/reconstruction
```

By default this writes a reviewable job plan without executing reconstruction. On a machine with compatible COLMAP and OpenMVS installed, `--run true` executes the plan. Pin and check the installed tool versions and their flags first. COLMAP and OpenMVS are not installed in this session, so the reconstruction commands have **not** been executed or validated against real imagery here.

The planned stages are feature extraction → sequential matching → sparse camera reconstruction → image undistortion → OpenMVS conversion → dense points → mesh → refinement → photo-textured GLB. References: [COLMAP tutorial](https://colmap.github.io/tutorial.html), [OpenMVS usage](https://github.com/cdcseacave/openMVS/wiki/Usage). Capture with different camera models and ordering may need different matching/intrinsic options. `sparse/0` is only the first registered component; inspect all components and reject incomplete registration rather than silently publishing it.

## Stage 4: align, optimize, and admit

Photogrammetry has an arbitrary scale, position, and orientation. Align each chunk to surveyed control points or independently measured dimensions in the local metric frame. Record the alignment method and errors. A visually plausible mesh alone does not establish an accurate reconstruction. Ground is y=0; x is east, z is south; the runtime camera uses y-up. Bake/retain source-photo textures, split blocks into self-contained GLBs below 25 MiB (uncompressed geometry with PNG/JPEG textures; Draco, Meshopt and KTX2 decoders are not configured), optimize triangle counts and texture resolution, and inspect on target mobile devices. The runtime currently loads every admitted chunk in the pilot; large-city distance streaming and LOD selection are future work.

Example model manifest (placeholder paths and transforms, not a supplied asset):

```json
{
  "models": [{
    "file": "aligned-block.glb",
    "source": "https://example.com/the-licensed-source",
    "creator": "Source photographer / scan author",
    "license": "CC-BY-SA-4.0",
    "alignment": "Measured control points; record residuals separately",
    "position": [0, 0, 0],
    "yaw": 0,
    "scale": 1
  }]
}
```

```sh
npm run city:build -- --input work/osm-pilot.json --models work/models/manifest.json
```

Admission requires license/creator/source/alignment metadata, validates GLB v2 framing and embedded resources, copies content-addressed model assets, and records checksums. It does not establish that the license metadata is legally sufficient or that a mesh is accurate. Source-photo attribution and ShareAlike obligations must accompany published derivative assets; this code does not relicense them. Runtime collision still follows map footprints rather than every triangle of a captured mesh. Full reconstructed-mesh collision and terrain are subsequent work.

## Stage 5: verify and publish

```sh
npm test
npm run test:e2e
npm run build
```

Unit tests cover projection, source attribute handling, polygon holes, walking corridors, safe spawning, collisions without tunneling, and the offline compiler. Browser checks cover eye-level movement, exit to map, itinerary persistence/export, mobile map controls, and provider failure. Browser map fixtures are explicitly synthetic; they are never served to production.

Before publishing real pilot assets, verify street alignment against independent measurements; inspect geometry and trees at eye level; compare captured-model texture coverage; walk junctions, walls, district edges, and water boundaries; test mobile controls and frame times. The current tests do not prove photorealism, real-world public access, terrain accuracy, or city-wide coverage. Vercel hosts the static app and compiled assets; photogrammetry belongs on a reconstruction worker, not in a Vercel request handler.
