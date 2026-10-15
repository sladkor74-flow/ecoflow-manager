import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatTonnellate, formatKg } from '@/lib/utils';
import { materialiDi, OPERAZIONI, CANALI, controlliDichiarazione, statoDichiarazione } from '@/lib/dichiarazioniImpianti';
// La tendina dell'uscito dice che cosa ha coperto la dichiarazione del mese con
// le stesse parole della «i» del Riepilogo, dallo stesso aggancio
// (dichiarazione_copre; revisione del 13/10/2026): qui si leggeva `copre`, un
// giorno solo, e su Irigom febbraio diceva 174.400 kg invece di 721,66 t.
import { coperturaCaricata } from '@/lib/storiaRiepilogo';
import { Pencil, AlertTriangle, CheckCircle2 } from 'lucide-react';
import DateDaSistemare from '@/components/giacenze/DateDaSistemare';

// La sezione di un impianto: mese per mese quanto gli è arrivato - in primaria
// e in secondaria dagli stoccaggi - quanto ha dichiarato e che cosa ne è
// uscito, con il conto della giacenza in fondo.

const kg = (v) => (Number(v) ? formatKg(v) : '—');
const t = (v) => formatTonnellate(Number(v) || 0);

// UN NUMERO CHE NON C'E' NON E' ZERO (giro del 14/10/2026 sulle decisioni
// dell'utente del 13/10/2026). Di un anno prima del gestionale il riepilogo manda
// null la giacenza, quello che resta di ogni mese e la giacenza di rete che ne
// risulta, col perche'; t() li faceva 0,00 («in giacenza 0,00 t», «Giacenza di
// rete che ne risulta: 0,00 t» sul 2025 di Irigom, che ne aveva ricevute 4.439,08).
// Qui si scrive «—», e il perche' sta al passaggio del mouse.
function Manca({ perche, testo = '—' }) {
  return <span className="cursor-help" title={perche || undefined}>{testo}</span>;
}

