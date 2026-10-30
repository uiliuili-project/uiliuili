import { CaptchaGate } from '@/components/CaptchaGate';
import { CustomHtml } from '@/components/CustomHtml';
import { Footer } from '@/components/Footer';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { Header } from '@/components/Header';
import { I18nProvider } from '@/components/I18nProvider';
import { MaintenanceGate } from '@/components/MaintenanceGate';
import { Providers } from '@/components/Providers';
import { PwaRegister } from '@/components/PwaRegister';
import { getLocale, getT } from '@/lib/i18n-server';
import { serverFetchSafe } from '@/lib/server-api';
import type { Metadata } from 'next';
import './globals.css';

interface LayoutSettings {
  site?: { name?: string };
  customCode?: {
    headerEnabled?: boolean;
    headerHtml?: string;
    footerEnabled?: boolean;
    footerHtml?: string;
  };
  analytics?: {
    enabled?: boolean;
    measurementId?: string;
    anonymizeIp?: boolean;
    respectDnt?: boolean;
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const [t, settings] = await Promise.all([
    getT(),
    serverFetchSafe<LayoutSettings>('/api/v1/settings', {}),
  ]);
  const siteName = settings.site?.name || t('common.appName');
  return {
    title: {
      default: `${siteName} · ${t('common.tagline')}`,
      template: `%s · ${siteName}`,
    },
    description: t('common.siteDescription'),
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      title: siteName,
      statusBarStyle: 'default',
    },
    icons: {
      icon: '/favicon.svg',
      apple: '/favicon.svg',
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, settings] = await Promise.all([
    getLocale(),
    serverFetchSafe<LayoutSettings>('/api/v1/settings', {}),
  ]);
  const customCode = settings.customCode ?? {};
  const analytics = settings.analytics ?? {};
  return (
    <html lang={locale}>
      <body>
        <I18nProvider initialLocale={locale}>
          <Providers>
            <CaptchaGate />
            {analytics.enabled && analytics.measurementId ? (
              <GoogleAnalytics
                measurementId={analytics.measurementId}
                anonymizeIp={analytics.anonymizeIp}
                respectDnt={analytics.respectDnt}
              />
            ) : null}
            <MaintenanceGate>
              <PwaRegister />
              <div className="flex min-h-screen flex-col">
                <Header />
                {customCode.headerEnabled && customCode.headerHtml ? (
                  <CustomHtml html={customCode.headerHtml} />
                ) : null}
                <main className="flex-1">{children}</main>
                {customCode.footerEnabled && customCode.footerHtml ? (
                  <CustomHtml html={customCode.footerHtml} />
                ) : null}
                <Footer />
              </div>
            </MaintenanceGate>
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
