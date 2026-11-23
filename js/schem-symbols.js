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

// ---------------------------------------------------------------- Erweiterung (Fachkunde-Elektrotechnik-Umfang)
const pinsV15 = [[0, -15, '1'], [0, 15, '2']];
Object.assign(SYMBOLS, {
  estop: { name: 'Not-Halt (Pilztaster)', cat: 'Kontakte & Schalter', prefix: 'S', val: '', kind: 'nc', own: true, pins: pinsV,
    ops: [...NC, ['d', 2.4, -0.8, -8, -0.8], ['a', -9.5, -0.8, 2.6, 90, 270], ['l', -9.5, -3.4, -9.5, 1.8]] },
  limit: { name: 'Positionsschalter (Endschalter)', cat: 'Kontakte & Schalter', prefix: 'B', val: '', kind: 'no', own: true, pins: pinsV,
    ops: [...NO, ['d', -2.3, 0, -7, 0], ['p', [-7, -2.5, -10, 0, -7, 2.5], true, false]] },
  pressure: { name: 'Druckschalter', cat: 'Kontakte & Schalter', prefix: 'B', val: 'p', kind: 'no', own: true, pins: pinsV,
    ops: [...NO, ['d', -2.3, 0, -7, 0], ['r', -11, -2.5, 4, 5], ['t', -9, 0, 'p', 2.6]] },
  thermo: { name: 'Temperaturschalter (Thermostat)', cat: 'Kontakte & Schalter', prefix: 'B', val: 'ϑ', kind: 'nc', own: true, pins: pinsV,
    ops: [...NC, ['d', 2.4, -0.8, -7, -0.8], ['r', -11, -3.3, 4, 5], ['t', -9, -0.8, 'ϑ', 2.8]] },
  float: { name: 'Schwimmerschalter', cat: 'Kontakte & Schalter', prefix: 'B', val: '', kind: 'no', own: true, pins: pinsV,
    ops: [...NO, ['d', -2.3, 0, -7, 0], ['c', -9.5, 0, 2.5]] },
  main3: { name: 'Hauptkontakte 3-polig (Schütz)', cat: 'Kontakte & Schalter', prefix: 'Q', val: '', kind: 'no', pins: [[-5, -10, '1'], [-5, 10, '2'], [0, -10, '3'], [0, 10, '4'], [5, -10, '5'], [5, 10, '6']],
    ops: [-5, 0, 5].flatMap((x) => [['l', x, -10, x, -5], ['l', x, 10, x, 5], ['l', x, 5, x - 3.5, -5.5], ['a', x, -6.5, 1.3, 0, 180]]).concat([['d', -6.8, 0, 3.2, 0]]) },
  mpcb: { name: 'Motorschutzschalter 3-polig', cat: 'Relais & Schutz', prefix: 'Q', val: '', pins: [[-5, -10, '1'], [-5, 10, '2'], [0, -10, '3'], [0, 10, '4'], [5, -10, '5'], [5, 10, '6']],
    ops: [-5, 0, 5].flatMap((x) => [['l', x, -10, x, -5], ['l', x, 10, x, 5], ['l', x, 5, x - 3.5, -5.5], ['l', x - 1.2, -6.2, x + 1.2, -3.8], ['l', x - 1.2, -3.8, x + 1.2, -6.2]]).concat([['d', -6.8, 0, 3.2, 0], ['r', 8, -3, 5, 6], ['t', 10.5, 0, 'I>', 2.2]]) },
  rcd: { name: 'Fehlerstromschutzschalter (RCD)', cat: 'Relais & Schutz', prefix: 'F', val: '30 mA', pins: [[-5, -15, 'L'], [-5, 15, 'L'], [5, -15, 'N'], [5, 15, 'N']],
    ops: [-5, 5].flatMap((x) => [['l', x, -15, x, -5], ['l', x, 15, x, 5], ['l', x, 5, x - 3.5, -5.5]]).concat([['d', -6.8, 0, 2.6, 0], ['c', 0, 10, 3], ['t', 0, 10, 'IΔ', 2.2]]) },
  coil_off: { name: 'Zeitrelais (abfallverzögert)', cat: 'Relais & Schutz', prefix: 'K', val: '5 s', kind: 'coil', pins: [[0, -10, 'A1'], [0, 10, 'A2']],
    ops: [['l', 0, -10, 0, -3.5], ['r', -6, -3.5, 12, 7], ['r', -6, -3.5, 3.5, 7, true], ['l', 0, 3.5, 0, 10]] },
  impulse: { name: 'Stromstoßschalter (Spule)', cat: 'Relais & Schutz', prefix: 'K', val: '', kind: 'coil', pins: [[0, -10, 'A1'], [0, 10, 'A2']],
    ops: [['l', 0, -10, 0, -3.5], ['r', -6, -3.5, 12, 7], ['l', -3, 3.5, -3, -1], ['l', -3, -1, 3, -1], ['l', 3, -1, 3, 3.5], ['l', 0, 3.5, 0, 10]] },
  staircase: { name: 'Treppenlichtzeitschalter', cat: 'Relais & Schutz', prefix: 'K', val: '3 min', kind: 'coil', pins: [[0, -10, 'A1'], [0, 10, 'A2']],
    ops: [['l', 0, -10, 0, -3.5], ['r', -6, -3.5, 12, 7], ['c', 0, 0, 2.4], ['l', 0, 0, 0, -1.6], ['l', 0, 0, 1.2, 0.6], ['l', 0, 3.5, 0, 10]] },
  surge: { name: 'Überspannungsschutz', cat: 'Relais & Schutz', prefix: 'F', val: '', pins: pinsV,
    ops: [['l', 0, -10, 0, -5], ['r', -3, -5, 6, 10], ['p', [0, -5, 0, -1, -1.5, 1, 1.5, -1, 0, 1, 0, 5]], ['l', 0, 5, 0, 10]] },
  meter: { name: 'Elektrizitätszähler (kWh)', cat: 'Verbraucher & Melder', prefix: 'P', val: 'kWh', pins: pinsV, ops: [['l', 0, -10, 0, -5], ['r', -6, -5, 12, 10], ['l', -6, -1.5, 6, -1.5], ['t', 0, 1.8, 'Wh', 2.8], ['l', 0, 5, 0, 10]] },
  bell: { name: 'Klingel / Wecker', cat: 'Verbraucher & Melder', prefix: 'P', val: '', pins: pinsV, ops: [['l', 0, -10, 0, -3], ['a', 0, 1.5, 4.5, 180, 360], ['l', -4.5, 1.5, 4.5, 1.5], ['l', 0, 1.5, 0, 10], ['l', -1, -3, 1, -3]] },
  gong: { name: 'Gong', cat: 'Verbraucher & Melder', prefix: 'P', val: '', pins: pinsV, ops: [['l', 0, -10, 0, -4.5], ['a', 0, 0, 4.5, 180, 360], ['l', -4.5, 0, 4.5, 0], ['l', -2.5, 2, 2.5, 2], ['l', 0, 0, 0, 10]] },
  speaker: { name: 'Lautsprecher', cat: 'Verbraucher & Melder', prefix: 'B', val: '8 Ω', pins: [[-2.5, -10, '1'], [-2.5, 10, '2']],
    ops: [['l', -2.5, -10, -2.5, -3], ['l', -2.5, 3, -2.5, 10], ['r', -4.5, -3, 3, 6], ['p', [-1.5, -3, 3, -6.5, 3, 6.5, -1.5, 3]]] },
  fluor: { name: 'Leuchtstofflampe', cat: 'Verbraucher & Melder', prefix: 'E', val: '', pins: pinsV, ops: [['l', 0, -10, 0, -8], ['l', 0, 8, 0, 10], ['l', -1.5, -8, 1.5, -8], ['l', -1.5, 8, 1.5, 8], ['l', -1.5, -8, -1.5, 8], ['l', 1.5, -8, 1.5, 8]] },
  generator: { name: 'Generator', cat: 'Quellen & Erde', prefix: 'G', val: '', pins: pinsV, ops: [['l', 0, -10, 0, -7], ['c', 0, 0, 7], ['l', 0, 7, 0, 10], ['t', 0, 0, 'G', 5.5]] },
  solar: { name: 'Solarzelle / PV-Modul', cat: 'Quellen & Erde', prefix: 'G', val: '', pins: [[0, -10, '+'], [0, 10, '−']],
    ops: [['l', 0, -10, 0, -1.5], ['l', -5, -1.5, 5, -1.5], ['l', -2.5, 1.5, 2.5, 1.5], ['l', 0, 1.5, 0, 10], ...arrow(-9, -8, -5.5, -4.5), ...arrow(-9, -4, -5.5, -0.5)] },
  ptc: { name: 'Kaltleiter (PTC)', cat: 'Passiv', prefix: 'R', val: '', pins: pinsH, ops: [['l', -10, 0, -6, 0], ['r', -6, -2, 12, 4], ['l', 6, 0, 10, 0], ['p', [-7, 5, -4, 5, 6, -5]], ['t', 7.5, 4.5, '+ϑ', 2.4]] },
  ntc: { name: 'Heißleiter (NTC)', cat: 'Passiv', prefix: 'R', val: '', pins: pinsH, ops: [['l', -10, 0, -6, 0], ['r', -6, -2, 12, 4], ['l', 6, 0, 10, 0], ['p', [-7, 5, -4, 5, 6, -5]], ['t', 7.5, 4.5, '−ϑ', 2.4]] },
  ldr: { name: 'Fotowiderstand (LDR)', cat: 'Passiv', prefix: 'R', val: '', pins: pinsH, ops: [['l', -10, 0, -6, 0], ['r', -6, -2, 12, 4], ['l', 6, 0, 10, 0], ...arrow(-5, -8, -2, -3), ...arrow(-1, -8, 2, -3)] },
  varcap: { name: 'Drehkondensator', cat: 'Passiv', prefix: 'C', val: '', pins: pinsH, ops: [['l', -10, 0, -1.5, 0], ['l', -1.5, -4, -1.5, 4], ['l', 1.5, -4, 1.5, 4], ['l', 1.5, 0, 10, 0], ...arrow(-5, 5, 5, -5)] },
  photodiode: { name: 'Fotodiode', cat: 'Halbleiter', prefix: 'V', val: '', pins: [[-10, 0, 'A'], [10, 0, 'K']],
    ops: [['l', -10, 0, -3, 0], ['p', [-3, -3.5, -3, 3.5, 3, 0], true, false], ['l', 3, -3.5, 3, 3.5], ['l', 3, 0, 10, 0], ...arrow(4, -8, 1, -4.5), ...arrow(7, -6.5, 4, -3)] },
  thyristor: { name: 'Thyristor', cat: 'Halbleiter', prefix: 'V', val: '', pins: [[-10, 0, 'A'], [10, 0, 'K'], [5, 10, 'G']],
    ops: [['l', -10, 0, -3, 0], ['p', [-3, -3.5, -3, 3.5, 3, 0], true, false], ['l', 3, -3.5, 3, 3.5], ['l', 3, 0, 10, 0], ['l', 3, 2, 5, 5], ['l', 5, 5, 5, 10]] },
  triac: { name: 'Triac', cat: 'Halbleiter', prefix: 'V', val: '', pins: [[0, -10, 'A1'], [0, 10, 'A2'], [-10, 5, 'G']],
    ops: [['l', 0, -10, 0, -4], ['l', 0, 4, 0, 10], ['l', -5, -4, 5, -4], ['l', -5, 4, 5, 4], ['p', [-5, -4, -2.5, 4, 0, -4], true, false], ['p', [0, 4, 2.5, -4, 5, 4], true, false], ['l', -2.5, 3, -6, 5], ['l', -6, 5, -10, 5]] },
  diac: { name: 'Diac', cat: 'Halbleiter', prefix: 'V', val: '', pins: pinsV,
    ops: [['l', 0, -10, 0, -4], ['l', 0, 4, 0, 10], ['l', -5, -4, 5, -4], ['l', -5, 4, 5, 4], ['p', [-5, -4, -2.5, 4, 0, -4], true, false], ['p', [0, 4, 2.5, -4, 5, 4], true, false]] },
  bridge: { name: 'Brückengleichrichter', cat: 'Halbleiter', prefix: 'V', val: '', pins: [[0, -15, '~'], [0, 15, '~'], [-15, 0, '−'], [15, 0, '+']],
    ops: [['p', [0, -10, 10, 0, 0, 10, -10, 0], true, false], ['l', 0, -15, 0, -10], ['l', 0, 15, 0, 10], ['l', -15, 0, -10, 0], ['l', 15, 0, 10, 0], ['p', [-6, -2, -2, -6, -3, -1], true, true], ['p', [2, -6, 6, -2, 1, -3], true, true], ['p', [-6, 2, -2, 6, -1, 3], true, true], ['p', [2, 6, 6, 2, 3, 1], true, true]] },
  opto: { name: 'Optokoppler', cat: 'Halbleiter', prefix: 'U', val: '', pins: [[-15, -5, 'A'], [-15, 5, 'K'], [15, -5, 'C'], [15, 5, 'E']],
    ops: [['r', -10, -10, 20, 20], ['l', -15, -5, -6, -5], ['l', -15, 5, -6, 5], ['l', -6, -5, -6, -2], ['l', -6, 5, -6, 2], ['p', [-8.5, -2, -3.5, -2, -6, 2], true, false], ['l', -8.5, 2, -3.5, 2], ...arrow(-2, 0, 2, 0),
      ['l', 4, -3, 4, 3], ['l', 4, -1, 9, -5], ['l', 9, -5, 15, -5], ['l', 4, 1, 9, 5], ['l', 9, 5, 15, 5]] },
  plc_in: { name: 'SPS-Eingang', cat: 'Verbindungen', prefix: 'A', val: 'E0.0', pins: [[0, -10, 'I']], ops: [['l', 0, -10, 0, -4], ['r', -6, -4, 12, 7], ['t', 0, -0.5, 'E', 3]] },
  plc_out: { name: 'SPS-Ausgang', cat: 'Verbindungen', prefix: 'A', val: 'A0.0', pins: [[0, 10, 'Q']], ops: [['r', -6, -3, 12, 7], ['l', 0, 4, 0, 10], ['t', 0, 0.5, 'A', 3]] },
  plug: { name: 'Steckverbindung', cat: 'Verbindungen', prefix: 'X', val: '', pins: pinsV, ops: [['l', 0, -10, 0, -2], ['p', [-2, -2, 0, 0.5, 2, -2]], ['a', 0, 2.5, 2.2, 180, 360], ['l', 0, 2.5, 0, 10]] },
  ...installSymbols(),
});

