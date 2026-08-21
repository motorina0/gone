import type {
  NavigationConnection,
  NavigationHazard,
  Rect,
  WalkableArea,
} from '../content/ContentTypes';
import type {WorldPoint} from '../world/WorldTypes';
import type {NavigationService} from './NavigationTypes';

interface GridPoint {
  x: number;
  y: number;
  elevation: number;
}

interface QueueEntry {
  node: GridPoint;
  score: number;
}

interface ElevationPlane {
  x: number;
  y: number;
  elevation: number;
  slopeX: number;
  slopeY: number;
}

export interface PathSearchDiagnostics {
  expandedNodes: number;
  walkabilityChecks: number;
  segmentSamples: number;
}

export const MAX_UNASSISTED_ELEVATION_DELTA_METERS = 0.4;

const key = ({x, y, elevation}: GridPoint): string => `${x},${y},${elevation.toFixed(4)}`;

const heapPush = (heap: QueueEntry[], entry: QueueEntry): void => {
  heap.push(entry);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (heap[parent]!.score <= entry.score) break;
    heap[index] = heap[parent]!;
    index = parent;
  }
  heap[index] = entry;
};

const heapPop = (heap: QueueEntry[]): QueueEntry | undefined => {
  const first = heap[0];
  const last = heap.pop();
  if (!first || !last || heap.length === 0) return first;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    if (left >= heap.length) break;
    const child = right < heap.length && heap[right]!.score < heap[left]!.score ? right : left;
    if (heap[child]!.score >= last.score) break;
    heap[index] = heap[child]!;
    index = child;
  }
  heap[index] = last;
  return first;
};

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

export class GridNavigationService implements NavigationService {
  private readonly spatialCellSize: number;
  private readonly areaIndex = new Map<string, WalkableArea[]>();
  private readonly blockerIndex = new Map<string, Rect[]>();
  private readonly hazardIndex = new Map<string, NavigationHazard[]>();
  private readonly areaPlanes = new Map<WalkableArea, ElevationPlane>();
  private readonly connectionIndex = new Map<string, GridPoint[]>();
  private readonly nodeWalkableCache = new Map<string, boolean>();
  private readonly localSegmentWalkableCache = new Map<string, boolean>();
  private searchDiagnostics: PathSearchDiagnostics = {
    expandedNodes: 0,
    walkabilityChecks: 0,
    segmentSamples: 0,
  };

  constructor(
    private readonly bounds: {minX: number; minY: number; maxX: number; maxY: number},
    private readonly blockers: Rect[],
    private readonly cellSize = 4,
    private readonly areas: WalkableArea[] = [],
    private readonly connections: NavigationConnection[] = [],
    private readonly hazards: NavigationHazard[] = [],
  ) {
    this.spatialCellSize = Math.max(16, cellSize * 8);
    for (const area of areas) {
      this.areaPlanes.set(area, this.fitElevationPlane(area));
      this.indexArea(area);
    }
    for (const blocker of blockers) this.indexBlocker(blocker);
    for (const hazard of hazards) this.indexHazard(hazard);
    this.indexConnections();
  }

  resolveDestination(point: WorldPoint): WorldPoint | undefined {
    const area = this.areaCandidates(point)
      .filter((candidate) => insidePolygon(point, candidate.points))
      .sort(
        (left, right) =>
          this.areaElevationAt(right, point) - this.areaElevationAt(left, point),
      )[0];
    if (!area) return undefined;
    const resolved = {...point, elevation: this.areaElevationAt(area, point)};
    return this.isWalkable(resolved) ? resolved : undefined;
  }