export default function SezioneImpianto({ sito, onApri, soloLettura }) {
  const materiali = materialiDi(sito.operazione);
  const operazione = OPERAZIONI[sito.operazione];
  // Il perche' di un «—» di questo impianto: l'anno prima del gestionale, o
  // quello che dice la quadratura dell'anno chiuso.
  // E l'apertura del 31/12 che manca (chiusura della prova generale del cambio
  // d'anno, 15/10/2026, difetto 6): il riepilogo manda null la giacenza iniziale,
  // la calcolata e quello che resta, col perche' in perche_senza_apertura.
  const perche = sito.perche_prima_del_gestionale || sito.perche_senza_apertura || (sito.quadratura_anno_chiuso && sito.quadratura_anno_chiuso.perche) || '';
  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold flex items-center gap-2">
            {sito.sito}
            {sito.operazione && <Badge variant="outline" className="font-normal">{sito.operazione}</Badge>}
            {sito.anche_stoccaggio && <Badge variant="outline" className="font-normal">anche stoccaggio</Badge>}
          </p>
          {operazione && <p className="text-xs text-muted-foreground mt-0.5">{operazione.spiega}</p>}
          {sito.anche_stoccaggio && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Qui c&apos;è solo quello che arriva all&apos;impianto. Quello che arriva al suo stoccaggio non è suo da dichiarare finché non
              riparte in secondaria: lo trovi nella scheda Stoccaggi.
            </p>
          )}
          {sito.dichiara_rete === false && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Della rete non manda dichiarazione, perche' quel trattamento non glielo paghiamo: qui si seguono le sue dichiarazioni ACI.
            </p>
          )}
          {/* Un impianto senza la riga dell'anno e' portato dall'anno prima, coi
              suoi ruolo e «dichiara la rete», da confermare sul contratto
              (decisione dell'utente del 15/10/2026, D3): lo si dice qui. */}
          {sito.nota_portata && (
            <p className="text-xs text-amber-800 mt-0.5">
              Portato {sito.nota_portata}: la riga dell&apos;anno la scrivono la copia d&apos;anno o la chiusura.
            </p>
          )}
        </div>
        <div className="text-right text-sm">
          {sito.quadra === true && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-4 h-4" /> giacenza in linea con il portale</span>}
          {sito.quadra === false && <span className="inline-flex items-center gap-1 text-red-700"><AlertTriangle className="w-4 h-4" /> scarto di {t(sito.scarto_t)} t sul portale</span>}
          {/* Un anno chiuso si confronta con la lettura del 31/12 salvata dalla
              chiusura, non col portale di oggi; senza quella lettura la
              quadratura non si fa, e si dice perche' (11/10/2026). */}
          {/* Un anno prima del gestionale lo dice com'e', come la Quadratura (13/10/2026). */}
          {/* Senza l'apertura del 31/12 la quadratura non si fa: non e' «il
              portale non c'e'», e' il punto di partenza che manca (15/10/2026). */}
          {sito.quadra === null && (sito.prima_del_gestionale
            ? <span className="text-muted-foreground text-xs cursor-help" title={perche}>prima del gestionale: la giacenza non si ricostruisce</span>
            : sito.perche_senza_apertura
              ? <span className="text-amber-800 text-xs cursor-help" title={sito.perche_senza_apertura}>manca l&apos;apertura del 31/12: la giacenza di rete non si calcola</span>
            : sito.quadratura_anno_chiuso && !sito.quadratura_anno_chiuso.lettura
              ? <span className="text-muted-foreground text-xs cursor-help" title={sito.quadratura_anno_chiuso.perche}>anno chiuso: la quadratura col portale vale per l&apos;anno in corso</span>
              : <span className="text-muted-foreground text-xs">giacenza a portale non disponibile</span>)}
        </div>
      </div>

      {/* I formulari arrivati qui o partiti da qui senza tutte le date obbligatorie,
          un canale per volta (regola dell'utente, 22/09/2026): senza fine trasporto
          non sono in nessun mese della tabella qui sotto. */}
      <DateDaSistemare gruppi={sito.date_da_sistemare} className="mx-4 mt-3" />
      {sito.foto_senza_giorno && sito.foto_senza_giorno.n > 0 && (
        <p className="mx-4 mt-2 text-xs text-amber-800">
          {sito.foto_senza_giorno.n === 1 ? '1 carico' : `${sito.foto_senza_giorno.n} carichi`} del file del portale ({formatKg(sito.foto_senza_giorno.kg)} kg)
          {' '}senza un giorno di arrivo all&apos;impianto: nella giacenza a portale {sito.foto_senza_giorno.n === 1 ? 'c\'e\'' : 'ci sono'}, in nessun mese
          {' '}fra i non dichiarati e in nessuna giacenza di fine mese ({[...new Set(sito.foto_senza_giorno.ordini.map(o => o.perche))].join('; ')}).
        </p>
      )}

      {sito.flussi.map(flusso => {
        const canale = CANALI.find(c => c.chiave === flusso.canale);
        const mesiConDati = flusso.mesi.filter(m => m.conferito_kg > 0 || (m.dichiarazione && m.dichiarazione.quantita_kg > 0));
        // La giacenza dall'anno prima e' una riga della tabella anche a gennaio,
        // quando e' l'unica cosa che c'e' (11/10/2026).
        const prima = flusso.dall_anno_prima && (flusso.dall_anno_prima.conferito_kg > 0 || flusso.dall_anno_prima.uscito_kg > 0) ? flusso.dall_anno_prima : null;
        // Un canale senza l'apertura del 31/12 si mostra anche senza mesi
        // (15/10/2026): a gennaio e' l'unica cosa da dire, e la sua giacenza e'
        // «—», non assente. Il perche' del canale e' suo (flusso.perche).
        const senzaApertura = !!flusso.senza_apertura;
        if (!mesiConDati.length && !prima && !senzaApertura) return null;
        const percheFlusso = flusso.perche || perche;
        const conStoccaggi = flusso.da_stoccaggi_t > 0;
        return (
          <div key={`${flusso.canale}-${flusso.provenienza}`} className="border-b last:border-b-0">
            <p className="px-4 pt-3 pb-1 text-sm font-medium">
              {canale ? canale.nome : flusso.canale}{flusso.provenienza ? ` · ${flusso.provenienza}` : ''}
              <span className="text-xs text-muted-foreground font-normal">
                {/* Di un anno prima del gestionale non ci sono l'apertura e le
                    dichiarazioni scritte qui: «—», non 0,00 (13/10/2026). */}
                {' '}— {prima ? (flusso.prima_del_gestionale ? <>dall&apos;anno prima <Manca perche={perche} />, </> : `dall'anno prima ${t(flusso.apertura_t)} t, `) : senzaApertura ? <>dall&apos;anno prima <Manca perche={percheFlusso} />, </> : ''}arrivati {t(flusso.conferito_t)} t{conStoccaggi ? `, di cui ${t(flusso.da_stoccaggi_t)} t in secondaria dagli stoccaggi` : ''}, dichiarati e caricati {flusso.prima_del_gestionale ? <><Manca perche={perche} />, </> : <>{t(flusso.dichiarato_caricato_t)} t, </>}{flusso.non_dovuta ? 'giacenza: non dovuta per accordo' : flusso.resta_t === null ? <Manca perche={flusso.perche || perche} testo="in giacenza —" /> : `in giacenza ${t(flusso.resta_t)} t`}
              </span>
            </p>
            {!mesiConDati.length && !prima ? (
              <p className="px-4 pb-3 text-xs text-amber-800">{percheFlusso || "Manca l'apertura del 31/12: quanto resta dell'anno prima non si sa."}</p>
            ) : (
            <div data-scorre-lato>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-y bg-muted/40">
                    <th className="text-left px-3 py-1.5 font-semibold min-w-[110px]">Mese</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Arrivato (kg)</th>
                    {conStoccaggi && <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">di cui da stoccaggi</th>}
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap" title="Quello che in questo mese è stato caricato a portale: per un impianto R1 è il mese della nave, e quel caricamento porta via anche i mesi di prima">Dichiarato (kg)</th>
                    {/* USCITO E RESTA, non piu' il solo «ancora da dichiarare» calcolato
                        mese per mese (09/10/2026). Di un mese esce quello che il portale
                        ha agganciato ai SUOI carichi, anche con la dichiarazione di un mese
                        dopo: le due colonne insieme fanno gli arrivi, e la somma di «resta»
                        e' la giacenza. */}
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap" title="Di quello che è arrivato in questo mese, quanto è uscito: lo dice il report del portale, ordine per ordine, anche quando è uscito con la dichiarazione di un mese successivo">Uscito (kg)</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap" title="Di quello che è arrivato in questo mese, quanto è ancora in impianto. La somma della colonna è la giacenza del canale">Resta in giacenza (kg)</th>
                    {materiali.map(m => <th key={m.chiave} className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">{m.nome} (kg)</th>)}
                    <th className="text-left px-2 py-1.5 font-semibold whitespace-nowrap">Stato</th>
                    <th className="px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {prima && (
                    <tr className="border-b bg-muted/10">
                      <td className="px-3 py-1.5 font-medium" title="La giacenza da cui l'anno riparte: quello che il 31/12 restava da dichiarare, al netto di quello che dell'anno chiuso si è dichiarato dopo">Dall&apos;anno prima</td>
                      <td className="px-2 py-1.5 text-right tabular-nums"
                        title={prima.dichiarato_dopo_kg > 0 ? `Letti al ${String(prima.al || '').split('-').reverse().join('/')} ${formatKg(prima.letta_kg)} kg, meno ${formatKg(prima.dichiarato_dopo_kg)} kg dell'anno chiuso dichiarati dopo` : ''}>
                        {kg(prima.conferito_kg)}
                      </td>
                      {conStoccaggi && <td className="px-2 py-1.5" />}
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700"
                        title={prima.uscito_stimato ? 'Ripartito dal gestionale: il report del portale non ha ancora questa dichiarazione' : 'Agganciato dal portale a carichi degli anni prima, dopo la lettura del 31/12'}>
                        {prima.uscito_kg > 0 ? `${prima.uscito_stimato ? '~' : ''}${kg(prima.uscito_kg)}` : '—'}
                      </td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${prima.da_dichiarare_kg > 0 ? 'text-amber-800 font-medium' : 'text-muted-foreground'}`}>{prima.da_dichiarare_kg > 0 ? kg(prima.da_dichiarare_kg) : prima.da_dichiarare_kg === null ? <Manca perche={percheFlusso} /> : '—'}</td>
                      {materiali.map(x => <td key={x.chiave} className="px-2 py-1.5" />)}
                      {/* null non e' «uscito tutto»: di un anno prima del gestionale non si sa (13/10/2026). */}
                      <td className="px-2 py-1.5 text-muted-foreground">{prima.resta_kg === null ? <Manca perche={perche} testo="non si ricostruisce" /> : prima.resta_kg > 0 ? 'in giacenza' : 'uscito tutto'}</td>
                      <td className="px-2 py-1.5" />
                    </tr>
                  )}
                  {mesiConDati.map(m => {
                    const d = m.dichiarazione;
                    const stato = statoDichiarazione(d, { canale: flusso.canale, dichiara_rete: sito.dichiara_rete });
                    const avvisi = controlliDichiarazione(d, m.conferito_kg, sito.operazione, { tipo_destinazione: sito.tipo_destinazione, canale: flusso.canale, dichiara_rete: sito.dichiara_rete, non_dichiarato_kg: m.non_dichiarato_kg, resta_kg: m.resta_kg }).filter(c => c.livello === 'attenzione');
                    return (
                      <tr key={m.mese} className="border-b last:border-b-0">
                        <td className="px-3 py-1.5 font-medium">{m.mese}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{kg(m.conferito_kg)}</td>
                        {conStoccaggi && (
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground" title={(m.da_stoccaggi || []).map(s => `${formatKg(s.kg)} kg da ${s.stoccaggio}`).join(' · ')}>
                            {kg((m.da_stoccaggi || []).reduce((s, x) => s + x.kg, 0))}
                          </td>
                        )}
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium">{kg(d && d.quantita_kg)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700"
                          title={coperturaCaricata(m)
                            ? `La dichiarazione di ${String(m.mese || '').toLowerCase()}, ${coperturaCaricata(m)}`
                            : (m.uscito_stimato ? 'Ripartito dal gestionale: il report del portale non ha ancora questa dichiarazione' : '')}>
                          {m.uscito_kg > 0 ? `${m.uscito_stimato ? '~' : ''}${kg(m.uscito_kg)}` : '—'}
                        </td>
                        <td className={`px-2 py-1.5 text-right tabular-nums ${m.da_dichiarare_kg > 0 ? "text-amber-800 font-medium" : "text-muted-foreground"}`}>{m.da_dichiarare_kg > 0 ? kg(m.da_dichiarare_kg) : m.da_dichiarare_kg === null ? <Manca perche={percheFlusso} /> : "—"}</td>
                        {materiali.map(x => <td key={x.chiave} className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{kg(d && d[x.chiave])}</td>)}
                        <td className="px-2 py-1.5">
                          {stato === 'caricata' ? <span className="text-emerald-700">caricata a portale</span>
                            : stato === 'ricevuta' ? <span className="text-emerald-800">in mano, da caricare</span>
                              : stato === 'inserita' ? <span className="text-slate-600">inserita</span>
                                : stato === 'solo_metalli' ? <span className="text-sky-800">solo metalli ferrosi</span>
                                  : stato === 'non_dovuta' ? <span className="text-slate-500">non dovuta</span>
                                    /* Un mese di un anno prima del gestionale senza
                                       dichiarazione scritta qui non e' da chiedere: quell'anno
                                       le dichiarazioni le ha il portale (13/10/2026). */
                                    : flusso.prima_del_gestionale && !d ? <Manca perche={perche} testo="prima del gestionale" />
                                      : <span className="text-amber-700">da chiedere</span>}
                          {avvisi.length > 0 && !(flusso.prima_del_gestionale && !d) && <span className="block text-[11px] text-amber-700">{avvisi[0].testo}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {!soloLettura && (
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onApri(sito, flusso, m)}>
                              <Pencil className="w-3.5 h-3.5" /> apri
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>
        );
      })}

      <div className="px-4 py-3 bg-muted/20 text-xs grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* L'apertura letta il 31/12 si prende al netto di quello che dell'anno chiuso si e'
            dichiarato dopo (aperturaNetta, 10/10/2026): qui si dice da dove viene. */}
        {(sito.giacenze_canale || []).filter(c => c.dichiarato_dopo_apertura_t).map(c => (
          <span key={'ap-' + c.canale}>
            Apertura {c.canale === 'ACI' ? 'ACI' : 'di rete'} letta al 31/12: {t(c.apertura_letta_t)} t, di cui dichiarate dopo {t(c.dichiarato_dopo_apertura_t)} t: <strong>{t(c.apertura_t)} t</strong>
          </span>
        ))}
        {/* Di un anno prima del gestionale l'apertura non c'e': non e' 0,00 (13/10/2026). */}
        {/* Senza l'apertura del 31/12 la giacenza da cui si parte e' «—», non 0,00 (15/10/2026). */}
        <span>Giacenza al 31/12 dell'anno prima: <strong>{sito.prima_del_gestionale || sito.giacenza_iniziale_t === null ? <Manca perche={perche} /> : <>{t(sito.giacenza_iniziale_t)} t</>}</strong></span>
        <span>Primarie di rete arrivate: <strong>{t(sito.conferito_t)} t</strong></span>
        {sito.secondarie_in_t > 0 && <span>Secondarie di rete dagli stoccaggi: <strong>{t(sito.secondarie_in_t)} t</strong></span>}
        {sito.conferito_aci_t > 0 && <span>Primarie ACI: <strong>{t(sito.conferito_aci_t)} t</strong></span>}
        {sito.secondarie_aci_in_t > 0 && <span>Secondarie ACI: <strong>{t(sito.secondarie_aci_in_t)} t</strong></span>}
        {sito.conferito_extra_t > 0 && <span>Extra raccolta diretta: <strong>{t(sito.conferito_extra_t)} t</strong></span>}
        {sito.secondarie_extra_in_t > 0 && <span>Extra raccolta dagli stoccaggi: <strong>{t(sito.secondarie_extra_in_t)} t</strong></span>}
        {sito.terziarie_out_t > 0 && <span>Terziarie in uscita: <strong>{t(sito.terziarie_out_t)} t</strong></span>}
        {/* Un canale per volta: rete, ACI ed extra raccolta non si sommano mai. */}
        <span>Dichiarato e caricato, rete: <strong>{sito.prima_del_gestionale ? <Manca perche={perche} /> : <>{t(sito.dichiarato_caricato_rete_t)} t</>}</strong></span>
        {/* Quello che di quell'anno il portale ha agganciato si vede: e' un dato (13/10/2026). */}
        {sito.prima_del_gestionale && sito.dichiarato_portale_t > 0 && <span>Dichiarato a portale, dal report, rete: <strong>{t(sito.dichiarato_portale_t)} t</strong></span>}
        {sito.dichiarato_caricato_aci_t > 0 && <span>Dichiarato e caricato, ACI: <strong>{t(sito.dichiarato_caricato_aci_t)} t</strong></span>}
        {sito.dichiarato_caricato_extra_t > 0 && <span>Dichiarato, extra raccolta: <strong>{t(sito.dichiarato_caricato_extra_t)} t</strong></span>}
        <span>Giacenza di rete che ne risulta: <strong>{sito.dichiara_rete === false
          ? <span className="cursor-help" title={"Per accordo questo impianto non ci dichiara la rete: il trattamento non e' a nostro carico, il portale non tiene per noi una giacenza di rete e niente resta da dichiarare. Quello che e' arrivato si vede nelle primarie qui sopra."}>—</span>
          : sito.giacenza_calcolata_t === null ? <Manca perche={perche} /> : `${t(sito.giacenza_calcolata_t)} t`}</strong></span>
        {/* Per un anno chiuso il numero a portale e' la lettura del 31/12 salvata
            dalla chiusura, non il portale di oggi (11/10/2026). Di un anno prima
            del gestionale non c'e' niente da salvare: si dice quello (13/10/2026). */}
        {sito.quadratura_anno_chiuso
          ? <span title={sito.quadratura_anno_chiuso.perche}>Giacenza di rete a portale, lettura del 31/12: <strong>{sito.giacenza_portale_t === null ? (sito.prima_del_gestionale ? '— (prima del gestionale)' : '— (non salvata dalla chiusura)') : `${t(sito.giacenza_portale_t)} t`}</strong></span>
          : <span>Giacenza di rete a portale, aggiornata: <strong>{sito.giacenza_portale_t === null ? '—' : `${t(sito.giacenza_portale_t)} t`}</strong></span>}
      </div>
    </div>
  );
}
