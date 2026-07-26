import { describe, expect, it } from 'vitest';
import { getDictionary } from './index.js';

function keys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' ? keys(child as object, path) : [path];
  });
}

describe('translation completeness', () => {
  it('keeps en-US and es-MX keys in sync', () => {
    expect(keys(getDictionary('es-MX')).sort()).toEqual(keys(getDictionary('en-US')).sort());
  });
});
