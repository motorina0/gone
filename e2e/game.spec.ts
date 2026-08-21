import {expect, test, type CDPSession, type Page} from '@playwright/test';

test.setTimeout(180_000);

const VIEW_IDS = ['view-0', 'view-90', 'view-180', 'view-270', 'view-top'];
const viewports = [
  {name: 'desktop', width: 1280, height: 720},
  {name: 'portrait', width: 390, height: 844},
  {name: 'landscape', width: 844, height: 390},
];

const installFullscreenStub = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () =>
        document.documentElement.dataset.testFullscreenState === 'true'
          ? document.querySelector('#app')
          : null,
    });
    Element.prototype.requestFullscreen = async function () {
      document.documentElement.dataset.testFullscreenState = 'true';
      this.classList.add('fullscreen-test');
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    document.exitFullscreen = async () => {
      document.documentElement.dataset.testFullscreenState = 'false';
      document.querySelector('#app')?.classList.remove('fullscreen-test');
      document.dispatchEvent(new Event('fullscreenchange'));
    };
  });
};

const openExploration = async (
  page: Page,
  locationId = 'piata-unirii',
): Promise<string[]> => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) =>
    errors.push(`${request.url()} ${request.failure()?.errorText}`),
  );
  await page.goto(`?test=1&location=${locationId}`);
  await expect.poll(() => page.evaluate(() => Boolean(window.__GONE_TEST__))).toBe(true);
  return errors;
};

const diagnosticDestinationClient = async (
  page: Page,
): Promise<{x: number; y: number}> => {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const state = await page.evaluate(() => window.__GONE_TEST__!);
  const target = state.testDestination.screen;
  const clientX =
    box!.x +
    (box!.width / 960) *
      (480 + (target.x - state.cameraScreenCenter.x) * state.cameraZoom);
  const clientY =
    box!.y +
    (box!.height / 640) *
      (320 + (target.y - state.cameraScreenCenter.y) * state.cameraZoom);
  return {x: clientX, y: clientY};
};

const elevatedDestinationClient = async (page: Page): Promise<{x: number; y: number}> => {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const state = await page.evaluate(() => window.__GONE_TEST__!);
  expect(state.testElevatedDestination).toBeDefined();
  const target = state.testElevatedDestination!.screen;
  return {
    x:
      box!.x +
      (box!.width / 960) *
        (480 + (target.x - state.cameraScreenCenter.x) * state.cameraZoom),
    y:
      box!.y +
      (box!.height / 640) *
        (320 + (target.y - state.cameraScreenCenter.y) * state.cameraZoom),
  };
};

const authoredSpawnClient = async (
  page: Page,
  spawnId: string,
): Promise<{x: number; y: number}> => {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const state = await page.evaluate(() => window.__GONE_TEST__!);
  const target = state.testSpawns[spawnId];
  expect(target, spawnId).toBeDefined();
  return {
    x:
      box!.x +
      (box!.width / 960) *
        (480 + (target!.screen.x - state.cameraScreenCenter.x) * state.cameraZoom),
    y:
      box!.y +
      (box!.height / 640) *
        (320 + (target!.screen.y - state.cameraScreenCenter.y) * state.cameraZoom),
  };
};

const clickDiagnosticDestination = async (page: Page): Promise<void> => {
  const target = await diagnosticDestinationClient(page);
  await page.mouse.click(target.x, target.y);
};

const pointInsideConvexPolygon = (
  point: {x: number; y: number},
  polygon: Array<{x: number; y: number}>,
): boolean => {
  let direction = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    const cross = (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
    if (Math.abs(cross) < 0.05) continue;
    const nextDirection = Math.sign(cross);
    if (direction && nextDirection !== direction) return false;
    direction = nextDirection;
  }
  return true;
};

const expectTacticalViewportInsideMap = (
  state: NonNullable<Window['__GONE_TEST__']>,
): void => {
  const corners = [
    {x: state.visibleStage.left, y: state.visibleStage.top},
    {x: state.visibleStage.right, y: state.visibleStage.top},
    {x: state.visibleStage.right, y: state.visibleStage.bottom},
    {x: state.visibleStage.left, y: state.visibleStage.bottom},
  ];
  for (const corner of corners) {
    const worldScreenPoint = {
      x: state.cameraScreenCenter.x + (corner.x - 480) / state.cameraZoom,
      y: state.cameraScreenCenter.y + (corner.y - 320) / state.cameraZoom,
    };
    expect(pointInsideConvexPolygon(worldScreenPoint, state.projectedWorldBounds)).toBe(true);
  }
};

const expectFixedScreenSpaceOverlays = (
  state: NonNullable<Window['__GONE_TEST__']>,
): void => {
  const screenPixels = (worldUnits: number): number => worldUnits * state.cameraZoom;
  expect(screenPixels(state.overlayWorldMetrics.worldUnitsPerScreenPixel)).toBeCloseTo(1, 5);
  expect(screenPixels(state.overlayWorldMetrics.agentRingWidth)).toBeCloseTo(12, 5);
  expect(screenPixels(state.overlayWorldMetrics.agentRingHeight)).toBeCloseTo(6, 5);
  expect(screenPixels(state.overlayWorldMetrics.agentRingStrokeWidth)).toBeCloseTo(1, 5);
  expect(screenPixels(state.overlayWorldMetrics.previewPathStrokeWidth)).toBeCloseTo(1, 5);
  expect(screenPixels(state.overlayWorldMetrics.previewPathOutlineWidth)).toBeCloseTo(3, 5);
  expect(screenPixels(state.overlayWorldMetrics.activePathStrokeWidth)).toBeCloseTo(1.5, 5);
  expect(screenPixels(state.overlayWorldMetrics.activePathOutlineWidth)).toBeCloseTo(3.5, 5);
  expect(screenPixels(state.overlayWorldMetrics.destinationDotRadius)).toBeCloseTo(2, 5);
};

