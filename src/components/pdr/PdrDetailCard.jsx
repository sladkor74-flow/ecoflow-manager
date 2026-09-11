import React from 'react';
import { ExternalLink } from 'lucide-react';

function DetailField({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{value || '—'}</dd>
    </div>
  );
}

export default function PdrDetailCard({ r }) {
  const isSospeso = !!(r.sospeso && String(r.sospeso).trim() !== '');
  const tel = r.tel_pdr || r.tel || null;
  const email = r.email_pdr || r.email || null;
  const indirizzo = [r.indirizzo_pdr, r.cap_pdr, r.comune_pdr, r.provincia_pdr].filter(Boolean).join(', ');
  const hasCoords = r._lat != null && r._lng != null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${r._lat},${r._lng}`;

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
        <DetailField label="ID U/L RENTRi" value={r.rentri_id_ul} />
        <DetailField label="Coordinate" value={hasCoords ? `${r._lat}, ${r._lng}` : null} />
      </dl>
      {hasCoords && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary underline"
        >
          <ExternalLink className="w-4 h-4" /> Apri in Google Maps
        </a>
      )}
    </div>
  );
}