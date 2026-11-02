# One-street panorama reconstruction pilot

Portable experiment for a candidate ~110 m sampling line near Rue Dumas / Notre Dame des Anges, Puducherry. Check the coordinates in `pilot.json` against a map before downloading; they are approximate and not a surveyed street centerline.

**Status:** prepared and offline-tested. No Google imagery was downloaded and no street was reconstructed in the authoring environment, whose proxy denied `maps.googleapis.com` with HTTP 403. The kit stops on HTTP denials; it does not bypass them. It does not establish image reuse rights or publish imagery to the website.

## Requirements

Python 3.11+ on a machine with network access to `github.com`, `maps.googleapis.com`, and `cbk0.google.com`. Install the pinned Python dependencies into a virtual environment. The sparse stage uses CPU PyCOLMAP; a capable desktop and several GB of RAM are recommended. The dense stage additionally needs OpenMVS command-line binaries with GLB export support on PATH; depending on the build and dataset, reconstruction can require substantially more RAM/compute. No paid service is invoked.

From the project root:

```sh
python3 -m venv .venv-street
. .venv-street/bin/activate
pip install -r scripts/street-pilot/requirements.txt
mkdir -p work
git clone https://github.com/FluffyMaguro/Streetview-panorama-scraping.git work/streetview-source
git -C work/streetview-source checkout 81c5d6de73b775e2d0c69486ce41404fa323f4f4
python -m unittest discover -s scripts/street-pilot -v
```

The upstream source stays separate: it is imported for its panorama metadata URL builder and response parser. Its original scripts and dependency pins are not executed. We inspected that upstream commit; the repository's root has no standalone license file, so this kit does not vendor or relicense its code. Review upstream code/dependency rights separately before redistribution.

## 1. Discover and choose one capture period

```sh
python scripts/street-pilot/pilot.py discover --scraper work/streetview-source
python scripts/street-pilot/pilot.py select
```

Discovery samples 12 points, filters panoramas within 40 m of the candidate segment, and deduplicates IDs. Selection keeps distinct camera positions from one year/month and limits the dataset to 12 panoramas. To choose a different available period, use `select --period YYYY-MM`. Inspect `work/rue-dumas-pilot/discovery.json` and `selection.json`: confirm street location, dates, spacing, and overlap. Same month is only a coarse consistency filter, not proof that every image came from one recording pass. The upstream response parser is unofficial and may no longer match Google's current responses. No successful live discovery was demonstrated here.

## 2. Download one panorama first

The original downloader assumes a zoom-5 image grid of 13312 × 6656 and recompresses JPEG at quality 30. This runner requires you to supply the **actual full equirectangular dimensions at zoom 5**, checks HTTP statuses and tile sizes, uses two download workers, and saves JPEG at quality 95. Do not guess dimensions or resize a partial panorama to 2:1; the wrong crop produces wrong camera rays.

For a panorama whose dimensions have independently been confirmed as 13312 × 6656:

```sh
python scripts/street-pilot/pilot.py download --width 13312 --height 6656 --limit 1
```

Open `work/rue-dumas-pilot/panoramas/0000.jpg` and check the full 360° image for padding, missing tiles, stitching errors, and source-date consistency. A 2:1 file and HTTP success alone do not prove a valid panorama. Width and height are explicit because upstream does not supply reliable dimension metadata. If the endpoint or dimensions differ, stop and inspect rather than masking an incomplete image.

Then download a small sequence using the same **verified** dimensions:

```sh
python scripts/street-pilot/pilot.py download --width 13312 --height 6656 --limit 8
```

The limit cannot exceed 12. Downloads are bounded, have connection/read timeouts, stop on HTTP errors, and record hashes and metadata. HTTP 403/429 is a reason to stop, not rotate proxies or retry indefinitely. Some panoramas may need different dimensions; split those into separate reviewed experiments rather than forcing one grid across them. Re-running download refreshes the selected first N images. Keep a separate `--out` directory for separate experiments.

## 3. Reconstruct cameras and sparse geometry

```sh
python scripts/street-pilot/pilot.py sfm
```

Uses `pycolmap.panorama.reconstruct` from pinned PyCOLMAP 4.2.1. It renders perspective views and groups them into fixed, zero-translation camera rigs so views of one panorama are not mistaken for independent viewpoints. Matching is exhaustive within the small pilot; pose recovery uses distinct panorama positions. See [COLMAP's panorama/rig workflow](https://colmap.github.io/rigs.html#reconstruction-from-360-spherical-images).

Inspect `sfm-report.json`, `sfm/sparse/`, and `sfm/component-*.ply`. Registration counts refer separately to perspective views and panorama frames. Check how many input panoramas registered in one connected component. Do not count 12 views of one panorama as 12 independent capture locations. There may be multiple disconnected components. The kit refuses to overwrite an existing SfM database.

## 4. Produce a textured mesh

After inspecting sparse reconstruction and installing compatible OpenMVS binaries:

```sh
python scripts/street-pilot/pilot.py dense
```

This selects the sparse component with the most registered panorama frames, requires at least three frames, undistorts its perspective images, and invokes `InterfaceCOLMAP`, `DensifyPointCloud`, `ReconstructMesh`, `RefineMesh`, and `TextureMesh --export-type glb`. It refuses to overwrite an existing dense directory. Missing tools stop processing before the dense stage. See [OpenMVS usage](https://github.com/cdcseacave/openMVS/wiki/Usage).

Expected final file: `work/rue-dumas-pilot/dense/street.glb`. The OpenMVS calls are prepared, **not executed or validated against real panoramas here**. Check compatibility with the installed OpenMVS version. The GLB remains in reconstruction coordinates: true scale, street alignment, terrain, collision, and mobile optimization still need independent checks. Missing surfaces are missing evidence, not an invitation to call generated detail accurate.

## Offline verification

Seven offline tests cover the sampling-line geometry, one-period selection, tile stitching, aspect validation, and stopping on download failures. The renderer test also rendered a synthetic panorama through PyCOLMAP into 12 perspective views and confirmed zero-translation rig sensors. Those checks establish local code/API compatibility; they do not establish live endpoint operation, real street coverage, successful photogrammetry, or image reuse rights.

The existing website and production deployment are not changed by this kit. Reuse and distribution permissions for source imagery and derivative assets must be resolved before publishing a captured street.
