import React from 'react';
import { Factory } from 'lucide-react';
import Sezione, { Cifra, Tabella } from '@/components/dashboard/Sezione';
import { OrdiniAperti, Riquadro } from '@/components/dashboard/SezioneRete';
import { t, pct, intero } from '@/components/dashboard/formato';

// L'ACI, GLI AUTODEMOLITORI (migliorie dell'11/10/2026). Un canale a se': non si
// somma alla rete e non ha target. La previsione del contratto ACI e'
// indicativa, quindi la percentuale ha un colore neutro: non e' un obiettivo
// mancato o raggiunto. Le regioni vengono dalla provincia, come in Target &
// Status (CanaleAci), cosi' i numeri coincidono riga per riga.
//
// LA PREVISIONE COPIATA (prova generale del cambio d'anno, 15/10/2026): con il
// contratto dell'anno copiato dall'anno prima e non ancora confermato
// (quadro.aci.da_confermare, lo stesso daConfermare della rete) previsione e
// budget sono quelli dell'anno prima. Il 15/01/2027 la sezione scriveva
// «Previsione indicativa 650,00 t dal contratto ACI» e «Budget SMOCO dell'anno
// 180,00 t» senza dirlo; ora lo dice accanto a ciascuno. L'anno prima e'
// calcolato, mai scritto a mano.

/** Le righe di un canale mese per mese: il raccolto, «—» per i mesi che i dati non coprono. */
export function TabellaMesi({ mesi, etichetta = 'Raccolto' }) {
  return (
    <Tabella className="border rounded-md">
      <thead className="bg-muted/40"><tr className="text-left text-xs text-muted-foreground">
        <th className="px-2 py-1.5 font-medium">Mese</th>
        <th className="px-2 py-1.5 font-medium text-right">{etichetta}</th>
      </tr></thead>
      <tbody>
        {(mesi || []).map(m => (
          <tr key={m.mese} className="border-t">
            <td className="px-2 py-1 whitespace-nowrap">{m.mese}</td>
            <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{m.futuro ? '—' : t(m.raccolto_t)}</td>
          </tr>
        ))}
      </tbody>
    </Tabella>
  );
}

export default function SezioneAci({ quadro, arretrato, annoInCorso, daGestire, onDaGestire }) {
  const aci = quadro.aci;
  const anno = quadro.anno;
  const copiata = !!aci.da_confermare;
  const annoPrima = Number(anno) - 1;
  return (
    <Sezione
      id="aci" icona={Factory}
      titolo={`ACI — autodemolitori ${anno}`}
      sottotitolo="Un canale a sé: non si somma alla rete e non ha target. La previsione del contratto ACI è indicativa."
      perche={(
        <>
          <p>Primarie ACI terminate del {anno}, per giorno italiano di fine trasporto (mai la chiusura a portale).</p>
          <p>Previsione: la tabella del contratto ACI Ecotyre in Target &amp; Status. È un&apos;indicazione, non un obiettivo: la percentuale non ha i colori di uno scarto.</p>
        </>
      )}
      collegamenti={[
        { a: '/primarie-aci', testo: 'Terminati ACI' },
        { a: '/assegnati-aci', testo: 'Assegnati ACI' },
        { a: `/target-status?tab=commessa&anno=${anno}`, testo: 'Contratto ACI in Target & Status' },
      ]}
      daGestire={daGestire} onDaGestire={onDaGestire}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Cifra etichetta="Raccolto" valore={t(aci.raccolto_t)} sotto={`${intero(aci.ritiri)} ${aci.ritiri === 1 ? 'ritiro' : 'ritiri'} (ordini distinti)`} />
          <Cifra etichetta="Previsione indicativa" valore={t(aci.previsione_t)} sotto={!aci.previsione_t ? 'nessuna previsione nel contratto ACI' : copiata ? `copiata dal ${annoPrima}, da confermare` : 'dal contratto ACI'} />
          <Cifra etichetta="Della previsione" valore={pct(aci.pct_previsione)} />
          <Cifra etichetta="Budget SMOCO dell'anno" valore={t(aci.budget_t)} sotto={!aci.budget_t ? 'nessun budget scritto' : copiata ? `copiato dal ${annoPrima}, da confermare` : 'il budget scritto nel contratto'} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold mb-2">Regioni</h3>
            {!aci.regioni.length ? <p className="text-sm text-muted-foreground">Nessun ritiro ACI terminato nel {anno}.</p> : (
              <Tabella className="border rounded-md">
                <thead className="bg-muted/40"><tr className="text-left text-xs text-muted-foreground">
                  <th className="px-2 py-1.5 font-medium">Regione</th>
                  <th className="px-2 py-1.5 font-medium text-right">Previsione</th>
                  <th className="px-2 py-1.5 font-medium text-right">Raccolto</th>
                  <th className="px-2 py-1.5 font-medium text-right">%</th>
                </tr></thead>
                <tbody>
                  {aci.regioni.map(r => (
                    <tr key={r.regione} className="border-t">
                      <td className="px-2 py-1.5">{r.regione}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(r.previsione_t)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(r.raccolto_t)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{pct(r.pct)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t font-medium">
                  <td className="px-2 py-1.5">Totale ACI</td>
                  <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(aci.previsione_t)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(aci.raccolto_t)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{pct(aci.pct_previsione)}</td>
                </tr></tfoot>
              </Tabella>
            )}
            {copiata && aci.previsione_t ? (
              <p className="mt-2 text-xs text-amber-800">La previsione è copiata dal {annoPrima} con il contratto, da confermare nella scheda Commessa Ecotyre di Target &amp; Status: i contratti ACI sono annuali, senza tacito rinnovo.</p>
            ) : null}
            <div className="mt-3">
              <Riquadro titolo="Ordini aperti ACI" link="/assegnati-aci" testoLink="Assegnati ACI">
                <OrdiniAperti arretrato={annoInCorso ? arretrato : null} />
              </Riquadro>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Mese per mese</h3>
            <TabellaMesi mesi={aci.mesi} />
          </div>
        </div>
      </div>
    </Sezione>
  );
}
