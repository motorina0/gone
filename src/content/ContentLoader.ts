import type {
  EntityResource,
  EnvironmentProp,
  EnvironmentResource,
  LoadedContent,
  Manifest,
  MissionResource,
  NavigationResource,
  PatrolResource,
  ProjectionResource,
  Rect,
  WorldResource,
} from './ContentTypes';

const read = async <T>(url: URL): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url.pathname}: ${response.status}`);
  return response.json() as Promise<T>;
};

export const environmentPropBlocker = (
  prop: EnvironmentProp,
  index: number,
): Rect | undefined => {
  if (!prop.blocksMovement) return undefined;
  const defaults = ['regional-train', 'freight-wagon'].includes(prop.type)
    ? {width: 34, depth: 4}
    : {width: 4.6, depth: 2};
  const propWidth = prop.width ?? defaults.width;
  const propDepth = prop.depth ?? defaults.depth;
  const angle = ((prop.rotation ?? 0) * Math.PI) / 180;
  const width = Math.abs(Math.cos(angle)) * propWidth + Math.abs(Math.sin(angle)) * propDepth;
  const height = Math.abs(Math.sin(angle)) * propWidth + Math.abs(Math.cos(angle)) * propDepth;
  return {
    id: prop.id ?? `${prop.type}-${prop.x}-${prop.y}-${index}`,
    x: prop.x - width / 2,
    y: prop.y - height / 2,
    width,
    height,
  };
};

export const loadLocation = async (locationId = 'piata-unirii'): Promise<LoadedContent> => {
  const contentRoot = new URL('content/', new URL(import.meta.env.BASE_URL, location.href));
  const index = await read<{locations: Array<{id: string; manifest: string}>}>(
    new URL('index.json', contentRoot),
  );
  const ref = index.locations.find((location) => location.id === locationId);
  if (!ref) throw new Error(`Unknown location: ${locationId}`);

  const manifestUrl = new URL(ref.manifest, contentRoot);
  const baseUrl = new URL('./', manifestUrl);
  const manifest = await read<Manifest>(manifestUrl);
  const missionPromise =
    manifest.mode === 'mission'
      ? read<MissionResource>(new URL(manifest.mission, baseUrl))
      : Promise.resolve(undefined);
  const [
    world,
    environment,
    mission,
    entitiesRaw,
    patrolsRaw,
    walkable,
    blockers,
    visionBlockers,
    projections,
  ] =
    await Promise.all([
      read<WorldResource>(new URL(manifest.world, baseUrl)),
      read<EnvironmentResource>(new URL(manifest.environment, baseUrl)),
      missionPromise,
      Promise.all(manifest.entities.map((path) => read<EntityResource>(new URL(path, baseUrl)))),
      Promise.all(manifest.patrols.map((path) => read<PatrolResource>(new URL(path, baseUrl)))),
      read<NavigationResource>(new URL(manifest.navigation.walkable, baseUrl)),
      read<{rectangles: Rect[]}>(new URL(manifest.navigation.blockers, baseUrl)),
      read<{rectangles: Rect[]}>(new URL(manifest.navigation.visionBlockers, baseUrl)),
      Promise.all(
        manifest.projections.map((path) => read<ProjectionResource>(new URL(path, baseUrl))),
      ),
    ]);

  const entities = entitiesRaw.flatMap((resource) => resource.entities ?? [resource]);
  const patrols = patrolsRaw.filter((patrol) => patrol.points);
  const environmentBlockers = environment.streetFurniture
    .map(environmentPropBlocker)
    .filter((blocker): blocker is Rect => blocker !== undefined);

  return {
    baseUrl,
    manifest,
    world,
    environment,
    mission,
    entities,
    patrols,
    walkable,
    blockers: [...blockers.rectangles, ...environmentBlockers],
    visionBlockers: visionBlockers.rectangles,
    projections,
    views: manifest.views.map((path) => new URL(path, baseUrl).href),
    backdrops: (manifest.backdrops ?? Array(5).fill(environment.atmosphere.backdropTexture)).map(
      (path) => new URL(path, baseUrl).href,
    ),
    backdropScale: manifest.backdropScale ?? 8,
    occlusion: manifest.occlusion.map((path) => new URL(path, baseUrl).href),
    detailOverlays: manifest.detailOverlays.map((path) => new URL(path, baseUrl).href),
    depthMaps: (manifest.depthMaps ?? []).map((path) => new URL(path, baseUrl).href),
    agentAtlas: new URL(manifest.agentAtlas, baseUrl).href,
    agentCloseAtlases: (manifest.agentCloseAtlases ?? []).map(
      (path) => new URL(path, baseUrl).href,
    ),
  };
};
