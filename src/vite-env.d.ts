/// <reference types="vite/client" />

declare global {
  const __BUILD_ID__: string;

  interface Window {
    readonly __GONE_TEST__?: {
      activeView: string;
      player: {x: number; y: number; elevation: number};
      playerScreen: {x: number; y: number};
      playerStage: {x: number; y: number};
      testDestination: {
        world: {x: number; y: number; elevation: number};
        screen: {x: number; y: number};
      };
      testBlockedDestination?: {
        world: {x: number; y: number; elevation: number};
        screen: {x: number; y: number};
      };
      testElevatedDestination?: {
        world: {x: number; y: number; elevation: number};
        screen: {x: number; y: number};
      };
      testSpawns: Record<
        string,
        {
          world: {x: number; y: number; elevation: number};
          screen: {x: number; y: number};
        }
      >;
      playerScale: number;
      playerMoving: boolean;
      movementPace?: string;
      entityCount: number;
      aiSystemsEnabled: boolean;
      missionResourceLoaded: boolean;
      cameraFocus: {x: number; y: number; elevation: number};
      cameraScreenCenter: {x: number; y: number};
      cameraZoom: number;
      minimumZoom: number;
      zoomLevel: number;
      activeRenderingId: string;
      highResolutionTileCount: number;
      highResolutionSourceScale: number;
      highResolutionOrphanTextureCount: number;
      renderResolution: number;
      canvasBackingSize: {width: number; height: number};
      playerDisplayHeight: number;
      playerVisibleHeight: number;
      session: {paused: boolean; pace: string; message: string};
      loadedResources: boolean;
      loadedViewCount: number;
      loadedViews: number[];
      following: boolean;
      routePreviewLength: number;
      activeRouteLength: number;
      activeRouteElevations: number[];
      animation: string;
      animationFrame: number;
      animationPlaying: boolean;
      animationFrameCount: number;
      closeAgentLoaded: boolean;
      retainedCloseAgentDirections: number[];
      pendingCloseAgentDirectionCount: number;
      agentTexture: string;
      cameraVelocity: {x: number; y: number};
      overlayWorldMetrics: {
        worldUnitsPerScreenPixel: number;
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
      };
      projectedWorldBounds: Array<{x: number; y: number}>;
      backdropBounds: {left: number; top: number; right: number; bottom: number};
      visibleStage: {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
      };
    };
  }
}

export {};
