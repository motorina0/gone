import type {Manifest, ProjectionResource} from '../content/ContentTypes';

export const entityScaleForProjection = (
  manifest: Manifest,
  projection: Pick<ProjectionResource, 'kind' | 'scale'>,
): number => {
  const visibleHeightPixels = manifest.agentAnimation.visibleHeightPixels;
  if (manifest.entityWorldHeightMeters !== undefined && visibleHeightPixels !== undefined) {
    return (manifest.entityWorldHeightMeters * projection.scale) / visibleHeightPixels;
  }
  return manifest.entityScale * (projection.kind === 'top' ? 1.12 : 1);
};
