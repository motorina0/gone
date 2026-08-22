import Phaser from 'phaser';
import {loadLocation} from '../content/ContentLoader';
import {validateLoadedContent} from '../content/ContentValidation';
import {SettingsStore} from '../persistence/SettingsStore';
import {VIEW_IDS} from '../views/ViewManager';
import {preloadAssets, resolvePreloadedAsset} from '../assets/AssetPreloader';
import {
  hideLoadingScreen,
  markLoadingScreenPreparing,
  updateLoadingScreen,
} from '../ui/LoadingOverlay';

export class BootScene extends Phaser.Scene {
  constructor(private locationId: string) {
    super('boot');
  }

  create(): void {
    void this.boot();
  }

  private async boot(): Promise<void> {
    try {
      const content = await loadLocation(this.locationId);
      const errors = validateLoadedContent(content);
      if (errors.length) throw new Error(errors.join(' '));
      await preloadAssets(content.preloadAssets, updateLoadingScreen);
      markLoadingScreenPreparing();

      this.registry.set('content', content);
      const preferredView = new SettingsStore().load().preferredView;
      const initialViewIndex = Math.max(
        0,
        VIEW_IDS.findIndex((viewId) => viewId === preferredView),
      );
      this.registry.set('initialViewIndex', initialViewIndex);
      this.load.image(
        `backdrop-${initialViewIndex}`,
        resolvePreloadedAsset(content.backdrops[initialViewIndex]!),
      );
      this.load.image(
        `background-${initialViewIndex}`,
        resolvePreloadedAsset(content.views[initialViewIndex]!),
      );
      this.load.image(
        `occlusion-${initialViewIndex}`,
        resolvePreloadedAsset(content.occlusion[initialViewIndex]!),
      );
      this.load.image(
        `detail-${initialViewIndex}`,
        resolvePreloadedAsset(content.detailOverlays[initialViewIndex]!),
      );
      this.load.spritesheet('agent-atlas', resolvePreloadedAsset(content.agentAtlas), {
        frameWidth: content.manifest.agentAnimation.frameWidth,
        frameHeight: content.manifest.agentAnimation.frameHeight,
      });
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        this.scene.start('game');
        hideLoadingScreen();
      });
      this.load.start();
    } catch (error) {
      this.game.events.emit('boot-error', error);
    }
  }
}
