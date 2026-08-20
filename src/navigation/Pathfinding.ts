import type {Rect, WalkableArea} from '../content/ContentTypes';
import type {WorldPoint} from '../world/WorldTypes';
import type {NavigationService} from './NavigationTypes';

interface GridPoint {
  x: number;
  y: number;
}

const key = ({x, y}: GridPoint): string => `${x},${y}`;

const onSegment = (point: WorldPoint, start: WorldPoint, end: WorldPoint): boolean => {
  const cross =
    (point.y - start.y) * (end.x - start.x) -
    (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > 1e-7) return false;
  return (
    point.x >= Math.min(start.x, end.x) - 1e-7 &&
    point.x <= Math.max(start.x, end.x) + 1e-7 &&
    point.y >= Math.min(start.y, end.y) - 1e-7 &&
    point.y <= Math.max(start.y, end.y) + 1e-7
  );
};

const insidePolygon = (point: WorldPoint, polygon: WorldPoint[]): boolean => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const start = polygon[previous]!;
    const end = polygon[index]!;
    if (onSegment(point, start, end)) return true;
    const crosses =
      start.y > point.y !== end.y > point.y &&
      point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x;
    if (crosses) inside = !inside;
  }
  return inside;
};

const cross = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;

const boundaryParameters = (
  start: WorldPoint,
  end: WorldPoint,
  edgeStart: WorldPoint,
  edgeEnd: WorldPoint,
): number[] => {
  const rx = end.x - start.x;
  const ry = end.y - start.y;
  const sx = edgeEnd.x - edgeStart.x;
  const sy = edgeEnd.y - edgeStart.y;
  const qx = edgeStart.x - start.x;
  const qy = edgeStart.y - start.y;
  const denominator = cross(rx, ry, sx, sy);
  if (Math.abs(denominator) > 1e-9) {
    const t = cross(qx, qy, sx, sy) / denominator;
    const u = cross(qx, qy, rx, ry) / denominator;
    return t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9
      ? [Math.min(1, Math.max(0, t))]
      : [];
  }
  if (Math.abs(cross(qx, qy, rx, ry)) > 1e-9) return [];
  const lengthSquared = rx * rx + ry * ry;
  if (lengthSquared < 1e-12) return [0];
  return [
    (qx * rx + qy * ry) / lengthSquared,
    ((edgeEnd.x - start.x) * rx + (edgeEnd.y - start.y) * ry) / lengthSquared,
  ]
    .filter((value) => value >= -1e-9 && value <= 1 + 1e-9)
    .map((value) => Math.min(1, Math.max(0, value)));
};

export class GridNavigationService implements NavigationService {
  constructor(
    private readonly bounds: {minX: number; minY: number; maxX: number; maxY: number},
    private readonly blockers: Rect[],
    private readonly cellSize = 4,
    private readonly areas: WalkableArea[] = [],
  ) {}

  isWalkable(point: WorldPoint): boolean {
    const insideBounds =
      point.x >= this.bounds.minX &&
      point.x <= this.bounds.maxX &&
      point.y >= this.bounds.minY &&
      point.y <= this.bounds.maxY;
    const onAuthoredSurface =
      this.areas.length === 0 ||
      this.areas.some(
        (area) =>
          Math.abs(area.elevation - point.elevation) < 1e-7 && insidePolygon(point, area.points),
      );
    const blocked = this.blockers.some(
      (rectangle) =>
        point.x >= rectangle.x - 1 &&
        point.x <= rectangle.x + rectangle.width + 1 &&
        point.y >= rectangle.y - 1 &&
        point.y <= rectangle.y + rectangle.height + 1,
    );
    return insideBounds && onAuthoredSurface && !blocked;
  }

