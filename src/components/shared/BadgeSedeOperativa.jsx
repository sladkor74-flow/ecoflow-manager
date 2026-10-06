import React from 'react';
import { Link } from 'react-router-dom';
import { sedeDelPunto, sedeDecisaAltrove } from '@/lib/sediIndice';
import { normalizzaSoggetto } from '@/lib/sediOperative';

// Segno della sede operativa accanto a un punto di raccolta: serve quando si
// programma il ritiro, perche' sul formulario va la sede operativa e non la sede
// legale. Il segno dice se quello che c'e' in anagrafica e' stato controllato
// contro quello che si trova in rete, e se qualcuno ha deciso.
// Non e' un giudizio sul produttore: e' lo stato di un controllo.

const unaRiga = (...parti) => parti.filter(p => String(p || '').trim()).join(', ');

export default function BadgeSedeOperativa({ indice, idPdr, nome, record }) {
  if (!indice) return <span className="text-muted-foreground text-xs">…</span>;
  if (indice.errore) return <span className="text-muted-foreground text-xs" title="Controlli delle sedi non disponibili">?</span>;
  const v = sedeDelPunto(indice, idPdr);
  // IL GOMMISTA CHE SI RE-ISCRIVE. Il portale gli da' un numero nuovo e il punto
  // risulta mai controllato, ma la sua sede era gia' stata decisa su un altro
  // punto: dirlo qui evita di rifare il lavoro e di stampare l'indirizzo vecchio.
  const altrove = sedeDecisaAltrove(indice, record || { id_pdr: idPdr, ragione_sociale: nome });
  if (!v && altrove) {
    const suo = [altrove.indirizzo_per_formulario || altrove.indirizzo_portale, altrove.comune_per_formulario || altrove.comune_portale].filter(Boolean).join(', ');
    return (
      <Link to={`/pdr?scheda=sedi${nome ? `&cerca=${encodeURIComponent(nome)}` : ''}`}>
        <span className="inline-block px-1.5 py-0.5 rounded border text-xs whitespace-nowrap bg-sky-50 text-sky-900 border-sky-300"
          title={`Questo punto non e' mai stato controllato, ma lo stesso soggetto ha gia' una sede decisa sul punto di raccolta ${altrove.id_pdr}: ${suo}. E' un altro punto: controlla questo prima di usarla.`}>
          decisa altrove
        </span>
      </Link>
    );
  }
  if (!v) return <span className="text-muted-foreground text-xs" title="Sede operativa mai controllata">—</span>;
  // Un numero di punto di raccolta dice quale posto, non chi: se l'ordine e' di
  // un'altra azienda rispetto al controllo, quel controllo non parla di lui.
  if (nome && v.ragione_sociale && normalizzaSoggetto(nome) !== normalizzaSoggetto(v.ragione_sociale)) {
    return (
      <span className="inline-block px-1.5 py-0.5 rounded border text-xs whitespace-nowrap bg-amber-50 text-amber-900 border-amber-300"
        title={`Il controllo della sede su questo punto di raccolta era intestato a ${v.ragione_sociale}: non vale per ${nome}, va rifatto.`}>
        da rifare
      </span>
    );
  }

  const indirizzoCorretto = unaRiga(v.indirizzo_per_formulario, v.cap_per_formulario, v.comune_per_formulario, v.provincia_per_formulario);
  const trovato = unaRiga(v.indirizzo_trovato, v.cap_trovato, v.comune_trovato, v.provincia_trovato);
  const portale = unaRiga(v.indirizzo_portale, v.cap_portale, v.comune_portale, v.provincia_portale);

  let testo, classe, avvisa = false;
  if (v.stato === 'corretto' && indirizzoCorretto) {
    testo = 'sede corretta';
    classe = 'bg-amber-50 text-amber-900 border-amber-300';
  } else if (v.stato === 'confermato_portale') {
    testo = 'sede ok';
    classe = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (v.stato === 'ignorato') {
    testo = 'non controllare';
    classe = 'bg-slate-50 text-slate-700 border-slate-200';
  } else if (v.esito === 'diverso' || v.esito === 'incerto') {
    testo = 'sede da decidere';
    classe = 'bg-red-50 text-red-800 border-red-300';
    avvisa = true;
  } else if (v.esito === 'coincide') {
    testo = 'sede ok';
    classe = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else {
    testo = 'non trovata';
    classe = 'bg-slate-50 text-slate-700 border-slate-200';
  }

  const spiega = [
    `A portale: ${portale || 'non indicato'}.`,
    trovato ? `In rete: ${trovato}.` : 'In rete non e\' stata trovata una sede consultabile.',
    v.stato === 'corretto' ? `Sul formulario va: ${indirizzoCorretto}.` : null,
    v.stato === 'confermato_portale' ? 'L\'indirizzo del portale e\' stato controllato e confermato.' : null,
    avvisa ? 'Nessuno ha ancora deciso quale indirizzo vale: controlla prima di preparare il formulario.' : null,
    `Controllato il ${String(v.verificato_il || '').slice(0, 10)}.`,
  ].filter(Boolean).join(' ');

  const contenuto = (
    <span className={`inline-block px-1.5 py-0.5 rounded border text-xs whitespace-nowrap ${classe}`} title={spiega}>
      {avvisa ? '≠ ' : ''}{testo}
    </span>
  );
  if (!avvisa && v.stato !== 'corretto') return contenuto;
  return <Link to={`/pdr?scheda=sedi${nome ? `&cerca=${encodeURIComponent(nome)}` : ''}`}>{contenuto}</Link>;
}
