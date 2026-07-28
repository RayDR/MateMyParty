import { richTextToHtml, richTextToPlainText } from '@matemyparty/contracts';
import type { eventLocalizations, events } from '@matemyparty/database';
import type { Locale } from '@matemyparty/i18n';

type EventRow = typeof events.$inferSelect;
type LocalizationRow = typeof eventLocalizations.$inferSelect;

export const EMAIL_TEMPLATE_VERSION = 1;
export const EMAIL_PREVIEW_URL = 'https://preview.invalid/invitation';

export type RenderedInvitationEmail = {
  subject: string;
  html: string;
  text: string;
  locale: Locale;
  eventTitle: string;
  publicThumbnailUrl: string | null;
};

export function renderInvitationEmail(input: {
  event: EventRow;
  localization?: LocalizationRow;
  locale: Locale;
  hostname: string | null;
  invitationUrl: string;
  test?: boolean;
}): RenderedInvitationEmail {
  const { event, localization, locale } = input;
  const title = localization?.title ?? event.title;
  const venue = localization?.venueName ?? event.venueName;
  const hostMessage = localization?.hostMessage ?? event.hostMessage;
  const copy = localizedCopy(locale);
  const safeTitle = safeHeader(title, 150);
  const subject = safeHeader(
    `${input.test ? copy.testPrefix : ''}${copy.subjectPrefix}${safeTitle}`,
    200,
  );
  const invitationUrl = safeInvitationUrl(input.invitationUrl);
  const publicThumbnailUrl = publicThumbnail(event.publicThumbnailRef, input.hostname);
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: event.timezone,
  }).format(event.startsAt);
  const location = [venue, event.addressLine1, event.city, event.region]
    .filter(Boolean)
    .join(', ')
    .slice(0, 1000);
  const escaped = {
    title: escapeHtml(safeTitle),
    date: escapeHtml(date),
    location: escapeHtml(location),
    hostMessage: hostMessage ? richTextToHtml(hostMessage.slice(0, 4000)) : '',
    url: escapeHtml(invitationUrl),
    thumbnail: publicThumbnailUrl ? escapeHtml(publicThumbnailUrl) : null,
    alt: escapeHtml(localization?.thumbnailAltText ?? safeTitle),
  };
  const html = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media only screen and (max-width:600px){.email-card{width:100%!important}.email-pad{padding:24px 18px!important}.email-title{font-size:30px!important}}</style></head>
<body style="margin:0;padding:0;background:#07111f;color:#f8fafc;font-family:Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#07111f"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" class="email-card" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;background:#111827;border:1px solid #334155;border-radius:24px;overflow:hidden">
${escaped.thumbnail ? `<tr><td><img src="${escaped.thumbnail}" width="600" alt="${escaped.alt}" style="display:block;width:100%;height:auto;max-height:315px;object-fit:cover"></td></tr>` : ''}
<tr><td class="email-pad" style="padding:36px">
<p style="margin:0 0 12px;color:#67e8f9;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">MateMyParty</p>
<h1 class="email-title" style="margin:0 0 20px;color:#ffffff;font-size:38px;line-height:1.15">${escaped.title}</h1>
<p style="margin:0 0 18px;color:#e2e8f0;font-size:18px;line-height:1.6">${escapeHtml(copy.introduction)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;background:#172554;border-radius:14px"><tr><td style="padding:18px;color:#dbeafe;font-size:15px;line-height:1.6"><strong>${escapeHtml(copy.dateLabel)}:</strong> ${escaped.date}${escaped.location ? `<br><strong>${escapeHtml(copy.venueLabel)}:</strong> ${escaped.location}` : ''}</td></tr></table>
${escaped.hostMessage ? `<div style="margin:0 0 22px;color:#e2e8f0;font-size:16px;line-height:1.6">${escaped.hostMessage}</div>` : ''}
<p style="margin:26px 0;text-align:center"><a href="${escaped.url}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:17px;font-weight:bold;padding:15px 28px;border-radius:12px">${escapeHtml(copy.cta)}</a></p>
<p style="margin:18px 0 0;color:#94a3b8;font-size:13px;line-height:1.6">${escapeHtml(copy.fallback)}<br><a href="${escaped.url}" style="color:#67e8f9;word-break:break-all">${escaped.url}</a></p>
<p style="margin:30px 0 0;padding-top:18px;border-top:1px solid #334155;color:#64748b;font-size:11px;line-height:1.5">${escapeHtml(copy.footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [
    safeTitle,
    '',
    copy.introduction,
    `${copy.dateLabel}: ${date}`,
    ...(location ? [`${copy.venueLabel}: ${location}`] : []),
    ...(hostMessage ? ['', richTextToPlainText(hostMessage.slice(0, 4000))] : []),
    '',
    copy.rsvp,
    invitationUrl,
    '',
    copy.hostIdentification,
    copy.footer,
  ].join('\n');
  return { subject, html, text, locale, eventTitle: safeTitle, publicThumbnailUrl };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r\n|\r|\n/g, '<br>');
}

export function safeHeader(value: string, maximum: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || /[\r\n]/.test(normalized)) {
    throw new Error('INVALID_EMAIL_HEADER');
  }
  return normalized;
}

function safeInvitationUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || value.length > 2048) {
    throw new Error('INVALID_INVITATION_URL');
  }
  return url.toString();
}

function publicThumbnail(reference: string | null, hostname: string | null): string | null {
  if (!reference) return null;
  if (reference.startsWith('https://')) {
    const url = new URL(reference);
    return !url.username && !url.password ? url.toString() : null;
  }
  if (!hostname || !reference.startsWith('/event-thumbnails/')) return null;
  return `https://${hostname}${reference}`;
}

function localizedCopy(locale: Locale) {
  return locale === 'es-MX'
    ? {
        testPrefix: '[PRUEBA] ',
        subjectPrefix: 'Invitación: ',
        introduction: 'Tienes una invitación especial. Nos encantará celebrar contigo.',
        dateLabel: 'Fecha y hora',
        venueLabel: 'Lugar',
        cta: 'Abrir invitación',
        fallback: 'Si el botón no abre, copia este enlace:',
        rsvp: 'Abre tu invitación para confirmar tu asistencia.',
        hostIdentification: 'Enviado por el anfitrión mediante MateMyParty.',
        footer:
          'Este mensaje contiene un enlace privado para una persona invitada. No lo reenvíes sin permiso.',
      }
    : {
        testPrefix: '[TEST] ',
        subjectPrefix: 'Invitation: ',
        introduction: 'You have a special invitation. We would love to celebrate with you.',
        dateLabel: 'Date and time',
        venueLabel: 'Venue',
        cta: 'Open invitation',
        fallback: 'If the button does not open, copy this link:',
        rsvp: 'Open your invitation to RSVP.',
        hostIdentification: 'Sent by the host with MateMyParty.',
        footer:
          'This message contains a private link for an invited guest. Please do not forward it without permission.',
      };
}
