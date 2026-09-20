import React, { useState, useEffect } from 'react';
import { Loader2, MapPin, Eye } from 'lucide-react';
import { streetViewUrl, precisioneCoordinata } from '@/lib/geoLinks';
import { useIndiceOmologhe } from '@/lib/omologheIndice';
import BadgeOmologa from '@/components/shared/BadgeOmologa';
import { formatIntero } from '@/lib/utils';

// I punti di raccolta sono piu' di tremila: disegnarli tutti insieme pesa mezzo
// milione di caratteri a video e su un telefono si sente. Se ne mostrano 200 alla
// volta; ricerca, filtri ed esportazione lavorano comunque su tutti.
const PASSO = 200;

export default function PdrTable({ records, loading, onSelectPdr }) {
  const indiceOmologhe = useIndiceOmologhe();
  const [quante, setQuante] = useState(PASSO);
  // cambiando filtro o ricerca si riparte dalle prime
  useEffect(() => { setQuante(PASSO); }, [records]);
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Caricamento elenco PDR...
      </div>
    );
  }
  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
        Nessun PDR trovato.
      </div>
    );
  }
  return (
    <div className="border rounded-lg overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-2 py-2.5 w-20"></th>
            <th className="text-left px-3 py-2.5 font-medium">Cod. Esterno</th>
            <th className="text-left px-3 py-2.5 font-medium">Ragione Sociale</th>
            <th className="text-left px-3 py-2.5 font-medium" title="Omologa registrata per il punto di raccolta, con la sua scadenza">Omologa</th>
            <th className="text-left px-3 py-2.5 font-medium">Comune</th>
            <th className="text-left px-3 py-2.5 font-medium">Prov.</th>
            <th className="text-left px-3 py-2.5 font-medium">Cod. Fiscale</th>
            <th className="text-left px-3 py-2.5 font-medium">Partita IVA</th>
            <th className="text-left px-3 py-2.5 font-medium">Cod. Import</th>
            <th className="text-left px-3 py-2.5 font-medium">Trasportatore</th>
            <th className="text-left px-3 py-2.5 font-medium">Key Account</th>
            <th className="text-left px-3 py-2.5 font-medium">Partner</th>
            <th className="text-left px-3 py-2.5 font-medium">Tel PDR</th>
            <th className="text-left px-3 py-2.5 font-medium">Email PDR</th>
            <th className="text-left px-3 py-2.5 font-medium">Precisione</th>
          </tr>
        </thead>
        <tbody>
          {records.slice(0, quante).map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/50">
              <td className="px-2 py-2 text-center">
                {(() => {
                  const lat = parseFloat(r.latitudine);
                  const lng = parseFloat(r.longitudine);
                  const hasCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
                  return (
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        disabled={!hasCoords}
                        onClick={() => hasCoords && onSelectPdr?.(r.id)}
                        title={hasCoords ? 'Vedi sulla mappa' : 'Coordinate non disponibili'}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <MapPin className="w-4 h-4 text-primary" />
                      </button>
                      {hasCoords ? (
                        <a
                          href={streetViewUrl(lat, lng)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Apri Street View"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted"
                        >
                          <Eye className="w-4 h-4 text-primary" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="Coordinate non disponibili"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Eye className="w-4 h-4 text-primary" />
                        </button>
                      )}
                    </div>
                  );
                })()}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{r.codice_esterno || '—'}</td>
              <td className="px-3 py-2 font-medium">{r.ragione_sociale || '—'}</td>
              <td className="px-3 py-2"><BadgeOmologa indice={indiceOmologhe} idPdr={r.id_pdr} idCliente={r.id_cliente} nome={r.ragione_sociale} /></td>
              <td className="px-3 py-2">{r.comune || '—'}</td>
              <td className="px-3 py-2">{r.provincia || '—'}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.codice_fiscale || '—'}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.partita_iva || '—'}</td>
              <td className="px-3 py-2">{r.codice_import || '—'}</td>
              <td className="px-3 py-2">{r.trasportatore_principale || '—'}</td>
              <td className="px-3 py-2">{r.key_account || '—'}</td>
              <td className="px-3 py-2">{r.partner_operativo || '—'}</td>
              <td className="px-3 py-2">
                {r.tel_pdr ? <a href={`tel:${r.tel_pdr}`} className="text-primary underline">{r.tel_pdr}</a> : '—'}
              </td>
              <td className="px-3 py-2">
                {r.email_pdr ? <a href={`mailto:${r.email_pdr}`} className="text-primary underline">{r.email_pdr}</a> : '—'}
              </td>
              <td className="px-3 py-2">
                {(() => {
                  const lat = parseFloat(r.latitudine);
                  const lng = parseFloat(r.longitudine);
                  const hasCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
                  const prec = precisioneCoordinata(r.geo_approssimazione);
                  const livello = hasCoords ? prec.livello : 'ignoto';
                  const badgeClass = {
                    ok: 'bg-success/10 text-success',
                    medio: 'bg-chart-4/10 text-chart-4',
                    basso: 'bg-destructive/10 text-destructive',
                    ignoto: 'bg-muted text-muted-foreground',
                  }[livello];
                  const abbrev = {
                    ok: 'Precisa',
                    medio: 'Da verificare',
                    basso: 'Approssimativa',
                    ignoto: 'Non nota',
                  }[livello];
                  const tooltip = hasCoords ? prec.etichetta : 'Coordinate non disponibili';
                  return (
                    <span title={tooltip} className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>
                      {abbrev}
                    </span>
                  );
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {records.length > quante && (
        <div className="flex flex-wrap items-center justify-center gap-3 border-t bg-muted/30 px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">Mostrati {formatIntero(quante)} punti di raccolta su {formatIntero(records.length)}.</span>
          <button type="button" onClick={() => setQuante(q => q + PASSO)} className="text-primary hover:underline font-medium">Mostra altri {formatIntero(Math.min(PASSO, records.length - quante))}</button>
          <button type="button" onClick={() => setQuante(records.length)} className="text-primary hover:underline">Mostra tutti</button>
        </div>
      )}
    </div>
  );
}