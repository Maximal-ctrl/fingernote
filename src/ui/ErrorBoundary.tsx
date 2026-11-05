import { Component, type ReactNode } from 'react';

/** Statt einer weißen Seite: Fehler sichtbar machen, mit Text zum Weitergeben. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h1>Fingernote ist auf einen Fehler gestoßen</h1>
        <p>Deine Notizen sind gespeichert. Lade die Seite neu. Wenn das wieder passiert, schick diesen Text weiter:</p>
        <pre>{`${this.state.error.name}: ${this.state.error.message}\n${navigator.userAgent}`}</pre>
        <button type="button" className="btn btn-primary btn-md" onClick={() => location.reload()}>Neu laden</button>
      </div>
    );
  }
}
