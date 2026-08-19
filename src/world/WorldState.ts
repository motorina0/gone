import type {LoadedContent} from '../content/ContentTypes';
import type {
  CameraState,
  EntityState,
  ExplorationState,
  MissionState,
  WorldPoint,
} from './WorldTypes';

const clone = (point: WorldPoint): WorldPoint => ({...point});

export class WorldState {
  readonly entities = new Map<string, EntityState>();
  readonly mission: MissionState;
  readonly session: ExplorationState;
  camera: CameraState;
  activeView = 'view-0';
  simulationTime = 0;

  constructor(readonly content: LoadedContent) {
    const patrolByEntity = new Map(
      content.patrols.map((patrol) => [patrol.id.replace('-patrol', ''), patrol.points]),
    );

    for (const data of content.entities) {
      this.entities.set(data.id, {
        id: data.id,
        name: data.name,
        kind: data.kind,
        position: clone(data.spawn),
        speed: data.speed,
        runSpeed: data.runSpeed ?? data.speed * 1.6,
        route: (patrolByEntity.get(data.id) ?? []).map(clone),
        routeIndex: 0,
        selected: data.kind === 'player',
        facing: 0,
        pace: 'walk',
        moving: false,
        guardState: data.kind === 'guard' ? 'patrol' : undefined,
        exposure: 0,
      });
    }

    this.session = {
      paused: false,
      pace: 'walk',
      message: 'Agent ready. Select a destination.',
    };
    this.mission = {
      phase: 'briefing',
      objective: 'locate',
      paused: false,
      exchangeComplete: false,
      observationProgress: 0,
      packageAvailable: false,
      packageCollected: false,
      countdown: content.mission?.lockdownSeconds ?? 0,
      message: 'Mission systems disabled in exploration mode.',
    };
    this.camera = {focus: clone(this.player.position), zoom: 1};
  }

  get player(): EntityState {
    const player = [...this.entities.values()].find((entity) => entity.kind === 'player');
    if (!player) throw new Error('Player missing');
    return player;
  }

  reset(): void {
    const fresh = new WorldState(this.content);
    this.entities.clear();
    for (const [id, entity] of fresh.entities) this.entities.set(id, entity);
    Object.assign(this.mission, fresh.mission);
    Object.assign(this.session, fresh.session);
    this.camera = fresh.camera;
    this.activeView = 'view-0';
    this.simulationTime = 0;
  }
}
