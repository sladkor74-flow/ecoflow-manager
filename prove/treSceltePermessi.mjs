// Le tre scelte sui permessi del 02/10/2026.
//
// Erano tre punti in cui un utente che puo' solo consultare faceva scrivere
// qualcosa al gestionale. Non erano sviste: due di loro avevano un commento che
// dichiarava la cosa voluta, ed e' proprio per questo che nessuno le rivedeva.
// L'utente ha chiesto di scegliere, e si e' scelto cosi':
//
//   controlloQualifiche   chiuso del tutto all'amministratore. Il ramo che
//                         lasciava passare gli altri non lo usava nessun
//                         chiamante: tutto il rischio e nessun servizio reso.
//   controllaTodoOrdini   calcola per tutti, scrive solo per l'amministratore.
//                         Chiuderlo del tutto avrebbe fatto fallire il ricalcolo
//                         dopo il caricamento di un operatore base.
//   chiediAssistente      la precisazione resta aperta - e' l'unica delle tre
//                         che somiglia davvero a "aprire una richiesta" - ma le
//                         novita' normative e lo scarto delle voci superate no:
//                         quelle toccano la conoscenza gia' approvata.
//
// Queste prove guardano il SORGENTE, non il comportamento: l'invariante da
// bloccare e' "questo controllo deve esserci". Se qualcuno lo toglie, nessun
// errore comparirebbe a video - semplicemente tornerebbe a scrivere chi non
// dovrebbe. npm run prove
import { readFileSync } from 'node:fs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

console.log('CONTROLLO QUALIFICHE: CHIUSO ALL\'AMMINISTRATORE');
{
  const s = sorgente('base44/functions/controlloQualifiche/entry.ts');
  verifica('usa la guardia condivisa, non il ruolo scritto a mano',
    /import \{ eAmministratore, rispostaSolaLettura \} from "\.\.\/\.\.\/shared\/permessi\.ts"/.test(s));
  verifica('e si ferma subito per chi non e amministratore',
    /if \(!eAmministratore\(user\)\) return rispostaSolaLettura\(\);/.test(s));
  verifica('il vecchio mezzo permesso non c e piu',
    !/body\.invia_email !== false \|\| forza/.test(s), 'il filtro parziale e ancora li');
  // L'anno e' la CHIAVE della riga di riepilogo che si riscrive: uno non intero
  // ne farebbe nascere una che nessun lettore andra' mai a cercare.
  verifica('l anno si valida prima di toccare qualcosa',
    /!Number\.isInteger\(anno\) \|\| anno < 2000/.test(s));
}

