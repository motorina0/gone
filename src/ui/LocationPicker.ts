import {showLoadingScreen} from './LoadingOverlay';

export interface LocationSummary {
  id: string;
  name: string;
  description: string;
}

interface ContentIndex {
  locations: LocationSummary[];
}

const contentUrl = () =>
  new URL('content/index.json', new URL(import.meta.env.BASE_URL, location.href));

export async function initializeLocationPicker(start: (locationId: string) => void): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-location-picker]')!;
  const select = root.querySelector<HTMLSelectElement>('[data-location]')!;
  const description = root.querySelector<HTMLElement>('[data-location-description]')!;
  const button = root.querySelector<HTMLButtonElement>('[data-load-location]')!;
  const response = await fetch(contentUrl());
  if (!response.ok) throw new Error(`Failed to load location registry: ${response.status}`);
  const index = (await response.json()) as ContentIndex;
  for (const location of index.locations) {
    const option = document.createElement('option');
    option.value = location.id;
    option.textContent = location.name;
    select.append(option);
  }
  const requested = new URLSearchParams(location.search).get('location');
  const fallback =
    index.locations.find((item) => item.id === 'cluj-napoca-station')?.id ??
    index.locations[0]!.id;
  const selected = index.locations.some((item) => item.id === requested) ? requested! : fallback;
  select.value = selected;
  const selectedLocation = (): LocationSummary =>
    index.locations.find((item) => item.id === select.value)!;
  const renderDescription = (): void => {
    description.textContent = selectedLocation()?.description ?? '';
  };
  select.addEventListener('change', renderDescription);
  renderDescription();
  button.disabled = false;
  button.addEventListener(
    'click',
    () => {
      showLoadingScreen(selectedLocation().name);
      root.hidden = true;
      start(select.value);
    },
    {once: true},
  );
  if (new URLSearchParams(location.search).has('test')) button.click();
}
