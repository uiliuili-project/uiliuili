'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

const MEASUREMENT_ID = /^G-[A-Z0-9]{4,}$/i;

/**
 * Google Analytics 4 loader. The measurement ID is validated again on the
 * client so a malformed administrator value can never inject script content.
 */
export function GoogleAnalytics({
  measurementId,
  anonymizeIp = true,
  respectDnt = true,
}: {
  measurementId: string;
  anonymizeIp?: boolean;
  respectDnt?: boolean;
}) {
  const [allowed, setAllowed] = useState(!respectDnt);

  useEffect(() => {
    if (!respectDnt) {
      setAllowed(true);
      return;
    }
    const globalDnt = (window as unknown as { doNotTrack?: string | null }).doNotTrack;
    setAllowed(navigator.doNotTrack !== '1' && globalDnt !== '1');
  }, [respectDnt]);

  if (!allowed || !MEASUREMENT_ID.test(measurementId)) return null;
  return (
    <>
      <Script
        id="ga4-loader"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(measurementId)}, { anonymize_ip: ${anonymizeIp ? 'true' : 'false'} });`}
      </Script>
    </>
  );
}
