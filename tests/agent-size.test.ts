import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {
  DEFAULT_AGENT_SIZE_INCREASE_PERCENTAGE,
  visualScaleForIncreasePercentage,
} from '../src/projection/EntityScale';

describe('operative size calibration', () => {
  it('converts percentage increase into a bounded visual scale', () => {
    expect(visualScaleForIncreasePercentage(-1)).toBe(1);
    expect(visualScaleForIncreasePercentage(0)).toBe(1);
    expect(visualScaleForIncreasePercentage(100)).toBe(2);
    expect(visualScaleForIncreasePercentage(250)).toBe(3.5);
    expect(visualScaleForIncreasePercentage(1000)).toBe(11);
    expect(visualScaleForIncreasePercentage(1001)).toBe(11);
  });

  it('uses the confirmed 250 percent runtime default', () => {
    expect(DEFAULT_AGENT_SIZE_INCREASE_PERCENTAGE).toBe(250);
    expect(visualScaleForIncreasePercentage(DEFAULT_AGENT_SIZE_INCREASE_PERCENTAGE)).toBe(3.5);
  });

  it('keeps the operative physical height authored at two meters', () => {
    for (const location of ['piata-unirii', 'vatra-central-station', 'cluj-napoca-station']) {
      const player = JSON.parse(
        readFileSync(`public/content/locations/${location}/entities/player.json`, 'utf8'),
      ) as {worldHeightMeters: number};
      expect(player.worldHeightMeters).toBe(2);
    }
  });
});
