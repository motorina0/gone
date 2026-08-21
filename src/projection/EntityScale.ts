import type {Manifest, ProjectionResource} from '../content/ContentTypes';

export const MAX_AGENT_SIZE_INCREASE_PERCENTAGE = 1000;
export const DEFAULT_AGENT_SIZE_INCREASE_PERCENTAGE = 250;

export const visualScaleForIncreasePercentage = (percentage: number): number =>
  1 +
  Math.min(MAX_AGENT_SIZE_INCREASE_PERCENTAGE, Math.max(0, percentage)) / 100;

export const entityScaleForProjection = (
  manifest: Manifest,
  projection: Pick<ProjectionResource, 'kind' | 'scale'>,
  visibleHeightPixels = manifest.agentAnimation.visibleHeightPixels,
  worldHeightMeters = manifest.entityWorldHeightMeters,
  visualScale = 1,
): number => {
  if (worldHeightMeters !== undefined && visibleHeightPixels !== undefined) {
    return (worldHeightMeters * visualScale * projection.scale) / visibleHeightPixels;
  }
  return manifest.entityScale * visualScale * (projection.kind === 'top' ? 1.12 : 1);
};

export const projectedEntityHeight = (
  manifest: Manifest,
  projection: Pick<ProjectionResource, 'kind' | 'scale'>,
  worldHeightMeters = manifest.entityWorldHeightMeters,
  visualScale = 1,
): number => {
  if (worldHeightMeters !== undefined) {
    return worldHeightMeters * visualScale * projection.scale;
  }
  return (
    (manifest.agentAnimation.visibleHeightPixels ?? manifest.agentAnimation.frameHeight) *
    entityScaleForProjection(manifest, projection, undefined, undefined, visualScale)
  );
};
