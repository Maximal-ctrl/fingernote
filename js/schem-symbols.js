// Symbolbibliothek für Stromlaufpläne (an IEC 60617 / DIN EN 60617 angelehnt).
// Koordinaten in Millimetern, Ursprung = Mitte, Anschlüsse liegen im 5-mm-Raster.
// Zeichenbefehle:
//  ['l', x1,y1,x2,y2]            Linie
//  ['d', x1,y1,x2,y2]            gestrichelte Linie (Wirkverbindung)
//  ['r', x,y,w,h, fill]          Rechteck
//  ['c', cx,cy,r, fill]          Kreis
//  ['a', cx,cy,r, a0,a1]         Bogen (Grad, im Uhrzeigersinn)
//  ['p', [x,y,...], close, fill] Linienzug
//  ['t', x,y, text, size]        Text (wird nie gedreht)

function arrow(x1, y1, x2, y2, s = 1.6) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (ang) => [x2 - s * Math.cos(a + ang), y2 - s * Math.sin(a + ang)];
  const [ax, ay] = p(0.45), [bx, by] = p(-0.45);
  return [['l', x1, y1, x2, y2], ['p', [x2, y2, ax, ay, bx, by], true, true]];
}

const V = (top = 10) => [['l', 0, -top, 0, -5], ['l', 0, 5, 0, top]]; // senkrechte Anschlüsse
const pinsV = [[0, -10, '1'], [0, 10, '2']];
const pinsH = [[-10, 0, '1'], [10, 0, '2']];

const NO = [['l', 0, -10, 0, -5], ['l', 0, 10, 0, 5], ['l', 0, 5, -4.5, -5.5]];
const NC = [['l', 0, -10, 0, -5], ['l', 0, -5, 3.5, -5], ['l', 0, 10, 0, 5], ['l', 0, 5, 4.5, -6.5]];
const pushL = [['d', -2.3, 0, -9, 0], ['l', -9, -2.5, -9, 2.5], ['l', -9, -2.5, -10.5, -2.5], ['l', -9, 2.5, -10.5, 2.5]];

