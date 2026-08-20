import type {WorldPoint} from '../world/WorldTypes';

export interface GeographicBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

export interface GeographicCoordinate {
  latitude: number;
  longitude: number;
}

export interface LocalGeoTransform {
  bounds: GeographicBounds;
  metresPerDegree: {longitude: number; latitude: number};
  toWorld(coordinate: GeographicCoordinate, elevation?: number): WorldPoint;
  toGeographic(point: WorldPoint): GeographicCoordinate;
  worldBounds: {minX: number; minY: number; maxX: number; maxY: number};
}

const metresPerDegreeAt = (
  latitude: number,
): {longitude: number; latitude: number} => {
  const radians = (latitude * Math.PI) / 180;
  return {
    latitude:
      111132.92 -
      559.82 * Math.cos(2 * radians) +
      1.175 * Math.cos(4 * radians) -
      0.0023 * Math.cos(6 * radians),
    longitude:
      111412.84 * Math.cos(radians) -
      93.5 * Math.cos(3 * radians) +
      0.118 * Math.cos(5 * radians),
  };
};

export const createLocalGeoTransform = (bounds: GeographicBounds): LocalGeoTransform => {
  if (bounds.east <= bounds.west || bounds.north <= bounds.south) {
    throw new Error('Geographic bounds must have positive width and height.');
  }
  const metresPerDegree = metresPerDegreeAt((bounds.south + bounds.north) / 2);
  const toWorld = (
    coordinate: GeographicCoordinate,
    elevation = 0,
  ): WorldPoint => ({
    x: (coordinate.longitude - bounds.west) * metresPerDegree.longitude,
    y: (coordinate.latitude - bounds.south) * metresPerDegree.latitude,
    elevation,
  });
  const toGeographic = (point: WorldPoint): GeographicCoordinate => ({
    longitude: bounds.west + point.x / metresPerDegree.longitude,
    latitude: bounds.south + point.y / metresPerDegree.latitude,
  });
  const northEast = toWorld({latitude: bounds.north, longitude: bounds.east});
  return {
    bounds: {...bounds},
    metresPerDegree,
    toWorld,
    toGeographic,
    worldBounds: {minX: 0, minY: 0, maxX: northEast.x, maxY: northEast.y},
  };
};
