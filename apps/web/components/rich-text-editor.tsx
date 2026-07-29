'use client';

import { useEffect, type ReactNode } from 'react';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
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
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          protocols: ['https', 'mailto'],
        },
      }),
      Markdown,
    ],
    content: value,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class:
          'rich-text min-h-36 w-full rounded-b-xl border border-white/15 bg-slate-900 px-3 py-3 text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20',
        'aria-label': label,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getMarkdown());
    },
  });

  useEffect(() => {
    if (!editor) return;

    const currentMarkdown = editor.getMarkdown();
    if (currentMarkdown === value) return;

    editor.commands.setContent(value, {
      contentType: 'markdown',
      emitUpdate: false,
    });
  }, [editor, value]);

  function addLink() {
    if (!editor) return;

    const currentHref = editor.getAttributes('link').href as string | undefined;
    const destination = window.prompt(
      dictionary.host.richTextLinkPrompt,
      currentHref ?? 'https://',
    );

    if (destination === null) return;

    if (destination === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    try {
      const url = new URL(destination);

      if (!['https:', 'mailto:'].includes(url.protocol) || url.username || url.password) {
        return;
      }

      editor.chain().focus().extendMarkRange('link').setLink({ href: url.toString() }).run();
    } catch {
      return;
    }
  }

  if (!editor) {
    return (
      <div className={className}>
        <p className="text-sm text-slate-200">{label}</p>
        <div className="mt-2 min-h-36 rounded-xl border border-white/15 bg-slate-900" />
      </div>
    );
  }

  return (
    <div className={className}>
      <p className="text-sm text-slate-200">{label}</p>

      <div className="mt-2">
        <div className="flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-white/15 bg-slate-950 p-2">
          <Tool
            label={dictionary.host.richTextBold}
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold size={17} />
          </Tool>

          <Tool
            label={dictionary.host.richTextItalic}
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic size={17} />
          </Tool>

          <Tool
            label={dictionary.host.richTextBulletList}
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List size={17} />
          </Tool>

          <Tool
            label={dictionary.host.richTextNumberedList}
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={17} />
          </Tool>

          <Tool
            label={dictionary.host.richTextHeading}
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 size={17} />
          </Tool>

          <Tool
            label={dictionary.host.richTextLink}
            active={editor.isActive('link')}
            onClick={addLink}
          >
            <Link size={17} />
          </Tool>
        </div>

        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Tool({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-200 ${
        active ? 'bg-cyan-400/20 text-cyan-100' : 'hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}
