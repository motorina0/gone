# Gara Cluj-Napoca location

## Scope

The canonical source envelope is WGS84 west `23.58380`, east `23.59330`, south `46.78210`, north `46.78630`: approximately 725 × 467 metres. The visible and camera-constrained playable footprint is an octagonal subset recorded in `gameplay-authoring.json`. It cuts unsupported outer corners instead of presenting blank grey terrain or inventing filler buildings, trees, and streets. The eastern edge is slightly beyond the initial requested bound so the mapped passenger platforms are complete; the western side was tightened to avoid distant neighbourhood and yard content.

The map includes the main station building and its mapped entrances, mapped passenger platforms, original approximate canopies, passenger tracks, Piața Gării, tram and bus stops, immediate public paths, mapped underground passenger passages, legitimate mapped rail crossings, visible barriers, nearby framing buildings, mapped trees, and transport furniture. Entrances are visible but station interiors, construction/service areas, unrelated yards, and ordinary track beds are closed. Location names and labels are not embedded in the world artwork; the HUD retains the current area and position, and legally required attribution remains visible.

## Geographic transform

The canonical local origin is the southwest source bound: latitude `46.78210`, longitude `23.58380`. Local `x` points east and local `y` points north. At the envelope midpoint, the deterministic WGS84 series used by `LocalGeoTransform` gives:

- longitude: `76,361.654869547` metres per degree;
- latitude: `111,166.596914633` metres per degree.

Conversion is:

```text
x = (longitude - west) × metresPerDegreeLongitude
y = (latitude - south) × metresPerDegreeLatitude
```

The inverse divides by the same constants and adds the southwest origin. Elevation never participates in this geographic conversion and remains the third canonical world coordinate. Five screen projections consume `(x, y, elevation)` without altering world state.

The requested anchor maps deterministically to world `(200.122, 216.364, 0)`.

## Elevation model

Copernicus GLO-30 supplies the broad absolute terrain context. The 35 sampled DSM neighbourhoods have a robust median of `336.559 m` EGM2008. A conservative plane is fitted through per-column and per-row medians; its estimated elevation at the map anchor is `338.196 m`, with an east slope of `-0.005684726 m/m` and a north slope of `-0.003844080 m/m`. Canonical ground elevation is zero at the anchor and varies continuously across the map using that plane. This rejects isolated DSM roofs and vegetation while retaining the open-data terrain trend.

Because a 30 m digital surface model cannot resolve station edges, gameplay-relevant structures use explicit offsets from the local terrain plane:

- public ground: terrain plane `+0 m`;
- platform top: terrain plane `+0.55 m`;
- track bed: terrain plane `-0.35 m`;
- passenger tunnel: terrain plane `-3.2 m`;
- canopy clearance: terrain plane `+4.2 m`.

Mapped stairs that actually terminate on a passenger-tunnel line are explicit navigation connections between surface and tunnel elevations; underground stairs with both ends on tunnel geometry remain underground. Movement interpolates elevation along a connection. No tunnel endpoint is automatically promoted to a surface portal. The Peronul 4;5 and Peronul 6;7 vertical links are conservative, explicitly authored approximations at mapped tunnel/platform intersections because OSM does not contain their exact vertical structures. Railway and tram centerlines generate separate non-walkable hazard polygons. Holes are made only for tagged OSM pedestrian crossings, the two rail crossings backed by tagged OSM crossing nodes, and source-backed passenger footways recorded in `gameplay-authoring.json`.

All five mapped passenger-platform polygons are reachable from the forecourt. Peronul 6;7 receives one conservative stair connection at the mathematical intersection of its mapped polygon and the mapped passenger tunnel because OSM omits the exact vertical structure. Eastern Peronul 1 has a short conservative connector across the six-metre gap between its mapped passenger footway and platform edge. Both are clearly marked approximations in the editable authoring data.

## Artwork and performance

`tools/generate-cluj-station.ts` creates five original Gone SVG beauty views plus separate icon, occlusion, and extended backdrop SVGs. The artwork is generated from normalized OSM geometry with original colors, vector patterns, roofs, façades, ballast, track marks, canopies, trees, wet-surface treatment, and text-free transport/entrance symbols. It does not trace or sample any map image. Every generated layer is clipped to the editable source-supported footprint, leaving only the established dark backdrop beyond the trimmed map edge.

The field operative uses an original eight-direction Blender atlas refined from `art/agent/references/gone-operative-turnaround.png`: dark weatherproof coat, charcoal knitwear and trousers, worn brown boots, and a practical satchel. Cluj declares a canonical visual height of `1.8 m` and the atlas records a measured 137-pixel visible idle silhouette. The runtime derives scale per view as `1.8 × projection scale ÷ 137`, yielding approximately 5.5 visible screen pixels at the default 3× tactical zoom and preserving the map's metre scale instead of making the character building-sized.

Long geographic lines are clipped, coordinates are rounded, buildings are reduced to one footprint extrusion each, and navigation uses two-metre cells over selected public surfaces only. Exact building polygons keep closed interiors non-walkable; long fence and wall collisions are split into short local segments to avoid oversized bounding boxes. Location geometry remains in JSON; the generic runtime contains no Cluj coordinates or feature IDs.

## Attribution and limitations

The runtime displays clickable OpenStreetMap and Copernicus attribution whenever this location is loaded. Its expandable DEM legal note contains the required Copernicus produced-using notice and no-liability sentence. Exact sources, hashes, retrieval dates, licences, transformations, and the zero-result OAM coverage check over the final shipped bounds are in `data/cluj-napoca-station/`.

The 2026 OSM snapshot includes active rail reconstruction metadata. Platform topology and construction boundaries can change. Heights without open authoritative values, canopy footprints, path widths, fence thickness, crossing widths, and structural elevations are explicitly approximate. The map is geographically faithful open-data interpretation, not a survey or operational railway plan.