const zoomOutToLevelOne = async (page: Page): Promise<void> => {
  const zoomOut = page.locator('[data-zoom-out]');
  for (let step = 0; step < 5 && !(await zoomOut.isDisabled()); step += 1) {
    const before = await page.evaluate(() => window.__GONE_TEST__!.zoomLevel);
    await zoomOut.click();
    await expect
      .poll(() => page.evaluate(() => window.__GONE_TEST__!.zoomLevel))
      .toBeLessThan(before);
  }
  await expect(zoomOut).toBeDisabled();
  const state = await page.evaluate(() => window.__GONE_TEST__!);
  expect(state.zoomLevel).toBe(1);
  expect(state.cameraZoom).toBeCloseTo(state.minimumZoom, 5);
  expectTacticalViewportInsideMap(state);
};

const tacticalTopBandVariation = async (page: Page, viewId: string): Promise<number> =>
  page.evaluate(async (id) => {
    const image = new Image();
    image.src = `content/locations/vatra-central-station/views/${id}.webp`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = 96;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    let sumOfSquares = 0;
    const pixels = data.length / 4;
    for (let index = 0; index < data.length; index += 4) {
      const luminance = data[index]! * 0.2126 + data[index + 1]! * 0.7152 + data[index + 2]! * 0.0722;
      sum += luminance;
      sumOfSquares += luminance * luminance;
    }
    const mean = sum / pixels;
    return Math.sqrt(sumOfSquares / pixels - mean * mean);
  }, viewId);

const tacticalVisualMetrics = async (
  page: Page,
  viewId: string,
): Promise<{deviation: number; meanHorizontalEdge: number}> =>
  page.evaluate(async (id) => {
    const image = new Image();
    image.src = `content/locations/vatra-central-station/views/${id}.webp`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 160;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const luminance: number[] = [];
    let sum = 0;
    let sumOfSquares = 0;
    for (let index = 0; index < data.length; index += 4) {
      const value = data[index]! * 0.2126 + data[index + 1]! * 0.7152 + data[index + 2]! * 0.0722;
      luminance.push(value);
      sum += value;
      sumOfSquares += value * value;
    }
    let horizontalEdges = 0;
    let edgeCount = 0;
    for (let index = 0; index < luminance.length; index += 1) {
      if (index % canvas.width === 0) continue;
      horizontalEdges += Math.abs(luminance[index]! - luminance[index - 1]!);
      edgeCount += 1;
    }
    const mean = sum / luminance.length;
    return {
      deviation: Math.sqrt(sumOfSquares / luminance.length - mean * mean),
      meanHorizontalEdge: horizontalEdges / edgeCount,
    };
  }, viewId);

const tacticalPerimeterAlpha = async (
  page: Page,
  viewId: string,
): Promise<{edgeMax: number; edgeMean: number; center: number}> =>
  page.evaluate(async (id) => {
    const image = new Image();
    image.src = `content/locations/vatra-central-station/views/${id}.webp`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 160;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const alphaAt = (x: number, y: number): number => pixels[(y * canvas.width + x) * 4 + 3]!;
    const edgeAlpha = [
      ...Array.from({length: canvas.width}, (_, x) => alphaAt(x, 0)),
      ...Array.from({length: canvas.width}, (_, x) => alphaAt(x, canvas.height - 1)),
      ...Array.from({length: canvas.height}, (_, y) => alphaAt(0, y)),
      ...Array.from({length: canvas.height}, (_, y) => alphaAt(canvas.width - 1, y)),
    ];
    return {
      edgeMax: Math.max(...edgeAlpha),
      edgeMean: edgeAlpha.reduce((sum, alpha) => sum + alpha, 0) / edgeAlpha.length,
      center: alphaAt(120, 80),
    };
  }, viewId);

interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

const dispatchTouch = async (
  session: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  touchPoints: TouchPoint[],
): Promise<void> => {
  await session.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: touchPoints.map((touch) => ({
      ...touch,
      radiusX: 2,
      radiusY: 2,
      force: 1,
    })),
  });
};

