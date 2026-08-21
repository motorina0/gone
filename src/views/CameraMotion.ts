export const dampedCameraVelocity = (
  current: number,
  target: number,
  elapsedSeconds: number,
  acceleration: number,
  stopEpsilon: number,
): number => {
  const elapsed = Math.max(0, elapsedSeconds);
  const next = current + (target - current) * (1 - Math.exp(-acceleration * elapsed));
  return target === 0 && Math.abs(next) < stopEpsilon ? 0 : next;
};
