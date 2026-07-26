import { notFound } from 'next/navigation';
import { publicEventSchema, type PublicEvent } from '@matemyparty/contracts';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

async function fetchEvent(path: string): Promise<PublicEvent> {
  const response = await fetch(`${apiBaseUrl}${path}`, { next: { revalidate: 60 } });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error(`Event API request failed with status ${response.status}`);
  return publicEventSchema.parse(await response.json());
}

export function getEventBySlug(slug: string) {
  return fetchEvent(`/api/events/by-slug/${encodeURIComponent(slug)}`);
}

export function getEventByHostname(hostname: string) {
  return fetchEvent(`/api/events/by-hostname/${encodeURIComponent(hostname)}`);
}
