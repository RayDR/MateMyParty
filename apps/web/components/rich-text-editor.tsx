'use client';

import { useRef, type ReactNode } from 'react';
import { richTextToHtml } from '@matemyparty/contracts';
import type { Dictionary } from '@matemyparty/i18n';
import { Bold, Heading2, Italic, Link, List, ListOrdered } from 'lucide-react';

export function RichTextEditor({
  label,
  value,
  onChange,
  dictionary,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dictionary: Dictionary;
  className?: string;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after = before, placeholder = dictionary.host.richTextPlaceholder) {
    const field = textarea.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    onChange(`${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`);
    requestAnimationFrame(() => field.focus());
  }

  function prefix(prefixValue: string) {
    const field = textarea.current;
    if (!field) return;
    const start = value.lastIndexOf('\n', Math.max(0, field.selectionStart - 1)) + 1;
    onChange(`${value.slice(0, start)}${prefixValue}${value.slice(start)}`);
    requestAnimationFrame(() => field.focus());
  }

  function addLink() {
    const destination = window.prompt(dictionary.host.richTextLinkPrompt, 'https://');
    if (!destination) return;
    try {
      const url = new URL(destination);
      if (!['https:', 'mailto:'].includes(url.protocol) || url.username || url.password) return;
      wrap('[', `](${url.toString()})`, dictionary.host.richTextLinkText);
    } catch {
      return;
    }
  }

  return (
    <div className={className}>
      <label className="text-sm text-slate-200">
        <span>{label}</span>
        <span className="mt-2 flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-white/15 bg-slate-950 p-2">
          <Tool label={dictionary.host.richTextBold} onClick={() => wrap('**')}>
            <Bold size={17} />
          </Tool>
          <Tool label={dictionary.host.richTextItalic} onClick={() => wrap('_')}>
            <Italic size={17} />
          </Tool>
          <Tool label={dictionary.host.richTextBulletList} onClick={() => prefix('- ')}>
            <List size={17} />
          </Tool>
          <Tool label={dictionary.host.richTextNumberedList} onClick={() => prefix('1. ')}>
            <ListOrdered size={17} />
          </Tool>
          <Tool label={dictionary.host.richTextHeading} onClick={() => prefix('## ')}>
            <Heading2 size={17} />
          </Tool>
          <Tool label={dictionary.host.richTextLink} onClick={addLink}>
            <Link size={17} />
          </Tool>
        </span>
        <textarea
          ref={textarea}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-36 w-full rounded-b-xl border border-white/15 bg-slate-900 px-3 py-3 text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
        />
      </label>
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-4">
        <p className="mb-2 text-xs font-bold text-slate-400">{dictionary.host.richTextPreview}</p>
        <div
          className="rich-text text-sm text-slate-200"
          dangerouslySetInnerHTML={{ __html: richTextToHtml(value) }}
        />
      </div>
    </div>
  );
}

function Tool({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10"
    >
      {children}
    </button>
  );
}
