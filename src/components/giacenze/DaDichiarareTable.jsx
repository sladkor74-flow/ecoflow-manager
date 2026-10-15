import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RefreshCw, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { exportDaDichiarareExcel } from '@/lib/giacenzeDaDichiarareExport';
import { formatKg, formatIntero } from '@/lib/utils';
import { giornoRoma } from '@/lib/giornoItaliano';
import { annoDiOggi } from '@/lib/periodoPagine';
import { creaSequenza } from '@/lib/ultimaRichiesta';
import EsportaPdf from '@/components/shared/EsportaPdf';
import { daDichiararePdf, fuoriDalFile, tuttiArrivatiDopo } from '@/lib/giacenzePdf';

// I pesi di questa lista sono chilogrammi: sempre interi. Si scrivevano con
// formatTonnellate, e un peso in kg usciva con i decimali delle tonnellate.
const kg = (n) => (n == null || n === '' || isNaN(n) ? '—' : formatKg(n));

// Il formulario nel gestionale (regola dell'utente, 22/09/2026): immissione,
// inizio e fine trasporto sono obbligatorie. Se al movimento che ha portato il
// carico all'impianto manca la fine trasporto, il portale lo conta nella sua
// giacenza e il gestionale non lo colloca in nessun mese.
//
// Un carico arrivato dopo il file del portale (15/10/2026) il file non lo ha
// ancora: quello che c'e' e' il formulario nel gestionale, e la cella lo dice -
// primaria o secondaria, terminata quando, da chi - con le date da sistemare,
// se ce ne sono.
function Formulario({ r }) {
  const date = r.date_da_sistemare || [];
  const carico = r.nel_file === false ? r.carico || {} : null;
  if (!date.length && !carico) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      {carico && (
        <span className="block text-muted-foreground">
          {carico.tipo === 'secondaria' ? 'secondaria' : 'primaria'} terminata il {fmtData(r.fine_trasporto)}{carico.da ? `, ${carico.tipo === 'secondaria' ? 'dal piazzale di ' : ''}${carico.da}` : ''}
        </span>
      )}
      {date.length > 0 && (
        <span className="text-amber-700">
          {date.map(d => <span key={`${d.tipo}-${d.id_ordine}`} className="block">{d.tipo} {d.id_ordine}: {d.testo}</span>)}
          {r.fuori_dai_mesi && <span className="block text-[11px]">il portale lo conta nella giacenza, il gestionale non lo colloca in nessun mese</span>}
          {r.fine_a_portale && <span className="block text-[11px]">il portale scrive la fine trasporto ({fmtData(r.fine_a_portale)}): va riportata nella primaria</span>}
        </span>
      )}
    </span>
  );
}

// Il giorno italiano, GG/MM/AAAA. Con toLocaleDateString una data 'AAAA-MM-GG'
// (mezzanotte UTC) si leggeva nel fuso del computer, e fuori dall'Italia usciva
// il giorno prima.
function fmtData(v) {
  const g = giornoRoma(v);
  return g ? g.split('-').reverse().join('/') : '—';
}

const PAGE_SIZE = 100;

// LA RICERCA PARTE QUANDO SI SMETTE DI SCRIVERE (segnalazione alta A49 del 20/09,
// corretta il 12/10/2026). Ogni tasto nel campo «Cerca FIR / ordine» chiamava
// getOrdiniDaDichiarare, che legge primarie, secondarie e il file del portale:
// scrivere un numero FIR di dodici cifre erano dodici chiamate pesanti, sul
// limite di richieste al minuto che vale per tutta l'app. Le risposte superate
// si scartavano gia' (creaSequenza), ma partivano lo stesso. Ora il testo scritto
// diventa la ricerca 400 ms dopo l'ultimo tasto, o subito con Invio, e la pagina
// riparte dalla prima insieme alla ricerca, in una lettura sola. Finche' una
// ricerca scritta non e' partita, Excel e PDF aspettano: devono portare le righe
// che si hanno davanti, non quelle di prima.
const ATTESA_RICERCA_MS = 400;

// Il mese di un gruppo, come lo scrive il portale: 'AAAA-MM' -> 'Gen 2026'.
// Senza fine trasporto il carico non si colloca in nessun mese, e si dice.
const MESI_BREVI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const nomeMese = (m) => {
  if (!m) return 'senza data';
  const i = Number(String(m).slice(5, 7)) - 1;
  return `${MESI_BREVI[i] || m} ${String(m).slice(0, 4)}`;
};

// UNA FASCIA DEI MESI (15/10/2026). Ogni mese dice i suoi ordini e i chili
// ancora da dichiarare, e in piccolo quanti di quelli sono carichi che il file
// del portale non ha ancora e quanto se n'e' dichiarato dopo il file: ottobre di
// T-Cycle e' «20 · 49.040 kg, di cui 4 · 8.120 kg non ancora nel file del
// portale». Con `ruolo` dice la sola parte di impianto o di stoccaggio.
export function FasciaMesi({ mesi, ruolo = null, titolo }) {
  const voci = (mesi || []).map(m => ({ m, v: ruolo ? m[ruolo] || { ordini: 0, kg: 0 } : m })).filter(x => x.v.ordini > 0);
  if (!voci.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{titolo}</span>
      {voci.map(({ m, v }) => {
        // I carichi dopo il file e il dichiarato dopo sono sempre dell'impianto.
        const dopo = ruolo !== 'stoc' && m.dopo_il_file && m.dopo_il_file.ordini > 0 ? m.dopo_il_file : null;
        const dichiarato = ruolo !== 'stoc' && m.dichiarato_dopo_kg > 0 ? m.dichiarato_dopo_kg : 0;
        return (
          <span key={m.mese || 'senza'} className="rounded-md border bg-card px-2 py-0.5 tabular-nums"
            title={`${v.ordini} ${v.ordini === 1 ? 'ordine' : 'ordini'} per ${kg(v.kg)} kg${m.mese ? '' : ' senza fine trasporto: non si collocano in nessun mese'}`}>
            <span className="font-medium">{nomeMese(m.mese)}</span>{' '}
            <span className="text-muted-foreground">{formatIntero(v.ordini)} · {kg(v.kg)} kg</span>
            {dopo && <span className="block text-[10px] text-muted-foreground">di cui {formatIntero(dopo.ordini)} · {kg(dopo.kg)} kg non ancora nel file del portale</span>}
            {dichiarato > 0 && <span className="block text-[10px] text-muted-foreground">tolti {kg(dichiarato)} kg dichiarati dopo il file</span>}
          </span>
        );
      })}
    </div>
  );
}

