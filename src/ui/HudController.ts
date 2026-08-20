import type {MovementPace} from '../world/WorldTypes';
import type {WorldState} from '../world/WorldState';

export interface HudActions {
  pause(): void;
  restart(): void;
  pace(value: MovementPace): void;
  view(id: string): void;
  zoom(delta: number): void;
  follow(): void;
}

export class HudController {
  readonly root = document.querySelector<HTMLElement>('#hud')!;
  private readonly abortController = new AbortController();
  private readonly location = this.root.querySelector<HTMLElement>('[data-location-name]')!;
  private readonly message = this.root.querySelector<HTMLElement>('[data-message]')!;
  private readonly coordinates = this.root.querySelector<HTMLElement>('[data-coordinates]')!;
  private readonly movement = this.root.querySelector<HTMLElement>('[data-movement-status]')!;
  private readonly pause = this.root.querySelector<HTMLButtonElement>('[data-pause]')!;

  constructor(actions: HudActions) {
    const options = {signal: this.abortController.signal};
    const publicRoot = new URL(import.meta.env.BASE_URL, window.location.href);
    this.root.querySelector<HTMLImageElement>('[data-portrait]')!.src = new URL(
      'ui/agent-portrait.svg',
      publicRoot,
    ).href;
    this.root.querySelectorAll<HTMLImageElement>('[data-icon]').forEach((icon) => {
      icon.src = new URL(`ui/icons/${icon.dataset.icon}.svg`, publicRoot).href;
    });

    this.pause.addEventListener('click', actions.pause, options);
    this.root.querySelector('[data-restart]')!.addEventListener('click', actions.restart, options);
    this.root.querySelector<HTMLButtonElement>('[data-zoom-out]')!.addEventListener(
      'click',
      () => actions.zoom(-1),
      options,
    );
    this.root.querySelector<HTMLButtonElement>('[data-zoom-in]')!.addEventListener(
      'click',
      () => actions.zoom(1),
      options,
    );
    this.root.querySelector<HTMLButtonElement>('[data-follow]')!.addEventListener(
      'click',
      actions.follow,
      options,
    );
    this.root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) =>
      button.addEventListener('click', () => actions.view(button.dataset.view!), options),
    );
    this.root.querySelectorAll<HTMLButtonElement>('[data-pace]').forEach((button) =>
      button.addEventListener(
        'click',
        () => actions.pace(button.dataset.pace as MovementPace),
        options,
      ),
    );

    const fullscreen = this.root.querySelector<HTMLButtonElement>('[data-fullscreen]')!;
    fullscreen.disabled = !document.documentElement.requestFullscreen;
    fullscreen.addEventListener(
      'click',
      () =>
        void (document.fullscreenElement
          ? document.exitFullscreen()
          : document.querySelector<HTMLElement>('#app')!.requestFullscreen()),
      options,
    );
    document.addEventListener(
      'fullscreenchange',
      () => {
        const active = Boolean(document.fullscreenElement);
        fullscreen.setAttribute('aria-label', active ? 'Exit full screen' : 'Enter full screen');
        fullscreen.setAttribute('aria-pressed', String(active));
      },
      options,
    );
  }

  render(world: WorldState, following = false): void {
    const player = world.player;
    const pace = player.moving ? (player.pace ?? world.session.pace) : world.session.pace;
    this.location.textContent = world.content.manifest.name;
    this.message.textContent = world.session.message;
    this.coordinates.textContent = `${player.position.x.toFixed(1)} : ${player.position.y.toFixed(1)}`;
    this.movement.textContent = world.session.paused
      ? 'HOLD'
      : player.moving
        ? `${pace.toUpperCase()}ING`
        : 'READY';
    this.pause.querySelector('span')!.textContent = world.session.paused ? 'Resume' : 'Pause';
    this.pause.setAttribute('aria-pressed', String(world.session.paused));
    this.root.dataset.phase = world.session.paused ? 'paused' : 'running';
    this.root.dataset.view = world.activeView;
    this.root.dataset.pace = world.session.pace;
    this.root.dataset.moving = String(Boolean(player.moving));
    this.root.dataset.following = String(following);
    const follow = this.root.querySelector<HTMLButtonElement>('[data-follow]')!;
    follow.setAttribute('aria-pressed', String(following));
    follow.setAttribute('aria-label', following ? 'Stop following operative' : 'Follow operative');

    const zoom = Math.round(world.camera.zoom * 10) / 10;
    const zoomOut = this.root.querySelector<HTMLButtonElement>('[data-zoom-out]')!;
    const zoomIn = this.root.querySelector<HTMLButtonElement>('[data-zoom-in]')!;
    zoomOut.disabled = world.camera.zoom <= world.camera.minimumZoom + 0.001;
    zoomIn.disabled = zoom >= 5;
    zoomOut.setAttribute('aria-label', `Zoom out. Current zoom ${zoom}×`);
    zoomIn.setAttribute('aria-label', `Zoom in. Current zoom ${zoom}×`);
    this.root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.view === world.activeView)),
    );
    this.root.querySelectorAll<HTMLButtonElement>('[data-pace]').forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.pace === world.session.pace)),
    );
  }

  destroy(): void {
    this.abortController.abort();
  }
}
