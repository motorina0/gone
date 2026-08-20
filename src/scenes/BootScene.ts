import Phaser from 'phaser';
import {loadLocation} from '../content/ContentLoader';
import {validateLoadedContent} from '../content/ContentValidation';
import {SettingsStore} from '../persistence/SettingsStore';
import {VIEW_IDS} from '../views/ViewManager';

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

      this.registry.set('content', content);
      const preferredView = new SettingsStore().load().preferredView;
      const initialViewIndex = Math.max(
        0,
        VIEW_IDS.findIndex((viewId) => viewId === preferredView),
      );
      this.registry.set('initialViewIndex', initialViewIndex);
      this.load.image(`background-${initialViewIndex}`, content.views[initialViewIndex]!);
      this.load.image(`occlusion-${initialViewIndex}`, content.occlusion[initialViewIndex]!);
      this.load.image(`detail-${initialViewIndex}`, content.detailOverlays[initialViewIndex]!);
      this.load.spritesheet('agent-atlas', content.agentAtlas, {
        frameWidth: content.manifest.agentAnimation.frameWidth,
        frameHeight: content.manifest.agentAnimation.frameHeight,
      });
      this.load.once(Phaser.Loader.Events.COMPLETE, () => this.scene.start('game'));
      this.load.start();
    } catch (error) {
      this.game.events.emit('boot-error', error);
    }
  }
}