for (const viewport of viewports) {
  test(`${viewport.name} keeps the exploration HUD usable`, async ({page}) => {
    await page.setViewportSize(viewport);
    await installFullscreenStub(page);
    const errors = await openExploration(page);

    await expect(page.locator('#hud')).toHaveAttribute('data-phase', 'running');
    await expect(page.locator('canvas')).toBeVisible();
    const canvasBounds = await page.locator('canvas').boundingBox();
    expect(canvasBounds).not.toBeNull();
    expect(canvasBounds!.x).toBeLessThanOrEqual(0.5);
    expect(canvasBounds!.y).toBeLessThanOrEqual(0.5);
    expect(canvasBounds!.x + canvasBounds!.width).toBeGreaterThanOrEqual(viewport.width - 0.5);
    expect(canvasBounds!.y + canvasBounds!.height).toBeGreaterThanOrEqual(viewport.height - 0.5);
    expect(await page.evaluate(() => window.__GONE_TEST__!.entityCount)).toBe(1);
    expect(await page.evaluate(() => window.__GONE_TEST__!.aiSystemsEnabled)).toBe(false);
    expect(await page.evaluate(() => window.__GONE_TEST__!.missionResourceLoaded)).toBe(false);

    for (const id of VIEW_IDS) {
      const button = page.locator(`button[data-view="${id}"]`);
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute('aria-label', /view|degrees/i);
    }

    for (const selector of [
      'button[data-pace="walk"]',
      'button[data-pace="run"]',
      '[data-zoom-out]',
      '[data-zoom-in]',
      '[data-follow]',
      '[data-fullscreen]',
      '[data-pause]',
      '[data-restart]',
    ]) {
      const rect = await page.locator(selector).boundingBox();
      expect(rect, selector).not.toBeNull();
      expect(rect!.width, selector).toBeGreaterThanOrEqual(44);
      expect(rect!.height, selector).toBeGreaterThanOrEqual(44);
      expect(rect!.x, selector).toBeGreaterThanOrEqual(0);
      expect(rect!.y, selector).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width, selector).toBeLessThanOrEqual(viewport.width + 1);
      expect(rect!.y + rect!.height, selector).toBeLessThanOrEqual(viewport.height + 1);
    }

    await page.locator('[data-pause]').click();
    await expect(page.locator('#hud')).toHaveAttribute('data-phase', 'paused');
    await page.locator('[data-pause]').click();
    await expect(page.locator('#hud')).toHaveAttribute('data-phase', 'running');

    const fullscreen = page.locator('[data-fullscreen]');
    await fullscreen.click();
    await expect(fullscreen).toHaveAttribute('aria-pressed', 'true');
    await fullscreen.click();
    await expect(fullscreen).toHaveAttribute('aria-pressed', 'false');
    expect(errors).toEqual([]);
  });
}

for (const locationId of ['piata-unirii', 'vatra-central-station', 'cluj-napoca-station']) {
  test(`${locationId} moves one operative and preserves position across views`, async ({page}) => {
    await page.setViewportSize({width: 1280, height: 720});
    const loadedBeautyUrls: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/views/')) loadedBeautyUrls.push(response.url());
    });
    const errors = await openExploration(page, locationId);
    await zoomOutToLevelOne(page);
    const initial = await page.evaluate(() => window.__GONE_TEST__!.player);

    await page.locator('[data-pace="run"]').click();
    await expect(page.locator('#hud')).toHaveAttribute('data-pace', 'run');
    await clickDiagnosticDestination(page);
    await expect.poll(async () => {
      const player = await page.evaluate(() => window.__GONE_TEST__!.player);
      return Math.hypot(player.x - initial.x, player.y - initial.y);
    }).toBeGreaterThan(0.5);
    expect(await page.evaluate(() => window.__GONE_TEST__!.movementPace)).toBe('run');

    await page.locator('[data-pause]').click();
    await expect(page.locator('#hud')).toHaveAttribute('data-phase', 'paused');
    const positionBeforeViews = await page.evaluate(() => window.__GONE_TEST__!.player);
    const zoomLevelBeforeViews = await page.evaluate(() => window.__GONE_TEST__!.zoomLevel);
    for (const id of VIEW_IDS) {
      await page.locator(`button[data-view="${id}"]`).click();
      await expect(page.locator('#hud')).toHaveAttribute('data-view', id);
      expect(await page.evaluate(() => window.__GONE_TEST__!.player)).toEqual(positionBeforeViews);
      if (id !== 'view-top') {
        const state = await page.evaluate(() => window.__GONE_TEST__!);
        expect(state.zoomLevel).toBe(zoomLevelBeforeViews);
        expectTacticalViewportInsideMap(state);
      }
    }
    if (locationId === 'cluj-napoca-station') {
      for (const id of VIEW_IDS) {
        expect(loadedBeautyUrls.some((url) => url.endsWith(`/views/${id}.webp`))).toBe(true);
      }
    }

    await page.locator('[data-restart]').click();
    await expect.poll(() => page.evaluate(() => window.__GONE_TEST__!.player)).toEqual(initial);
    expect(await page.evaluate(() => window.__GONE_TEST__!.entityCount)).toBe(1);
    expect(errors).toEqual([]);
  });
}

test('location picker deploys the selected station district', async ({page}) => {
  await page.goto('');
  await expect(page.locator('[data-location-picker]')).toBeVisible();
  await page.locator('[data-location]').selectOption('vatra-central-station');
  await expect(page.locator('[data-location-description]')).toContainText('railway');
  await page.locator('[data-load-location]').click();
  await expect(page.locator('[data-location-picker]')).toBeHidden();
  await expect(page.locator('canvas')).toBeVisible({timeout: 30_000});
  await expect(page.locator('[data-location-name]')).toContainText('Vatra');
});

