import {expect, test} from '@playwright/test';

test('uses the hidden 250 percent operative calibration with stable world proportions', async ({
  page,
}) => {
  await page.setViewportSize({width: 1280, height: 720});
  await page.goto('?test=1&location=piata-unirii');
  await expect.poll(() => page.evaluate(() => Boolean(window.__GONE_TEST__))).toBe(true);

  const input = page.locator('[data-agent-size]');
  await expect(input).toBeHidden();
  await expect(input).toHaveValue('250');

  const initial = await page.evaluate(() => ({
    scale: window.__GONE_TEST__!.playerScale,
    zoom: window.__GONE_TEST__!.cameraZoom,
    visibleHeight: window.__GONE_TEST__!.playerVisibleHeight,
  }));

  await page.locator('[data-zoom-in]').click();
  await expect.poll(() => page.evaluate(() => window.__GONE_TEST__!.zoomLevel)).toBe(4);
  const zoomed = await page.evaluate(() => ({
    scale: window.__GONE_TEST__!.playerScale,
    zoom: window.__GONE_TEST__!.cameraZoom,
    visibleHeight: window.__GONE_TEST__!.playerVisibleHeight,
  }));
  expect(zoomed.scale).toBeCloseTo(initial.scale, 5);
  expect(zoomed.visibleHeight / zoomed.zoom).toBeCloseTo(
    initial.visibleHeight / initial.zoom,
    5,
  );

  await input.evaluate((element: HTMLInputElement) => {
    element.value = '400';
    element.dispatchEvent(new Event('input', {bubbles: true}));
  });

  await expect
    .poll(() => page.evaluate(() => window.__GONE_TEST__!.playerScale))
    .toBeCloseTo(initial.scale * (5 / 3.5), 5);
  const adjusted = await page.evaluate(() => ({
    zoom: window.__GONE_TEST__!.cameraZoom,
    visibleHeight: window.__GONE_TEST__!.playerVisibleHeight,
  }));
  expect(adjusted.visibleHeight / adjusted.zoom).toBeCloseTo(
    (initial.visibleHeight / initial.zoom) * (5 / 3.5),
    5,
  );
});
