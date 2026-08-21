import {minimumZoomForPolygon, type ScreenPoint} from './CameraBounds';

export const ZOOM_LEVEL_COUNT = 4;
export const CLOSEUP_HEIGHT_FRACTION = 0.94;
const SATELLITE_ZOOM_STEP = 1.8;

export interface TacticalZoomInput {
  polygon: ScreenPoint[];
  viewportWidth: number;
  viewportHeight: number;
  projectedEntityHeight: number;
}

export const tacticalZoomLevels = ({
  polygon,
  viewportWidth,
  viewportHeight,
  projectedEntityHeight,
}: TacticalZoomInput): number[] => {
  const minimum = minimumZoomForPolygon(polygon, viewportWidth, viewportHeight) * 1.01;
  const closeup = (viewportHeight * CLOSEUP_HEIGHT_FRACTION) / projectedEntityHeight;
  const maximum = Math.max(closeup, minimum);
  return Array.from({length: ZOOM_LEVEL_COUNT}, (_, index) => {
    // Keep the former levels 1–4 and omit the terminal full-height close-up.
    const amount = index / ZOOM_LEVEL_COUNT;
    return minimum * (maximum / minimum) ** amount;
  });
};

export const satelliteZoomLevels = (
  polygon: ScreenPoint[],
  viewportWidth: number,
  viewportHeight: number,
): number[] => {
  const minimum = minimumZoomForPolygon(polygon, viewportWidth, viewportHeight) * 1.01;
  return Array.from(
    {length: ZOOM_LEVEL_COUNT},
    (_, index) => minimum * SATELLITE_ZOOM_STEP ** index,
  );
};