test('Cluj station loads attributed Pages assets and routes through its passenger tunnel', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 720});
  const errors = await openExploration(page, 'cluj-napoca-station');

  await expect(page.locator('[data-location-name]')).toContainText('Gara Cluj-Napoca');
  const initialAgentHeight = await page.evaluate(() => window.__GONE_TEST__!.playerDisplayHeight);
  const initialVisibleAgentHeight = await page.evaluate(
    () => window.__GONE_TEST__!.playerVisibleHeight,
  );
  const initialState = await page.evaluate(() => window.__GONE_TEST__!);
  expect(initialState.zoomLevel).toBe(3);
  expect(initialAgentHeight).toBeGreaterThan(initialVisibleAgentHeight);
  expect(initialVisibleAgentHeight).toBeGreaterThan(5);
  expect(initialVisibleAgentHeight).toBeLessThan(initialState.visibleStage.height * 0.5);
  const attribution = page.locator('[data-map-attribution]');
  await expect(attribution).toBeVisible();
  await expect(attribution).toContainText('OpenStreetMap contributors');
  await expect(attribution).toContainText('Copernicus DEM');
  await expect(attribution.locator('a').first()).toHaveAttribute(
    'href',
    'https://www.openstreetmap.org/copyright',
  );
  await attribution.locator('summary').click();
  await expect(attribution.locator('.attribution-notice')).toContainText(
    'produced using Copernicus WorldDEM-30',
  );
  await expect(attribution.locator('.attribution-notice')).toContainText(
    'do not incur any liability',
  );
  await attribution.locator('summary').click();
  expect(await page.evaluate(() => window.__GONE_TEST__!.loadedViewCount)).toBe(1);

  await zoomOutToLevelOne(page);
  const destination = await elevatedDestinationClient(page);
  await page.mouse.move(destination.x, destination.y);
  await expect(page.locator('canvas')).toHaveClass(/cursor-move/);
  expect(await page.evaluate(() => window.__GONE_TEST__!.routePreviewLength)).toBe(0);
  await page.locator('[data-pace="run"]').click();
  await page.mouse.click(destination.x, destination.y);
  await expect.poll(() => page.evaluate(() => window.__GONE_TEST__!.activeRouteLength)).toBeGreaterThan(2);
  await expect
    .poll(() =>
      page.evaluate(() => Math.min(...window.__GONE_TEST__!.activeRouteElevations)),
    )
    .toBeLessThan(-3);
  await expect
    .poll(() =>
      page.evaluate(() => Math.max(...window.__GONE_TEST__!.activeRouteElevations)),
    )
    .toBeGreaterThan(0);
  await expect.poll(
    () => page.evaluate(() => window.__GONE_TEST__!.player.elevation),
    {timeout: 30_000},
  ).toBeLessThan(-2.5);

  await page.locator('button[data-view="view-top"]').click();
  await expect(page.locator('#hud')).toHaveAttribute('data-view', 'view-top');
  expect(await page.evaluate(() => window.__GONE_TEST__!.loadedViewCount)).toBe(2);
  expect(errors).toEqual([]);
});

test('Cluj accepts operative routes onto road and tram surfaces', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 720});
  const errors = await openExploration(page, 'cluj-napoca-station');
  await zoomOutToLevelOne(page);

  for (const spawnId of ['vehicleAccess', 'tramAccess']) {
    const destination = await authoredSpawnClient(page, spawnId);
    await page.mouse.click(destination.x, destination.y);
    await expect
      .poll(() => page.evaluate(() => window.__GONE_TEST__!.activeRouteLength))
      .toBeGreaterThan(0);
    await page.locator('[data-restart]').click();
    await expect.poll(() => page.evaluate(() => window.__GONE_TEST__!.activeRouteLength)).toBe(0);
  }

  expect(errors).toEqual([]);
});

test('Cluj attribution and controls remain inside a mobile safe-area viewport', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  const errors = await openExploration(page, 'cluj-napoca-station');
  const attribution = await page.locator('[data-map-attribution]').boundingBox();
  const consoleBox = await page.locator('.command-console').boundingBox();
  const cameraBox = await page.locator('.camera-bank').boundingBox();

  expect(attribution).not.toBeNull();
  expect(consoleBox).not.toBeNull();
  expect(cameraBox).not.toBeNull();
  expect(attribution!.x).toBeGreaterThanOrEqual(0);
  expect(attribution!.x + attribution!.width).toBeLessThanOrEqual(390);
  expect(attribution!.y + attribution!.height).toBeLessThan(consoleBox!.y);
  expect(attribution!.y + attribution!.height).toBeLessThanOrEqual(cameraBox!.y);
  await page.locator('[data-map-attribution] summary').click();
  const legalNotice = page.locator('[data-map-attribution] .attribution-notice');
  await expect(legalNotice).toBeVisible();
  const legalBox = await legalNotice.boundingBox();
  expect(legalBox).not.toBeNull();
  expect(legalBox!.x).toBeGreaterThanOrEqual(0);
  expect(legalBox!.x + legalBox!.width).toBeLessThanOrEqual(390);
  expect(legalBox!.y).toBeGreaterThanOrEqual(0);
  expect(legalBox!.y + legalBox!.height).toBeLessThanOrEqual(attribution!.y);
  await page.locator('[data-map-attribution] summary').click();

  await page.setViewportSize({width: 844, height: 390});
  const landscapeAttribution = await page.locator('[data-map-attribution]').boundingBox();
  const landscapeConsole = await page.locator('.command-console').boundingBox();
  expect(landscapeAttribution).not.toBeNull();
  expect(landscapeConsole).not.toBeNull();
  expect(landscapeAttribution!.x + landscapeAttribution!.width).toBeLessThanOrEqual(844);
  expect(landscapeAttribution!.y + landscapeAttribution!.height).toBeLessThan(
    landscapeConsole!.y,
  );
  expect(errors).toEqual([]);
});

