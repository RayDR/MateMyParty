import { getDictionary } from '@matemyparty/i18n';

export default function NotFound() {
  const dictionary = getDictionary('en-US');
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-white">
      <div>
        <h1 className="text-3xl font-bold">{dictionary.common.errorTitle}</h1>
        <p className="mt-3 text-slate-300">{dictionary.common.notFound}</p>
      </div>
    </main>
  );
}
