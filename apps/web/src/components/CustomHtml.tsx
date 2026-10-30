'use client';

import { useEffect, useRef } from 'react';

/**
 * Renders administrator-authored header or footer markup.
 *
 * `dangerouslySetInnerHTML` alone does not execute `<script>` tags, so the
 * markup is applied imperatively and every script is recreated once mounted.
 * This is intentionally only reachable through the `settings:site` permission.
 */
export function CustomHtml({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    if (!html) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = html;
    const scripts = Array.from(container.querySelectorAll('script'));
    for (const original of scripts) {
      const script = document.createElement('script');
      for (const attribute of Array.from(original.attributes)) {
        script.setAttribute(attribute.name, attribute.value);
      }
      script.text = original.textContent ?? '';
      original.replaceWith(script);
    }
  }, [html]);

  if (!html) return null;
  return <div ref={ref} className={className} suppressHydrationWarning />;
}
