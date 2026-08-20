import type {EntityState, MovementPace, WorldPoint} from '../world/WorldTypes';

interface MovementOrder {
  points: WorldPoint[];
  pace: MovementPace;
}

const distance = (a: WorldPoint, b: WorldPoint): number => Math.hypot(a.x - b.x, a.y - b.y);

export const positionAvailable = (
  candidate: WorldPoint,
  entityId: string,
  entities: Map<string, EntityState>,
  separation = 4,
): boolean =>
  [...entities.values()].every(
    (other) => other.id === entityId || distance(candidate, other.position) >= separation,
  );

export class MovementSystem {
  private orders = new Map<string, MovementOrder>();

  setPath(entityId: string, path: WorldPoint[], pace: MovementPace = 'walk'): void {
    this.orders.set(entityId, {points: [...path], pace});
  }

  setPace(entityId: string, pace: MovementPace): void {
    const order = this.orders.get(entityId);
    if (order) order.pace = pace;
  }

  hasPath(entityId: string): boolean {
    return this.orders.has(entityId);
  }

  getDestination(entityId: string): WorldPoint | undefined {
    const points = this.orders.get(entityId)?.points;
    return points?.at(-1);
  }

  getRemainingPath(entityId: string): WorldPoint[] {
    return (this.orders.get(entityId)?.points ?? []).map((point) => ({...point}));
  }

  clear(): void {
    this.orders.clear();
  }

  update(entities: Map<string, EntityState>, dt: number): void {
    for (const entity of entities.values()) entity.moving = this.orders.has(entity.id);

    for (const [id, order] of this.orders) {
      const entity = entities.get(id);
      const target = order.points[0];
      if (!entity || !target) {
        if (entity) entity.moving = false;
        this.orders.delete(id);
        continue;
      }

      const dx = target.x - entity.position.x;
      const dy = target.y - entity.position.y;
      const length = Math.hypot(dx, dy);
      const speed = order.pace === 'run' ? (entity.runSpeed ?? entity.speed * 1.6) : entity.speed;
      const step = speed * dt;
      entity.facing = Math.atan2(dy, dx);
      entity.pace = order.pace;

      const candidate =
        length <= step || distance(entity.position, target) < 0.15
          ? {...target}
          : {
              x: entity.position.x + (dx / length) * step,
              y: entity.position.y + (dy / length) * step,
              elevation: entity.position.elevation,
            };

      if (!positionAvailable(candidate, id, entities)) continue;
      entity.position = candidate;
      if (length <= step || distance(entity.position, target) < 0.15) {
        order.points.shift();
        if (!order.points.length) {
          entity.moving = false;
          this.orders.delete(id);
        }
      }
    }
  }
}
