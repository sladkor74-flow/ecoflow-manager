import React from 'react';
import CellaMese from '@/components/dichiarazioni/CellaMese';
import { RaccontoRiga, AngoloPerche, RigaGiacenzaFineMese, RigheStoccaggio } from '@/components/dichiarazioni/StoriaRiga';
import { MESI_BREVI, CANALI, MOTIVI_ASSENZA } from '@/lib/dichiarazioniImpianti';
import { formatTonnellate, formatKg } from '@/lib/utils';
import { Check, Mail, Minus, Ship } from 'lucide-react';

// Riepilogo: una riga per impianto e canale, una colonna per mese, e sotto
// ciascuna tre linee che raccontano il mese: che cosa ne e' uscito, che cosa e'
// entrato, che cosa resta in giacenza.
//
// Verde = di quel mese e' uscito (tutto, se pieno; in parte, se chiaro).
// Indaco = in quel mese la dichiarazione e' stata caricata a portale: per un
// impianto R1 e' il mese della nave, e quel caricamento porta via i mesi di
// prima. Ambra = di quel mese non e' uscito niente.
//
// Fino al 09/10/2026 le caselle dicevano, mese per mese, gli ingressi meno il
// dichiarato DI QUEL MESE: su T-Cycle gennaio, febbraio, aprile e maggio
// restavano in giallo pur essendo partiti con le navi di marzo e di giugno, e la
// somma delle caselle (532,68 t) smentiva la colonna «Da dichiarare» (352,94 t).
// Parole dell'utente: «tenerlo in giallo potrebbe confondere... marcando in verde
// i quantitativi effettivamente usciti e lasciando in basso la parte restante in
// giacenza oltre agli ingressi del mese».
//
// Solo impianti: uno stoccaggio non tratta e non dichiara. Quello che spedisce
// in secondaria sta sulla riga dell'impianto che lo riceve, nel mese in cui
// arriva, ed e' quell'impianto a dichiararlo.

const nomeCanale = (f) => {
  const c = CANALI.find(x => x.chiave === f.canale);
  return `${c ? c.nome : f.canale}${f.provenienza ? ` ${f.provenienza}` : ''}`;
};
const giornoIt = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '');

