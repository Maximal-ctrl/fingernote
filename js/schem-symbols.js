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
  speaker: { name: 'Lautsprecher', cat: 'Verbraucher & Melder', prefix: 'B', val: '8 Ω', pins: [[0, -10, '1'], [0, 10, '2']],
    ops: [['l', 0, -10, 0, -3], ['l', 0, 3, 0, 10], ['r', -2, -3, 3, 6], ['p', [1, -3, 5.5, -6.5, 5.5, 6.5, 1, 3]]] },
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
  ...siemensSymbols(),
  ...cabinetSymbols(),
});

/** SPS-Baugruppe als Kasten mit Anschlüssen (Bezeichnungen nach Siemens-Klemmenbelegung). */
function plc(name, { w = 40, left = [], right = [], top = [], bottom = [], title = name, sub = '', cat = 'Siemens SPS', prefix = 'A', val = '' }) {
  const off = top.length ? 2 : 1; // Platz für die oberen Anschlussnamen
  const n = Math.max(left.length, right.length, 2) + off - 1;
  let h = (n + 1) * 5 + (bottom.length ? 5 : 0); if (h % 10) h += 5;
  const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
  const ops = [['r', x0, y0, w, h, '#f4f6f8'], ['b', x0 + 0.4, y0 + 0.4, w - 0.8, 3.2, '#009999']];
  const pins = [];
  left.forEach((t, i) => { const y = y0 + 5 * (i + off); pins.push([x0 - 5, y, t]); ops.push(['l', x0 - 5, y, x0, y], ['t', x0 + 1, y, t, 2, 'left']); });
  right.forEach((t, i) => { const y = y0 + 5 * (i + off); pins.push([x1 + 5, y, t]); ops.push(['l', x1, y, x1 + 5, y], ['t', x1 - 1, y, t, 2, 'right']); });
  top.forEach((t, i) => { const x = x0 + 5 * (i + 1) + (w > 20 ? 5 : 0); pins.push([x, y0 - 5, t]); ops.push(['l', x, y0 - 5, x, y0], ['t', x, y0 + 5.6, t, 1.9]); });
  bottom.forEach((t, i) => { const x = x0 + 5 * (i + 1) + (w > 20 ? 5 : 0); pins.push([x, y1 + 5, t]); ops.push(['l', x, y1, x, y1 + 5], ['t', x, y1 - 2, t, 1.9]); });
  ops.push(['t', 0, y1 - (bottom.length ? 6.5 : 4), title, 2.6], sub ? ['t', 0, y1 - (bottom.length ? 9.5 : 7), sub, 2] : null);
  return { name, cat, prefix, val, kind: 'plc', pins, ops: ops.filter(Boolean) };
}

