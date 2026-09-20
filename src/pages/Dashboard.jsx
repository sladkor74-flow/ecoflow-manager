import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ClipboardList, Truck, Factory, Ship, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import AlertBadge from '@/components/alerts/AlertBadge';
import TargetAlertsPanel from '@/components/dashboard/TargetAlertsPanel';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import DashboardKpi from '@/components/dashboard/DashboardKpi';
import ReteVsAciChart from '@/components/dashboard/ReteVsAciChart';
import TargetVsRaccoltoChart from '@/components/dashboard/TargetVsRaccoltoChart';
import { formatIntero } from '@/lib/utils';
import Cruscotto from '@/components/dashboard/Cruscotto';
import { useAuth } from '@/lib/AuthContext';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [counts, setCounts] = useState({});
  const [alertCount, setAlertCount] = useState(0);
  const [alertCritici, setAlertCritici] = useState(0);
  const [loading, setLoading] = useState(true);

  const [mese, setMese] = useState([]);
  const [anno, setAnno] = useState([new Date().getFullYear()]);
  const [raccoltaData, setRaccoltaData] = useState(null);
  const [raccoltaLoading, setRaccoltaLoading] = useState(true);

  // I conteggi seguono gli stessi filtri dei grafici.
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('getDashboardStats', { mese, anno });
        setCounts(res.data.counts);
        setAlertCount(res.data.alert_count || 0);
        setAlertCritici(res.data.alert_critici || 0);
      } catch (e) { /* ignore */ }
      setLoading(false);
    })();
  }, [mese, anno]);

  useEffect(() => {
    (async () => {
      setRaccoltaLoading(true);
      try {
        const res = await base44.functions.invoke('getDashboardRaccolta', { mese, anno });
        setRaccoltaData(res.data);
      } catch (e) { /* ignore */ }
      setRaccoltaLoading(false);
    })();
  }, [mese, anno]);

  const periodo = `${mese.length ? `${mese.join(', ')} ` : ''}${anno.length ? anno.join(', ') : new Date().getFullYear()}`;
  const cards = [
    { key: 'assegnati', label: 'Assegnati Rete', sotto: counts.assegnati_aci ? `da evadere · ACI ${formatIntero(counts.assegnati_aci)}` : 'da evadere', icon: ClipboardList, path: '/assegnati', color: 'text-blue-600 bg-blue-50' },
    { key: 'primarie_rete', label: 'Terminati Rete', sotto: periodo, icon: Truck, path: '/primarie-rete', color: 'text-green-600 bg-green-50' },
    { key: 'primarie_aci', label: 'Terminati ACI', sotto: periodo, icon: Factory, path: '/primarie-aci', color: 'text-amber-600 bg-amber-50' },
    { key: 'secondarie', label: 'Secondarie di rete', sotto: counts.secondarie_aci ? `${periodo} · ACI ${formatIntero(counts.secondarie_aci)}` : periodo, icon: Truck, path: '/secondarie', color: 'text-purple-600 bg-purple-50' },
    { key: 'terziarie', label: 'Terziarie terminate', sotto: periodo, icon: Ship, path: '/terziarie', color: 'text-pink-600 bg-pink-50' },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Panoramica della commessa PFU Ecotyre — Smoco gestore.</p>
        </div>
        {alertCount > 0 && <AlertBadge count={alertCount} critici={alertCritici} />}
      </div>

      {/* Che cosa c'e' da gestire, l'arretrato, i dati, i mesi da fatturare, il margine */}
      <Cruscotto isAdmin={isAdmin} />

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
                <p className="text-2xl font-heading font-bold">{formatIntero(counts[c.key] ?? 0)}</p>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-xs text-muted-foreground/80">{c.sotto}</p>
              </Link>
            );
          })}
        </div>
      )}

      {/* Filtri Mese + Anno */}
      <DashboardFilters mese={mese} anno={anno} onMeseChange={setMese} onAnnoChange={setAnno} />

      {/* KPI Raccolta */}
      <DashboardKpi kpi={raccoltaData?.kpi} loading={raccoltaLoading} />

      {/* Raccolta RETE vs ACI per Regione */}
      <div className="border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="font-heading font-semibold text-lg">Raccolta RETE vs ACI per Regione — {mese.length ? mese.join(', ') : 'Tutti i mesi'} {anno.length ? anno.join(', ') : 'Tutti gli anni'}</h2>
        </div>
        <ReteVsAciChart data={raccoltaData?.per_regione} />
      </div>

      {/* Target vs Raccolto per Regione */}
      <div className="border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="font-heading font-semibold text-lg">Target vs Raccolto per Regione — {anno.length ? anno.join(', ') : 'Tutti gli anni'} (solo Rete)</h2>
        </div>
        <TargetVsRaccoltoChart data={raccoltaData?.target_vs_raccolto} />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h2 className="font-heading font-semibold text-lg">Avvisi Target Trasportatori</h2>
        </div>
        <TargetAlertsPanel />
      </div>

    </div>
  );
}