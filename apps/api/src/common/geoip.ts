import { normalizeProvinceCode, normalizeRegionCode } from '@uiliuili/shared';

/** The subset of a MaxMind City/Country record the site reads. */
export interface GeoipSubdivision {
  iso_code?: string;
  names?: Record<string, string>;
}

export interface GeoipRecord {
  country?: { iso_code?: string };
  subdivisions?: GeoipSubdivision[];
}

export interface GeoipReader {
  get(ip: string): GeoipRecord | null;
}

export interface NetworkLocation {
  code: string;
  province: string;
}

/**
 * Extracts the country and, for mainland China, the province from a MaxMind
 * record. Country databases have no subdivisions, so the province stays empty
 * and the IP label falls back to the country.
 */
export function geoipLocation(record: GeoipRecord | null | undefined): NetworkLocation {
  const code = normalizeRegionCode(record?.country?.iso_code);
  if (code !== 'CN') return { code, province: '' };
  const province =
    (record?.subdivisions ?? [])
      .map((item) => normalizeProvinceCode(item?.iso_code))
      .find((value) => Boolean(value)) ?? '';
  return { code, province };
}