export const SYMBOLS = {
  // ---------- Passiv
  resistor: { name: 'Widerstand', cat: 'Passiv', prefix: 'R', val: '1 kΩ', pins: pinsH, ops: [['l', -10, 0, -6, 0], ['r', -6, -2, 12, 4], ['l', 6, 0, 10, 0]] },
  poti: { name: 'Potentiometer', cat: 'Passiv', prefix: 'R', val: '10 kΩ', pins: [[-10, 0, '1'], [10, 0, '3'], [0, -10, '2']],
    ops: [['l', -10, 0, -6, 0], ['r', -6, -2, 12, 4], ['l', 6, 0, 10, 0], ['l', 0, -10, 0, -4.2], ['p', [0, -2.2, -1.3, -4.4, 1.3, -4.4], true, true]] },
  capacitor: { name: 'Kondensator', cat: 'Passiv', prefix: 'C', val: '100 nF', pins: pinsH, ops: [['l', -10, 0, -1.5, 0], ['l', -1.5, -4, -1.5, 4], ['l', 1.5, -4, 1.5, 4], ['l', 1.5, 0, 10, 0]] },
  elko: { name: 'Elektrolytkondensator', cat: 'Passiv', prefix: 'C', val: '100 µF', pins: [[-10, 0, '+'], [10, 0, '−']],
    ops: [['l', -10, 0, -1.5, 0], ['l', -1.5, -4, -1.5, 4], ['r', 1, -4, 1.3, 8, true], ['l', 2.3, 0, 10, 0], ['t', -4.5, -4, '+', 3]] },
  inductor: { name: 'Spule / Drossel', cat: 'Passiv', prefix: 'L', val: '10 mH', pins: pinsH,
    ops: [['l', -10, 0, -8, 0], ['a', -6, 0, 2, 180, 360], ['a', -2, 0, 2, 180, 360], ['a', 2, 0, 2, 180, 360], ['a', 6, 0, 2, 180, 360], ['l', 8, 0, 10, 0]] },

  // ---------- Halbleiter
  diode: { name: 'Diode', cat: 'Halbleiter', prefix: 'V', val: '1N4007', pins: [[-10, 0, 'A'], [10, 0, 'K']],
    ops: [['l', -10, 0, -3, 0], ['p', [-3, -3.5, -3, 3.5, 3, 0], true, false], ['l', 3, -3.5, 3, 3.5], ['l', 3, 0, 10, 0]] },
  led: { name: 'Leuchtdiode (LED)', cat: 'Halbleiter', prefix: 'P', val: 'rot', pins: [[-10, 0, 'A'], [10, 0, 'K']],
    ops: [['l', -10, 0, -3, 0], ['p', [-3, -3.5, -3, 3.5, 3, 0], true, false], ['l', 3, -3.5, 3, 3.5], ['l', 3, 0, 10, 0], ...arrow(0, -4, 3, -7.5), ...arrow(2.8, -2.6, 5.8, -6.1)] },
  zener: { name: 'Z-Diode', cat: 'Halbleiter', prefix: 'V', val: '5,1 V', pins: [[-10, 0, 'A'], [10, 0, 'K']],
    ops: [['l', -10, 0, -3, 0], ['p', [-3, -3.5, -3, 3.5, 3, 0], true, false], ['p', [1.6, 4.3, 3, 3.5, 3, -3.5, 4.4, -4.3]], ['l', 3, 0, 10, 0]] },
  npn: { name: 'Transistor NPN', cat: 'Halbleiter', prefix: 'V', val: 'BC547', pins: [[-10, 0, 'B'], [5, -10, 'C'], [5, 10, 'E']],
    ops: [['c', 1.5, 0, 6.5], ['l', -10, 0, -2, 0], ['l', -2, -4, -2, 4], ['l', -2, -2, 5, -6], ['l', 5, -6, 5, -10], ['l', 5, 6, 5, 10], ...arrow(-2, 2, 5, 6)] },
  pnp: { name: 'Transistor PNP', cat: 'Halbleiter', prefix: 'V', val: 'BC557', pins: [[-10, 0, 'B'], [5, -10, 'E'], [5, 10, 'C']],
    ops: [['c', 1.5, 0, 6.5], ['l', -10, 0, -2, 0], ['l', -2, -4, -2, 4], ['l', 5, -10, 5, -6], ...arrow(5, -6, -1.6, -2.2), ['l', -2, 2, 5, 6], ['l', 5, 6, 5, 10]] },
  nmos: { name: 'MOSFET N-Kanal', cat: 'Halbleiter', prefix: 'V', val: 'IRLZ44N', pins: [[-10, 0, 'G'], [5, -10, 'D'], [5, 10, 'S']],
    ops: [['l', -10, 0, -3, 0], ['l', -3, -4, -3, 4], ['l', -1.5, -5, -1.5, -2.5], ['l', -1.5, -1, -1.5, 1], ['l', -1.5, 2.5, -1.5, 5],
      ['l', -1.5, -4, 5, -4], ['l', 5, -4, 5, -10], ['l', -1.5, 4, 5, 4], ['l', 5, 4, 5, 10], ['l', 5, 0, 5, 4], ...arrow(5, 0, -1.3, 0)] },
  opamp: { name: 'Operationsverstärker', cat: 'Halbleiter', prefix: 'N', val: 'LM358', pins: [[-15, -5, '−'], [-15, 5, '+'], [15, 0, 'A']],
    ops: [['p', [-10, -10, -10, 10, 10, 0], true, false], ['l', -15, -5, -10, -5], ['l', -15, 5, -10, 5], ['l', 10, 0, 15, 0], ['t', -7.5, -5, '−', 3.5], ['t', -7.5, 5, '+', 3.5]] },

  // ---------- Quellen & Erde
  battery: { name: 'Batterie / Akku', cat: 'Quellen & Erde', prefix: 'G', val: '9 V', pins: [[0, -10, '+'], [0, 10, '−']],
    ops: [['l', 0, -10, 0, -1.5], ['l', -5, -1.5, 5, -1.5], ['l', -2.5, 1.5, 2.5, 1.5], ['l', 0, 1.5, 0, 10], ['t', 4, -4.5, '+', 3]] },
  dcsource: { name: 'Gleichspannungsquelle', cat: 'Quellen & Erde', prefix: 'G', val: '24 V DC', pins: [[0, -10, '+'], [0, 10, '−']],
    ops: [['l', 0, -10, 0, -6], ['c', 0, 0, 6], ['l', 0, 6, 0, 10], ['l', -3, -1, 3, -1], ['l', -3, 1.3, 3, 1.3], ['t', 4.5, -7, '+', 3]] },
  acsource: { name: 'Wechselspannungsquelle', cat: 'Quellen & Erde', prefix: 'G', val: '230 V AC', pins: [[0, -10, '1'], [0, 10, '2']],
    ops: [['l', 0, -10, 0, -6], ['c', 0, 0, 6], ['l', 0, 6, 0, 10], ['a', -1.5, 0, 1.5, 180, 360], ['a', 1.5, 0, 1.5, 0, 180]] },
  gnd: { name: 'Masse (0 V)', cat: 'Quellen & Erde', prefix: '', val: '', kind: 'gnd', net: 'GND', pins: [[0, -5, '']],
    ops: [['l', 0, -5, 0, 0], ['l', -5, 0, 5, 0], ['l', -3, 1.6, 3, 1.6], ['l', -1.2, 3.2, 1.2, 3.2]] },
  pe: { name: 'Schutzleiter (PE)', cat: 'Quellen & Erde', prefix: '', val: '', kind: 'gnd', net: 'PE', pins: [[0, -10, '']],
    ops: [['l', 0, -10, 0, -1], ['c', 0, 1.2, 5.5], ['l', -3.5, -1, 3.5, -1], ['l', -2.2, 1, 2.2, 1], ['l', -1, 3, 1, 3]] },

  // ---------- Kontakte & Schalter
  no: { name: 'Schließer', cat: 'Kontakte & Schalter', prefix: 'K', val: '', kind: 'no', pins: pinsV, ops: NO },
  nc: { name: 'Öffner', cat: 'Kontakte & Schalter', prefix: 'K', val: '', kind: 'nc', pins: pinsV, ops: NC },
  co: { name: 'Wechsler', cat: 'Kontakte & Schalter', prefix: 'K', val: '', kind: 'co', pins: [[0, 10, 'C'], [5, -10, 'Ö'], [-5, -10, 'S']],
    ops: [['l', 0, 10, 0, 5], ['l', 5, -10, 5, -5], ['l', 5, -5, 2, -5], ['l', -5, -10, -5, -5], ['l', 0, 5, 3, -6.5]] },
  pb_no: { name: 'Taster (Schließer)', cat: 'Kontakte & Schalter', prefix: 'S', val: '', kind: 'no', own: true, pins: pinsV, ops: [...NO, ...pushL] },
  pb_nc: { name: 'Taster (Öffner)', cat: 'Kontakte & Schalter', prefix: 'S', val: '', kind: 'nc', own: true, pins: pinsV,
    ops: [...NC, ['d', 2.4, -0.8, -9, -0.8], ['l', -9, -3.3, -9, 1.7], ['l', -9, -3.3, -10.5, -3.3], ['l', -9, 1.7, -10.5, 1.7]] },
  switch: { name: 'Schalter (rastend)', cat: 'Kontakte & Schalter', prefix: 'S', val: '', kind: 'no', own: true, pins: pinsV,
    ops: [...NO, ['d', -2.3, 0, -9, 0], ['l', -9, -2.5, -9, 2.5], ['l', -9, -2.5, -7.5, -4], ['l', -9, 2.5, -10.5, 4]] },
  breaker: { name: 'Leitungsschutzschalter', cat: 'Kontakte & Schalter', prefix: 'F', val: 'B16', kind: 'no', own: true, pins: pinsV,
    ops: [...NO, ['l', -1.4, -6.4, 1.4, -3.6], ['l', -1.4, -3.6, 1.4, -6.4], ['r', -9, -2, 4, 4], ['d', -5, 0, -2.4, 0]] },
  main: { name: 'Hauptkontakt (Schütz)', cat: 'Kontakte & Schalter', prefix: 'Q', val: '', kind: 'no', pins: pinsV,
    ops: [...NO, ['a', 0, -6.5, 1.5, 0, 180]] },

  // ---------- Relais & Schutz
  coil: { name: 'Relais-/Schützspule', cat: 'Relais & Schutz', prefix: 'K', val: '24 V DC', kind: 'coil', pins: [[0, -10, 'A1'], [0, 10, 'A2']],
    ops: [['l', 0, -10, 0, -3.5], ['r', -6, -3.5, 12, 7], ['l', 0, 3.5, 0, 10]] },
  coil_on: { name: 'Zeitrelais (anzugverzögert)', cat: 'Relais & Schutz', prefix: 'K', val: '5 s', kind: 'coil', pins: [[0, -10, 'A1'], [0, 10, 'A2']],
    ops: [['l', 0, -10, 0, -3.5], ['r', -6, -3.5, 12, 7], ['r', -6, -3.5, 3.5, 7, false], ['l', -6, -3.5, -2.5, 3.5], ['l', -6, 3.5, -2.5, -3.5], ['l', 0, 3.5, 0, 10]] },
  overload: { name: 'Motorschutz (thermisch)', cat: 'Relais & Schutz', prefix: 'F', val: '', pins: pinsV,
    ops: [['l', 0, -10, 0, -6], ['r', -4, -6, 8, 12], ['p', [0, -6, 0, -2.5, 2.5, -2.5, 2.5, 2.5, 0, 2.5, 0, 6]], ['l', 0, 6, 0, 10]] },
  fuse: { name: 'Sicherung', cat: 'Relais & Schutz', prefix: 'F', val: '10 A', pins: pinsV, ops: [['l', 0, -10, 0, 10], ['r', -2.5, -6, 5, 12]] },

  // ---------- Verbraucher & Melder
  lamp: { name: 'Leuchte / Meldeleuchte', cat: 'Verbraucher & Melder', prefix: 'P', val: '', pins: pinsV,
    ops: [...V(10), ['c', 0, 0, 5], ['l', -3.5, -3.5, 3.5, 3.5], ['l', -3.5, 3.5, 3.5, -3.5]] },
  motor: { name: 'Motor', cat: 'Verbraucher & Melder', prefix: 'M', val: '230 V', pins: pinsV, ops: [['l', 0, -10, 0, -7], ['c', 0, 0, 7], ['l', 0, 7, 0, 10], ['t', 0, 0, 'M', 5.5]] },
  motor3: { name: 'Drehstrommotor', cat: 'Verbraucher & Melder', prefix: 'M', val: '400 V', pins: [[-5, -10, 'U'], [0, -10, 'V'], [5, -10, 'W']],
    ops: [['l', -5, -10, -4.2, -4.4], ['l', 0, -10, 0, -5], ['l', 5, -10, 4.2, -4.4], ['c', 0, 2, 7], ['t', 0, 0.6, 'M', 5], ['t', 0, 5.4, '3~', 3]] },
  buzzer: { name: 'Summer / Hupe', cat: 'Verbraucher & Melder', prefix: 'P', val: '', pins: pinsV, ops: [['l', 0, -10, 0, -3], ['a', 0, 2, 5, 180, 360], ['l', -5, 2, 5, 2], ['l', 0, 2, 0, 10]] },
  transformer: { name: 'Transformator', cat: 'Verbraucher & Melder', prefix: 'T', val: '230/24 V', pins: [[-5, -15, '1'], [5, -15, '2'], [-5, 15, '3'], [5, 15, '4']],
    ops: [['c', 0, -3.5, 6], ['c', 0, 3.5, 6], ['l', -5, -15, -3, -8.7], ['l', 5, -15, 3, -8.7], ['l', -5, 15, -3, 8.7], ['l', 5, 15, 3, 8.7]] },
  voltmeter: { name: 'Spannungsmesser', cat: 'Verbraucher & Melder', prefix: 'P', val: '', pins: pinsV, ops: [['l', 0, -10, 0, -6], ['c', 0, 0, 6], ['l', 0, 6, 0, 10], ['t', 0, 0, 'V', 5]] },
  ammeter: { name: 'Strommesser', cat: 'Verbraucher & Melder', prefix: 'P', val: '', pins: pinsV, ops: [['l', 0, -10, 0, -6], ['c', 0, 0, 6], ['l', 0, 6, 0, 10], ['t', 0, 0, 'A', 5]] },
  heater: { name: 'Heizung', cat: 'Verbraucher & Melder', prefix: 'E', val: '2 kW', pins: pinsV, ops: [['l', 0, -10, 0, -6], ['r', -3, -6, 6, 12], ['l', -3, -2, 3, -2], ['l', -3, 2, 3, 2], ['l', 0, 6, 0, 10]] },

  // ---------- Verbindungen
  terminal: { name: 'Klemme', cat: 'Verbindungen', prefix: 'X', val: '', pins: [[0, -5, '1'], [0, 5, '2']], ops: [['l', 0, -5, 0, -1.5], ['c', 0, 0, 1.5], ['l', 0, 1.5, 0, 5]] },
  net: { name: 'Potential / Netzname', cat: 'Verbindungen', prefix: '', val: '', kind: 'net', pins: [[0, 0, '']], ops: [['c', 0, 0, 0.8, true]] },
  sensor: { name: 'Sensor / Näherungsschalter', cat: 'Verbindungen', prefix: 'B', val: '', pins: pinsV,
    ops: [['l', 0, -10, 0, -5], ['r', -5, -5, 10, 10], ['p', [0, -3, 3, 0, 0, 3, -3, 0], true, false], ['l', 0, 5, 0, 10]] },
  block: { name: 'Baugruppe (allgemein)', cat: 'Verbindungen', prefix: 'A', val: 'Steuerung', pins: [[-15, -5, '1'], [-15, 5, '2'], [15, -5, '3'], [15, 5, '4']],
    ops: [['r', -10, -10, 20, 20], ['l', -15, -5, -10, -5], ['l', -15, 5, -10, 5], ['l', 10, -5, 15, -5], ['l', 10, 5, 15, 5]] },
};