// LA CASELLA «DALL'ANNO PRIMA» (chiusura dell'audit, 11/10/2026).
//
// La giacenza del canale comprende l'apertura - quello che il 31/12 restava da
// dichiarare - ma l'apertura non stava in nessun mese: la riga sommava solo gli
// arrivi dell'anno e, finche' l'apertura non era consumata (per Irigom fino alla
// prima nave dell'anno), la colonna «Da dichiarare» diceva meno della giacenza e
// sopra la tabella compariva «a portale risultano dichiarati ... in più», che era
// falso. Ora l'apertura ha la sua casella in testa alla riga, prima di gennaio:
// il portale aggancia dal carico più vecchio, quindi è la prima a svuotarsi. Gli
// stessi colori dei mesi: verde quello che ne è uscito, ambra quello che resta.
function CasellaAnnoPrima({ prima: dallAnnoPrima, anno, perche, senzaApertura = false }) {
  // SENZA L'APERTURA DEL 31/12 la casella non si sa (chiusura della prova
  // generale del cambio d'anno, 15/10/2026): «—» col perche' del canale, come
  // un anno prima del gestionale, invece di una casella vuota senza parole.
  const prima = senzaApertura ? { ...(dallAnnoPrima || {}), resta_kg: null } : dallAnnoPrima;
  if (!prima) return <span className="block text-center text-muted-foreground/50 text-[11px]">—</span>;
  // UN ANNO PRIMA DEL GESTIONALE (decisioni dell'utente del 13/10/2026): la
  // giacenza da cui riparte non c'e', e il riepilogo manda null quello che ne
  // resta. Qui diventava 0: «giacenza da cui il 2025 riparte, 0 kg · niente piu'
  // in giacenza dell'anno prima», due cose non vere. Si dice «—» col perche';
  // quello che il portale ha agganciato agli anni prima, se c'e', resta un dato.
  if (prima.resta_kg === null) {
    const uscitoNoto = prima.uscito_kg || 0;
    return (
      <span title={[`Dall'anno prima: ${perche || 'la giacenza da cui l\'anno riparte non c\'e\''}`, uscitoNoto > 0 ? `usciti ${formatKg(uscitoNoto)} kg` : ''].filter(Boolean).join(' · ')}
        className="block w-full rounded-md border px-1.5 py-1 text-center text-[11px] leading-tight tabular-nums font-medium cursor-help text-muted-foreground">
        {uscitoNoto > 0 ? `${prima.uscito_stimato ? '~' : ''}${formatKg(uscitoNoto)}` : '—'}
      </span>
    );
  }
  const uscito = prima.uscito_kg || 0;
  const resta = prima.resta_kg || 0;
  const circa = prima.uscito_stimato ? '~' : '';
  const fondo = uscito > 0 && resta <= 0 ? 'bg-emerald-600 text-white'
    : uscito > 0 ? 'bg-emerald-200 text-emerald-950'
      : resta > 0 ? 'bg-amber-50 text-amber-900'
        : '';
  const titolo = [
    `Dall'anno prima: giacenza da cui il ${anno} riparte, ${formatKg(prima.conferito_kg)} kg`,
    prima.dichiarato_dopo_kg > 0 ? `(letti al ${giornoIt(prima.al)} ${formatKg(prima.letta_kg)} kg, meno ${formatKg(prima.dichiarato_dopo_kg)} kg dell'anno chiuso dichiarati dopo)` : (prima.al ? `(al ${giornoIt(prima.al)})` : ''),
    `usciti ${formatKg(uscito)} kg${prima.uscito_stimato ? ' (in parte ripartiti dal gestionale: il report del portale non ha ancora quella dichiarazione)' : ''}`,
    resta > 0 ? `restano in giacenza ${formatKg(resta)} kg` : 'niente più in giacenza dell\'anno prima',
  ].filter(Boolean).join(' · ');
  return (
    <span title={titolo} className={`block w-full rounded-md border px-1.5 py-1 text-center text-[11px] leading-tight tabular-nums font-medium cursor-help ${fondo}`}>
      {uscito > 0 ? `${circa}${formatKg(uscito)}` : resta > 0 ? formatKg(resta) : '—'}
    </span>
  );
}

