import Phaser from 'phaser';
import {APP_HEIGHT, APP_WIDTH} from './AppConfig';
import {BootScene} from '../scenes/BootScene';
import {GameScene} from '../scenes/GameScene';
import {showError} from '../ui/ErrorOverlay';

const MAX_RENDER_RESOLUTION = 2;

export class GameApp {
  readonly game: Phaser.Game;

  constructor(locationId: string) {
    const renderResolution = Math.min(
      Math.max(window.devicePixelRatio || 1, 1),
      MAX_RENDER_RESOLUTION,
    );
    const renderWidth = APP_WIDTH * renderResolution;
    const renderHeight = APP_HEIGHT * renderResolution;
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      width: renderWidth,
      height: renderHeight,
      backgroundColor: '#101820',
      pixelArt: false,
      scale: {
        mode: Phaser.Scale.ENVELOP,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: renderWidth,
        height: renderHeight,
      },
      scene: [new BootScene(locationId), GameScene],
    });
    this.game.events.on('boot-error', showError);
  }
}
