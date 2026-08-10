import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ClipboardList, Truck, Factory, Ship, Upload, TrendingUp, AlertTriangle } from 'lucide-react';
import AlertBadge from '@/components/alerts/AlertBadge';

export default function Dashboard() {
  const [counts, setCounts] = useState({});
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [assegnati, rete, aci, sec, terz, alerts] = await Promise.all([
          base44.entities.Assegnato.list('-created_date', 1),
          base44.entities.PrimariaRete.list('-created_date', 1),
          base44.entities.PrimariaAci.list('-created_date', 1),
          base44.entities.Secondaria.list('-created_date', 1),
          base44.entities.Terziaria.list('-created_date', 1),
          base44.functions.invoke('getAlerts', { solo_aperti: true }),
        ]);
        setCounts({
          assegnati: assegnati.length,
          primarie_rete: rete.length,
          primarie_aci: aci.length,
          secondarie: sec.length,
          terziarie: terz.length,
        });
        setAlertCount(alerts?.data?.total || 0);
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

      <div className="border rounded-lg p-5 bg-amber-50 border-amber-200">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h2 className="font-heading font-semibold text-amber-900">Moduli in costruzione</h2>
        </div>
        <p className="text-sm text-amber-800">
          I moduli Fatturazione e To-Do List verranno attivati nei prossimi step. Il modulo di caricamento dati è operativo.
        </p>
      </div>
    </div>
  );
}