console.log('CONTROLLO QUALIFICHE: LA REGOLA 2, CHE QUI MANCAVA DEL TUTTO');
{
  // Non e' una questione di permessi: colpiva anche l'amministratore e il lavoro
  // automatico delle 7:30. individuaSoggetti rilegge tutti gli archivi dei
  // movimenti; con un caricamento a meta' i soggetti sono meno del vero, e il
  // riepilogo salvato - che la fatturazione passiva legge prima di pagare -
  // usciva con meno soggetti critici. Salvandolo, per giunta, risultava fresco:
  // la pagina non lo rifaceva piu' fino al caricamento successivo.
  const s = sorgente('base44/functions/controlloQualifiche/entry.ts');
  verifica('legge lo stato dei caricamenti', /const primaDiLeggere = await statoCaricamenti\(base44\);/.test(s));
  verifica('e lo rilegge dopo, per i caricamenti partiti nel frattempo',
    /caricamentiDuranteLettura\(primaDiLeggere, await statoCaricamenti\(base44\)\)/.test(s));
  verifica('il riepilogo non si salva su archivi a meta',
    /const alert = rinviato\.length[\s\S]{0,120}: await salvaRiepilogo\(/.test(s));
  // L'email no, e per una ragione in piu' del testo sbagliato: il giro che segue
  // SCRIVE su AvvisoQualifica, e una chiave registrata per sbaglio tiene zitta la
  // segnalazione vera per i sette giorni della ripetizione.
  verifica('e il promemoria non parte', /if \(rinviato\.length \|\| !inviaEmail/.test(s));
  verifica('chi ha chiesto il controllo lo viene a sapere', /rinviato: true/.test(s) && /avviso: /.test(s));
}
{
  // La pagina diceva "Nessun promemoria da inviare - Non ci sono alert aperti",
  // che davanti a un rinvio e' falso e tranquillizza.
  const p = sorgente('src/pages/QualificaFornitori.jsx');
  verifica('la pagina dice che il controllo e stato rinviato', /if \(d\.rinviato\) toast\(/.test(p));
}

console.log('QUALIFICA FORNITORI: L\'ANNO SI VALIDA ANCHE LI\'');
{
  // Il riepilogo salvato si scrive da due funzioni sole. Questa la chiamano due
  // PAGINE a ogni apertura, anche per chi consulta soltanto: il salvataggio resta
  // aperto di proposito (e' una copia di un conto rifatto dal server, con i
  // soggetti che non si accettano piu' dal corpo e la regola 2 che lo ferma sugli
  // archivi a meta'), ma l'anno - che e' la chiave della riga - no.
  const s = sorgente('base44/functions/qualificaFornitori/entry.ts');
  verifica('anche qui l anno si valida', /!Number\.isInteger\(anno\) \|\| anno < 2000/.test(s));
}

console.log('TO-DO LIST: SI CALCOLA PER TUTTI, SI SCRIVE PER L\'AMMINISTRATORE');
{
  const s = sorgente('base44/functions/controllaTodoOrdini/entry.ts');
  verifica('la guardia e quella condivisa', /import \{ eAmministratore \} from "\.\.\/\.\.\/shared\/permessi\.ts"/.test(s));
  verifica('il permesso si decide una volta sola', /const puoScrivere = eAmministratore\(user\);/.test(s));
  verifica('e l attivita si salva solo se si puo', /if \(cambiato && puoScrivere\) \{/.test(s));
  verifica('a chi non puo si dice che cosa si chiuderebbe',
    /\(puoScrivere \? chiuse : daChiudere\)\.push\(/.test(s) && /da_chiudere: daChiudere/.test(s));
  verifica('e che non e stato salvato', /non_salvato: true/.test(s));
  // IL FRENO NON BASTA CHE STIA NELLA PAGINA. La pagina To-Do List chiama la
  // funzione solo per l'amministratore, ma una funzione si chiama anche da fuori.
  const p = sorgente('src/pages/TodoPage.jsx');
  verifica('la pagina continua a chiamarla solo per l amministratore', /if \(!isAdmin\) return;/.test(p));
  // L'INVARIANTE CHE VALE PIU' DI TUTTI: il corpo della richiesta non si legge.
  // Finche' e' cosi', chi chiama non sceglie niente - nemmeno quali attivita'
  // guardare - e le chiusure le decidono i dati. Il giorno in cui qualcuno
  // aggiungesse una lettura dal corpo, il buco si riaprirebbe in silenzio.
  verifica('il corpo della richiesta non si legge affatto',
    !/req\.json\(\)/.test(s) && !/\bbody\./.test(s), 'qualcuno ha cominciato a leggere il corpo');
}

console.log('ECOTYNA: LA PRECISAZIONE SI APRE, LA CONOSCENZA APPROVATA NO');
{
  const s = sorgente('base44/functions/chiediAssistente/entry.ts');
  verifica('la guardia e quella condivisa', /import \{ eAmministratore \} from "\.\.\/\.\.\/shared\/permessi\.ts"/.test(s));
  verifica('il permesso sulla conoscenza si decide una volta sola',
    /const puoScrivereConoscenza = eAmministratore\(user\);/.test(s));
  // La precisazione nasce senza voce_id: non scavalca niente e non tocca nessuna
  // voce approvata. Resta in coda finche' l'amministratore non la approva, ed e'
  // esattamente il meccanismo che la regola dell'utente descrive.
  verifica('la precisazione si propone per tutti',
    /^\s{4}try \{\n\s+precisazioni = await proponiPrecisazioni\(/m.test(s), 'la precisazione e finita dentro il ramo dell amministratore');
  // Le novita' normative no: gli id delle voci stanno nel prompt, il modello
  // riempie voce_id leggendo la domanda, e proponiNovita mette da parte le
  // proposte in attesa su QUELLA voce. La vittima la sceglie chi scrive.
  verifica('le novita normative e lo scarto solo per l amministratore',
    /if \(puoScrivereConoscenza\) \{[\s\S]{0,400}proponiNovita\(/.test(s)
    && /if \(puoScrivereConoscenza\) \{[\s\S]{0,400}scartaSuperate\(base44\)/.test(s));
  // Due try separati: se una delle due strade fallisce, l'altra deve andare
  // comunque. Prima un catch solo le ingoiava tutte e due.
  verifica('i due tentativi sono separati', (s.match(/catch \(_e\) \{ \/\* la risposta resta valida|catch \(_e\) \{ \/\* idem/g) || []).length >= 2);
}
{
  // IL FILO DELLA CONVERSAZIONE E' DI CHI L'HA APERTO. conversazione_id arrivava
  // dal corpo e si usava com'era: bastava conoscerne uno per leggere di rimbalzo
  // le domande di un altro, e per lasciare il proprio testo attaccato al suo filo.
  const s = sorgente('base44/functions/chiediAssistente/entry.ts');
  verifica('un filo si riprende solo se e il proprio',
    /const mioFilo = !precedenti\.length \|\| eAmministratore\(user\)/.test(s)
    && /precedenti\.every\(p => !p\.created_by_id \|\| p\.created_by_id === user\.id\)/.test(s));
  verifica('e se non lo e se ne apre uno nuovo, senza errori',
    /if \(!mioFilo\) precedenti = \[\];/.test(s) && /const conversazioneId = \(mioFilo && filoChiesto\) \|\| crypto\.randomUUID\(\);/.test(s));
}
{
  // La scheda Base di conoscenza si disegna solo per l'amministratore: mandarci
  // chi non la vede e' un vicolo cieco.
  const c = sorgente('src/components/assistente/ChatAssistente.jsx');
  verifica('la novita normativa si annuncia solo a chi puo approvarla', /if \(isAdmin && res\.data\.novita\)/.test(c));
  verifica('e a chi manda una precisazione si dice che la valutera l amministratore',
    /res\.data\.precisazioni/.test(c));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
