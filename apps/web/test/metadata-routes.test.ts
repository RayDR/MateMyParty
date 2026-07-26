import { describe, expect, it } from 'vitest';
import robots from '../app/robots';
import sitemap from '../app/sitemap';

describe('metadata routes', () => {
  it('blocks invitation and private media crawling', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

    expect(rules[0]?.disallow).toEqual(['/i/', '/a/', '/private-media/']);
  });

  it('does not publish invitation or private media paths in the sitemap', () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(
      urls.every(
        (url) => !url.includes('/i/') && !url.includes('/a/') && !url.includes('/private-media/'),
      ),
    ).toBe(true);
  });
});
