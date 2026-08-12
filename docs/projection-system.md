# Projection system

Every view owns a JSON affine matrix, origin, scale, azimuth, and elevation. `worldToScreen` applies that matrix; `screenToWorld` uses its inverse. Isometric azimuths differ by exactly 90 degrees and SAT is vertical orthographic. Only this adapter knows screen coordinates, so entity and camera focus state survive view changes exactly.
