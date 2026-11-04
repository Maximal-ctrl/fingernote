import { ShieldCheck, FileDown, Gauge, BellRing, PenLine, Search } from 'lucide-react';
import { Button } from '../ui/ui';
import { Logo } from '../ui/Logo';
import { navigate } from '../lib/router';

const FEATURES = [
  { icon: <ShieldCheck size={22} />, title: 'Nichts geht verloren', text: 'Speichert beim Tippen, auch wenn du den Tab gleich wieder schließt. Gelöschtes landet im Papierkorb.' },
  { icon: <FileDown size={22} />, title: 'Du kommst jederzeit raus', text: 'Jedes Notizbuch als Markdown, alles zusammen als eine Backup-Datei, Seiten als PDF drucken.' },
  { icon: <Gauge size={22} />, title: 'Bleibt flüssig', text: 'Gezeichnet wird nur, was du siehst. Auch Seiten mit Tausenden Strichen scrollen ruhig.' },
  { icon: <BellRing size={22} />, title: 'Erinnert ans Backup', text: 'Es gibt keine Cloud. Deshalb sagt Fingernote Bescheid, wenn dein letztes Backup zu alt ist.' },
  { icon: <PenLine size={22} />, title: 'Stift, Finger, Tastatur', text: 'Stift mit Druck, Marker, Radierer, Lasso, Formen, Papiervorlagen und PDFs zum Beschriften.' },
  { icon: <Search size={22} />, title: 'Wiederfinden', text: 'Abschnitte, Unterseiten, Tags mit Übersicht und Volltextsuche über alle Notizbücher.' },
];

const FAQ = [
  ['Wo liegen meine Notizen?', 'In diesem Browser auf diesem Gerät (IndexedDB). Nichts wird hochgeladen, es gibt kein Konto.'],
  ['Was passiert, wenn ich die Browserdaten lösche?', 'Dann sind die Notizen weg. Sichere deshalb regelmäßig ein Backup (Einstellungen → Backup exportieren). Fingernote erinnert dich daran.'],
  ['Kann ich Handschrift durchsuchen?', 'Nein. Die Suche findet getippten Text und Seitentitel. Handschrifterkennung ist nicht eingebaut.'],
  ['Geht das auf dem Tablet?', 'Ja, im Browser. Mit Stift schreibst du, mit dem Finger scrollst und zoomst du. Ohne Stift schreibt auch der Finger.'],
  ['Kann ich aus anderen Apps importieren?', 'PDFs ja: Jede PDF-Seite wird eine Seite zum Beschriften. Andere Notizformate noch nicht.'],
];

export function AboutPage() {
  return (
    <div className="about">
      <header className="about-nav">
        <Logo />
        <Button variant="primary" onClick={() => navigate('/')}>Zur App</Button>
      </header>
      <main>
        <section className="about-hero">
          <h1>Notizen mit Stift und Tastatur. Nur auf deinem Gerät.</h1>
          <p className="about-lead">Tippen und von Hand schreiben auf derselben Seite. Kein Konto, kein Sync, der etwas verschluckt.</p>
          <Button variant="primary" onClick={() => navigate('/')}>Jetzt loslegen</Button>
          <img className="about-shot" src="/screenshot.jpg" alt="Fingernote: eine Seite mit getipptem Text, To-Do-Liste, Handschrift und Pfeil" width={1200} height={750} />
        </section>
        <section className="about-section">
          <h2>Das Problem</h2>
          <p>Notizen verschwinden nach einem Sync-Fehler, und wer die App wechseln will, bekommt seine Notizbücher kaum heraus. Fingernote dreht das um: Deine Notizen bleiben bei dir, und du kannst sie jederzeit als Datei mitnehmen.</p>
        </section>
        <section className="about-section">
          <h2>So geht’s</h2>
          <ol className="about-steps">
            <li><strong>Notizbuch anlegen.</strong> Ein Abschnitt und die erste Seite sind schon da.</li>
            <li><strong>Irgendwo hinklicken und tippen,</strong> oder mit Stift oder Finger schreiben.</li>
            <li><strong>Wiederfinden</strong> mit Suche, Tags und Abschnitten.</li>
          </ol>
        </section>
        <section className="about-section">
          <h2>Was Fingernote anders macht</h2>
          <ul className="about-grid">
            {FEATURES.map((f) => (
              <li key={f.title}><span className="about-icon" aria-hidden>{f.icon}</span><h3>{f.title}</h3><p>{f.text}</p></li>
            ))}
          </ul>
        </section>
        <section className="about-section">
          <h2>Preis</h2>
          <p>Kostenlos. Fingernote läuft lokal, ohne Server, also gibt es nichts, wofür ein Abo nötig wäre.</p>
        </section>
        <section className="about-section">
          <h2>Fragen</h2>
          <dl className="about-faq">
            {FAQ.map(([q, a]) => (<div key={q}><dt>{q}</dt><dd>{a}</dd></div>))}
          </dl>
        </section>
        <section className="about-cta">
          <h2>Leg dein erstes Notizbuch an.</h2>
          <Button variant="primary" onClick={() => navigate('/')}>Zur Bibliothek</Button>
        </section>
      </main>
    </div>
  );
}
