import { cache } from 'react';
import { publicInvitationSchema, type PublicInvitation } from '@matemyparty/contracts';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export const getPublicInvitation = cache(
  async (token: string): Promise<PublicInvitation | null> => {
    const response = await fetch(`${apiBaseUrl}/api/invitations/${encodeURIComponent(token)}`, {
      cache: 'no-store',
      headers: { 'user-agent': 'MateMyParty web server' },
    });
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error(`Invitation API request failed with status ${response.status}`);
    return publicInvitationSchema.parse(await response.json());
  },
);
