import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

const TIPO_LABEL = {
  coerenza_derivati: 'Incoerenza derivati',
  sito_senza_target: 'Sito senza target',
  giacenza_sopra_target: 'Giacenza sopra target',
  ordine_senza_riscontro: 'Ordine senza riscontro',
  stoccaggio_senza_rilevazione: 'Stoccaggio senza rilevazione',
  giacenza_negativa: 'Giacenza negativa',
};

export default function AnomalieAlert({ anomalie }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span className="font-semibold text-amber-900">
            {anomalie.length} {anomalie.length === 1 ? 'anomalia rilevata' : 'anomalie rilevate'}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-amber-700" /> : <ChevronDown className="w-4 h-4 text-amber-700" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-1.5 max-h-64 overflow-y-auto">
          {anomalie.map((a, i) => (
            <div key={i} className="text-sm text-amber-900 flex items-start gap-2 border-t border-amber-200 pt-1.5">
              <span className="font-medium">{TIPO_LABEL[a.tipo] || a.tipo}:</span>
              <span className="text-amber-800">
                {a.tipo === 'ordine_senza_riscontro' && `ordine ${a.ordine} non trovato in PrimariaRete/Aci — ruolo attribuito come Impianto`}
                {a.sito && a.sito}
                {a.tipo === 'coerenza_derivati' && ` — dichiarato ${a.dichiarato_t} t, derivati ${a.somma_derivati_t} t (diff. ${a.differenza_t} t)`}
                {a.tipo === 'giacenza_sopra_target' && ` — giacenza ${a.giacenza_portale_t} t contro target ${a.target_totale_t} t`}
                {a.tipo === 'sito_senza_target' && ` — nessun record GiacenzaSito per l'anno ${a.anno}`}
                {a.tipo === 'giacenza_negativa' && ` — classe ${a.classe}: ${a.kg} kg dopo i movimenti successivi alla rilevazione, mancano ingressi o la rilevazione va aggiornata`}
                {a.tipo === 'stoccaggio_senza_rilevazione' && ` — il dato va letto dalla pagina Unita' Locali di Stoccaggio del portale`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}