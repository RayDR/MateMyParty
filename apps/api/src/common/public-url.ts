import { normalizeHostname } from '@matemyparty/contracts';

const DEFAULT_PLATFORM_HOSTNAME = 'matemyparty.domoforge.com';
const DEFAULT_EVENT_HOSTNAME = 'raymundo6th.domoforge.com';

function allowedHostnames(): Set<string> {
  return new Set(
    [
      DEFAULT_PLATFORM_HOSTNAME,
      DEFAULT_EVENT_HOSTNAME,
      ...(process.env.PUBLIC_APP_HOSTNAMES?.split(',') ?? []),
    ]
      .map(normalizeHostname)
      .filter(Boolean),
  );
}

function productionHostname(candidate: string | null | undefined): string {
  const hostname = normalizeHostname(candidate ?? '');
  return allowedHostnames().has(hostname) ? hostname : platformHostname();
}

function platformHostname(): string {
  const configured = normalizeHostname(process.env.PRIMARY_APP_HOSTNAME ?? '');
  return allowedHostnames().has(configured) ? configured : DEFAULT_PLATFORM_HOSTNAME;
}

export function publicEventUrl(path: string, eventHostname?: string | null): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('Public URLs require a root-relative path');
  }
  if (process.env.NODE_ENV === 'production') {
    return new URL(path, `https://${productionHostname(eventHostname)}`).toString();
  }
  const protocol = process.env.PUBLIC_APP_PROTOCOL === 'https' ? 'https' : 'http';
  const configuredHost = process.env.PRIMARY_APP_HOSTNAME ?? 'localhost:3000';
  const developmentHost = normalizeHostname(configuredHost);
  const host =
    developmentHost === 'localhost' || developmentHost === '127.0.0.1'
      ? configuredHost
      : (eventHostname ?? configuredHost);
  return new URL(path, `${protocol}://${host}`).toString();
}