function siemensSymbols() {
  const I = (p, a, b) => Array.from({ length: b - a + 1 }, (_, i) => `${p}${a + i}`);
  const B = (byte, n, p = 'I') => Array.from({ length: n }, (_, i) => `${p}${byte}.${i}`);
  const relQ = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => [`Q${a + i}.1`, `Q${a + i}.2`]).flat();
  return {
    logo_24: plc('LOGO! 12/24 RCE', { w: 40, top: ['L+', 'M'], left: I('I', 1, 8), right: relQ(1, 4), title: 'LOGO! 12/24RCE', val: '6ED1052-1MD08-0BA1' }),
    logo_230: plc('LOGO! 230 RCE', { w: 40, top: ['L1', 'N'], left: I('I', 1, 8), right: relQ(1, 4), title: 'LOGO! 230RCE', val: '6ED1052-1FB08-0BA1' }),
    logo_dm8: plc('LOGO! DM8 24R (Erweiterung)', { w: 30, top: ['L+', 'M'], left: I('I', 9, 12), right: relQ(5, 8), title: 'LOGO! DM8' }),
    logo_am2: plc('LOGO! AM2 (Analog)', { w: 30, top: ['L+', 'M'], left: ['M1', 'I1', 'U1', 'M2', 'I2', 'U2'], title: 'LOGO! AM2' }),
    s7_1214: plc('S7-1200 CPU 1214C DC/DC/DC', { w: 50, top: ['L+', 'M', 'PE'], left: ['1M', ...B(0, 8), ...B(1, 6)], right: ['3L+', '3M', ...B(0, 8, 'Q'), ...B(1, 2, 'Q')], bottom: ['2M', 'AI0', 'AI1'], title: 'CPU 1214C', sub: 'DC/DC/DC', val: '6ES7214-1AG40-0XB0' }),
    s7_1212: plc('S7-1200 CPU 1212C DC/DC/DC', { w: 40, top: ['L+', 'M', 'PE'], left: ['1M', ...B(0, 8)], right: ['3L+', '3M', ...B(0, 6, 'Q')], bottom: ['2M', 'AI0', 'AI1'], title: 'CPU 1212C', sub: 'DC/DC/DC' }),
    s7_sm1221: plc('S7-1200 SM 1221 DI 8', { w: 30, left: ['1M', ...B(2, 8)], title: 'SM 1221', sub: 'DI 8×24VDC', val: '6ES7221-1BF32-0XB0' }),
    s7_sm1222: plc('S7-1200 SM 1222 DQ 8 Relais', { w: 30, right: ['1L', ...B(2, 4, 'Q'), '2L', ...['Q2.4', 'Q2.5', 'Q2.6', 'Q2.7']], title: 'SM 1222', sub: 'DQ 8×Relais', val: '6ES7222-1HF32-0XB0' }),
    s7_sm1231: plc('S7-1200 SM 1231 AI 4', { w: 30, top: ['L+', 'M'], left: ['0+', '0−', '1+', '1−', '2+', '2−', '3+', '3−'], title: 'SM 1231', sub: 'AI 4' }),
    s7_sm1232: plc('S7-1200 SM 1232 AQ 2', { w: 30, top: ['L+', 'M'], right: ['0M', '0', '1M', '1'], title: 'SM 1232', sub: 'AQ 2' }),
    s7_1511: plc('S7-1500 CPU 1511-1 PN', { w: 30, top: ['L+', 'M'], right: ['X1 P1', 'X1 P2'], title: 'CPU 1511-1', sub: 'PN', val: '6ES7511-1AK02-0AB0' }),
    s7_di16: plc('S7-1500 DI 16×24VDC', { w: 30, top: ['L+', 'M'], left: Array.from({ length: 16 }, (_, i) => `DI${i}`), title: 'DI 16', sub: '24VDC' }),
    s7_dq16: plc('S7-1500 DQ 16×24VDC/0,5A', { w: 30, top: ['L+', 'M'], right: Array.from({ length: 16 }, (_, i) => `DQ${i}`), title: 'DQ 16', sub: '24VDC/0,5A' }),
    s7_ai8: plc('S7-1500 AI 8×U/I', { w: 30, top: ['L+', 'M'], left: Array.from({ length: 8 }, (_, i) => `AI${i}`), title: 'AI 8', sub: 'U/I' }),
    sitop: plc('SITOP Stromversorgung 24 V', { w: 30, prefix: 'T', left: ['L', 'N', 'PE'], right: ['+24V', '+24V', '0V', '0V'], title: 'SITOP', sub: '24 V DC' }),
    s7_et200: plc('ET 200SP Interfacemodul', { w: 30, top: ['L+', 'M'], right: ['X1 P1', 'X1 P2'], title: 'ET 200SP', sub: 'IM 155-6 PN' }),
  };
}

/** Geräte für den Schaltschrank-Aufbauplan: maßstäbliche Frontansicht in Millimetern. */
export function cab(name, w, h, prefix, o = {}) {
  const x0 = -w / 2, y0 = -h / 2;
  const ops = [['r', x0, y0, w, h, o.fill || '#eef0f3']];
  if (o.din) {
    // Anschlussreihen oben/unten mit Schrauben je Pol
    const poles = o.poles || Math.max(1, Math.round(w / 17.5));
    ops.push(['b', x0 + 0.5, y0 + 0.5, w - 1, 11, '#dde1e7'], ['b', x0 + 0.5, h / 2 - 11.5, w - 1, 11, '#dde1e7']);
    for (let i = 0; i < poles; i++) {
      const cx = x0 + (w / poles) * (i + 0.5);
      if (w / poles >= 8) ops.push(['c', cx, y0 + 6, 2.2, '#ffffff'], ['c', cx, h / 2 - 6, 2.2, '#ffffff']);
    }
  }
  if (o.lever) ops.push(['r', -Math.min(6, w * 0.3), -9, Math.min(12, w * 0.6), 14, '#3d424d']);
  if (o.window) ops.push(['r', x0 + w * 0.2, y0 + h * 0.3, w * 0.6, h * 0.25, '#ffffff']);
  if (o.siemens) ops.push(['b', x0 + 0.5, y0 + h * 0.17, w - 1, 2.5, '#009999']);
  if (o.color) ops.push(['b', x0 + 0.5, y0 + 0.5, w - 1, h - 1, o.color]);
  if (o.extra) ops.push(...o.extra);
  return { name, cat: o.cat || 'Schaltschrank', prefix, val: o.val || '', kind: 'cab', pins: [], ops, cw: w, ch: h, din: !!o.din || h <= 100 };
}

