import React from 'react';
import { Warehouse, ClipboardList, FileCheck, PackageOpen, Target, CalendarX } from 'lucide-react';
import { formatNumber, formatTonnellate } from '@/lib/utils';

function fmt(n, dec = 2) {
  if (n == null || n === '' || isNaN(n)) return '—';
  // Conteggi interi; tonnellate con due decimali, tre se i kg non sono tondi.
  return dec === 0 ? formatNumber(n, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : dec === 2 ? formatTonnellate(n) : formatNumber(n, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function GiacenzeKpi({ totali }) {
  // Il target Ecotyre e' di raccolta, quindi la copertura si misura sulle sole
  // primarie. Sommarci le secondarie conterebbe due volte lo stesso pneumatico:
  // una quando viene raccolto e una quando passa dallo stoccaggio all'impianto.
  // Solo canale RETE: ACI ed Extra Raccolta sono canali indipendenti e non
  // entrano nel target.
  const copertura = totali.target_totale_t > 0
    ? (totali.conferito_primarie_t / totali.target_totale_t * 100)
    : null;

  const cards = [
    // Un canale per volta: la giacenza a portale e' della rete, l'ACI si scrive a parte.
    { label: 'Giacenza rete a portale', value: fmt(totali.giacenza_portale_t), unit: 't', icon: Warehouse, color: 'text-primary', subtitle: totali.giacenza_aci_t ? `ACI negli stoccaggi ${fmt(totali.giacenza_aci_t)} t, a parte` : 'aggiornata a ogni caricamento' },
    { label: 'Ordini da dichiarare', value: fmt(totali.ordini_da_dichiarare, 0), unit: '', icon: ClipboardList, color: 'text-amber-600' },
    { label: 'Dichiarato nell\'anno', value: fmt(totali.dichiarato_t), unit: 't', icon: FileCheck, color: 'text-success', subtitle: 'rete, per fine trasporto' },
    { label: 'Raccolto RETE nell\'anno', value: fmt(totali.conferito_primarie_t), unit: 't', icon: PackageOpen, color: 'text-accent', subtitle: `ACI ${fmt(totali.conferito_aci_t)} t · Extra ${fmt(totali.conferito_extra_t)} t, fuori target` },
    { label: 'Copertura target RETE', value: copertura != null ? fmt(copertura, 1) : '—', unit: '%', icon: Target, color: copertura != null && copertura >= 100 ? 'text-success' : 'text-amber-600' },
  ];
  // I formulari terminati senza tutte le date obbligatorie (regola dell'utente,
  // 22/09/2026): la rete in grande, ACI ed extra raccolta a parte, mai sommati.
  // Le terziarie non sono un canale - partono verso le cementerie e la giacenza
  // di PFU non la toccano - e hanno la loro voce: contate nella rete facevano
  // dire alla rete un numero che non era il suo.
  const date = totali.date_da_sistemare;
  if (date) {
    const d = (c) => date[c] || { n: 0, senza_fine: 0 };
    const qualcosa = ['RETE', 'ACI', 'EXTRA_RACCOLTA', 'TERZIARIE'].some(c => d(c).n > 0);
    cards.push({
      label: 'Formulari RETE con date da sistemare',
      value: fmt(d('RETE').n, 0),
      unit: '',
      icon: CalendarX,
      color: qualcosa ? 'text-amber-600' : 'text-success',
      subtitle: qualcosa
        ? `${d('RETE').senza_fine} senza fine trasporto, fuori dai periodi · ACI ${d('ACI').n} · Extra ${d('EXTRA_RACCOLTA').n} · Terziarie ${d('TERZIARIE').n}, a parte`
        : 'immissione, inizio e fine trasporto ci sono tutte',
    });
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div key={i} className="bg-card border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className={`w-3.5 h-3.5 ${c.color}`} />
              {c.label}
            </div>
            <div className={`text-xl font-bold ${c.color}`}>
              {c.value} {c.unit && <span className="text-xs font-normal text-muted-foreground">{c.unit}</span>}
            </div>
            {c.subtitle && (
              <div className="text-[10px] leading-tight text-muted-foreground">{c.subtitle}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}