export const OVERLAY_SCREEN_PIXELS = {
  agentShadowOffsetY: 2,
  agentShadowWidth: 9,
  agentShadowHeight: 4,
  agentRingOffsetY: 1,
  agentRingWidth: 12,
  agentRingHeight: 6,
  agentRingStrokeWidth: 1,
  previewPathStrokeWidth: 1,
  previewPathOutlineWidth: 3,
  activePathStrokeWidth: 1.5,
  activePathOutlineWidth: 3.5,
  destinationStrokeWidth: 1,
  destinationRadius: 4,
  destinationPulse: 1,
  destinationDotRadius: 2,
  invalidStrokeWidth: 2,
  invalidSize: 6,
  invalidPulse: 1.5,
} as const;

export interface OverlayWorldMetrics {
  worldUnitsPerScreenPixel: number;
  agentShadowOffsetY: number;
  agentShadowWidth: number;
  agentShadowHeight: number;
  agentRingOffsetY: number;
  agentRingWidth: number;
  agentRingHeight: number;
  agentRingStrokeWidth: number;
  previewPathStrokeWidth: number;
  previewPathOutlineWidth: number;
  activePathStrokeWidth: number;
  activePathOutlineWidth: number;
  destinationStrokeWidth: number;
  destinationRadius: number;
  destinationDotRadius: number;
  invalidStrokeWidth: number;
  invalidSize: number;
}

export const overlayWorldMetrics = (
  cameraZoom: number,
  simulationTime: number,
): OverlayWorldMetrics => {
  if (!Number.isFinite(cameraZoom) || cameraZoom <= 0) {
    throw new Error(`Camera zoom must be positive, received ${cameraZoom}`);
  }
  const worldUnitsPerScreenPixel = 1 / cameraZoom;
  const world = (screenPixels: number): number =>
    screenPixels * worldUnitsPerScreenPixel;
  return {
    worldUnitsPerScreenPixel,
    agentShadowOffsetY: world(OVERLAY_SCREEN_PIXELS.agentShadowOffsetY),
    agentShadowWidth: world(OVERLAY_SCREEN_PIXELS.agentShadowWidth),
    agentShadowHeight: world(OVERLAY_SCREEN_PIXELS.agentShadowHeight),
    agentRingOffsetY: world(OVERLAY_SCREEN_PIXELS.agentRingOffsetY),
    agentRingWidth: world(OVERLAY_SCREEN_PIXELS.agentRingWidth),
    agentRingHeight: world(OVERLAY_SCREEN_PIXELS.agentRingHeight),
    agentRingStrokeWidth: world(OVERLAY_SCREEN_PIXELS.agentRingStrokeWidth),
    previewPathStrokeWidth: world(OVERLAY_SCREEN_PIXELS.previewPathStrokeWidth),
    previewPathOutlineWidth: world(OVERLAY_SCREEN_PIXELS.previewPathOutlineWidth),
    activePathStrokeWidth: world(OVERLAY_SCREEN_PIXELS.activePathStrokeWidth),
    activePathOutlineWidth: world(OVERLAY_SCREEN_PIXELS.activePathOutlineWidth),
    destinationStrokeWidth: world(OVERLAY_SCREEN_PIXELS.destinationStrokeWidth),
    destinationRadius: world(
      OVERLAY_SCREEN_PIXELS.destinationRadius +
        Math.sin(simulationTime * 5) * OVERLAY_SCREEN_PIXELS.destinationPulse,
    ),
    destinationDotRadius: world(OVERLAY_SCREEN_PIXELS.destinationDotRadius),
    invalidStrokeWidth: world(OVERLAY_SCREEN_PIXELS.invalidStrokeWidth),
    invalidSize: world(
      OVERLAY_SCREEN_PIXELS.invalidSize +
        Math.sin(simulationTime * 24) * OVERLAY_SCREEN_PIXELS.invalidPulse,
    ),
  };
};
