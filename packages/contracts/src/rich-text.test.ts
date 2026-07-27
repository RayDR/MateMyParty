import { isSafeRichText, richTextToHtml, richTextToPlainText } from './rich-text.js';
import { describe, expect, it } from 'vitest';

describe('controlled rich text', () => {
  it('renders the supported subset and preserves a plain-text fallback', () => {
    const value =
      '## Welcome\n\n**Bring socks** and _arrive early_.\n\n- Park east\n- [Directions](https://maps.example.test/place?q=kids)';
    const html = richTextToHtml(value);
    expect(html).toContain('<h2>Welcome</h2>');
    expect(html).toContain('<strong>Bring socks</strong>');
    expect(html).toContain('<ul><li>Park east</li>');
    expect(html).toContain('href="https://maps.example.test/place?q=kids"');
    expect(richTextToPlainText(value)).toContain(
      'Directions (https://maps.example.test/place?q=kids)',
    );
  });

  it.each([
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '[unsafe](javascript:alert(1))',
    '![remote image](https://example.test/tracker.png)',
    '[credentials](https://user:password@example.test/)',
  ])('rejects unsafe input: %s', (value) => {
    expect(isSafeRichText(value)).toBe(false);
  });
});
