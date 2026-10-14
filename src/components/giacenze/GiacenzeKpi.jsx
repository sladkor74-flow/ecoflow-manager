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

  // IL TOTALE CHE NON SI FA DICE PERCHE' (giro del 14/10/2026 sulle decisioni
  // dell'utente del 13/10/2026). Il valore era gia' «—», ma sotto c'era scritto
  // «aggiornata a ogni caricamento», come se il numero ci fosse: sul 2025 (prima
  // del gestionale) e sul 2026 guardato a gennaio prima della chiusura. Ora il
  // sottotitolo dice in breve perche', e il perche' intero sta al passaggio del
  // mouse, con le parole che la tabella scrive sopra i numeri.
  const manca = (v) => v === null || v === undefined;
  const percheTotale = (canale) => (totali.prima_del_gestionale
    ? totali.perche_prima_del_gestionale
    : totali.perche_totali && totali.perche_totali[canale]) || '';
  // L'ACI RESTA IN TESTA ANCHE QUANDO LA RETE NON C'E' (revisione del
  // 14/10/2026). Col totale di rete «—» il sottotitolo diceva solo «il totale non
  // si fa», e l'ACI che invece c'e' spariva dalle caselle: ogni gennaio, finche'
  // la chiusura non salva la lettura del 31/12, e nell'anno in corso quando un
  // impianto non ha il file degli ordini non dichiarati (il 04/10/2026 erano
  // 26,81 t). Si scrive a parte, accanto al perche' della rete: e' un altro
  // canale e non si somma. Su un anno prima del gestionale l'ACI non c'e' e il
  // perche' e' lo stesso dell'anno, quindi non si ripete.
  const aciSenzaTotale = manca(totali.giacenza_aci_t) && !totali.prima_del_gestionale && percheTotale('ACI');
  const aciAParte = totali.giacenza_aci_t ? `ACI ${fmt(totali.giacenza_aci_t)} t, a parte` : aciSenzaTotale ? 'ACI —, a parte' : '';
  const sottotitoloRete = manca(totali.giacenza_portale_t)
    ? (totali.prima_del_gestionale ? 'prima del gestionale: non si ricostruisce, e non vuol dire zero' : 'il totale non si fa: una riga senza numero non vale zero') + (aciAParte ? ` · ${aciAParte}` : '')
    : aciSenzaTotale
      ? "ACI —, a parte: il totale non si fa"
      : totali.giacenza_aci_t ? `ACI ${fmt(totali.giacenza_aci_t)} t, a parte: e' un altro canale` : 'aggiornata a ogni caricamento';
  const percheRete = manca(totali.giacenza_portale_t)
    ? [percheTotale('RETE'), aciSenzaTotale ? `ACI: ${percheTotale('ACI')}` : ''].filter(Boolean).join(' ')
    : aciSenzaTotale ? percheTotale('ACI') : '';

  const cards = [
    // Un canale per volta: la giacenza a portale e' della rete, l'ACI si scrive a parte.
    // L'ACI NON STA SOLO NEGLI STOCCAGGI. Il sottotitolo diceva «ACI negli
    // stoccaggi»: e' il totale ACI di tutti i siti, e il 04/10/2026 quei 26,81 t
    // stavano per intero su due IMPIANTI (Gatim 25,17 e Tecnogum 1,64). Chi lo
    // leggeva andava a cercarli nei piazzali. Il numero era giusto, la parola no.
    { label: 'Giacenza rete a portale', value: fmt(totali.giacenza_portale_t), unit: 't', icon: Warehouse, color: 'text-primary', subtitle: sottotitoloRete, perche: percheRete },
    // Su un anno passato gli ordini sono i carichi di quell'anno ancora da
    // dichiarare oggi (calcolaGiacenze, giro del 14/10/2026): il file del portale
    // e' di oggi. Lo dice la casella, come la colonna della Situazione. L'anno
    // si legge da ordini_dei_carichi_del, mai dall'anno dell'attesa: sull'anno
    // dopo l'attesa e' dei carichi di quell'anno, gli ordini sono tutto il file.
    { label: 'Ordini da dichiarare', value: fmt(totali.ordini_da_dichiarare, 0), unit: '', icon: ClipboardList, color: 'text-amber-600',
      ...(totali.ordini_dei_carichi_del ? { subtitle: `dei carichi del ${totali.ordini_dei_carichi_del} ancora da dichiarare oggi` } : {}) },
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
              {/* «— t» diceva un'unita' di un numero che non c'e' (14/10/2026). */}
              {c.value} {c.unit && c.value !== '—' && <span className="text-xs font-normal text-muted-foreground">{c.unit}</span>}
            </div>
            {c.subtitle && (
              <div className={`text-[10px] leading-tight text-muted-foreground${c.perche ? ' cursor-help' : ''}`} title={c.perche || undefined}>{c.subtitle}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}