function cabinetSymbols() {
  const S = 'Schaltschrank', P = 'Schaltschrank – SPS', D = 'Schaltschrank – Tür & Klemmen';
  return {
    cab_mcb1: cab('Leitungsschutzschalter 1-polig', 17.5, 90, 'F', { din: true, lever: true, poles: 1, val: 'B16' }),
    cab_mcb3: cab('Leitungsschutzschalter 3-polig', 52.5, 90, 'F', { din: true, lever: true, poles: 3, val: 'B16' }),
    cab_rcd2: cab('Fehlerstromschutzschalter 2-polig', 35, 90, 'F', { din: true, lever: true, poles: 2, val: '40 A / 30 mA' }),
    cab_rcd4: cab('Fehlerstromschutzschalter 4-polig', 70, 90, 'F', { din: true, lever: true, poles: 4, val: '40 A / 30 mA' }),
    cab_rcbo: cab('FI/LS-Schalter 1+N', 35, 90, 'F', { din: true, lever: true, poles: 2, val: 'B16 / 30 mA' }),
    cab_main: cab('Hauptschalter / Lasttrennschalter 3-polig', 52.5, 90, 'Q', { din: true, lever: true, poles: 3, val: '63 A' }),
    cab_spd: cab('Überspannungsschutz 4-polig', 70, 90, 'F', { din: true, poles: 4, window: true, val: 'Typ 2' }),
    cab_contactor: cab('Schütz (3RT2 Baugröße S00)', 45, 57.5, 'Q', { window: true, siemens: true, val: '24 V DC' }),
    cab_aux: cab('Hilfsschütz (3RH2)', 45, 57.5, 'K', { window: true, siemens: true }),
    cab_mpcb: cab('Motorschutzschalter (3RV2)', 45, 97, 'Q', { lever: true, siemens: true, val: '7–10 A' }),
    cab_ovl: cab('Überlastrelais (3RU2)', 45, 70, 'F', { window: true, siemens: true }),
    cab_timer: cab('Zeitrelais', 17.5, 90, 'K', { din: true, poles: 1, window: true }),
    cab_coupler: cab('Koppelrelais', 6.2, 90, 'K', { color: '#e6e8ec' }),
    cab_impulse: cab('Stromstoßschalter', 17.5, 90, 'K', { din: true, poles: 1, lever: true }),
    cab_stair: cab('Treppenlichtzeitschalter', 17.5, 90, 'K', { din: true, poles: 1, window: true }),
    cab_psu: cab('Netzteil 24 V DC', 52.5, 90, 'T', { din: true, poles: 3, window: true, val: '24 V / 5 A' }),
    cab_bell: cab('Klingeltransformator', 35, 90, 'T', { din: true, poles: 2 }),
    cab_meter: cab('Energiezähler (4 TE)', 70, 90, 'P', { din: true, poles: 4, window: true }),
    cab_socket: cab('Steckdose für Hutschiene', 45, 90, 'X', { din: true, poles: 1, extra: [['c', 0, 0, 12, '#ffffff'], ['c', -4, 0, 1.6, true], ['c', 4, 0, 1.6, true]] }),
    cab_logo: cab('LOGO! Basismodul', 71.5, 90, 'A', { cat: P, din: true, poles: 4, siemens: true, window: true, val: 'LOGO! 12/24RCE' }),
    cab_logo_dm: cab('LOGO! Erweiterung DM8', 36, 90, 'A', { cat: P, din: true, poles: 2, siemens: true }),
    cab_1214: cab('S7-1200 CPU 1214C', 110, 100, 'A', { cat: P, din: true, poles: 6, siemens: true, window: true, val: 'CPU 1214C DC/DC/DC' }),
    cab_1212: cab('S7-1200 CPU 1212C', 90, 100, 'A', { cat: P, din: true, poles: 5, siemens: true, window: true }),
    cab_sm1200: cab('S7-1200 Signalmodul', 45, 100, 'A', { cat: P, din: true, poles: 2, siemens: true }),
    cab_1511: cab('S7-1500 CPU 1511', 35, 147, 'A', { cat: P, siemens: true, window: true, fill: '#3b4048' }),
    cab_sm1500: cab('S7-1500 Signalmodul', 35, 147, 'A', { cat: P, siemens: true, fill: '#3b4048' }),
    cab_pm1500: cab('S7-1500 Stromversorgung PM', 50, 147, 'T', { cat: P, siemens: true, fill: '#3b4048' }),
    cab_et200: cab('ET 200SP Interfacemodul', 50, 117, 'A', { cat: P, siemens: true, fill: '#d8dbe0' }),
    cab_term: cab('Durchgangsklemme 2,5 mm²', 5.2, 56, 'X', { cat: D, color: '#c9ccd2' }),
    cab_term_pe: cab('Schutzleiterklemme (PE)', 5.2, 56, 'X', { cat: D, extra: [['b', -2.1, -27.5, 4.2, 55, '#2e9e47'], ['b', -2.1, -10, 4.2, 6, '#f2d43a'], ['b', -2.1, 6, 4.2, 6, '#f2d43a']] }),
    cab_term_n: cab('N-Klemme', 5.2, 56, 'X', { cat: D, color: '#3e7bd6' }),
    cab_term_end: cab('Endhalter', 9, 40, 'X', { cat: D, color: '#8a8f98' }),
    cab_door_btn: cab('Befehlsgerät ⌀22 (Taster)', 30, 30, 'S', { cat: D, fill: '#ffffff', extra: [['c', 0, 0, 11, '#16161a'], ['c', 0, 0, 8.5, '#4caf50']] }),
    cab_door_lamp: cab('Leuchtmelder ⌀22', 30, 30, 'P', { cat: D, fill: '#ffffff', extra: [['c', 0, 0, 11, '#16161a'], ['c', 0, 0, 8.5, '#ffd34d']] }),
    cab_door_estop: cab('Not-Halt ⌀40', 50, 50, 'S', { cat: D, fill: '#ffd34d', extra: [['c', 0, 0, 20, '#e53935']] }),
    cab_door_main: cab('Hauptschalter (Tür)', 64, 64, 'Q', { cat: D, fill: '#ffd34d', extra: [['r', -6, -24, 12, 48, '#e53935']] }),
    cab_smps: cab('Schaltnetzteil offen (z. B. 350 W)', 215, 115, 'T', { cat: S, fill: '#c9cdd3', extra: [
      ...Array.from({ length: 9 }, (_, i) => ['c', -95 + i * 8, -40, 1.4, '#9aa0a8']), ...Array.from({ length: 9 }, (_, i) => ['c', -95 + i * 8, -30, 1.4, '#9aa0a8']),
      ['c', 40, -15, 24, '#d9dce1'], ['c', 40, -15, 8, '#3d424d'], ...[-20, -10, 0, 10, 20].map((d) => ['l', 40 - 22, -15 + d, 40 + 22, -15 + d]),
      ['b', -107, 30, 18, 26, '#2a7c3c'], ['b', 60, 40, 22, 12, '#ffd34d'], ['t', 71, 46, '!', 6]] }),
    cab_smps_s: cab('Schaltnetzteil klein (gelocht)', 99, 97, 'T', { cat: S, fill: '#d0d4d9', extra: [
      ...Array.from({ length: 64 }, (_, i) => ['c', -38 + (i % 8) * 10 + (Math.floor(i / 8) % 2) * 5, -38 + Math.floor(i / 8) * 10, 2.6, '#aab0b8']), ['c', 30, 25, 6, '#e8d54a']] }),
    cab_rpi: cab('Raspberry Pi (mit Hutschienenhalter)', 85, 56, 'A', { cat: P, fill: '#2f8a46', extra: [
      ['b', -42.5, -27, 50, 5, '#d4a53a'], ['r', -28, -10, 16, 16, '#3a3f47'], ['r', 22, -22, 21, 16, '#c7ccd3'], ['r', 22, 2, 21, 16, '#c7ccd3'], ['r', 28, -8, 15, 12, '#c7ccd3'], ['b', -42.5, 22, 8, 5, '#c7ccd3']] }),
    cab_board: cab('Steuerplatine / Mainboard', 110, 85, 'A', { cat: P, fill: '#1f2329', extra: [
      ...Array.from({ length: 8 }, (_, i) => ['b', -48 + i * 11, -38, 8, 10, '#d63a3a']), ['r', -10, -10, 20, 20, '#3a3f47'], ['b', -50, 20, 100, 6, '#e8a33a'], ['b', -50, 30, 100, 6, '#3a7bd5']] }),
    cab_relay8: cab('Relaiskarte 8-Kanal', 138, 56, 'K', { cat: P, fill: '#1d4fa0', extra: Array.from({ length: 8 }, (_, i) => ['b', -64 + i * 16.5, -18, 14, 18, '#2a6bd6']) }),
    cab_holder: cab('Hutschienen-Endhalter', 10, 45, 'X', { cat: D, color: '#7ed321' }),
    cab_hmi: cab('Bedienpanel (HMI 7")', 214, 158, 'A', { cat: D, fill: '#2f333a', extra: [['b', -95, -66, 190, 120, '#7fb2d9']] }),
    cab_fan: cab('Filterlüfter', 120, 120, 'M', { cat: D, fill: '#d9dce1', extra: [['c', 0, 0, 45, '#ffffff'], ...[-30, -15, 0, 15, 30].map((y) => ['l', -45, y, 45, y])] }),
  };
}

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

