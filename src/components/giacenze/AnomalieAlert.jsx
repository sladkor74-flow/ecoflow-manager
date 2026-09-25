import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import DateDaSistemare from '@/components/giacenze/DateDaSistemare';
import { formatKg, formatTonnellate } from '@/lib/utils';

const TIPO_LABEL = {
  coerenza_derivati: 'Incoerenza derivati',
  sito_senza_target: 'Sito senza target',
  giacenza_sopra_target: 'Giacenza sopra target',
  ordine_senza_riscontro: 'Ordine senza riscontro',
  stoccaggio_senza_rilevazione: 'Stoccaggio senza rilevazione',
  giacenza_negativa: 'Giacenza negativa',
  target_divergente: 'Target diverso da Target & Status',
  ordini_senza_fine_trasporto: 'Righe del file del portale senza fine trasporto',
  rilevazione_da_controllare: 'Rilevazione da controllare',
};

// Un giorno 'AAAA-MM-GG' come lo si legge.
const giorno = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '—');

// Una rilevazione che non torna con i movimenti del periodo (23/09/2026): si
// dice classe per classe che cosa ci si aspettava e che cosa si e' letto. Quando
// il totale del canale torna e sono solo le classi a scostarsi lo si dice, perche'
// e' il caso del 16/09 su Nappi Sud e indirizza la ricerca.
function testoRilevazioneDaControllare(a) {
  const classi = (a.classi || []).map(c => `classe ${c.classe} attesa ${formatKg(c.atteso)} kg, letta ${formatKg(c.letto)} kg (scarto ${Number(c.scarto) > 0 ? '+' : ''}${formatKg(c.scarto)} kg)`);
  const ripartizione = Object.entries(a.canali || {})
    .filter(([, c]) => c.ripartizione_sbagliata)
    .map(([k]) => (k === 'ACI' ? "dell'ACI" : 'della rete'));
  const coda = ripartizione.length
    ? ` — ${ripartizione.length === 1 ? `il totale ${ripartizione[0]} torna` : `i totali ${ripartizione.join(' e ')} tornano`}: a sbagliare e' la ripartizione fra le classi, e ricaricare i file non la corregge`
    : '';
  const contro = a.contro_ancora
    ? `contro l'ancora dell'anno, la lettura del ${giorno(a.precedente_del)} piu' tutti i movimenti da allora`
    : `contro quella del ${giorno(a.precedente_del)}`;
  return ` — rilevazione del ${giorno(a.del)} ${contro}: ${classi.join('; ')}${coda}. Il dettaglio, con gli ordini che possono spiegarlo, e' nella scheda Stoccaggi.`;
}

// Tonnellate con due decimali (tre se i kg non sono tondi), kg interi.
const t = (v) => formatTonnellate(Number(v) || 0);

// Le righe del file del portale senza fine trasporto: quelle che la prendono dal
// formulario del gestionale e quelle che non la trovano in nessuno dei due, che
// nella giacenza a portale ci sono ma in nessun anno dell'arretrato.
function testoSenzaFineFile(a) {
  const nelFile = a.nel_file ?? a.n;
  const parti = [`${nelFile} ${nelFile === 1 ? 'riga' : 'righe'}`];
  if (a.dal_gestionale) parti.push(`${a.dal_gestionale} con la fine trasporto presa dal formulario del gestionale`);
  if (a.n) parti.push(`${a.n}${a.kg ? ` (${formatKg(a.kg)} kg)` : ''} senza la data nemmeno nel gestionale: nella giacenza a portale ci sono, ma in nessun anno dell'arretrato`);
  return parti.join('; ');
}

export default function AnomalieAlert({ anomalie }) {
  const [expanded, setExpanded] = useState(false);
  // I formulari terminati con le date da sistemare (regola dell'utente del
  // 22/09/2026) portano l'elenco degli ordini: si mostrano insieme, per soggetto
  // e canale, con che cosa manca e che cosa comporta per la giacenza.
  const date = anomalie.filter(a => a.tipo === 'date_da_sistemare');
  const altre = anomalie.filter(a => a.tipo !== 'date_da_sistemare');

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-2 text-left">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span className="font-semibold text-amber-900">
            {anomalie.length} {anomalie.length === 1 ? 'anomalia rilevata' : 'anomalie rilevate'}
          </span>
          {date.length > 0 && (
            <span className="text-xs text-amber-800">
              di cui {date.length === 1 ? 'una' : date.length} per formulari terminati senza tutte le date obbligatorie
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-amber-700" /> : <ChevronDown className="w-4 h-4 text-amber-700" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-1.5 max-h-96 overflow-y-auto">
          {date.length > 0 && <DateDaSistemare gruppi={date} mostraSito />}
          {altre.map((a, i) => (
            <div key={i} className="text-sm text-amber-900 flex items-start gap-2 border-t border-amber-200 pt-1.5">
              <span className="font-medium">{TIPO_LABEL[a.tipo] || a.tipo}:</span>
              <span className="text-amber-800">
                {a.tipo === 'ordine_senza_riscontro' && `ordine ${a.ordine} non trovato in PrimariaRete/Aci — ruolo attribuito come Impianto`}
                {a.sito && a.sito}
                {a.tipo === 'coerenza_derivati' && ` — dichiarato ${t(a.dichiarato_t)} t, derivati ${t(a.somma_derivati_t)} t (diff. ${t(a.differenza_t)} t)`}
                {a.tipo === 'giacenza_sopra_target' && ` — giacenza ${t(a.giacenza_portale_t)} t contro target ${t(a.target_totale_t)} t`}
                {a.tipo === 'sito_senza_target' && ` — nessun record GiacenzaSito per l'anno ${a.anno}`}
                {a.tipo === 'giacenza_negativa' && ` — classe ${a.classe}: ${formatKg(a.kg)} kg dall'ancora dell'anno piu' i movimenti successivi: mancano ingressi, o l'ancora ha i chili nella classe sbagliata`}
                {a.tipo === 'target_divergente' && ` — qui ${t(a.giacenze_t)} t, in Target & Status ${t(a.target_status_t)} t (differenza ${t(a.differenza_t)} t): i due numeri devono essere uguali, correggi quello sbagliato`}
                {a.tipo === 'stoccaggio_senza_rilevazione' && ` — il dato va letto dalla pagina Unita' Locali di Stoccaggio del portale`}
                {a.tipo === 'ordini_senza_fine_trasporto' && testoSenzaFineFile(a)}
                {a.tipo === 'rilevazione_da_controllare' && testoRilevazioneDaControllare(a)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
