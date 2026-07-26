import { PlatformLanding } from '../components/platform-landing';
import { resolveRequestLocale } from '../lib/locale';

export default async function HomePage() {
  return <PlatformLanding initialLocale={await resolveRequestLocale()} />;
}
