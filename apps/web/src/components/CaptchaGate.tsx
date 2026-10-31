'use client';

import { api, setCaptchaSolver } from '@/lib/api';
import { useEffect, useRef, useState } from 'react';
import { useT } from './I18nProvider';

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

export function CaptchaGate() {
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

  if (!open) return null;
  return (
    <dialog
      open
      aria-modal="true"
      aria-label={t('人机验证')}
      className="motion-fade-in fixed inset-0 z-[80] m-0 flex h-full w-full max-w-none items-center justify-center border-0 bg-black/40 p-4"
    >
      <div className="motion-pop-in w-full max-w-sm rounded-2xl bg-white p-6 shadow-float">
        <h2 className="text-lg font-semibold">{t('人机验证')}</h2>
        <p className="mt-1 text-sm text-muted">{t('为确认你不是自动程序，请完成下方验证。')}</p>
        {!settings?.enabled || !settings.siteKey ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {t('站点尚未正确配置人机验证，请联系管理员。')}
          </div>
        ) : (
          <div ref={widget} className="mt-4 flex min-h-16 justify-center" />
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={cancel}>
            {t('取消')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