export const CATEGORIES = ['Kontakte & Schalter', 'Relais & Schutz', 'Verbraucher & Melder', 'Quellen & Erde', 'Verbindungen', 'Passiv', 'Halbleiter'];

/** Punkt eines Bauteils in Blattkoordinaten (Drehung in 90°-Schritten, Spiegeln an der senkrechten Achse). */
export function xf(part, x, y) {
  if (part.mir) x = -x;
  for (let i = 0; i < (part.rot || 0) % 4; i++) { const t = x; x = -y; y = t; }
  return [part.x + x, part.y + y];
}

export function partPins(part) {
  const sym = SYMBOLS[part.type];
  if (!sym) return [];
  return sym.pins.map(([x, y, name], i) => { const [px, py] = xf(part, x, y); return { x: px, y: py, name, i }; });
}

/** Umriss in Blattkoordinaten. */
export function partBox(part) {
  const sym = SYMBOLS[part.type];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { const [a, b] = xf(part, x, y); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); };
  for (const op of sym.ops) {
    if (op[0] === 'l' || op[0] === 'd') { add(op[1], op[2]); add(op[3], op[4]); }
    else if (op[0] === 'r') { add(op[1], op[2]); add(op[1] + op[3], op[2] + op[4]); }
    else if (op[0] === 'c' || op[0] === 'a') { add(op[1] - op[3], op[2] - op[3]); add(op[1] + op[3], op[2] + op[3]); }
    else if (op[0] === 'p') for (let i = 0; i < op[1].length; i += 2) add(op[1][i], op[1][i + 1]);
    else if (op[0] === 't') add(op[1], op[2]);
  }
  if (sym.kind === 'net') { x1 = Math.max(x1, part.x + 4 + (part.ref || '').length * 2.2); y0 = Math.min(y0, part.y - 3); }
  return { x0, y0, x1, y1 };
}

