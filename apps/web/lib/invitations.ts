import { cache } from 'react';
import { privateInvitationSchema, type PrivateInvitation } from '@matemyparty/contracts';
import { internalApiBaseUrl } from './server-api';

export const getPublicInvitation = cache(
  async (token: string): Promise<PrivateInvitation | null> => {
    const response = await fetch(
      `${internalApiBaseUrl}/api/invitations/${encodeURIComponent(token)}`,
      {
        cache: 'no-store',
        headers: { 'user-agent': 'MateMyParty web server' },
      },
    );
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error(`Invitation API request failed with status ${response.status}`);
    return privateInvitationSchema.parse(await response.json());
  },
);

export const getGrantInvitation = cache(
  async (grantToken: string): Promise<PrivateInvitation | null> => {
    const response = await fetch(`${internalApiBaseUrl}/api/invitations/access`, {
      cache: 'no-store',
      headers: {
        'user-agent': 'MateMyParty web server',
        'x-invitation-grant': grantToken,
      },
    });
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error(`Invitation API request failed with status ${response.status}`);
    return privateInvitationSchema.parse(await response.json());
  },
);
