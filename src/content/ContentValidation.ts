import type {LoadedContent} from './ContentTypes';

export const validateLoadedContent = (content: LoadedContent): string[] => {
  const errors: string[] = [];
  if (content.projections.length !== 5) errors.push('Exactly five projections are required.');
  if (content.walkable.areas.length === 0) {
    errors.push('At least one authored walkable area is required.');
  }

  const players = content.entities.filter((entity) => entity.kind === 'player');
  if (players.length !== 1) errors.push('Exactly one player entity is required.');
  const playerSpawn = players[0]?.spawn;
  const worldSpawn = content.world.spawns.player;
  if (
    playerSpawn &&
    worldSpawn &&
    (playerSpawn.x !== worldSpawn.x ||
      playerSpawn.y !== worldSpawn.y ||
      playerSpawn.elevation !== worldSpawn.elevation)
  ) {
    errors.push('Player entity spawn must match the canonical world player spawn.');
  }

  const closeAtlases = content.manifest.agentCloseAtlases;
  const closeAnimation = content.manifest.agentCloseAnimation;
  if (Boolean(closeAtlases) !== Boolean(closeAnimation)) {
    errors.push('Close-up agent atlases and animation metadata must be provided together.');
  }
  if (closeAtlases && closeAtlases.length !== content.manifest.agentAnimation.directions) {
    errors.push('Close-up agent art requires one sheet per facing direction.');
  }
  if (
    closeAnimation &&
    closeAnimation.columns * closeAnimation.rows <=
      Math.max(
        ...content.manifest.agentAnimation.idle,
        ...content.manifest.agentAnimation.walk,
        ...content.manifest.agentAnimation.run,
      )
  ) {
    errors.push('Close-up agent sheets do not contain every animation frame.');
  }
  if (
    closeAnimation &&
    (closeAnimation.firstVisibleRow > closeAnimation.lastVisibleRow ||
      closeAnimation.lastVisibleRow >= closeAnimation.frameHeight ||
      closeAnimation.visibleHeightPixels >
        closeAnimation.lastVisibleRow - closeAnimation.firstVisibleRow + 1)
  ) {
    errors.push('Close-up agent visible-frame bounds are invalid.');
  }

  if (content.manifest.mode === 'exploration') {
    if (content.mission !== undefined) {
      errors.push('Exploration mode must not load mission resources.');
    }
    if (content.entities.length !== 1) {
      errors.push('Exploration mode must load only the player entity.');
    }
    if (content.patrols.length !== 0) {
      errors.push('Exploration mode must not load patrol resources.');
    }
  } else {
    if (!content.mission) errors.push('Mission mode requires a mission resource.');
    if (content.entities.filter((entity) => entity.kind === 'guard').length !== 3) {
      errors.push('Mission mode requires exactly three guards.');
    }
    if (content.entities.filter((entity) => entity.kind === 'civilian').length < 4) {
      errors.push('Mission mode requires at least four civilians.');
    }
  }

  return errors;
};
