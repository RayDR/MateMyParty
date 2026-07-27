import { describe, expect, it } from 'vitest';
import { invitationMetadata } from '../lib/invitation-metadata';
import { privateInvitation } from './public-experience-fixture';

describe('invitation metadata privacy', () => {
  it('uses localized event sharing fields without guest details and remains noindex', () => {
    const metadata = invitationMetadata(privateInvitation, 'es-MX');
    const serialized = JSON.stringify(metadata);
    expect(metadata.title).toBe('Sexto cumpleaños de Raymundo');
    expect(serialized).toContain(
      'https://raymundo6th.domoforge.com/private-media/raymundo-6/thumbnail.webp',
    );
    expect(serialized).not.toContain('Family Sample');
    expect(serialized).not.toContain('2 adults');
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('does not expose event metadata for an invalid invitation', () => {
    expect(JSON.stringify(invitationMetadata(null))).not.toContain('Raymundo');
  });
});
