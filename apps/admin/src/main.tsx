import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AdminI18nProvider, useI18n } from './i18n';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Root() {
  const { locale } = useI18n();
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={locale === 'zh-CN' ? zhCN : enUS}
        theme={{
          token: {
            colorPrimary: '#fb7299',
            borderRadius: 8,
            colorBgLayout: '#f6f7f9',
          },
        }}
      >
        <App />
      </ConfigProvider>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AdminI18nProvider>
      <Root />
    </AdminI18nProvider>
  </React.StrictMode>,
);
