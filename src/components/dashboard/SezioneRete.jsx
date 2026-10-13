import React from 'react';
import { Link } from 'react-router-dom';
import { Truck, Sparkles } from 'lucide-react';
import Sezione, { Cifra } from '@/components/dashboard/Sezione';
import ReteMesi from '@/components/dashboard/ReteMesi';
import ReteRegioni from '@/components/dashboard/ReteRegioni';
import ReteRaccoglitori from '@/components/dashboard/ReteRaccoglitori';
import { t, pct, intero, giorno, giorniMedi } from '@/components/dashboard/formato';
import { cifreRete, senzaTarget } from '@/components/dashboard/righeQuadro';

// LA RETE: IL CONTRATTO ECOTYRE DELL'ANNO (migliorie dell'11/10/2026).
//
// Le cifre (target, raccolto, atteso, scarto, residuo, proiezione, ritmo), il
// mese per mese, le regioni, i raccoglitori, e tre riquadri piccoli: province
// ferme, tempi di raccolta, ordini aperti. I numeri li fa getDashboardRaccolta
// (quadro.rete, quadroCommessa.ts) con le regole di sempre: fine trasporto sul
// giorno italiano, mai la chiusura; il contratto modificato per ultimo; l'atteso
// col profilo mensile del contratto. Target, percentuale e atteso sono quelli
// di kpi, gli stessi della card di prima e di Target & Status.

export function Riquadro({ titolo, children, link, testoLink }) {
  return (
    <div className="border rounded-md p-3 min-w-0">
      <h4 className="text-xs font-semibold text-muted-foreground">{titolo}</h4>
      <div className="mt-1.5 text-sm">{children}</div>
      {link && <Link to={link} className="text-xs text-primary hover:underline mt-1.5 inline-block">{testoLink}</Link>}
    </div>
  );
}

/** Gli ordini aperti di un canale, da quanto aspettano (cruscotto, arretrato): sono quelli di oggi. */
export function OrdiniAperti({ arretrato }) {
  if (!arretrato) return <p className="text-xs text-muted-foreground">Gli ordini aperti sono quelli di oggi: si guardano sull&apos;anno in corso.</p>;
  const e = arretrato;
  return (
    <div>
      <p><span className="font-semibold">{intero(e.totale)}</span> aperti</p>
      <p className="text-xs text-muted-foreground">
        {intero(e.entro_30)} entro 30 giorni · <span className="text-amber-800">{intero(e.da_31_a_60)} da 31 a 60</span> · <span className="text-red-700 font-medium">{intero(e.oltre_60)} oltre 60</span>
      </p>
      {e.piu_vecchio && (
        <p className="text-xs text-muted-foreground mt-0.5">
          Il più vecchio: {e.piu_vecchio.id_ordine} · {e.piu_vecchio.ragione_sociale}{e.piu_vecchio.provincia ? ` (${e.piu_vecchio.provincia})` : ''}, da {intero(e.piu_vecchio.giorni)} giorni.
        </p>
      )}
    </div>
  );
}