/** Symbole für Installationspläne (Grundriss, nach DIN EN 60617-11). Anschluss in der Mitte. */
function installSymbols() {
  const I = 'Installation';
  const R = 'Installation – Raum';
  const c0 = [[0, 0, '']];
  const sw = (ops) => [['c', 0, 0, 1.6, 'w'], ...ops];
  const box = (t, w = 9, h = 6) => [['r', -w / 2, -h / 2, w, h, 'w'], ['t', 0, 0, t, 2.6]];
  return {
    i_socket: { name: 'Schutzkontaktsteckdose', cat: I, prefix: 'X', val: '', pins: c0, ops: [['a', 0, 0, 4, 180, 360], ['l', -4, 0, 4, 0], ['l', 0, -4, 0, -6]] },
    i_socket2: { name: 'Steckdose 2-fach', cat: I, prefix: 'X', val: '', pins: c0, ops: [['a', 0, 0, 4, 180, 360], ['l', -4, 0, 4, 0], ['l', 0, -4, 0, -6], ['t', 5.5, -3, '2', 2.6]] },
    i_socket3: { name: 'Steckdose 3-fach', cat: I, prefix: 'X', val: '', pins: c0, ops: [['a', 0, 0, 4, 180, 360], ['l', -4, 0, 4, 0], ['l', 0, -4, 0, -6], ['t', 5.5, -3, '3', 2.6]] },
    i_cee: { name: 'Drehstromsteckdose (CEE)', cat: I, prefix: 'X', val: '400 V', pins: c0, ops: [['a', 0, 0, 4, 180, 360], ['l', -4, 0, 4, 0], ['l', 0, -4, 0, -6], ['l', -2, -5, -1, -3], ['l', 1, -5, 2, -3], ['l', -0.5, -5.5, 0.5, -3.5]] },
    i_stove: { name: 'Herdanschlussdose', cat: I, prefix: 'X', val: '', pins: c0, ops: [['r', -4, -2.5, 8, 5, 'w'], ['l', -2.5, 1.5, -1, -1.5], ['l', -0.5, 1.5, 1, -1.5], ['l', 1.5, 1.5, 3, -1.5]] },
    i_off: { name: 'Ausschalter', cat: I, prefix: 'S', val: '', pins: c0, ops: sw([['l', 1.1, -1.1, 5, -5], ['l', 5, -5, 6.2, -3.8]]) },
    i_series: { name: 'Serienschalter', cat: I, prefix: 'S', val: '', pins: c0, ops: sw([['l', 1.1, -1.1, 5, -5], ['l', 5, -5, 6.2, -3.8], ['l', 3.5, -3.5, 4.7, -2.3]]) },
    i_twoway: { name: 'Wechselschalter', cat: I, prefix: 'S', val: '', pins: c0, ops: sw([['l', 1.1, -1.1, 5, -5], ['l', 5, -5, 6.2, -3.8], ['l', -1.1, 1.1, -5, 5], ['l', -5, 5, -6.2, 3.8]]) },
    i_cross: { name: 'Kreuzschalter', cat: I, prefix: 'S', val: '', pins: c0, ops: sw([['l', 1.1, -1.1, 5, -5], ['l', 5, -5, 6.2, -3.8], ['l', -1.1, 1.1, -5, 5], ['l', -5, 5, -6.2, 3.8], ['l', -1.1, -1.1, -5, -5], ['l', -5, -5, -3.8, -6.2], ['l', 1.1, 1.1, 5, 5], ['l', 5, 5, 3.8, 6.2]]) },
    i_button: { name: 'Taster', cat: I, prefix: 'S', val: '', pins: c0, ops: [['c', 0, 0, 2.2, 'w'], ['c', 0, 0, 0.8, true]] },
    i_dimmer: { name: 'Dimmer', cat: I, prefix: 'S', val: '', pins: c0, ops: sw([['l', 1.1, -1.1, 5, -5], ['l', 5, -5, 6.2, -3.8], ...arrow(-3, 3, 3, -3, 1.2)]) },
    i_motion: { name: 'Bewegungsmelder', cat: I, prefix: 'B', val: '', pins: c0, ops: [['a', 0, 0, 3.5, 180, 360], ['l', -3.5, 0, 3.5, 0], ['a', 0, 0, 5.5, 210, 330]] },
    i_lamp: { name: 'Leuchte (Decke)', cat: I, prefix: 'E', val: '', pins: c0, ops: [['c', 0, 0, 3.5, 'w'], ['l', -2.5, -2.5, 2.5, 2.5], ['l', -2.5, 2.5, 2.5, -2.5]] },
    i_wall: { name: 'Wandleuchte', cat: I, prefix: 'E', val: '', pins: c0, ops: [['c', 0, 0, 3.5, 'w'], ['l', -2.5, -2.5, 2.5, 2.5], ['l', -2.5, 2.5, 2.5, -2.5], ['l', -4.5, 4, 4.5, 4]] },
    i_fluor: { name: 'Leuchtstoffleuchte', cat: I, prefix: 'E', val: '', pins: c0, ops: [['r', -7, -1.2, 14, 2.4, 'w'], ['l', -7, -3, -7, 3], ['l', 7, -3, 7, 3]] },
    i_junction: { name: 'Abzweigdose', cat: I, prefix: 'X', val: '', pins: c0, ops: [['c', 0, 0, 1.8, 'w']] },
    i_dist: { name: 'Verteiler / Unterverteilung', cat: I, prefix: 'X', val: 'UV', pins: c0, ops: [['r', -6, -3, 12, 6, 'w'], ['p', [-6, -3, 6, -3, 6, 3], true, true]] },
    i_meter: { name: 'Zählerplatz', cat: I, prefix: 'P', val: '', pins: c0, ops: box('Wh') },
    i_smoke: { name: 'Rauchwarnmelder', cat: I, prefix: 'B', val: '', pins: c0, ops: [['r', -3.5, -3.5, 7, 7, 'w'], ['t', 0, 0, 'RM', 2.4]] },
    i_lan: { name: 'Netzwerkdose (LAN)', cat: I, prefix: 'X', val: '', pins: c0, ops: box('LAN', 10, 5) },
    i_tv: { name: 'Antennendose (TV/SAT)', cat: I, prefix: 'X', val: '', pins: c0, ops: [['c', 0, 0, 3.5, 'w'], ['t', 0, 0, 'TV', 2.2]] },
    i_phone: { name: 'Telefondose (TAE)', cat: I, prefix: 'X', val: '', pins: c0, ops: box('TAE', 10, 5) },
    i_bell: { name: 'Klingel', cat: I, prefix: 'P', val: '', pins: c0, ops: [['a', 0, 1, 3.5, 180, 360], ['l', -3.5, 1, 3.5, 1], ['l', 0, -2.5, 0, -4]] },
    i_door: { name: 'Türöffner', cat: I, prefix: 'Y', val: '', pins: c0, ops: [['r', -3, -3, 6, 6, 'w'], ['p', [-1.5, 1.5, -1.5, -1.5, 1.5, 1.5, 1.5, -1.5]]] },
    i_intercom: { name: 'Türsprechstelle', cat: I, prefix: 'P', val: '', pins: c0, ops: [['r', -3.5, -3.5, 7, 7, 'w'], ['c', 0, 0, 1.6]] },
    i_thermostat: { name: 'Raumthermostat', cat: I, prefix: 'B', val: '', pins: c0, ops: [['c', 0, 0, 3, 'w'], ['t', 0, 0, 'ϑ', 3]] },
    i_heater: { name: 'Heizgerät / Durchlauferhitzer', cat: I, prefix: 'E', val: '', pins: c0, ops: box('DLE', 10, 5) },
    i_washer: { name: 'Waschmaschine', cat: I, prefix: 'X', val: '', pins: c0, ops: [['r', -4, -4, 8, 8, 'w'], ['c', 0, 0, 2.5]] },
    i_fan: { name: 'Lüfter', cat: I, prefix: 'M', val: '', pins: c0, ops: [['c', 0, 0, 3.5, 'w'], ['p', [-2.5, -1.5, 0, 0, -2.5, 1.5], true, true], ['p', [2.5, -1.5, 0, 0, 2.5, 1.5], true, true]] },
    i_shutter: { name: 'Rollladenschalter', cat: I, prefix: 'S', val: '', pins: c0, ops: sw([['l', 1.1, -1.1, 5, -5], ...arrow(4, 0, 4, -4, 1), ...arrow(6, -4, 6, 0, 1)]) },
    r_door: { name: 'Tür', cat: R, prefix: '', val: '', kind: 'deco', pins: [], ops: [['l', -5, 0, -5, -10], ['a', -5, 0, 10, 270, 360], ['l', -6, 0, -4, 0], ['l', 4, 0, 6, 0]] },
    r_window: { name: 'Fenster', cat: R, prefix: '', val: '', kind: 'deco', pins: [], ops: [['r', -10, -1.2, 20, 2.4, 'w'], ['l', -10, 0, 10, 0]] },
    r_stairs: { name: 'Treppe', cat: R, prefix: '', val: '', kind: 'deco', pins: [], ops: [['r', -5, -10, 10, 20], ...[-6, -2, 2, 6].map((y) => ['l', -5, y, 5, y]), ...arrow(0, 8, 0, -8, 1.5)] },
    r_north: { name: 'Nordpfeil', cat: R, prefix: '', val: '', kind: 'deco', pins: [], ops: [['c', 0, 0, 5], ['p', [0, -5, 2, 2, 0, 0.5, -2, 2], true, true], ['t', 0, -7.5, 'N', 3]] },
  };
}

