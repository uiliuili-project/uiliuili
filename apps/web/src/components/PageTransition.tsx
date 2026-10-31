'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Restarts the page entrance animation on every navigation. The wrapper only
 * animates while `html[data-motion="full"]` is set, so older browsers and
 * reduced-motion visitors see the content immediately.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="motion-page">
      {children}
    </div>
  );
}
