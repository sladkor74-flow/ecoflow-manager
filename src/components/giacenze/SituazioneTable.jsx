import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { formatNumber, formatTonnellate, formatIntero, formatKg } from '@/lib/utils';
// I nomi dei canali sono quelli del modulo Dichiarazioni Impianti: le righe per
// canale di qui e quelle del riepilogo delle dichiarazioni devono chiamarsi uguale.
import { CANALI } from '@/lib/dichiarazioniImpianti';
import { riassuntoGruppo } from '@/components/giacenze/DateDaSistemare';

function fmt(n, dec = 2) {
  if (n == null || n === '' || isNaN(n)) return '—';
  // Conteggi interi; tonnellate con due decimali, tre se i kg non sono tondi.
  return dec === 0 ? formatNumber(n, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : dec === 2 ? formatTonnellate(n) : formatNumber(n, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// Le classi come nel portale Ecotyre, in kg per confrontarle direttamente.
const CLASSI = [
  { chiave: 'P', titolo: 'P', aiuto: 'fino a 35 kg (auto/moto)' },
  { chiave: 'M', titolo: 'M', aiuto: 'fino a 155 kg (camion, bus)' },
  { chiave: 'G1', titolo: 'G1', aiuto: 'oltre 155 kg (agricoltura)' },
  { chiave: 'G2', titolo: 'G2', aiuto: 'oltre 155 kg (industriali)' },
  { chiave: 'ACI', titolo: 'ACI', aiuto: 'PFU da autodemolizione' },
];

const IN_ATTESA_TOOLTIP = "Materiale gia' partito da questo stoccaggio verso un impianto: il portale lo attribuisce ancora qui finche' il destinatario non presenta la dichiarazione. Non e' giacenza.";
const RILEVAZ_OBSOLETA_TOOLTIP = "L'ultima rilevazione ha oltre trenta giorni: il numero non invecchia, perche' viene dai movimenti, ma il riscontro col portale si', e conviene rifarlo dalla pagina Unita' Locali di Stoccaggio.";

// Una classe sotto zero non e' un errore di conto da aggiustare: e' quello che
// esce dai dati, e va detto da dove viene invece di mostrarlo e basta. Il
// numero parte dall'ancora dell'anno (24/09/2026): se va sotto zero, o l'ancora
// ha i chili nella classe sbagliata o manca un movimento in archivio. E ogni
// secondaria parte con una classe sola, mentre in piazzale il materiale e'
// misto: basta un viaggio dichiarato in una classe per portarla sotto zero. Il
// totale del sito puo' restare giusto: a sbagliare e' la ripartizione.
const CLASSE_NEGATIVA_TOOLTIP = (classe, giorno) => [
  `Il numero e' il dato, non un arrotondamento: l'ancora dell'anno, la rilevazione del ${giorno}, piu' gli ingressi e meno le uscite di classe ${classe} finiti dopo, per fine trasporto.`,
  `Sotto zero vuol dire che da allora ne risulta uscita piu' di quanta ne sia entrata: o l'ancora ha i chili nella classe sbagliata, o manca un ingresso in archivio. E ogni secondaria parte con una classe sola, mentre in piazzale il materiale e' misto.`,
  `Da guardare: i formulari di classe ${classe} partiti dopo il ${giorno}, e il riscontro con una lettura nuova del portale, dalla pagina Unita' Locali di Stoccaggio. La segnalazione e' anche fra le anomalie, in cima alla pagina.`,
];
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('it-IT'); }
/** Un giorno 'AAAA-MM-GG' come lo si legge: GG/MM/AAAA. */
const fmtGiorno = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '—');

/**
 * La somma dei SOLI movimenti in archivio di un canale, da mettere accanto alla
 * giacenza (richiesta dell'utente, 23/09/2026: «cosi' si vede a colpo d'occhio
 * quanto manca all'appello e da quando»).
 *
 * Non e' una giacenza e non va mostrata come tale: vale dal primo movimento
 * caricato, non da quando il piazzale era vuoto. Su Nappi Sud l'archivio comincia
 * il 12/01/2024 e la somma da' P -61.420, M -24.150, G1 -2.690 kg, che un
 * piazzale non puo' avere. E' un termine di confronto, e si dice da quando conta.
 */
export function riassuntoArchivio(saldo, canale = 'RETE') {
  const c = saldo && saldo[canale];
  if (!c || !c.movimenti) return null;
  const negativo = c.saldo_kg < 0;
  return {
    canale,
    kg: c.saldo_kg,
    t: c.saldo_kg / 1000,
    movimenti: c.movimenti,
    dal: c.dal,
    al: c.al,
    negativo,
    senza_fine: c.senza_fine,
    // Quello che si legge sulla riga: sempre da quando conta, mai «giacenza».
    // Sotto zero il numero da solo si leggerebbe come una giacenza impossibile:
    // la riga stessa dice che l'archivio non copre tutta la storia del piazzale.
    riga: negativo
      ? `dai soli movimenti in archivio dal ${fmtGiorno(c.dal)}: ${formatTonnellate(c.saldo_kg / 1000)} t, cioe' l'archivio non copre tutto`
      : `dai soli movimenti in archivio dal ${fmtGiorno(c.dal)}: ${formatTonnellate(c.saldo_kg / 1000)} t`,
    dettaglio: `${formatIntero(c.movimenti)} movimenti fino al ${fmtGiorno(c.al)}: ${formatIntero(c.ingressi)} ingressi per ${formatKg(c.ingressi_kg)} kg, ${formatIntero(c.uscite)} uscite per ${formatKg(c.uscite_kg)} kg.`,
    avvertenza: negativo
      ? `Sotto zero, e non e' un errore di conto: l'archivio non arriva a quando il piazzale era vuoto. I movimenti caricati cominciano il ${fmtGiorno(c.dal)} e manca tutto quello che c'era prima, percio' questo numero non e' una giacenza.`
      : `Vale dal ${fmtGiorno(c.dal)}, il primo movimento in archivio: prima di quel giorno il piazzale poteva gia' avere materiale. Non e' una giacenza, e' un termine di confronto.`,
  };
}
function fmtDataOra(d) {
  if (!d) return '';
  const x = new Date(d);
  return `${x.toLocaleDateString('it-IT')} ${x.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
}

// Come si arriva alla giacenza di uno stoccaggio, UN CANALE PER VOLTA: l'ancora
// dell'anno, piu' gli ingressi e meno le uscite di quel canale finiti dopo;
// l'ultima lettura del portale e' il riscontro (24/09/2026). Sta sotto la
// giacenza del canale, perche' il conto e' suo: rete e ACI non si sommano, e
// l'extra raccolta, che a portale non c'e', non ha ne' ancora ne' lettura.
function DettaglioStoccaggio({ r, canale }) {
  const d = r.dopo_rilevazione;
  if (!d) return null;
  const soloAci = canale === 'ACI';
  // I movimenti del canale della riga e i chili da cui parte: la classe 9 e'
  // l'ACI, le altre quattro sono rete.
  const suoi = soloAci ? d.aci : d.rete;
  if (!suoi) return null;
  const ancoraKg = Object.entries(r.rilevazione_classi_kg || {}).reduce((s, [c, v]) => s + ((c === 'ACI') === soloAci ? v : 0), 0);
  const nome = soloAci ? 'ACI' : 'Rete';
  const classi = soloAci ? 'classe 9' : 'classi P, M, G1, G2';
  const mov = suoi.ingressi || suoi.uscite ? ` · +${suoi.ingressi} −${suoi.uscite}` : '';
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`mt-1 text-xs flex items-center justify-end gap-1 cursor-help ${r.rilevazione_obsoleta ? 'text-amber-600' : 'text-muted-foreground'}`}>
            {r.rilevazione_obsoleta && <AlertTriangle className="w-3 h-3" />}
            <span className="underline decoration-dotted underline-offset-2">
              {d.ultima_lettura && d.ultima_lettura !== d.dal
                ? <>dall&apos;ancora del {fmtDate(d.dal)}{mov} · letto il {fmtDate(r.data_rilevazione)}</>
                : <>dalla lettura del {fmtDate(d.dal)}{mov}</>}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm text-xs space-y-1">
          <div>Ancora dell&apos;anno, la rilevazione del {fmtDate(d.dal)}: {nome} {formatKg(ancoraKg)} kg ({classi}).</div>
          <div>{nome}, finiti dopo l&apos;ancora: {suoi.ingressi} ingressi per {formatKg(suoi.ingressi_kg)} kg, {suoi.uscite} uscite per {formatKg(suoi.uscite_kg)} kg.</div>
          <div>L&apos;altro canale ha la sua riga, con il suo conto: i due non si sommano.</div>
          {d.ultima_lettura && d.ultima_lettura !== d.dal && <div>L&apos;ultima lettura del portale, del {fmtDate(d.ultima_lettura)}, e&apos; il riscontro: si confronta con questo numero nella riconciliazione del piazzale, ma non lo cambia.</div>}
          <div>Movimenti caricati fino al {fmtDate(r.aggiornata_al)}, per fine trasporto. {r.rilevazione_obsoleta ? RILEVAZ_OBSOLETA_TOOLTIP : ''}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// La somma dei soli movimenti in archivio del canale, sotto la sua giacenza. Si
// mostra per quello che e': da quando conta, quanti movimenti sono, e se esce
// sotto zero si dice perche' invece di farla passare per una giacenza. Una riga
// per canale: prima la rete stava sulla riga e gli altri due si leggevano solo
// passando col mouse sul suo tooltip.
function SaldoArchivio({ r, canale }) {
  const a = riassuntoArchivio(r.saldo_movimenti_archivio, canale);
  if (!a) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`mt-0.5 text-[11px] flex items-center justify-end gap-1 cursor-help ${a.negativo ? 'text-amber-700' : 'text-muted-foreground'}`}>
            {a.negativo && <AlertTriangle className="w-3 h-3 shrink-0" />}
            <span className="underline decoration-dotted underline-offset-2">{a.riga}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm text-xs space-y-1">
          <div className="font-semibold">Non e&apos; una giacenza: e&apos; la somma dei soli movimenti che il gestionale ha in archivio su questo canale.</div>
          <div>{a.avvertenza}</div>
          <div>{a.dettaglio}</div>
          {a.senza_fine > 0 && <div>{formatIntero(a.senza_fine)} movimenti sono fuori da questa somma perche&apos; non hanno la fine trasporto: senza quella data non si collocano in nessun giorno.</div>}
          <div>La giacenza vera resta quella sopra: l&apos;ancora dell&apos;anno piu&apos; i movimenti finiti dopo. Questa somma serve a vedere quanto manca all&apos;appello e da quando. Gli altri canali hanno le loro righe e non si sommano a questa.</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// La giacenza di un impianto: la fotografia del portale aggiornata ai caricamenti.
function DettaglioImpianto({ r }) {
  const f = r.fotografia;
  if (!f) return null;
  const aggiornata = f.aggiunti > 0 || f.dichiarato_dopo_t > 0;
  return (
    <div className="mt-1 text-xs text-muted-foreground" title="La giacenza a portale segue i caricamenti: alla fotografia si aggiungono i carichi che il file del portale non contiene ancora, riconosciuti dal numero d'ordine, e si tolgono le dichiarazioni caricate dopo">
      {f.del ? `file del portale del ${fmtDate(f.del)}: ${fmt(f.foto_t)} t` : 'nessun file del portale'}
      {f.rete_non_dichiarata && <span className="block">la rete non la dichiara per accordo: il portale non ne tiene la giacenza per noi, e i carichi non si aggiungono</span>}
      {aggiornata && <span className="block">{f.aggiunti > 0 ? `+ ${fmt(f.aggiunti_t)} t di ${f.aggiunti} carichi non ancora nel file` : ''}{f.dichiarato_dopo_t > 0 ? ` − ${fmt(f.dichiarato_dopo_t)} t dichiarate dopo` : ''}</span>}
    </div>
  );
}

// Una classe con la giacenza sotto zero: il numero resta quello che e', ma dice
// da dove viene e che cosa andare a guardare.
function ClasseNegativa({ r, classe, valore }) {
  // Il giorno da cui parte il conto: l'ancora dell'anno, non l'ultima lettura.
  const giorno = fmtDate(r.dopo_rilevazione ? r.dopo_rilevazione.dal : r.data_rilevazione);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help underline decoration-dotted underline-offset-2">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {formatKg(valore)}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm text-xs space-y-1">
          <div className="font-semibold">
            Classe {classe.titolo} sotto zero: {formatKg(valore)} kg. Da questo piazzale e&apos; uscita piu&apos; classe {classe.titolo} di quanta ne risulti entrata.
          </div>
          {CLASSE_NEGATIVA_TOOLTIP(classe.titolo, giorno).map((t, i) => <div key={i}>{t}</div>)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// I formulari terminati con le date da sistemare di questo soggetto, per canale
// (regola dell'utente, 22/09/2026), con le terziarie a parte: non sono un
// movimento di canale e nella rete non si contano. Qui il riassunto; l'elenco
// degli ordini sta nelle anomalie in cima alla pagina e nell'export.
function DateRiga({ r }) {
  const gruppi = r.date_da_sistemare || [];
  if (!gruppi.length) return null;
  // Le terziarie non sono un canale: hanno la loro voce, fuori dal numero della rete.
  const nome = { RETE: 'rete', ACI: 'ACI', EXTRA_RACCOLTA: 'extra', TERZIARIE: 'terziarie' };
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mt-0.5 text-[11px] text-amber-700 flex items-center gap-1 cursor-help">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span className="underline decoration-dotted underline-offset-2">
              date da sistemare: {gruppi.map(g => `${nome[g.canale] || g.canale} ${g.n}`).join(' · ')}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm text-xs space-y-1">
          {gruppi.map(g => <div key={g.canale}><strong>{riassuntoGruppo(g)}.</strong> {g.avviso}</div>)}
          <div>Immissione, inizio e fine trasporto sono obbligatorie. Gli ordini sono elencati nelle anomalie, in cima alla pagina.</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Kg interi col segno davanti: uno scarto si legge solo se si vede da che parte va. */
const kgSegnoLocale = (v) => `${Number(v) > 0 ? '+' : Number(v) < 0 ? '−' : ''}${formatKg(Math.abs(Number(v) || 0))}`;

// Da quale archivio viene una riga: chi vuole andarla a vedere deve sapere dove.
const NOME_ARCHIVIO = {
  terminati_rete: 'Terminati Rete',
  terminati_aci: 'Terminati ACI',
  secondarie: 'Secondarie',
  extra_raccolta: 'Extra Raccolta',
};

/**
 * GLI ORDINI DIETRO LA GIACENZA ACI DI UN PIAZZALE (richiesta dell'utente,
 * 28/09/2026): si apre il numero della riga ACI e si vedono le righe che lo
 * compongono, una per una, col ticket accanto al peso.
 *
 * Buona parte di esse sta nei TERMINATI RETE: una primaria di classe 9 che si
 * trova nell'archivio della rete e' ACI, perche' decide il materiale e non
 * l'archivio (decisione dell'utente, 28/09/2026). Per questo ogni riga dice da
 * quale archivio viene.
 *
 * Il totale deve tornare al chilo col numero della riga ACI. Se non torna, qui
 * non si aggiusta niente: si dice lo scarto, perche' vuol dire che c'e' qualcosa
 * da capire.
 */
function DettaglioAci({ r }) {
  const d = r.aci_dettaglio;
  if (!d) return null;
  const segno = (m) => (m.verso === 'uscita' ? -1 : 1);
  return (
    <div className="p-3 bg-muted/30 text-xs space-y-2">
      <div>
        <span className="font-semibold">Da dove viene la giacenza ACI di {r.sito}.</span>{' '}
        L&apos;ancora dell&apos;anno per la classe 9, la rilevazione del {fmtGiorno(d.ancora_del)} ({formatKg(d.ancora_kg)} kg),
        piu&apos; gli ingressi e meno le uscite di ACI finiti dopo, per fine trasporto. La colonna
        <strong> Archivio</strong> dice dove sta ogni riga.
        {/* Che una classe 9 stia nell'archivio della rete oggi non capita: il
            caricamento smista col materiale e rifiuta il blocco se non torna. La
            regola resta come rete di sicurezza, ma dirla come se fosse la
            provenienza normale manderebbe l'utente a cercare in Terminati Rete
            righe che non ci sono. Si dice solo se ce n'e' davvero una. */}
        {d.ordini.some(m => m.archivio === 'terminati_rete') && (
          <> Qualche riga di classe 9 si trova nei <strong>Terminati Rete</strong>, ed e&apos; ACI lo stesso: decide il
            materiale, non l&apos;archivio in cui la riga e&apos; finita.</>
        )}
      </div>
      {d.ordini.length ? (
        <div className="overflow-x-auto border rounded-md bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr className="text-left">
                {['Archivio', 'ID ordine', 'Ticket (Numero_Ordine_Interno)', 'Formulario', 'Fine trasporto', 'Controparte', 'Movimento', 'kg'].map(h => (
                  <th key={h} className="px-2 py-1.5 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.ordini.map((m, i) => (
                <tr key={`${m.id_ordine}|${m.numero_fir}|${m.verso}|${i}`} className="border-t">
                  <td className="px-2 py-1.5 whitespace-nowrap">{NOME_ARCHIVIO[m.archivio] || m.archivio || '—'}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap font-medium">{m.id_ordine || '—'}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{m.ticket || '—'}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{m.numero_fir || '—'}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{fmtGiorno(m.finito_il)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{m.controparte || '—'}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{m.verso === 'uscita' ? 'uscita' : 'entrata'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{segno(m) < 0 ? '−' : '+'}{formatKg(m.kg)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/40 font-semibold border-t-2">
              <tr>
                <td className="px-2 py-1.5" colSpan={6}>
                  Ancora {formatKg(d.ancora_kg)} + {formatIntero(d.ingressi)} entrate {formatKg(d.ingressi_kg)} − {formatIntero(d.uscite)} uscite {formatKg(d.uscite_kg)}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">totale</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{formatKg(d.totale_kg)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="text-muted-foreground">Dopo l&apos;ancora non risulta nessun movimento ACI: la giacenza e&apos; quella dell&apos;ancora.</div>
      )}
      {d.torna === false ? (
        <div className="flex items-start gap-1 text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            La riga ACI dice {formatKg(d.colonna_kg)} kg e questi ordini ne fanno {formatKg(d.totale_kg)}: {kgSegnoLocale(d.scarto_kg)} kg
            di scarto. Il totale non si aggiusta per far quadrare la vista: uno scarto vuol dire che un movimento lo vede
            un conto e non l&apos;altro, e va capito. Il riscontro da guardare e&apos; l&apos;estratto conto del piazzale, nella scheda Stoccaggi.
          </span>
        </div>
      ) : (
        <div className="text-emerald-700">Torna al chilo con la riga ACI: {formatKg(d.colonna_kg)} kg.</div>
      )}
      {d.senza_fine > 0 && (
        <div className="flex items-start gap-1 text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            {/* Entrate e uscite dette separate: sommarle darebbe un numero che non
                vuol dire niente, come sommare i canali. */}
            Restano fuori {formatIntero(d.senza_fine)} {d.senza_fine === 1 ? 'movimento' : 'movimenti'} ACI senza la fine
            trasporto, {[
              d.senza_fine_ingressi_kg ? `${formatKg(d.senza_fine_ingressi_kg)} kg in entrata` : '',
              d.senza_fine_uscite_kg ? `${formatKg(d.senza_fine_uscite_kg)} kg in uscita` : '',
            ].filter(Boolean).join(' e ')} ({d.senza_fine_ordini.map(m => m.id_ordine || m.numero_fir).slice(0, 10).join(', ')}
            {d.senza_fine_ordini.length > 10 ? ` e altri ${d.senza_fine_ordini.length - 10}` : ''}): senza quella data non
            si collocano in nessun giorno e in nessun conto, e la data va messa a portale.
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * UNA RIGA PER CANALE, NON TRE COLONNE AFFIANCATE.
 *
 * Regola dell'utente, 03/10/2026: «ok riga per canale nelle giacenze», dopo aver
 * chiesto il giorno prima «aggiungi altre righe se necessario cosi' come nel
 * riepilogo dichiarazioni anche nelle giacenze». Rete, ACI ed extra raccolta
 * stavano in tre colonne vicine: schiacciati in orizzontale si leggevano male e
 * l'occhio li sommava, che e' esattamente quello che non deve succedere.
 *
 * Adesso ogni sito ha la sua riga - il nome, il ruolo, la rilevazione per classe
 * del piazzale e la tipologia di trattamento, che non dipendono dal canale - e
 * sotto una riga per ciascun canale, con la sua giacenza e i numeri che sono
 * suoi. Le tre righe si vedono sempre, come si vedevano sempre le tre colonne:
 * una riga che dice «niente» e' un'informazione, mentre un canale che non
 * comparisse si direbbe dimenticato.
 *
 * I nomi dei canali vengono da dichiarazioniImpianti, gli stessi del riepilogo
 * delle dichiarazioni: i due moduli devono dire le stesse cose, a partire da come
 * chiamano le righe.
 */

// Dove un numero non e' del canale la cella resta vuota e il titolo dice perche'.
// Ripetere li' il numero della rete vorrebbe dire far sommare due canali
// all'occhio, e inventarne uno sarebbe peggio ancora.
const SENZA_IN_ATTESA = "Il materiale in attesa di dichiarazione lo dice il file degli ordini non dichiarati del portale, che e' della rete: su questo canale non c'e' un dato, e il numero della rete non si ripete perche' i canali non si sommano.";
const SENZA_ORDINI = "Gli ordini da dichiarare si contano sul file degli ordini non dichiarati del portale, che e' della rete: su questo canale non ce n'e' nessuno da contare.";
const SENZA_DICHIARATO = "Il dichiarato dell'anno: per la rete viene dal report del portale, per ACI ed extra raccolta dalle righe mensili trascritte dall'amministratore nel modulo Dichiarazioni Impianti - le stesse che decurtano la giacenza. Un trattino vuol dire che il dato non c'e' ancora, non che e' zero.";
// UN PIAZZALE NON DICHIARA, e il trattino sulla sua riga non e' un'attesa.
// Dichiara chi tratta: il materiale che sta a terra qui finisce nella
// dichiarazione dell'impianto che lo lavorera', sulla riga dell'impianto.
// Dire «il dato non c'e' ancora» farebbe aspettare un numero che non arriva.
const SENZA_DICHIARATO_PIAZZALE = "Un piazzale non dichiara: la dichiarazione la fa l'impianto che tratta il materiale, e sta sulla sua riga. Qui non c'e' nessun numero da aspettare.";
const percheSenzaDichiarato = (r, c) => (r && r.tipo_destinazione === 'stoc' && c.chiave !== 'RETE' ? SENZA_DICHIARATO_PIAZZALE : SENZA_DICHIARATO);

// Che cosa sa dire ogni canale: da dove prende la sua giacenza e quali degli
// altri numeri sono suoi. Quelli che non ha restano a null, e la cella lo spiega.
const DETTAGLI_CANALE = {
  RETE: {
    nota: 'a portale: la fotografia degli ordini non dichiarati per gli impianti, la rilevazione del piazzale per gli stoccaggi',
    giacenza: (x) => x.giacenza_portale_t,
    // Per la rete il conto manda gia' detto se e' sotto zero; sugli altri due
    // canali lo dice il numero, come faceva la colonna di prima.
    negativa: (x) => !!x.giacenza_negativa,
    senza_giacenza: "La giacenza di rete di un piazzale parte dalla rilevazione della pagina Unita' Locali di Stoccaggio: senza un punto di partenza non si calcola, e non vuol dire zero.",
    // La barra mette a confronto i piazzali fra loro, e il confronto e' della rete.
    barra: true,
    // La fotografia del portale, per gli impianti, e' della rete anche lei: il
    // file degli ordini non dichiarati l'ACI non lo tiene.
    fotografia: true,
    // Rete e ACI partono dalla rilevazione del portale e quel conto si puo'
    // mostrare; l'extra raccolta a portale non c'e' e una rilevazione non l'ha.
    rilevazione: true,
    in_attesa: (x) => x.in_attesa_dichiarazione_t,
    ordini: (x) => x.ordini_da_dichiarare,
    dichiarato: (x) => x.dichiarato_t,
  },
  ACI: {
    nota: "a portale l'ACI non e' gestito: non si confronta con la fotografia",
    giacenza: (x) => x.giacenza_aci_t,
    senza_giacenza: "La giacenza ACI di un piazzale parte dalla rilevazione della classe 9: senza una rilevazione non ha un punto di partenza e non si calcola. Non vuol dire zero.",
    rilevazione: true,
    in_attesa: null,
    ordini: null,
    dichiarato: (x) => x.dichiarato_aci_t,
  },
  EXTRA_RACCOLTA: {
    nota: "a portale non esiste e non ha una giacenza di apertura: ogni anno riparte da zero",
    giacenza: (x) => x.giacenza_extra_t,
    senza_giacenza: "Su questo sito l'extra raccolta non ha movimenti nell'anno: non c'e' un numero da mostrare, e uno zero farebbe pensare a un piazzale svuotato.",
    in_attesa: null,
    ordini: null,
    dichiarato: (x) => x.dichiarato_extra_t,
  },
};

// Le righe dei canali, nell'ordine del riepilogo delle dichiarazioni. Un canale
// che qui non sapessimo leggere resta fuori invece di far cadere la pagina.
const CANALI_RIGHE = CANALI.filter(c => DETTAGLI_CANALE[c.chiave]).map(c => ({ ...c, ...DETTAGLI_CANALE[c.chiave] }));

// Le colonne della tabella, per le righe che la attraversano tutta: sito, ruolo,
// giacenza, le classi, in attesa, ordini da dichiarare, dichiarato nell'anno e
// tipologia di trattamento.
const COLONNE = 7 + CLASSI.length;

// LA RETE DI CHI NON LA DICHIARA (utente, 10/10/2026): «—» con la spiegazione,
// la stessa del modulo Dichiarazioni. Prima qui c'era 0, che si legge «vuoto».
const RETE_NON_DOVUTA = "Per accordo questo impianto non ci dichiara la rete: il trattamento non e' a nostro carico, il portale non tiene per noi una giacenza di rete e niente resta da dichiarare. Quello che e' arrivato si vede nel conferito, una giacenza da dichiarare non c'e'.";

const TITOLO_GIACENZA = "La giacenza del canale della riga. Per gli impianti e' l'apertura piu' quello che e' arrivato meno il dichiarato caricato; per gli stoccaggi la rilevazione del piazzale aggiornata con i movimenti finiti dopo, sempre per fine trasporto. Rete, ACI ed extra raccolta hanno una riga ciascuno e non si sommano mai.";
const TITOLO_CLASSI = "La rilevazione per classe del piazzale, in kg come nel portale: e' il materiale a terra, non dipende dal canale e per questo sta sulla riga del sito. P, M, G1 e G2 sono rete, la classe 9 e' l'ACI.";
const TITOLO_SENZA_TOTALE_SITO = "Rete, ACI ed extra raccolta hanno una riga ciascuno, qui sotto: un totale di sito non esiste, perche' i canali non si sommano.";

/**
 * La giacenza di un canale, com'e'.
 *
 * UNA GIACENZA SOTTO ZERO NON SI AZZERA E NON SI NASCONDE: «come puo' essere
 * negativa una giacenza? succede solo in caso di errore e deve essere corretto»
 * (utente, 03/10/2026). Appunto: resta rossa e detta, perche' sparendo dalla
 * vista l'errore resterebbe nei dati. Succede quando il portale ha accettato piu'
 * di quanto il gestionale gli attribuisce - una dichiarazione caricata su ordini
 * che non abbiamo, o una fotografia vecchia.
 *
 * Quando il canale non ha un numero la cella non dice zero, che sarebbe un'altra
 * cosa: dice perche' non ce l'ha.
 */
function ValoreGiacenza({ valore, negativa, perche }) {
  if (valore === null || valore === undefined) {
    return <span className="font-normal text-muted-foreground cursor-help" title={perche}>—</span>;
  }
  const sottoZero = negativa || valore < 0;
  return (
    <>
      <div className={`font-bold ${sottoZero ? 'text-red-600' : ''}`}>{fmt(valore)} t</div>
      {sottoZero && (
        <div className="text-[10px] font-normal text-red-600 leading-tight">giacenza sotto zero: da correggere</div>
      )}
    </>
  );
}

export default function SituazioneTable({ righe, totali, onVaiDaDichiarare }) {
  // Quale piazzale ha il dettaglio dell'ACI aperto: uno per volta, e si apre
  // sulla sua riga ACI, come il resto del modulo, senza inventare una pagina.
  const [aciAperto, setAciAperto] = useState('');
  const maxGiacenza = Math.max(...righe.map(r => r.giacenza_portale_t || 0), 0.01);
  const kg = (r, c) => (r.giacenza_classi_kg ? r.giacenza_classi_kg[c] || 0 : null);

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold" rowSpan={2}>Sito · canale</th>
              <th className="px-3 py-2 font-semibold" rowSpan={2}>Ruolo</th>
              {/* I TRE CANALI, UNO PER RIGA E MAI SOMMATI: la colonna della
                  giacenza e' una sola, e quale canale sia lo dice la riga.
                  Affiancate, le tre colonne di prima si sommavano con l'occhio. */}
              <th className="px-3 py-2 font-semibold text-right" rowSpan={2} title={TITOLO_GIACENZA}>Giacenza</th>
              <th className="px-3 pt-2 pb-0 font-semibold text-center border-l" colSpan={CLASSI.length} title={TITOLO_CLASSI}>Giacenza per classe (kg)</th>
              <th className="px-3 py-2 font-semibold text-right border-l" rowSpan={2}>In attesa di dichiarazione</th>
              <th className="px-3 py-2 font-semibold text-right" rowSpan={2}>Ordini da dichiarare</th>
              <th className="px-3 py-2 font-semibold text-right" rowSpan={2}>Dichiarato nell&apos;anno</th>
              <th className="px-3 py-2 font-semibold" rowSpan={2}>Tipologia trattamento</th>
            </tr>
            <tr>
              {CLASSI.map((c, i) => (
                <th key={c.chiave} className={`px-3 pb-2 pt-1 font-medium text-right text-xs ${i === 0 ? 'border-l' : ''}`} title={c.aiuto}>{c.titolo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {righe.map((r, i) => {
              const barWidth = Math.max((r.giacenza_portale_t / maxGiacenza) * 100, 1);
              // Il dettaglio dell'ACI si apre solo dove ha senso: un piazzale con
              // il suo conto, che l'impianto non ha (la sua giacenza viene dal
              // file degli ordini non dichiarati, non dai nostri movimenti).
              // La chiave della riga porta anche la posizione: due siti con lo
              // stesso nome mostrato e lo stesso ruolo darebbero due chiavi uguali,
              // e il dettaglio si aprirebbe su tutte e due.
              const chiave = `${i}|${r.sito}|${r.tipo_destinazione}`;
              const apribileAci = r.tipo_destinazione === 'stoc' && !!r.aci_dettaglio;
              const apertoAci = apribileAci && aciAperto === chiave;
              return (
                <React.Fragment key={chiave}>
                {/* La riga del sito: il nome, il ruolo, la rilevazione per classe
                    del piazzale e la tipologia di trattamento. Niente di tutto
                    questo dipende dal canale, e i numeri dei canali stanno nelle
                    righe sotto, una per canale. */}
                <tr className="border-t-2 bg-muted/20">
                  <td className="px-3 py-2 font-medium">{r.sito}<DateRiga r={r} /></td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.tipo_destinazione === 'imp'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-accent/15 text-accent-foreground'
                    }`}>
                      {r.tipo_destinazione === 'imp' ? 'Impianto' : 'Stoccaggio'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-[11px] text-muted-foreground cursor-help" title={TITOLO_SENZA_TOTALE_SITO}>per canale, qui sotto</td>
                  {CLASSI.map((c, k) => {
                    const v = kg(r, c.chiave);
                    return (
                      <td key={c.chiave} className={`px-3 py-2 text-right tabular-nums ${k === 0 ? 'border-l' : ''} ${v < 0 ? 'text-red-600 font-semibold' : v ? '' : 'text-muted-foreground'}`}>
                        {v == null ? '—' : v < 0 ? <ClasseNegativa r={r} classe={c} valore={v} /> : formatKg(v)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 border-l"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-muted-foreground">{r.tipologia_trattamento || '—'}</td>
                </tr>
                {CANALI_RIGHE.map(c => {
                  // I numeri del canale, letti una volta sola. Quelli che il
                  // canale non ha restano null: la cella dice perche' invece di
                  // mostrare uno zero o il numero di un altro canale.
                  const giacenza = c.giacenza(r);
                  const inAttesa = c.in_attesa ? c.in_attesa(r) : null;
                  const ordini = c.ordini ? c.ordini(r) : null;
                  const dichiarato = c.dichiarato ? c.dichiarato(r) : null;
                  return (
                    <React.Fragment key={c.chiave}>
                      <tr className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 pl-8">
                          <span className="font-medium">{c.nome}</span>
                          <span className="block text-[11px] text-muted-foreground leading-tight">{c.nota}</span>
                        </td>
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <ValoreGiacenza valore={giacenza} negativa={c.negativa ? c.negativa(r) : false} perche={c.chiave === 'RETE' && r.rete_non_dovuta ? RETE_NON_DOVUTA : c.senza_giacenza} />
                          {c.barra && (
                            <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${barWidth}%` }} />
                            </div>
                          )}
                          {/* Sulla riga ACI di un piazzale si apre l'elenco degli
                              ordini che fanno quel numero (richiesta dell'utente,
                              28/09/2026): il numero resta com'e', sotto si apre il
                              perche'. Prima il pulsante stava sulla classe 9, che
                              e' lo stesso conto: la classe 9 del piazzale e' l'ACI. */}
                          {c.chiave === 'ACI' && apribileAci && (
                            <button
                              type="button"
                              className="mt-0.5 flex items-center gap-0.5 ml-auto text-[11px] text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-2"
                              onClick={() => setAciAperto(apertoAci ? '' : chiave)}
                              title="Gli ordini che compongono questa giacenza ACI, uno per uno: ancora dell'anno piu' gli ingressi meno le uscite, per fine trasporto"
                            >
                              {apertoAci ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              {formatIntero(r.aci_dettaglio.ordini.length)} {r.aci_dettaglio.ordini.length === 1 ? 'ordine' : 'ordini'}
                            </button>
                          )}
                          {r.tipo_destinazione === 'stoc' && r.data_rilevazione && c.rilevazione && <DettaglioStoccaggio r={r} canale={c.chiave} />}
                          {r.tipo_destinazione === 'stoc' && <SaldoArchivio r={r} canale={c.chiave} />}
                          {r.tipo_destinazione === 'imp' && c.fotografia && <DettaglioImpianto r={r} />}
                        </td>
                        {/* Le classi sono del piazzale e stanno sulla riga del
                            sito: qui non si ripetono. */}
                        <td className="px-3 py-2 border-l" colSpan={CLASSI.length}></td>
                        <td className={`px-3 py-2 text-right border-l ${inAttesa > 0.01 ? 'text-amber-600' : ''}`}>
                          {inAttesa === null ? (
                            <span className="text-muted-foreground cursor-help" title={SENZA_IN_ATTESA}>—</span>
                          ) : inAttesa > 0.01 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted underline-offset-2">{fmt(inAttesa)} t</span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">{IN_ATTESA_TOOLTIP}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {ordini === null ? (
                            <span className="text-muted-foreground cursor-help" title={SENZA_ORDINI}>—</span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7"
                              /* il ruolo viaggia col nome: dal pulsante dell'impianto si aprono solo i suoi */
                              onClick={() => onVaiDaDichiarare(r.sito, r.tipo_destinazione)}
                            >
                              {formatIntero(ordini || 0)}
                            </Button>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {dichiarato === null
                            ? <span className="text-muted-foreground cursor-help" title={percheSenzaDichiarato(r, c)}>—</span>
                            : <>{fmt(dichiarato)} t</>}
                        </td>
                        <td className="px-3 py-2"></td>
                      </tr>
                      {c.chiave === 'ACI' && apertoAci && (
                        <tr className="border-t bg-muted/20">
                          <td colSpan={COLONNE} className="p-0"><DettaglioAci r={r} /></td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                </React.Fragment>
              );
            })}
          </tbody>
          {/* I TOTALI RESTANO PER CANALE, MAI SOMMATI FRA CANALI: la riga TOTALE
              tiene le classi, che sono del piazzale, e sotto c'e' un totale per
              ogni canale, come nelle righe dei siti. Sono gli stessi numeri che
              il conto manda, letti con le stesse funzioni delle righe. */}
          <tfoot className="bg-muted/50 font-bold border-t-2">
            <tr>
              <td className="px-3 py-2">TOTALE</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right text-[11px] font-normal text-muted-foreground cursor-help" title={TITOLO_SENZA_TOTALE_SITO}>per canale, qui sotto</td>
              {CLASSI.map((c, k) => (
                <td key={c.chiave} className={`px-3 py-2 text-right tabular-nums ${k === 0 ? 'border-l' : ''}`}>
                  {totali.giacenza_classi_kg ? formatKg(totali.giacenza_classi_kg[c.chiave] || 0) : '—'}
                </td>
              ))}
              <td className="px-3 py-2 border-l"></td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2"></td>
            </tr>
            {CANALI_RIGHE.map(c => {
              const inAttesa = c.in_attesa ? c.in_attesa(totali) : null;
              const ordini = c.ordini ? c.ordini(totali) : null;
              const dichiarato = c.dichiarato ? c.dichiarato(totali) : null;
              return (
                <tr key={c.chiave} className="border-t">
                  <td className="px-3 py-2 pl-8">TOTALE {c.nome}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {/* Il totale di un canale non ha la bandierina del conto: se
                        esce sotto zero lo dice il numero, e va guardato. */}
                    <ValoreGiacenza valore={c.giacenza(totali)} negativa={false} perche={c.senza_giacenza} />
                  </td>
                  <td className="px-3 py-2 border-l" colSpan={CLASSI.length}></td>
                  <td className="px-3 py-2 text-right">
                    {inAttesa === null
                      ? <span className="font-normal text-muted-foreground cursor-help" title={SENZA_IN_ATTESA}>—</span>
                      : <>{fmt(inAttesa)} t</>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {ordini === null
                      ? <span className="font-normal text-muted-foreground cursor-help" title={SENZA_ORDINI}>—</span>
                      : formatIntero(ordini || 0)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {dichiarato === null
                      ? <span className="font-normal text-muted-foreground cursor-help" title={SENZA_DICHIARATO}>—</span>
                      : <>{fmt(dichiarato)} t</>}
                  </td>
                  <td className="px-3 py-2"></td>
                </tr>
              );
            })}
          </tfoot>
        </table>
      </div>
      <p className="px-3 py-2 text-xs text-muted-foreground italic">
        Ogni sito ha una riga per canale - rete, ACI ed extra raccolta - e i tre numeri non si sommano mai, nemmeno come totale di controllo: un totale di sito non esiste. Le colonne per classe sono la rilevazione del piazzale e stanno sulla riga del sito, perche&apos; il materiale a terra non si divide per canale: P, M, G1 e G2 sono rete, la classe 9 e&apos; l&apos;ACI. Per gli impianti la giacenza di rete e&apos; il peso degli ordini non ancora dichiarati del file del portale, aggiornato a ogni caricamento con i carichi che il file non contiene ancora e le dichiarazioni caricate dopo. Per gli stoccaggi e&apos; il saldo rilevato dalla pagina Unita&apos; Locali di Stoccaggio, aggiornato con gli ingressi e le uscite finiti dopo la rilevazione: passa col mouse sulla data per il dettaglio. Tutto per fine del trasporto: un terminato senza fine trasporto non si colloca in nessun periodo e non entra ne&apos; fra i carichi aggiunti alla fotografia ne&apos; fra i movimenti dopo la rilevazione finche&apos; la data non arriva, mentre il portale, se lo conosce, lo conta; la riga del sito lo segnala, con le altre date obbligatorie che mancano. La colonna In attesa di dichiarazione indica invece materiale gia&apos; partito da uno stoccaggio verso un impianto, che il portale continua ad attribuire allo stoccaggio finche&apos; il destinatario non presenta la dichiarazione: non e&apos; giacenza, ed e&apos; un conto della sola rete, perche&apos; il file del portale e&apos; quello.
      </p>
      <p className="px-3 pb-2 text-xs text-muted-foreground italic">
        La fotografia e&apos; il punto di partenza, e i movimenti si sommano da li&apos;: la rilevazione per gli stoccaggi, il file del portale per gli impianti. Ne discende una cosa che conviene sapere prima di cercare l&apos;errore altrove: <strong>una fotografia sbagliata non si corregge ricaricando i file</strong>, perche&apos; i caricamenti aggiungono movimenti ma non riscrivono il punto di partenza. Il 16/09/2026 una rilevazione con 6.160 kg nella classe sbagliata teneva una classe sotto zero, col totale giusto: si e&apos; rimessa a posto rileggendo il portale e inserendo una rilevazione nuova. Per questo ogni rilevazione, appena inserita, si confronta con la precedente piu&apos; i movimenti del periodo, e nella scheda Stoccaggi la colonna Controllo dice se una classe si scosta. Sotto la giacenza di ogni canale c&apos;e&apos; anche la somma dei soli movimenti in archivio di quel canale: non e&apos; una giacenza - vale dal primo movimento caricato, non da quando il piazzale era vuoto, e su chi ha l&apos;archivio piu&apos; vecchio esce sotto zero - ma serve a vedere a colpo d&apos;occhio quanto manca all&apos;appello e da quando.
      </p>
      {/* Richiesta dell'utente, 28/09/2026: aprire la giacenza ACI di un piazzale
          e vedere gli ordini che la compongono. */}
      <p className="px-3 pb-2 text-xs text-muted-foreground italic">
        Sulla riga ACI di un piazzale si apre l&apos;elenco degli ordini che fanno quel numero: l&apos;ancora dell&apos;anno piu&apos; gli ingressi e le uscite di ACI finiti dopo, ognuno con archivio di provenienza, ID ordine, ticket (il Numero_Ordine_Interno), fine trasporto, controparte e chili. Il canale lo decide il materiale e non l&apos;archivio, quindi <strong>una primaria di classe 9 e&apos; ACI anche se si trovasse nei Terminati Rete</strong> - oggi il caricamento le smista col materiale, percio&apos; e&apos; una rete di sicurezza e non la regola di tutti i giorni. Il totale deve tornare al chilo con la giacenza della riga ACI; se non tornasse, lo scarto si dice e non si aggiusta, perche&apos; vorrebbe dire che c&apos;e&apos; qualcosa da capire.
      </p>
    </div>
  );
}
