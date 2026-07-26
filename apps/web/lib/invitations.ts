import { cache } from 'react';
import { publicInvitationSchema, type PublicInvitation } from '@matemyparty/contracts';
import { internalApiBaseUrl } from './server-api';

export const getPublicInvitation = cache(
  async (token: string): Promise<PublicInvitation | null> => {
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
    return publicInvitationSchema.parse(await response.json());
  },
);

export const getInvitationByGrant = cache(
  async (grant: string): Promise<PublicInvitation | null> => {
    const response = await fetch(
      `${internalApiBaseUrl}/api/invitation-access/${encodeURIComponent(grant)}`,
      {
        cache: 'no-store',
        headers: { 'user-agent': 'MateMyParty web server' },
      },
    );
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error(`Invitation access API request failed with status ${response.status}`);
    return publicInvitationSchema.parse(await response.json());
  },
);
