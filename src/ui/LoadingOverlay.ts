import type {PreloadProgress} from '../assets/AssetPreloader';

const elements = () => ({
  root: document.querySelector<HTMLElement>('[data-loading-screen]')!,
  location: document.querySelector<HTMLElement>('[data-loading-location]')!,
  progress: document.querySelector<HTMLProgressElement>('[data-loading-progress]')!,
  percentage: document.querySelector<HTMLOutputElement>('[data-loading-percentage]')!,
  status: document.querySelector<HTMLElement>('[data-loading-status]')!,
});

const formatBytes = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const showLoadingScreen = (locationName: string): void => {
  const ui = elements();
  ui.location.textContent = locationName;
  ui.progress.value = 0;
  ui.percentage.value = '0%';
  ui.status.textContent = 'Preparing selected map…';
  ui.root.hidden = false;
};

export const updateLoadingScreen = (state: PreloadProgress): void => {
  const ui = elements();
  const ratio = state.totalBytes > 0 ? Math.min(1, state.loadedBytes / state.totalBytes) : 1;
  const percentage = Math.round(ratio * 100);
  ui.progress.value = ratio;
  ui.percentage.value = `${percentage}%`;
  ui.status.textContent = state.totalBytes
    ? `${formatBytes(Math.min(state.loadedBytes, state.totalBytes))} / ${formatBytes(state.totalBytes)}`
    : 'Preparing selected map…';
};

export const markLoadingScreenPreparing = (): void => {
  const ui = elements();
  ui.progress.value = 1;
  ui.percentage.value = '100%';
  ui.status.textContent = 'Preparing map textures…';
};

export const hideLoadingScreen = (): void => {
  elements().root.hidden = true;
};
