import type {WorldPoint} from '../world/WorldTypes';
export interface NavigationService {
  findPath(from: WorldPoint, to: WorldPoint): WorldPoint[];
  isWalkable(point: WorldPoint): boolean;
  resolveDestination(point: WorldPoint): WorldPoint | undefined;
}