export default function Riepilogo({ dati, onApri, soloLettura }) {
  // Un canale su cui l'impianto non ha mai dichiarato niente e su cui il portale
  // non aspetta niente non e' una riga di questa tabella: sarebbe dodici caselle
  // vuote. Gli ACI di Irigom, per esempio, ripartono come secondarie ed e' chi li
  // lavora a dichiararli.
  const tutte = dati.siti.filter(s => s.tipo_destinazione !== 'stoc').flatMap(s => s.flussi.map(f => ({ sito: s, flusso: f })));
  // Una riga si mostra anche quando nel mese sono ARRIVATI dei carichi e non
  // sono ancora dichiarati, non solo quando lo dice la fotografia del portale:
  // la fotografia e' di un giorno preciso e puo' essere vecchia di settimane, e
  // un impianto che ha ricevuto a settembre spariva dal riepilogo invece di
  // comparire con «da chiedere» (regola dell'utente, 01/10/2026).
  // E si mostra quando c'e' una giacenza dall'anno prima, anche se quest'anno
  // non e' ancora arrivato niente: a gennaio e' l'unica cosa che c'e' (11/10/2026).
  const righe = tutte.filter(({ flusso }) => flusso.dichiarato_totale_t > 0
    || flusso.mesi.some(m => m.non_dichiarato_kg > 0 || m.da_dichiarare_kg > 0 || m.uscito_kg > 0)
    || (flusso.dall_anno_prima && (flusso.dall_anno_prima.resta_kg > 0 || flusso.dall_anno_prima.uscito_kg > 0))
    // E quando manca l'apertura del 31/12 (chiusura della prova generale del
    // cambio d'anno, 15/10/2026): la giacenza del canale e' «—», non assente.
    || flusso.senza_apertura);
  const annoPrima = (Number(dati.anno) || 0) - 1;
  // DOVE IL CONTO DEI MESI NON SI CHIUDE, SI DICE.
  //
  // Due casi, entrambi veri e nessuno dei due da nascondere: il portale ha
  // agganciato piu' di quanto risulti dalle nostre dichiarazioni caricate
  // (uscito_oltre_kg: e' il caso delle dichiarazioni che il portale ha e il
  // gestionale no, 01/10/2026), oppure un pezzo di dichiarazione non trova
  // nessun mese che lo assorba (uscito_non_allocato_kg).
  //
  // UN ANNO PRIMA DEL GESTIONALE NON E' UN CONTO CHE NON SI CHIUDE (giro del
  // 14/10/2026 sulle decisioni dell'utente del 13/10/2026). Le sue dichiarazioni
  // non sono scritte qui, quindi tutto quello che il portale ha agganciato
  // risultava «dichiarato in piu'» con «c'e' un caricamento che qui non e' stato
  // registrato», un impianto per riga: sul 2025 dei dati veri sette righe, Irigom
  // 4.439.080 kg. Non c'e' niente da registrare: si dice una volta perche'.
  const primaDelGestionale = !!dati.prima_del_gestionale;
  const nonChiuse = primaDelGestionale ? [] : righe
    .map(({ sito, flusso }) => ({ sito, flusso, oltre: flusso.uscito_oltre_kg || 0, fuori: flusso.uscito_non_allocato_kg || 0 }))
    .filter(x => x.oltre > 0 || x.fuori > 0);
  // Il perche' di un «—» della riga, detto dal riepilogo: l'anno prima del
  // gestionale, o l'apertura del 31/12 che manca, del canale (flusso.perche) o
  // dell'impianto (15/10/2026).
  const percheDi = (sito, flusso = null) => (flusso && flusso.perche) || sito.perche_prima_del_gestionale || dati.perche_prima_del_gestionale || sito.perche_senza_apertura || '';
  const nascoste = tutte.length - righe.length;
  // I formulari arrivati agli impianti senza fine trasporto non sono in nessuna
  // casella: si dice quanti e quanto pesano, canale per canale, mai sommati
  // (22/09/2026). Solo gli ARRIVI agli IMPIANTI, perche' le caselle sono quello:
  // il totale del canale contava anche gli stoccaggi e le terziarie, che qui non
  // comparirebbero comunque, e il numero "fuori dalle caselle" usciva gonfiato.
  // Ogni formulario arriva a un impianto solo: sommarli per impianto non conta
  // nessuno due volte.
  const impianti = dati.siti.filter(s => s.tipo_destinazione !== 'stoc');
  // GLI ORDINI IN LIMBO: "eseguito" a portale, e il pulsante Chiudi mai premuto.
  //
  // Hanno tutti i dati dentro - peso, formulario, date - ma finche' restano cosi'
  // il gestionale non li conta da nessuna parte, perche' conta i terminati. Quei
  // chili non sono in nessuna casella di questa tabella, e senza questo avviso il
  // totale sembra completo: e' il modo peggiore di perdere un dato.
  //
  // Chiesto dall'utente il 02/10/2026 dopo il caso di Green Tyre: due ritiri di
  // Torres del 30 settembre, 11.700 kg, che a portale non comparivano ne' fra i
  // dichiarati ne' fra i non dichiarati, e la pagina mostrava meno del vero senza
  // dire perche'.
  const inLimbo = impianti.flatMap(s => (s.eseguiti || []).map(e => ({ sito: s.sito, chiave: s.chiave, ...e })));
  const limboKg = inLimbo.reduce((t, e) => t + e.kg, 0);
  const limboOrdini = inLimbo.reduce((t, e) => t + e.ordini, 0);
  // Per riga: la casella non puo' dirlo da sola, perche' quei chili non stanno in
  // nessun mese. Si dice sotto il nome dell'impianto, sul canale giusto.
  const limboDi = (sito, canale) => inLimbo.find(e => e.chiave === sito.chiave && e.canale === canale);

  const fuoriDaiMesi = CANALI.map(c => {
    const gruppi = impianti.flatMap(s => (s.date_da_sistemare || []).filter(g => g.canale === c.chiave && g.ruolo !== 'stoc'));
    const quanti = (campo) => gruppi.reduce((tot, g) => tot + ((g.senza_fine && g.senza_fine[campo]) || 0), 0);
    return { nome: c.nome, n: quanti('arrivi_n'), kg: quanti('arrivi_kg') };
  }).filter(c => c.n > 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1" title="Di quel mese è uscito tutto: lo dice il report del portale, ordine per ordine, anche quando è uscito con la dichiarazione di un mese dopo."><span className="w-4 h-4 rounded bg-emerald-600 inline-flex items-center justify-center"><Check className="w-3 h-3 text-white" /></span> uscito tutto</span>
        <span className="flex items-center gap-1" title="Di quel mese è uscita una parte: il resto è nella riga «resta in giacenza»."><span className="w-4 h-4 rounded bg-emerald-200 border" /> uscito in parte</span>
        <span className="flex items-center gap-1" title="In questo mese la dichiarazione è stata caricata a portale: per un impianto R1 è il mese della nave, e quel caricamento porta via i mesi di prima. Il numero è quello che si è caricato; quali mesi ha chiuso lo dice il titolo della casella."><span className="w-4 h-4 rounded bg-indigo-600 inline-flex items-center justify-center"><Ship className="w-3 h-3 text-white" /></span> caricata a portale</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-emerald-100 inline-flex items-center justify-center"><Mail className="w-3 h-3" /></span> dichiarazione in mano</span>
        <span className="flex items-center gap-1" title="Di quel mese non è ancora uscito niente."><span className="w-4 h-4 rounded bg-amber-50 border" /> ancora in giacenza</span>
        <span className="flex items-center gap-1" title={MOTIVI_ASSENZA.solo_metalli.spiega}><span className="w-4 h-4 rounded bg-orange-300 border" /> solo metalli ferrosi, dichiarati al consorzio via email</span>
        <span className="flex items-center gap-1" title={MOTIVI_ASSENZA.non_dovuta.spiega}><span className="w-4 h-4 rounded bg-slate-50 border inline-flex items-center justify-center"><Minus className="w-3 h-3 text-slate-500" /></span> non dovuta</span>
        <span>Le quantità sono in kg; i totali in tonnellate contano solo le dichiarazioni caricate.</span>
        <span>Gli stoccaggi non compaiono perché non dichiarano: le secondarie che spediscono stanno sulla riga dell&apos;impianto che le riceve.</span>
        {/* LE RIGHE DELLA STORIA (12/10/2026): si dicono una volta qui, come i colori. */}
        <span>Sotto ogni riga, la giacenza a fine mese: quello che è entrato meno le dichiarazioni caricate fino a quel mese. Per chi è stato anche stoccaggio, in azzurro, quello che è passato dallo stoccaggio. Sono righe da leggere: non entrano nei totali. «storia» racconta la riga; la «i» nell&apos;angolo di una casella dice quali mesi ha coperto quella dichiarazione.</span>
        {nascoste > 0 && <span>Non compaiono {nascoste === 1 ? 'una riga' : `${nascoste} righe`} su cui non c'è mai stata una dichiarazione e su cui il portale non aspetta niente.</span>}
      </div>
      {fuoriDaiMesi.length > 0 && (
        <p className="text-xs text-amber-800">
          Senza fine trasporto un formulario arrivato all&apos;impianto non è in nessun mese, e nelle caselle non compare finché la data non arriva:{' '}
          {fuoriDaiMesi.map(c => `${c.nome} ${c.n} (${formatKg(c.kg)} kg)`).join(' · ')}. Quali sono, nella scheda Impianti.
        </p>
      )}
      {/* Al posto dei conti che non si chiudono, sullo stesso posto della pagina. */}
      {primaDelGestionale ? (
        <p className="text-xs text-muted-foreground cursor-help" title={dati.perche_prima_del_gestionale || undefined}>
          Il {dati.anno} è prima del gestionale: le sue dichiarazioni non sono scritte qui. In verde quello che il report del portale ha
          agganciato ai carichi di ogni mese; il caricato, quello che resta e la giacenza non si ricostruiscono, e non sono zero.
        </p>
      ) : nonChiuse.length > 0 && (
        <div className="text-xs text-amber-800 space-y-0.5">
          {nonChiuse.map(({ sito, flusso, oltre, fuori }) => (
            <p key={`${sito.chiave}-${flusso.canale}-${flusso.provenienza}-chiusura`}>
              <strong className="text-foreground">{sito.sito}</strong> · {nomeCanale(flusso)}:{' '}
              {oltre > 0 && <>a portale risultano dichiarati {formatKg(oltre)} kg in più di quanto dicono le nostre dichiarazioni caricate: c&apos;è un caricamento che qui non è stato registrato. </>}
              {fuori > 0 && <>{formatKg(fuori)} kg di dichiarazione non trovano un mese che li assorba: da capire prima di fidarsi dei mesi.</>}
            </p>
          ))}
        </div>
      )}
      {inLimbo.length > 0 && (
        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
          <p>
            <strong>{limboOrdini === 1 ? "Un ordine è" : `${limboOrdini} ordini sono`} in stato «eseguito» a portale e non {limboOrdini === 1 ? "è stato chiuso" : "sono stati chiusi"}:</strong>{" "}
            {formatKg(limboKg)} kg che non sono in nessuna casella di questa tabella, perché il gestionale conta i formulari chiusi.
            Hanno già tutti i dati: manca solo il pulsante Chiudi, a portale. Finché resta così, quei chili non risultano né raccolti né da dichiarare.
          </p>
          <ul className="pl-4 list-disc">
            {inLimbo.map(e => (
              <li key={`${e.chiave}-${e.canale}`}>
                <span className="font-medium">{e.sito}</span> · {(CANALI.find(c => c.chiave === e.canale) || { nome: e.canale }).nome} ·{" "}
                {e.ordini === 1 ? "1 ordine" : `${e.ordini} ordini`} ({formatKg(e.kg)} kg)
                {e.mesi.length ? ` · ${e.mesi.join(", ")}` : " · senza fine trasporto"}
                {e.esempi.length ? <span className="text-amber-800">{" — "}{e.esempi.map(o => o.id_ordine || o.numero_fir).filter(Boolean).join(", ")}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border rounded-xl bg-card" data-scorre-lato>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/50 min-w-[230px]">Impianto · canale</th>
              <th className="px-1 py-2 font-semibold text-center min-w-[74px] whitespace-nowrap" title="La giacenza da cui l'anno riparte: quello che il 31/12 restava da dichiarare, al netto di quello che dell'anno chiuso si è dichiarato dopo. Il portale aggancia dal carico più vecchio, quindi è la prima casella a svuotarsi.">Dal {annoPrima || 'anno prima'}</th>
              {MESI_BREVI.map(m => <th key={m} className="px-1 py-2 font-semibold text-center min-w-[74px]">{m}</th>)}
              <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Caricato (t)</th>
              <th className="px-3 py-2 font-semibold text-right whitespace-nowrap" title="La giacenza del canale: la giacenza dall'anno prima più quello che è arrivato, meno quello che è stato davvero caricato a portale. È il residuo da dichiarare, la somma della riga «resta in giacenza» qui sotto, casella dall'anno prima compresa: lo stesso numero della scheda Impianti e delle Giacenze.">Da dichiarare (t)</th>
            </tr>
          </thead>
          <tbody>
            {righe.map(({ sito, flusso }, i) => (
              <React.Fragment key={`${sito.chiave}-${flusso.canale}-${flusso.provenienza}`}>
              <tr className={`${i % 2 ? 'bg-muted/20' : ''}`}>
                <td className="px-3 pt-1.5 sticky left-0 bg-inherit">
                  <span className="font-medium">{sito.sito}</span>
                  <RaccontoRiga frasi={flusso.racconto} titolo={`${sito.sito} · ${nomeCanale(flusso)}`} />
                  <span className="block text-[11px] text-muted-foreground">
                    {nomeCanale(flusso)}{sito.operazione ? ` · ${sito.operazione}` : ''}
                    {flusso.da_stoccaggi_t > 0 ? ` · ${formatTonnellate(flusso.da_stoccaggi_t)} t da stoccaggi` : ''}
                  </span>
                </td>
                <td className="px-0.5 py-1">
                  <CasellaAnnoPrima prima={flusso.dall_anno_prima} anno={dati.anno} perche={percheDi(sito, flusso)} senzaApertura={!!flusso.senza_apertura} />
                </td>
                {flusso.mesi.map(m => (
                  <td key={m.mese} className="px-0.5 py-1">
                    {/* Una dichiarazione la si aspetta se qualcosa e' arrivato
                        e non e' ancora dichiarato: lo dicono i nostri ingressi
                        (da_dichiarare_kg), non solo la fotografia del portale. */}
                    <div className="relative">
                      <CellaMese mese={m} soloLettura={soloLettura} dove={{ canale: flusso.canale, dichiara_rete: sito.dichiara_rete }} onApri={() => onApri(sito, flusso, m)} />
                      <AngoloPerche mese={m} />
                    </div>
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right tabular-nums font-medium">{flusso.prima_del_gestionale
                  ? <span className="text-muted-foreground cursor-help" title={percheDi(sito)}>—</span>
                  : formatTonnellate(flusso.dichiarato_caricato_t)}</td>
                {/* QUANTO RESTA DA DICHIARARE, SU TUTTA LA RIGA.

                    E LA GIACENZA, non la somma dei mesi non dichiarati. Le due cose
                    coincidono dove l impianto dichiara mese per mese - Gatim 234,41,
                    Green Tyre 260,20, gli stessi numeri - ma non dove dichiara quando
                    il prodotto esce. Irigom e un R1: il mese in cui parte la nave
                    dichiara piu di quanto gli e arrivato in quel mese, e sommando i
                    mesi con il max a zero quell eccedenza si perdeva: usciva 1.301,08
                    invece di 543,22. Parole dell utente, 02/10/2026: «il residuo da
                    dichiarare di Irigom e pari alla sua giacenza», e «non devi sommare
                    tutto quando le uscite sono di solo ferro perche quello poi va via
                    con la nave successiva».

                    La giacenza il gestionale la calcola gia e la confronta col portale
                    (giacenza_calcolata_t, scheda Impianti): cosi le due schede dicono
                    lo stesso numero. Vale per la rete, che e il canale che il portale
                    tiene; sugli altri resta la somma dei mesi.

                    DAL 09/10/2026 LE DUE COSE SONO LA STESSA COSA, e la colonna mostra
                    la somma della riga «resta in giacenza». Da quando il mese sa quanto
                    gli e' davvero uscito - dal report del portale, ordine per ordine -
                    sommare i mesi DA' la giacenza: su T-Cycle 352,94, su Irigom 637,44,
                    su Green Tyre 321,70, su Gatim 251,72, gli stessi numeri del
                    portale. Mostrare qui la somma della riga e non un numero calcolato
                    per un'altra strada e' la garanzia che la riga non possa piu'
                    smentirsi da sola, che era il difetto segnalato.

                    DAL 11/10/2026 VALE SU TUTTI E TRE I CANALI E A GENNAIO. La somma
                    comprende la casella dall'anno prima, e il conto si chiude sulla
                    giacenza anche per ACI ed extra raccolta: prima un'apertura non
                    ancora dichiarata mancava dalla colonna, e su ACI ed extra la
                    colonna era la somma dei mesi e non la giacenza.

                    Dove la dichiarazione non e dovuta per accordo la colonna tace: non
                    e un arretrato. */}
                <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                  {(() => {
                    if (flusso.non_dovuta || (flusso.canale === 'RETE' && sito.dichiara_rete === false)) return <span className="text-muted-foreground cursor-help" title={"Per accordo questo impianto non ci dichiara la rete: il trattamento non e' a nostro carico, il portale non tiene per noi una giacenza di rete e niente resta da dichiarare. Quello che e' arrivato si vede nella riga del conferito."}>—</span>;
                    // Una giacenza sotto zero si mostra e si segnala: e' un errore da
                    // correggere, non un numero da azzerare (utente, 03/10/2026). La
                    // somma dei mesi non puo' andare sotto zero, quindi il negativo lo
                    // dice la giacenza del canale, che resta il controllo.
                    const g = (sito.giacenze_canale || []).find(x => x.canale === flusso.canale);
                    if (g && g.giacenza_t < 0) return <span className="text-red-600" title="Giacenza sotto zero: da correggere. Il dichiarato supera quello che risulta arrivato.">{formatTonnellate(g.giacenza_t)}</span>;
                    const resta = flusso.resta_t;
                    // null non e' zero: un anno prima del gestionale, col perche' (13/10/2026).
                    if (resta === null) return <span className="text-muted-foreground cursor-help" title={percheDi(sito, flusso)}>—</span>;
                    return resta > 0
                      ? <span className="text-amber-700" title="La somma della riga «resta in giacenza» qui sotto">{formatTonnellate(resta)}</span>
                      : <span className="text-muted-foreground">—</span>;
                  })()}
                </td>
              </tr>
              {/* LA SECONDA LINEA: QUELLO CHE E' ENTRATO IN QUEL MESE (06/10/2026).
                  Chiesto dall'utente: «una doppia linea per distinguere cio' che in
                  quel mese e' stato dichiarato e cio' che e' stato conferito». */}
              <tr className={`${i % 2 ? 'bg-muted/20' : ''}`}>
                <td className="px-3 py-0.5 sticky left-0 bg-inherit text-[11px] text-muted-foreground">conferito nel mese</td>
                <td className="px-1 py-0.5 text-center tabular-nums text-[11px]" title="La giacenza da cui l'anno riparte (apertura netta)">
                  {flusso.dall_anno_prima && flusso.dall_anno_prima.conferito_kg > 0
                    ? <span className="text-muted-foreground">{formatTonnellate(flusso.dall_anno_prima.conferito_kg / 1000)}</span>
                    : <span className="text-muted-foreground/50">—</span>}
                </td>
                {flusso.mesi.map(m => (
                  <td key={m.mese} className="px-1 py-0.5 text-center tabular-nums text-[11px]">
                    {m.conferito_kg > 0
                      ? <span className="text-muted-foreground">{formatTonnellate(m.conferito_kg / 1000)}</span>
                      : <span className="text-muted-foreground/50">—</span>}
                  </td>
                ))}
                <td className="px-3 py-0.5 text-right tabular-nums text-[11px] text-muted-foreground" title="Tutto quello che e' entrato nell'anno su questa riga">
                  {formatTonnellate(flusso.conferito_t)}
                </td>
                <td className="px-3 py-0.5" />
              </tr>
              {/* LA TERZA LINEA: QUELLO CHE DI QUEL MESE E' ANCORA IN GIACENZA
                  (09/10/2026). Chiesta dall'utente: «lasciando in basso la parte
                  restante in giacenza oltre agli ingressi del mese». E' il
                  complemento della casella: arrivati meno usciti. La somma di
                  questa riga e' la giacenza del canale, lo stesso numero della
                  colonna a destra e della quadratura col portale - prima no, e
                  quella era la confusione. */}
              {/* Dove la rete non e' dovuta per accordo quello che resta e' giacenza
                  e basta, non un arretrato: si scrive in grigio, come la colonna
                  che tace. L'ambra qui farebbe sembrare un buco quello che un
                  buco non e' (Tecnogum, 09/10/2026). */}
              <tr className={`${i % 2 ? 'bg-muted/20' : ''}`}>
                {(() => {
                  // LA RETE NON DOVUTA NON HA UNA GIACENZA (utente, 10/10/2026: «“—” con la
                  // spiegazione, in tutti e due i moduli»). Qui si scrivevano in grigio i
                  // resti di ogni mese e 1.833,43 t in fondo, mentre le Giacenze dicevano
                  // 0: due numeri per la stessa cosa. Ora la riga tace col perche', e
                  // quello che e' arrivato resta visibile nella riga del conferito.
                  const nonDovuta = flusso.non_dovuta || (flusso.canale === 'RETE' && sito.dichiara_rete === false);
                  const tono = nonDovuta ? 'text-muted-foreground' : 'text-amber-700 font-medium';
                  const perche = nonDovuta
                    ? 'è in impianto, ma di questo canale non ci deve dichiarazione: resta come storia'
                    : 'sono ancora in impianto';
                  return (
                    <>
                      <td className="px-3 pb-1.5 sticky left-0 bg-inherit text-[11px] text-muted-foreground">resta in giacenza</td>
                      <td className="px-1 pb-1.5 text-center tabular-nums text-[11px]">
                        {flusso.dall_anno_prima && flusso.dall_anno_prima.resta_kg > 0 && !nonDovuta
                          ? <span className={tono} title={`Dall'anno prima ${formatKg(flusso.dall_anno_prima.resta_kg)} kg ${perche}`}>{formatTonnellate(flusso.dall_anno_prima.resta_kg / 1000)}</span>
                          : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      {flusso.mesi.map(m => (
                        <td key={m.mese} className="px-1 pb-1.5 text-center tabular-nums text-[11px]">
                          {m.resta_kg > 0 && !nonDovuta
                            ? <span className={tono} title={`Di ${m.mese} ${formatKg(m.resta_kg)} kg ${perche}`}>{formatTonnellate(m.resta_kg / 1000)}</span>
                            : <span className="text-muted-foreground/50">—</span>}
                        </td>
                      ))}
                      <td className={`px-3 pb-1.5 text-right tabular-nums text-[11px] ${nonDovuta ? 'text-muted-foreground' : 'text-amber-700'}`}
                        title={nonDovuta
                          ? 'La somma dei mesi: quello che è in impianto. Non è un arretrato: di questo canale non ci deve dichiarazione, per accordo'
                          : "La somma della riga, casella dall'anno prima compresa: è la giacenza del canale, lo stesso numero della colonna «Da dichiarare»"}>
                        {nonDovuta ? <span className="cursor-help" title={"Per accordo questo impianto non ci dichiara la rete: il trattamento non e' a nostro carico, il portale non tiene per noi una giacenza di rete e niente resta da dichiarare. Quello che e' arrivato si vede nella riga del conferito."}>—</span>
                          /* La somma della riga di un anno prima del gestionale non c'e': formatTonnellate(null) scriveva 0,00 (13/10/2026). */
                          : flusso.resta_t === null ? <span className="cursor-help" title={percheDi(sito, flusso)}>—</span>
                            : formatTonnellate(flusso.resta_t)}
                      </td>
                      <td className="px-3 pb-1.5" />
                    </>
                  );
                })()}
              </tr>
              {/* LA QUARTA LINEA E LO STOCCAGGIO DELLO STESSO SITO (12/10/2026).
                  Richiesta dell'utente sul caso T-Cycle: la giacenza di quello che
                  resta dopo ogni dichiarazione, e per chi e' stato anche stoccaggio
                  quello che dallo stoccaggio e' passato, «per completezza e memoria
                  storica». Righe da leggere: non entrano nel conferito, nel
                  «Caricato», nel «Da dichiarare» ne' nei totali (StoriaRiga.jsx). */}
              <RigaGiacenzaFineMese flusso={flusso} nonDovuta={flusso.non_dovuta || (flusso.canale === 'RETE' && sito.dichiara_rete === false)} sfondo={i % 2 ? 'bg-muted/20' : ''} />
              <RigheStoccaggio stoccaggio={flusso.stoccaggio_stesso_sito} sfondo={i % 2 ? 'bg-muted/20' : ''} />
              <tr className="border-b"><td colSpan={16} className="p-0" /></tr>
              </React.Fragment>
            ))}
            {righe.length === 0 && (
              <tr><td colSpan={16} className="text-center py-6 text-muted-foreground">Nessun impianto con movimenti o dichiarazioni per quest'anno.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
