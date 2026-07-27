import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { rejectInvalidHostMutation } from '../lib/host-api';

function request(origin?: string, csrf?: string) {
  return new NextRequest('https://matemyparty.domoforge.com/internal/host/email', {
    method: 'POST',
    headers: {
      ...(origin ? { origin } : {}),
      ...(csrf ? { 'x-mmp-csrf': csrf } : {}),
    },
  });
}

describe('host email mutation boundary', () => {
  it('accepts only an exact same-origin request with the CSRF marker', async () => {
    expect(rejectInvalidHostMutation(request('https://matemyparty.domoforge.com', '1'))).toBeNull();
    expect(rejectInvalidHostMutation(request(undefined, '1'))?.status).toBe(403);
    expect(rejectInvalidHostMutation(request('https://attacker.example', '1'))?.status).toBe(403);
    expect(
      rejectInvalidHostMutation(request('https://matemyparty.domoforge.com', 'true'))?.status,
    ).toBe(403);
  });
});
