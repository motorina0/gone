# Cluj-Napoca station source data

This directory contains the editable geographic inputs and conservative gameplay decisions for the Gone location `cluj-napoca-station`. It contains data, not runtime artwork.

## Sources

- `osm-source.json`: clipped OpenStreetMap geometry retrieved on 2026-08-20 from the OSM map API. Source SHA-256 and the exact request URL are stored in the file. OpenStreetMap data is © OpenStreetMap contributors and licensed under ODbL 1.0.
- `terrain-source.json`: a deterministic 7 × 5 sample of Copernicus DEM GLO-30 tile `N46 E023`, retrieved on 2026-08-20. The source URL, tile SHA-256, vertical datum, robust planar canonical model, required source and liability notices, sampling method, and licence link are stored in the file.
- `openaerialmap-coverage.json`: the 2026-08-20 OAM metadata result over the final `23.5838,46.7821,23.5933,46.7863` envelope. It records zero catalogue images and explains why the viewer basemap was not used.
- `gameplay-authoring.json`: editable, explicitly documented decisions for the forecourt, legitimate mapped crossings and platform links, approximate vertical access and canopies, relative station elevations, and known approximations.

No Google Maps, Google Earth, proprietary basemap, or aerial image is used, traced, bundled, or redistributed.

## Reproduction

Given the original downloaded source files, the normalized source snapshots are reproduced with:

```sh
npm run import:cluj:osm -- path/to/map.osm 2026-08-20
npm run import:cluj:dem -- path/to/Copernicus_DSM_COG_10_N46_00_E023_00_DEM.tif 2026-08-20
```

Generate all runtime content and vector art with:

```sh
npm run generate:cluj
```

The importers sort and round their output deterministically. The generator reads only committed JSON sources and overwrites the generated location resources idempotently.
