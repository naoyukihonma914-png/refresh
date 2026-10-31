import type { I18n } from './i18n';
export const productLabel = (i18n: I18n, name: string | null, version = 'v1.0') => i18n.t('product.label',{name:name?.trim() || i18n.t('product.untitled'),version});