  findPath(from: WorldPoint, to: WorldPoint): WorldPoint[] {
    if (!this.isWalkable(from) || !this.isWalkable(to)) return [];

    const start = this.nearestNode(from);
    const goal = this.nearestNode(to);
    if (!start || !goal) return [];

    const open = [start];
    const openKeys = new Set([key(start)]);
    const cameFrom = new Map<string, GridPoint>();
    const cost = new Map([[key(start), 0]]);

    while (open.length > 0) {
      open.sort((left, right) => this.score(left, goal, cost) - this.score(right, goal, cost));
      const current = open.shift()!;
      openKeys.delete(key(current));

      if (current.x === goal.x && current.y === goal.y) {
        return this.buildPath(start, current, from, to, cameFrom);
      }

      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as const) {
        const next = {x: current.x + dx, y: current.y + dy};
        if (!this.nodeWalkable(next)) continue;
        if (
          dx !== 0 &&
          dy !== 0 &&
          (!this.nodeWalkable({x: current.x + dx, y: current.y}) ||
            !this.nodeWalkable({x: current.x, y: current.y + dy}))
        ) {
          continue;
        }
        const nextKey = key(next);
        const nextCost = (cost.get(key(current)) ?? 0) + Math.hypot(dx, dy);
        if (nextCost >= (cost.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
        cameFrom.set(nextKey, current);
        cost.set(nextKey, nextCost);
        if (!openKeys.has(nextKey)) {
          open.push(next);
          openKeys.add(nextKey);
        }
      }
    }
    return [];
  }

  private score(node: GridPoint, goal: GridPoint, cost: Map<string, number>): number {
    return (
      (cost.get(key(node)) ?? Number.POSITIVE_INFINITY) +
      Math.hypot(node.x - goal.x, node.y - goal.y)
    );
  }

  private toWorld(node: GridPoint): WorldPoint {
    const x = this.bounds.minX + node.x * this.cellSize;
    const y = this.bounds.minY + node.y * this.cellSize;
    const area = this.areas.find((candidate) =>
      insidePolygon({x, y, elevation: 0}, candidate.points),
    );
    return {x, y, elevation: area?.elevation ?? 0};
  }

  private toGrid(point: WorldPoint): GridPoint {
    return {
      x: Math.round((point.x - this.bounds.minX) / this.cellSize),
      y: Math.round((point.y - this.bounds.minY) / this.cellSize),
    };
  }

  private nodeWalkable(node: GridPoint): boolean {
    return this.isWalkable(this.toWorld(node));
  }

  private nearestNode(point: WorldPoint): GridPoint | undefined {
    const center = this.toGrid(point);
    if (this.nodeWalkable(center) && this.segmentWalkable(point, this.toWorld(center))) {
      return center;
    }
    for (let radius = 1; radius <= 3; radius += 1) {
      const candidates: GridPoint[] = [];
      for (let x = -radius; x <= radius; x += 1) {
        candidates.push({x: center.x + x, y: center.y - radius});
        candidates.push({x: center.x + x, y: center.y + radius});
      }
      for (let y = -radius + 1; y < radius; y += 1) {
        candidates.push({x: center.x - radius, y: center.y + y});
        candidates.push({x: center.x + radius, y: center.y + y});
      }
      const nearest = candidates
        .filter(
          (candidate) =>
            this.nodeWalkable(candidate) && this.segmentWalkable(point, this.toWorld(candidate)),
        )
        .sort(
          (left, right) =>
            Math.hypot(this.toWorld(left).x - point.x, this.toWorld(left).y - point.y) -
            Math.hypot(this.toWorld(right).x - point.x, this.toWorld(right).y - point.y),
        )[0];
      if (nearest) return nearest;
    }
    return undefined;
  }

  private buildPath(
    start: GridPoint,
    goal: GridPoint,
    origin: WorldPoint,
    destination: WorldPoint,
    cameFrom: Map<string, GridPoint>,
  ): WorldPoint[] {
    const nodes = [goal];
    let cursor = goal;
    while (cursor.x !== start.x || cursor.y !== start.y) {
      cursor = cameFrom.get(key(cursor))!;
      nodes.unshift(cursor);
    }
    const route = [{...origin}, ...nodes.map((node) => this.toWorld(node))];
    if (route.length > 0) route[route.length - 1] = {...destination};
    return this.smooth(route).slice(1);
  }

  private segmentWalkable(start: WorldPoint, end: WorldPoint): boolean {
    if (Math.abs(start.elevation - end.elevation) > 1e-7) return false;
    const parameters = [0, 1];
    for (const area of this.areas) {
      for (let index = 0; index < area.points.length; index += 1) {
        parameters.push(
          ...boundaryParameters(
            start,
            end,
            area.points[index]!,
            area.points[(index + 1) % area.points.length]!,
          ),
        );
      }
    }
    for (const blocker of this.blockers) {
      const left = blocker.x - 1;
      const top = blocker.y - 1;
      const right = blocker.x + blocker.width + 1;
      const bottom = blocker.y + blocker.height + 1;
      const corners: WorldPoint[] = [
        {x: left, y: top, elevation: start.elevation},
        {x: right, y: top, elevation: start.elevation},
        {x: right, y: bottom, elevation: start.elevation},
        {x: left, y: bottom, elevation: start.elevation},
      ];
      for (let index = 0; index < corners.length; index += 1) {
        parameters.push(
          ...boundaryParameters(start, end, corners[index]!, corners[(index + 1) % 4]!),
        );
      }
    }
    const sorted = [...new Set(parameters.map((value) => Number(value.toFixed(12))))].sort(
      (left, right) => left - right,
    );
    const checkpoints = [...sorted];
    for (let index = 0; index < sorted.length - 1; index += 1) {
      checkpoints.push((sorted[index]! + sorted[index + 1]!) / 2);
    }
    return checkpoints.every((amount) =>
      this.isWalkable({
        x: start.x + (end.x - start.x) * amount,
        y: start.y + (end.y - start.y) * amount,
        elevation: start.elevation,
      }),
    );
  }

  private smooth(path: WorldPoint[]): WorldPoint[] {
    if (path.length < 3) return path;
    const result = [path[0]!];
    let anchor = 0;
    while (anchor < path.length - 1) {
      let next = path.length - 1;
      while (next > anchor + 1 && !this.segmentWalkable(path[anchor]!, path[next]!)) next -= 1;
      result.push(path[next]!);
      anchor = next;
    }
    return result;
  }
}
