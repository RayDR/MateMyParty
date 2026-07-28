import {
  hostPresentationPreviewSchema,
  type HostPresentationPreview,
} from '@matemyparty/contracts';
import { internalApiBaseUrl } from './server-api';

export async function getHostPresentationPreview(
  identifier: string,
): Promise<HostPresentationPreview | null> {
  const token = process.env.HOST_ADMIN_TOKEN;
  if (!token) throw new Error('Host access unavailable');
  const response = await fetch(
    `${internalApiBaseUrl}/api/host/events/${encodeURIComponent(identifier)}/presentation-preview`,
    {
      cache: 'no-store',
      headers: { authorization: `Bearer ${token}` },
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Host preview request failed with status ${response.status}`);
  return hostPresentationPreviewSchema.parse(await response.json());
}
