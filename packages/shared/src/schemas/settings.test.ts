import { describe, expect, it } from 'vitest';
import { RATE_LIMIT_ACTIONS } from '../constants';
import { rateLimitSettingsSchema } from './settings';

function rateLimitConfig(overrides: Record<string, { soft?: number; hard?: number }> = {}) {
  return {
    enabled: true,
    passMinutes: 15,
    actions: Object.fromEntries(
      RATE_LIMIT_ACTIONS.map((action) => [
        action,
        { windowSeconds: 60, soft: 0, hard: 10, ...overrides[action] },
      ]),
    ),
  };
}

describe('rateLimitSettingsSchema', () => {
  it('accepts a disabled soft threshold and a hard limit above it', () => {
    expect(rateLimitSettingsSchema.safeParse(rateLimitConfig()).success).toBe(true);
    expect(
      rateLimitSettingsSchema.safeParse(rateLimitConfig({ register: { soft: 4, hard: 5 } }))
        .success,
    ).toBe(true);
  });

  it('rejects a soft threshold that the hard limit makes unreachable', () => {
    const above = rateLimitSettingsSchema.safeParse(
      rateLimitConfig({ register: { soft: 5, hard: 2 } }),
    );
    expect(above.success).toBe(false);
    if (!above.success) {
      expect(above.error.issues[0]?.path).toContain('hard');
    }
    expect(
      rateLimitSettingsSchema.safeParse(rateLimitConfig({ login: { soft: 4, hard: 4 } })).success,
    ).toBe(false);
  });
});