test('keyboard controls switch views, pace, and pause', async ({page}) => {
  await openExploration(page);
  const tactical = await page.evaluate(() => window.__GONE_TEST__!);
  expect(tactical.cameraZoom).toBeGreaterThanOrEqual(2.4);
  expect(tactical.cameraZoom).toBeGreaterThan(tactical.minimumZoom);
  const canvasBox = await page.locator('canvas').boundingBox();
  expect(canvasBox).not.toBeNull();
  await page.mouse.move(
    canvasBox!.x +
      (canvasBox!.width / 960) *
        ((tactical.visibleStage.left + tactical.visibleStage.right) / 2),
    canvasBox!.y +
      (canvasBox!.height / 640) *
        ((tactical.visibleStage.top + tactical.visibleStage.bottom) / 2),
  );
  const focusBeforePan = tactical.cameraFocus;
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(450);
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => {
    const focus = await page.evaluate(() => window.__GONE_TEST__!.cameraFocus);
    return Math.hypot(focus.x - focusBeforePan.x, focus.y - focusBeforePan.y);
  }).toBeGreaterThan(0.1);
  await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.78, canvasBox!.y + canvasBox!.height * 0.34);
  await expect.poll(async () => {
    const velocity = await page.evaluate(() => window.__GONE_TEST__!.cameraVelocity);
    return Math.hypot(velocity.x, velocity.y);
  }).toBeLessThan(0.05);
  const beforeWheel = await page.evaluate(() => window.__GONE_TEST__!);
  const pointer = {x: 960 * 0.78, y: 640 * 0.34};
  const anchorBefore = {
    x: beforeWheel.cameraScreenCenter.x + (pointer.x - 480) / beforeWheel.cameraZoom,
    y: beforeWheel.cameraScreenCenter.y + (pointer.y - 320) / beforeWheel.cameraZoom,
  };
  await page.mouse.wheel(0, -320);
  await expect.poll(() => page.evaluate(() => window.__GONE_TEST__!.cameraZoom)).toBeGreaterThan(
    beforeWheel.cameraZoom,
  );
  const afterWheel = await page.evaluate(() => window.__GONE_TEST__!);
  const anchorAfter = {
    x: afterWheel.cameraScreenCenter.x + (pointer.x - 480) / afterWheel.cameraZoom,
    y: afterWheel.cameraScreenCenter.y + (pointer.y - 320) / afterWheel.cameraZoom,
  };
  expect(Math.hypot(anchorAfter.x - anchorBefore.x, anchorAfter.y - anchorBefore.y)).toBeLessThan(
    0.05,
  );
  expect(
    Math.hypot(
      afterWheel.cameraFocus.x - beforeWheel.cameraFocus.x,
      afterWheel.cameraFocus.y - beforeWheel.cameraFocus.y,
    ),
  ).toBeGreaterThan(0.01);
  const beforeEdge = afterWheel.cameraFocus;
  await page.mouse.move(canvasBox!.x + canvasBox!.width - 2, canvasBox!.y + canvasBox!.height / 2);
  await expect.poll(async () => {
    const focus = await page.evaluate(() => window.__GONE_TEST__!.cameraFocus);
    return Math.hypot(focus.x - beforeEdge.x, focus.y - beforeEdge.y);
  }).toBeGreaterThan(0.1);
  await page.mouse.move(canvasBox!.x + canvasBox!.width / 2, canvasBox!.y + canvasBox!.height / 2);
  await expect.poll(async () => {
    const velocity = await page.evaluate(() => window.__GONE_TEST__!.cameraVelocity);
    return Math.hypot(velocity.x, velocity.y);
  }).toBeLessThan(0.05);
  const rememberedViewZero = await page.evaluate(() => window.__GONE_TEST__!.cameraFocus);
  const sharedZoomLevel = await page.evaluate(() => window.__GONE_TEST__!.zoomLevel);
  await page.keyboard.press('5');
  await expect(page.locator('#hud')).toHaveAttribute('data-view', 'view-top');
  const satellite = await page.evaluate(() => window.__GONE_TEST__!);
  expect(satellite.zoomLevel).toBe(sharedZoomLevel);
  expectTacticalViewportInsideMap(satellite);
  await page.keyboard.press('1');
  await expect(page.locator('#hud')).toHaveAttribute('data-view', 'view-0');
  expect(await page.evaluate(() => window.__GONE_TEST__!.cameraZoom)).toBeGreaterThanOrEqual(2.4);
  const restoredViewZero = await page.evaluate(() => window.__GONE_TEST__!.cameraFocus);
  expect(
    Math.hypot(
      restoredViewZero.x - rememberedViewZero.x,
      restoredViewZero.y - rememberedViewZero.y,
    ),
  ).toBeLessThan(0.2);
  await page.keyboard.press('r');
  await expect(page.locator('#hud')).toHaveAttribute('data-pace', 'run');
  await page.keyboard.press('w');
  await expect(page.locator('#hud')).toHaveAttribute('data-pace', 'walk');
  await page.keyboard.press('Space');
  await expect(page.locator('#hud')).toHaveAttribute('data-phase', 'paused');
});