  isWalkable(point: WorldPoint): boolean {
    this.searchDiagnostics.walkabilityChecks += 1;
    const insideBounds =
      point.x >= this.bounds.minX &&
      point.x <= this.bounds.maxX &&
      point.y >= this.bounds.minY &&
      point.y <= this.bounds.maxY;
    const onAuthoredSurface =
      this.areas.length === 0 ||
      this.areaCandidates(point).some(
        (area) =>
          Math.abs(this.areaElevationAt(area, point) - point.elevation) < 0.01 &&
          insidePolygon(point, area.points),
      );
    const blocked = this.blockerCandidates(point).some(
      (rectangle) =>
        point.elevation >= (rectangle.minElevation ?? Number.NEGATIVE_INFINITY) &&
        point.elevation <= (rectangle.maxElevation ?? Number.POSITIVE_INFINITY) &&
        point.x >= rectangle.x - 1 &&
        point.x <= rectangle.x + rectangle.width + 1 &&
        point.y >= rectangle.y - 1 &&
        point.y <= rectangle.y + rectangle.height + 1,
    );
    const hazardous = this.hazardCandidates(point).some(
      (hazard) =>
        point.elevation >= (hazard.minElevation ?? Number.NEGATIVE_INFINITY) &&
        point.elevation <= (hazard.maxElevation ?? Number.POSITIVE_INFINITY) &&
        insidePolygon(point, hazard.points),
    );
    return insideBounds && onAuthoredSurface && !blocked && !hazardous;
  }

