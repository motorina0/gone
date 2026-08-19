import type {LoadedContent} from './ContentTypes';

export const validateLoadedContent = (content: LoadedContent): string[] => {
  const errors: string[] = [];
  if (content.projections.length !== 5) errors.push('Exactly five projections are required.');

  const players = content.entities.filter((entity) => entity.kind === 'player');
  if (players.length !== 1) errors.push('Exactly one player entity is required.');

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