export const CATEGORIES = ['Eigene Bauteile', 'Kontakte & Schalter', 'Relais & Schutz', 'Verbraucher & Melder', 'Quellen & Erde', 'Verbindungen', 'Passiv', 'Halbleiter', 'Installation', 'Installation – Raum'];
export const INSTALL_CATEGORIES = ['Eigene Bauteile', 'Installation', 'Installation – Raum', 'Verbraucher & Melder', 'Relais & Schutz', 'Kontakte & Schalter', 'Verbindungen', 'Quellen & Erde', 'Passiv', 'Halbleiter'];

// ---------------------------------------------------------------- Eigene Bauteile
const CUSTOM = {};
export function getSym(type) { return SYMBOLS[type] || CUSTOM[type] || null; }
export function registerCustom(list) { for (const c of list || []) if (c && c.id) CUSTOM[c.id] = { ...c, cat: 'Eigene Bauteile', custom: true }; }
export function unregisterCustom(id) { delete CUSTOM[id]; }
export function allSymbols() { return { ...SYMBOLS, ...CUSTOM }; }

/** Punkt eines Bauteils in Blattkoordinaten (Drehung in 90°-Schritten, Spiegeln an der senkrechten Achse). */
export function xf(part, x, y) {
  if (part.mir) x = -x;
  for (let i = 0; i < (part.rot || 0) % 4; i++) { const t = x; x = -y; y = t; }
  return [part.x + x, part.y + y];
}