export const CATEGORIES = ['Eigene Bauteile', 'Kontakte & Schalter', 'Relais & Schutz', 'Verbraucher & Melder', 'Quellen & Erde', 'Verbindungen', 'Siemens SPS', 'Passiv', 'Halbleiter', 'Installation', 'Installation – Raum'];
export const CABINET_CATEGORIES = ['Eigene Bauteile', 'Schaltschrank', 'Schaltschrank – SPS', 'Schaltschrank – Tür & Klemmen'];
export const INSTALL_CATEGORIES = ['Eigene Bauteile', 'Installation', 'Installation – Raum', 'Verbraucher & Melder', 'Relais & Schutz', 'Kontakte & Schalter', 'Verbindungen', 'Quellen & Erde', 'Passiv', 'Halbleiter'];

// ---------------------------------------------------------------- Eigene Bauteile
const CUSTOM = {};
export function getSym(type) { return SYMBOLS[type] || CUSTOM[type] || null; }
export function registerCustom(list) { for (const c of list || []) if (c && c.id) CUSTOM[c.id] = { ...c, cat: 'Eigene Bauteile', custom: true }; }
export function unregisterCustom(id) { delete CUSTOM[id]; }
export function allSymbols() { return { ...SYMBOLS, ...CUSTOM }; }

