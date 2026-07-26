import { notFound } from 'next/navigation';
import { publicEventPreviewSchema, type PublicEventPreview } from '@matemyparty/contracts';
import { internalApiBaseUrl } from './server-api';

async function fetchEvent(path: string): Promise<PublicEventPreview> {
  const response = await fetch(`${internalApiBaseUrl}${path}`, { next: { revalidate: 60 } });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error(`Event API request failed with status ${response.status}`);
  return publicEventPreviewSchema.parse(await response.json());
}

export function getEventBySlug(slug: string) {
  return fetchEvent(`/api/events/by-slug/${encodeURIComponent(slug)}`);
}

export function getEventByHostname(hostname: string) {
  return fetchEvent(`/api/events/by-hostname/${encodeURIComponent(hostname)}`);
}
