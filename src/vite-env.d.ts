/// <reference types="vite/client" />

declare global {
  const __BUILD_ID__: string;

  interface Window {
    readonly __GONE_TEST__?: {
      activeView: string;
      player: {x: number; y: number; elevation: number};
      playerScreen: {x: number; y: number};
      testDestination: {
        world: {x: number; y: number; elevation: number};
        screen: {x: number; y: number};
      };
      testBlockedDestination?: {
        world: {x: number; y: number; elevation: number};
        screen: {x: number; y: number};
      };
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
      playerDisplayHeight: number;
      session: {paused: boolean; pace: string; message: string};
      loadedResources: boolean;
      loadedViewCount: number;
      loadedViews: number[];
      following: boolean;
      routePreviewLength: number;
      activeRouteLength: number;
      animation: string;
      animationFrame: number;
      cameraVelocity: {x: number; y: number};
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
