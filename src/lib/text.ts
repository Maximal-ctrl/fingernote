const scratch = typeof document !== 'undefined' ? document.createElement('div') : null;

export function htmlToText(html: string | undefined): string {
  if (!html || !scratch) return '';
  scratch.innerHTML = html.replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, '$& ');
  return (scratch.textContent || '').replace(/\s+/g, ' ').trim();
}

export function normalize(s: string): string {
  return s.toLocaleLowerCase('de-DE');
}

export const dateFmt = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
export const timeFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
export const shortDateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const pageTitle = (t: string | undefined) => (t && t.trim()) || 'Unbenannte Seite';
