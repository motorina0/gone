import {minimumZoomForPolygon, type ScreenPoint} from './CameraBounds';

export const ZOOM_LEVEL_COUNT = 5;
export const CLOSEUP_HEIGHT_FRACTION = 0.94;

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
    const amount = index / (ZOOM_LEVEL_COUNT - 1);
    return minimum * (maximum / minimum) ** amount;
  });
};