export function partPins(part) {
  const sym = getSym(part.type);
  if (!sym) return [];
  return sym.pins.map(([x, y, name], i) => { const [px, py] = xf(part, x, y); return { x: px, y: py, name, i }; });
}

/** Umriss in Blattkoordinaten. */
export function partBox(part) {
  const sym = getSym(part.type);
  if (!sym) return { x0: part.x - 5, y0: part.y - 5, x1: part.x + 5, y1: part.y + 5 };
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
  const sym = getSym(part.type);
  if (!sym) return;
  const T = (x, y) => xf(part, x, y);
  for (const op of sym.ops) {
    switch (op[0]) {
      case 'l': pen.line(...T(op[1], op[2]), ...T(op[3], op[4]), color); break;
      case 'd': pen.line(...T(op[1], op[2]), ...T(op[3], op[4]), color, true); break;
      case 'r': {
        const pts = [...T(op[1], op[2]), ...T(op[1] + op[3], op[2]), ...T(op[1] + op[3], op[2] + op[4]), ...T(op[1], op[2] + op[4])];
        pen.poly(pts, true, op[5] ? (op[5] === 'w' ? '#ffffff' : color) : null, color);
        break;
      }
      case 'c': pen.circle(...T(op[1], op[2]), op[3], op[4] ? (op[4] === 'w' ? '#ffffff' : color) : null, color); break;
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
        pen.poly(pts, !!op[2], op[3] ? (op[3] === 'w' ? '#ffffff' : color) : null, color);
        break;
      }
      case 't': pen.text(...T(op[1], op[2]), op[3], op[4] || 3, 'center', color, 'middle'); break;
      default: break;
    }
  }
}