export default function SezioneRete({ quadro, arretrato, annoInCorso, daGestire, onDaGestire }) {
  const rete = quadro.rete;
  const anno = quadro.anno;
  const giornoDati = quadro.giorno_dati;
  // Il giorno delle etichette («Atteso al», «sul loro target al»): per un anno
  // chiuso il 31/12, non il giorno dei dati dell'anno dopo (revisione delle
  // migliorie, 11/10/2026); per una risposta di prima, il giorno dei dati.
  const giornoMisura = quadro.giorno_misura !== undefined ? quadro.giorno_misura : giornoDati;
  const domanda = quadro.anno_chiuso
    ? `Com'è andata la raccolta di rete del ${anno} rispetto al contratto?`
    : `Come sta andando la raccolta di rete del ${anno} rispetto al contratto, con i dati fino al ${giorno(giornoDati)}?`;
  const fuoriConto = Number(rete.senza_fine_trasporto) || 0;
  const tempi = rete.tempi;
  const ferme = rete.province_ferme;
  return (
    <Sezione
      id="rete" icona={Truck}
      titolo={`Rete — il contratto Ecotyre ${anno}`}
      sottotitolo="Ritiri terminati per giorno di fine trasporto, contro il target annuo del contratto e il suo profilo mensile."
      perche={(
        <>
          <p>Raccolto: primarie di rete terminate del {anno}, per giorno italiano di fine trasporto (mai la chiusura a portale).</p>
          <p>Target: il contratto Ecotyre del {anno} in Target &amp; Status, il modificato per ultimo.{rete.ripiego ? ' Quest\'anno è un target di ripiego: quello scritto nel gestionale finché il contratto non è inserito.' : ''}</p>
          <p>Atteso: il target ripartito col profilo mensile del contratto, riportato all&apos;annuo{rete.profilo && rete.profilo.somma_t ? ` (il profilo scritto somma ${t(rete.profilo.somma_t)}, il target ${t(rete.target_t)})` : ''}, {rete.atteso && rete.atteso.fine_anno ? 'per l\'anno intero: l\'anno è chiuso, e l\'atteso al 31/12 è il target.' : 'fino al giorno dei dati.'}</p>
          {fuoriConto > 0 && <p>Fuori dal conto {intero(fuoriConto)} {fuoriConto === 1 ? 'ordine terminato' : 'ordini terminati'} senza fine trasporto, di qualunque anno: vedi Da gestire.</p>}
        </>
      )}
      collegamenti={[
        { a: `/target-status?tab=andamento&anno=${anno}`, testo: 'Target & Status' },
        { a: '/primarie-rete', testo: 'Terminati Rete' },
        { a: '/assegnati', testo: 'Assegnati Rete' },
      ]}
      daGestire={daGestire} onDaGestire={onDaGestire}
      destra={(
        <Link to={`/assistente?domanda=${encodeURIComponent(domanda)}`} className="text-xs text-violet-700 hover:underline inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3" aria-hidden="true" /> Chiedi a EcoTyna
        </Link>
      )}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {cifreRete(rete, { annoInCorso }).map(c => <Cifra key={c.etichetta} {...c} />)}
        </div>

        <ReteMesi mesi={rete.mesi} giornoDati={giornoMisura} conTarget={!senzaTarget(rete)} anno={anno} />

        <div>
          <h3 className="text-sm font-semibold mb-2">Regioni</h3>
          <ReteRegioni rete={rete} giornoDati={giornoMisura} anno={anno} />
        </div>

        <ReteRaccoglitori raccoglitori={rete.raccoglitori} perche={rete.raccoglitori_perche} giornoDati={giornoMisura} anno={anno} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Riquadro titolo="Province ferme" link="/primarie-rete" testoLink="Terminati Rete">
            {/* Le province che lavorano e non hanno ritiri negli ultimi due mesi
                finiti, ne' dopo (provinceFerme, quadroCommessa.ts): prima erano due
                mesi a zero in qualunque momento dell'anno, anche per chi oggi raccoglie. */}
            {!ferme || !ferme.anno_in_corso ? <p className="text-xs text-muted-foreground">Si guarda solo l&apos;anno in corso.</p>
              : !ferme.province.length ? <p className="text-xs">Nessuna provincia senza ritiri negli ultimi due mesi finiti.</p>
                : (
                  <>
                    <p className="text-xs mb-1">
                      {ferme.province.length === 1 ? 'Una provincia' : `${intero(ferme.province.length)} province`} senza ritiri {ferme.dal ? `da ${String(ferme.dal.mese).toLowerCase()}${ferme.dal.anno !== anno ? ` ${ferme.dal.anno}` : ''}` : 'negli ultimi due mesi finiti'}:
                    </p>
                    <ul className="text-xs space-y-0.5">
                      {/* Una provincia del contratto senza ritiri non ha un ultimo
                          ritiro: si dice che non e' mai stata servita nell'anno
                          (revisione del 13/10/2026). */}
                      {ferme.province.slice(0, 6).map(p => <li key={p.provincia}>{p.provincia} ({p.regione}), {p.mai_servita || !p.ultimo ? `del contratto, mai servita nel ${anno}` : <>l&apos;ultimo ritiro il {giorno(p.ultimo)}</>}</li>)}
                      {ferme.province.length > 6 && <li className="text-muted-foreground">e altre {ferme.province.length - 6}</li>}
                    </ul>
                  </>
                )}
          </Riquadro>
          <Riquadro titolo="Tempi di raccolta" link="/primarie-rete" testoLink="Terminati Rete">
            {!tempi || !tempi.misurati ? <p className="text-xs text-muted-foreground">Nessun ritiro dell&apos;anno misurabile.</p> : (
              <>
                <p><span className="font-semibold">{giorniMedi(tempi.media_giorni)}</span> giorni in media dall&apos;immissione alla fine del trasporto · {pct(tempi.pct_nei_tempi)} entro i 30 giorni</p>
                {tempi.peggiori.length > 0 && (
                  <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {tempi.peggiori.map(p => <li key={p.raccoglitore}>{p.raccoglitore}: {giorniMedi(p.media_giorni)} giorni ({intero(p.misurati)} ritiri)</li>)}
                  </ul>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">
                  Su {intero(tempi.misurati)} ritiri misurati{tempi.non_misurati ? `; ${intero(tempi.non_misurati)} senza le date per misurarli` : ''}{tempi.registrati_dopo ? `; ${intero(tempi.registrati_dopo)} registrati dopo il ritiro, a parte` : ''}.
                </p>
              </>
            )}
          </Riquadro>
          <Riquadro titolo="Ordini aperti della rete" link="/assegnati" testoLink="Assegnati Rete">
            <OrdiniAperti arretrato={annoInCorso ? arretrato : null} />
          </Riquadro>
        </div>
      </div>
    </Sezione>
  );
}
