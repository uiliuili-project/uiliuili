import { z } from 'zod';
import { REGION_DENY_BEHAVIORS, VIDEO_REGION_MODES } from '../constants';
import { isRegionCode, normalizeRegionCode, normalizeRegionList } from '../regions';

export const regionCodeSchema = z
  .string()
  .trim()
  .transform((value) => normalizeRegionCode(value))
  .refine((value) => isRegionCode(value), '无效的地区代码');

export const regionCodeListSchema = z.array(regionCodeSchema).max(300).default([]);

export const videoRegionFieldsSchema = z.object({
  restricted: z.boolean().default(false),
  regionMode: z.enum(VIDEO_REGION_MODES).default('inherit'),
  regionCodes: regionCodeListSchema,
  regionDenyBehavior: z.enum(REGION_DENY_BEHAVIORS).default('default'),
  regionDenyMessage: z.string().max(200).default(''),
});

export const regionPreferencesSchema = z.object({
  showRestricted: z.boolean(),
});

export type VideoRegionFields = z.infer<typeof videoRegionFieldsSchema>;

/** Normalises region policy coming from untrusted input. */
export function normalizeVideoRegionPolicy(input: {
  restricted?: boolean;
  regionMode?: string;
  regionCodes?: unknown;
  regionDenyBehavior?: string;
  regionDenyMessage?: string;
}): {
  restricted: boolean;
  regionMode: 'inherit' | 'block';
  regionCodes: string[];
  regionDenyBehavior: 'default' | 'message' | 'not_found';
  regionDenyMessage: string;
} {
  const restricted = Boolean(input.restricted);
  const rawMode = input.regionMode === 'block' || restricted ? 'block' : 'inherit';
  const behavior =
    input.regionDenyBehavior === 'message' || input.regionDenyBehavior === 'not_found'
      ? input.regionDenyBehavior
      : input.regionDenyBehavior === 'default'
        ? 'default'
        : 'default';
  return {
    restricted,
    regionMode: rawMode,
    regionCodes: restricted ? [] : normalizeRegionList(input.regionCodes),
    regionDenyBehavior: behavior,
    regionDenyMessage: (input.regionDenyMessage ?? '').slice(0, 200),
  };
}