  findPath(from: WorldPoint, to: WorldPoint): WorldPoint[] {
    this.searchDiagnostics = {expandedNodes: 0, walkabilityChecks: 0, segmentSamples: 0};
    if (!this.isWalkable(from) || !this.isWalkable(to)) return [];

    const start = this.nearestNode(from);
    const goal = this.nearestNode(to);
    if (!start || !goal) return [];

    const open: QueueEntry[] = [];
    heapPush(open, {node: start, score: this.heuristic(start, goal)});
    const closed = new Set<string>();
    const cameFrom = new Map<string, GridPoint>();
    const cost = new Map([[key(start), 0]]);

    while (open.length > 0) {
      const current = heapPop(open)!.node;
      const currentKey = key(current);
      if (closed.has(currentKey)) continue;
      closed.add(currentKey);
      this.searchDiagnostics.expandedNodes += 1;

      if (
        current.x === goal.x &&
        current.y === goal.y &&
        Math.abs(current.elevation - goal.elevation) < 1e-7
      ) {
        return this.buildPath(start, current, from, to, cameFrom);
      }

      const neighbours = ([
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as const)
        .map(([dx, dy]) =>
          this.gridNodeAt(
            current.x + dx,
            current.y + dy,
            current.elevation,
            this.surfaceStepLimit(),
          ),
        )
        .filter((candidate): candidate is GridPoint => candidate !== undefined);
      const connectionNeighbours = this.connectionNeighbours(current);
      neighbours.push(...connectionNeighbours);

      for (const next of neighbours) {
        const dx = next.x - current.x;
        const dy = next.y - current.y;
        if (!this.nodeWalkable(next)) continue;
        const connectionStep = connectionNeighbours.some(
          (candidate) => key(candidate) === key(next),
        );
        const surfaceStep = !connectionStep && Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
        if (surfaceStep && !this.localSegmentWalkable(this.toWorld(current), this.toWorld(next))) {
          continue;
        }
        if (
          surfaceStep &&
          dx !== 0 &&
          dy !== 0 &&
          (!this.gridNodeAt(
            current.x + Math.sign(dx),
            current.y,
            current.elevation,
            this.surfaceStepLimit(),
          ) ||
            !this.gridNodeAt(
              current.x,
              current.y + Math.sign(dy),
              current.elevation,
              this.surfaceStepLimit(),
            ))
        ) {
          continue;
        }
        const nextKey = key(next);
        if (closed.has(nextKey)) continue;
        const nextCost =
          (cost.get(key(current)) ?? 0) +
          Math.hypot(dx, dy, (next.elevation - current.elevation) / this.cellSize) +
          (surfaceStep ? 0 : 2 + Math.abs(next.elevation - current.elevation));
        if (nextCost >= (cost.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
        cameFrom.set(nextKey, current);
        cost.set(nextKey, nextCost);
        heapPush(open, {node: next, score: nextCost + this.heuristic(next, goal)});
      }
    }
    return [];
  }

  getLastSearchDiagnostics(): PathSearchDiagnostics {
    return {...this.searchDiagnostics};
  }

  private heuristic(node: GridPoint, goal: GridPoint): number {
    return (
      Math.hypot(node.x - goal.x, node.y - goal.y) +
      Math.abs(node.elevation - goal.elevation)
    );
  }

  private toWorld(node: GridPoint): WorldPoint {
    const x = this.bounds.minX + node.x * this.cellSize;
    const y = this.bounds.minY + node.y * this.cellSize;
    return {x, y, elevation: node.elevation};
  }

  private toGrid(point: WorldPoint): GridPoint {
    return {
      x: Math.round((point.x - this.bounds.minX) / this.cellSize),
      y: Math.round((point.y - this.bounds.minY) / this.cellSize),
      elevation: point.elevation,
    };
  }

  private surfaceStepLimit(): number {
    return MAX_UNASSISTED_ELEVATION_DELTA_METERS;
  }

  private gridNodeAt(
    x: number,
    y: number,
    preferredElevation: number,
    maximumStep = Number.POSITIVE_INFINITY,
  ): GridPoint | undefined {
    if (this.areas.length === 0) {
      const node = {x, y, elevation: preferredElevation};
      return this.nodeWalkable(node) ? node : undefined;
    }
    const world = {
      x: this.bounds.minX + x * this.cellSize,
      y: this.bounds.minY + y * this.cellSize,
      elevation: preferredElevation,
    };
    const elevation = this.areaCandidates(world)
      .filter((area) => insidePolygon(world, area.points))
      .map((area) => this.areaElevationAt(area, world))
      .filter((candidate) => Math.abs(candidate - preferredElevation) <= maximumStep)
      .sort(
        (left, right) =>
          Math.abs(left - preferredElevation) - Math.abs(right - preferredElevation),
      )[0];
    if (elevation === undefined) return undefined;
    const node = {x, y, elevation};
    return this.nodeWalkable(node) ? node : undefined;
  }

  private nodeWalkable(node: GridPoint): boolean {
    const nodeKey = key(node);
    const cached = this.nodeWalkableCache.get(nodeKey);
    if (cached !== undefined) return cached;
    const walkable = this.isWalkable(this.toWorld(node));
    this.nodeWalkableCache.set(nodeKey, walkable);
    return walkable;
  }

  private nearestNode(point: WorldPoint): GridPoint | undefined {
    const snapped = this.toGrid(point);
    const center = this.gridNodeAt(snapped.x, snapped.y, point.elevation, this.surfaceStepLimit());
    if (center && this.segmentWalkable(point, this.toWorld(center))) {
      return center;
    }
    for (let radius = 1; radius <= 3; radius += 1) {
      const candidates: GridPoint[] = [];
      for (let x = -radius; x <= radius; x += 1) {
        candidates.push({x: snapped.x + x, y: snapped.y - radius, elevation: point.elevation});
        candidates.push({x: snapped.x + x, y: snapped.y + radius, elevation: point.elevation});
      }
      for (let y = -radius + 1; y < radius; y += 1) {
        candidates.push({x: snapped.x - radius, y: snapped.y + y, elevation: point.elevation});
        candidates.push({x: snapped.x + radius, y: snapped.y + y, elevation: point.elevation});
      }
      const nearest = candidates
        .map((candidate) =>
          this.gridNodeAt(
            candidate.x,
            candidate.y,
            point.elevation,
            this.surfaceStepLimit(),
          ),
        )
        .filter((candidate): candidate is GridPoint => candidate !== undefined)
        .filter((candidate) => this.segmentWalkable(point, this.toWorld(candidate)))
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
    while (
      cursor.x !== start.x ||
      cursor.y !== start.y ||
      Math.abs(cursor.elevation - start.elevation) > 1e-7
    ) {
      cursor = cameFrom.get(key(cursor))!;
      nodes.unshift(cursor);
    }
    const route = [{...origin}, ...nodes.map((node) => this.toWorld(node))];
    if (route.length > 0) route[route.length - 1] = {...destination};
    return this.smooth(route).slice(1);
  }

  private segmentWalkable(start: WorldPoint, end: WorldPoint): boolean {
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const interval = Math.min(0.5, this.cellSize / 4);
    const samples = Math.max(1, Math.ceil(distance / interval));
    return this.sampledSegmentWalkable(
      start,
      end,
      Array.from({length: samples + 1}, (_, index) => index / samples),
    );
  }

  private localSegmentWalkable(start: WorldPoint, end: WorldPoint): boolean {
    const startKey = `${start.x.toFixed(3)},${start.y.toFixed(3)},${start.elevation.toFixed(3)}`;
    const endKey = `${end.x.toFixed(3)},${end.y.toFixed(3)},${end.elevation.toFixed(3)}`;
    const segmentKey = startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
    const cached = this.localSegmentWalkableCache.get(segmentKey);
    if (cached !== undefined) return cached;
    const walkable = this.sampledSegmentWalkable(start, end, [0.25, 0.5, 0.75, 1]);
    this.localSegmentWalkableCache.set(segmentKey, walkable);
    return walkable;
  }

  private sampledSegmentWalkable(
    start: WorldPoint,
    end: WorldPoint,
    amounts: number[],
  ): boolean {
    let previous = start;
    for (const amount of amounts) {
      this.searchDiagnostics.segmentSamples += 1;
      const candidate = {
        x: start.x + (end.x - start.x) * amount,
        y: start.y + (end.y - start.y) * amount,
        elevation: start.elevation + (end.elevation - start.elevation) * amount,
      };
      const surface = this.isWalkable(candidate)
        ? candidate
        : this.resolveDestination(candidate);
      if (
        !surface ||
        Math.abs(surface.elevation - previous.elevation) >
          MAX_UNASSISTED_ELEVATION_DELTA_METERS + 1e-7
      ) {
        return false;
      }
      previous = surface;
    }
    return true;
  }

  private smooth(path: WorldPoint[]): WorldPoint[] {
    if (path.length < 3) return path;
    const result = [path[0]!];
    const maximumLookahead = Math.max(8, Math.ceil(48 / this.cellSize));
    let anchor = 0;
    while (anchor < path.length - 1) {
      let next = Math.min(path.length - 1, anchor + maximumLookahead);
      while (next > anchor + 1 && !this.segmentWalkable(path[anchor]!, path[next]!)) next -= 1;
      result.push(path[next]!);
      anchor = next;
    }
    return result;
  }

  private connectionNeighbours(node: GridPoint): GridPoint[] {
    return this.connectionIndex.get(key(node)) ?? [];
  }

  private indexConnections(): void {
    const connect = (from: GridPoint, to: GridPoint): void => {
      const neighbours = this.connectionIndex.get(key(from)) ?? [];
      neighbours.push(to);
      this.connectionIndex.set(key(from), neighbours);
    };
    for (const connection of this.connections) {
      const fromGrid = this.toGrid(connection.from);
      const toGrid = this.toGrid(connection.to);
      const from =
        this.gridNodeAt(fromGrid.x, fromGrid.y, connection.from.elevation, this.surfaceStepLimit()) ??
        fromGrid;
      const to =
        this.gridNodeAt(toGrid.x, toGrid.y, connection.to.elevation, this.surfaceStepLimit()) ??
        toGrid;
      connect(from, to);
      if (connection.bidirectional !== false) connect(to, from);
    }
  }

  private spatialKey(x: number, y: number): string {
    return `${Math.floor(x / this.spatialCellSize)},${Math.floor(y / this.spatialCellSize)}`;
  }

  private indexRange<T>(
    index: Map<string, T[]>,
    item: T,
    minimumX: number,
    minimumY: number,
    maximumX: number,
    maximumY: number,
  ): void {
    const minimumCellX = Math.floor(minimumX / this.spatialCellSize);
    const maximumCellX = Math.floor(maximumX / this.spatialCellSize);
    const minimumCellY = Math.floor(minimumY / this.spatialCellSize);
    const maximumCellY = Math.floor(maximumY / this.spatialCellSize);
    for (let x = minimumCellX; x <= maximumCellX; x += 1) {
      for (let y = minimumCellY; y <= maximumCellY; y += 1) {
        const cellKey = `${x},${y}`;
        const items = index.get(cellKey) ?? [];
        items.push(item);
        index.set(cellKey, items);
      }
    }
  }

  private indexArea(area: WalkableArea): void {
    this.indexRange(
      this.areaIndex,
      area,
      Math.min(...area.points.map((point) => point.x)),
      Math.min(...area.points.map((point) => point.y)),
      Math.max(...area.points.map((point) => point.x)),
      Math.max(...area.points.map((point) => point.y)),
    );
  }

  private indexBlocker(blocker: Rect): void {
    this.indexRange(
      this.blockerIndex,
      blocker,
      blocker.x - 1,
      blocker.y - 1,
      blocker.x + blocker.width + 1,
      blocker.y + blocker.height + 1,
    );
  }

  private indexHazard(hazard: NavigationHazard): void {
    this.indexRange(
      this.hazardIndex,
      hazard,
      Math.min(...hazard.points.map((point) => point.x)),
      Math.min(...hazard.points.map((point) => point.y)),
      Math.max(...hazard.points.map((point) => point.x)),
      Math.max(...hazard.points.map((point) => point.y)),
    );
  }

  private fitElevationPlane(area: WalkableArea): ElevationPlane {
    if (area.elevationPlane) {
      return {
        x: area.elevationPlane.originX,
        y: area.elevationPlane.originY,
        elevation: area.elevationPlane.originElevation,
        slopeX: area.elevationPlane.slopeX,
        slopeY: area.elevationPlane.slopeY,
      };
    }
    if (area.points.length === 0) {
      return {x: 0, y: 0, elevation: area.elevation, slopeX: 0, slopeY: 0};
    }
    const center = {
      x: area.points.reduce((sum, point) => sum + point.x, 0) / area.points.length,
      y: area.points.reduce((sum, point) => sum + point.y, 0) / area.points.length,
      elevation:
        area.points.reduce((sum, point) => sum + point.elevation, 0) / area.points.length,
    };
    let xx = 0;
    let xy = 0;
    let yy = 0;
    let xElevation = 0;
    let yElevation = 0;
    for (const point of area.points) {
      const x = point.x - center.x;
      const y = point.y - center.y;
      const elevation = point.elevation - center.elevation;
      xx += x * x;
      xy += x * y;
      yy += y * y;
      xElevation += x * elevation;
      yElevation += y * elevation;
    }
    const determinant = xx * yy - xy * xy;
    if (Math.abs(determinant) < 1e-8) {
      return {...center, slopeX: 0, slopeY: 0};
    }
    return {
      ...center,
      slopeX: (xElevation * yy - yElevation * xy) / determinant,
      slopeY: (yElevation * xx - xElevation * xy) / determinant,
    };
  }

  private areaElevationAt(area: WalkableArea, point: Pick<WorldPoint, 'x' | 'y'>): number {
    const plane = this.areaPlanes.get(area);
    if (!plane) return area.elevation;
    return (
      plane.elevation +
      plane.slopeX * (point.x - plane.x) +
      plane.slopeY * (point.y - plane.y)
    );
  }

  private areaCandidates(point: WorldPoint): WalkableArea[] {
    return this.areaIndex.get(this.spatialKey(point.x, point.y)) ?? [];
  }

  private blockerCandidates(point: WorldPoint): Rect[] {
    return this.blockerIndex.get(this.spatialKey(point.x, point.y)) ?? [];
  }

  private hazardCandidates(point: WorldPoint): NavigationHazard[] {
    return this.hazardIndex.get(this.spatialKey(point.x, point.y)) ?? [];
  }
}
