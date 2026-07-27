import { z } from 'zod';

const markdownLink = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

export function isSafeRichText(value: string): boolean {
  const hasDisallowedControl = [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 && code !== 9 && code !== 10 && code !== 13;
  });
  if (hasDisallowedControl || /[<>]/.test(value) || /!\[[^\]]*\]\(/.test(value)) {
    return false;
  }
  for (const match of value.matchAll(markdownLink)) {
    try {
      const url = new URL(match[2]!);
      if (!['https:', 'mailto:'].includes(url.protocol) || url.username || url.password)
        return false;
    } catch {
      return false;
    }
  }
  return true;
}

export const richTextSchema = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .refine(isSafeRichText, 'Only safe formatting and HTTPS or email links are supported');

export function richTextToHtml(value: string): string {
  if (!isSafeRichText(value)) {
    return `<p>${escapeHtml(value).replace(/\r\n|\r|\n/g, '<br>')}</p>`;
  }
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      `<${tag}>${list.items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${tag}>`,
    );
    list = null;
  };

  for (const line of lines) {
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    const listItem = /^(?:([-*])|(\d+)\.)\s+(.+)$/.exec(line);
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1]!.length;
      blocks.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
    } else if (listItem) {
      flushParagraph();
      const ordered = Boolean(listItem[2]);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push(listItem[3]!);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks.join('');
}

export function richTextToPlainText(value: string): string {
  return value
    .replace(markdownLink, '$1 ($2)')
    .replace(/^#{2,3}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .trim();
}

function renderInline(value: string): string {
  let cursor = 0;
  let result = '';
  for (const match of value.matchAll(markdownLink)) {
    result += renderEmphasis(value.slice(cursor, match.index));
    const url = new URL(match[2]!);
    result += `<a href="${escapeHtml(url.toString())}" rel="noreferrer">${renderEmphasis(match[1]!)}</a>`;
    cursor = (match.index ?? 0) + match[0].length;
  }
  return result + renderEmphasis(value.slice(cursor));
}

function renderEmphasis(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
