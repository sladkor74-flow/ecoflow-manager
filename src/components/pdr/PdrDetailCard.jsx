import React, { useState } from 'react';
import { Eye, Globe, MapPin, Search, Loader2, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { streetViewUrl, satelliteUrl, addressSearchUrl, precisioneCoordinata } from '@/lib/geoLinks';
import { useIndiceOmologhe } from '@/lib/omologheIndice';
import BadgeOmologa from '@/components/shared/BadgeOmologa';
import { useIndiceSedi, sedeDelPunto, sedeDecisaAltrove, dimenticaIndiceSedi } from '@/lib/sediIndice';
import { indirizzoPerFormulario } from '@/lib/sediOperative';

function DetailField({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{value || '—'}</dd>
    </div>
  );
}

export default function PdrDetailCard({ r }) {
  const indiceOmologhe = useIndiceOmologhe();
  // La sede operativa: quella che va sul formulario. Si puo' controllare in rete
  // questo punto da solo, senza aspettare il giro di tutti.
  const [versioneSedi, setVersioneSedi] = useState(0);
  const [controllo, setControllo] = useState('');
  const indiceSedi = useIndiceSedi(versioneSedi);
  const verificaSede = sedeDelPunto(indiceSedi, r.id_pdr);
  const perFormulario = indirizzoPerFormulario(r, verificaSede);
  // Lo stesso gommista puo' essersi re-iscritto con un numero nuovo: la sede che
  // avevi deciso sul punto vecchio non vale qui, ma devi saperlo.
  const decisaAltrove = !verificaSede ? sedeDecisaAltrove(indiceSedi, r) : null;
  const controllaSede = async () => {
    setControllo('in corso');
    try {
      await base44.functions.invoke('verificaSediPdr', { ids: [r.id_pdr], motivo: 'chiesto dalla scheda del punto di raccolta' });
      dimenticaIndiceSedi();
      setVersioneSedi(v => v + 1);
      setControllo('');
    } catch (e) {
      setControllo(e?.response?.data?.error || e?.message || 'Controllo non riuscito');
    }
  };
  const isSospeso = !!(r.sospeso && String(r.sospeso).trim() !== '');
  const tel = r.tel_pdr || r.tel || null;
  const email = r.email_pdr || r.email || null;
  const indirizzo = [r.indirizzo_pdr, r.cap_pdr, r.comune_pdr, r.provincia_pdr].filter(Boolean).join(', ');
  const hasCoords = r._lat != null && r._lng != null;

  return (
    <div className="border rounded-lg p-4 bg-card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-base truncate">{r.descrizione_pdr || 'PDR'}</h3>
          <p className="text-sm text-muted-foreground truncate">{r.ragione_sociale || ''}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${isSospeso ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
          {isSospeso ? 'Sospeso' : 'Attivo'}
        </span>
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <DetailField label="Partita IVA" value={r.partita_iva} />
        <DetailField label="Indirizzo PDR" value={indirizzo} />
        <DetailField label="Riferimento PDR" value={r.riferimento_pdr} />
        <div>
          <dt className="text-xs text-muted-foreground">Telefono</dt>
          <dd className="text-sm font-medium break-all">
            {tel ? <a href={`tel:${tel}`} className="text-primary underline">{tel}</a> : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Email</dt>
          <dd className="text-sm font-medium break-all">
            {email ? <a href={`mailto:${email}`} className="text-primary underline">{email}</a> : '—'}
          </dd>
        </div>
        <DetailField label="Trasportatore" value={r.trasportatore_principale} />
        <DetailField label="Key Account" value={r.key_account} />
        <DetailField label="Partner Operativo" value={r.partner_operativo} />
        <DetailField label="Cod. Esterno PDR" value={r.codice_esterno_pdr} />
        <DetailField label="ID PDR" value={r.id_pdr} />
        <div>
          <dt className="text-xs text-muted-foreground">Omologa</dt>
          <dd className="text-sm"><BadgeOmologa indice={indiceOmologhe} idPdr={r.id_pdr} idCliente={r.id_cliente} nome={r.ragione_sociale || r.descrizione_pdr} /></dd>
        </div>
        <DetailField label="ID U/L RENTRi" value={r.rentri_id_ul} />
        <DetailField label="Coordinate" value={hasCoords ? `${r._lat}, ${r._lng}` : null} />
      </dl>
      <div className="border-t pt-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-muted-foreground">Sede operativa, quella che va sul formulario</dt>
          <button onClick={controllaSede} disabled={controllo === 'in corso'}
            className="inline-flex items-center gap-1.5 text-xs border rounded-md px-2 py-1 hover:bg-muted disabled:opacity-60">
            {controllo === 'in corso' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {verificaSede ? 'Ricontrolla in rete' : 'Controlla in rete'}
          </button>
        </div>
        <p className={`text-sm font-medium ${perFormulario.origine === 'portale_da_controllare' ? 'text-red-800' : ''}`}>
          {[perFormulario.indirizzo, perFormulario.cap, perFormulario.comune, perFormulario.provincia].filter(Boolean).join(', ') || '—'}
        </p>
        <p className="text-xs text-muted-foreground">{perFormulario.nota}</p>
        {decisaAltrove && (
          <p className="text-xs text-sky-900">
            Questo punto non è mai stato controllato, ma lo stesso soggetto ha già una sede decisa sul punto di raccolta {decisaAltrove.id_pdr}:{' '}
            {[decisaAltrove.indirizzo_per_formulario || decisaAltrove.indirizzo_portale, decisaAltrove.comune_per_formulario || decisaAltrove.comune_portale].filter(Boolean).join(', ')}. È un altro punto: controlla questo prima di usarla.
          </p>
        )}
        {verificaSede && verificaSede.indirizzo_trovato && perFormulario.origine !== 'confermato' && (
          <p className="text-xs text-muted-foreground">
            In rete risulta: {[verificaSede.indirizzo_trovato, verificaSede.cap_trovato, verificaSede.comune_trovato, verificaSede.provincia_trovato].filter(Boolean).join(', ')}
          </p>
        )}
        {verificaSede && !!(verificaSede.fonti || []).length && (
          <div className="flex flex-wrap gap-2">
            {verificaSede.fonti.map((f, i) => (
              <a key={i} href={f} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline">
                <ExternalLink className="w-3 h-3" /> fonte {i + 1}
              </a>
            ))}
          </div>
        )}
        {controllo && controllo !== 'in corso' && <p className="text-xs text-destructive">{controllo}</p>}
      </div>
      {hasCoords && (() => {
        const prec = precisioneCoordinata(r.geo_approssimazione);
        const badgeClass = {
          ok: 'bg-success/10 text-success',
          medio: 'bg-chart-4/10 text-chart-4',
          basso: 'bg-destructive/10 text-destructive',
          ignoto: 'bg-muted text-muted-foreground',
        }[prec.livello];
        return (
          <div className="space-y-2">
            <span className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full ${badgeClass}`}>
              {prec.etichetta}
            </span>
            <div className="flex flex-wrap gap-2">
              <a href={streetViewUrl(r._lat, r._lng)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm border rounded-md px-3 py-1.5 hover:bg-muted">
                <Eye className="w-4 h-4" /> Street View
              </a>
              <a href={satelliteUrl(r._lat, r._lng)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm border rounded-md px-3 py-1.5 hover:bg-muted">
                <Globe className="w-4 h-4" /> Vista satellitare
              </a>
              <a href={addressSearchUrl(r)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm border rounded-md px-3 py-1.5 hover:bg-muted">
                <MapPin className="w-4 h-4" /> Cerca indirizzo
              </a>
            </div>
            {prec.livello !== 'ok' && (
              <p className="text-xs text-muted-foreground">
                La coordinata non individua con certezza il punto di raccolta: Street View potrebbe inquadrare una via diversa. Verifica con Cerca indirizzo.
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}