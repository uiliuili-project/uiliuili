import { useEffect, useState } from 'react';
import { api } from './api';

export interface SiteBrand {
  name: string;
  logoUrl: string;
}

const defaultBrand: SiteBrand = { name: '萌悠', logoUrl: '' };

export function useSiteBrand(): SiteBrand {
  const [brand, setBrand] = useState<SiteBrand>(defaultBrand);

  useEffect(() => {
    let cancelled = false;
    void api
      .get<{ site: { name?: string; logoUrl?: string } }>('/api/v1/settings')
      .then((settings) => {
        if (cancelled) return;
        setBrand({
          name: settings.site.name || defaultBrand.name,
          logoUrl: settings.site.logoUrl || '',
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return brand;
}
