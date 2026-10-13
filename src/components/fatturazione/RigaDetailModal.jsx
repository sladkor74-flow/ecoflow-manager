import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatKg, formatTonnellate } from '@/lib/utils';
import { euro, prezzoUnitario } from '@/lib/formatoSoldi';
import { giornoRoma } from '@/lib/giornoItaliano';
import { FATTURANTE_ATTIVA } from '@/lib/ecotyreTariffe';
import { testoEuroT } from '@/lib/surplus';
import { eRigaSurplus, formulaSurplus, dettaglioRigaSurplus, tonnellateDaKg, STILE_SURPLUS } from '@/lib/surplusVista';
import NomeSurplus from './NomeSurplus';

const STATO_COLOR = {
  verificato: 'bg-green-100 text-green-700',
  da_controllare: 'bg-amber-100 text-amber-700',
  errore: 'bg-red-100 text-red-700',
};
const CANALI = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };

// Importi, prezzi e date all'italiana (chiusura dell'audit, 11/10/2026): qui si
// leggeva «€ 0.2020» e «€ 202.0000», con il punto per i decimali, e la fine
// trasporto col fuso del dispositivo invece del giorno italiano.
const giornoIt = (v) => { const g = giornoRoma(v); return g ? g.split('-').reverse().join('/') : 'N/D'; };

// La formula come si legge, per ogni unita' della riga: prima diceva «kg ÷ 1000»
// anche per un sovracosto a corpo, che chili non ne ha. La riga di un surplus
// (13/10/2026) ha zero chili apposta: la sua formula e' sulle tonnellate del mese.
export function formula(riga) {
  if (eRigaSurplus(riga)) return formulaSurplus(riga);
  const u = riga.unita_misura;
  const totale = euro(riga.totale);
  if (u === '€ a corpo') return `Importo a corpo scritto sull'intervento = ${totale}`;
  if (u === '€/viaggio' || u === '€/vg') return `${prezzoUnitario(riga.tariffa_valore)} a viaggio = ${totale}`;
  if (u === '€/kg') return `${formatKg(riga.quantita || 0)} kg × ${prezzoUnitario(riga.tariffa_valore)}/kg = ${totale}`;
  return `${formatKg(riga.quantita || 0)} kg ÷ 1.000 × ${prezzoUnitario(riga.tariffa_valore)}/t = ${totale}`;
}

