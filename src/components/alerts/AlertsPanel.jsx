import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, X, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';

// Pannello laterale con lista alert e gestione stato
export default function AlertsPanel({ modulo, maxHeight }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('aperto');

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getAlerts', { modulo, solo_aperti: filter === 'aperto' });
      setAlerts(res.data.alerts || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [modulo, filter]);

  // Auto-refresh
  useEffect(() => {
    const unsub = base44.entities.Alert.subscribe((event) => {
      if (event.type === 'create') load();
    });
    return unsub;
  }, [load]);

  const handleAction = async (alert, action) => {
    try {
      await base44.entities.Alert.update(alert.id, { stato: action, risolto_note: action === 'risolto' ? 'Risolto da operatore' : 'Ignorato' });
      load();
    } catch (e) { console.error(e); }
  };

  const sevColor = {
    critico: 'bg-red-50 border-red-200 text-red-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
  };
  const sevIcon = { critico: '🔴', warning: '🟡', info: '🔵' };

  return (
    <div className="border rounded-lg overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <h3 className="font-heading font-semibold text-sm">Alert Operativi</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setFilter('aperto')} className={`px-2 py-1 text-xs rounded ${filter === 'aperto' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>Aperti</button>
          <button onClick={() => setFilter('tutti')} className={`px-2 py-1 text-xs rounded ${filter === 'tutti' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>Tutti</button>
        </div>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: maxHeight || '400px' }}>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Caricamento...
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            <CheckCircle className="w-4 h-4 mr-2 text-green-600" /> Nessun alert
          </div>
        ) : (
          alerts.map((a) => (
            <div key={a.id} className={`p-3 border-b ${sevColor[a.severita] || sevColor.warning}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs">{sevIcon[a.severita]}</span>
                    <span className="text-xs font-mono font-medium">{a.record_id || 'N/D'}</span>
                    <span className="text-xs text-muted-foreground">· {a.modulo}</span>
                  </div>
                  <p className="text-sm font-medium">{a.titolo}</p>
                  <p className="text-xs mt-0.5 opacity-80">{a.descrizione}</p>
                  {a.stato !== 'aperto' && (
                    <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded bg-muted">{a.stato}</span>
                  )}
                </div>
                {a.stato === 'aperto' && (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => handleAction(a, 'risolto')} title="Risolto" className="p-1 rounded hover:bg-green-200">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleAction(a, 'ignorato')} title="Ignora" className="p-1 rounded hover:bg-muted">
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}