test('four global tactical levels stay inside every perspective without loading close-up art', async ({page}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({width: 390, height: 844});
  const closeSheetRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/sprites/agent-close-direction-')) {
      closeSheetRequests.push(request.url());
    }
  });
  const errors = await openExploration(page, 'vatra-central-station');

  for (const [index, id] of VIEW_IDS.slice(0, 4).entries()) {
    if (index > 0) {
      await page.locator(`button[data-view="${id}"]`).click();
      await expect(page.locator('#hud')).toHaveAttribute('data-view', id);
    }
    const inheritedLevel = await page.evaluate(() => window.__GONE_TEST__!.zoomLevel);
    if (index > 0) expect(inheritedLevel).toBe(4);
    expect(await tacticalTopBandVariation(page, id)).toBeGreaterThan(4);
    const visualMetrics = await tacticalVisualMetrics(page, id);
    // The blue-hour grade is intentionally low-key; local edge energy protects
    // authored surface/architecture detail better than a bright-scene variance floor.
    expect(visualMetrics.deviation).toBeGreaterThan(12);
    expect(visualMetrics.meanHorizontalEdge).toBeGreaterThan(4.8);
    const perimeterAlpha = await tacticalPerimeterAlpha(page, id);
    expect(perimeterAlpha.edgeMax).toBeLessThan(20);
    expect(perimeterAlpha.edgeMean).toBeLessThan(16);
    expect(perimeterAlpha.center).toBeGreaterThan(245);
    await zoomOutToLevelOne(page);
    const zooms = [await page.evaluate(() => window.__GONE_TEST__!.cameraZoom)];
    const levelOne = await page.evaluate(() => window.__GONE_TEST__!);
    expectTacticalViewportInsideMap(levelOne);
    expectFixedScreenSpaceOverlays(levelOne);
    const renderedVertices = levelOne.projectedWorldBounds.map((point) => ({
      x: 480 + (point.x - levelOne.cameraScreenCenter.x) * levelOne.cameraZoom,
      y: 320 + (point.y - levelOne.cameraScreenCenter.y) * levelOne.cameraZoom,
    }));
    expect(
      renderedVertices.some(
        (point) =>
          point.x < levelOne.visibleStage.left ||
          point.x > levelOne.visibleStage.right ||
          point.y < levelOne.visibleStage.top ||
          point.y > levelOne.visibleStage.bottom,
      ),
    ).toBe(true);

    for (let level = 2; level <= 4; level += 1) {
      await page.locator('[data-zoom-in]').click();
      await expect(page.locator('#hud')).toHaveAttribute('data-zoom-level', String(level));
      const state = await page.evaluate(() => window.__GONE_TEST__!);
      expect(state.zoomLevel).toBe(level);
      expectTacticalViewportInsideMap(state);
      expectFixedScreenSpaceOverlays(state);
      zooms.push(state.cameraZoom);
    }
    expect(zooms.every((zoom, level) => level === 0 || zoom > zooms[level - 1]!)).toBe(true);
    expect(await page.evaluate(() => window.__GONE_TEST__!.closeAgentLoaded)).toBe(false);
    expect(await page.evaluate(() => window.__GONE_TEST__!.agentTexture)).not.toContain(
      'agent-close-direction-',
    );
    expect(new Set(closeSheetRequests).size).toBe(0);
  }

  await page.locator('button[data-view="view-0"]').click();
  await expect(page.locator('#hud')).toHaveAttribute('data-view', 'view-0');
  await page.locator('button[data-view="view-90"]').click();
  await expect(page.locator('#hud')).toHaveAttribute('data-view', 'view-90');
  expect(await page.evaluate(() => window.__GONE_TEST__!.closeAgentLoaded)).toBe(false);
  expect(await page.evaluate(() => window.__GONE_TEST__!.pendingCloseAgentDirectionCount)).toBe(0);
  expect(await page.evaluate(() => window.__GONE_TEST__!.retainedCloseAgentDirections)).toEqual([]);
  expect(new Set(closeSheetRequests).size).toBe(0);
  expect(errors).toEqual([]);
});