// LA RIGA CHE TIENE INSIEME PULSANTE, ELENCO E GIACENZA (11/10/2026). Il pulsante
// della scheda Situazione conta anche i carichi che il file del portale non ha
// ancora: questa riga dice quanti e quali sono, toglie le dichiarazioni caricate
// dopo la fotografia e arriva alla giacenza delle Giacenze. Se qualcosa non
// torna, lo si vede qui e non a occhio.
//
// DAL 15/10/2026 QUEI CARICHI SONO ANCHE RIGHE DELL'ELENCO, e questa riga c'e'
// sempre, non solo arrivando dal pulsante: scegliendo il sito dal menu, con
// l'anno o la provincia scelti (allora dice quanto ne mostra l'elenco filtrato,
// ma il conto e' di tutto il sito). Per un sito che e' anche stoccaggio dice la
// parte dello stoccaggio a parte, per quello che e': in attesa di dichiarazione,
// non giacenza dell'impianto. E dice, con le righe della Situazione che la pagina
// ha gia', gli arrivi senza fine trasporto che il portale non conosce: non
// entrano qui ne' nella giacenza finche' la data non arriva.
//
// SU UN ANNO PASSATO (giro del 14/10/2026, sull'approvazione
// dell'utente) la riga dice solo gli ordini: quelli del file arrivati in
// quell'anno piu' i carichi di quell'anno che il file non ha ancora = il numero
// del pulsante della Situazione di quell'anno (carichi_del). La giacenza di un
// anno chiuso e' la lettura del 31/12 salvata dalla chiusura, o «—»: questo
// elenco, che e' di oggi, non ci arriva, e la riga non lo fa credere.
const quanti = (n, uno, molti) => `${formatIntero(n)} ${n === 1 ? uno : molti}`;
/** Gli arrivi di rete senza fine trasporto che il portale non conosce, dalla riga della Situazione. */
export function senzaFineIgnoti(righeGiacenze, sito) {
  const rg = (righeGiacenze || []).find(x => x.tipo_destinazione !== 'stoc' && x.sito === sito);
  const g = rg && (rg.date_da_sistemare || []).find(x => x.canale === 'RETE');
  const sf = g && g.senza_fine;
  return sf && sf.ignoti_al_portale_n > 0 ? { n: sf.ignoti_al_portale_n, kg: sf.ignoti_al_portale_kg } : null;
}
export function Riconciliazione({ r, sito, righeGiacenze = null, chiusi = null }) {
  const [aperto, setAperto] = useState(false);
  if (!r) return null;
  if (r.errore) return <p className="text-xs text-amber-800">La riconciliazione con la giacenza non si è potuta calcolare: {r.errore}</p>;
  if (r.senza_fotografia) return <p className="text-xs text-muted-foreground">Il file degli ordini non dichiarati non è caricato: la riconciliazione con la giacenza non si fa.</p>;
  const nome = r.sito || sito;
  const stoccaggio = r.stoccaggio && r.stoccaggio.ordini > 0 ? (
    <p className="text-muted-foreground">
      <strong className="text-foreground">Come stoccaggio</strong>, {nome} ha nel file {quanti(r.stoccaggio.ordini, 'ordine', 'ordini')}, {kg(r.stoccaggio.kg)} kg, passati dal piazzale e già ripartiti in secondaria:
      {chiusi ? <> per noi chiusi ({chiusi.motivo}).</> : <> per il portale sono in attesa di dichiarazione sullo stoccaggio e li dichiara chi li ha ricevuti.</>}
      {' '}Non sono giacenza dell&apos;impianto e non entrano nel conto qui sopra.
    </p>
  ) : null;
  if (r.solo_stoccaggio) {
    return (
      <div className="text-xs border rounded-lg bg-card px-3 py-2 space-y-1">
        <p>{nome} qui è solo stoccaggio: non ha una giacenza di impianto da riconciliare.</p>
        {stoccaggio}
      </div>
    );
  }
  if (r.non_dovuta) return <p className="text-xs text-muted-foreground">Per accordo {nome} non ci dichiara la rete: il portale non tiene per noi una giacenza di rete, e non c&apos;è niente da riconciliare.</p>;
  const dellAnno = r.carichi_del !== null && r.carichi_del !== undefined;
  const ignoti = dellAnno ? null : senzaFineIgnoti(righeGiacenze, nome);
  return (
    <div className="text-xs border rounded-lg bg-card px-3 py-2 space-y-1">
      {dellAnno ? (
        <p>
          <strong>Ordini dei carichi del {r.carichi_del} ancora da dichiarare oggi:</strong>{' '}
          {formatIntero(r.file_ordini)} nel file del portale{r.foto_del ? ` del ${fmtData(r.foto_del)}` : ''} ({kg(r.file_kg)} kg)
          {' '}+ {formatIntero(r.aggiunti_n)} {r.aggiunti_n === 1 ? 'carico' : 'carichi'} non ancora nel file ({kg(r.aggiunti_kg)} kg)
          {' '}= <strong className="tabular-nums">{formatIntero(r.ordini_pulsante)}</strong>, il numero del pulsante della scheda Situazione del {r.carichi_del}.
          {' '}La giacenza del {r.carichi_del} non è la somma di questo elenco, che è di oggi: è la lettura del 31/12 salvata dalla chiusura dell&apos;anno,
          e senza quella lettura non c&apos;è un numero, che non vuol dire zero.
        </p>
      ) : (
        <p>
          <strong>Riconciliazione con la giacenza:</strong>{' '}
          {r.stoccaggio || r.filtri ? <>{nome} come impianto, tutto il sito: </> : null}
          file del portale{r.foto_del ? ` del ${fmtData(r.foto_del)}` : ''} {formatIntero(r.file_ordini)} {r.file_ordini === 1 ? 'ordine' : 'ordini'}, {kg(r.file_kg)} kg
          {' '}+ {formatIntero(r.aggiunti_n)} {r.aggiunti_n === 1 ? 'carico' : 'carichi'} non ancora nel file, {kg(r.aggiunti_kg)} kg
          {' '}− dichiarato a portale dopo la fotografia, {kg(r.dichiarato_dopo_kg)} kg
          {' '}= <strong className="tabular-nums">giacenza a portale {kg(r.giacenza_kg)} kg</strong>, lo stesso numero delle Giacenze.
        </p>
      )}
      {(!dellAnno || r.aggiunti_n > 0) && (
        <p className="text-muted-foreground">
          {!dellAnno && <>Ordini: {formatIntero(r.file_ordini)} nel file + {formatIntero(r.aggiunti_n)} non ancora nel file = {formatIntero(r.ordini_pulsante)}, il numero del pulsante della scheda Situazione.</>}
          {r.aggiunti_n > 0 && <>{' '}<button type="button" className="text-primary underline" onClick={() => setAperto(v => !v)}>{aperto ? 'nascondi' : dellAnno ? 'quali sono i carichi non ancora nel file' : 'quali sono'}</button></>}
        </p>
      )}
      {aperto && r.aggiunti_n > 0 && (
        <table className="text-[11px]">
          <tbody>
            {r.aggiunti.map(o => (
              <tr key={`${o.tipo}-${o.id_ordine}-${o.numero_fir}`}>
                <td className="pr-2 font-mono">{o.id_ordine}</td>
                <td className="pr-2">{o.tipo === 'secondaria' ? `secondaria da ${o.da}` : o.da}</td>
                <td className="pr-2">fine trasporto {fmtData(o.fine_trasporto)}</td>
                <td className="text-right tabular-nums">{kg(o.kg)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {r.filtri && r.elenco && (
        <p className="text-muted-foreground">Con i filtri scelti l&apos;elenco ne mostra {quanti(r.elenco.ordini, 'ordine', 'ordini')}, {kg(r.elenco.kg)} kg: il conto qui sopra è di tutto il sito.</p>
      )}
      {r.oltre_kg > 0 && (
        <p className="text-amber-800">Il dichiarato a portale dopo il file supera di {kg(r.oltre_kg)} kg i carichi da dichiarare: la giacenza va sotto zero, ed è un errore da correggere.</p>
      )}
      {ignoti && (
        <p className="text-amber-800">
          {quanti(ignoti.n, 'arrivo', 'arrivi')} di rete senza fine trasporto ({kg(ignoti.kg)} kg), che il portale non conosce ancora: non {ignoti.n === 1 ? 'entra' : 'entrano'} in questo elenco né nella giacenza finché la data non arriva (lo dice anche la scheda Situazione).
        </p>
      )}
      {stoccaggio}
    </div>
  );
}

// CON TUTTI I SITI, LA STESSA RIGA PER OGNI IMPIANTO (15/10/2026). Il totale
// degli impianti in testa all'elenco e' la somma delle loro giacenze di rete
// della Situazione: qui si vede impianto per impianto da dove viene, con le
// stesse parole della riga di un sito. Gli stoccaggi a parte, per quello che
// sono. Su un anno passato solo gli ordini.
export function RiconciliazioneSiti({ r }) {
  if (!r) return null;
  if (r.errore) return <p className="text-xs text-amber-800">La riconciliazione con le giacenze non si è potuta calcolare: {r.errore}</p>;
  if (r.senza_fotografia) return <p className="text-xs text-muted-foreground">Il file degli ordini non dichiarati non è caricato: la riconciliazione con le giacenze non si fa.</p>;
  const dellAnno = r.carichi_del !== null && r.carichi_del !== undefined;
  const impianti = r.impianti || [];
  if (!impianti.length && !(r.stoccaggi || []).length) return null;
  return (
    <div className="text-xs border rounded-lg bg-card px-3 py-2 space-y-1">
      <p>
        <strong>Riconciliazione con le giacenze, impianto per impianto</strong>{' '}
        (file del portale{r.foto_del ? ` del ${fmtData(r.foto_del)}` : ''} + carichi non ancora nel file − dichiarato a portale dopo la fotografia{dellAnno ? `; carichi del ${r.carichi_del}` : ''}):
      </p>
      <div className="overflow-x-auto">
        <table className="text-[11px] tabular-nums">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pr-3 font-medium">Impianto</th>
              <th className="pr-3 font-medium text-right">Nel file</th>
              <th className="pr-3 font-medium text-right">Non ancora nel file</th>
              {!dellAnno && <th className="pr-3 font-medium text-right">Dichiarato dopo</th>}
              {!dellAnno && <th className="pr-3 font-medium text-right">Giacenza a portale</th>}
              <th className="font-medium text-right">Ordini (pulsante)</th>
            </tr>
          </thead>
          <tbody>
            {impianti.map(x => (
              <tr key={x.sito}>
                <td className="pr-3">{x.sito}</td>
                {x.non_dovuta ? (
                  <td className="pr-3 text-muted-foreground" colSpan={dellAnno ? 2 : 4}>per accordo non ci dichiara la rete: —</td>
                ) : (
                  <>
                    <td className="pr-3 text-right">{formatIntero(x.file_ordini)} · {kg(x.file_kg)} kg</td>
                    <td className="pr-3 text-right">{formatIntero(x.aggiunti_n)} · {kg(x.aggiunti_kg)} kg</td>
                    {!dellAnno && <td className="pr-3 text-right">{kg(x.dichiarato_dopo_kg)} kg</td>}
                    {!dellAnno && <td className="pr-3 text-right font-medium">{kg(x.giacenza_kg)} kg</td>}
                  </>
                )}
                <td className="text-right">{formatIntero(x.non_dovuta ? x.file_ordini : x.ordini_pulsante)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground">
        {dellAnno
          ? <>Ordini degli impianti: {formatIntero(r.ordini_pulsante)}, la somma dei pulsanti della scheda Situazione del {r.carichi_del}. La giacenza di un anno chiuso è la lettura del 31/12, non questo elenco.</>
          : <>Impianti: {formatIntero(r.ordini_pulsante)} ordini, {kg(r.giacenza_kg)} kg, la somma delle giacenze di rete degli impianti della scheda Situazione.</>}
      </p>
      {(r.stoccaggi || []).length > 0 && (
        <p className="text-muted-foreground">
          In attesa di dichiarazione sugli stoccaggi, già ripartiti e da dichiarare da chi li ha ricevuti, non giacenza degli impianti:{' '}
          {r.stoccaggi.map(x => `${x.sito} ${formatIntero(x.ordini)} · ${kg(x.kg)} kg`).join('; ')}.
        </p>
      )}
    </div>
  );
}

// GLI ORDINI DI UN'ATTESA CHE PER NOI E' CHIUSA (decisioni dell'utente del
// 13/10/2026, giro del 14/10/2026). Il file degli ordini non dichiarati
// attribuisce ancora allo stoccaggio di T-Cycle 72 ordini, 181,299 t, partiti
// tutti verso Tecnogum, che sulla rete non dichiara a SMOCO. La riga della
// Situazione lo dice; aperto dal pulsante, l'elenco li presentava come carichi
// «gia' ripartiti in secondaria» che «li dichiara» l'impianto che li ha
// ricevuti, cioe' come un'attesa da risolvere. Ora si intesta «per noi chiusi»,
// col perche' della riga. Nessuna lettura in piu': la riga e' quella che la
// pagina delle Giacenze ha gia' (righeGiacenze), e senza la riga l'elenco resta
// quello di prima. Tutta l'attesa chiusa, non una parte: con una parte gli
// ordini dell'elenco restano un'attesa, e quali siano chiusi il file non lo dice.
const motivoChiusi = (perche) => String(perche || '').replace(/^.*per noi chiuse:\s*/, '');
export function attesaTuttaChiusa(righeGiacenze, sito, ruolo) {
  if (ruolo !== 'stoc' || !sito) return null;
  const r = (righeGiacenze || []).find(x => x.tipo_destinazione === 'stoc' && x.sito === sito);
  if (!r || !(Number(r.in_attesa_chiusa_t) > 0) || !r.in_attesa_chiusa_perche) return null;
  if (Number(r.in_attesa_chiusa_t) < (Number(r.in_attesa_dichiarazione_t) || 0) - 0.0005) return null;
  return { t: Number(r.in_attesa_chiusa_t), perche: r.in_attesa_chiusa_perche, motivo: motivoChiusi(r.in_attesa_chiusa_perche) };
}

// IL PDF DI UN ANNO PASSATO DICE DI QUALI CARICHI E' (revisione del 14/10/2026).
// Aperto dal pulsante del 2025, il PDF portava i soli carichi del 2025 ancora da
// dichiarare oggi, ma si leggeva identico a quello di tutto il file: l'anno stava
// solo nel nome del file. Sui dati veri quello di Irigom diceva «Ordini 0»,
// mentre oggi Irigom ne ha 233 aperti. E' la lista di lavoro che si passa agli
// impianti: in testa e nella prima nota si dice di quali carichi e', con le
// parole della scritta sopra l'elenco. Sull'anno in corso il documento resta
// quello di sempre.
export function pdfDeiCarichiDel(documento, carichiDel) {
  if (carichiDel === null || carichiDel === undefined || !documento) return documento;
  return {
    ...documento,
    sottotitolo: [`Carichi del ${carichiDel} ancora da dichiarare oggi`, documento.sottotitolo].filter(Boolean).join(' · '),
    note: [
      `Il file degli ordini non dichiarati del portale e’ di oggi: qui ci sono solo i carichi arrivati nel ${carichiDel}, per fine trasporto, all’impianto o al piazzale a cui il portale li attribuisce, che oggi sono ancora da dichiarare. Tutto il file di oggi e’ l’elenco dell’anno in corso.`,
      ...(documento.note || []),
    ],
  };
}

// GLI ORDINI DI UN ANNO CHE NON E' QUELLO IN CORSO (giro del 14/10/2026,
// sull'approvazione dell'utente). Il file degli ordini non dichiarati e' una
// fotografia di oggi: sulle righe degli impianti del 2025 la Situazione contava
// tutto il file (sui dati veri Tecnogum 320, Irigom 233, T-Cycle 118, Green Tyre
// 139, Gatim 56) accanto alla lettura del 31/12, e l'elenco aperto dal pulsante
// era il file intero. Ora la pagina delle Giacenze passa l'anno che guarda,
// quando e' un anno passato (carichiDel), e l'elenco chiede a
// getOrdiniDaDichiarare solo i carichi arrivati in quell'anno al sito a cui il
// portale li attribuisce, per fine trasporto, che oggi sono ancora da dichiarare:
// gli stessi che conta il pulsante (carichi_del). Anche l'Excel e il PDF.
// Sull'anno in corso carichiDel non c'e' e l'elenco e' quello di sempre. Vale
// solo un anno passato (revisione del 14/10/2026): sull'anno dopo le Giacenze
// contano tutto il file accanto alla fotografia di oggi, getOrdiniDaDichiarare
// non filtra, e la scritta «ancora da dichiarare oggi» sopra un elenco intero
// non sarebbe vera.
export default function DaDichiarareTable({ filtroSitoEsterno, filtroRuoloEsterno, onPulisciFiltroSito, righeGiacenze = null, carichiDel = null }) {
  const carichiDellAnno = carichiDel === null || carichiDel === undefined || carichiDel === '' || !Number.isFinite(Number(carichiDel)) || Number(carichiDel) >= annoDiOggi() ? null : Number(carichiDel);
  // Si nasce gia' col filtro che ci hanno passato: arrivando dal pulsante di un
  // impianto nella scheda Situazione, la prima lettura deve essere la sua e non
  // quella di tutti gli ordini.
  const [sito, setSito] = useState(filtroSitoEsterno || '');
  // 'imp' o 'stoc': arrivando dal pulsante di un sito si guarda un ruolo solo.
  const [ruolo, setRuolo] = useState(filtroRuoloEsterno || '');
  const [provincia, setProvincia] = useState('');
  const [annoChiusura, setAnnoChiusura] = useState('');
  // testoRicerca e' quello che si sta scrivendo, ricerca quella che vale per
  // l'elenco, l'Excel e il PDF.
  const [testoRicerca, setTestoRicerca] = useState('');
  const [ricerca, setRicerca] = useState('');
  const [soloDate, setSoloDate] = useState(false);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ siti_distinti: [], province_distinte: [], anni_distinti: [] });
  const sequenza = useRef(creaSequenza()).current;

  // Sincronizza filtro esterno (dal pulsante nella scheda Situazione)
  useEffect(() => {
    if (filtroSitoEsterno) {
      setSito(filtroSitoEsterno);
      setRuolo(filtroRuoloEsterno || '');
      setOffset(0);
    }
  }, [filtroSitoEsterno, filtroRuoloEsterno]);

  const load = useCallback(async () => {
    // Due letture possono essere in volo insieme - una senza filtro e una col
    // filtro - e quella senza, piu' lenta perche' porta tutti gli ordini, torna
    // per ultima e si prende lo schermo: il filtro resta scritto e sotto ci sono
    // gli ordini di tutti gli impianti. Succedeva davvero (08/10/2026).
    const mia = sequenza.inizia();
    setLoading(true);
    try {
      const payload = { limite: PAGE_SIZE, offset };
      if (sito) payload.sito = sito;
      if (provincia) payload.provincia = provincia;
      if (annoChiusura) payload.anno = Number(annoChiusura);
      if (ricerca) payload.ricerca = ricerca;
      if (soloDate) payload.solo_date_da_sistemare = true;
      if (ruolo) payload.ruolo = ruolo;
      if (carichiDellAnno !== null) payload.carichi_del = carichiDellAnno;
      // La riga di riconciliazione arriva sempre con l'elenco (15/10/2026): dal
      // pulsante, dal menu, con l'anno o la provincia scelti. Le letture che la
      // fanno sono quelle dei carichi arrivati dopo il file, che l'elenco fa
      // comunque: chiederla non costa niente, e non serve piu' riconcilia.
      const res = await base44.functions.invoke('getOrdiniDaDichiarare', payload);
      if (!sequenza.valida(mia)) return;
      setData(res.data);
      if (res.data.siti_distinti) setFilterOptions(res.data);
    } catch (e) {
      console.error(e);
    }
    if (sequenza.valida(mia)) setLoading(false);
  }, [sito, provincia, annoChiusura, ricerca, soloDate, ruolo, offset, sequenza, carichiDellAnno]);

  useEffect(() => { load(); }, [load]);

  // Reset offset quando cambiano i filtri
  useEffect(() => { setOffset(0); }, [sito, provincia, annoChiusura, ricerca, soloDate, ruolo, carichiDellAnno]);

  // La ricerca scritta vale dopo ATTESA_RICERCA_MS dall'ultimo tasto. Ricerca e
  // prima pagina cambiano insieme: una lettura sola, non una con la pagina
  // vecchia e una con la prima.
  const applicaRicerca = useCallback((testo) => { setRicerca(testo); setOffset(0); }, []);
  useEffect(() => {
    if (testoRicerca === ricerca) return undefined;
    const attesa = setTimeout(() => applicaRicerca(testoRicerca), ATTESA_RICERCA_MS);
    return () => clearTimeout(attesa);
  }, [testoRicerca, ricerca, applicaRicerca]);
  const ricercaInSospeso = testoRicerca !== ricerca;

  const handlePulisciSito = () => {
    setSito('');
    setRuolo('');
    onPulisciFiltroSito();
  };

  // I filtri che si hanno davanti, come li vuole la funzione. Uno solo, perche'
  // l'Excel e il PDF devono portare esattamente le stesse righe: se si guardano
  // i carichi da dichiarare di un impianto, nel file non finiscono quelli
  // passati dal suo piazzale e gia' ripartiti (utente, 08/10/2026).
  const payloadFiltrato = useCallback((extra = {}) => {
    const payload = { tutte: true, offset: 0, ...extra };
    if (sito) payload.sito = sito;
    if (provincia) payload.provincia = provincia;
    if (annoChiusura) payload.anno = Number(annoChiusura);
    if (ricerca) payload.ricerca = ricerca;
    if (soloDate) payload.solo_date_da_sistemare = true;
    if (ruolo) payload.ruolo = ruolo;
    if (carichiDellAnno !== null) payload.carichi_del = carichiDellAnno;
    return payload;
  }, [sito, provincia, annoChiusura, ricerca, soloDate, ruolo, carichiDellAnno]);

  // IL PDF DELLA SCHEDA (09/10/2026). Nel PDF vanno TUTTE le righe del filtro,
  // non le cento della pagina: un totale sotto una tabella parziale e' la
  // lettura che ha fatto credere che ottobre non fosse contato. Si vanno a
  // prendere al clic, come fa l'Excel.
  // Senza un anno scelto, l'anno del PDF e' quello di oggi in Italia, non
  // quello dell'orologio del dispositivo: un dispositivo con un altro fuso, a
  // cavallo della mezzanotte del 31/12, scriveva un altro anno (revisione della
  // chiusura dell'audit, 11/10/2026, la regola di src/lib/periodoPagine.js).
  // Su un anno passato il PDF e' di quell'anno, porta i soli carichi di
  // quell'anno ancora da dichiarare oggi (carichi_del, 14/10/2026) e lo dice in
  // testa e nelle note (pdfDeiCarichiDel).
  const chiusi = attesaTuttaChiusa(righeGiacenze, sito, ruolo);
  // Con un sito che e' anche stoccaggio, guardato senza ruolo, la riga di
  // riconciliazione dice la parte dello stoccaggio: se l'attesa e' per noi
  // chiusa lo dice come la scritta qui sotto.
  const chiusiStoccaggio = attesaTuttaChiusa(righeGiacenze, sito, 'stoc');
  // Gli arrivi senza fine trasporto che il portale non conosce, dalla riga della
  // Situazione che la pagina ha gia': nessuna lettura in piu' (15/10/2026).
  const ignoti = sito && ruolo !== 'stoc' && carichiDellAnno === null ? senzaFineIgnoti(righeGiacenze, sito) : null;
  // I filtri che i due documenti dicono, gli stessi per il PDF e per l'Excel
  // (revisione del 15/10/2026): l'Excel non li riceveva, e le sue note non erano
  // quelle del PDF.
  const filtriDocumento = () => ({
    sito, ruolo, provincia, anno: annoChiusura, ricerca, solo_date: soloDate,
    ...(chiusi ? { per_noi_chiusi: chiusi.motivo } : {}),
    ...(ignoti ? { senza_fine_ignoti: ignoti } : {}),
  });
  const sezioniPdf = async () => {
    const res = await base44.functions.invoke('getOrdiniDaDichiarare', payloadFiltrato());
    return pdfDeiCarichiDel(daDichiararePdf(annoChiusura || carichiDellAnno || annoDiOggi(), res.data, { ...filtriDocumento() }), carichiDellAnno);
  };

  const handleExport = async () => {
    // Scarica tutto l'elenco filtrato (senza limite) per l'export
    try {
      // tutte: le righe non si tagliano a mille, come il totale.
      const res = await base44.functions.invoke('getOrdiniDaDichiarare', payloadFiltrato());
      // L'anno dei carichi va anche al foglio (null sull'anno in corso): la lista
      // di lavoro per gli impianti deve dire di quali carichi e', come il PDF. E
      // la risposta intera, per le parti del totale e il giorno del file
      // (15/10/2026): il foglio dice quali righe sono arrivate dopo il file. E i
      // filtri del PDF, perche' le note siano le stesse.
      await exportDaDichiarareExcel(res.data.righe, res.data.totale_righe, res.data.totale_kg, { carichi_del: carichiDellAnno, dati: res.data, filtri: filtriDocumento() });
    } catch (e) {
      alert('Errore nell\'export: ' + e.message);
    }
  };

  const righe = data?.righe || [];
  const totaleRighe = data?.totale_righe || 0;
  const totaleKg = data?.totale_kg || 0;
  const perMese = data?.per_mese || [];
  const dateInfo = data?.date_da_sistemare || { n: 0 };
  const senzaFineAPortale = data?.senza_fine_a_portale || 0;
  const senzaFineDalGestionale = data?.senza_fine_dal_gestionale || 0;
  const fotoDel = data?.foto_del || null;
  const parti = data?.parti || null;
  const erroreCarichi = data?.carichi_dopo_il_file?.errore || '';
  // Impianto e stoccaggio insieme nell'elenco (tutti i siti, o un sito coi due
  // ruoli guardato dal menu): le due cose non si somigliano, e si dicono a parte.
  const dueRuoli = !!(parti && parti.imp.ordini > 0 && parti.stoc.ordini > 0);
  const hasPrev = offset > 0;
  const hasNext = righe.length === PAGE_SIZE && offset + PAGE_SIZE < totaleRighe;

  return (
    <div className="space-y-3">
      {/* Filtri */}
      <div className="bg-card border rounded-lg p-3 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Sito</label>
          <Select value={sito} onValueChange={v => { setSito(v === '__all__' ? '' : v); }}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tutti i siti" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti i siti</SelectItem>
              {filterOptions.siti_distinti?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Provincia</label>
          <Select value={provincia} onValueChange={v => { setProvincia(v === '__all__' ? '' : v); }}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Tutte" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutte</SelectItem>
              {filterOptions.province_distinte?.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" title="L'anno della fine del trasporto">Anno (fine trasporto)</label>
          <Select value={annoChiusura} onValueChange={v => { setAnnoChiusura(v === '__all__' ? '' : v); }}>
            <SelectTrigger className="w-[100px]"><SelectValue placeholder="Tutti" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti</SelectItem>
              {filterOptions.anni_distinti?.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Cerca FIR / ordine</label>
          <Input
            placeholder="Numero FIR o ordine..."
            value={testoRicerca}
            onChange={e => setTestoRicerca(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && ricercaInSospeso) applicaRicerca(testoRicerca); }}
            className="h-9"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs h-9" title="Nel gestionale ogni formulario deve avere tre date: immissione, inizio e fine trasporto, in quest'ordine. Dove ne manca una, o sono incoerenti, il carico non si colloca in nessun mese e non entra in nessuna dichiarazione, mentre il portale lo conta nella sua giacenza. Questa spunta mostra solo quelli, per andarli a correggere.">
          <input type="checkbox" checked={soloDate} onChange={e => setSoloDate(e.target.checked)} />
          Solo quelli col formulario da correggere
        </label>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || ricercaInSospeso}>
          <Download className="w-4 h-4 mr-1" /> Esporta Excel
        </Button>
        <EsportaPdf sezioni={sezioniPdf} disabilitato={loading || ricercaInSospeso} />
        {sito && (
          <Button variant="ghost" size="sm" onClick={handlePulisciSito} title="Torna a vedere tutti i siti. Non cancella niente.">
            Mostra tutti i siti
          </Button>
        )}
      </div>
      {/* Da dove si arriva conta: col ruolo scelto si vedono solo i carichi di quel
          titolo. Il numero del pulsante nella scheda Situazione conta anche i
          carichi che il file del portale non ha ancora: dal 15/10/2026 sono righe
          dell'elenco, e il totale e' la giacenza; la riga di riconciliazione sotto
          la tabella dice da dove viene (11/10/2026). Prima questo commento lo
          affermava e basta, ed era falso appena un carico arrivava dopo l'ultimo
          file, cioe' quasi ogni settimana. */}
      {/* Su un anno passato si dice di quali carichi e'
          l'elenco, sopra tutto il resto (14/10/2026). */}
      {carichiDellAnno !== null && (
        <p className="text-sm border rounded-lg bg-muted/40 px-3 py-2 text-muted-foreground">
          <strong className="text-foreground">Carichi del {carichiDellAnno} ancora da dichiarare oggi.</strong>{' '}
          Il file degli ordini non dichiarati del portale è di oggi: qui si vedono solo i carichi arrivati nel {carichiDellAnno}, per fine trasporto,
          all&apos;impianto o al piazzale a cui il portale li attribuisce, gli stessi che conta il pulsante della scheda Situazione del {carichiDellAnno}.
          Tutto il file di oggi si vede scegliendo l&apos;anno in corso.
        </p>
      )}
      {chiusi && (
        <p className="text-sm border rounded-lg bg-muted/40 px-3 py-2 text-muted-foreground cursor-help" title={chiusi.perche}>
          <strong className="text-foreground">Per noi chiusi: {chiusi.motivo}.</strong>{' '}
          Il portale li attribuisce ancora allo stoccaggio, ma nessuna dichiarazione li chiuderà e non c&apos;è niente da fare:
          il numero resta quello del portale, e serve alla quadratura.
        </p>
      )}
      {ruolo && (
        <div className="text-xs text-muted-foreground">
          {ruolo === 'imp'
            ? <>Si vedono solo i carichi che <strong className="text-foreground">{sito}</strong> deve ancora dichiarare come impianto.</>
            : chiusi
              ? <>Si vedono solo i carichi passati dal piazzale di <strong className="text-foreground">{sito}</strong> e già ripartiti in secondaria.</>
              : <>Si vedono solo i carichi passati dal piazzale di <strong className="text-foreground">{sito}</strong> e già ripartiti in secondaria: stanno come giacenza sull&apos;impianto che li ha ricevuti, e li dichiara lui.</>}
          {' '}
          <button type="button" className="text-primary underline" onClick={() => setRuolo('')}>mostra tutti e due</button>
        </div>
      )}

      {/* IL FILE DEL PORTALE PIU' I CARICHI ARRIVATI DOPO (15/10/2026). L'utente
          vedeva a ottobre su T-Cycle 40,92 t mentre ne erano entrate 49,04: i 4
          carichi del 12-13/10 il file del 09/10 non li aveva ancora, e l'elenco
          aveva solo il file. Ora ci sono, con l'etichetta, e due frasi dicono
          che cosa e' l'elenco e quando l'etichetta sparisce. */}
      {fotoDel && ruolo !== 'stoc' && (
        <p className="text-xs text-muted-foreground">
          L&apos;elenco è il file degli ordini non dichiarati del portale del {fmtData(fotoDel)} più i carichi che il gestionale conosce e il file non ha ancora, di solito arrivati dopo (colonna «Nel file del portale»).
          {' '}Caricando un file nuovo degli ordini non dichiarati quei carichi entrano nel file e l&apos;etichetta sparisce.
          {parti && parti.dichiarato_dopo.kg > 0 && <> Le dichiarazioni caricate a portale dopo il file si tolgono dai carichi arrivati da più tempo, come fa il portale.</>}
        </p>
      )}
      {erroreCarichi && (
        <p className="text-xs border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2">
          I carichi arrivati dopo il file non si sono potuti leggere ({erroreCarichi}): qui c&apos;è solo il file del portale, e il totale non è la giacenza della scheda Situazione. Si può riprovare fra poco.
        </p>
      )}

      {/* Conteggio e peso totale. Il primo numero in grassetto resta quello degli
          ordini (prove/daDichiarareRicercaAttesa.mjs lo legge). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{formatIntero(totaleRighe)}</strong> ordini</span>
        <span><strong className="text-foreground">{kg(totaleKg)}</strong> kg totali</span>
        {/* «arrivati dopo» solo se lo sono tutti: un ordine terminato prima del
            file e chiuso a portale dopo e' «non ancora nel file» (15/10/2026). */}
        {parti && parti.dopo_il_file.ordini > 0 && (
          <span className="text-xs">
            {formatIntero(parti.nel_file.ordini)} nel file del {fmtData(fotoDel)} + {formatIntero(parti.dopo_il_file.ordini)} {tuttiArrivatiDopo(parti) ? `${parti.dopo_il_file.ordini === 1 ? 'arrivato' : 'arrivati'} dopo` : 'non ancora nel file'} ({kg(parti.dopo_il_file.kg)} kg)
          </span>
        )}
        {parti && parti.dichiarato_dopo.kg > 0 && (
          <span className="text-xs">− {kg(parti.dichiarato_dopo.kg)} kg dichiarati a portale dopo il file</span>
        )}
        {parti && parti.oltre_kg > 0 && (
          <span className="text-xs text-amber-800">− {kg(parti.oltre_kg)} kg dichiarati oltre i carichi: giacenza sotto zero, da correggere</span>
        )}
        {totaleRighe > righe.length && (
          <span className="text-xs">
            in tabella {righe.length === 0 ? 0 : offset + 1}–{offset + righe.length}: l&apos;elenco parte dal carico arrivato da più tempo, i mesi più recenti sono nelle pagine dopo
          </span>
        )}
        {(loading || ricercaInSospeso) && <RefreshCw className="w-4 h-4 animate-spin" />}
      </div>
      {dueRuoli && (
        <p className="text-xs text-muted-foreground">
          Come impianto, da dichiarare: <strong className="text-foreground">{formatIntero(parti.imp.ordini)}</strong> ordini, {kg(parti.imp.kg)} kg{sito ? ', la giacenza a portale' : ', la somma delle giacenze a portale degli impianti'}.
          {' '}Come stoccaggio, in attesa di dichiarazione: {formatIntero(parti.stoc.ordini)} ordini, {kg(parti.stoc.kg)} kg, già ripartiti in secondaria: li dichiara chi li ha ricevuti, e non sono giacenza degli impianti.
        </p>
      )}
      {/* DI QUALI MESI SONO, SU TUTTO L'ELENCO (09/10/2026).
          Chiesto dall'utente dopo aver guardato gli ordini da dichiarare di
          T-Cycle: «non compaiono poi in elenco gli ingressi di ottobre e mi
          chiedo: come fai a trovarti con la giacenza attuale se non consideri
          anche quelli?». C'erano - 12 ordini, 29.060 kg - ma in fondo, dopo le
          prime cento righe, e il totale sotto la tabella li contava senza che si
          vedessero. Questa riga dice i mesi di TUTTO l'elenco filtrato: si legge
          in un colpo d'occhio e fa da riscontro alla giacenza dell'impianto. */}
      {/* Dal 15/10/2026 i mesi comprendono i carichi arrivati dopo il file, e lo
          dicono in piccolo («di cui 4 · 8.120 kg non ancora nel file del
          portale»); il mese e' quello dell'arrivo al sito, come nelle
          Dichiarazioni Impianti. Con impianto e stoccaggio insieme, due fasce. */}
      {perMese.length > 0 && (dueRuoli ? (
        <>
          <FasciaMesi mesi={perMese} ruolo="imp" titolo="Da dichiarare come impianto, di quali mesi:" />
          <FasciaMesi mesi={perMese} ruolo="stoc" titolo="In attesa sugli stoccaggi, di quali mesi:" />
        </>
      ) : <FasciaMesi mesi={perMese} titolo="Di quali mesi:" />)}
      {(dateInfo.n > 0 || senzaFineAPortale > 0) && (
        <div className="text-xs border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 space-y-0.5">
          {dateInfo.n > 0 && (
            <p>
              <strong>{formatIntero(dateInfo.n)}</strong> {dateInfo.n === 1 ? 'ordine ha' : 'ordini hanno'}, nel gestionale, un formulario terminato senza tutte le date obbligatorie ({kg(dateInfo.kg)} kg da dichiarare): immissione, inizio e fine trasporto vanno completate.
              {dateInfo.fuori_dai_mesi > 0 && ` A ${formatIntero(dateInfo.fuori_dai_mesi)} (${kg(dateInfo.fuori_dai_mesi_kg)} kg) manca la fine trasporto dell'arrivo all'impianto: il portale li conta nella giacenza, il gestionale non li colloca in nessun mese finche' la data non arriva.`}
            </p>
          )}
          {senzaFineAPortale > 0 && (
            <p>
              {formatIntero(senzaFineAPortale)} {senzaFineAPortale === 1 ? 'riga' : 'righe'} del file del portale senza fine trasporto
              {senzaFineDalGestionale > 0 ? `: ${formatIntero(senzaFineDalGestionale)} la ${senzaFineDalGestionale === 1 ? 'prende' : 'prendono'} dal formulario del gestionale` : ''}
              {senzaFineAPortale - senzaFineDalGestionale > 0 ? `${senzaFineDalGestionale > 0 ? ', le altre' : ':'} in fondo alla lista, fuori dal filtro per anno` : ''}.
            </p>
          )}
        </div>
      )}

      {/* Tabella */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-2 py-2 font-semibold">Ordine</th>
                <th className="px-2 py-2 font-semibold">FIR</th>
                <th className="px-2 py-2 font-semibold">Fine trasporto</th>
                <th className="px-2 py-2 font-semibold">Punto di raccolta</th>
                <th className="px-2 py-2 font-semibold">Comune</th>
                <th className="px-2 py-2 font-semibold">Prov.</th>
                <th className="px-2 py-2 font-semibold">Prodotto</th>
                <th className="px-2 py-2 font-semibold text-right">Peso da dichiarare</th>
                <th className="px-2 py-2 font-semibold" title="Se la riga e' nel file degli ordini non dichiarati del portale, o se e' un carico che il file non ha ancora: arrivato dopo il file, oppure terminato prima ma non ancora nel file">Nel file del portale</th>
                <th className="px-2 py-2 font-semibold">Destinazione</th>
                <th className="px-2 py-2 font-semibold">Trasferito a</th>
                <th className="px-2 py-2 font-semibold" title="Il formulario nel gestionale: le date obbligatorie che mancano o non tornano">Formulario nel gestionale</th>
              </tr>
            </thead>
            <tbody>
              {righe.length === 0 && (
                <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">Nessun ordine da dichiarare</td></tr>
              )}
              {righe.map((r, i) => {
                const giorni = r.giorni_attesa;
                let rowClass = 'border-t hover:bg-muted/30';
                if (giorni != null && giorni > 180) rowClass = 'border-t bg-red-50 hover:bg-red-100';
                else if (giorni != null && giorni > 90) rowClass = 'border-t bg-amber-50 hover:bg-amber-100';
                // Il giorno in cui il carico e' arrivato all'impianto, quando e'
                // un altro dalla fine trasporto della riga: un carico passato da
                // uno stoccaggio arriva con la secondaria, e il suo mese e' quello.
                const arrivo = r.giorno_al_sito && r.fine_trasporto && r.giorno_al_sito !== r.fine_trasporto ? r.giorno_al_sito : null;
                return (
                  <tr key={i} className={rowClass}>
                    <td className="px-2 py-1.5 font-mono text-xs">{r.ordine_primaria || r.ordine_secondaria}{!r.ordine_primaria && r.ordine_secondaria && <span className="block text-[10px] font-sans text-muted-foreground">secondaria</span>}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">{r.numero_fir || '—'}</td>
                    <td className="px-2 py-1.5" title={r.data_chiusura ? `chiuso a portale il ${fmtData(r.data_chiusura)}` : ''}>
                      {fmtData(r.fine_trasporto)}
                      {r.fine_dal_gestionale && <span className="block text-[10px] text-muted-foreground" title="Il file del portale non la scrive: e' quella del formulario nel gestionale">dal gestionale</span>}
                      {arrivo && <span className="block text-[10px] text-muted-foreground" title="La fine trasporto della secondaria che l'ha portato all'impianto: il mese della riga e' questo">all&apos;impianto il {fmtData(arrivo)}</span>}
                    </td>
                    <td className="px-2 py-1.5">{r.punto_di_raccolta || '—'}</td>
                    <td className="px-2 py-1.5">{r.comune || '—'}</td>
                    <td className="px-2 py-1.5">{r.provincia || '—'}</td>
                    <td className="px-2 py-1.5">{r.prodotto || '—'}</td>
                    <td className="px-2 py-1.5 text-right font-medium">
                      {kg(r.peso_non_dichiarato_kg)} kg
                      {r.dichiarato_dopo_kg > 0 && <span className="block text-[10px] font-normal text-muted-foreground">nel file {kg(r.peso_del_file_kg)} kg, {kg(r.dichiarato_dopo_kg)} dichiarati a portale dopo il file</span>}
                    </td>
                    <td className="px-2 py-1.5 text-xs">
                      {r.nel_file === false
                        ? <span className="text-primary font-medium">{fuoriDalFile(r, fotoDel)}</span>
                        : <span className="text-muted-foreground">sì</span>}
                    </td>
                    <td className="px-2 py-1.5">{r.destinazione || '—'}</td>
                    <td className="px-2 py-1.5">{r.destinazione_secondaria || '—'}</td>
                    <td className="px-2 py-1.5 text-xs"><Formulario r={r} /></td>
                  </tr>
                );
              })}
            </tbody>
            {righe.length > 0 && (
              /* IL TOTALE SOTTO LE RIGHE E' DI TUTTO L'ELENCO, NON DI QUESTA
                 PAGINA, e finche' non lo diceva sembrava il totale delle cento
                 righe davanti: e' la lettura che ha fatto pensare che ottobre non
                 fosse contato (09/10/2026). Dove l'elenco non sta in una pagina
                 si scrivono entrambi i numeri. */
              <tfoot className="bg-muted/50 font-bold border-t-2">
                {totaleRighe > righe.length && (
                  <tr className="font-normal text-muted-foreground">
                    <td className="px-2 py-1.5" colSpan={7}>In questa pagina ({formatIntero(righe.length)} {righe.length === 1 ? 'ordine' : 'ordini'})</td>
                    <td className="px-2 py-1.5 text-right">{kg(righe.reduce((s, r) => s + (r.peso_non_dichiarato_kg || 0), 0))} kg</td>
                    <td className="px-2 py-1.5" colSpan={4}></td>
                  </tr>
                )}
                {parti && parti.oltre_kg > 0 && (
                  <tr className="font-normal text-amber-800">
                    <td className="px-2 py-1.5" colSpan={7}>Dichiarato a portale dopo il file, oltre i carichi dell&apos;elenco</td>
                    <td className="px-2 py-1.5 text-right">− {kg(parti.oltre_kg)} kg</td>
                    <td className="px-2 py-1.5" colSpan={4}></td>
                  </tr>
                )}
                <tr>
                  <td className="px-2 py-2" colSpan={7}>TOTALE DELL&apos;ELENCO ({formatIntero(totaleRighe)} ordini)</td>
                  <td className="px-2 py-2 text-right">{kg(totaleKg)} kg</td>
                  <td className="px-2 py-2" colSpan={4}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* LA RIGA DI RICONCILIAZIONE (chiusura dell'audit, 11/10/2026).
          Righe del file + carichi che il file non ha ancora - dichiarato dopo la
          fotografia = la giacenza a portale, lo stesso numero delle Giacenze; e
          righe + carichi = il numero del pulsante. Le regole sono quelle delle
          Giacenze (base44/shared/riconciliazioneDaDichiarare.ts). Dal 15/10/2026
          arriva con ogni elenco: dal pulsante, dal menu, coi filtri; e senza un
          sito si dice impianto per impianto. */}
      <Riconciliazione r={data?.riconciliazione || null} sito={sito} righeGiacenze={carichiDellAnno === null ? righeGiacenze : null} chiusi={ruolo ? null : chiusiStoccaggio} />
      {!sito && <RiconciliazioneSiti r={data?.riconciliazione_siti || null} />}

      {/* Paginazione */}
      {totaleRighe > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + righe.length, totaleRighe)} di {totaleRighe}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!hasPrev} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              <ChevronLeft className="w-4 h-4" /> Precedenti
            </Button>
            <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Successivi <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}