/** Senkrechter Strompfad (Anschlüsse oben/unten) → Beschriftung rechts daneben. */
export function isVertical(part) {
  const p = partPins(part);
  if (p.length < 2) return false;
  return Math.abs(p[0].x - p[p.length - 1].x) < Math.abs(p[0].y - p[p.length - 1].y);
}

/** Zeichnet ein Bauteil mit einem „Stift“ (Canvas oder SVG). */
export function drawSymbol(pen, part, color) {
  const sym = SYMBOLS[part.type];
  if (!sym) return;
  const T = (x, y) => xf(part, x, y);
  for (const op of sym.ops) {
    switch (op[0]) {
      case 'l': pen.line(...T(op[1], op[2]), ...T(op[3], op[4]), color); break;
      case 'd': pen.line(...T(op[1], op[2]), ...T(op[3], op[4]), color, true); break;
      case 'r': {
        const pts = [...T(op[1], op[2]), ...T(op[1] + op[3], op[2]), ...T(op[1] + op[3], op[2] + op[4]), ...T(op[1], op[2] + op[4])];
        pen.poly(pts, true, op[5] ? color : null, color);
        break;
      }
      case 'c': pen.circle(...T(op[1], op[2]), op[3], op[4] ? color : null, color); break;
      case 'a': {
        const pts = [];
        const n = 12;
        for (let i = 0; i <= n; i++) {
          const a = ((op[4] + ((op[5] - op[4]) * i) / n) * Math.PI) / 180;
          pts.push(...T(op[1] + Math.cos(a) * op[3], op[2] + Math.sin(a) * op[3]));
        }
        pen.poly(pts, false, null, color);
        break;
      }
      case 'p': {
        const pts = [];
        for (let i = 0; i < op[1].length; i += 2) pts.push(...T(op[1][i], op[1][i + 1]));
        pen.poly(pts, !!op[2], op[3] ? color : null, color);
        break;
      }
      case 't': pen.text(...T(op[1], op[2]), op[3], op[4] || 3, 'center', color, 'middle'); break;
      default: break;
    }
  }
}
