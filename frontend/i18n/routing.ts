import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'zh-CN', 'es', 'pt-BR', 'ar', 'ms-MY'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});
