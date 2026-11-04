// Erzeugt src/styles/tokens.css aus replica/design/tokens.json (eine Quelle für alle Werte).
import { readFileSync, writeFileSync } from 'node:fs';
const t = JSON.parse(readFileSync(new URL('../replica/design/tokens.json', import.meta.url)));
const vars = (obj) => Object.entries(obj).map(([k, v]) => `  --${k}: ${v};`).join('\n');
const type = Object.entries(t.type).map(([k, v]) => `  --fs-${k}: ${v.size}px;\n  --lh-${k}: ${v.line}px;\n  --fw-${k}: ${v.weight};`).join('\n');
const space = t.space.map((v, i) => `  --s-${i}: ${v}px;`).join('\n');
const radius = Object.entries(t.radius).map(([k, v]) => `  --r-${k}: ${v}px;`).join('\n');
const shadow = Object.entries(t.shadow).map(([k, v]) => `  --sh-${k}: ${v};`).join('\n');
const motion = Object.entries(t.motion).map(([k, v]) => `  --m-${k}: ${v};`).join('\n');
const layout = Object.entries(t.layout).filter(([, v]) => typeof v === 'number').map(([k, v]) => `  --l-${k}: ${v}px;`).join('\n');
const paper = Object.entries(t.paper).map(([k, o]) => `.paper-c-${k}, .page-c-${k} { --pp: ${o.bg}; --pl: ${o.line}; --pt: ${o.text}; }`).join('\n');
const css = `/* generiert von scripts/tokens.mjs – nicht von Hand ändern, sondern replica/design/tokens.json */
:root {
${vars(t.color)}
  --font-sans: ${t.font.sans};
  --font-mono: ${t.font.mono};
${type}
${space}
${radius}
${shadow}
${motion}
${layout}
  color-scheme: light;
}
:root[data-theme='dark'] {
${vars(t.dark)}
  --sh-card: 0 1px 2px rgba(0,0,0,.4), 0 1px 3px rgba(0,0,0,.5);
  --sh-pop: 0 12px 32px rgba(0,0,0,.55);
  --sh-paper: 0 1px 3px rgba(0,0,0,.5), 0 8px 24px rgba(0,0,0,.35);
  color-scheme: dark;
}
${paper}
`;
writeFileSync(new URL('../src/styles/tokens.css', import.meta.url), css);
console.log('tokens.css geschrieben');
