import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ClipboardList, Truck, Factory, Ship, Upload, TrendingUp, AlertTriangle } from 'lucide-react';
import AlertBadge from '@/components/alerts/AlertBadge';
import TargetDashboard from '@/components/dashboard/TargetDashboard';
import TargetAlertsPanel from '@/components/dashboard/TargetAlertsPanel';

export default function Dashboard() {
  const [counts, setCounts] = useState({});
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getDashboardStats', {});
        setCounts(res.data.counts);
        setAlertCount(res.data.alert_count || 0);
      } catch (e) {
        // ignore
      }
      setLoading(false);
    })();
  }, []);

  const cards = [
    { key: 'assegnati', label: 'Assegnati', icon: ClipboardList, path: '/assegnati', color: 'text-blue-600 bg-blue-50' },
    { key: 'primarie_rete', label: 'Primarie Rete', icon: Truck, path: '/primarie-rete', color: 'text-green-600 bg-green-50' },
    { key: 'primarie_aci', label: 'Primarie ACI', icon: Factory, path: '/primarie-aci', color: 'text-amber-600 bg-amber-50' },
    { key: 'secondarie', label: 'Secondarie', icon: Truck, path: '/secondarie', color: 'text-purple-600 bg-purple-50' },
    { key: 'terziarie', label: 'Terziarie', icon: Ship, path: '/terziarie', color: 'text-pink-600 bg-pink-50' },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Panoramica della commessa PFU Ecotyre — Smoco gestore.</p>
        </div>
        {alertCount > 0 && <AlertBadge count={alertCount} />}
      </div>

      {loading ? (
        <div className="text-muted-foreground">Caricamento...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link key={c.key} to={c.path} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className={`inline-flex p-2 rounded-md mb-3 ${c.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-heading font-bold">{counts[c.key] ?? 0}</p>
                <p className="text-sm text-muted-foreground">{c.label}</p>
              </Link>
            );
          })}
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="font-heading font-semibold text-lg">Target Mensili per Regione</h2>
        </div>
        <TargetDashboard />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h2 className="font-heading font-semibold text-lg">Avvisi Target Trasportatori</h2>
        </div>
        <TargetAlertsPanel />
      </div>

      <div className="border rounded-lg p-5 bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="font-heading font-semibold">Prossimi passi</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Per popolare il gestionale, carica i file Excel dal portale Ecotyre nella sezione dedicata.
        </p>
        <Link to="/caricamento-dati" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          <Upload className="w-4 h-4" /> Vai al caricamento dati
        </Link>
      </div>


    </div>
  );
}