for (const viewport of [
  {name: 'widescreen crop', width: 1280, height: 720},
  {name: 'portrait crop', width: 390, height: 844},
]) {
  test(`${viewport.name} scrolls from every visible edge`, async ({page}) => {
    await page.setViewportSize(viewport);
    const errors = await openExploration(page, 'vatra-central-station');
    const canvas = await page.locator('canvas').boundingBox();
    expect(canvas).not.toBeNull();
    const visible = await page.evaluate(() => window.__GONE_TEST__!.visibleStage);
    const toClient = (x: number, y: number): {x: number; y: number} => ({
      x: canvas!.x + (x / 960) * canvas!.width,
      y: canvas!.y + (y / 640) * canvas!.height,
    });
    const center = toClient(
      (visible.left + visible.right) / 2,
      (visible.top + visible.bottom) / 2,
    );
    const edges = [
      {...toClient(visible.left + 2, (visible.top + visible.bottom) / 2), axis: 'x' as const, sign: -1},
      {...toClient(visible.right - 2, (visible.top + visible.bottom) / 2), axis: 'x' as const, sign: 1},
      {...toClient((visible.left + visible.right) / 2, visible.top + 2), axis: 'y' as const, sign: -1},
      {...toClient((visible.left + visible.right) / 2, visible.bottom - 2), axis: 'y' as const, sign: 1},
    ];
    for (const edge of edges) {
      await page.mouse.move(center.x, center.y);
      await expect.poll(async () => {
        const velocity = await page.evaluate(() => window.__GONE_TEST__!.cameraVelocity);
        return Math.hypot(velocity.x, velocity.y);
      }).toBeLessThan(0.05);
      await page.mouse.move(edge.x, edge.y);
      await expect.poll(async () => {
        const velocity = await page.evaluate(() => window.__GONE_TEST__!.cameraVelocity);
        return velocity[edge.axis] * edge.sign;
      }).toBeGreaterThan(1);
    }
    await page.mouse.move(center.x, center.y);
    await expect.poll(async () => {
      const velocity = await page.evaluate(() => window.__GONE_TEST__!.cameraVelocity);
      return Math.hypot(velocity.x, velocity.y);
    }).toBeLessThan(0.05);
    await page.locator('[data-follow]').click();
    await expect(page.locator('#hud')).toHaveAttribute('data-following', 'true');
    await page.locator('[data-pause]').hover();
    await page.waitForTimeout(250);
    await expect(page.locator('#hud')).toHaveAttribute('data-following', 'true');
    await page.locator('[data-fullscreen]').hover();
    await page.waitForTimeout(250);
    await expect(page.locator('#hud')).toHaveAttribute('data-following', 'true');
    expect(
      await page.evaluate(() => {
        const velocity = window.__GONE_TEST__!.cameraVelocity;
        return Math.hypot(velocity.x, velocity.y);
      }),
    ).toBeLessThan(0.05);
    expect(errors).toEqual([]);
  });
}

test('route feedback, animated movement, follow, and lazy view loading work together', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 720});
  const errors = await openExploration(page, 'vatra-central-station');
  await zoomOutToLevelOne(page);
  expect(await page.evaluate(() => window.__GONE_TEST__!.loadedViewCount)).toBe(1);

  const blocked = await page.evaluate(() => window.__GONE_TEST__!.testBlockedDestination);
  expect(blocked).toBeDefined();
  const canvasBox = await page.locator('canvas').boundingBox();
  expect(canvasBox).not.toBeNull();
  const stateBeforeBlocked = await page.evaluate(() => window.__GONE_TEST__!);
  await page.mouse.click(
    canvasBox!.x +
      (canvasBox!.width / 960) *
        (480 + (blocked!.screen.x - stateBeforeBlocked.cameraScreenCenter.x) * stateBeforeBlocked.cameraZoom),
    canvasBox!.y +
      (canvasBox!.height / 640) *
        (320 + (blocked!.screen.y - stateBeforeBlocked.cameraScreenCenter.y) * stateBeforeBlocked.cameraZoom),
  );
  await expect(page.locator('[data-message]')).toContainText(/blocked|unreachable/i);
  expect(await page.evaluate(() => window.__GONE_TEST__!.activeRouteLength)).toBe(0);

  const target = await diagnosticDestinationClient(page);
  await page.mouse.move(target.x, target.y);
  await expect.poll(() => page.evaluate(() => window.__GONE_TEST__!.routePreviewLength)).toBeGreaterThan(0);
  await page.locator('[data-follow]').click();
  await expect(page.locator('#hud')).toHaveAttribute('data-following', 'true');
  const focusBeforeFollow = await page.evaluate(() => window.__GONE_TEST__!.cameraFocus);
  await page.mouse.click(target.x, target.y);
  await expect.poll(() => page.evaluate(() => window.__GONE_TEST__!.activeRouteLength)).toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        key: window.__GONE_TEST__!.animation,
        playing: window.__GONE_TEST__!.animationPlaying,
        frameCount: window.__GONE_TEST__!.animationFrameCount,
      })),
    )
    .toEqual({key: 'agent-3-walk', playing: true, frameCount: 4});
  await expect.poll(async () => {
    const focus = await page.evaluate(() => window.__GONE_TEST__!.cameraFocus);
    return Math.hypot(focus.x - focusBeforeFollow.x, focus.y - focusBeforeFollow.y);
  }).toBeGreaterThan(0.2);
  await page.locator('[data-pause]').click();
  await expect(page.locator('#hud')).toHaveAttribute('data-phase', 'paused');

  await page.keyboard.down('ArrowRight');
  await expect(page.locator('#hud')).toHaveAttribute('data-following', 'false');
  await page.keyboard.up('ArrowRight');

  await page.locator('button[data-view="view-90"]').click();
  await expect(page.locator('#hud')).toHaveAttribute('data-view', 'view-90');
  expect(await page.evaluate(() => window.__GONE_TEST__!.loadedViewCount)).toBe(2);
  await expect
    .poll(() => page.evaluate(() => window.__GONE_TEST__!.animation))
    .toMatch(/^agent-5-(walk|idle)$/);
  await page.locator('button[data-view="view-0"]').click();
  await expect(page.locator('#hud')).toHaveAttribute('data-view', 'view-0');
  expect(await page.evaluate(() => window.__GONE_TEST__!.loadedViewCount)).toBe(2);
  expect(errors).toEqual([]);
});

