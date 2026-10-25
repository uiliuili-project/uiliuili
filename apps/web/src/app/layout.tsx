import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { I18nProvider } from '@/components/I18nProvider';
import { MaintenanceGate } from '@/components/MaintenanceGate';
import { Providers } from '@/components/Providers';
import { PwaRegister } from '@/components/PwaRegister';
import { getLocale, getT } from '@/lib/i18n-server';
import type { Metadata } from 'next';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: {
      default: `${t('common.appName')} · ${t('common.tagline')}`,
      template: `%s · ${t('common.appName')}`,
    },
    description: t('common.siteDescription'),
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      title: 'uiliuili',
      statusBarStyle: 'default',
    },
    icons: {
      icon: '/favicon.svg',
      apple: '/favicon.svg',
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider initialLocale={locale}>
          <Providers>
            <MaintenanceGate>
              <PwaRegister />
              <div className="flex min-h-screen flex-col">
                <Header />
                <main className="flex-1">{children}</main>
                <Footer />
              </div>
            </MaintenanceGate>
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
