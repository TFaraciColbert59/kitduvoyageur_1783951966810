import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { useToast } from '@/src/components/ui/use-toast';

interface AlertesWidgetProps {
  equipment: Array<any>;
  alerts: Array<any>;
  onUpdateEquipment: (updates: any) => Promise<void>;
  onClose: () => void;
  isFullscreen: boolean;
  onAgrandir: () => void;
}

export function AlertesWidget({
  equipment,
  alerts,
  onUpdateEquipment,
  onClose,
  isFullscreen,
  onAgrandir
}: AlertesWidgetProps) {
  const { toast } = useToast();
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [filterType, setFilterType] = useState<'all' | 'maintenance' | 'expiry' | 'loan-critical' | 'missing-item' | 'weight-excess'>('all');

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    const matchesSeverity = filterSeverity === 'all' || alert.severity === filterSeverity;
    const matchesType = filterType === 'all' || alert.type === filterType;
    return matchesSeverity && matchesType;
  });

  // Alert stats
  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical').length;
  const warningAlerts = alerts.filter(alert => alert.severity === 'warning').length;
  const infoAlerts = alerts.filter(alert => alert.severity === 'info').length;

  if (isFullscreen) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Alertes</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Filters */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-white/60 mb-1">Sévérité</label>
                <div className="flex flex-wrap gap-2">
                  {['all', 'critical', 'warning', 'info'].map((severity) => (
                    <button
                      key={severity}
                      onClick={() => setFilterSeverity(severity)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        filterSeverity === severity
                          ? 'bg-white/12 border-[#A3C4A3]/50 text-white font-bold'
                          : 'bg-white/5 border-white/8 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {severity === 'all' ? 'Toutes' : severity.charAt(0).toUpperCase() + severity.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Type</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'all', label: 'Tous' },
                    { id: 'maintenance', label: 'Entretien' },
                    { id: 'expiry', label: 'Péremption' },
                    { id: 'loan-critical', label: 'Prêt critique' },
                    { id: 'missing-item', label: 'Article manquant' },
                    { id: 'weight-excess', label: 'Poids excessif' }
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setFilterType(type.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        filterType === type.id
                          ? 'bg-white/12 border-[#A3C4A3]/50 text-white font-bold'
                          : 'bg-white/5 border-white/8 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              }
            </div>
          </div>

          {/* Alerts list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider">
                Alertes actives ({filteredAlerts.length})
              </h3>
              <span className="text-[9px] text-[#A3C4A3] font-mono">
                {criticalAlerts} critique{s} · {warningAlerts} avertissement{s} · {infoAlerts} information
              </span>
            </div>

            {filteredAlerts.length > 0 ? (
              <div className="space-y-2">
                {filteredAlerts.map((alert: any) => (
                  <div
                    key={alert.id}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                      alert.severity === 'critical'
                        ? 'bg-red/5 border-red/10 text-red/100'
                        : alert.severity === 'warning'
                          ? 'bg-orange/5 border-orange/10 text-orange/100'
                          : 'bg-white/5 border-white/8 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <h4 className="text-sm font-semibold truncate">{alert.label}</h4>
                      {alert.itemId && (
                        <p className="text-xs text-white/60">
                          {getItemName(equipment, alert.itemId) || 'Article inconnu'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[9px]">
                      {getSeverityBadge(alert.severity)}
                      {getTypeBadge(alert.type)}
                      <button
                        onClick={() => {
                          handleAlertAction(alert);
                          toast({ description: `Alerte traitée : ${alert.label}`, variant: 'default' });
                        }}
                        className="text-[9px] text-[#A3C4A3] hover:text-white underline px-2 py-0.5 rounded"
                      >
                        Traiter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9px] text-white/50 text-center py-6">
                Aucune alerte active pour le moment.
              </p>
            )}
          </div>

          {/* Statistics */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[9px] font-extrabold text-white uppercase tracking-wider mb-2">Répartition des alertes</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-white/60 mb-1">Critiques</p>
                <p className="font-bold text-white">{criticalAlerts}</p>
              </div>
              <div>
                <p className="text-white/60 mb-1">Avertissements</p>
                <p className="font-bold text-white">{warningAlerts}</p>
              </div>
              <div>
                <p className="text-white/60 mb-1">Informations</p>
                <p className="font-bold text-white">{infoAlerts}</p>
              </div>
              <div>
                <p className="text-white/60 mb-1">Taux de résolution</p>
                <p className="font-bold text-white">
                  {alerts.length > 0
                    ? `${Math.round(((alerts.length - filteredAlerts.length) / alerts.length) * 100)}%`
                    : '0%'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Compact view
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Alertes</h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAgrandir();
          }}
          className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs"
        >
          <span className="text-[10px]">⤢</span>
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-[9px] text-white/60 font-medium">
          {filteredAlerts.length} alerte{s} active{s}
        </p>
        <p className="text-[9px] text-white/60">
          {criticalAlerts} critique{s} · {warningAlerts} avertissement{s}
        </p>
      </div>

      {/* Quick alert indicators */}
      {(criticalAlerts > 0 || warningAlerts > 0) && (
        <div className="pt-2 border-t border-white/5">
          <p className="text-[9px] text-white/60 text-center">
            {criticalAlerts > 0 ? `🔴 ${criticalAlerts} critique{s}` : ''}
            {criticalAlerts > 0 && warningAlerts > 0 ? ' | ' : ''}
            {warningAlerts > 0 ? `🟡 ${warningAlerts} avertissement{s}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

// Helper functions
function getItemName(equipment: Array<any>, itemId: string | undefined): string | undefined {
  if (!itemId) return undefined;
  const item = equipment.find(item => item.id === itemId);
  return item ? item.name : undefined;
}

function getSeverityBadge(severity: string): JSX.Element {
  switch (severity) {
    case 'critical':
      return <span className="text-red/100">🔴</span>;
    case 'warning':
      return <span className="text-orange/100">🟡</span>;
    case 'info':
      return <span className="text-blue/100">🔵</span>;
    default:
      return <span className="text-white/60">⚪</span>;
  }
}

function getTypeBadge(type: string): JSX.Element {
  switch (type) {
    case 'maintenance':
      return <span className="text-orange/100">🔧</span>;
    case 'expiry':
      return <span className="text-red/100">⏰</span>;
    case 'loan-critical':
      return <span className="text-red/100">🔄</span>;
    case 'missing-item':
      return <span className="text-red/100">📦</span>;
    case 'weight-excess':
      return <span className="text-orange/100">⚖️</span>;
    default:
      return <span className="text-white/60">ℹ️</span>;
  }
}

function handleAlertAction(alert: any) {
  // This would handle specific alert actions in a real implementation
  // For now, we just log it
  console.log('Handling alert:', alert);
}