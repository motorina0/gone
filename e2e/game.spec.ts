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

const clickDiagnosticDestination = async (page: Page): Promise<void> => {
  const target = await diagnosticDestinationClient(page);
  await page.mouse.click(target.x, target.y);
};

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

for (const locationId of ['piata-unirii', 'vatra-central-station']) {
  test(`${locationId} moves one operative and preserves position across views`, async ({page}) => {
    await page.setViewportSize({width: 1280, height: 720});
    const errors = await openExploration(page, locationId);
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
    const focusBeforeViews = await page.evaluate(() => window.__GONE_TEST__!.cameraFocus);
    for (const id of VIEW_IDS) {
      await page.locator(`button[data-view="${id}"]`).click();
      await expect(page.locator('#hud')).toHaveAttribute('data-view', id);
      expect(await page.evaluate(() => window.__GONE_TEST__!.player)).toEqual(positionBeforeViews);
      const focus = await page.evaluate(() => window.__GONE_TEST__!.cameraFocus);
      expect(focus.x).toBeCloseTo(focusBeforeViews.x, 5);
      expect(focus.y).toBeCloseTo(focusBeforeViews.y, 5);
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

test('keyboard controls switch views, pace, and pause', async ({page}) => {
  await openExploration(page);
  const tactical = await page.evaluate(() => window.__GONE_TEST__!);
  expect(tactical.cameraZoom).toBeGreaterThanOrEqual(2.4);
  expect(tactical.cameraZoom).toBe(tactical.minimumZoom);
  const focusBeforePan = tactical.cameraFocus;
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(450);
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => {
    const focus = await page.evaluate(() => window.__GONE_TEST__!.cameraFocus);
    return Math.hypot(focus.x - focusBeforePan.x, focus.y - focusBeforePan.y);
  }).toBeGreaterThan(0.1);
  await page.keyboard.press('5');
  await expect(page.locator('#hud')).toHaveAttribute('data-view', 'view-top');
  expect(await page.evaluate(() => window.__GONE_TEST__!.cameraZoom)).toBe(1);
  await page.keyboard.press('1');
  await expect(page.locator('#hud')).toHaveAttribute('data-view', 'view-0');
  expect(await page.evaluate(() => window.__GONE_TEST__!.cameraZoom)).toBeGreaterThanOrEqual(2.4);
  await page.keyboard.press('r');
  await expect(page.locator('#hud')).toHaveAttribute('data-pace', 'run');
  await page.keyboard.press('w');
  await expect(page.locator('#hud')).toHaveAttribute('data-pace', 'walk');
  await page.keyboard.press('Space');
  await expect(page.locator('#hud')).toHaveAttribute('data-phase', 'paused');
});

test('real touch gestures and orientation changes preserve exploration state', async ({browser}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    viewport: {width: 390, height: 844},
  });
  const page = await context.newPage();
  const errors = await openExploration(page);
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
  expect(afterPinch.player).toEqual(afterTap.player);

  const dragStart = {
    id: 1,
    x: canvasBox!.x + canvasBox!.width * 0.72,
    y: canvasBox!.y + canvasBox!.height * 0.45,
  };
  await dispatchTouch(session, 'touchStart', [dragStart]);
  for (let step = 1; step <= 5; step += 1) {
    await dispatchTouch(session, 'touchMove', [
      {id: 1, x: dragStart.x - step * 14, y: dragStart.y + step * 3},
    ]);
  }
  await dispatchTouch(session, 'touchEnd', []);
  const beforeRotate = await page.evaluate(() => window.__GONE_TEST__!);
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
  expect(afterRotate.cameraZoom).toBeCloseTo(beforeRotate.cameraZoom, 5);
  expect(afterRotate.session.pace).toBe(beforeRotate.session.pace);
  expect(errors).toEqual([]);
  await context.close();
});
