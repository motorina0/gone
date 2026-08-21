import type {Manifest, ProjectionResource} from '../content/ContentTypes';

export const entityScaleForProjection = (
  manifest: Manifest,
  projection: Pick<ProjectionResource, 'kind' | 'scale'>,
  visibleHeightPixels = manifest.agentAnimation.visibleHeightPixels,
): number => {
  if (manifest.entityWorldHeightMeters !== undefined && visibleHeightPixels !== undefined) {
    return (manifest.entityWorldHeightMeters * projection.scale) / visibleHeightPixels;
  }
  return manifest.entityScale * (projection.kind === 'top' ? 1.12 : 1);
};

export const projectedEntityHeight = (
  manifest: Manifest,
  projection: Pick<ProjectionResource, 'kind' | 'scale'>,
): number => {
  if (manifest.entityWorldHeightMeters !== undefined) {
    return manifest.entityWorldHeightMeters * projection.scale;
  }
  return (
    (manifest.agentAnimation.visibleHeightPixels ?? manifest.agentAnimation.frameHeight) *
    entityScaleForProjection(manifest, projection)
  );
};
