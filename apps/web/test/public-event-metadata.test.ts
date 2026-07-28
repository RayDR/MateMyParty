import { describe, expect, it } from 'vitest';
import { publicEventMetadata } from '../lib/public-event-metadata';
import { publicLanding } from './public-experience-fixture';

describe('public event metadata privacy', () => {
  it('contains only public promotional fields and an absolute event image', () => {
    const metadata = publicEventMetadata(publicLanding, 'en-US');
    const serialized = JSON.stringify(metadata);
    expect(metadata.title).toBe('Raymundo is turning 6!');
    expect(serialized).toContain(
      'https://raymundo6th.domoforge.com/private-media/raymundo-6/thumbnail.webp',
    );
    expect(serialized).not.toContain('Celebration Center');
    expect(serialized).not.toContain('Family Sample');
    expect(serialized).not.toContain('2026-08-06');
  });
});
