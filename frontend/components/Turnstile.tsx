'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'expired-callback': () => void;
      }) => string;
      remove: (widgetId: string) => void;
    };
  }
}

interface Props {
  siteKey: string;
  onToken: (token: string) => void;
  onExpire: () => void;
}

export function Turnstile({ siteKey, onToken, onExpire }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  function init() {
    if (!containerRef.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onToken,
      'expired-callback': onExpire,
    });
  }

  useEffect(() => {
    init();
    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        onLoad={init}
      />
      <div ref={containerRef} />
    </>
  );
}