// LA SCHEDA DELLA RIGA DI UN SURPLUS (il Fuel Surcharge, 13/10/2026). Non ha
// ordine, formulario, regione ne' classe: ha un nome, un'origine e un periodo,
// gli ordini del mese su cui vale e le loro tonnellate. Si dice com'e' fatta la
// riga in fattura e perche' l'importo si arrotonda una volta sul mese: riga per
// riga il centesimo cambierebbe (sui dati veri di settembre 2026 la rete farebbe
// 5.601,21 invece di 5.601,20).
function CorpoSurplus({ riga }) {
  const dettaglio = dettaglioRigaSurplus(riga);
  return (
    <div className="space-y-3">
      <div className={`rounded-md px-3 py-2 ${STILE_SURPLUS.fondo}`}>
        <NomeSurplus nome={riga.descrizione} />
        {dettaglio && <p className="text-xs text-muted-foreground mt-1">{dettaglio}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Canale:</span> <span className="font-medium">{CANALI[riga.tipologia] || riga.tipologia}</span></div>
        <div><span className="text-muted-foreground">Fatturante:</span> <span className="font-medium">{FATTURANTE_ATTIVA}</span></div>
        <div><span className="text-muted-foreground">Vale su:</span> <span className="font-medium">{riga.record_count ? `${riga.record_count} ${riga.record_count === 1 ? 'ordine' : 'ordini'} del mese` : 'N/D'}</span></div>
        <div><span className="text-muted-foreground">Stato:</span> <span className={`text-xs px-2 py-0.5 rounded ${STATO_COLOR[riga.stato_validazione] || ''}`}>{riga.stato_validazione}</span></div>
      </div>
      <div className="border-t pt-3">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><span className="text-muted-foreground block text-xs">Tonnellate del mese (le stesse dei formulari)</span><span className="font-bold tabular-nums">{tonnellateDaKg(riga.kg_riferimento)} t</span></div>
          <div><span className="text-muted-foreground block text-xs">Surplus</span><span className="font-bold tabular-nums">{testoEuroT(riga.tariffa_valore) || '—'}</span></div>
          <div><span className="text-muted-foreground block text-xs">Totale</span><span className="font-bold text-lg tabular-nums">{euro(riga.totale)}</span></div>
        </div>
      </div>
      <div className="border-t pt-3">
        <div className="text-sm text-muted-foreground mb-1">Formula applicata:</div>
        <div className="text-sm font-mono bg-muted p-2 rounded">{formula(riga)}</div>
        <p className="text-xs text-muted-foreground mt-1.5">È una riga sola per canale, sotto quelle dei formulari: i suoi chili sono quelli dei formulari, e l&apos;importo si arrotonda al centesimo una volta sul mese, non formulario per formulario.</p>
      </div>
      <div className="text-xs text-muted-foreground">
        Record del surplus: <span className="font-mono">{riga.surplus_id || riga.origine_record_id || 'N/D'}</span>
      </div>
    </div>
  );
}

/** Il contenuto della scheda di una riga: quella di un formulario, o quella di un surplus. */
export function CorpoRiga({ riga }) {
  if (!riga) return null;
  if (eRigaSurplus(riga)) return <CorpoSurplus riga={riga} />;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Tipologia:</span> <span className="font-medium">{riga.tipologia}</span></div>
        {/* Chi emette la fattura attiva e' SMOCO, su tutti e tre i canali
            (l'utente, 11/10/2026). Le righe salvate prima portano ancora
            'ECOTYRE' nel campo: non si riscrivono, si mostra il soggetto vero. */}
        <div><span className="text-muted-foreground">Fatturante:</span> <span className="font-medium">{FATTURANTE_ATTIVA}</span></div>
        <div><span className="text-muted-foreground">Regione:</span> <span className="font-medium">{riga.regione || 'N/D'}</span></div>
        <div><span className="text-muted-foreground">Ordine:</span> <span className="font-medium font-mono">{riga.ordine || 'N/D'}</span></div>
        <div><span className="text-muted-foreground">Numero FIR:</span> <span className="font-medium">{riga.numero_fir || 'N/D'}</span></div>
        <div><span className="text-muted-foreground">Ticket n°:</span> <span className="font-medium">{riga.ticket_n || 'N/D'}</span></div>
        <div><span className="text-muted-foreground">Classe:</span> <span className="font-medium">{riga.classe || 'N/D'}</span></div>
        <div><span className="text-muted-foreground">EER:</span> <span className="font-medium">{riga.eer_codice || 'N/D'}</span></div>
        <div><span className="text-muted-foreground">Data fine trasporto:</span> <span className="font-medium">{giornoIt(riga.data_fine_trasporto)}</span></div>
        <div><span className="text-muted-foreground">Origine dato:</span> <span className="font-medium">{riga.origine_dato}</span></div>
      </div>
      <div className="border-t pt-3">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><span className="text-muted-foreground block text-xs">Quantità</span><span className="font-bold">{riga.unita_quantita === 'kg' || !riga.unita_quantita ? formatKg(riga.quantita || 0) : formatTonnellate(riga.quantita || 0)} {riga.unita_quantita || 'kg'}</span></div>
          <div><span className="text-muted-foreground block text-xs">Prezzo unitario</span><span className="font-bold tabular-nums">{prezzoUnitario(riga.tariffa_valore)} {riga.unita_misura}</span></div>
          <div><span className="text-muted-foreground block text-xs">Totale</span><span className="font-bold text-lg tabular-nums">{euro(riga.totale)}</span></div>
        </div>
      </div>
      <div className="border-t pt-3">
        <div className="text-sm text-muted-foreground mb-1">Formula applicata:</div>
        <div className="text-sm font-mono bg-muted p-2 rounded">{formula(riga)}</div>
      </div>
      {riga.note && <div className="text-xs text-muted-foreground">{riga.note}</div>}
      <div className="text-xs text-muted-foreground">
        Record sorgente: <span className="font-mono">{riga.origine_record_id || 'N/D'}</span>
      </div>
      {riga.sospesa && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          ⚠ Sospesa: {riga.motivo_sospensione || 'Motivo non specificato'}
        </div>
      )}
      <div className="flex items-center justify-between border-t pt-3">
        <span className={`text-xs px-2 py-1 rounded ${STATO_COLOR[riga.stato_validazione] || ''}`}>{riga.stato_validazione}</span>
      </div>
    </div>
  );
}

export default function RigaDetailModal({ riga, onClose }) {
  return (
    <Dialog open={!!riga} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{riga && eRigaSurplus(riga) ? `Riga del surplus — ${riga.descrizione || 'Surplus'}` : 'Dettaglio Riga Fatturazione'}</DialogTitle></DialogHeader>
        {riga && <CorpoRiga riga={riga} />}
      </DialogContent>
    </Dialog>
  );
}
