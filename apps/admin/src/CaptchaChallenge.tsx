import { Alert, Button, Modal } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { api, setCaptchaSolver } from './api';
import { useT } from './i18n';

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: Record<string, unknown> & { callback?: (token: string) => void },
      ) => string;
      reset: (id?: string) => void;
    };
    grecaptcha?: {
      render: (
        element: HTMLElement,
        options: Record<string, unknown> & { callback?: (token: string) => void },
      ) => number;
      execute: (siteKey: string, options: { action?: string }) => Promise<string>;
      reset: (id?: number) => void;
    };
  }
}

interface PublicCaptchaSettings {
  captcha?: {
    enabled: boolean;
    provider: 'turnstile' | 'recaptcha_v2' | 'recaptcha_v3';
    siteKey: string;
  };
}

let scriptPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve();
      else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('load failed')), { once: true });
      }
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true },
    );
    script.addEventListener('error', () => reject(new Error('load failed')), { once: true });
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Captcha widget for the management console. The login form and any staff
 * action that exceeds the soft rate limit can require verification; without
 * this gate the console would be unable to retry those requests.
 */
export function CaptchaChallenge() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState('login');
  const [settings, setSettings] = useState<PublicCaptchaSettings['captcha'] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const resolver = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | number | null>(null);

  useEffect(() => {
    void api
      .get<PublicCaptchaSettings>('/api/v1/settings')
      .then((data) => setSettings(data.captcha ?? null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setCaptchaSolver(
      (nextAction) =>
        new Promise<void>((resolve, reject) => {
          resolver.current = { resolve, reject };
          setAction(nextAction);
          setError('');
          setOpen(true);
        }),
    );
    return () => setCaptchaSolver(null);
  }, []);

  useEffect(() => {
    if (!open || !settings?.enabled || !settings.siteKey) return;
    let cancelled = false;
    const provider = settings.provider;
    const src =
      provider === 'turnstile'
        ? 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        : 'https://www.google.com/recaptcha/api.js?render=explicit';
    void loadScript(src)
      .then(() => {
        if (cancelled || !widget.current) return;
        if (provider === 'turnstile' && window.turnstile) {
          widgetId.current = window.turnstile.render(widget.current, {
            sitekey: settings.siteKey,
            callback: (token: string) => void submit(token),
          });
        } else if (provider === 'recaptcha_v2' && window.grecaptcha) {
          widgetId.current = window.grecaptcha.render(widget.current, {
            sitekey: settings.siteKey,
            callback: (token: string) => void submit(token),
          });
        } else if (provider === 'recaptcha_v3' && window.grecaptcha) {
          void window.grecaptcha
            .execute(settings.siteKey, { action })
            .then((token) => submit(token))
            .catch(() => setError(t('人机验证加载失败，请刷新页面重试')));
        }
      })
      .catch(() => setError(t('人机验证加载失败，请检查网络后重试')));
    return () => {
      cancelled = true;
    };
  }, [open, settings, action]);

  const submit = async (token: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/api/v1/security/captcha/verify', { token, action });
      resolver.current?.resolve();
      resolver.current = null;
      setOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('人机验证失败'));
      if (settings?.provider === 'turnstile') window.turnstile?.reset(widgetId.current as string);
      if (settings?.provider === 'recaptcha_v2') {
        window.grecaptcha?.reset(widgetId.current as number);
      }
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    resolver.current?.reject(new Error(t('已取消人机验证')));
    resolver.current = null;
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      title={t('人机验证')}
      onCancel={cancel}
      maskClosable={false}
      destroyOnClose
      footer={<Button onClick={cancel}>{t('取消')}</Button>}
    >
      <p className="muted">{t('为确认你不是自动程序，请完成下方验证。')}</p>
      {!settings?.enabled || !settings.siteKey ? (
        <Alert type="warning" showIcon message={t('站点尚未正确配置人机验证，请联系管理员。')} />
      ) : (
        <div ref={widget} style={{ display: 'flex', minHeight: 64, justifyContent: 'center' }} />
      )}
      {error && <Alert type="error" showIcon style={{ marginTop: 12 }} message={error} />}
      {busy && <p className="muted">{t('验证中…')}</p>}
    </Modal>
  );
}
