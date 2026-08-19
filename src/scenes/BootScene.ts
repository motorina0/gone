import Phaser from 'phaser';
import {loadLocation} from '../content/ContentLoader';
import {validateLoadedContent} from '../content/ContentValidation';

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
      content.views.forEach((url, index) => this.load.image(`background-${index}`, url));
      content.occlusion.forEach((url, index) => this.load.image(`occlusion-${index}`, url));
      content.detailOverlays.forEach((url, index) => this.load.image(`detail-${index}`, url));
      for (const name of ['agent-isometric', 'agent-top']) {
        this.load.image(name, new URL(`sprites/${name}.svg`, content.baseUrl).href);
      }
      this.load.once(Phaser.Loader.Events.COMPLETE, () => this.scene.start('game'));
      this.load.start();
    } catch (error) {
      this.game.events.emit('boot-error', error);
    }
  }
}