test('Cluj real touch gestures and orientation changes preserve exploration state', async ({browser}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    viewport: {width: 390, height: 844},
  });
  const page = await context.newPage();
  const errors = await openExploration(page, 'cluj-napoca-station');
  await zoomOutToLevelOne(page);
  const session = await context.newCDPSession(page);
  const canvasBox = await page.locator('canvas').boundingBox();
  expect(canvasBox).not.toBeNull();

  await expect(page.locator('.orientation-hint')).toBeVisible();
  const initial = await page.evaluate(() => window.__GONE_TEST__!);
  const destination = await diagnosticDestinationClient(page);
  await page.touchscreen.tap(destination.x, destination.y);
  await expect.poll(() => page.evaluate(() => window.__GONE_TEST__!.playerMoving)).toBe(true);
  await expect.poll(
    () => page.evaluate(() => window.__GONE_TEST__!.playerMoving),
    {timeout: 12_000},
  ).toBe(false);
  const afterTap = await page.evaluate(() => window.__GONE_TEST__!);
  expect(Math.hypot(afterTap.player.x - initial.player.x, afterTap.player.y - initial.player.y)).toBeGreaterThan(1);

  const zoomBeforePinch = afterTap.cameraZoom;
  const levelBeforePinch = afterTap.zoomLevel;
  const pinchCenterX = canvasBox!.x + canvasBox!.width / 2;
  const pinchY = canvasBox!.y + canvasBox!.height * 0.3;
  await dispatchTouch(session, 'touchStart', [
    {id: 1, x: pinchCenterX - 20, y: pinchY},
    {id: 2, x: pinchCenterX + 20, y: pinchY},
  ]);
  await page.waitForTimeout(100);
  for (const spread of [35, 50, 70]) {
    await dispatchTouch(session, 'touchMove', [
      {id: 1, x: pinchCenterX - spread, y: pinchY},
      {id: 2, x: pinchCenterX + spread, y: pinchY},
    ]);
    await page.waitForTimeout(100);
  }
  await dispatchTouch(session, 'touchEnd', []);
  await expect.poll(() => page.evaluate(() => window.__GONE_TEST__!.cameraZoom)).toBeGreaterThan(
    zoomBeforePinch,
  );
  const afterPinch = await page.evaluate(() => window.__GONE_TEST__!);
  expect(afterPinch.zoomLevel).toBe(levelBeforePinch + 1);
  expect(afterPinch.player).toEqual(afterTap.player);

  const dragStart = {
    id: 1,
    x:
      canvasBox!.x +
      (canvasBox!.width / 960) *
        (afterPinch.visibleStage.left + afterPinch.visibleStage.width * 0.72),
    y:
      canvasBox!.y +
      (canvasBox!.height / 640) *
        (afterPinch.visibleStage.top + afterPinch.visibleStage.height * 0.45),
  };
  let beforeRotate = afterPinch;
  for (const delta of [
    {x: -14, y: 0},
    {x: 14, y: 0},
    {x: 0, y: -14},
    {x: 0, y: 14},
  ]) {
    await dispatchTouch(session, 'touchStart', [dragStart]);
    for (let step = 1; step <= 5; step += 1) {
      await dispatchTouch(session, 'touchMove', [
        {id: 1, x: dragStart.x + step * delta.x, y: dragStart.y + step * delta.y},
      ]);
    }
    await dispatchTouch(session, 'touchEnd', []);
    beforeRotate = await page.evaluate(() => window.__GONE_TEST__!);
    if (
      Math.hypot(
        beforeRotate.cameraFocus.x - afterPinch.cameraFocus.x,
        beforeRotate.cameraFocus.y - afterPinch.cameraFocus.y,
      ) > 0.1
    ) break;
  }
  expect(beforeRotate.player).toEqual(afterTap.player);
  expect(
    Math.hypot(
      beforeRotate.cameraFocus.x - afterPinch.cameraFocus.x,
      beforeRotate.cameraFocus.y - afterPinch.cameraFocus.y,
    ),
  ).toBeGreaterThan(0.1);

  await page.setViewportSize({width: 844, height: 390});
  await expect(page.locator('.orientation-hint')).toBeHidden();
  const afterRotate = await page.evaluate(() => window.__GONE_TEST__!);
  expect(afterRotate.player).toEqual(beforeRotate.player);
  expect(afterRotate.activeView).toBe(beforeRotate.activeView);
  expect(afterRotate.zoomLevel).toBe(beforeRotate.zoomLevel);
  expect(afterRotate.session.pace).toBe(beforeRotate.session.pace);
  expect(errors).toEqual([]);
  await context.close();
});
