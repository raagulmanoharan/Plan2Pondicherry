# Puducherry geographic and 3D source investigation

Investigated 2026-11-02. Pilot: Puducherry city / heritage quarter, approximately WGS84 longitude 79.815–79.842, latitude 11.918–11.945. Do not confuse the city with the geographically disconnected territories of the union territory.

## Used in this implementation

**OpenStreetMap via OpenFreeMap / OpenMapTiles.** Stream mapped street geometry, coastline, parks, building footprints, and labels, then extrude building polygons. References: https://openfreemap.org/quick_start/ and https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/ . The documented schema supplies `render_height` and `render_min_height`. Use the provider's values with disclosed defaults, not invented towers or random footprints. Attribution: OpenStreetMap contributors, OpenMapTiles, OpenFreeMap. OSM data license: https://www.openstreetmap.org/copyright . MapLibre is BSD-3-Clause; OpenFreeMap infrastructure is MIT (data has separate licensing).

**Verification limit.** The workspace's network policy denies the tile host. The integration is based on the provider's documentation; browser tests use synthetic fixtures. Live local tile coverage, completeness, and height provenance at individual Puducherry buildings have not been verified. A successful build or fixture test does not remove that limitation.

## Downloaded and checked, excluded for wrong coverage

**AMRUT urban building archive.** https://github.com/ramSeraph/indian_buildings/releases/tag/urban — `PD_AMRUT_Buildings.geojsonl.7z` (3,704,376 bytes downloaded; SHA-256 `95baa3e9102f8f1476b61322b94b0b18e7c515705ab42d775948387d8080c3d8`). Source publisher describes AMRUT / Bhuvan data, with CC0 and attribution requested to Datameet and the original government source: https://github.com/ramSeraph/indianopenmaps/blob/main/DATA_LICENSE.md . This describes the distributor's licensing declaration, not independent confirmation of all original rights.

The archive was extracted and all 68,283 features checked. Its `city` fields contain 59,319 Karaikal and 8,964 Yanam records. Zero polygon vertices fall within the pilot bounding box above. This is not a usable source for a Puducherry city reconstruction, despite the union-territory label. It is not bundled into the application.

## Candidates for subsequent enrichment

- **Overture Maps buildings**: https://docs.overturemaps.org/guides/buildings/ . Candidate for infilling missing OSM footprints and inspecting height/source fields. No Puducherry subset downloaded or coverage validated in this session. Check release-specific licensing and provenance before merging; avoid double extrusions from overlapping datasets.
- **Microsoft global building footprints**: https://github.com/microsoft/GlobalMLBuildingFootprints . Candidate satellite-derived footprints; footprints do not establish true façades or complete height data. Not downloaded in this session.
- **Official Puducherry planning maps**: https://tcpd.py.gov.in/puducherry-existing-land-use-2015 and https://ppa.py.gov.in/land-use . Useful authoritative land-use and planning references. No machine-readable licensed 3D building mesh was established from these pages.
- **Google Photorealistic 3D Tiles**: https://developers.google.com/maps/documentation/tile/3d-tiles-overview . A possible licensed renderer source where coverage exists. The documentation does not establish Puducherry-specific photorealistic coverage. No API key, billing, city coverage test, or imagery extraction was performed.
- **Wikimedia Commons**: geolocated Puducherry photographs can be individual façade references, subject to each file's license. Example: https://commons.wikimedia.org/wiki/File:Elevation_of_an_Orange_colour_building_on_Puducherry_streets.jpg . A single photo is not a surveyed building model or a complete photogrammetry capture.

## What is still required for a true visual recreation

Confirm footprints against current imagery or a survey; verify building heights and roofs; acquire rights-cleared multi-view photography or licensed scans of landmark façades; georeference models; test dimensions and alignment against independent control points. Begin with the Promenade / Bharathi Park / White Town corridor before claiming city-wide fidelity. Keep measured, inferred, and default attributes separate. This implementation delivers the geographic map foundation, not that completed photorealistic reconstruction.