/** Punkt eines Bauteils in Blattkoordinaten (Drehung in 90°-Schritten, Spiegeln an der senkrechten Achse). */
export function xf(part, x, y) {
  const k = part.k || 1;
  x *= k; y *= k;
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
    else if (op[0] === 'b') { add(op[1], op[2]); add(op[1] + op[3], op[2] + op[4]); }
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
  const k = part.k || 1;
  const F = (f) => (!f ? null : f === 'w' ? '#ffffff' : typeof f === 'string' && f[0] === '#' ? f : color);
  for (const op of sym.ops) {
    switch (op[0]) {
      case 'l': pen.line(...T(op[1], op[2]), ...T(op[3], op[4]), color); break;
      case 'd': pen.line(...T(op[1], op[2]), ...T(op[3], op[4]), color, true); break;
      case 'r': {
        const pts = [...T(op[1], op[2]), ...T(op[1] + op[3], op[2]), ...T(op[1] + op[3], op[2] + op[4]), ...T(op[1], op[2] + op[4])];
        pen.poly(pts, true, F(op[5]), color);
        break;
      }
      case 'b': { // gefülltes Rechteck ohne Rand (Farbflächen)
        const pts = [...T(op[1], op[2]), ...T(op[1] + op[3], op[2]), ...T(op[1] + op[3], op[2] + op[4]), ...T(op[1], op[2] + op[4])];
        pen.poly(pts, true, op[5] || '#dddddd', null);
        break;
      }
      case 'c': pen.circle(...T(op[1], op[2]), op[3] * k, F(op[4]), color); break;
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
        pen.poly(pts, !!op[2], F(op[3]), color);
        break;
      }
      case 't': pen.text(...T(op[1], op[2]), op[3], (op[4] || 3) * k, op[5] || 'center', op[6] || color, 'middle'); break;
      default: break;
    }
  }
}
