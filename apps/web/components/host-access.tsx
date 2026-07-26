import type { Dictionary } from '@matemyparty/i18n';
import { Card } from '@matemyparty/ui';

export function HostAccess({
  dictionary,
  returnTo,
  invalid,
}: {
  dictionary: Dictionary;
  returnTo: string;
  invalid: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-white">
      <div className="w-full max-w-md">
        <Card>
          <h1 className="text-3xl font-bold">{dictionary.host.accessTitle}</h1>
          <p className="mt-3 text-slate-300">{dictionary.host.accessDescription}</p>
          {invalid ? (
            <p className="mt-4 rounded-xl bg-red-500/15 p-3 text-red-200">
              {dictionary.host.invalidToken}
            </p>
          ) : null}
          <form action="/host/access" method="post" className="mt-6 space-y-4">
            <input type="hidden" name="returnTo" value={returnTo} />
            <label className="block">
              <span className="text-sm text-slate-200">{dictionary.host.tokenLabel}</span>
              <input
                name="token"
                type="password"
                required
                autoComplete="current-password"
                className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-3"
              />
            </label>
            <button className="w-full rounded-xl bg-violet-500 px-4 py-3 font-bold hover:bg-violet-400">
              {dictionary.host.signIn}
            </button>
          </form>
          <p className="mt-6 text-xs text-amber-200">{dictionary.host.provisionalWarning}</p>
        </Card>
      </div>
    </main>
  );
}
