import { HikeSession, HikingStatistics } from '../types';

export class HikeReportPDFService {
  /**
   * Generates a printable HTML string with CSS print media rules for 1-click PDF download
   */
  public static generatePrintableHTML(
    session: HikeSession,
    stats?: HikingStatistics | null
  ): string {
    const formattedDate = new Date(session.startedAt).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const durationMin = Math.round(session.durationSeconds / 60);
    const durationHours = (durationMin / 60).toFixed(1);

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport Randonnée - ${session.id}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; background: #fff; color: #06120C; font-family: 'Helvetica Neue', Arial, sans-serif; }
      .no-print { display: none !important; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 24px; background: #FBFAF6; color: #17402C; }
    .header { border-bottom: 2px solid #17402C; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 28px; font-weight: 600; margin: 0; color: #17402C; }
    .subtitle { font-size: 14px; color: #6B7A72; margin-top: 4px; font-family: monospace; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .card { background: #F4F1EA; padding: 16px; border-radius: 12px; text-align: center; }
    .card .label { font-size: 10px; text-transform: uppercase; color: #6B7A72; letter-spacing: 1px; font-family: monospace; }
    .card .val { font-size: 22px; font-weight: bold; color: #17402C; margin-top: 4px; }
    .section { margin-top: 32px; }
    .section h3 { font-size: 16px; border-bottom: 1px solid #DDD6C6; padding-bottom: 8px; color: #17402C; }
    .poi-list { list-style: none; padding: 0; }
    .poi-item { padding: 10px 0; border-bottom: 1px stroke #E9E4D9; display: flex; justify-content: space-between; font-size: 14px; }
    .btn-print { background: #17402C; color: #fff; border: none; padding: 12px 24px; border-radius: 99px; font-weight: bold; cursor: pointer; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div className="no-print">
    <button onclick="window.print()" className="btn-print">🖨️ Imprimer / Sauvegarder en PDF</button>
  </div>

  <div className="header">
    <div>
      <h1 className="title">LE KIT DU VOYAGEUR</h1>
      <div className="subtitle">RAPPORT BASSIN DE RANDONNÉE · ${formattedDate}</div>
    </div>
    <div style="text-align: right; font-family: monospace; font-size: 12px; color: #17402C;">
      SESSION #${session.id.slice(0, 8)}
    </div>
  </div>

  <div className="grid">
    <div className="card">
      <div className="label">Distance</div>
      <div className="val">${session.distanceKm.toFixed(1)} km</div>
    </div>
    <div className="card">
      <div className="label">Durée</div>
      <div className="val">${durationHours} h</div>
    </div>
    <div className="card">
      <div className="label">Dénivelé +</div>
      <div className="val">+${session.elevationGainM ?? 0} m</div>
    </div>
    <div className="card">
      <div className="label">Événements</div>
      <div className="val">${session.poiEvents.length}</div>
    </div>
  </div>

  <div className="section">
    <h3>Événements & Étapes Marquantes</h3>
    <ul className="poi-list">
      ${
        session.poiEvents.map(
          (e) => `
        <li className="poi-item">
          <span>📍 <strong>${e.poiName}</strong></span>
          <span style="font-family: monospace; color: #6B7A72;">${new Date(e.reachedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
        </li>
      `
        ).join('') || '<li className="poi-item"><span>Randonnée sans waypoint intermédiaire</span></li>'
      }
    </ul>
  </div>

  ${
    session.narratives
      ? `
  <div className="section">
    <h3>Récit d'Aventure IA</h3>
    <p style="font-style: italic; line-height: 1.6; color: #384A42; background: #EAF1E5; padding: 16px; border-radius: 12px;">
      "${session.narratives.aventure || session.narratives.journal}"
    </p>
  </div>
  `
      : ''
  }
</body>
</html>
    `;
  }

  /**
   * Triggers a browser window print preview of the hike session report
   */
  public static openPrintWindow(session: HikeSession): void {
    if (typeof window === 'undefined') return;
    const html = this.generatePrintableHTML(session);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }
}
