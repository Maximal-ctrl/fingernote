import { db, type Block } from '../db/db';
import { pageTitle, shortDateFmt } from './text';

const TAG_MD: Record<string, string> = { important: '⭐ ', question: '❓ ', idea: '💡 ' };

function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue || '').replace(/\s+/g, ' ');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const inner = Array.from(el.childNodes).map(inline).join('');
  switch (el.tagName) {
    case 'B': case 'STRONG': return inner.trim() ? `**${inner.trim()}**` : '';
    case 'I': case 'EM': return inner.trim() ? `*${inner.trim()}*` : '';
    case 'S': case 'STRIKE': return inner.trim() ? `~~${inner.trim()}~~` : '';
    case 'CODE': return '`' + inner + '`';
    case 'A': return `[${inner}](${el.getAttribute('href') || ''})`;
    case 'BR': return '  \n';
    default: return inner;
  }
}

function blockToMd(el: Element, depth = 0): string[] {
  const out: string[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = (child.nodeValue || '').trim();
      if (t) out.push(t);
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const c = child as HTMLElement;
    const tag = c.getAttribute('data-tag');
    const prefix = tag === 'todo' ? (c.getAttribute('data-done') === '1' ? '- [x] ' : '- [ ] ') : tag ? TAG_MD[tag] ?? '' : '';
    const text = inline(c).trim();
    switch (c.tagName) {
      case 'H1': out.push(`#### ${prefix}${text}`); break;
      case 'H2': case 'H3': out.push(`##### ${prefix}${text}`); break;
      case 'UL': case 'OL':
        Array.from(c.children).forEach((li, i) => {
          const sub = Array.from(li.children).filter((x) => x.tagName === 'UL' || x.tagName === 'OL');
          const own = Array.from(li.childNodes).filter((x) => !sub.includes(x as Element)).map(inline).join('').trim();
          out.push(`${'  '.repeat(depth)}${c.tagName === 'OL' ? `${i + 1}.` : '-'} ${own}`);
          for (const s of sub) out.push(...blockToMd({ childNodes: [s] } as unknown as Element, depth + 1));
        });
        break;
      case 'BLOCKQUOTE': out.push(`> ${text}`); break;
      case 'PRE': out.push('```\n' + (c.textContent || '') + '\n```'); break;
      default: if (text || prefix) out.push(prefix + text);
    }
  }
  return out;
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  return blockToMd(doc.body.firstElementChild!).join('\n\n');
}

/** Ganzes Notizbuch als eine Markdown-Datei: getippter Text, Tags als Checklisten. Handschrift und Bilder sind vermerkt. */
export async function notebookToMarkdown(notebookId: string): Promise<{ name: string; md: string }> {
  const nb = await db.notebooks.get(notebookId);
  if (!nb) throw new Error('Notizbuch fehlt');
  const sections = (await db.sections.where('notebookId').equals(notebookId).toArray()).filter((s) => !s.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder);
  const pages = (await db.pages.where('notebookId').equals(notebookId).toArray()).filter((p) => !p.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder);
  const lines: string[] = [`# ${nb.title}`, '', `_Exportiert aus Fingernote am ${shortDateFmt.format(Date.now())}_`, ''];
  for (const s of sections) {
    lines.push(`## ${s.title}`, '');
    for (const p of pages.filter((x) => x.sectionId === s.id)) {
      const blocks: Block[] = await db.blocks.where('pageId').equals(p.id).toArray();
      const strokes = await db.strokes.where('pageId').equals(p.id).count();
      lines.push(`### ${'  '.repeat(p.level)}${pageTitle(p.title)}`, '', `_${shortDateFmt.format(p.createdAt)}_`, '');
      for (const b of blocks.sort((a, c) => a.y - c.y || a.x - c.x)) {
        if (b.kind === 'text' && b.html) lines.push(htmlToMarkdown(b.html), '');
        if (b.kind === 'image') lines.push('_[Bild]_', '');
        if (b.kind === 'pdf') lines.push(`_[PDF-Seite ${b.pdfPage}]_`, '');
      }
      if (strokes) lines.push(`_[${strokes} handschriftliche ${strokes === 1 ? 'Strich' : 'Striche'}: im Fingernote-Backup oder per Drucken als PDF enthalten]_`, '');
    }
  }
  const name = nb.title.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'notizbuch';
  return { name, md: lines.join('\n').replace(/\n{3,}/g, '\n\n') };
}
