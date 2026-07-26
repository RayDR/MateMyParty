import enCommon from '../locales/en-US/common.json';
import enEvent from '../locales/en-US/event.json';
import enHost from '../locales/en-US/host.json';
import enInvitation from '../locales/en-US/invitation.json';
import esCommon from '../locales/es-MX/common.json';
import esEvent from '../locales/es-MX/event.json';
import esHost from '../locales/es-MX/host.json';
import esInvitation from '../locales/es-MX/invitation.json';

export const supportedLocales = ['en-US', 'es-MX'] as const;
export type Locale = (typeof supportedLocales)[number];
export type Dictionary = {
  common: typeof enCommon;
  event: typeof enEvent;
  host: typeof enHost;
  invitation: typeof enInvitation;
};

const dictionaries: Record<Locale, Dictionary> = {
  'en-US': { common: enCommon, event: enEvent, host: enHost, invitation: enInvitation },
  'es-MX': { common: esCommon, event: esEvent, host: esHost, invitation: esInvitation },
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function isLocale(value: string): value is Locale {
  return supportedLocales.includes(value as Locale);
}
