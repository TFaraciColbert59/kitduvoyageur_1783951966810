'use client';

import React from 'react';
import { Icon } from './PreparationIcons';

interface PreparationSafetyProps {
  score: number;
  weatherState: { ok: boolean; desc: string; warn: boolean };
  gpsState: { ok: boolean; desc: string };
  offlineState: { ok: boolean; desc: string };
  batteryState: { ok: boolean; desc: string };
  alerts: string[];
}

export const PreparationSafety: React.FC<PreparationSafetyProps> = ({
  score,
  weatherState,
  gpsState,
  offlineState,
  batteryState,
  alerts,
}) => {
  const gearOk = score >= 85;

  return (
    <div className="safety-grid">
      <div className="safety-row">
        <div className="ic">
          <Icon name="shield" />
        </div>
        <div className="body">
          <div className="n">Équipement</div>
          <div className="v">{score}% · {gearOk ? 'prêt' : 'à compléter'}</div>
        </div>
        <div className={`status-ic ${gearOk ? 'ok' : 'warn'}`}>
          <Icon name={gearOk ? 'check' : 'info'} />
        </div>
      </div>
      
      <div className="safety-row">
        <div className="ic">
          <Icon name="cloud" />
        </div>
        <div className="body">
          <div className="n">Météo vérifiée</div>
          <div className="v">{weatherState.desc}</div>
        </div>
        <div className={`status-ic ${weatherState.ok ? 'ok' : 'warn'}`}>
          <Icon name={weatherState.ok ? 'check' : 'info'} />
        </div>
      </div>
      
      <div className="safety-row">
        <div className="ic">
          <Icon name="gps" />
        </div>
        <div className="body">
          <div className="n">GPS · localisation</div>
          <div className="v">{gpsState.desc}</div>
        </div>
        <div className={`status-ic ${gpsState.ok ? 'ok' : 'warn'}`}>
          <Icon name={gpsState.ok ? 'check' : 'info'} />
        </div>
      </div>
      
      <div className="safety-row">
        <div className="ic">
          <Icon name="map" />
        </div>
        <div className="body">
          <div className="n">Carte hors ligne</div>
          <div className="v">{offlineState.desc}</div>
        </div>
        <div className={`status-ic ${offlineState.ok ? 'ok' : 'warn'}`}>
          <Icon name={offlineState.ok ? 'check' : 'info'} />
        </div>
      </div>
      
      <div className="safety-row">
        <div className="ic">
          <Icon name="battery" />
        </div>
        <div className="body">
          <div className="n">Batterie</div>
          <div className="v">{batteryState.desc}</div>
        </div>
        <div className={`status-ic ${batteryState.ok ? 'ok' : 'warn'}`}>
          <Icon name={batteryState.ok ? 'check' : 'info'} />
        </div>
      </div>
      
      {alerts.length > 0 && (
        <div className="safety-row warn">
          <div className="ic">
            <Icon name="info" />
          </div>
          <div className="body">
            <div className="n">Alerte à surveiller</div>
            <div className="v">{alerts[0]}</div>
          </div>
          <div className="status-ic warn">
            <Icon name="info" />
          </div>
        </div>
      )}
    </div>
  );
};
