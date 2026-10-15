# AGENTS.md — TreadRider

Le istruzioni del gestionale **TreadRider** di SMOCO, sulla piattaforma Base44.
Qui dentro ci sono due cose, e conviene distinguerle: le **regole di dominio**,
che il codice deve rispettare sempre, e il **fatto vero** da cui ciascuna nasce,
con la data. Il fatto non e' un contorno: una regola senza il motivo diventa un
ordine, e la volta dopo qualcuno la discute, o la ricava da zero e la scrive al
contrario.

Si legge cosi': **se una modifica viola una regola di questo file e' sbagliata
anche quando "funziona"**. Prima di riderivare una regola da zero, cercala qui.

## Indice

- **Come si lavora in questo repository**
  - I quattro controlli, prima di ogni commit
  - Il giro di GitHub: le prove a ogni push su main (14/10/2026)
  - Lo stile dei commenti
  - Commit e push
  - Gli specchi: `base44/shared` e `src/lib`
  - I fine-riga
  - Le librerie pesanti si caricano quando servono (10/10/2026)
  - Le pagine si scaricano quando si aprono (10/10/2026)
  - Il limite di richieste della piattaforma (22/09/2026)
  - Il registro degli errori del sito (14/10/2026, rivisto il 15/10/2026)
  - Base44: comandi, file e riferimenti
  - Regole tecniche della piattaforma e delle pagine
  - I documenti che escono: una veste sola e la data dei dati (11/10/2026)
  - Quando la piattaforma modifica il codice da sola
  - Il nome: TreadRider
- **Le tre regole assolute**
  - Le tre regole che l'utente non vuole ripetere (21/09/2026)
  - Il periodo di un movimento e' la fine del trasporto
  - Il guardiano notturno e la memoria dei numeri (10/10/2026)
  - Il battito dei lavori e le identita' fra moduli (11/10/2026)
  - Nessun anno scritto nelle pagine (11/10/2026)
  - Il cambio d'anno: la prova generale del 15/10/2026
  - Il dichiarato e' di chi tratta, non di chi stocca (10/10/2026)
  - Una dichiarazione per mese, e un avviso non grida a zero (10/10/2026)
  - Giacenze e Dichiarazioni: lo stesso numero, controllato da una prova (10/10/2026)
  - La storia di una riga del Riepilogo (12/10/2026)
  - Canali indipendenti
  - Pesi
  - Come si legge un movimento: un punto solo
- **Regole della commessa**
  - Chi conferisce dove
  - Gli impianti che svuotano la giacenza dell'anno prima
  - Su quali tonnellate si paga ciascuna prestazione
  - Quando una tariffa vale, e con che unita' (11/10/2026)
  - Il surplus sulle tariffe (12-13/10/2026)
  - Le due regole del portale sull'ACI
  - Il target annuo di un impianto si scrive solo in Target & Status
  - Le date obbligatorie dei formulari (22/09/2026)
  - Una riga di un altro periodo si verifica sempre (01/10/2026)
  - Un numero sbagliato di una lettera non e' due difformita' (01/10/2026)
  - Lo stesso soggetto di un punto di raccolta (11/10/2026)
  - Le dichiarazioni e il mese di competenza
  - Decisioni della direzione del 20/09/2026 sulla fatturazione attiva
  - Le omologhe: vale «OMOLOGA OK» (12/10/2026)
- **I moduli e i loro conti**
  - La predittivita' delle secondarie: un anno, un motore (26/09/2026)
  - La fatturazione attiva verso Ecotyre
  - La prefattura del portale in PDF si legge dal suo testo
  - Il surplus nella prefattura: ogni ordine col suo (13/10/2026)
  - Il margine
  - Il foglio della passiva dell'amministrazione (11/10/2026)
  - Un nome, un record: anagrafica e consuntivi (11/10/2026)
  - Prima di eliminare, chi lo usa (12/10/2026)
  - La scheda dei fornitori (13/10/2026)
  - La pratica mensile di Irigom
  - La Quadratura FIR: il flusso non si indovina dal titolo (30/09/2026)
    - La parola "gestionale" sulla stampa non siamo noi
  - La ricerca per punto di raccolta nei Terminati Rete (12/10/2026)
  - La dashboard: il quadro della commessa e l'elenco unico delle cose da gestire (11/10/2026)
  - Il riepilogo della settimana per la direzione (14-15/10/2026)
  - La chiusura del mese passo passo (11/10/2026)
  - La Guida dentro il gestionale (14-15/10/2026)
  - Il target del contratto e l'atteso alla data (11/10/2026)
  - Le variazioni del contratto in corso d'anno (14/10/2026)
  - L'Andamento di Target & Status: le stesse parole in pagina, Excel, PDF e presentazione (11/10/2026)
  - I tipi di regola alert (11/10/2026)
  - Il motore degli alert al cambio d'anno (12/10/2026)
  - Le attivita' della to-do list che si chiudono da sole (28/09/2026)
  - La to-do list: i completati nella loro sezione (12/10/2026)
  - La to-do list: i cancellati dal portale (14/10/2026)
  - Le richieste ECT: il foglio del 09/10/2026 e il cambio d'anno (15/10/2026)
  - La to-do list: modifica e annotazioni (15/10/2026)
  - EcoTyna: le domande sui dati non sono domande di norma (29/09/2026)
  - EcoTyna: il modulo giusto per ogni domanda sulla commessa (14/10/2026)
  - La voce di EcoTyna: il testo detto, frase per frase (11/10/2026)
- **I caricamenti, lo storico e il registro**
  - Lo storico: si carica solo cio' che serve all'operativita' (25/09/2026)
  - Il caricamento delle primarie: che cosa si crede e che cosa si ripara (28/09/2026)
  - Gli ordini rimasti «eseguito»: una regola sola, a ogni caricamento (14/10/2026)
  - Il registro dei caricamenti
  - Lo storico delle modifiche: chi ha cambiato un numero che fa i conti (11/10/2026)
  - I conti che si salvano non si salvano su un archivio a meta' (11/10/2026)
  - I file del Caricamento Dati si sostituiscono (29/09/2026)
  - La copia di sicurezza di tutti gli archivi (14-15/10/2026)
- **I file, la privacy e i permessi**
  - I costi dei fornitori sono dell'amministratore, anche in EcoTyna (11/10/2026)
  - I documenti aziendali non salgono mai in area pubblica (30/09/2026)
    - Il `file_uri` e' la chiave del documento: non si manda al browser (05/10/2026)
    - La piattaforma non cancella i file, e non si prova nemmeno piu'
    - I link pubblici non restano scritti nei record
  - La conservazione dei documenti dei fornitori (29/09/2026)
  - La qualifica dei fornitori

## Come si lavora in questo repository

### I quattro controlli, prima di ogni commit

Devono passare tutti:

```bash
npm run lint          # eslint . --quiet
npm run prove         # node prove/esegui.mjs: tutte le prove, specchi compresi
node prove/specchi.mjs
npx vite build
```

**Il quinto: Giacenze e Dichiarazioni sui dati veri** (11/10/2026).
`prove/datiVeri.mjs` gira con `npm run prove`, ma va guardato a parte, perche' e'
quello che le prove costruite non sanno fare. Regola dell'utente, testuale:
*«dichiarazioni e giacenze sono cose fondamentali e devono quadrare sempre come
un orologio svizzero»*. Fa girare `calcolaGiacenze` e `riepilogoDichiarazioni`
veri sulla copia degli archivi veri in `../dati-veri/`, fuori dal repository,
quindi non va su GitHub. L'orologio e' fermo al momento della lettura, e il
controllo pretende tre cose per ogni impianto e canale:
- Giacenze = Dichiarazioni;
- la riga «Da dichiarare» = la giacenza, senza «dichiarati in piu'» inventati;
- gli stessi numeri che il sito diceva allora.

Lo stesso giorno una correzione verde su tutte le prove costruite aveva rotto sul
sito la colonna di quattro impianti: con quel codice questo controllo fallisce
proprio su quei quattro. Se una modifica sposta i numeri apposta, il controllo
fallisce finche' non si scarica una copia nuova dopo la pubblicazione. La
procedura, in sola lettura, sta in `../dati-veri/LEGGIMI.md`. Senza la copia la
prova si salta e lo dice. Quando l'albero di lavoro ha lavori a meta', si lancia
su una copia pulita di HEAD (`git archive HEAD base44 prove`). **Dopo ogni
pubblicazione che tocca questi due moduli, gli stessi tre controlli si rifanno
sul sito.**

**La copia scaricata da Caricamento Dati vale solo se e' completa** (revisione
del 15/10/2026). Dal 14/10/2026 l'amministratore scarica da Caricamento Dati,
sezione «Copia di sicurezza» (vedi «La copia di sicurezza di tutti gli
archivi»), la copia di tutti gli archivi, nello stesso formato della copia dei
dati veri. Rinominata `treadrider-dati-veri-AAAA-MM-GG.json.gz` e messa in
`../dati-veri/`, diventa la copia del quinto controllo (lo dice anche
`../dati-veri/LEGGIMI.md`). Se durante la copia Giacenze o Dichiarazioni non
hanno risposto, il file vale come copia di sicurezza ma non per il controllo.
Succede per esempio con un 500 o un 504 dopo una pubblicazione, perche' il
ritentativo ripete solo i 429 e i 503. Lo stesso vale se un archivio non si e'
letto. La pagina lo dice per nome, la riga di `CopiaSicurezza` lo segna
(`archivi_non_letti`, `attesi_mancanti`) e `prove/datiVeri.mjs` fallisce con «la
copia ha tutto quello che serve ai tre controlli». Prima passava con 99
verifiche su 158, tutte verdi: i confronti di Giacenze saltavano senza una
parola. Su una copia completa il controllo non aggiunge verifiche, quindi 158
restano 158. Le risposte attese si cercano con l'anno della copia
(`riepilogoDichiarazioni_<anno>`, `calcolaGiacenze_<anno>`), non col 2026
scritto a mano. Prova: `prove/copiaSicurezzaDatiVeri.mjs`, sezione 3.
L'anno della copia e' quello del giorno italiano di `meta.letto_dal`, la stessa
regola di `copiaSicurezza.js` (prova generale del cambio d'anno, difetto 28,
15/10/2026). Con l'anno UTC di `letto_fino_al` una copia fatta fra mezzanotte e
l'una del 1° gennaio cercava gli attesi dell'anno sbagliato e falliva 7
controlli. Prova: `prove/annoDellaCopia.mjs`.

**Una prova che scrive file nella cartella temporanea li toglie alla fine**
(revisione del 15/10/2026). La cartella si crea con `mkdtempSync` e si toglie
anche se la prova cade: in un `finally` con `rmSync(cartella, { recursive: true,
force: true })`, oppure, in una prova scritta di seguito, con
`process.on('exit', togliCartella)`, perche' l'evento arriva anche dopo un errore
non preso. In fondo, una verifica che la cartella non resti. Una copia dei dati
veri lasciata in `%TEMP%` e' una copia in piu' dei costi fuori da
`../dati-veri`: `prove/copiaSicurezzaDatiVeri.mjs` ne lasciava una da 3,7 MB a
ogni giro. Dalla chiusura dello stesso giorno si puliscono anche
`prove/chiLeggeCosa.mjs`, `prove/guida.mjs`, `prove/registroErrori.mjs`,
`prove/riepilogoSettimanale.mjs` e `prove/tariffeRiservate.mjs`, che a ogni giro
lasciavano le copie delle pagine che montano. Altre prove lasciano ancora le loro
(`extra-surplus-`, `dopo-variazione-`, `anni-passati-`, `conferme-`,
`per-noi-chiusi-`, `todo-cancellati-` e altre): sono copie di sorgenti, non dati,
e si sistemano alla prima occasione con la stessa regola.

C'e' anche `npm run typecheck` (`tsc -p ./jsconfig.json`), che non e' fra i
quattro obbligatori. Le prove non sono di cortesia: molte leggono il **sorgente**
e cadono se una regola scritta in un commento o in questo file se ne va - per
esempio `prove/fileRiservato.mjs` verifica che AGENTS.md riporti ancora la
precisazione dell'assistenza sul `file_uri`. Chi cambia una regola aggiunge un
caso alla prova che la copre.

**Per provare una funzione intera c'e' `prove/dati/bancoFunzioni.mjs`**
(11/10/2026). `caricaFunzione(nome)` impacchetta
`base44/functions/<nome>/entry.ts` con un SDK finto: un archivio in memoria con
filter, list, get, create, update, bulkUpdate, delete, deleteMany e bulkCreate,
e le scritture registrate. `chiama(modulo, { db, ruolo, corpo })` restituisce
`{ stato, j, scritte, db }`. Lo usano, per esempio,
`prove/consuntivoRicaricato.mjs` e `prove/contrattiAnnoTarget.mjs`. bulkUpdate
c'e' dal 12/10/2026: il motore degli alert aggiorna e chiude gli alert con
bulkUpdate dentro un catch muto, e senza una prova sul banco vedeva aperti alert
che la funzione vera chiude.

**Per provare una pagina intera c'e' `prove/dati/paginaFinta.mjs`**
(12/10/2026). `caricaPagina('pages/X')` (o `components/...`) impacchetta il
componente con un React finto «di superficie»: esegue la pagina e i suoi hook
(useState, useEffect, useMemo, useRef...), ma non i figli. L'albero degli
elementi porta i props che la pagina passa a ciascun figlio (le righe alla
tabella, il conteggio alla ricerca, l'onChange del filtro): la prova li legge e
chiama gli onChange come farebbe chi usa la pagina. Le librerie di `src/lib`
sono vere, tranne il client; i componenti da tenere veri per le loro funzioni
esportate si passano in `reali`. `clienteFinto` registra ogni richiesta
(letture, funzioni, iscrizioni) ed `emetti` manda gli eventi di subscribe;
`orologioFinto` fa passare il tempo a comando, per i debounce. Una funzione
vera si serve alla pagina dal banco: `funzioni: { nome: async (corpo) =>
(await chiama(modulo, { db, corpo })).j }`. Lo usano
`prove/terminatiReteUnaLettura.mjs`, `prove/evasioneAnnoInMemoria.mjs` e
`prove/daDichiarareRicercaAttesa.mjs`. Attenzione: il banco delle funzioni non
ordina e non conosce `$in`. Chi legge «l'ultimo» con `filter(..., '-campo', 1)`
deve tenere l'archivio finto gia' ordinato (vedi come fa la prova
dell'evasione), altrimenti la prova vede un record vecchio che la piattaforma
non darebbe. `caricaPagina('lib/x')` impacchetta anche una libreria di
`src/lib` senza componente, con le sue esportazioni in `modulo` (revisione del
13/10/2026): e' il modo di provare in node una libreria che importa con l'alias
`@/` (`prove/ascoltoCaricamenti.mjs`). Una pagina che chiede chi e' collegato
(`useAuth` o `usePermessi`, un contesto che la pagina finta non ha) si carica
da una copia del sorgente in cui e' sostituito solo quell'import
(`caricaPagina(..., { file })`, 14/10/2026): `prove/pagineAnniPassati.mjs`,
`prove/perNoiChiusiDallaPagina.mjs`.

**Per leggere le parole che un componente scrive c'e'
`prove/dati/disegnaComponente.mjs`** (prova generale del cambio d'anno,
15/10/2026). `disegnaComponente(percorso, nome)` impacchetta il componente con i
suoi import veri (finti solo il client della piattaforma e l'accesso, con un
amministratore) e lo disegna con React lato server: restituisce `(props) =>
HTML`, e `testoDi` riduce l'HTML alle parole a video. Cercare una frase nel
sorgente dice che c'e', non che esce quando deve. Gli effetti non girano (vedi
sotto): i dati si passano nei props. Lo usano `prove/targetAttesoAllaData.mjs`,
`prove/andamentoFiltriAnno.mjs` e `prove/cambioAnnoRitocchi.mjs`, che ferma
anche l'orologio per le parole che dipendono da oggi.

**Il primo disegno di una pagina non vede quello che dipende dalle letture**
(revisione del 15/10/2026). `renderToStaticMarkup` non esegue gli effetti: un
pulsante che aspetta i numeri resta «non pronto» per tutti. Una verifica su
quello che cambia fra amministratore e non amministratore dopo le letture si fa
sul componente disegnato pronto, come la pagina lo passa quando ogni lettura ha
risposto, oppure sulla pagina montata con `paginaFinta`. Il caso: in
`prove/dashboardPagina.mjs` la frase «costi e margine» del riepilogo della
settimana, provata al primo disegno, non poteva fallire.

**Una prova che dice «N giorni fa» ferma l'orologio** (revisione del
14/10/2026). Se chiama una funzione o una pagina che chiede oggi a `oggiRoma()`,
la prova sostituisce `Date` per il tempo della chiamata: `alGiorno` in
`prove/ordiniEseguiti.mjs`, come in `prove/attesaDellAnno.mjs`. Altrimenti passa
il giorno in cui la si scrive e cade il giorno dopo, anche nel giro di GitHub a
ogni push: in `prove/ordiniEseguiti.mjs` «26 giorni fa» sarebbe diventato 27 dal
15/10/2026. Per vedere se una prova dipende dal giorno: `node --import <file che
sposta Date di qualche giorno> prove/<prova>.mjs`.

### Il giro di GitHub: le prove a ogni push su main (14/10/2026)

I controlli giravano solo sul PC, prima di un commit. La piattaforma pero' fa
commit da sola su main, e l'utente pubblica da li': un errore entrato cosi' non
lo provava nessuno. Dal 14/10/2026 (migliorie approvate dall'utente: «per me ok
sulle cose da sistemare, sulla velocità e su quanto da creare, procedi pure»)
c'e' un controllo automatico prima della pubblicazione.

**Che cosa gira.** `.github/workflows/prove.yml` parte a ogni push su main,
anche a quelli della piattaforma, e a mano (Actions, «Prove», «Run workflow»).
Lancia `npm ci`, `npx eslint --quiet .`, `node prove/specchi.mjs`,
`npx vite build` e `npm run prove:ci`. Ogni controllo gira anche se quello prima
e' caduto, per vedere subito quali sono caduti. Non servono segreti: il flusso
legge il repository e basta. Un push nuovo ferma il giro di quello prima. Il
giro non ferma la pubblicazione: segna il commit con la croce rossa e dice quale
controllo e' caduto. Prima del primo push nessuno l'ha visto girare su GitHub:
il primo giro va guardato.

**Che cosa non gira, e perche'.** I dati veri non vanno mai su GitHub. La copia
`../dati-veri` e i documenti dell'utente sono gli archivi e le carte vere di
SMOCO: stanno fuori dal repository apposta, e quello che e' nel repository va
su GitHub. Il quinto controllo, Giacenze e Dichiarazioni sui dati veri
(`prove/datiVeri.mjs`), e le parti delle altre prove che leggono la copia
restano sul PC: si lanciano prima del commit come sempre. Il giro di GitHub non
li sostituisce, e un giro verde non vuol dire che i dati veri tornano.

**Come la modalita' CI tiene fuori i dati veri.** `npm run prove:ci`
(`prove/esegui.mjs --ci`) fa girare ogni prova con
`prove/dati/soloIlRepository.mjs` davanti (`--require` in NODE_OPTIONS:
`--import` nei worker non vale). Ogni percorso fuori dal repository si annota in
un registro e risponde che non c'e', anche sul PC: lanciata in locale, la
modalita' CI vede quello che vede GitHub. Le vie che il controllo guarda:
- node:fs, compresi `realpathSync.native` e `realpath.native`;
- import e require;
- i worker e i processi node, anche quando la prova gli da' un ambiente ridotto:
  il controllo, il registro e le cartelle temporanee si rimettono;
- per i processi che non sono node, come git, la cartella e gli argomenti che
  sono percorsi: uno fuori si cambia con un percorso che non esiste.

Restano dentro il repository, node_modules e la cartella temporanea. Non resta
dentro la cartella che contiene il repository: li' stanno i dati veri.

**Il riconoscimento parte dal sorgente**, perche' il registro non vede tutto:
per esempio un programma che legge un percorso scritto in un suo file
(revisione del 14/10/2026: un worker, git e un node con l'ambiente ridotto
leggevano la copia, e la prova risultava superata). Le regole:
- Una prova che nomina la copia (`dati-veri`, `DATI_VERI`) o un documento del PC
  (un percorso `'C:/...'` scritto) non e' mai superata. E' «in parte o
  saltata»: si conta a parte e si dice che cosa le e' mancato.
- Una prova che il registro vede cercare fuori una cosa che il sorgente non
  nomina fallisce, perche' su GitHub passerebbe a vuoto. Ogni cosa va nominata
  per quello che e': chi nomina la copia ma legge un documento del PC lo tace.
- `SOLO_NOMINA` in `prove/esegui.mjs` e' un elenco scritto, non una variabile.
  Raccoglie le prove che nominano la copia solo per parlarne; oggi c'e'
  `prove/proveSuGitHub.mjs`. Sono superate, ma se cercano fuori falliscono.
  Solo loro possono scrivere `PROVE_CI_REGISTRO`, `PROVE_CI_RADICE` o
  `PROVE_CI_TEMP`: un'altra prova che li nomina fallisce.

Chi scrive una prova sui dati veri la legge da `../dati-veri/` (o da
`DATI_VERI`) nominato nel sorgente. Se la copia manca, salta la sezione e lo
dice, senza uscire con errore: in CI una prova che esce con errore cade.

Le prove girano con l'ora e la lingua del PC (TZ Europe/Rome, it_IT; il runner
e' in UTC e in inglese): fra le 22 e mezzanotte UTC il giorno italiano e' gia'
l'altro. Le imposta `npm run prove:ci`, non il flusso, cosi' la modalita' CI
lanciata sul PC e' la stessa. Girano in parallelo (`PROVE_PARALLELE`) e si
fermano dopo 300 s (`PROVE_CI_SECONDI`). Serve la storia intera di git
(fetch-depth 0) per le prove che confrontano col codice di commit vecchi (`git
show`): con la storia tagliata il giro si ferma invece di saltarle. In modalita'
CI un processo lanciato da una prova ha il controllo davanti: npm o npx lanciati
cosi' leggerebbero la loro cache fuori dal repository e cadrebbero. `npm run
prove` resta quello di prima. La prova di tutto questo e'
`prove/proveSuGitHub.mjs`, che fa girare prove finte in un repository finto con
la copia accanto.

**I minuti.** Un giro costa circa 5-6 minuti di GitHub Actions (misura del
14/10/2026: le prove da sole, due alla volta come sul runner di un repository
privato, fra un minuto e mezzo e due sul PC). Un repository privato nel piano
gratuito ne ha 2.000 al mese, cioe' circa 350 giri. Finiti quelli, il giro non
parte piu' fino al mese dopo: un commit senza il giro non e' un commit provato.

**I numeri del giro, alla chiusura del 14/10/2026** (`npm run prove:ci` sul
PC, albero di lavoro con le migliorie del giorno): 275 prove in 1 min 4 s, 8
alla volta. 236 superate, 39 in parte o saltate (35 per la sola copia dei dati
veri, 2 per i soli documenti del PC, 2 per tutti e due), 0 fallite. Alla
chiusura delle richieste del 14/10/2026 sera: 279 prove in 1 min 2 s, 238
superate, 41 in parte o saltate (36 per la sola copia, 2 per i soli documenti
del PC, 3 per tutti e due), 0 fallite. Alla chiusura delle cose nuove del
15/10/2026 (copia di sicurezza, riepilogo della settimana, registro degli errori,
Guida): 284 prove in circa un minuto, 240 superate, 44 in parte o saltate (39 per la
sola copia, 2 per i soli documenti del PC, 3 per tutti e due), 0 fallite. La
modalita' CI le elenca una per una con quello che e' mancato a ciascuna: quella
parte gira solo sul PC.

### Lo stile dei commenti

Commenti e messaggi in **italiano senza lettere accentate**: si scrive `e'` al
posto di «è», `piu'` al posto di «più», `percio'` al posto di «perciò». Un
commento dice **perche'** una cosa e' fatta cosi' e **il fatto vero da cui nasce
la regola, con la data**, non che cosa fa la riga sotto: quello si legge dal
codice. I testi che l'utente **vede a video** sono invece in italiano normale,
con gli accenti.

All'utente si da' del **tu**.

### Commit e push

Si lavora su `main`, si committa e si pusha; **la pubblicazione la fa l'utente**
dalla piattaforma. Ogni commit finisce con la riga
`Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Dal 14/10/2026 ogni
push su main fa partire il giro di GitHub («Il giro di GitHub», sopra): non
sostituisce i controlli sul PC, e i dati veri restano solo li'.

### Gli specchi: `base44/shared` e `src/lib`

Alcune regole servono sia alle funzioni di server sia alle pagine, e le pagine
non possono importare da `base44/shared`: di quei moduli esiste uno **specchio**
in `src/lib`. Le due copie devono restare identiche a meno dell'intestazione di
commento e delle righe di `import`, e lo controlla `prove/specchi.mjs`. **Una
modifica si fa uguale in tutti e due i file.**

**Un gemello che la prova non conosce non e' uno specchio, e' una copia che
aspetta di divergere.** Fino al 10/10/2026 quattro coppie erano fuori
dall'elenco: i nomi (`normalizzaRagioneSociale.ts` e
`normalizzaRagioneSocialeClient.js`, che era una copia a parte senza commenti),
le regioni, il formato dei fogli e i subfornitori. Uguali per caso, quel giorno;
e i nomi sono la chiave con cui pagine e funzioni riconoscono lo stesso
fornitore. Ora sono nell'elenco. Chi crea un file in `src/lib` che ripete
uno di `base44/shared` lo aggiunge a `SPECCHI` nello stesso commit.

**Le coppie dell'11/10/2026** (chiusura dell'audit) sono sei, e
`prove/specchi.mjs` ora ne confronta 25. `ecotyreTariffe` porta il prezzo attivo
dell'extra raccolta, le unita' di misura, il centesimo e il prezzo a tonnellata:
pagina, scheda e file dell'extra raccolta scelgono il prezzo con la stessa
funzione della fattura. `validitaTariffa` e' la regola unica di quando una
tariffa vale. `conflittiTariffa` dice quando due tariffe sono la stessa: la
usano `gestisciAnagrafiche` e la copia d'anno, e nelle pagine l'elenco e lo
storico delle tariffe. `attesoContratto` e `andamentoTarget` portano alle pagine
il target del contratto, l'atteso alla data, le righe dell'Andamento e
l'abbinatore dei nomi. `registroCaricamenti` e' la regola sullo stato degli
archivi, con i tipi che legge ogni conto, per l'avviso delle pagine e per i
ricalcoli dopo un caricamento.

Con lo storico delle modifiche (11/10/2026) anche `campiTracciati`: quali campi si tracciano e il motore che rilegge, scrive e registra, uguale per pagine e funzioni. Le coppie diventano 26.

**Con il giro delle alte aperte (12-13/10/2026) ne entrano tre, e le coppie
diventano 29.**
- `fontiConoscenza`: le fonti come testo, i siti ufficiali e il riquadro
  «Verificata sulle fonti», uguali per chiediAssistente, la base di conoscenza
  e la chat.
- `formulari`: nelle pagine i formulari si contano con `src/lib/formulari.js`,
  mai con `righe.length` (la pagina Terminati ACI). Ci stanno anche le soglie
  del portale sull'ACI, `MINIMO_ACI_KG` e `SOGLIA_ACI`.
- `segnapostiContratto`: il catalogo dei punti che cambiano nei contratti ai
  fornitori, come si scrivono date, quantita' e prezzi, e da dove vengono i
  valori. Lo usano `contrattiAnno` per la proposta e la scheda Contratti per il
  documento.

**Con il surplus sulle tariffe (13/10/2026) entra `surplus`, e le coppie
diventano 30.** E' quando vale un surplus, a chi, quanto fa una riga, i
controlli e i conflitti del salvataggio. Lo usano passiva, attiva, margine,
`gestisciAnagrafiche`, EcoTyna e, nelle pagine, la colonna «Surplus» delle
tariffe, la scheda dei surplus e l'extra raccolta.

**Con le decisioni del 13/10/2026 entra `configurazioneRegolaAlert`, e le
coppie diventano 31** (aggiunta all'elenco dalla chiusura del giro, il
14/10/2026). E' il giorno della configurazione di una regola alert, uguale per
la pagina Alert Engine e per `runAlertEngine`. `surplusVisibile.ts` (la parte
attiva del surplus per chi non e' amministratore) non ha uno specchio: la usa
solo la funzione `leggiSurplus`, e nel browser `src/lib/leggiSurplus.js` chiama
la funzione. Con la variazione del contratto (14/10/2026) non entrano coppie:
`contrattoRete.ts` lo usano solo il server (gli strumenti di EcoTyna e, dal
14/10/2026, `getDashboardRaccolta`), e `src/lib/eventiDati.js` (l'annuncio dei
target cambiati) e' solo delle pagine. Con le migliorie del 14/10/2026 non
entrano coppie: `tariffeVisibili.ts` (la parte attiva delle tariffe per chi non
e' amministratore) la usa solo la funzione `leggiTariffe`, e nel browser
`src/lib/leggiTariffe.js` chiama la funzione, come per il surplus. Le coppie
restano 31.

**Con le richieste del 14/10/2026 sera entra `ordiniEseguiti`, e le coppie
diventano 32** (aggiunta all'elenco dalla chiusura del giro). E' la regola degli
ordini rimasti «eseguito»: gli stessi gruppi e le stesse frasi per l'esito del
caricamento, la voce della dashboard, l'avviso delle pagine e il foglio da
scaricare. La lettura (`ordiniEseguitiLettura.ts`) e' solo delle funzioni,
perche' le pagine non leggono archivi per nome; il foglio
(`src/lib/ordiniEseguitiExcel.js`) solo delle pagine. Nello stesso giro
`esitoDellaPagina` (`src/lib/todoSezioni.js`, senza import) ripete la regola di
`chiusaDalPortale` di `richiesteEct.ts`: non e' uno specchio, e che dicano la
stessa cosa lo controlla `prove/todoCancellatiDalPortale.mjs`.

**Gli import in `src/lib` vanno bene in tutte due le forme.** La convenzione e'
l'alias `@/` (39 dei 92 file; 12 usano un relativo, fra cui i cinque che prendono
`./prodotto.js`), e nessuna delle due rompe le prove: il caricatore
`prove/dati/libPagine.mjs` carica il modulo da un indirizzo `data:` e **riscrive
entrambe**. Fino all'08/10/2026 qui c'era scritto che gli import `src/lib` sono
relativi «non con l'alias», che era falso e costava riscritture inutili: chi lo
prendeva alla lettera doveva toccare 39 file per niente. Dentro i componenti
l'alias va bene comunque, perche' li' ci pensa Vite.

Vale per il file che la prova carica. Un file di `src/lib` importato da un
altro file che la prova carica lo carica node com'e', e un suo `@/` non si
risolve. Il 12/10/2026 `storiaRiepilogo.js`, importato da
`dichiarazioniExport.js`, dava ERR_MODULE_NOT_FOUND '@/lib' in
`documentiCheEscono`. In quei file gli import sono relativi (`./utils.js`). Per
lo stesso motivo lo specchio `src/lib/andamentoTarget.js` prende i mesi da
`./pfuConstants.js` e non da `movimenti.js` (13/10/2026): lo importa
`reportGeneraleVista.js`, che le prove caricano direttamente in node; la
differenza col file di server sta solo nella riga di import. Per provare una
libreria che usa l'alias c'e' `caricaPagina('lib/x')` (vedi «I quattro
controlli»).

**Una prova che carica da se' un file di `src/lib` da un indirizzo `data:` deve
risolvere l'alias `@`** (11/10/2026). `prove/pdfTabella.mjs` sostituiva solo
l'import di `@/lib/utils`: quando `esportaTabella.js` ha cominciato a importare
`@/lib/giornoItaliano`, la prova e' crollata prima di qualunque verifica e
`npm run prove` non passava piu'. Ora sostituisce ogni `from '@/lib/<nome>'` col
file vero. Per le prove nuove c'e' `caricaLibPagine`
(`prove/dati/libPagine.mjs`), che lo fa gia'.

### I fine-riga

Questo file e i sorgenti stanno a **LF**. Modificare un file con uno strumento
che converte a CRLF rompe le prove che cercano un passaggio esatto nel sorgente:
una prova che cerca `\n` dice che manca un controllo che invece c'e'.

**Una regex scritta da uno script perde la barra.** Il 12/10/2026 una patch fatta
con un heredoc e un template literal ha scritto `/s+/` al posto di `/\s+/` in
`normRegione`: toglieva le «s» invece degli spazi, la stessa trappola trovata il
10/10 nei nomi dei raccoglitori. Le prove passavano perche' i due lati del
confronto sbagliavano uguale. Le regex si scrivono con Edit, e la prova ha un
caso che lo vede («Valle  d'Aosta» con due spazi, «Ba ilicata» non e'
Basilicata).

**Un testo sostitutivo che finisce con uno spazio lo perde** (14/10/2026).
Sostituendo `raccolto: ` (con lo spazio in coda) lo strumento di modifica ha
scritto `raccolto:'Raccolto per canale'`, e `prove/assistentePagina.mjs` ha
dato «etichetta per raccolto». Il pezzo da sostituire si fa finire su un
carattere che non sia uno spazio, e dopo la modifica si guarda il diff.

### Le librerie pesanti si caricano quando servono (10/10/2026)

`xlsx` (430 kB) e `jspdf` (384 kB) **non si importano mai in testa a un file**:
si prendono dentro la funzione che li usa, `const XLSX = await import('xlsx')` o
`const { jsPDF } = await import('jspdf')`. Vale anche per `lib/esportaTabella.js`,
che se li porta dietro tutti e due.

**Basta un solo import statico per disfare il lavoro di tutti gli altri.** Il
pacchetto e' uno: se un file qualsiasi importa `xlsx` in testa, `xlsx` entra nel
chunk principale e i venti `await import` degli altri non servono piu' a niente.
Fino al 10/10/2026 era cosi': venti file pigri e dodici statici, e tutto il peso
si apriva con la prima pagina. Vite lo diceva a ogni build - «dynamic import will
not move module into another chunk» - e quelle tre righe erano la cosa vera che
aveva da dire.

Il guadagno misurato: chunk principale da **4.100 a 3.268 kB**, cioe' da 1.213 a
**940 kB gzip** alla prima apertura, con `xlsx` e `jspdf` in due chunk a parte che
si scaricano solo quando si esporta.

**Chi lo rende pigro deve guardare i chiamanti.** Una funzione che diventa
asincrona rompe in silenzio un `try/catch` sincrono: l'errore non viene piu'
preso e l'esportazione fallisce senza dire niente. Due chiamanti erano cosi'
(`PassivaModulo`, `ReportSettimanale`: `onClick={() => { try { esporta(); } catch
{...} }}`) e sono diventati `async` con l'`await` dentro. E dove il valore di
ritorno serviva subito - `AttivaEsportazioni` registra nello storico il nome del
file appena scritto - senza `await` la registrazione partiva prima del file.

Il 14/10/2026 anche `pptxgenjs` (385 kB col suo `jszip`): `exportPPT` in
`lib/statusExports.js` lo prende al clic su «PPT»,
`const { default: pptxgen } = await import('pptxgenjs')`. Era l'ultima libreria
dei file ancora importata in testa. La regola vale per tutte le librerie dei
file (`exceljs`, `jspdf`, `xlsx`, `pptxgenjs`, `jszip`, `pdf-lib`, `pdfjs-dist`,
`html2canvas`, `canvg`), e `prove/pacchettiLeggeri.mjs` la controlla sul grafo
vero: impacchetta l'app con esbuild divisa in pezzi e segue gli import in testa
di ogni pagina. Nessuna pagina deve scaricare una di queste librerie
all'apertura.

**Una prova che impacchetta deve dare a esbuild la cartella: `absWorkingDir:
RADICE`.** esbuild scrive i percorsi del resoconto (metafile) relativi alla sua
cartella di lavoro. Senza, la prova lanciata da `prove/` o da fuori dava 13
errori col codice giusto. Inoltre esbuild prende la cartella quando si carica,
non quando impacchetta. Per questo `pacchettiLeggeri.mjs` si sposta apposta in
`prove/` e solo dopo carica esbuild (`await import('esbuild')`): cosi' ogni giro
controlla anche questo.

### Le pagine si scaricano quando si aprono (10/10/2026)

In `src/App.jsx` una pagina **non si importa in testa**: si dichiara pigra,
`const Giacenze = lazy(() => import('@/pages/Giacenze'));`. Prima erano
ventisette import statici e tutte le pagine finivano nello stesso pacchetto:
chi apriva la dashboard scaricava anche la fatturazione, le omologhe e la
qualifica fornitori.

Il guadagno, misurato: pacchetto d'avvio da **3.268 a 454 kB**, e la prima
apertura (avvio + dashboard) da **1.151 a 472 kB gzip, cioe' il 59% in meno**.

**L'attesa sta attorno all'Outlet, dentro `Layout`, non attorno alle `Routes`.**
Un Suspense attorno alle Routes farebbe sparire barra laterale e intestazione a
ogni cambio di pagina: peggio che aspettare. Cosi' invece il guscio resta a
video e cambia solo il contenuto. Il cerchio che gira e' lo stesso dell'avvio,
perche' chi guarda non deve imparare due attese.

Il guscio - `Layout`, `ProtectedRoute`, `PageErrorBoundary`, `PageNotFound` -
resta eager: serve subito, e scaricarlo a parte vorrebbe dire due viaggi invece
di uno.

Dentro le pagine, dal 14/10/2026:
- la Dashboard scarica a parte le tre sezioni dei canali, col grafico
  (recharts). Sono `lazy` dentro un Suspense e si chiedono al primo disegno
  (`preparaSezioni`), mentre il server conta il quadro;
- Target & Status scarica a parte le cinque schede che non sono l'Andamento,
  ognuna col suo Suspense, e le linguette restano a video.

Prima apertura misurata con la build (avvio compreso, minificato): Dashboard da
998 a 574 kB (gzip da 311 a 197), Target & Status da 1.221 a 556 kB (gzip da 405
a 186).

**Resta un avviso di build**, e resta per un motivo: tre chunk superano i 500 kB
(`pdf.worker` 1.326, `exceljs` 940 e un `index` da 532, che e' `pdf-lib` preso
da `timbraPdf.js`, non il pacchetto principale) e sono tutti scaricati su
richiesta, non all'avvio. La pagina `TargetStatus` non c'e' piu' (14/10/2026). Alzare `chunkSizeWarningLimit` per farlo
tacere no: un presidio vale quanto la fiducia che gli si da', e un avviso
addomesticato non avverte piu' di niente.

Dal 14/10/2026 `prove/paginePigre.mjs` non conta piu' le pagine a mano: ogni
file di `src/pages` dev'essere pigro in `App.jsx`, tranne le pagine dell'accesso
che `App.jsx` non instrada (Login, Register, ForgotPassword, ResetPassword,
OAuthConsent); nessuna pigra punta a un file che non c'e'; le pigre sono almeno
ventotto, la Guida compresa. Una pagina nuova si dichiara pigra e basta, senza
riscrivere un numero nella prova.

Prove in `prove/paginePigre.mjs`.

### Il limite di richieste della piattaforma (22/09/2026)

Le richieste agli archivi si contano **per tutta l'app insieme**, su un minuto;
oltre, 429 "Rate limit exceeded". Ogni funzione che crea un client lo avvolge con
`conLimiteRichieste(createClientFromRequest(req))`
(`base44/shared/limiteRichieste.ts`, specchio in `src/lib`, usato anche da
`src/api/base44Client.js`). Lo fanno 94 cartelle di `base44/functions` su 97 (11/10/2026); le
tre fuori sono superate - `seedTargetSiti2026` crea il client nudo e risponde 410,
`computeGiacenze` e `pulisciVerificheReport` non ne creano nessuno - e non sono il
modello da copiare. Una richiesta respinta si ripete dopo una pausa, le
chiamate a funzione solo su 429. Le letture intere passano da
`fetchAll`/`perPagina`/`fetchAllClient`, a pagine da 5000 righe (il massimo che
la piattaforma restituisce). Niente pagine che rileggono archivi interi a
intervalli: si guarda lo stato di cio' che e' in corso, e si rilegge tutto solo
quando cambia (`ReportSettimanali.jsx`).

**Le pagine di un archivio si leggono in ordine di `id` e si deduplicano**
(regola di `base44/shared/fetchAll.ts`): `id_ordine` non e' unico, quindi non e'
stabile fra una pagina e l'altra, e oltre le mille righe i conti escono sbagliati
senza dirlo.

**Una pagina legge una volta e filtra in memoria** (segnalazioni alte A3, A14 e
A49 del 20/09, corrette il 12/10/2026). Un filtro che rilegge un archivio
intero, o che richiama funzioni che quel filtro non lo guardano, consuma il
margine di tutta l'app. Terminati Rete faceva sette richieste a ogni clic (tre
pagine di primarie e quattro funzioni) e si iscriveva di nuovo ai caricamenti.
Ora `PrimarieRete.jsx` legge l'archivio all'apertura e alla chiusura di ogni
caricamento delle primarie che lo ha riscritto (vedi il paragrafo dopo), filtra
in memoria e richiama solo il riquadro che dipende dal filtro cambiato: il mix
da regione, stato, mese e anno, i tempi dall'anno. L'evasione degli assegnati
chiama `evasioneAssegnati` con `{ anno, anno_intero: true }`, che legge gli
archivi una volta e risponde per i dodici mesi, e la pagina sfoglia i mesi in
memoria; `{ anno, mese }` resta identico, per le pagine aperte prima della
pubblicazione. Un anno letto vale finche' non arriva la nota «moduli collegati
aggiornati» di un caricamento delle primarie, o fino a una scrittura della
pagina; i 5 minuti restano come rete di sicurezza, tranne mentre si aspetta la
nota. La pagina dell'evasione rilegge alla nota, non alla chiusura del
caricamento: in quel momento controllaEvasioneAssegnati sta ricontrollando le
liste, e una rilettura insieme rifarebbe i controlli due volte. La nota puo' non
arrivare: dopoCaricamento la scrive solo se riescono tutti e cinque i ricalcoli,
e non la scrive se la scheda di chi carica si chiude. Passati 3 minuti dalla
chiusura senza nota (`ATTESA_NOTA_MS`: il ricontrollo delle liste, con tutti i
suoi tentativi, si arrende prima), l'anno letto prima e' vecchio. Lo e' subito
dopo un «parziale» o dopo schede di extra raccolta salvate. Lo e' subito anche
quando la nota arriva ma la rilettura che fa partire non riesce: un 500, o il
limite di richieste, perche' alla nota rileggono insieme tutte le pagine aperte
e riparte il motore degli alert. La nota segna finiti i ricalcoli (fase
'ricalcoli_finiti'), anche quella della riga vista solo aperta se la chiusura
non si e' sentita. Mentre la rilettura e' in volo, l'avviso dice che la pagina
sta rileggendo e «Rileggi ora» e' fermo. Se non riesce, dice «i ricalcoli sono
finiti ma la rilettura non è riuscita». Dopo la nota l'avviso non dice mai «non
risultano finiti» e non promette una rilettura da sola (revisione del
13/10/2026). Si rilegge al primo cambio di mese, con «Rileggi ora» nell'avviso
o con «Controlla ora». Mai da solo (revisione del 13/10/2026): l'evento arriva
nello stesso istante a tutte le pagine aperte, e ognuna ricontrollerebbe le
stesse liste. L'avviso dice sempre
che i numeri sono di prima e quando si rileggono davvero, mai «si aggiornano da
soli». La ricerca FIR di «Da dichiarare» parte 400 ms dopo l'ultimo tasto, o
con Invio, e intanto Excel e PDF aspettano. I numeri non sono cambiati: sui dati
veri dell'11/10/2026 gli stessi ordini a video in 16 stati di filtro su 10.487
primarie, e gli stessi raccoglitori, controlli e alert nei dodici mesi
dell'evasione rispetto al calcolo mese per mese.

**Un caricamento e' una sequenza, non un evento** (revisione del 13/10/2026). Per
un caricamento delle primarie importaBlocco scrive sul registro quattro cose:
chiude in «errore» la riga rimasta aperta da un tentativo di prima, apre la sua
«in_corso», la chiude con «successo» o «parziale», e a ricalcoli finiti aggiunge
la nota «moduli collegati aggiornati» con un altro update della stessa riga. Una
pagina che rilegge a ogni evento non «in_corso» rilegge tre volte: Terminati Rete
erano tre letture dell'archivio e 12 funzioni. Gli eventi del registro si
leggono con `creaAscoltoCaricamenti(tipi)` (`src/lib/ascoltoCaricamenti.js`),
una volta per riga. «concluso» vuol dire che la riga e' passata a un esito che
ha riscritto l'archivio, e li' si rilegge l'archivio. «moduli_aggiornati» vuol
dire che e' arrivata la nota, e li' si rileggono i conti salvati dai ricalcoli.
Un «errore» vale come conclusione solo se e' una riscrittura non riuscita:
modalita' «sostituzione», e non la riga vecchia che un caricamento nuovo chiude
(«... e' stato ricaricato dopo.»). E' l'anagrafica dei PDR che importPdrFile non
riesce a rimettere com'era, ed e' la regola di eraRiscrittura nel registro. Gli
altri errori sono rifiuti a dati intatti. Chi mostra gli alert del motore li
rilegge alla nota, e solo quelli: runAlertEngine parte sullo stesso update che
chiude il caricamento, e alla chiusura getAlerts risponde ancora con gli alert di
prima (Terminati Rete, Secondarie). Tutte le pagine iscritte al registro passano
di qui, ciascuna coi suoi tipi e con un'iscrizione per tutta la vita della
pagina: Terminati Rete e ACI, Assegnati rete e ACI, Secondarie, PDR, Terziarie
(solo 'terziarie') ed Evasione assegnati (primarie ed extra raccolta). Assegnati
alla chiusura rilegge anche il dettaglio degli ordini, se e' a video; altrimenti
lo dimentica e lo rilegge quando si apre. Ci passa anche PredittivitaSecondarie
(primarie, primarie_rete e secondarie): ricalcola alla conclusione, dopo la sua
attesa di 4 secondi, e alla nota niente. Il calcolo legge archivi, giacenze e
configurazione, non quello che scrivono i ricalcoli del caricamento (revisione
del 13/10/2026). Prima ricalcolava anche alla riga vecchia chiusa in errore, alla
nota e ai rifiuti a dati intatti. Prove: `prove/ascoltoCaricamenti.mjs`,
`prove/terminatiReteUnaLettura.mjs`, `prove/evasioneAnnoInMemoria.mjs`,
`prove/pagineUnaRilettura.mjs`.

**Un contatore degli alert che non si e' letto dice «—», mai 0** (13/10/2026):
in Terminati Rete `caricaAlert` mette null quando getAlerts non risponde o
risponde senza `total`, e accanto a «Carica dati» compare «Alert aperti: —
(non letti)», che porta alla pagina degli alert. Prima metteva 0 e il segno
spariva, come se non ci fossero alert aperti. Finche' la prima lettura non
risponde non si mostra niente. Dal 14/10/2026 (chiusura del giro) lo stesso in
Secondarie, dove una risposta senza conteggio diventava 0 e una lettura caduta
lasciava a video il numero di prima. Prove: `prove/terminatiReteUnaLettura.mjs`,
`prove/pagineUnaRilettura.mjs` («SECONDARIE: GLI ALERT NON LETTI DICONO «—»»).

**Una lettura fallita non riparte da sola** (revisione del 13/10/2026). Un
effetto che legge «quando i dati non ci sono e nessuna lettura e' in corso»
riparte da solo dopo ogni errore, perche' e' proprio lo stato che un errore
lascia: negli Assegnati erano 51 letture su 51 errori. L'errore si tiene in uno
stato (`erroreRecords` in `src/pages/Assegnati.jsx`) e l'effetto non riparte.
La pagina lo dice («Gli ordini non si sono letti (...)», oppure «non si sono
riletti: quelli a video sono della lettura di prima») e offre «Riprova»; un
caricamento chiuso vale come un nuovo tentativo. Prova:
`prove/pagineUnaRilettura.mjs`.

**Giacenze e Dichiarazioni leggono ogni archivio una volta** (giro della
velocita' del 14/10/2026, «per me ok ... sulla velocità»). Le due pagine rifanno
tutto il conto a ogni apertura. `calcolaGiacenze` leggeva `GiacenzaSito` due
volte su un anno chiuso (l'anno e l'anno dopo): 19 richieste invece di 18.
`riepilogoDichiarazioni` leggeva `DichiarazioneSito` due volte e
`GiacenzaSito` due volte su un anno chiuso (16 e 17 richieste invece di 15), e i
due archivi grandi, il report delle dichiarazioni e le primarie di rete, una
pagina per volta dopo tutti gli altri: otto richieste in fila invece di quattro.
Ora ogni archivio si legge una volta per chiamata, tutti insieme in un
`Promise.all`, a pagine da 5000 in ordine di id, e quello che serve per anno si
prende in memoria; il giorno italiano di una data si calcola una volta
(`giornoDi`). Le risposte sono identiche al carattere a quelle del commit
5939d15, tranne gli ordini degli impianti di un anno passato (punto 25 di
«Giacenze e Dichiarazioni»). Prova: `prove/velocitaGiacenze.mjs`, che conta le
richieste e quante stanno in fila, su un archivio costruito e sui dati veri.

### Il registro degli errori del sito (14/10/2026, rivisto il 15/10/2026)

Una delle cose da creare proposte all'utente il 14/10/2026 e approvate lo stesso
giorno («per me ok ... su quanto da creare, procedi pure»): «un registro degli
errori del sito. Oggi un errore di rete visto da un collega lo scopri solo se te
lo dice». Le pagine annotano da se' i loro errori nell'archivio `ErroreSito`
(`src/lib/registroErrori.js`, installato da `src/main.jsx` prima della prima
pagina): una pagina che si rompe (`PageErrorBoundary`), un errore non preso
(window `error` e `unhandledrejection`), una chiamata a una funzione o a un
archivio che fallisce dopo i ritentativi del limite di richieste. Lo legge solo
l'amministratore: in Alert & Controllo, scheda «Errori del sito»
(`src/components/alerts/ErroriSito.jsx`, anche da `?tab=errori`), e in «Da
gestire» (`vociErroriSito`, `cruscotto.ts`). Chiunque sia collegato **crea** la
riga del suo errore: rls `create: true`, e in `permessi.js` c'e'
`SOLO_CREAZIONE`. Leggere, segnare visti e togliere sono dell'amministratore.

- **Il freno** (`creaRegistro`). Un errore uguale si conta in `volte`. La riga
  dopo dello stesso errore aspetta 2, 10, 30, 60, 120 e poi 240 minuti. Lo
  stesso errore ha al piu' 8 righe al giorno (`MASSIMO_RIGHE_PER_ERRORE`), e una
  sessione al piu' 20 righe al giorno: il conto riparte col giorno italiano,
  perche' l'app installata resta aperta per giorni. Un errore nuovo non aspetta
  dietro a uno ripetuto: il timer si rifissa. Quando la scheda va in secondo
  piano o si chiude (`visibilitychange`, `pagehide`), le righe in attesa partono
  subito, una volta sola e dentro l'evento, con almeno due minuti fra due righe
  uguali.
- **Mai dentro un 429.** Il registro guarda anche SOTTO il limite di richieste
  (`agganciaChiamate` con `suLimite`): ogni tentativo respinto lo ferma per due
  minuti, anche quelli che `conPazienza` poi ripete. La sua create va
  sull'archivio crudo (`moduloCrudo`, preso prima dell'aggancio): un tentativo
  solo, senza ritentativi. Una scrittura che fallisce si perde. Un rifiuto (400,
  401, 403, 404) spegne il registro per la sessione. Chi aggiunge un altro
  involucro al client lo mette con `defineProperty` e lascia passare il segno
  `Symbol.for('ecoflow.limiteRichieste')`.
- **Non sono errori del sito** le risposte che il gestionale da' apposta e che
  la pagina spiega: il 409 `rinviato`, il 403 `sola_lettura` e, da `apriFile`,
  il 404 `senza_file` (documento oltre i 40 giorni) e il 403 `riservato`. Una
  risposta nuova di questo genere porta un campo `true` e va aggiunta a
  `RISPOSTE_APPOSTA`.
- **Che cosa si scrive.** Della pagina, solo il percorso (mai la query string
  ne' l'hash). Il messaggio passa da `pulisciMessaggio`, che toglie token (anche
  scritti in JSON), email, indirizzi, contenuti di file, codici lunghi e il nome
  della piattaforma. Chi lo dice `created_by_id`: la lettura non restituisce
  `created_by` (sulla copia dei dati veri dell'11/10/2026, 31.923 righe con
  `created_by_id` e nessuna con `created_by`). La scheda risale all'email con
  una sola lettura di `User`; il cruscotto conta gli utenti per
  `created_by_id`.
- **In «Da gestire»** una voce sola, area «Errori del sito», sezione dati: quanti
  errori non ancora visti da ieri (giorno italiano), i piu' frequenti col
  messaggio, la chiamata e la pagina, e quanti utenti. `cruscottoOperativo` legge
  il registro solo per l'amministratore, una lettura filtrata sui non visti e
  limitata a `LIMITE_ERRORI_CRUSCOTTO` righe; il titolo dice «almeno» solo se la
  lettura e' piena e tutte le righe lette sono da ieri. Attenzione con una
  pagina che si rompe, un errore non preso o un errore del server; le altre sono
  un'informazione. Niente «Chiedi a EcoTyna»: EcoTyna non legge quel registro.
- **Conservazione.** Le righe piu' vecchie di 40 giorni le toglie
  l'amministratore dalla scheda («Togli quelli più vecchi di 40 giorni»), un
  giorno per volta, dopo una conferma. Niente si cancella da solo.
- Prove: `prove/registroErrori.mjs` (anche la tempesta di 429, sezione 6B),
  `prove/cruscotto.mjs` (la voce, anche sul banco), `prove/chiLeggeCosa.mjs`
  sezione 11, `prove/scrittureDegliUtenti.mjs`.

### Base44: comandi, file e riferimenti

Questo e' un repository di un'app Base44: codice dell'utente, modifiche aderenti
alla richiesta, convenzioni del progetto rispettate. `README.md` ha
l'installazione locale, le variabili d'ambiente e il flusso di pubblicazione.

- `base44 dev` e' il comando di sviluppo quando serve il backend Base44 locale:
  manda su backend e frontend insieme. Quando documentazione o codice dicono che
  il frontend parte da solo, di solito vuol dire che la configurazione del
  progetto ha `site.serveCommand`, per esempio `"serveCommand": "npm run dev"` in
  `base44/config.jsonc`.
- `npm run dev` **solo** per lavorare sul frontend contro il backend ospitato.
- `src/`: il frontend. `src/api/base44Client.js`: il client dell'SDK.
  `vite.config.js`: Vite e il plugin Base44. `.env.local`: valori locali, i
  segreti non si committano mai.
- Per un lavoro specifico su Base44 si preferisce il flusso della CLI esistente
  all'aggiunta di script npm nuovi, e si riusano il client dell'SDK e i modelli
  del plugin Vite che ci sono gia', invece di aprire una strada nuova.
- Riferimenti: [CLI](https://docs.base44.com/developers/references/cli/get-started/overview.md),
  [Agent skills](https://docs.base44.com/developers/backend/overview/skills.md).
  Se l'agente supporta le Agent Skills, prima di un lavoro specifico su Base44:
  `npx skills add base44/skills`.

### Regole tecniche della piattaforma e delle pagine

Le cose che sono costate ciascuna un guasto vero.

**Nello schema di un'entita' un elenco va dichiarato `"type": "array"`.** Scritto
come `object` il server rifiuta il dato con `Error in field X: Input should be a
valid dictionary` e la funzione risponde 500. E' successo per davvero: il
registro delle esportazioni (`EsportazioneFatturazione.documento_ids`) non ha
registrato niente dal giorno in cui e' nato, e nessuno se n'era accorto perche'
il file veniva comunque prodotto. Quando si aggiunge un campo che conterra' un
elenco lo si dichiara `array` con i suoi `items`, anche se per ora non ci scrive
nessuno.

**Produrre un file e registrarlo sono due passi distinti.** Il file e' gia' sul
computer di chi esporta: se la registrazione non riesce non si dice
"esportazione fallita", si dice che il file c'e' ma non e' finito nello storico.
E non si usano le finestre di sistema (`alert`, `confirm`) per raccontarlo:
bloccano la pagina, non si copiano e fanno sembrare rotto cio' che ha funzionato.

**Nei PDF le intestazioni vanno a capo su due righe e le celle fino a tre.**
Tagliare alla prima riga faceva sparire l'unita' di misura: "Prezzo Unitario
(Euro/TON)" arrivava come "Prezzo Unitario" mentre nell'Excel c'era tutto. Vale
per `esportaTabellaPdf` e per `esportaSezioniPdf`; la prova `prove/pdfTabella.mjs`
rende il PDF in memoria e rilegge le scritte, cosi' il taglio non puo' tornare.

**Ogni sottosezione di Giacenze e di Target & Status ha il suo pulsante PDF**
(regola dell'utente, 06/10/2026: «in tutte le loro sotto sezioni dovrebbe
esserci un pulsante per esportare in pdf la situazione presente in ogni
momento»). Il pulsante (`src/components/shared/EsportaPdf.jsx`) sta DENTRO la
scheda, non in testa alla pagina, cosi' quello che esce e' quello che si ha
davanti, coi filtri e l'anno di quel momento; le sezioni le costruisce
`src/lib/giacenzePdf.js` e le disegna `esportaSezioniPdf`. Le sei schede di
Giacenze sono tutte coperte dal 09/10/2026 (`prove/esportaPdfSchede.mjs` lo
verifica scheda per scheda, cosi' una scheda nuova non nasce muta). Tre cose
imparate quel giorno: la funzione delle sezioni **puo' essere asincrona** (quella
di «Da dichiarare» va a prendersi TUTTE le righe del filtro, perche' un totale
sotto una tabella di cento righe e' proprio l'inganno corretto in quei giorni);
il titolo delle note in coda e' il parametro `titoloNote`, perche' il default
nasce dalla fatturazione («Anomalie da guardare prima di pagare») e nelle
giacenze diceva un'altra cosa; e una regola che serve a due esportazioni - com'e'
finita una voce di dicembre - si scrive in un posto solo (`decisioneDiVoce`),
altrimenti l'Excel e il PDF raccontano la stessa riga in due modi.

**Quando una pagina carica piu' riquadri indipendenti si usa
`Promise.allSettled`, non `Promise.all`.** Le funzioni che leggono gli archivi
grandi ogni tanto cadono: su Terminati Rete bastava `computeRaccoglitoriMix` a
500 per lasciare vuote anche la matrice per provincia, i tempi di evasione e gli
alert. Chi non ha risposto si dice per nome, con "Riprova"; il resto resta a
video.

**Le tabelle larghe** tengono la barra di scorrimento orizzontale sempre a
portata, l'intestazione e la prima colonna ferme; la regola e' globale, in
`src/index.css`. Un elemento `absolute` dentro una cella di queste tabelle non va
oltre `z-[1]` (revisione del 13/10/2026). La prima colonna ferma ha z-index 2 e
l'intestazione 3 (`src/index.css`, da 768 px), e il contenitore della casella
(`<div className="relative">`) non fa un contesto di sovrapposizione suo. La «i»
del Riepilogo, con `z-10`, passava sopra i nomi degli impianti scorrendo di
lato. Se serve di piu', il contenitore va `isolate`.

**L'errore di una funzione si legge dal corpo della risposta** (11/10/2026). Il
client delle funzioni lancia un errore per ogni risposta non 2xx, e il suo
`message` e' «Request failed with status code 409»: il congelamento della
passiva e il salvataggio della chiusura rinviati arrivavano a video cosi', in
inglese e senza dire quale caricamento ripetere. In un `catch` si scrive
`e?.response?.data?.error || e?.data?.error || e.message` (`motivoErrore` in
`Consuntivi.jsx` e `ChiusuraAnno.jsx`, `messaggio` in `PrefatturaEcotyre.jsx`).
Prova: `prove/motivoDelRinvio.mjs`, col client vero dell'SDK installato.

**Un componente non si definisce dentro un altro componente** (alta A39,
12/10/2026). Il `NumField` di `ExtraRaccoltaForm` era una costante dentro la
scheda. A ogni carattere la scheda si ridisegna, React vedeva un tipo nuovo,
rimontava l'input e il cursore usciva dal campo dopo ogni cifra. Un
sottocomponente si scrive a livello di modulo e riceve valore e scrittura come
proprieta'. Lo controlla `prove/extraRaccoltaScheda.mjs`.

**«Oggi» nelle pagine e nelle funzioni e' sempre il giorno italiano** (prova
generale del cambio d'anno, 15/10/2026): `oggiRoma`, `giornoRoma`, mai
`new Date().toISOString().slice(0, 10)`. Fra mezzanotte e l'una (le due
d'estate) il giorno UTC e' ancora ieri: l'01/01/2027 alle 00:30 un'omologa
scaduta il 31/12 «scadeva oggi» e il file si chiamava
`Dichiarazioni_RENTRI_2026-12-31.xlsx`. Sono stati corretti cosi' Omologhe, il
badge delle omologhe, il nome del file e i controlli delle Dichiarazioni RENTRI
(difetto 30), il mese del controllo normativo gia' fatto (difetto 36), lo
«Scaduto» della to-do list (difetto 34) e il giorno proposto dalla Nuova
rilevazione dei piazzali (difetto 29). Una data che arriva dal campo data come
'AAAA-MM-GG' si confronta come giorno, senza passare per `new Date`. Prove:
`prove/omologheRegistro.mjs`, `prove/battitoLavori.mjs`, `prove/menuTodo.mjs`.

### I documenti che escono: una veste sola e la data dei dati (11/10/2026)

**Ogni file che si manda fuori passa dal corredo `src/lib/fogliProfessionali.js`**: exceljs, mai SheetJS, che nella versione del progetto non sa scrivere ne' grassetti ne' colori. Un export costruisce le sue righe come prima, un elenco di elenchi, e le consegna a `foglioDaRighe(wb, nome, { doc, righe, testate, stili, formati, larghezze })`, che le scrive cella per cella uguali sotto il blocco di testa; `scaricaCartella(wb, nome)` scarica il file. Dall'11/10/2026 ci passano la passiva per canale, i tre report dell'attiva, il report dei conferimenti, il confronto col consuntivo, giacenze, dichiarazioni, andamento raccoglitori, extra raccolta (Excel e PDF), il Report Mensile (Excel al posto del CSV, `src/lib/reportMensileExport.js`) ed `esportaTabellaExcel`, quindi anche margine, dettaglio dell'attiva, matrice delle province e qualifica. Resta su SheetJS `giacenzeDaDichiarareExport.js`.

**Il blocco di testa e' uno, `intestazioneDocumento()`**, e lo usano i fogli e i PDF di `esportaTabella.js`, cosi' Excel e PDF dicono le stesse cose: titolo, canale (uno per file), periodo «per fine trasporto», «Dati fino al gg/mm/aaaa · caricati il ...», «Generato il ... alle ... da ...», gli avvisi dei caricamenti aperti, e nel piede «Pagina x di N». Dove un file ha due orologi lo dice (`perFineTrasporto: false` e il sottotitolo): nelle dichiarazioni il conferito e' per fine trasporto, il dichiarato nel mese del caricamento a portale.

**Il «dati fino al» lo chiede il modulo di esportazione stesso**, quando produce il file, alla funzione `datiFinoAl` (`base44/functions/datiFinoAl`), e solo per gli archivi che quel file legge (`entita`): la passiva di rete per primarie di rete e secondarie, l'attiva ACI per le primarie ACI. La data di un archivio che il file non legge direbbe una cosa falsa. La funzione legge poche righe ordinate per archivio (`datiFinoAl` di statoArchivi.ts) e il registro con la regola dei motori (`statoDelRegistro`): ne escono il giorno dell'ultimo caricamento riuscito e i caricamenti aperti. La lettura non ferma mai il file: ha un tetto di 8 secondi, e se non riesce la testa scrive «Dati fino al: non disponibile».

**Le due domande al server stanno in `src/lib/statoDeiDati.js`, che si carica solo con `await import` da fogliProfessionali.js.** Il corredo resta senza client, perche' le prove lo caricano in node, e la build non deve importare pigramente il client che l'app importa in testa: Vite avvertirebbe «dynamic import will not move module into another chunk». Nessuno importa statoDeiDati in testa, e la prova lo controlla.

**I tre report dell'attiva per l'amministrazione non cambiano colonne.** Il primo foglio e' cella per cella quello di prima (intestazioni in riga 1, le righe, una riga vuota, il TOTALE sotto il Prezzo Totale); il blocco di testa sta in un secondo foglio, «Note». Se l'amministrazione vuole la testa sopra la tabella, va chiesto a lei.

**Un prezzo unitario nel PDF ha il tipo del suo Excel (revisione delle migliorie, 11/10/2026).** In `esportaTabella.js` il tipo `'euro'` scrive due decimali fissi, `'prezzo'` quattro fissi e `'prezzoLibero'` da due a quattro: `FORMATI.prezzoLibero`, `'#,##0.00##'`, che nel PDF scrive come `cifreItaliane(v, 2, 4)`. Se l'Excel di una colonna di prezzi usa `prezzoLibero`, anche il PDF deve usare `prezzoLibero`: con `'euro'` un prezzo al chilo da 0,202 usciva «0,20 €», e il PDF dell'extra raccolta diceva un prezzo diverso dall'Excel dello stesso mese. Dal 12/10/2026 anche il format dell'amministrazione: la tabella (`formatAmministrazione.js`) dichiara `tipoPdf: 'prezzoLibero'` sul prezzo unitario accanto a `tipo: 'euro'`, e il PDF (`formatAmministrazioneExport.js`) passa a `esportaTabella` `c.tipoPdf || c.tipo`; l'Excel resta sul tipo e sul titolo (0,2020 al chilo, 240,00 a tonnellata). Prova: `prove/formatAmministrazionePdf.mjs`, che fa il PDF vero e ne legge le celle. Le prove della regola: `prove/extraRaccoltaExport.mjs` sezione 5 (il totale si cerca nella riga del suo formulario, non in tutto il PDF), `prove/documentiCheEscono.mjs` sezione 15.

**Un PDF scrive solo i caratteri che i suoi caratteri hanno (revisione del 15/10/2026).** I PDF del corredo usano la Helvetica standard, con la codifica WinAnsi: l'ASCII, le lettere accentate del Latin-1 e pochi segni (€ « » – — ’ •). Basta un solo carattere fuori e jspdf scrive tutta la stringa in due byte per lettera: la cella esce illeggibile senza nessun errore. Il caso trovato e' il meno tipografico «−» (U+2212) di `tSegno` (`src/components/dashboard/formato.js`), negli scarti «Non quadra» in meno e nelle variazioni del consorzio «in meno». Il riepilogo della settimana fa passare ogni testo da `perIlPdf` (`src/lib/riepilogoSettimanale.js`): oltre al meno, una lettera fuori dalla codifica perde l'accento (Ș diventa S) e un segno che resta fuori diventa «?», non tutta la cella. Dalla chiusura dello stesso giorno anche `perPdf` di `esportaTabella.js`, che serve tutti gli altri PDF del corredo, scrive il meno e i trattini U+2010-2012 come «-»: il PDF del quadro della commessa, con una variazione del consorzio in meno, scriveva in due byte la cella sotto il target e la nota (`prove/riepilogoSettimanale.mjs`, sezione 9). Il resto della ricaduta di `perIlPdf` (accenti tolti, «?») in `perPdf` non c'e' ancora. In un PDF un numero col segno si scrive col trattino «-», oppure si passa il numero alla colonna del suo tipo.

**Una cella del PDF tiene tre righe e il resto cade senza segno** (`esportaSezioniPdf`, `.slice(0, 3)`). Un testo che puo' essere lungo (il titolo di una voce, un elenco di archivi o di ID, una frase) si spezza prima, nelle righe sotto della stessa tabella. Il riepilogo lo fa con `pezziDellaCella`, che misura con le larghezze dei caratteri di jspdf (il maggiore fra tondo e grassetto). `prove/riepilogoSettimanale.mjs`, sezioni 7 e 8, rifa' col jspdf vero il conto di `esportaSezioniPdf` su ogni PDF che produce: nessuna riga in due byte, nessuna cella oltre tre righe, nessun titolo fuori pagina. Gli altri PDF del corredo possono ancora perdere la coda di una cella lunga: andrebbe continuata nelle righe sotto, o chiusa con «...» alla terza riga.

**Per provare un export**: ogni funzione accetta in fondo `opzioni.stato`, lo stato dei dati gia' letto, e allora non chiede niente al server. Il download si intercetta con un `document` finto e `resolveObjectURL` di node:buffer, e il file si rilegge con exceljs: `prove/documentiCheEscono.mjs` lo fa per tutti gli export e confronta i totali del file con quelli a video. Per i PDF delle librerie che caricano `esportaTabella` pigro si sostituisce `await import('@/lib/esportaTabella')` col modulo caricato con jspdf vero, come in `prove/extraRaccoltaExport.mjs`. Nel testo del PDF i caratteri €, — e • arrivano nella codifica dei font standard (0x80, 0x97, 0x95), a volte come byte nudi.

**Ogni foglio con l'elenco «Da dichiarare» dice se la riga e' nel file del portale (15/10/2026).** Dal 15/10/2026 l'elenco comprende i carichi che il file non ha ancora («Giacenze e Dichiarazioni», punto 16), e il PDF della scheda, il suo Excel e il foglio «Da dichiarare» dell'Excel di tutta la pagina li scrivono come righe, con lo stesso totale. Le tre colonne (`INTESTAZIONI_NEL_FILE`, `celleNelFile`: nel file o no col giorno del file, il giorno dell'arrivo all'impianto quando non e' la fine trasporto, il dichiarato a portale dopo il file tolto dalla riga) e le note (`noteSchedaDaDichiarare` per la scheda, `noteElencoDaDichiarare` per la pagina, che sono le prime della scheda) stanno in `src/lib/giacenzePdf.js`, che non importa niente: le prove che caricano gli Excel lo caricano cosi' com'e', mentre la riga d'import da `giacenzeDaDichiarareExport` la fingono testuale (`documentiCheEscono`, `attesaDellAnno`, `pagineAnniPassati`, `ordiniAnniPassatiEtichette`), e un nome nuovo importato da li' le rompe. Una secondaria arrivata dopo il file non ha la primaria: la colonna Ordine scrive il suo numero (`ordine_primaria || ordine_secondaria`), e il dichiarato oltre i carichi sta in una riga sua, perche' il TOTALE sia la somma delle righe. Il foglio della pagina usciva con le righe nuove scritte come le altre, senza dire quali erano, e con la colonna Ordine vuota per la secondaria (chiusura del giro). PDF ed Excel della scheda ricevono gli stessi filtri (`filtriDocumento()` in `DaDichiarareTable`): con filtri diversi le note dei due file dicevano cose diverse, e dal pulsante di uno stoccaggio l'Excel diceva che l'elenco comprende i carichi arrivati dopo, che li' non si cercano (`carichi_dopo_il_file.cercati`). Prove: `prove/daDichiarareCarichiDopo.mjs` (sezione 8: il foglio della pagina ha le righe della scheda cella per cella, anche col dichiarato oltre i carichi) e `prove/documentiCheEscono.mjs` (sezione 8, il file vero riletto con exceljs).

### Quando la piattaforma modifica il codice da sola

La scansione di sicurezza della piattaforma apre commit sul repo da sola, come
`base44-builder[bot]`. **Vanno letti prima di pubblicare**, perche' tocca le
regole RLS, cioe' il modello dei permessi, e un errore la' non si vede provando
col proprio account di amministratore.

Il 01/10/2026 (commit `35f1b3d`, «Apply RLS security recommendations») ha fatto
tre cose su `RichiestaUtente` ed `EsercitazioneRT`, e solo due erano giuste:

- **Giusta, tenuta:** il filtro in lettura. Con `read: true` il server mandava a
  ogni utente i record di tutti, e il «vedo solo i miei» era soltanto un filtro
  nel browser. Tenuto, con due correzioni: la chiave e' `created_by_id`, che
  riempie la piattaforma, non `richiedente_email`, che scrive il browser e
  ripiega sulla stringa vuota; e senza il prefisso `data.`, che in tutte le
  entita' compariva solo la' - lo stesso commit ha scritto `created_by_id` nudo
  su un'altra entita'.
- **Sbagliata, respinta:** `"create": null` su `RichiestaUtente`. Aprire una
  richiesta e' **l'unica scrittura di un utente non amministratore**: il form si
  disegna solo quando non e' amministratore, l'amministratore non ha nessun
  pulsante per creare una richiesta, e il gestionale dice a chi non puo'
  scrivere «per un caricamento o una correzione apri una richiesta dal modulo
  Richieste». Con la create chiusa quella frase e' un vicolo chiuso. `null` e'
  anche l'unico in tutte le entita': qui un divieto si scrive
  `user_condition role admin`.
- **Inutile e rischiosa, respinta:** la condizione su `create` legata a
  `created_by_id`. Non aggiunge difese - quel campo lo mette la piattaforma, non
  il browser, quindi nessuno puo' intestare un record a un altro - e se il
  motore la valuta sul payload, dove `created_by_id` non c'e' ancora, ogni
  creazione fallisce. Su `EsercitazioneRT` voleva dire perdere la prova appena
  svolta con un «Risultato non salvato».

`prove/scrittureDegliUtenti.mjs` e' la guardia: fallisce se una scansione futura
richiude quelle `create`, riapre le letture, scrive una regola come `null` o
reintroduce il prefisso `data.`. **Qual e' la sintassi giusta del campo nelle
condizioni RLS l'ha detta l'assistenza il 02/10/2026, e non va piu' chiesta: sono
valide tutte e due, perche' indicano due generi di campo diversi.** «A platform
field such as created_by_id stays unprefixed, while a field you defined in the
entity needs the data. prefix»: le nostre due condizioni sono su `created_by_id`,
che e' un campo della piattaforma, quindi vanno senza prefisso e stanno gia'
cosi'. Il controllo in `prove/scrittureDegliUtenti.mjs` resta, ma ha cambiato
significato: non e' piu' un dubbio, e' il confine. Un `data.` li' dentro vuol dire
che qualcuno ha messo una condizione su un campo **nostro**, e allora va guardata
una per una. **E non si toglie un `data.` legittimo**: su un campo nostro quel
prefisso serve, e senza, una condizione sbagliata rende invisibili i propri record
al loro proprietario senza che si veda dall'account dell'amministratore.

Il primo `data.` legittimo e' quello di `ModificaDato` (`"data.riservato": false`,
14/10/2026). Sta nell'elenco `GUARDATE` di `prove/scrittureDegliUtenti.mjs`, che
fallisce se compare un `data.` nuovo non guardato e se uno guardato sparisce.
Dopo la pubblicazione va controllato da un utente non amministratore: la riga
Storico di un target cambiato deve mostrare le modifiche. Se non mostra niente,
la condizione non regge, e la strada e' una lettura solo all'amministratore piu'
una funzione di sola lettura dello storico, come `leggiSurplus`, chiamata da
`StoricoModifiche.jsx`.

### Il nome: TreadRider

Il gestionale si chiama **TreadRider** (una parola, T e R maiuscole), scelto
dall'utente il 02/10/2026. Prima si chiamava "EcoFlow Manager". Battistrada
(*tread*) piu' *Outrider*: chi corre sul battistrada. **Non** "TyreTreader", che
era la prima idea: in inglese *treader* e' «chi calpesta», mentre «ricostruttore
di pneumatici» e' *retreader* - e la ricostruzione e' l'altro capo della vita di
una gomma, non il mestiere di SMOCO, che le manda a recupero.

**Due cose da non confondere mai col nome del prodotto:** *EcoTyna* e'
l'assistente dentro il gestionale, e *Ecotyre* e' il consorzio cliente.

**Dove vive il nome.** In un posto solo: `src/lib/prodotto.js` (`PRODOTTO`,
`MARCHIO` - il simbolo del marchio accanto al nome dal 03/10/2026, non quello del
marchio registrato finche' non lo e' -, `SOTTOTITOLO`, `COMMESSA`, `AUTORE_FILE`). Da li' lo prendono l'intestazione del
menu, le schermate di accesso e il metadato Autore dei sei fogli fatti con exceljs
(`wb.creator = AUTORE_FILE`). Restano fuori il `<title>` e
l'`apple-mobile-web-app-title` di `index.html`, perche' l'HTML non importa moduli,
e i tredici export fatti con SheetJS (`XLSX.writeFile`), che non scrive il metadato
Autore: su 19 fogli che si scaricano il nome ne porta 6.

Fino al 03/10/2026 il nome stava scritto a mano in nove punti e **le pagine non lo
scrivevano affatto**: si vedeva solo nella linguetta del browser, l'autore di un
Excel diceva ancora il nome vecchio, e l'utente ha detto «in pratica e' come se non
ci fosse». Se serve cambiarlo, o aggiungerci un marchio, si cambia li'.

**Quello che dal repo NON si cambia.** Il nome con cui l'applicazione si installa
su Android e su desktop, la sua descrizione e la sua icona vengono dal manifest
che **la piattaforma genera dalle impostazioni dell'app** e serve su
`/manifest.json` (che redirige a `/api/apps/manifests/<appId>/manifest.json`).
Quel manifest non sta nel repo: `public/` non esiste. Il 02/10/2026 diceva
ancora `"name": "EcoFlow Manager"`, con `theme_color` nero (il nostro verde e'
`#059669`) e l'icona ospitata su un dominio della piattaforma. Si cambia nelle
impostazioni dell'applicazione, non qui.

**Una stringa interna che resta "ecoflow":** `Symbol.for('ecoflow.limiteRichieste')`
in `base44/shared/limiteRichieste.ts` e nel suo specchio `src/lib/limiteRichieste.js`.
Nessuno la legge, e due `Symbol.for` con chiavi diverse sono simboli diversi: se
si cambiasse in un file solo tornerebbe il doppio avvolgimento del limite di
richieste (una richiesta respinta ripartirebbe 36 volte invece di 6). Si cambiano
insieme o non si toccano: non toccarle e' a rischio zero.

## Le tre regole assolute

### Le tre regole che l'utente non vuole ripetere (21/09/2026)

1. **Fine trasporto, MAI chiusura a portale.** In ogni modulo ogni ragionamento
   - periodo, tagli a una data, confronti con una fotografia del portale,
   ripieghi quando un campo manca - si fa sulla fine del trasporto.
   `ordine_chiuso_il` e la `data_chiusura` **del portale** (OrdineNonDichiarato,
   DichiarazioneTrattamento) si possono mostrare, mai usare per decidere. Non
   c'entra `DocumentoFatturazione.data_chiusura`, che e' la chiusura di un nostro
   periodo di fatturazione: quella il gestionale la scrive e la rilegge
   (`cambiaStatoFatturazione`).
2. **Ogni caricamento aggiorna tutto.** Un modulo fermo a una fotografia vecchia
   e' un difetto, non una spiegazione. La giacenza a portale di un impianto e'
   la fotografia degli ordini non dichiarati **piu'** i carichi che il
   gestionale conosce e il file no (riconosciuti dal **numero d'ordine** negli
   ordini non dichiarati e nel report delle dichiarazioni, mai dalla data)
   **meno** le dichiarazioni caricate dopo la fotografia. Quella di uno
   stoccaggio e' l'**ancora dell'anno** per classe piu' i movimenti finiti
   dopo; le letture successive sono il riscontro (`puntoDiPartenza` in
   `base44/shared/giacenzaStoccaggi.ts`, usato da Giacenze, riconciliazione e
   riepilogo delle dichiarazioni). La Predittivita' no: chiama `ancoraDellAnno`
   dell'anno chiesto e, senza ancora, rinuncia al numero (avviso
   `ancora_mancante`) invece di ripiegare sull'ultima lettura. E' voluto: non
   va "allineata" a puntoDiPartenza.
3. **Rete, ACI ed extra raccolta non si mescolano mai**: giacenze, dichiarazioni,
   totali, KPI. La rilevazione di uno stoccaggio si divide per classe (1-4 rete,
   9 ACI); `GiacenzaSito.giacenza_riferimento_t` e' la rete e
   `giacenza_riferimento_aci_t` l'ACI; l'extra raccolta a portale non c'e'.

Il 21/09/2026 gli "scarti" di Green Tyre (24,56 t), Gatim (14,95 t) e T-Cycle
(11,56 t) erano carichi caricati nel gestionale che la fotografia del 18/09 non
conteneva ancora: con la regola 2 si aggiungono da soli.

**Dove la regola 1 e' saltata tre volte, e come si e' chiusa.** Il 28/09/2026 una
ricognizione su tutto il gestionale ha cercato ogni confronto che usasse l'inizio
trasporto o la chiusura a portale al posto della fine. Il cuore condiviso era a
posto (`movimenti.ts`, `filtroPeriodo.ts`, `raccoltoCalculator.ts`, le giacenze, la
predittivita', la fatturazione): quello che sbagliava era **la lettura dei file
esterni**, dove il nome della colonna non e' il nostro.

- **Report settimanali.** Per un impianto o uno stoccaggio "data carico" e "data
  ingresso" sono la FINE del trasporto - "carico" e' quello che entra nel loro
  registro di carico e scarico - ma l'agente che mappa le colonne le classificava
  come inizio trasporto, e nascevano anomalie su date che nel report non esistono.
  Regola: **una tabella con una sola colonna di data ha la data del movimento**,
  in qualunque casella sia arrivata (`riparaColonneData`, `riparaDateRighe` in
  `base44/shared/reportSettimanali.ts`). A decidere e' la **colonna**, non le
  righe: con due colonne vere e la casella dell'arrivo vuota, guardare le righe
  faceva diventare la partenza la data del movimento. Al riconfronto le colonne si
  leggono dalla lettura salvata (`colonneDateDellaLettura`), e quando una data si
  legge diversamente si scrive (`nota_date` dell'esito, mostrata nella scheda e
  nell'Excel).
- **Prefattura Ecotyre.** La colonna della data si cercava con `/data|trasporto/` e
  vinceva la prima da sinistra: una "Data chiusura" aggiunta dal portale avrebbe
  fatto rifiutare la prefattura giusta («e' la prefattura di Agosto», sul file di
  luglio). Ora si cerca la fine trasporto e si escludono chiusura, immissione, inizio,
  partenza, emissione, documento, fattura e scadenza (`INTESTAZIONI` in
  `base44/shared/prefattura.ts`): nemmeno una "Data documento" o una "Data
  fattura" puo' vincere, il controllo c'e' gia'.
- **Campi `mese`, `anno`, `settimane` dei record.** Li scrive `getDataRiferimento`:
  `dataPeriodo` per i movimenti, `ordine_immesso_il` per gli **Assegnati**, che non
  hanno un trasporto ma una data di immissione. E
  **non si rileggono mai** per decidere un periodo: si ricalcolano. L'unico punto
  che preferiva il campo memorizzato (`mese_immissione` in `pivotCalculator.ts`) e'
  stato tolto.

### Il periodo di un movimento e' la fine del trasporto

A quale giorno, settimana, mese e anno appartiene un movimento lo decide
**`trasporto_finito_il`**, mai `ordine_chiuso_il` e mai i campi `mese`, `anno` o
`settimane` memorizzati sul record. Il portale chiude l'ordine giorni dopo la
fine del trasporto, e i due non cadono nello stesso mese: contato sul 2026,
96 primarie di rete su 2.827 (272,65 t), 2 ACI su 44, una secondaria e 65
terziarie su 99 (2.198,64 t).

La regola vive in **due punti, che devono restare d'accordo** (verificato il
08/10/2026):

- **chi legge** la chiede a `base44/shared/movimenti.ts` (`giornoMovimento`,
  `periodoMovimento`, sul giorno italiano; specchio in `src/lib/movimenti.js`):
  vedi "Come si legge un movimento";
- **chi scrive** passa da `dataPeriodo` di `base44/shared/dataEnrichment.ts`, che
  nessuno importa per nome ma che e' chiamata la' dentro da `getDataRiferimento`
  dentro `enrichRecord`/`enrichRecords`: e' il codice che riempie i campi `mese`,
  `settimane` e `anno` sul record a ogni importazione (`importaBlocco` per le
  primarie, `importEcotyreFile` per secondarie e terziarie).

Percio' **se la regola cambia si cambiano tutti e due**: toccando solo
`movimenti.ts` l'importazione continuerebbe a scrivere i periodi con la regola
vecchia, e i due punti si separerebbero in silenzio. I campi memorizzati, dal
loro lato, non decidono niente: possono venire da importazioni vecchie, quando la
data di riferimento era la chiusura, quindi non ci si fida e si ricalcola.

Non ci sono eccezioni, nemmeno per le giacenze. Il portale aggiorna il suo saldo
quando chiude l'ordine, giorni dopo il trasporto, ma quella e' una sua abitudine
amministrativa: la giacenza vera di un piazzale cambia quando il camion arriva o
parte, non quando qualcuno chiude una pratica. Regola della direzione,
19/09/2026: vale la fine del trasporto per la fatturazione, per le registrazioni
e per le giacenze, in tutto.

`ordine_chiuso_il` non decide niente, **nemmeno i tempi di evasione** (regola
dell'utente del 21/09/2026, "mai, dico mai"): nr_giorni, raccolta_nei_tempi e
gli SLA si misurano dall'immissione alla fine del trasporto con `tempiRaccolta()`
di `base44/shared/movimenti.ts`. La chiusura si puo' solo mostrare.

**E da dove parte, allora, un numero?** Questa domanda e' il punto in cui la
regola si perde, perche' scritta come divieto non la risponde, e chi la
riderivasse tornerebbe a guardare il portale. La forma positiva, decisa dalla
direzione il 24/09/2026:

> La giacenza di un piazzale e' una **somma algebrica**: l'ancora dell'anno - la
> giacenza dichiarata al 31/12 precedente, o la prima lettura dell'anno - piu'
> **tutti i movimenti con fine trasporto successiva**, classe per classe e canale
> per canale. **La lettura del portale e' un riscontro, non la fonte del numero.**

Quando una lettura si scosta, lo scarto si spiega - e li' `ordine_chiuso_il` si
puo' nominare, perche' il portale chiude gli ordini qualche giorno dopo - ma il
numero mostrato resta quello dei nostri movimenti. Cosi' ogni caricamento
riallinea tutto da solo, che e' la seconda regola assoluta. Vale lo stesso
ovunque ci sia una fotografia esterna da confrontare: la fotografia dice che cosa
sapeva chi l'ha scattata, non che cosa e' successo.

**Uno scarto spiegato dagli ISTANTI non e' uno scarto da inseguire**
(08-09/10/2026, `spiegazione: 'tempi'` in `shared/giacenzaStoccaggi.ts`). NAPPI
SUD, lettura del 05/10: otto carichi arrivati quel giorno che il portale ha
chiuso il giorno dopo fanno lo scarto **esatto** (9.580 kg di P, 11.480 di M).
Nessuno dei otto, da solo, lo faceva, e la rilevazione restava «da controllare»
per sempre: si guarda la **somma** per classe e per verso, e solo se torna al
chilo. I carichi sono giusti e la lettura e' giusta - il piazzale e' stato letto
prima che scaricassero - quindi **l'anomalia non si alza, l'ancora conferma la
lettura (`solo_tempi`) e la spiegazione resta scritta**. Le tre voci devono dire
la stessa cosa: il 09/10 l'avviso in cima taceva mentre la scheda Stoccaggi
scriveva «non torna nemmeno con l'ancora», ed e' il difetto che si continua a
pagare. Diverso e' lo scarto spiegato da un **peso che torna esatto**: quasi
sempre e' un formulario finito nella classe sbagliata (NAPPI SUD 16/09, P +6.160
e M -6.160), e li' c'e' qualcosa da correggere - l'anomalia **resta**.

**LA CHIUSURA D'ANNO (scheda Giacenze > Chiusura anno,
`shared/chiusuraAnno.ts`).** La fotografia del 31/12 e' il punto da cui
ripartono le giacenze dell'anno dopo: si legge a portale il saldo per classe di
ogni piazzale, lo si corregge con i movimenti di dicembre che il portale non
aveva ancora chiuso, e si salva. **Diventa l'ancora dell'anno dopo alla prima
lettura di quell'anno** (`puntoDiPartenza` prende l'ancora dell'anno dell'ultima
lettura; verificato l'11/10/2026): dal 1° gennaio fino a quella lettura la
giacenza dell'anno in corso parte ancora dall'ancora dell'anno prima portata
avanti, e la rilevazione del 31/12 e' un riscontro. Farla valere subito
cambierebbe i numeri di gennaio dei due moduli: e' una decisione da chiedere
all'utente, non una correzione da fare da se' (vedi «Giacenze e Dichiarazioni»,
punto 14). Due regole, dal 09/10/2026 (il giorno in cui l'utente ha chiesto che
al 31/12/2026 «tutto fili come un orologio»):

- **Entra solo chi ha fatto qualcosa nell'anno che si chiude** (10/10/2026,
  `sitiDellaChiusura`): un movimento, una rilevazione o una riga di
  GiacenzaSito dell'anno; oppure, fermo, un piazzale che all'ultima rilevazione
  aveva ancora PFU. Gli archivi tengono anche il 2023-2025 e i movimenti si
  prendevano «fino al 31/12» senza un inizio: la chiusura del 2026 chiedeva la
  lettura a Ecorecuperi, Rpn, New Deal, Corgom, A.L.F., MAJESTIQUE e AKCANSA,
  nessuno con un movimento SMOCO nel 2026, e un piazzale senza lettura blocca il
  salvataggio. INNOREC resta: niente contratto, ma terziarie nel 2026. I
  movimenti vecchi restano al saldo atteso, che parte dall'ultima rilevazione.

- **La rettifica di dicembre la decide il gestionale, non si chiede di
  confermarla.** Nell'elenco di dicembre ci finisce **solo** chi il portale non
  aveva ancora chiuso alla fotografia (`elencoDicembre` scarta chi ha
  `chiuso_il <= foto`): se il portale non l'aveva chiuso, nel saldo di quel
  giorno non c'e', e va rettificato. Chiedere conferma voce per voce era chiedere
  all'utente di ripetere quello che il portale ha gia' detto, e intanto la
  fotografia restava bloccata - sulla chiusura 2025, quattro movimenti di Nappi
  Sud chiusi tutti il 07/01/2026. La rettifica si applica, la riga dice
  «decisa dal gestionale» con il motivo, e l'ultima parola resta all'utente
  («gia' nella lettura», o la classe in cui il portale l'ha messo). Una decisione
  che non si riconosce blocca ancora: non si tira a indovinare.
- **In cima alla pagina sale solo quello che chiede qualcosa.** Terziarie
  (una classe non ce l'hanno), movimenti di un impianto (del portale si sa il
  totale, non la ripartizione per classe) ed extra raccolta (a portale non c'e')
  **non possono cambiare** la fotografia dei piazzali: si elencano nella scheda,
  accanto alle righe che raccontano, e non diventano un avviso. Erano tre
  riquadri ambra ripetuti identici piu' sotto, e sulla chiusura 2025 erano 40
  voci su 44: un avviso che non si puo' chiudere insegna a non guardare gli
  avvisi. Gli avvisi portano un `livello` (`attenzione` o `informazione`).

Per il 2025 manca l'anno prima: niente ancora del 31/12/2024 e niente movimenti
2024, quindi i piazzali non hanno un punto di partenza e l'attesa non si calcola.
Non e' un difetto, e si dice: dal 2026 l'ancora c'e' (la fotografia del
31/12/2025) e il confronto torna intero.

**Senza un filtro di stato si contano i terminati** (alta A37, 12/10/2026). La
regola vale per le secondarie (`computeSecondarieMatrix`), per i Terminati ACI
e, da quel giorno, per le Terziarie: indicatori e uscite per impianto contano i
terminati con fine trasporto. Con un filtro sugli stati si contano gli stati
scelti. L'elenco li mostra tutti e dice quanti non entrano nei conti. Nel file
TERZIARIE del 26/09 c'erano 17 righe «assegnato» senza peso; nell'archivio
dell'11/10 le 427 terziarie sono tutte terminate. Prova: `prove/terziarieStati.mjs`.

### Il guardiano notturno e la memoria dei numeri (10/10/2026)

Ogni notte alle 5 (`base44/workflows/GuardianoNotturno.jsonc`) la quadratura di
impianti e stoccaggi della rete si rifa' da se' e lascia scritta una riga: l'entita'
`IndicatoreGiorno`, **una per giorno**. Serve a due cose, e tutt'e due contano.

- **Il guardiano.** Se un impianto si scosta dal portale lo si trova la mattina
  in cima all'elenco delle cose da gestire, col nome e il numero - «T-CYCLE
  INDUSTRIES SRL +1,20 t» - senza aprire nessuna pagina. Prima lo scopriva
  l'utente aprendo un modulo, o non lo scopriva nessuno.
- **La memoria.** Il gestionale sa rispondere a «come siamo adesso» e non sa
  rispondere a «com'era a giugno»: ogni numero si ricalcola sul presente e non
  resta niente. Dentro la stessa riga restano i numeri del giorno, per sito e
  per canale. **Il valore di questa cosa e' il tempo che accumula**: si comincia
  a scrivere molto prima di quando servira' leggere.

La regola sta in `base44/shared/indicatoriGiorno.ts` (prove in
`prove/guardianoNotturno.mjs`); a scrivere e' `riepilogoDichiarazioni` con
`registra: true`, perche' la quadratura la calcola gia' lui e **un terzo posto
che la rifa' darebbe una terza risposta**. Otto prudenze:

1. **Una riga per giorno, non una per apertura di pagina**: scrive solo con
   `registra`, e lo stesso giorno si riscrive invece di aggiungersi.
2. **Nessun anno cablato nello scheduler.** Il workflow non passa l'anno: con
   `registra` vale quello corrente. Un anno scritto in uno scheduler e' la
   trappola che scatta il 1° gennaio, quando il guardiano continua a
   controllare l'anno vecchio senza dirlo.
3. **Si guarda chi ha un confronto col portale sulla rete: gli impianti e gli
   stoccaggi della rete** (12/10/2026). Fino all'11/10 qui entravano i soli
   impianti. La pagina Dichiarazioni e la dashboard dicevano 6 su 6 (con Nappi
   Sud) e il guardiano 5: uno stoccaggio della rete che non quadrava lo diceva
   la sezione Impianti e «Da gestire» no. Ora le righe sono quelle della pagina.
   Il canale di una riga di stoccaggio sta in fondo alla chiave
   («nappi sud|RETE»): `canaleDellaVoce`, la stessa regola di `canaleDelSito`.
   L'ACI degli stoccaggi non entra nel conto della rete. **Dal 13/10/2026
   (decisioni dell'utente, gruppo B) uno stoccaggio ACI con un confronto a
   portale (oggi Nappi Sud, classe 9) che non quadra fa «da guardare»** e
   aggiunge alla nota una frase sua, dopo quella della rete: «Uno stoccaggio ACI
   (classe 9) si scosta dal portale: NAPPI SUD SRL +3,00 t» (`scostamentiAci`,
   `notaAci` in `indicatoriGiorno.ts`: stessa regola e tolleranza, canale
   'ACI'). `scostamenti_json` resta della sola rete. Sui dati veri dell'11/10/2026
   Nappi Sud ACI fa 0,00 t a portale e 0,00 t calcolate: nessuna voce. Chi non ha fotografia (Tecnogum) non si scosta da niente. Lo
   scostamento di uno stoccaggio porta `stoccaggio: true`. La nota e la voce
   «giacenze:scostamenti» dicono chi si scosta (`chiSiScosta`): «Uno stoccaggio
   non quadra col portale», «Un impianto e uno stoccaggio non quadrano». Anche
   le descrizioni di `IndicatoreGiorno` e del workflow dicono «impianti e
   stoccaggi della rete» (revisione del 13/10/2026). Prove in
   `prove/guardianoNotturno.mjs`.
4. **Un guardiano che dorme e uno che non trova niente si assomigliano troppo**:
   se la fotografia piu' recente ha piu' di due giorni la dashboard lo dice.
5. **Scrive solo l'amministratore, e solo l'anno in corso** (11/10/2026). Il
   lavoro notturno gira come l'amministratore, come il controllo delle qualifiche
   e gli avvisi dei target; un altro utente che passa `registra` riceve la
   risposta con `fotografia.scritta: false` e il motivo. Con un anno diverso da
   quello in corso la riga di oggi non si riscrive: avrebbe detto «com'era oggi»
   coi numeri di un altro anno. Provato sulla funzione vera in
   `prove/scrittureRiservate.mjs`.
6. **Non si fotografa un archivio a meta'** (11/10/2026): con un caricamento in
   corso, interrotto o non riuscito di un archivio che legge (movimenti,
   fotografia del portale, report delle dichiarazioni: `TIPI_GIACENZE`),
   `registra` risponde 409 «rinviato» e la risposta dice perche'
   (`fotografia: { scritta: false, rinviata: true, motivo }`). La riga di oggi
   manca; la dashboard dice il caricamento da ripetere e, dopo due giorni, che
   il controllo non gira. La descrizione del workflow `GuardianoNotturno` lo
   dice. Vedi «I conti che si salvano non si salvano su un archivio a meta'».
7. **Dopo la fotografia, le identita' fra moduli** (11/10/2026): il passo
   `controlla_invarianti` del workflow chiama `controllaInvarianti`, che scrive
   `invarianti_json` nella stessa riga. La fotografia non tocca quel campo, e
   `controllaInvarianti` non crea una riga se il guardiano non l'ha scritta.
   Vedi la sezione che segue.
8. **I mesi ancora aperti** (12/10/2026). Per ogni impianto e canale la riga
   scrive `canali[c].mesi_aperti = [{ mese, provenienza (solo ACI),
   da_dichiarare_t }]`, dal piu' vecchio, con «dall'anno prima» in testa. E' il
   «Da dichiarare» mese per mese della pagina, gia' calcolato (`mesiAperti`); la
   somma e' la colonna. Un canale senza i dodici mesi non scrive il campo: per la
   chiusura del mese (`passoDichiarazioni`) il campo assente vuol dire «non so»,
   l'elenco vuoto vuol dire «niente da dichiarare». Senza questo campo la
   chiusura dava un rosso falso su ACI ed extra per tutto il mese dopo un
   arrivo. La riga cresce: sui dati veri dell'11/10 `siti_json` passa da 2.934
   a 3.686 caratteri. Si scrivono solo i mesi con qualcosa da dichiarare.

### Il battito dei lavori e le identita' fra moduli (11/10/2026)

Due presidi accanto al guardiano, dalle migliorie chieste dall'utente
l'11/10/2026. Il codice sta in `base44/shared/battito.ts`,
`base44/shared/invarianti.ts` e `base44/shared/presidi.ts`. Le prove sono
`prove/battitoLavori.mjs`, `prove/identitaFraModuli.mjs` e
`prove/presidiNotturni.mjs`.

**Il battito.** Undici lavori girano da soli, e fino a questo giorno solo il
guardiano lasciava una traccia con la data. Un lavoro che comincia a rispondere
500 (i 503 del 09/10, il limite di richieste) non lo vedeva nessuno. Ora ogni
funzione chiamata da un workflow mette attorno al suo corpo l'involucro
`conBattito`, che lascia una riga `EsecuzioneLavoro` per lavoro. La riga si
riscrive e non cresce: ultima partenza, esito, ultima riuscita, fallimenti di
fila, sintesi ed errore. In fondo al file la forma e' sempre questa:

```ts
async function lavoro(req) { /* il corpo di prima */ }
export default async function(req) {
  return conBattito(() => conLimiteRichieste(createClientFromRequest(req)), 'nomeFunzione', () => lavoro(req), req);
}
```

- **Chi aggiunge un workflow aggiunge il lavoro a `LAVORI`**, con il cron del
  workflow, il titolo, il link e `senza` (che cosa non succede finche' non
  riparte). `prove/battitoLavori.mjs` fallisce in tre casi: un `function_name`
  di `base44/workflows` che non e' in `LAVORI`, un cron diverso, una funzione che
  non usa l'involucro col suo nome.
- **Un rinvio non scrive niente, nemmeno il battito**: e' la regola dei conti che
  si salvano. Un lavoro rinviato per giorni si vede lo stesso, perche' l'ultima
  riuscita invecchia; il caricamento da ripetere la dashboard lo dice gia'.
- **Le funzioni che servono anche alle pagine** dicono quando la chiamata e' il
  lavoro (`eIlLavoro`). Il guardiano e' `riepilogoDichiarazioni` con `registra`
  e senza anno; i target sono `checkTargetAlerts` senza `crea_alerts: false`.
  Il corpo si legge da una copia della richiesta e la risposta da una copia
  della risposta, quindi ne' il lavoro ne' chi lo chiama vedono differenze. Un
  errore lanciato si registra e risale com'e'.
- Il battito lo scrive solo l'amministratore. Un battito che non si scrive non
  ferma il lavoro.

**Nella dashboard (`vociPresidi`), nessuna voce se non c'e' niente.** Un
esempio di voce: «Il controllo delle qualifiche non riesce da 2 giorni
lavorativi», con l'ultimo errore e l'ultima riuscita. La voce compare solo
quando sono passati `soglia` giri previsti dal cron senza una riuscita:

- due per i lavori di ogni giorno e dei feriali, sei per quelli di ogni ora,
  uno per il controllo del mese;
- contati dopo un margine di 90 minuti, 30 per i lavori orari.

Si conta nell'unita' del suo orario: un venerdi' e un lunedi' falliti sono due
giorni lavorativi, non quattro giorni. Altri casi:

- un lavoro senza nessuna riga non si giudica: il giorno della pubblicazione
  sono tutti senza riga;
- **un lavoro che non e' mai riuscito conta anche il primo giro fallito**
  (revisione delle migliorie, 11/10/2026). `registraBattito` scrive
  `prima_partenza` quando crea la riga e non la riscrive piu'; `statoLavoro`
  conta da li' meno il margine, quel giro compreso. Contando dalla nascita della
  riga il controllo normativo che fallisce al primo giro col battito, il
  01/11/2026, avrebbe taciuto un mese;
- un passo che viene dopo un altro non si dice se il primo non e' riuscito: una
  causa, una voce;
- il motore degli alert parte a evento, e si dice solo se l'ultimo giro e'
  fallito.

**Le identita' fra moduli.** E' il metodo dell'audit del 10/10, fatto ogni
notte: lo stesso numero chiesto ai moduli che lo devono dire uguale. Il catalogo
e' in `invarianti.ts`:

- (a) la giacenza di Giacenze e' quella di Dichiarazioni, per impianto e
  piazzale, canale per canale (le coppie di `confrontaTutto`). Un piazzale che
  uno dei due moduli non elenca non e' uno zero: con una giacenza dall'altra
  parte il caso resta col numero che manca («Dichiarazioni —», «il piazzale
  nelle Dichiarazioni non compare», e al contrario «Giacenze —»); a 0 o «—» non
  si confronta. Lo 0 vale solo per il canale che manca a un piazzale elencato.
  Il 02/01/2027 senza il 2027 preparato Nappi Sud 25,88 t si leggeva «0,00 t
  nelle Dichiarazioni»;
- (b) la somma della riga «Da dichiarare» e' la giacenza del canale;
- (c) il raccolto di rete dell'anno e' lo stesso in Dashboard, Giacenze e
  Dichiarazioni;
- (d) nessuna dichiarazione e' doppia (la dashboard ha gia' la sua voce, e qui
  non se ne fa un'altra).

Le fa girare `controllaInvarianti`, il passo del `GuardianoNotturno` dopo la
fotografia:

- i numeri li chiede alle funzioni vere con `functions.invoke` e non li
  ricalcola mai;
- con un caricamento a meta' (`TIPI_GIACENZE`) rinvia, prima e dopo;
- scrive solo l'amministratore, nella riga di oggi (`invarianti_json`).

Un'identita' rotta diventa una voce rossa coi due numeri e i due moduli
(«Giacenze 275,08 t, Dichiarazioni 154,22 t»). Una che non si e' potuta
verificare non e' rotta: in quel caso risulta non riuscito il battito del
controllo. **Ma una rotta all'ultima verifica resta rotta finche' una verifica
non la trova a posto** (`riportaRotte`, revisione delle migliorie,
11-12/10/2026): quando una fonte non risponde, `controllaInvarianti` rilegge le
fotografie dello stesso anno (un mese), compreso l'esito gia' scritto oggi se il
suo istante (`il`) viene prima, e tiene numeri, dettaglio e giorno di quella
verifica (`rotta_il`); la dashboard la dice ancora rossa, «(non riverificata
stanotte)» o «(non riverificata oggi alle 11:00)». Se il controllo di oggi si
ferma prima di scrivere (un 500, un tempo scaduto, un rinvio),
`cruscottoOperativo` legge le ultime due fotografie (`list('-giorno', 2)`,
sempre una richiesta sola) e dice le identita' della riga prima, «Controllo del
<giorno>»: si guarda una riga sola indietro, perche' dalla seconda notte parla
il battito del controllo.

**A video niente identificativi del catalogo ne' nomi di funzioni.** Il motivo
di una voce non verificata nomina il modulo (`FONTI[f].nonRisponde`: «le
Giacenze non hanno risposto»), e l'errore del battito dice le voci col loro nome
breve (`breve`, `motiviNonVerificate`). Una voce nuova del catalogo ha il suo
`breve` e una fonte nuova il suo `nonRisponde`: `prove/identitaFraModuli.mjs`
lo controlla.

**Una voce entra nel catalogo solo dopo averla vista tornare sui dati veri, con
la sua tolleranza scritta.**

- Per (a) e (b) la tolleranza e' il centesimo (`TOLLERANZA_CENTESIMO_T`): due e
  tre decimali danno meno di 0,006 t di scarto.
- Per (c) e' un centesimo piu' mezzo centesimo per riga delle Giacenze, che
  sommano righe gia' arrotondate.

Ogni voce ha il suo guasto in `prove/identitaFraModuli.mjs`: il difetto viene
rimesso nel codice mentre si impacchetta, e si deve rompere quella voce e
nessun'altra. La prova gira sui numeri veri di Irigom dell'11/10/2026: apertura
385,36 t, 1.729 t del 2025 agganciate dal report, giacenza 652,84 t. Rimette la
regressione di quel giorno, la riga torna a 0, e la voce (b) la trova. E' la
lezione di quel giorno: un invariante provato solo su archivi costruiti non
basta.

**Fuori, per ora: attiva = ricavi del margine e passiva = costi del margine.** Il
margine non ha regole sue, quindi contro il calcolo della passiva il confronto
e' vero per costruzione. Avrebbe senso solo contro le fotografie salvate
(documenti elaborati, passiva congelata), che dopo un caricamento cambiano per
ragioni legittime. In piu', una quarta lettura di tutti i movimenti nella stessa
notte pesa sui tempi e sul limite di richieste. Per farla bene ci vuole un passo
a parte (`{ voci: [...] }`) che confronti solo i mesi la cui fotografia e' piu'
recente dell'ultimo caricamento riuscito dei tipi che legge.

**Le identita' al cambio d'anno (15/10/2026).** Un impianto con una giacenza
(non 0, non «—») che un modulo solo elenca e' un caso, dalle due parti, come il
piazzale (difetto 12: il 05/01/2027, senza la copia d'anno, le Giacenze avevano
cinque impianti con una giacenza e le Dichiarazioni nessuno). A gennaio e
febbraio il controllo guarda anche l'anno prima con le stesse fonti
(`anniDaControllare`, `unisciAnni` in `invarianti.ts`, difetto 27): una riga
sola per giorno, e ogni caso col suo anno («2026: Irigom S.r.l., ACI: ...»).
Prima dal 1° gennaio il 2026, che si sta ancora chiudendo, non lo guardava
nessuno. Prove: `prove/identitaFraModuli.mjs`, `prove/guardianoNotturno.mjs`.

### Nessun anno scritto nelle pagine (11/10/2026)

Gli anni e il mese da cui parte una pagina vengono dal giorno italiano,
`src/lib/periodoPagine.js`: `anniDaScegliere({ dal, dopo })` per gli elenchi,
`annoDiOggi` per l'anno su cui si apre, `meseDiLavoro()` per il mese (l'ultimo
finito: a gennaio e' il dicembre dell'anno prima). Prima Dichiarazioni aveva
`[2026, 2025]`, la fatturazione si apriva su «Luglio 2026» e passiva, attiva,
margine ed extra raccolta avevano `[2024, 2025, 2026]`: dal 1° gennaio 2027 il
2027 non si sarebbe potuto scegliere. `prove/anniDellePagine.mjs` scorre
`src/pages` e `src/components` e fallisce su un `useState(2026)` o un elenco di
anni scritto a mano.

**Gli anni si contano quando la pagina si disegna, non quando il modulo si
carica** (prova generale del cambio d'anno, 15/10/2026, difetto 35). Gli elenchi
degli anni si calcolano dentro il componente (`useMemo` su `oggiRoma()`), mai in
una costante fuori. Le pagine restano in memoria finche' la scheda non si
ricarica: una lista calcolata quando il modulo si carica, il 31/12, il 04/01
non offre l'anno nuovo. Erano cosi' Dichiarazioni Impianti, Extra Raccolta,
Fatturazione passiva e attiva, Margine e, chiusa a fine giro, la scheda Zone dei
raccoglitori di Target & Status. `prove/anniDellePagine.mjs` monta le pagine
vere col modulo caricato il 31/12 e montato il 04/01, e fallisce su una
costante del modulo calcolata con `annoDiOggi`, `anniDaScegliere`,
`meseDiLavoro` o `oggiRoma`. I file dell'Extra Raccolta con l'anno su «Tutti»
prendono l'anno dei movimenti (`annoDelDocumento`, difetto 20: dicembre fatto a
febbraio usciva «Dicembre 2027»): con lo stesso mese in due anni la pagina
chiede l'anno, e senza mese il documento dice «Tutti gli anni».

La tolleranza e' quella della quadratura (`TOLLERANZA_QUADRATURA_T`), una sola
per tutto il gestionale, e le tonnellate si scrivono con `formatoTonnellate`:
un secondo formato qui dentro scriveva «1,200 t» dove tutto il resto dice
«1,20 t», e l'ha trovato una prova.

Un assegnato non e' un movimento: il suo periodo e' `ordine_immesso_il`.

### Il cambio d'anno: la prova generale del 15/10/2026

Il passaggio dal 2026 al 2027 e' stato fatto prima che succeda davvero. Cinque
simulazioni sui dati veri (la copia dell'11/10/2026, piu' un dicembre 2026 e un
gennaio-febbraio 2027 costruiti apposta: ritiri, secondarie, dichiarazioni,
letture del portale, contratto e target 2027, tariffe 2027 presenti o assenti),
con l'orologio fermo nei giorni che contano: 28/12/2026, 31/12/2026 alle 23:30,
01/01/2027 alle 00:30, 02/01, 05/01, 15/01 e 10/02/2027. Piu' di ottanta
scenari in cinque aree (movimenti e pagine; Giacenze e Dichiarazioni; tariffe e
soldi; target, contratti e alert; EcoTyna e i controlli di tutti i giorni).
Ogni difetto e' stato riprodotto con uno script, e un secondo controllo,
indipendente, ha provato a smentirlo: quattro segnalazioni sono cadute.
**37 difetti confermati: 8 gravi, 19 medi, 10 piccoli.** Uno era rotto gia'
quel giorno: il foglio Richieste ECT del 09/10/2026 non si caricava (10).

Il piano e' stato approvato dall'utente il 14/10/2026 («per me ok sulle cose da
sistemare ... procedi pure») e il 15/10/2026 («procedi»). Le correzioni sono
state fatte in sei gruppi, ognuno sui suoi file, ognuna con la sua prova in
`prove/` che fallisce col codice di prima; ogni gruppo ha avuto una revisione
avversaria e un ritocco. Dove sta adesso ogni regola:

- **Richieste ECT, To-Do e Da gestire** (2, 3, 10, 34, 37): «Le richieste ECT:
  il foglio del 09/10/2026 e il cambio d'anno», «La to-do list: i completati
  nella loro sezione», «La dashboard».
- **Giacenze e Dichiarazioni: la chiusura dell'anno e le aperture 2027** (4, 5,
  6, 11, 12, 27, 29, 31): «LA CHIUSURA DEL 31/12/2026 E LE APERTURE DEL 2027»
  in «Decisioni della direzione del 20/09/2026», e «Il battito dei lavori e le
  identita' fra moduli».
- **Tariffe e lista del nuovo anno** (7, 15, 21, 32): «Quando una tariffa vale»
  e «L'ANNO NUOVO VA PREPARATO».
- **Passiva, consuntivi, margine ed Extra Raccolta** (16, 17, 18, 19, 20, 35):
  «La passiva, il congelamento e i consuntivi», «Il margine», «Il foglio della
  passiva dell'amministrazione», «Nessun anno scritto nelle pagine».
- **Target, contratto, alert e qualifica** (1, 22, 23, 24, 25, 26, 33): «La
  dashboard», «Il target del contratto e l'atteso alla data», «Le variazioni del
  contratto in corso d'anno», «Il motore degli alert al cambio d'anno», «La
  qualifica dei fornitori».
- **Settimane, EcoTyna e orologi** (8, 13, 14, 28, 30, 36, e la parte di EcoTyna
  del 2 e del 15): «Come si legge un movimento», «EcoTyna: il modulo giusto per
  ogni domanda sulla commessa», «Le dichiarazioni e il mese di competenza», «I
  quattro controlli», «Regole tecniche della piattaforma e delle pagine».

**Le decisioni dell'utente del 15/10/2026** («ok per i tuoi consigli sulle prime
4, tanto poi entro la fine dell'anno avremo i contratti e decideremo i prezzi;
riguardo alla risposta 5 avremo i prezzi concordati entro fine anno quindi non
ci sarà il problema, in ogni caso va bene il tuo consiglio»). Ognuna e' scritta
nel commento del codice che la applica, con la data:

- **D1, la settimana 53.** La 53 del 2026 e' intera, dal 28/12/2026 al
  03/01/2027, in tutte le Verifiche, come nelle Secondarie e nel riepilogo
  della settimana. Se la stampa WINSINFO della 53 si fermera' al 31/12, i
  formulari dell'1, del 2 e del 3 gennaio usciranno «registrati, assenti nel
  report», e si vedra' subito.
- **D2, l'ACI degli impianti al 31/12.** A portale l'ACI degli impianti non
  c'e': la chiusura dell'anno propone la giacenza che il gestionale calcola al
  31/12 (apertura + arrivi - dichiarato), con accanto quella della lettera di
  Ecotyre e lo scarto, e la salva l'amministratore quando l'ha vista.
- **D3, Tecnogum nel 2027.** Continua a non dichiarare la rete: dal 1° gennaio
  si porta avanti dal 2026 «non dichiara la rete», segnato «da confermare sul
  contratto 2027», senza aspettare la copia d'anno (`sitiDellAnno`). Le
  1.833,43 t a portale sono carichi del 2026 che nessuno dichiarera' a SMOCO.
- **D4, le tariffe copiate e non confermate.** Una riga di un documento del mese
  prezzata con una tariffa copiata dall'anno prima e non confermata ferma il
  documento come una riga senza prezzo. La conferma e' in Target & Status ›
  Nuovo anno. Un prezzo vecchio che passa per nuovo e' peggio di un prezzo che
  manca.
- **D5, il foglio della passiva per l'amministrazione.** Una riga senza la
  tariffa dell'anno resta «—» (prezzo e totale null; il totale del foglio lo
  dice e non la conta come zero) finche' la tariffa dell'anno non c'e', come
  nella fatturazione passiva; la nota dice l'anno del prezzo quando c'e'.

**Il difetto 9 non e' di questo giro.** Le ore del file del portale sono
italiane (lo dicono le pause pranzo, uguali d'inverno e d'estate) e si salvano
come ore UTC, a cui poi si aggiunge di nuovo l'ora italiana: un ordine immesso
«31/12/2026 23:30» finisce in gennaio 2027, e sui dati veri 19 ordini di rete
hanno l'immissione al giorno dopo (ET26020377, 31/01/2026 23:55, passa a
febbraio). Oggi le fini trasporto arrivano senza ora, quindi raccolto e periodi
non cambiano. Cambia il modo in cui si salvano le ore e le finestre di lettura
di piu' moduli: va fatto in un giro a se'.

**La chiusura del giro** ha portato la regola nuova dove i gruppi non potevano
arrivare, ognuna con la sua prova (`prove/cambioAnnoRitocchi.mjs`, piu'
`prove/anniDellePagine.mjs` e la sezione 7 di
`prove/passivaAmministrazioneRicalcolo.mjs`): la pagina della qualifica e il
presidio con `oggi`; il contesto di EcoTyna senza ritiri del 2027; PDF,
presentazione ed Excel dell'Andamento coi target copiati; il dettaglio
dell'attiva «da confermare»; l'anno del prezzo delle voci nello storico; la
nota dell'economia nel PDF del quadro; le richieste completate dell'anno prima;
la scheda dell'impianto e il riepilogo delle Dichiarazioni senza apertura; i
siti portati dall'anno prima a video; la scheda Siti che non scrive zeri; il
PDF della passiva per l'amministrazione coi «—»; la scheda Zone dei
raccoglitori. Quattro prove hanno cambiato i loro dati perche' la regola e'
cambiata apposta: una rete senza data di fine non si salva piu'
(`prove/anagraficheDoppioni.mjs`, `prove/storicoModifiche.mjs`), la chiusura
legge anche i due file delle proposte (`prove/rinvioCaricamenti.mjs`), un'ACI
mai scritta su una riga della chiusura e' «—» (`prove/velocitaGiacenze.mjs`).
E `prove/provaDel2Gennaio.mjs` cerca nel sorgente la condizione nuova della
scheda dell'impianto, che mostra anche un canale senza apertura.

**Il commit.** Le modifiche dei gruppi dipendono l'una dall'altra: le
esportazioni nuove di `ecotyreTariffe.ts` (`rigaConTariffaDaConfermare`,
`annoDellaCopia`, `tariffaDaConfermare`) e il segno `tariffa_da_confermare` di
`passivaCalcolo.ts` servono a `consuntivoFornitore.ts`, a
`passivaAmministrazione.js` e al margine. Il giro si committa intero, mai a
pezzi.

**Che cosa resta aperto.**
- L'origine dell'ID di una richiesta ECT: un ID del foglio scritto male che
  coincide con un altro ordine vero, una volta preso, vale come scritto a mano.
  Serve un campo nello schema `RichiestaEct` che dica da dove viene
  `id_ordine_manuale`; intanto la risposta e la pagina lo segnalano
  (`id_diversi_dal_foglio`).
- La chiusura del mese e la dashboard contano gia' il minimo da dichiarare di
  un canale senza apertura (`resta_almeno`), ma non lo dicono «almeno X t», e un
  minimo zero va fra i «niente da dichiarare».
- Da gennaio fino alla chiusura salvata, per un impianto senza apertura le
  Giacenze dicono la rete a portale e la riga «Da dichiarare» delle
  Dichiarazioni dice «—»: il guardiano notturno confronta portale con portale e
  tace, `prove/datiVeri.mjs` su una copia di quei giorni no (5 impianti).
- Il blocco dell'extra raccolta del foglio dell'amministrazione
  (`extraRaccoltaAmministrazione.js`) non legge ancora le tratte delle
  secondarie con la tariffa copiata (D4).
- Quello che la prova non ha potuto provare: la stampa WINSINFO vera della 53;
  le pagine montate una per una all'orologio fermo (Assegnati, Terminati, PDR,
  Secondarie, Terziarie, Report); la pratica Irigom di dicembre col registro
  vero; come il portale scrive un carico finito dopo la mezzanotte del 31/12; il
  programma delle secondarie dal 04 al 10/01/2027; un piazzale del 2026 che
  cambia numero dopo la prima lettura del 2027 (visto una volta). E il
  01/01/2028: al 12/10/2026 c'erano 30 ordini di febbraio 2026 ancora aperti,
  fuori dall'export «dal 1° gennaio dell'anno scorso».

### Il dichiarato e' di chi tratta, non di chi stocca (10/10/2026)

Una dichiarazione di trattamento e' del **soggetto**, e la mappa che la tiene
ha per chiave `soggetto|canale`: il ruolo non c'entra. Ma nelle giacenze un
soggetto che e' insieme impianto e piazzale - Gatim, Green Tyre, Irigom - ha
**due righe**, e letta senza guardare il ruolo quella mappa rispondeva a tutt'e
due. Risultato: «ACI dichiarato 115,54 t» sulla riga dello stoccaggio GATIM, che
non dichiara niente, e nel totale quelle tonnellate contate due volte - ACI
275,08 invece di 154,22, extra raccolta 1,72 invece di 0,86.

**Chi tratta dichiara; chi stocca custodisce.** Il materiale che sta a terra in un
piazzale finira' nella dichiarazione dell'impianto che lo lavorera', e li' deve
comparire. Sulla riga del piazzale il dichiarato e' `null`, non zero: zero si
leggerebbe «non ha ancora dichiarato», che e' un'attesa, e il trattino ha la sua
spiegazione (`SENZA_DICHIARATO_PIAZZALE`).

Due cose da portarsi via, piu' grandi di questo difetto.

1. **Una mappa per soggetto letta su una riga per ruolo e' una trappola.** Qui il
   calcolo della giacenza era protetto (`if (td === 'imp')`) e il campo accanto
   no: la stessa mappa, due letture, una giusta e una sbagliata. Quando una
   chiave e' piu' grossa della riga che la legge, va ristretta a ogni lettura.
2. **Un numero sbagliato accanto a uno giusto e' il piu' difficile da vedere.**
   La giacenza era esatta, quindi niente diventava negativo e nessun avviso
   scattava; il conto a occhio - apertura + entrato - dichiarato - non tornava, e
   chi guardava dava la colpa al conto invece che al numero. L'ha trovato il
   **confronto fra due moduli** che devono dire la stessa cosa (regola
   dell'utente, 03/10/2026): la fotografia del guardiano diceva 154,22 e la
   Situazione delle giacenze 275,08. Prove in `prove/dichiaratoDiChiTratta.mjs`,
   che fa girare la funzione vera e poi la rifa' girare con la protezione
   togliendola, per vedere il doppio ricomparire.

Vale la pena dirlo perche' e' il primo difetto trovato dal guardiano notturno, e
non da una pagina aperta: e' esattamente il mestiere per cui e' stato scritto.

### Una dichiarazione per mese, e un avviso non grida a zero (10/10/2026)

**LA CHIAVE DI UNA DICHIARAZIONE MENSILE**: anno + sito normalizzato + canale +
provenienza + mese. Cinque campi, e **l'operazione non c'entra** - R1 o R3 e' una
proprieta' del sito (Irigom e T-Cycle fanno R1, gli altri R3), non un modo di
distinguere due dichiarazioni dello stesso mese. La chiave non e' un'opinione:
e' quella con cui il riepilogo aggancia le righe ai mesi, cioe' quella che decide
che cosa l'utente vede. La regola sta in `shared/dichiarazioniImpianti.ts`
(`chiaveDichiarazione`, `esitoScrittura`, `doppioniDichiarazioni`,
`unisciDichiarazioni`), prove in `prove/unaDichiarazionePerMese.mjs`.

**La piattaforma non ha vincoli di unicita' ne' indici**: l'unico presidio e' il
codice. Quindi **chi scrive passa dalla regola, sempre** - il dialogo del mese, la
griglia, la pratica di Irigom, il seme - e chi scrive rilegge prima di scrivere,
perche' fidarsi di quello che la pagina aveva in mano quando l'hanno aperta e'
bastato a generare gemelle: due schede aperte, un secondo clic, un allineamento
girato nel frattempo.

**COSA FA UNA GEMELLA, e perche' era invisibile.** Fino all'11/10/2026 i due
moduli rispondevano in modo opposto: il riepilogo ne teneva una sola e quelle
tonnellate sparivano dai conti, le giacenze le sommavano e decurtavano il
doppio. Dalla chiusura dell'audit tutti e due la leggono con la stessa funzione
e tengono la prima: lo stesso numero, ma sbagliato in tutti e due se la riga
giusta e' la seconda. Le dichiarazioni caricate dopo l'ultimo file del portale
(`dichiaratoDopoLaFotografia`) invece si sommano tutte, gemelle comprese, e la
giacenza a portale le toglie tutte e due. E siccome la gemella non compare nel
riepilogo, **non e' correggibile da nessuna casella**: la volta dopo il mese
sembrava vuoto e si creava la terza riga. Il riquadro della pagina dice
esattamente questo, e `prove/pagineDichiarazioniGiacenze.mjs` lo controlla sui
conti: se cambia il conto, va cambiato anche il testo.

**Chi legge il dichiarato caricato passa da `leggiDichiarazioni`** (11/10/2026):
`leggiDichiarazioni(righe, { anno, chiaveDi })` in
`shared/dichiarazioniImpianti.ts` (con lo specchio) unisce le righe per chiave
con `unisciDichiarazioni` e conta `kgCaricatiDi`. La usano le Giacenze per il
dichiarato e la giacenza di ACI ed extra raccolta, il riepilogo per i mesi
(`perDich`) e lo strumento `dichiarazioni_impianti` di EcoTyna. Prima, con una
gemella ACI, le Giacenze dicevano 4 e le Dichiarazioni 2. Chi aggiunge un altro
lettore del dichiarato caricato (la dashboard, per esempio) passa di li'.

**L'EXTRA RACCOLTA E' L'ECCEZIONE** (utente, 10/10/2026): a portale non e' gestita,
sono campagne occasionali e nello stesso mese ce ne possono stare due, quindi
ripetersi e' legittimo. Ma allora chi legge le **deve sommare**: permettere la
seconda riga senza sommarla vorrebbe dire perderla, e un dato perso e' peggio di un
doppione perche' non lascia traccia. E **caricato vuol dire caricato**: sommare due
campagne di cui una sola e' a portale e chiamare caricato il totale farebbe
decurtare la giacenza di qualcosa che il portale non ha ancora visto, percio' i
chili caricati si tengono a parte (`caricato_kg`, `kgCaricatiDi`).

**UN DOPPIONE SI PRESENTA COME DOPPIONE.** Altrove si traveste: nel confronto col
portale la gemella non pareggia nessun caricamento e finisce fra «i mesi che il
portale non conosce», che manda a cercare un problema dove non e'. Il guardiano
notturno li cerca ogni notte (`doppioni_json` nella fotografia del giorno), la
dashboard li mette fra le cose da gestire col mese e il canale (e dice che
Giacenze e Dichiarazioni contano la prima riga e ignorano le altre), e la pagina
delle dichiarazioni li scrive sopra a tutto il resto.

**E UN AVVISO NON GRIDA AL LUPO A ZERO.** Due casi trovati lo stesso giorno:

- l'avviso dei file non rimossi veniva **riscritto a zero** da ogni pulizia che non
  trovava niente da togliere, e diceva «0 file caricati restano sulla piattaforma:
  cancellarli non si puo'» - una frase che si contraddice da sola, in cima agli
  avvisi per settimane. Una pulizia senza niente da fare non vuol dire che i file
  di prima se ne siano andati: il conto lo abbassa solo chi li ha visti andarsene.
- la voce della dashboard del guardiano copriva due cause con una frase sola, e un
  doppione senza scostamenti avrebbe scritto «**0 impianti** non quadrano col
  portale» accanto a «tutti gli impianti quadrano (2)». Due cose diverse, due voci
  diverse.

**Il presidio vale quanto la fiducia che gli si da'**: un avviso che si accende a
zero e' il modo piu' sicuro di far ignorare quelli veri, ed e' peggio di un avviso
che non c'e', perche' costa attenzione ogni giorno senza dire niente.

### Giacenze e Dichiarazioni: lo stesso numero, controllato da una prova (10/10/2026)

La regola dell'utente del 03/10/2026 - i due moduli dicono gli stessi numeri su
tutti e tre i canali - era scritta nei commenti e controllata a occhio. L'audit
del 10/10/2026 la ha misurata sui dati veri (53 confronti su 54 uguali al
centesimo) e ha trovato quattro modi in cui si rompeva senza che nessuna prova
se ne accorgesse. Da oggi c'e' `prove/dueModuliStessiNumeri.mjs`, che fa
**girare le due funzioni vere** (`calcolaGiacenze` e `riepilogoDichiarazioni`)
sugli stessi archivi e le confronta canale per canale. Un cambiamento che fa
dire a uno dei due un numero diverso dall'altro rompe quella prova.

1. **La rete di chi non la dichiara non ha una giacenza** (decisione
   dell'utente). Tecnogum: Giacenze diceva 0 («vuoto»), Dichiarazioni 1.833,43 t
   (tutto quello che e' arrivato). Ora **«—» con il perche' in tutti e due**: il
   trattamento non e' a nostro carico, il portale non tiene per noi una giacenza
   di rete. Quello che e' arrivato si vede nel conferito. Ogni mese di rete di
   un sito con `dichiara_rete` falso e' non dovuto, non solo quelli segnati a
   mano (prima lo era solo gennaio). Lo storico del guardiano la tiene fuori: il
   primo giorno era il 53% della giacenza di rete. E attenzione a `r2(null)`:
   arrotonda a 0, e uno zero dice «vuoto» - la prova l'ha trovato nella
   correzione stessa.
2. **Piu' campagne di extra raccolta nello stesso mese**: `dichiarazioneDi` nel
   riepilogo ricostruiva la dichiarazione campo per campo e perdeva `caricato_kg`,
   `altre` e `ripetizioni`. Con una campagna caricata e una no, qui faceva 0
   caricato e nelle giacenze il peso giusto.
3. **Le dichiarazioni caricate dopo la fotografia si leggono di tutti gli anni**,
   in tutti e due i moduli: una dichiarazione di due anni fa caricata oggi scala
   la giacenza a portale di oggi. Il riepilogo leggeva solo l'anno e l'anno
   prima: a gennaio, guardando il 2026 per chiuderlo, i due moduli avrebbero
   detto numeri diversi.
4. **Il filtro SMOCO (`nostraRiga`) va dovunque si legge il report delle
   dichiarazioni**: in `caricamentiPortale`, nel riepilogo e, dalla revisione del
   10/10/2026, anche nel dichiarato delle Giacenze, che non passava da nessuno
   dei due e sommava Baucina nel 2024 e nel 2025. L'allineamento automatico -
   l'unico che SCRIVE «caricata» sulle nostre righe - lo saltava: 1.605 righe
   di Baucina hanno come destinazione secondaria Irigom, e una loro riga poteva
   pareggiare al chilo un nostro mese. La controprova lo fa vedere: un nostro
   luglio da 4.100 kg agganciato a un caricamento di Baucina.
5. **Il conferito della riga TOTALE conta ogni carico una volta.** Sulla riga
   di un impianto il conferito comprende le secondarie arrivate dai piazzali, ed
   e' giusto: il suo target le comprende. Sommato sulle righe contava due volte
   ogni PFU passato da un piazzale (10.744,79 t contro 8.818,55 raccolte): la
   riga TOTALE delle Giacenze diceva «residuo 800,21 t» invece di circa 2.730, e
   il PDF «Conferito RETE 10.744,79 t». Il totale del conferito e' quello delle
   primarie, come nel modulo Dichiarazioni. La prova ha un piazzale apposta.
6. **I carichi che il file non ha ancora si cercano con una regola sola**
   (`inizioAggiunti`, revisione del 10/10/2026): dall'inizio dell'anno della
   fotografia, o dai 60 giorni prima se e' di inizio anno, e in avanti senza
   limite, qualunque anno si guardi. Le Giacenze guardavano l'anno della
   fotografia, le Dichiarazioni l'anno della pagina: a gennaio, chiudendo
   dicembre, 11 t contro 11,5, e il vero era 14,5.
7. **Il numero in testa alla pagina Dichiarazioni** (giacenza calcolata degli
   impianti) **non comprende la rete di chi non la dichiara**, come lo storico:
   prima ci finivano le 1.833,43 t di Tecnogum. Prova: `prove/dueModuliACavallo.mjs`.
8. **Con la fotografia caricata, un impianto che non vi compare ha 0 a
   portale**, non «—»: il file e' l'elenco completo dei nostri non dichiarati, e
   chi non c'e' ha dichiarato tutto (T.R.S., 10/10/2026: Giacenze 0,
   Dichiarazioni «—» e niente quadratura). «—» resta per chi il file non l'ha e
   per chi per accordo non dichiara la rete. Dall'11/10/2026 vale anche nelle
   Giacenze: senza nessun file l'impianto ha giacenza di rete null, col perche'
   (punto 12).
9. **Dove entra un movimento lo dice un file solo** (chiusura dell'audit,
   11/10/2026): `ingressoMovimento(r, archivio, chiaveDi)` in
   `base44/shared/ingressoMovimento.ts` restituisce tipo, canale, `arrivo`
   (sito, chiave, ruolo), `partenza` e `senza_tipo`. Il ruolo di chi riceve e'
   il tipo di destinazione: 'stoc' e' il piazzale, tutto il resto l'impianto, e
   senza tipo e' impianto con l'avviso. Il canale lo decide il materiale
   (`canaleMovimento`). Una secondaria, anche di extra raccolta, parte dal
   piazzale e arriva dove dice il formulario, anche a un altro piazzale; una
   terziaria ha il gruppo delle terziarie. `calcolaGiacenze` e
   `riepilogoDichiarazioni` lo chiedono per primarie, secondarie e terziarie,
   nei conti e nelle date da sistemare, e non decidono piu' da se'. **Una
   secondaria arrivata al piazzale di un sito che e' anche impianto sta sul
   piazzale nei due moduli**, nelle entrate del mese e nei movimenti dopo la
   rilevazione: non entra nelle righe da dichiarare dell'impianto ne' fra i
   carichi aggiunti alla sua fotografia. Come la mette il portale nel file dei
   non dichiarati non si e' ancora visto: se la conta sull'impianto, la prima
   volta la quadratura lo mostrera' come scarto. **Un piazzale puro che riceve
   extra raccolta resta un piazzale**: prima nelle Dichiarazioni diventava un
   impianto che deve dichiarare.
10. **Il conferito ACI ed extra raccolta e' delle sole primarie, e il totale lo
    e' su tutti e tre i canali** (per la rete vedi il punto 5). Le secondarie di
    extra raccolta hanno le loro colonne (`secondarie_extra_in_t`,
    `secondarie_extra_out_t`, come quelle ACI) ed entrano nella giacenza extra
    dell'impianto, che quindi non cambia. `totali.conferito_extra_t` delle
    Giacenze e' la raccolta extra della dashboard e della pagina Extra Raccolta:
    prima contava due volte ogni PFU passato da un piazzale, 4,5 t contro 3.
    Ogni sito con un conferito di qualunque canale ha la sua riga, altrimenti il
    totale perde quei chili.
11. **Le terziarie hanno il loro gruppo, e lo decide `formulariDaSistemare`**
    dal tipo del movimento (`GRUPPO_TERZIARIE` e `ORDINE_GRUPPI` in
    `shared/giacenzaPortale.ts`; la chiusura dell'anno riesporta quel nome
    invece di scriversene uno): chi chiama con 'RETE' non puo' piu' sbagliare.
    Nelle pagine sono «Terziarie, a parte», mai nel numero della rete.
12. **Un numero che non c'e' non e' zero, nemmeno qui.** Un impianto senza il
    file degli ordini non dichiarati ha la giacenza di rete null; un piazzale
    senza nessuna rilevazione ha rete e ACI null, in tutti e due i moduli. Il
    perche' sta in `perche_senza_giacenza` (Giacenze) e `in_piazzale_perche`
    (stoccaggi del riepilogo), coi testi `PERCHE_SENZA_FOTOGRAFIA`
    (`giacenzaPortale.ts`) e `PERCHE_PIAZZALE_SENZA_LETTURA`
    (`giacenzaStoccaggi.ts`), uno per i due moduli. L'apertura scritta in
    GiacenzaSito per un piazzale senza lettura resta un dato in vista, non una
    giacenza: prima erano 0 nelle Giacenze e 53 t nelle Dichiarazioni.
13. **La riga «Da dichiarare» e' la giacenza del canale, per costruzione e su
    tutti e tre i canali.** In testa a ogni riga del riepilogo c'e' la casella
    **«dall'anno prima»**: entra l'apertura netta, esce quello che il report
    aggancia a carichi degli anni prima con caricamenti venuti dopo la lettura
    del 31/12 (`raccoglitoreUscite` non butta piu' quelle righe: `primaDopo`),
    tolte le dichiarazioni dell'anno chiuso caricate dopo, che l'apertura netta
    ha gia' tolto. Il portale aggancia dal piu' vecchio, quindi e' la prima a
    svuotarsi. Senza, a gennaio la colonna di Irigom diceva 300 t contro una
    giacenza di 900 e la pagina «a portale risultano dichiarati 600.000 kg in
    piu'», che era falso. **Se il report conosce l'impianto, i mesi vengono dal
    report**, zero se dell'anno non e' uscito ancora niente: le prime navi
    dell'anno di Irigom vanno su novembre e dicembre dell'anno prima, e
    ripartire dal dichiarato del mese faceva uscire la stessa nave due volte,
    dalla casella e dal suo mese (600 t di riga contro 900 di giacenza,
    «dichiarati 300.000 kg in piu'»). `ha_anno` di `raccoglitoreUscite` resta
    un'informazione e non sceglie piu' niente. **L'eccesso della casella non
    entra nei mesi** (visto in produzione l'11/10/2026, subito dopo la
    pubblicazione): il report di Irigom aggancia alle dichiarazioni del 2026
    circa 1.729 t arrivate nel 2025 contro un'apertura di 385,36 t, e l'eccesso,
    trattato come un aggancio caduto nel mese sbagliato, svuotava gennaio,
    febbraio e avanti: la colonna faceva 0 con un falso «652.840 kg dichiarati
    in piu'», e lo stesso su Green Tyre, T-Cycle e Gatim. In
    `allineaAllaGiacenza` quello che la casella non contiene resta fuori
    (`prima.oltre_kg`, `agganciato_oltre_kg` nel riepilogo) e si dice; i mesi
    dell'anno li svuotano solo i loro agganci. Il conto si chiude sulla giacenza
    anche per ACI ed extra raccolta, e il caricato del mese e' `kgCaricatiDi`,
    una regola sola (con due campagne extra, una caricata, la colonna diceva 0,5
    contro 0,2). Un canale con piu' righe (l'ACI primaria e secondaria) si
    chiude sul canale (`chiudiFraIFlussi`), e un canale con un'apertura e nessun
    arrivo ha comunque la sua riga. Lo storico del guardiano somma gli stessi
    `resta_t` (`indicatoriGiorno.ts`): da questo giorno per ACI ed extra
    raccolta registra la giacenza del canale, apertura compresa, e chi lo
    confronta coi giorni prima ne tiene conto. Lo controllano
    `prove/provaDel2Gennaio.mjs` («le prime navi del 2027») e
    `prove/dueModuliStessiNumeri.mjs` sui suoi due archivi; le pagine (il
    riquadro delle terziarie, quello dei doppioni, il foglio degli stoccaggi, il
    PDF dell'elenco, la scheda dei siti) le controlla
    `prove/pagineDichiarazioniGiacenze.mjs`.
14. **Un piazzale parte dall'ancora, come il suo numero a portale.** Nell'anno
    in corso la giacenza di inizio anno e' l'ancora di oggi (`puntoDiPartenza`,
    la stessa del numero a portale e delle Giacenze) portata al 31/12 dell'anno
    prima coi movimenti in mezzo, in avanti o all'indietro: una base sola. Dal
    1° gennaio alla prima lettura dell'anno nuovo e' ancora l'ancora dell'anno
    prima: partire dalla rilevazione del 31/12 faceva «da verificare» ogni
    piazzale che al 31/12 non tornava, con le Giacenze su un altro numero. **Un
    anno chiuso parte invece dalla sua ancora**,
    `ancoraDellAnno(letture, anno)`, e dall'ancora di oggi portata indietro solo
    se quella manca: prima, appena l'anno dopo aveva una lettura, la calcolata
    dell'anno chiuso tornava per costruzione con la rilevazione del 31/12 e lo
    scarto vero spariva (Nappi Sud: 40 t diventavano 45). La regola sta in
    `riepilogoDichiarazioni` (`ancoraChiuso`) e in `calcolaGiacenze`
    (`aperturaPiazzale`). **L'apertura e' la stessa nei due moduli**: le
    Giacenze (`giacenza_riferimento_t` delle righe `stoc`, che legge anche
    EcoTyna) mostravano il campo scritto in GiacenzaSito, che per l'anno nuovo
    nessuno scrive (quella dell'ACI non l'ha mai scritta nessuno) e che il
    numero del piazzale non usa: Nappi Sud 0 da una parte e 20 dall'altra, e
    senza l'ancora ogni piazzale sarebbe stato «da verificare» per tutto
    il 2027. Quel campo conta solo per i piazzali senza nessuna lettura, e la
    scheda dei siti (`TargetManager`) lo scrive nell'etichetta. Nell'anno in
    corso calcolata e portale coincidono: il riscontro con le letture e'
    `verificaRilevazione`, nelle Giacenze. `prove/dueModuliStessiNumeri.mjs` e
    la prova del 2 gennaio confrontano anche l'apertura.
15. **Un anno chiuso non si confronta col portale di oggi.** Per un impianto il
    portale e' la lettura del 31/12 che la chiusura ha salvato come apertura
    dell'anno dopo (`apertura_del` = AAAA-12-31), al netto delle dichiarazioni
    dell'anno chiuso caricate dopo. Per un piazzale e' la rilevazione del 31/12.
    Senza lettura la quadratura non si fa, e la pagina dice perche'
    (`quadratura_anno_chiuso`): non «da verificare». Una giacenza di riferimento
    scritta a mano non e' una lettura.
16. **L'elenco degli ordini da dichiarare e' la giacenza, riga per riga**
    (15/10/2026). La domanda dell'utente: «non capisco perche' ad ottobre in
    t-cycle sono entrati finora 49,04 t e nelle giacenze alla voce di ottobre
    risulta ancora 40,92 t». La Situazione diceva 372,92 t e il pulsante 122
    ordini, ma l'elenco, il suo totale e la fascia «Di quali mesi» avevano
    solo le righe del file del 09/10 (ottobre 16 · 40.920 kg): i 4 carichi del
    12-13/10 (8.120 kg) stavano solo nel «quali sono» della riga di
    riconciliazione, che compariva solo arrivando dal pulsante. E l'utente:
    vale per tutti gli impianti, non solo per T-Cycle.
    - `getOrdiniDaDichiarare` restituisce il file del portale PIU' i carichi
      che il gestionale conosce e il file non ha ancora, come RIGHE con
      `nel_file` falso. Li decide `carichiNonNelFile`
      (`shared/riconciliazioneDaDichiarare.ts`), una regola sola per Giacenze,
      Dichiarazioni ed elenco: `segna()` restituisce la chiave dell'impianto, o
      null, e le Giacenze ci contano sopra le classi; `candidato()` e' la
      stessa decisione senza la domanda al portale, e `movimenti()` da' i
      formulari da cui l'elenco fa le righe. Passano dagli stessi filtri e
      dalla stessa paginazione delle altre, in ordine di fine trasporto.
    - Il dichiarato a portale dopo la fotografia si toglie dalle righe partendo
      dal carico arrivato da piu' tempo, come fa il portale
      (`scalaDichiaratoDopo`): le righe restano e dicono quanto e' stato tolto.
      Quello che supera i carichi e' una giacenza sotto zero e va in una riga a
      parte (`parti.oltre_kg`).
    - Cosi', per ogni impianto, il totale dell'elenco e' la giacenza della
      Situazione al chilo, il numero di righe e' quello del pulsante, e i mesi
      (`contoPerMese`, il mese dell'arrivo al sito: per un carico passato da uno
      stoccaggio la fine trasporto della secondaria) sono quelli che le
      Dichiarazioni Impianti dicono da dichiarare. Vale per tutti gli
      impianti, senza casi per nome; Tecnogum resta fuori, perche' la rete non
      ce la dichiara.
    - La riga di riconciliazione di un impianto c'e' sempre: dal pulsante, dal
      menu, con anno, provincia o ricerca. `riconcilia: true` non serve piu' e
      si ignora. Un sito con due ruoli dice lo stoccaggio a parte, «in attesa
      di dichiarazione»; con tutti i siti c'e' `riconciliazione_siti`, impianto
      per impianto. Dal pulsante di uno stoccaggio no: li' l'elenco e'
      l'attesa del piazzale, i carichi dopo il file non si cercano
      (`carichi_dopo_il_file.cercati` falso) e nessuna nota dice il contrario.
    - Le parole contano quanto i numeri: «arrivato dopo il file» solo se il
      carico e' arrivato al sito DOPO il giorno del file
      (`arrivato_dopo_il_file`). Un ordine terminato prima e che il file non
      ha (chiuso a portale dopo il file), o del giorno stesso del file, e'
      «non ancora nel file (terminato il gg/mm/aaaa)», e la testa dice «+ N
      arrivati dopo» solo se lo sono tutti.
    - Il menu dei siti e' lo stesso con o senza un sito scelto (la scheda lo
      rifa' a ogni risposta, e scelto T-Cycle perdeva T.R.S.): la funzione lo
      da' con le letture che fa gia' (`candidato`), nessuna in piu'. Sui dati
      veri l'elenco costa 6 richieste per sito e 6 con tutti i siti.
    - La scheda, il suo PDF, il suo Excel e il foglio «Da dichiarare»
      dell'Excel di tutta la pagina (che e' l'elenco di tutti i siti), con gli
      stessi filtri, portano le stesse righe e lo stesso totale, con la colonna
      «Nel file del portale» (vedi «I documenti che escono»).
    - Prova: `prove/daDichiarareCarichiDopo.mjs` (le tre funzioni vere insieme,
      la scheda, il PDF, i due Excel, i dati veri). Sulla copia dell'11/10 i
      carichi che il file non ha sono 0, e l'ottobre di T-Cycle e' 16 · 40.920
      kg in elenco, Dichiarazioni Impianti e Terminati Rete: i numeri non
      cambiano, cambia che quelli successivi al file entrano dappertutto.
17. **Le regole si scrivono una volta, e le prove lo verificano guastandole.**
    Oltre ai carichi non ancora nel file, le righe su cui si ripartisce il
    target dei raccoglitori sono `conferitiPerRipartizione`
    (`shared/targetImpianti.ts`), per Giacenze e Predittivita', e il gruppo
    delle terziarie e' quello del punto 11.
    `prove/riconciliazioneDaDichiarare.mjs` e `prove/stessoTargetStessoSito.mjs`
    guastano il modulo condiviso mentre impacchettano e controllano che cambino
    tutti i moduli: con una copia locale ne cambierebbe uno solo.
18. **L'attesa del portale di un anno che non e' quello in corso conta solo i
    carichi di quell'anno** (seconda revisione del 13/10/2026). L'«In attesa
    di dichiarazione» degli stoccaggi viene dal file degli ordini non
    dichiarati, che e' di oggi. Sul 2025 dei dati veri, tutti carichi del 2026:
    - le Giacenze dicevano 860,099 t in attesa su Nappi Sud e 181,299 su
      T-Cycle;
    - la Quadratura delle Dichiarazioni gli stessi 860,099;
    - la scheda Stoccaggi 146,34 t partite verso Irigom «che il portale aspetta
      ancora».

    Per l'anno in corso vale tutto il file, come prima. Per un altro anno solo
    i carichi arrivati in quell'anno, per il giorno italiano di fine trasporto:
    - al piazzale per l'attesa sullo stoccaggio: `giornoAlPiazzale`, la fine
      trasporto della riga, se no quella della primaria nel gestionale;
    - all'impianto per quella verso un impianto: la fine della secondaria.

    La regola e' una, `nellAttesaDellAnno` in `shared/giacenzaPortale.ts`.
    `calcolaGiacenze` la chiede riga per riga; `riepilogoDichiarazioni` passa
    `anno` e `annoDiOggi` a `collocaFotografia`, che senza anno conta tutto il
    file. Nessuna giacenza cambia: l'attesa si mostra e basta. Prova:
    `prove/attesaDellAnno.mjs`. Fa girare le due funzioni vere su un archivio
    costruito e sui dati veri, con la stessa attesa per ogni stoccaggio nei due
    moduli; con la regola cambiata in un modulo solo fallisce.

    **Gli ordini da dichiarare seguono le tonnellate** (revisione finale del
    13/10/2026). Sullo stoccaggio `ordini_da_dichiarare` conta solo le righe
    che `nellAttesaDellAnno` tiene, come `in_attesa_dichiarazione_t`. Sul 2025
    la riga diceva 0 t in attesa e accanto 397 ordini su Nappi Sud e 72 su
    T-Cycle, che erano gli ordini del file di oggi. Le righe degli impianti non
    cambiano: sono la fotografia (sul 2025 dei dati veri contano ancora tutti
    gli ordini del file piu' i carichi aggiunti, 866 in tutto).

    Su un anno chiuso `totali.in_attesa_dei_carichi_del` porta l'anno (null
    sull'anno in corso), e la colonna dice «dei carichi del 2025», come la
    Quadratura:
    - nella pagina, `SituazioneTable`;
    - nel PDF, `giacenzePdf.js`;
    - nel foglio Excel, `giacenzeExportAll.js`.

    Sull'anno in corso le etichette restano quelle di prima. Le etichette le
    prova la sezione 4 di `prove/attesaDellAnno.mjs`.

19. **Tecnogum sulla rete e' un giro chiuso** (decisioni dell'utente del
    13/10/2026: «tutte le 249,06 t sono andate in tecnogum per il quale
    impianto, come già sai, noi nel 2026 non facciamo dichiarazioni perchè loro
    non ci fatturano i conferimenti rete (trattamento); per ciò che ci riguarda
    il cerchio è chiuso»). Il file degli ordini non dichiarati attribuisce
    ancora 181,299 t allo stoccaggio di T-Cycle. Sono partite tutte verso
    Tecnogum, che sulla rete non dichiara a SMOCO.
    - Il numero resta quello del portale, e serve alla quadratura.
    - Le pagine lo dicono «attribuite dal portale allo stoccaggio, ma per noi
      chiuse: TECNOGUM SRL sulla rete non dichiara a SMOCO»: niente «Da
      gestire», niente avvisi.
    - La regola e' `attesaChiusaPerNoi` (`shared/giacenzaPortale.ts`), con
      `partenzeDegliStoccaggi` e `primoInAttesa` di `collocaFotografia`. Si
      chiude solo quello che non puo' essere andato altrove: tutte le partenze
      terminate dal primo carico in attesa vanno verso chi ha `dichiara_rete`
      falso, meno quello ancora in piazzale.
    - Uno stoccaggio che manda anche a chi dichiara, come Nappi Sud, resta
      un'attesa.
    - Le Giacenze e la Quadratura portano `in_attesa_chiusa_t` e
      `in_attesa_chiusa_perche` sulla riga, e nei totali `in_attesa_chiusa_t`;
      la storia della riga del Riepilogo lo racconta allo stesso modo
      (`stoccaggioDelSito`, `attesaChiusa`).
    - Prova: `prove/giroChiusoTecnogum.mjs` (anche sui dati veri: T-Cycle
      181,299 t chiuse in tutti e due i moduli, Nappi Sud no).

20. **Gli anni passati: lo stesso numero, o «—» in tutti e due col perche'**
    (13/10/2026). Le regole sono in `shared/giacenzaPortale.ts`:
    - Un anno chiuso si legge con la lettura del 31/12 salvata dalla chiusura
      (`letturaDelTrentuno`), non col portale di oggi. Senza la lettura e' «—»
      con `PERCHE_SENZA_LETTURA_DEL_TRENTUNO`. Le Giacenze di un anno chiuso
      leggono anche i siti dell'anno dopo: una lettura in piu', solo per un anno
      chiuso, come il riepilogo.
    - Un anno chiuso senza nessuna GiacenzaSito (`annoPrimaDelGestionale`) non si
      ricostruisce: «—» su rete, ACI ed extra in tutti e due i moduli, con
      `PERCHE_ANNO_PRIMA_DEL_GESTIONALE`. Nella risposta ci sono
      `prima_del_gestionale` e `perche_prima_del_gestionale` solo quando e' vero.
      Sul 2025 dei dati veri prima dicevano tre numeri, nessuno vero: Irigom
      652,84 t nelle Giacenze (il portale di oggi) e 4.439,08 nelle Dichiarazioni
      (tutto l'arrivato), Tecnogum 1.833,43 contro 2.007,08, Innorec 0 contro
      1.254,41; sul 2024 Green Tyre 337,96 contro 0.
    - Un piazzale di un anno chiuso senza una lettura che lo apra ha «—» anche
      nelle Giacenze (`PERCHE_PIAZZALE_SENZA_INIZIO`), come nelle Dichiarazioni:
      sul 2025 Nappi Sud diceva 25,88 t in una e «—» nell'altra.
    - Le Giacenze confrontano portale con portale (voce (a) del catalogo). La
      giacenza del canale delle Dichiarazioni e' la calcolata. Su un anno chiuso
      guardato prima della chiusura le Giacenze dicono «—» e la calcolata c'e':
      e' la quadratura che manca, non un'identita' rotta.
    - Prove: `prove/identitaFraModuli.mjs`, sezione 5 (5a-5e, e sui dati veri
      il 2024 e il 2025), `prove/storiaDichiarazioni.mjs`.

21. **Una riga senza numero non vale zero nel totale** (revisione del
    14/10/2026). Il 2026 guardato il 05/01/2027, prima che la chiusura salvi la
    lettura del 31/12: le righe dei cinque impianti che dichiarano la rete
    dicevano «—» col loro perche', ma il totale della colonna delle Giacenze
    (anche la KPI «Giacenza rete a portale») diceva 25,88 t, il solo piazzale di
    Nappi Sud, e il totale a portale delle Dichiarazioni 0. Ora una riga che il
    numero non ce l'ha per mancanza del dato fa del totale del canale un «—», e
    il totale dice quali righe e perche', con la stessa regola e le stesse
    parole nei due moduli (`totaleDellaColonna`, `PERCHE_TOTALE_SENZA_RIGHE`).
    La rete di chi non la dichiara non manca. L'anno in corso non cambia di un
    chilo. Prova: `prove/totaleSenzaRighe.mjs` (la regola, le due funzioni vere,
    la tabella delle Giacenze e la Quadratura, i dati veri).

22. **Il mese di un target mensile si legge com'e' scritto, in tutti i moduli**
    (rilievo della revisione, corretto con le decisioni del 13/10/2026).
    `targetMensiliValidi` riconosce il doppione col mese com'e' scritto, e
    Target & Status, l'Andamento, gli avvisi ed EcoTyna leggono «Ottobre» e
    basta (i mesi di `targetRaccoglitori.ts`). La ripartizione fra gli impianti
    (`ripartisciTargetPrimarie` in `targetImpianti.ts`, per Giacenze e
    predittivita') leggeva il mese in minuscolo e sommava «Ottobre» e
    «ottobre»: 80 + 50 = 130 t dove la pagina dice 80. Ora una riga con un mese
    scritto in un altro modo non vale in nessun modulo. Prova:
    `prove/targetMeseComeScritto.mjs`.

23. **Il «—» arriva fino alle pagine e ai file** (giro del 14/10/2026 sulle
    decisioni del 13/10/2026). Le risposte dicevano gia' null col perche'
    (punti 20 e 21), ma pagine e file scrivevano 0,00: `formatTonnellate(null)`
    da' «0,00», `|| 0` scrive 0, e `esportaTabella` lascia vuota una cella
    numerica null. Ora:
    - la testata delle Dichiarazioni dice «—» col perche' (title) e un riquadro
      sopra le schede (`tonnellateOManca`, `percheDelPortale` in
      `DichiarazioniImpianti.jsx`). Su un anno prima del gestionale anche il
      dichiarato e la quadratura dicono «—»: niente piu' «0 su 0» in verde;
    - la scheda Impianti usa il componente `Manca` (`SezioneImpianto.jsx`), il
      Riepilogo e il dialogo del mese dicono «—» col title. Su un anno prima del
      gestionale niente «c'e' un caricamento che qui non e' stato registrato»:
      sul 2025 erano 7 righe, Irigom 4.439.080 kg;
    - la casella «Giacenza rete a portale» delle Giacenze (`GiacenzeKpi.jsx`)
      dice in breve perche' il totale non si fa, col perche' intero nel title.
      Se l'ACI c'e', la scrive a parte nella stessa casella: «il totale non si
      fa ... · ACI 26,81 t, a parte»;
    - il PDF e il foglio Excel della Situazione scrivono «—» o una cella vuota,
      mai 0. Le note sotto la tabella le scrive una funzione sola,
      `notePercheGiacenze` in `src/lib/giacenzePdf.js`, per tutti e due i file.
      Nel TOTALE del foglio ogni classe segue il totale del suo canale (P, M,
      G1, G2 la rete; ACI l'ACI): il 05/01/2027 uscivano 11.400 kg di P sommati
      sulle sole righe col numero;
    - l'attesa per noi chiusa ha una colonna nel PDF e nel foglio, e «di cui per
      noi chiuse» nel riepilogo del PDF. Sui dati veri sono 181,299 t, T-Cycle
      verso Tecnogum. L'elenco «Da dichiarare» aperto dallo stoccaggio si
      intesta «Per noi chiusi» e non dice piu' «li dichiara lui»
      (`attesaTuttaChiusa` in `DaDichiarareTable.jsx`, prop `righeGiacenze`).
      La pagina delle Giacenze gli passa le righe che ha gia' **solo sull'anno
      in corso** (chiusura del giro): l'elenco e' il file degli ordini non
      dichiarati di oggi, e su un altro anno l'attesa della riga conta i soli
      carichi di quell'anno (punto 18). Prima la prop non arrivava mai e la
      scritta sul sito non c'era.

    Un valore nuovo nelle risposte si scrive con un controllo esplicito di null,
    mai con `|| 0` o con un formato che lo trasforma in 0. L'anno in corso coi
    numeri non cambia una parola. Prove: `prove/pagineAnniPassati.mjs`, che gira
    sulle pagine e sui file veri, con un archivio costruito (2025 prima del
    gestionale, 2026 di oggi, 2026 guardato il 05/01/2027) e coi dati veri (2025
    e 2024 con «—», 2026 a 1.617,22 t come prima);
    `prove/perNoiChiusiDallaPagina.mjs`, la pagina delle Giacenze vera fino
    all'elenco, anche sui dati veri.

24. **EcoTyna e le giacenze che non hanno un numero** (giro del 14/10/2026).
    - Il riepilogo della commessa (`assistente.ts`) dice «RETE: — (non e' zero:
      <perche'>)», mai «RETE 0,00 t».
    - L'impianto senza il file si riconosce dal suo perche'
      (`senzaFileDelPortale`: `perche_senza_giacenza ===
      PERCHE_SENZA_FOTOGRAFIA`), non da una fotografia senza giorno. Un anno
      chiuso senza lettura, un anno prima del gestionale e Tecnogum per accordo
      non sono «senza il file».
    - I totali per canale si fanno con `totaleGiacenze`, la regola del modulo
      (`totaleDellaColonna`).
    - Lo strumento `giacenze` passa `in_attesa_chiusa_t` e
      `in_attesa_chiusa_perche`, e nei totali della rete la parte chiusa
      (`in_attesa_chiusa_t`) e quella da risolvere (`in_attesa_da_risolvere_t`);
      il totale dell'attesa resta il numero del portale. Le 181,299 t di T-Cycle
      non sono un'attesa da risolvere.
    - **Il perche' si dice una volta.** Su un anno prima del gestionale c'e'
      `avviso_anno`, e righe e totali ci rimandano. Anche `perche_canali` di ACI
      ed extra raccolta e' un rimando (`percheCanali`): all'avviso dell'anno, o a
      `calcolo.avviso` quando e' lo stesso della rete della riga (il piazzale
      senza la lettura che apra l'anno). I totali si rifanno sulle righe di
      `calcolaGiacenze`, non su quelle riscritte. Ripetuto per esteso, sui dati
      veri dell'11/10 il 2025 passava il limite di 24.000 caratteri di
      `serializza` (`pianoAssistente.ts`), e l'elenco arrivava al modello
      tagliato a 8 siti su 15 (nel 2024, su 18). Ora 18.349 e 21.873 caratteri,
      elenchi interi.
    - Chi aggiunge un campo a ogni riga di uno strumento misuri il blocco con
      `testoDati` sugli anni piu' lunghi (il 2024).
    - Prova: `prove/variazioniAParole.mjs`, parte 3.

25. **Gli ordini da dichiarare di un anno passato sono i carichi di
    quell'anno ancora aperti oggi** (giro del 14/10/2026, sull'approvazione
    dell'utente, e revisione dello stesso giorno). Il file degli ordini non
    dichiarati e' di oggi. Sul 2025 dei dati veri le righe degli impianti
    contavano tutto il file (Tecnogum 320, Irigom 233, T-Cycle 118, Green Tyre
    139, Gatim 56), accanto alla lettura del 31/12 o a «—».
    - Su un anno PASSATO (`annoNum < annoDiOggi`, `ordiniDiUnAnnoPassato` in
      `calcolaGiacenze`) contano le righe del file arrivate al sito in
      quell'anno, per giorno italiano di fine trasporto (`giornoDelCarico`: la
      fine della secondaria se il carico e' passato da un piazzale). A queste
      si aggiungono i carichi di quell'anno che il file non ha ancora (`nAnno`).
      Sui dati veri il 2025 e il 2024 fanno 0 su tutti gli impianti.
    - Sull'anno in corso e sull'ANNO DOPO, che il menu delle Giacenze offre,
      conta tutto il file, come prima: li' la giacenza di un impianto e' la
      fotografia di oggi. La prima versione usava `!== annoDiOggi`, e sul 2027
      dava 0 ordini accanto alle 652,84 t di Irigom. Per questa regola si usa
      `<`, mai `!==`: in `calcolaGiacenze`, `getOrdiniDaDichiarare`
      (`carichi_del`), `Giacenze.jsx` e `DaDichiarareTable`.
    - Il pulsante e l'elenco che apre dicono lo stesso numero. La pagina passa
      `carichi_del` solo su un anno passato e `getOrdiniDaDichiarare` filtra
      con la stessa regola. La riga di riconciliazione dice gli ordini (file +
      non ancora nel file = pulsante), senza la giacenza.
    - L'etichetta sta in `totali.ordini_dei_carichi_del`, presente solo su un
      anno passato: la risposta dell'anno in corso e dell'anno dopo resta al
      carattere. Chi scrive «Ordini da dichiarare» prende l'anno da li', non da
      `in_attesa_dei_carichi_del`. Sull'anno dopo l'attesa e' dei carichi di
      quell'anno, gli ordini degli impianti no.
    - Lo dicono tutti con le stesse parole, «dei carichi del 2025 ancora da
      dichiarare oggi»: la colonna e il pulsante della Situazione
      (`SituazioneTable`), e dalla chiusura del giro la casella in testa
      (`GiacenzeKpi.jsx`), la colonna del PDF (`situazionePdf`), l'intestazione
      del foglio Situazione e una nota sotto il foglio «Da dichiarare»
      (`giacenzeExportAll.js`), e EcoTyna (`ordini_dei_carichi_del` e
      `ordini_quali` nei totali della rete dello strumento `giacenze`: un campo
      nei totali, non per riga, punto 24). Prova:
      `prove/ordiniAnniPassatiEtichette.mjs`, coi tre anni: passato, in corso e
      dopo, che restano com'erano.
    - Il PDF dell'elenco di un anno passato lo dice in testa e nella prima nota
      (`pdfDeiCarichiDel` in `DaDichiarareTable`). Il foglio Excel dell'elenco
      riceve `{ carichi_del }` e lo dice in una riga in testa e nel nome del
      file (`ordini_da_dichiarare_carichi_del_2025_<oggi>.xlsx`). Usa ancora
      SheetJS: per «I documenti che escono» andrebbe portato a exceljs col
      corredo comune.
    - Lo stoccaggio, anche sull'anno dopo, segue il punto 18: i carichi
      arrivati al piazzale in quell'anno, per tonnellate e ordini insieme.
    - Prove: `prove/ordiniAnniPassati.mjs`, anche sull'anno dopo (sui dati veri
      il 2027 come al commit 5939d15, 866 ordini), e
      `prove/velocitaGiacenze.mjs` (l'anno dopo identico al carattere).

**La prova confronta tutto.** Oltre alle trappole, `confrontaTutto` (in
`prove/dueModuliStessiNumeri.mjs`) mette a fianco ogni impianto e ogni piazzale,
canale per canale, nei due moduli: gli stessi numeri, o nessun numero in tutti e
due. L'anno dei dati e' quello in corso: un anno scritto nella prova il 1°
gennaio diventa «chiuso», si confronta con la lettura del 31/12, e la prova
cadrebbe per una data.

**Il cambio d'anno lo controlla `prove/provaDel2Gennaio.mjs`**: un archivio a
cavallo d'anno, con la chiusura scritta, la fotografia del 02/01/2027 e i
carichi di gennaio, e l'orologio fermo. Le tre funzioni vere (`calcolaGiacenze`,
`riepilogoDichiarazioni`, `getOrdiniDaDichiarare`) girano insieme con un
invariante solo: per impianto e canale, somma della riga = giacenza del canale =
Giacenze. E il 2026 guardato il 02/01 deve dire gli stessi numeri del 2026
guardato il 31/12. Un cambiamento che rompe il cambio d'anno rompe questa prova,
e non il 2 gennaio.

### La storia di una riga del Riepilogo (12/10/2026)

Richiesta dell'utente sul caso T-Cycle. A marzo si sono dichiarati 146.860 kg
«ma risulta nulla in giacenza», e «a marzo risultano 20.620 kg che mancano dai
conteggi»; l'utente pensava fossero lo stoccaggio. Il report del portale dice
altro. Quei 20,62 t sono la parte di marzo in impianto che la dichiarazione di
marzo non ha coperto: la copre quella di giugno. Lo stoccaggio (249,06 t) e'
ripartito tutto verso Tecnogum. Poi: «rendi visibile il quadro della
situazione anche a chi vede per la prima volta questo gestionale».

Le regole stanno in `base44/shared/storiaDichiarazioni.ts`.
`riepilogoDichiarazioni` aggiunge campi e non cambia nessun numero:
- `mesi[i].giacenza_fine_kg`: tutto quello che e' entrato, casella dall'anno
  prima compresa, meno il caricato nella colonna in cui la pagina mette la
  dichiarazione. Dopo il mese di oggi vale null. L'ultimo mese e' il «Da
  dichiarare» della riga e la giacenza delle Giacenze, al chilo.
- **Su un canale con piu' righe la giacenza a fine mese si chiude sul canale,
  come il «Da dichiarare»** (`giacenzaAFineMeseDelCanale`, revisione del
  13/10/2026). L'ACI di un impianto ha due righe, primaria e secondaria. Contata
  riga per riga, una dichiarazione scritta sulla provenienza sbagliata (Gatim
  ACI d'aprile: 10.000 kg in primaria e 12.540 in secondaria invece di 8.200 e
  14.340, lo stesso totale) dava -1.800 kg su una riga e +1.800 sull'altra fino a
  ottobre, mentre la colonna diceva 0 su tutte e due. Ora ogni fine mese passa
  dalla chiusura delle righe del canale (`chiudiFraIFlussi`): nessuna riga va
  sotto zero finche' non ci va il canale, il canale non cambia di un chilo e le
  righe hanno lo stesso ultimo mese. Quello che la chiusura sposta fra le righe
  sta in `mesi[i].spostato_dal_canale_kg`, solo dove non e' zero, e il perche'
  del numero lo dice. Una giacenza del canale sotto zero resta sotto zero, sulla
  riga che l'ha fatta: e' un errore da correggere e si dice. Con una riga sola il
  conto e' quello di prima, numero per numero.
  **Lo spostamento si racconta per tratti, e quando finisce si dice perche'**
  (seconda revisione del 13/10/2026). Dura finche' la riga in eccesso non
  riceve arrivi suoi. Gatim ACI con aprile sulla provenienza sbagliata e
  settembre non ancora caricato: va da aprile ad agosto, e da settembre «gli
  arrivi della primaria lo riassorbono». La colonna toglie allora l'eccesso dal
  settembre della primaria, e la secondaria tiene le sue 1,80 t d'aprile. Il
  racconto diceva solo il primo mese, e come un fatto («risultano uscite»), e
  due frasi dopo contava le stesse tonnellate fra quelle da dichiarare. Mai
  «risultano uscite». Se lo spostamento finisce perche' l'altra riga non ha
  piu' carichi, la giacenza va sotto zero e si dice che e' un errore.
  `raccontoDellaRiga` riceve `altre_provenienze` per chiamare l'altra riga per
  nome. Al tocco, `fineMeseDaSpiegare(m, precedente)` e
  `percheFineMese(m, prima, precedente)` (`src/lib/storiaRiepilogo.js`) aprono
  il numero anche dove lo spostamento cambia o finisce rispetto al mese prima:
  a settembre la riga passava da 0 a 14,62 t con 12,82 arrivate e non si apriva
  niente. La prima frase non dice «e' quello che e' entrato meno le
  dichiarazioni» quando non lo e', e non scrive mai un numero sotto zero dove la
  giacenza non lo e'. Prova: `prove/spostamentoCheRientra.mjs`.

  **Il perche' della fine e' lo stesso su tutte e due le righe** (revisione
  finale del 13/10/2026). Lo decide la riga che era in eccesso:
  - se a fine mese e' ancora sotto zero, l'altra non ha piu' carichi da cui
    toglierlo, ed e' un errore;
  - se no, l'hanno riassorbito i suoi arrivi.

  Sulla riga che cedeva la sua giacenza non basta a dirlo. La secondaria di
  Gatim che a settembre dichiara anche le sue 1,80 t d'aprile finisce a 0, e
  diceva «non resta niente da cui toglierlo»; la primaria intanto diceva che i
  suoi arrivi lo riassorbono.

  Come si fa ora:
  - `riepilogoDichiarazioni` mette `mesi[i].giacenza_canale_fine_kg`, le righe
    del canale insieme, sui mesi con uno spostamento e sul mese dopo;
  - decide `comeFinisceLoSpostamento(m, precedente)`, scritta uguale in
    `shared/storiaDichiarazioni.ts` (il racconto) e in
    `src/lib/storiaRiepilogo.js` (il tocco);
  - se la riga che cedeva ha dichiarato lei, nello stesso mese, le tonnellate
    che le tornano (le sue dichiarazioni del mese superano i suoi arrivi), si
    dice, e non «tornano nella sua giacenza»;
  - senza la giacenza del canale il perche' non si dice.

  Prova: sezioni 4-6 di `prove/spostamentoCheRientra.mjs`. La sezione 5
  confronta le due copie della regola caso per caso.
- `mesi[i].dichiarazione_copre` e `mesi[i].coperto_da`: gli agganci letti dal
  report. Una nostra dichiarazione si riconosce dal giorno del caricamento; se
  il peso non torna si cercano i giorni vicini, entro tre (`abbinaCaricamenti`:
  Irigom febbraio, 721.660 kg presi l'11/03 e il 12/03). Il ripiego e' il peso al
  chilo. Senza riscontro non si dice niente.
- **Una copertura sola per casella** (revisione del 13/10/2026). `copre` viene
  dallo stesso aggancio di `dichiarazione_copre` (`copreDellaColonna`), nel
  formato di prima - «dall'anno prima» in testa ai mesi, `giorno` l'ultimo giorno
  del caricamento - con in piu' `giorni`, tutti. Prima era un giorno solo
  (`copertureDelCaricamento`): su Irigom febbraio la tendina della casella, il
  dialogo del mese e la scheda Impianti dicevano 174.400 kg, la «i» della stessa
  casella 721.660. La frase e' una, `coperturaCaricata`
  (`src/lib/storiaRiepilogo.js`), nei quattro posti: «caricata a portale in due
  volte, 11/03/2026 e 12/03/2026: 721,66 t = ...». Due dichiarazioni caricate lo
  stesso giorno hanno un caricamento solo, e la frase dice con quale.
- Altri campi della riga: `giacenza_partenza_kg`, `ultimo_mese`,
  `prima_coperta_da`, `caricamenti_non_nostri`, `racconto` (frasi scritte dai
  numeri). Le Giacenze hanno un numero per impianto e canale: il racconto lo
  chiama «lo stesso numero delle Giacenze» solo sulla riga che e' l'unica del suo
  canale. Sull'ACI dice che lo fanno le righe insieme, e quanto
  (`raccontoDellaRiga` riceve `righe_del_canale` e `giacenza_canale_kg`;
  revisione del 13/10/2026: la primaria di Gatim diceva 12,35 t «delle
  Giacenze», la secondaria 12,82, e le Giacenze dicono 25,17 t).
- `stoccaggio_stesso_sito`: per chi nell'anno e' stato impianto e stoccaggio
  sullo stesso canale. Contiene l'entrato in stoccaggio e il ripartito verso
  ogni destinazione mese per mese (`stoccaggi[].canali[].verso[].mesi_kg`), e
  le frasi su chi lo dichiara. Per una destinazione che la rete non la dichiara
  (Tecnogum) le frasi riportano l'«In attesa di dichiarazione» del portale.
  **Quel numero e' del file di oggi** e non distingue l'anno dei carichi. Su
  un anno che non e' quello in corso conta solo i carichi di quell'anno, come
  nelle Giacenze (punto 18 di «Giacenze e Dichiarazioni: lo stesso numero»):
  `stoccaggioDelSito` riceve `annoCarichi` e la frase dice «di carichi del
  2025». Sul 2025 dei dati veri T-Cycle ha 0 kg in attesa, e `in_attesa_t` e'
  0, un numero vero. Con la prima revisione del 13/10/2026 era null; prima
  ancora erano 181,299 t, tutti carichi del 2026. Senza `inAttesaT` (null) la
  frase sul portale non si scrive e `in_attesa_t` resta null.

A video (`src/components/dichiarazioni/StoriaRiga.jsx`):
- la riga «giacenza a fine mese»;
- le righe azzurre dello stoccaggio;
- il pulsante «storia»;
- la «i» nell'angolo della casella, al tocco (mai title=), solo dove c'e'
  qualcosa oltre il colore: una dichiarazione, o una parte della giacenza che
  la chiusura sul canale ha spostato. Sta a `z-[1]`, non `z-10` (revisione del
  13/10/2026): scorrendo il riepilogo di lato, le «i» con z-10 si disegnavano
  sopra i nomi degli impianti della prima colonna ferma, che ha z-index 2
  (`src/index.css`).

Nel foglio: le stesse righe nel Riepilogo con una nota, i fogli «Dichiarazioni
caricate» e «Storia», tre colonne in coda al Dettaglio. **Sono righe da
leggere: non entrano nel conferito, nel Caricato, nel Da dichiarare ne' nei
totali.**

`prove/storiaDichiarazioni.mjs` gira anche sui dati veri. Confronta la risposta
con quella di HEAD tolti i campi nuovi. **Chi aggiunge un campo alla risposta lo
aggiunge alle liste `NUOVI_FLUSSO` / `NUOVI_MESE` della prova**; un campo
esistente cambiato la fa fallire, ed e' voluto. La sezione della revisione del
13/10/2026 rifa' i casi qui sopra sui numeri costruiti (sezione R, con 300
canali ACI a caso) e sui dati veri (sezione 10). `copre`,
`spostato_dal_canale_kg` e `giacenza_canale_fine_kg` stanno in `NUOVI_MESE`. `copre` si controlla a parte:
dove il portale ha preso la dichiarazione in un giorno solo e' quello di HEAD
(tolto `giorni`), e la sezione 10 lo confronta casella per casella con
`dichiarazione_copre`. La seconda revisione del 13/10/2026 ha le sue prove:
`prove/spostamentoCheRientra.mjs` e `prove/attesaDellAnno.mjs`.

### Canali indipendenti

RETE, ACI ed EXTRA RACCOLTA sono commesse separate: non si sommano mai, in
nessun modulo, nemmeno come totale di controllo o come conteggio di formulari, e
anche quando un viaggio di secondaria porta formulari di piu' canali. I target
esistono solo per la rete.

**Un movimento si fattura in un canale solo.** Un record dell'extra raccolta non
deve comparire fra gli impianti del giro RETE: ci compariva, e la stessa riga di
trattamento si pagava due volte, una per scheda. Quando un viaggio di secondaria
porta insieme formulari di rete e formulari ACI, l'importo si paga una volta
sola: a tonnellata ogni canale paga i suoi chili; **a viaggio l'importo si
divide fra i canali in proporzione ai chili effettivi di ciascuno su quel
viaggio** (regola dell'utente del 22/09/2026, `quoteViaggioMisto` in
`base44/shared/passivaCalcolo.ts`). L'arrotondamento e' **uno per tratta**
(`importoTrattaAViaggio`, 11/10/2026): la rete paga round2(valore x (viaggi
interi + somma delle sue quote)), l'ACI i suoi viaggi interi piu' il resto dei
misti, cosi' sui misti i due canali fanno sempre i viaggi veri e le parti fanno
sempre l'importo. Prima ogni misto si arrotondava per conto suo. Il viaggio
misto non e' un'anomalia. Le tonnellate mostrate sono quelle del canale che si
sta guardando, mai la somma dei due.

**Il viaggio misto nel foglio Excel dell'amministrazione** (11/10/2026). Nelle
righe del trasporto a viaggio la colonna «nr. di viaggi» (G) porta i viaggi
PAGATI, cioe' l'importo della passiva diviso il prezzo (`viaggiPagatiTrasporto`
in `src/lib/passivaAmministrazione.js`), e il totale e' =ROUND(F*G;2)
(`formulaTotaleTrasporto` in `src/lib/passivaAmministrazioneExcel.js`): quando
Excel ricalcola, il numero non cambia. Con la quota arrotondata a due decimali
in G la riga di rete passava da 707,69 a 708,00; con la quota dei chili intera,
la riga ACI, che la passiva paga per differenza, al mezzo centesimo diventava di
un centesimo piu' alta (300 €/viaggio, misto da 14.500 + 1.500 kg: 328,13 contro
328,12, cioe' 600,01 su due viaggi da 300). Il numero si legge con due decimali
come prima, e la quota dei chili resta nella nota della riga; la passiva non e'
cambiata. Prova a tappeto: `prove/passivaGrana.mjs`, righe di rete e ACI.

**Extra raccolta in fatturazione** (22/09/2026). In attiva vale il prezzo scritto
sull'intervento; se e' zero o vuoto, la tariffa base: la Tariffa ATTIVA
EXTRA_RACCOLTA della data, e senza quella **202 euro/t nel 2026**. In passiva i
costi (raccolta, stoccaggio, trattamento) sono quelli che l'utente scrive a mano
sull'intervento prima di passarlo da assegnato a terminato: **mai il ripiego sulle
tariffe di rete**, ne' nel calcolo ne' nel modulo. In fatturazione entrano solo gli
interventi terminati, nel mese della fine trasporto. Una scheda si chiude
(terminato) solo con FIR, peso effettivo e le tre date obbligatorie.

**Le secondarie dell'extra raccolta sono trasporti di secondaria** (decisione
dell'utente del 13/10/2026: «le eventuali secondarie di extra raccolta saranno
trattate come normali trasporti di secondaria con il loro €/t oppure €/viaggio a
seconda del tragitto e dei contratti»). E' l'eccezione alla regola dei costi
scritti sull'intervento.
- In passiva (`tariffaTrasportoExtra` e `trasportoInterventoExtra` in
  `passivaCalcolo.ts`) il prezzo e' la tariffa TRASPORTO_SECONDARIA del vettore
  (chi fattura, dopo la catena dei subfornitori) per la tratta stoccaggio →
  destinazione, nel giorno italiano della fine del trasporto: prima una tariffa
  EXTRA_RACCOLTA, poi la TUTTE del contratto del vettore; una disattivata mai.
- A tonnellata sui chili, a viaggio una volta per viaggio (qui sotto). Il
  centesimo e' per intervento.
- Il prezzo a viaggio scritto sull'intervento vale solo per una tratta senza
  contratto; accanto a un contratto non si paga, e la nota della riga lo dice.
  Senza l'uno e l'altro, l'anomalia.
- Una secondaria non e' piu' fra le raccolte (prima ci stava a 0 €, con
  l'avviso sbagliato «il contratto di extra raccolta prevede 80 €/t»). Un costo
  di raccolta scritto su una secondaria non si paga e si dice, e la scheda lo
  chiude e salva 0.
- Il sovracosto pagato al trasportatore di una secondaria si paga sulla riga
  del suo trasporto; un vettore interno ha la riga a 0.
- Pagina, scheda e blocco del foglio usano la stessa regola, `trasportoIntervento`
  di `extraRaccoltaCalc.js`, col quinto argomento di `contestoPrezzi` (le tariffe
  passive). La pagina legge una volta, solo per l'amministratore, le tariffe
  TRASPORTO_SECONDARIA; il foglio della passiva (`PassivaModulo`) passa quelle che
  legge gia' (dal 14/10/2026, chiusura del giro: prima non le passava, e il
  foglio diceva 0 + 40 dove la passiva 600 + 40; prova:
  `prove/extraRaccoltaSecondarie.mjs`, sezione 9).
- Senza le tariffe nel contesto, `trasporto.non_letto` e il prezzo scritto, e
  la nota del foglio lo dice.
- Nel foglio la colonna TRASPORTO di una secondaria porta quanto si paga per il
  viaggio, cosi' la formula della riga rifa' l'importo.

**Lo stesso viaggio si paga una volta, anche nell'extra raccolta** (revisione
del 14/10/2026). Un viaggio e' un camion in un giorno. A viaggio, le secondarie
di extra raccolta con lo stesso automezzo, lo stesso giorno italiano di
`trasporto_finito_il`, la stessa tratta e lo stesso vettore pagano il prezzo del
contratto una volta sola:
- l'automezzo con la targa normalizzata;
- la tratta dallo stoccaggio alla destinazione;
- il vettore e' chi fattura, dopo la catena dei subfornitori.

Il prezzo si divide fra gli interventi in proporzione ai chili, come il viaggio
misto fra rete e ACI. Senza chili si divide in parti uguali. L'ultimo
nell'ordine di `chiaveInterventoExtra` prende la differenza, cosi' la somma e'
sempre il prezzo. A tonnellata non cambia niente. Il prezzo scritto a mano
sull'intervento, per una tratta senza contratto, resta di quell'intervento.

Il codice:
- in `passivaCalcolo.ts`: `chiaveViaggioExtra`, `quoteDelViaggio` e
  `trasportoInterventoExtra(r, tariffe, trasKey, membri)`. La riga condivisa
  porta `viaggi_quota`, `viaggio_condiviso` e la nota «stesso viaggio di FS B
  (camion GC599NL, 10/09/2026): i 400,00 € a viaggio si pagano una volta, divisi
  per peso, qui 6,00 t delle 12,00: 200,00 €»;
- in `src/lib/extraRaccoltaCalc.js` la stessa regola, con `conViaggi(contesto,
  interventi)`. La pagina lo chiama con l'elenco gia' letto, e
  `bloccoExtraRaccolta` con gli interventi del mese. Senza `conViaggi` ogni
  intervento e' un viaggio a se'.

Senza targa, piu' interventi dello stesso giorno sulla stessa tratta sono un
viaggio solo, e c'e' l'anomalia. Un camion che porta anche formulari di rete o
ACI puo' essere pagato a viaggio anche in quella passiva, cioe' due volte: la
passiva dell'extra raccolta lo dice con l'anomalia «lo stesso camion ...». La
strada per toglierlo e' contare, nel blocco delle secondarie di rete e ACI, i
chili dell'extra raccolta come un terzo canale nella proporzione dei viaggi
misti (la regola del 22/09/2026, «fai la proporzione in base al peso»); ma
allora anche la pagina dell'extra raccolta deve leggere le Secondarie di quei
giorni, altrimenti non direbbe lo stesso costo. Sui dati veri dell'11/10/2026
non ci sono secondarie di extra raccolta, e la passiva e' identica oggetto per
oggetto in tutti i mesi del 2026. Prova: `prove/extraRaccoltaSecondarie.mjs`
(sezioni 6-8 per il viaggio).

**Il prezzo attivo dell'extra raccolta e' una funzione sola** (chiusura
dell'audit, 11/10/2026): `prezzoAttivoExtra` in
`base44/shared/ecotyreTariffe.ts` (specchio `src/lib/ecotyreTariffe.js`). Prima
il prezzo scritto, poi la Tariffa ATTIVA EXTRA_RACCOLTA valida, poi la base
dell'anno; una secondaria vale zero. La usano la fattura (`attivaCalcolo.ts`),
la pagina, la scheda e il foglio. La pagina legge una volta le tariffe attive
dell'extra raccolta, tutti i fornitori (non piu' solo quelli con la spunta della
dicitura, dal surplus del 13/10/2026) e i surplus (da `leggiSurplus`), e passa
`contestoPrezzi(tariffe, fornitori, surplus, subfornitori, tariffePassive)`
(`src/lib/extraRaccoltaCalc.js`) a `calcExtraRaccolta(r, contesto)`; il surplus
nell'extra raccolta e' in «Il surplus sulle tariffe». Prima aveva una copia
della sola base dei 202 euro: dal 2027, o con la tabella a un valore diverso,
diceva un ricavo e la fattura un altro. Il file della pagina
(`src/lib/extraRaccoltaExport.js`) usa le stesse tariffe (parametro
`contesto`), i numeri dell'Excel e del PDF li calcola una volta sola
`datiExportExtra`, e il Totale imponibile somma i ricavi della
fattura: i sovracosti di chi in fattura non entra (secondarie, terminati senza
peso) restano fuori. Dal 13/10/2026 comprende anche la riga del surplus, col
centesimo del mese come in fattura (vedi «Il surplus nell'extra raccolta»).
Un prezzo preso da una tariffa di un altro anno rimasta aperta porta lo stesso
avviso «prezzo del {anno}» in fattura, in pagina e nella scheda, e la scheda
NON lo scrive sull'intervento: diventerebbe un prezzo concordato e l'avviso
sparirebbe. Prova: `prove/prezzoExtraRaccolta.mjs`.

**Un terminato senza peso effettivo** non si fattura e non si valuta: niente
ripiego su `quantita_ritirata`, chili null e non zero, restano solo gli importi
fissi. Si dice dappertutto con la stessa frase (`avvisoPesoMancante`): in
fattura e in passiva (anomalia `peso_mancante`), in pagina, nel foglio della
passiva in Excel e PDF (chili «—», riquadro «DA SISTEMARE», elenco `senza_peso`)
e, in ambra, nel riepilogo di Ecotyre. Prova: `prove/extraRaccoltaPeso.mjs`.

**Lo stesso formulario su due interventi di extra raccolta** (alta A40,
12/10/2026). Al salvataggio la scheda cerca il FIR normalizzato fra gli altri
interventi (`src/lib/formularioGiaPresente.js`) e chiede conferma dicendo dove
si trova gia'. La pagina le passa l'elenco che rilegge dopo ogni salvataggio.
Prova: `prove/extraRaccoltaScheda.mjs`.

**Il centesimo dell'extra raccolta** (11/10/2026). In passiva ogni intervento si
paga per conto suo, costo per costo: raccolta, stoccaggio e trattamento si
arrotondano al centesimo ciascuno, poi si sommano, e la riga del fornitore e' la
somma degli interventi (`segnaImportoIntervento`). Lo stesso in pagina
(`calcExtraRaccolta`), nel blocco del foglio e nella formula Excel della riga
(`formulaTotaleExtra`, un ROUND per costo). Rete e ACI restano per gruppo
(provincia, destinazione, tariffa): sui mesi 2026 la loro grana da' il centesimo
del file dell'amministrazione, che fa peso della voce per prezzo. Il centesimo
e' `arrotondaAlCentesimo` di `ecotyreTariffe.ts` (e del suo specchio): legge il
numero a 15 cifre significative e porta il mezzo centesimo per eccesso, come
=ROUND di Excel. `Math.round((v + Number.EPSILON) * 100)` non basta sopra
l'euro: 103 kg a 85 €/t (8,755) davano 8,75, e capita a circa un mezzo centesimo
vero su dieci. Chi aggiunge un costo all'intervento lo arrotonda allo stesso
modo in tutti e quattro i posti. Prova: `prove/passivaGrana.mjs`.

### Pesi

Le valutazioni si fanno sul peso effettivo (`peso_effettivo`), mai sullo stimato.
Tonnellate con due decimali, tre se i kg non sono tondi; kg sempre interi;
ovunque, export compresi.

**Gli importi nelle pagine dei soldi** (11/10/2026): euro a due decimali
all'italiana con `euro()` di `src/lib/formatoSoldi.js` («€ 372.976,50»), «—» se
il valore manca, mai `(v || 0).toFixed(2)`. I prezzi unitari con
`prezzoUnitario()`, da due a quattro decimali (0,202 al chilo, 202,00 a
tonnellata). `prove/numeriDeiSoldi.mjs` cade se una pagina della fatturazione o
dell'extra raccolta usa `.toFixed(`.

**Anche il Report Mensile** (11/10/2026): `calcolaPivot` arrotonda ai kg (tre
decimali), non ai dieci kg; la tabella scrive il peso con `formatTonnellate` e i
viaggi con `formatIntero`; il CSV scrive le tonnellate all'italiana, col punto
delle migliaia, e lascia **vuota** una cella senza movimenti (prima ci scriveva
0). Prima 12.345 kg erano 12,35 t li' e 12,345 t ovunque altrove. Prova:
`prove/reportMensileFormato.mjs`.

### Come si legge un movimento: un punto solo

`base44/shared/movimenti.ts` (specchio per le pagine: `src/lib/movimenti.js`).
Chi deve decidere se un movimento conta, in che mese e in che canale lo chiede
li', e non riscrive la regola:

- `eTerminato(r)`: conta solo un movimento terminato;
- `periodoMovimento(r)`: giorno, anno, mese e settimana ISO dalla **fine del
  trasporto sul giorno italiano**; `filtraMovimenti(records, { anno, mese, canale })`;
- `annoSettimanaIso(giorno)` / `annoPerFiltro(giorno, conSettimana)`: con una
  settimana scelta l'anno del filtro e' quello della **settimana ISO**, non
  quello del giorno; con il solo anno vale il giorno, come sempre (11/10/2026).
  La settimana 53 del 2026 va dal 28/12/2026 al 03/01/2027, e la settimana 1 del
  2026 comincia il 29/12/2025: con l'anno del giorno, «2026, settimana 53»
  perdeva l'1, il 2 e il 3 gennaio. La regola sta in quattro punti che devono
  dire lo stesso numero: il dettaglio di `Secondarie.jsx`, KPI e matrice
  (`computeSecondarieMatrix`), il file (`exportSecondarie`) e le pivot
  (`pivotCalculator.ts`, oggi non usato). Prima la correggeva solo il dettaglio,
  e la stessa pagina diceva 2 viaggi nella tabella e 1 nei KPI. Prova:
  `prove/settimanaIso53.mjs`, che fa girare le tre parti sugli stessi movimenti;
- **Le Verifiche usano la settimana ISO intera** (prova del cambio d'anno del
  15/10/2026, difetto 14; D1, decisione dell'utente del 15/10/2026).
  `intervalloSettimana` (in `base44/shared/reportSettimanali.ts` e, uguale, in
  `src/lib/verifiche.js`: due copie di una funzione, non uno specchio di file,
  quindi `prove/specchi.mjs` non le controlla e lo fa
  `prove/reportSettimanali.mjs`) va da lunedi' a domenica senza fermarsi al
  31/12. La 53 del 2026 va dal 28/12/2026 al 03/01/2027, la 1 del 2026 comincia
  il 29/12/2025. `settimaneNellAnno` e' la settimana del 28 dicembre: il 2026 ne
  ha 53, il 2027 52. `chiusuraMese.settimaneDelMese` mette la 53 del 2026 in
  dicembre 2026 e in gennaio 2027, e la 1 del 2026 anche in dicembre 2025.
  `soggettiDellaSettimana` guarda l'anno ISO. Le arretrate vanno in ordine di
  calendario («53, 1»). Prima l'1, il 2 e il 3 gennaio 2027 non stavano in
  nessuna verifica, e un formulario di sabato 02/01 omesso dal report non era
  «assente» da nessuna parte. Le verifiche salvate partono dalla 37 del 2026,
  quindi nessuna chiave cambia. Prove: `prove/reportSettimanali.mjs`,
  `prove/chiusuraMese.mjs`, `prove/settimanaIso53.mjs`;
- `giornoElenco / annoElenco / meseElenco`: per gli elenchi e i loro filtri di
  giorno, mese e anno, che mostrano anche ordini senza trasporto. Un terminato
  si colloca solo sulla fine trasporto; un ordine non terminato all'immissione.
  Un **terminato senza fine trasporto** non ha giorno, mese ne' anno: nessun
  filtro di periodo lo prende, e la pagina lo conta e lo segnala a parte. Mai la
  chiusura a portale;
- `giornoOrdine / annoOrdine / meseOrdine`: ripiegano sull'immissione anche per
  un terminato senza fine trasporto. **Non** servono agli elenchi: restano solo
  per chi attribuisce apposta all'anno di immissione il conteggio dei senza fine
  (per esempio esportazioni, giacenze e qualifica: `grep annoOrdine` dice chi);
- `canaleMovimento(r, archivio)`: rete, ACI (con `eAci`) o extra raccolta;
- `regioneDi(r)` (`base44/shared/regioneMovimento.ts`, 11/10/2026): la regione
  di un ritiro e' quella della **provincia**, poi il campo `regione` (che
  `enrichRecord` riscrive dalla provincia a ogni caricamento), e la colonna
  «Regioni» del file solo se non c'e' altro. Il Report Mensile ed EcoTyna
  leggevano per primo il campo del file, che non si ricalcola mai: lo stesso
  ritiro poteva stare in una regione li' e in un'altra nella Dashboard. Prove:
  `prove/strumentiRegione.mjs`, `prove/reportMensileFormato.mjs`;
- `ingressoMovimento(r, archivio, chiaveDi)`
  (`base44/shared/ingressoMovimento.ts`, senza specchio: lo usano le funzioni):
  DOVE entra un movimento, cioe' chi lo riceve, con che ruolo e canale, e per
  secondarie e terziarie da dove parte. Il periodo, lo stato e che cosa sommare
  restano di chi legge. Vedi «Giacenze e Dichiarazioni», punto 9;
- `eEseguito(r)`: il limbo del portale, dati tutti inseriti e Chiudi non premuto.
  Non si somma ai terminati, si conta a parte e **si segnala**;
- `eCancellato(r)` e `motivoCancellazione(r)`: lo stato si confronta per intero, e
  il motivo si legge in un modo solo ("altro: pdr doppio" diventa "Pdr doppio"),
  cosi' Evasione Assegnati e la to-do list non lo scrivono in due modi.

Per la **classe e il canale insieme** c'e' `canaleEClasse(r, { aci })` in
`base44/shared/giacenzaStoccaggi.ts`, con l'invariante **canale ACI se e solo se
classe ACI**: usa lo stesso `eAci`, cosi' il canale resta quello canonico. Il canale
lo decide il **materiale**, non l'archivio in cui la riga sta (decisione
dell'utente, 28/09/2026): una primaria di classe 9 e' ACI anche se si trovasse nei
Terminati Rete. Oggi non capita - `importaBlocco` rifiuta il blocco il cui archivio
non torna con `archivioPrimaria` - quindi e' una **rete di sicurezza**, non la
provenienza normale: non va raccontata a video come se lo fosse. E dove la regola
vale, vale in **tutte** le colonne della stessa pagina: giacenza, conferito,
residuo, percentuale del target e segnalazioni sulle date. La stessa riga che e' ACI
in una colonna e rete in quella accanto e' un difetto, anche se i numeri sembrano
plausibili.

Anche «oggi» e' il giorno italiano (`oggiRoma()`), non `new Date()` del server.
E nessun modulo si fa una correzione sua del giorno: il report settimanale ne
aveva una che riportava al giorno italiano solo le ore 22:00 e 23:00 tonde, e un
trasporto finito alle 23:30 UTC del 30 giugno restava a giugno li' e andava a
luglio altrove (audit del 10/10/2026). Si usa `giornoRoma`. Nella stessa prova
(`prove/indicatoriVeri.mjs`) due avvisi che dicevano il falso: la matrice delle
province contava **il mese in corso come un mese vuoto** (il primo del mese,
due mesi senza raccolte per un mese cominciato da un giorno), e la regex dei
nomi dei raccoglitori era `/s+/` e toglieva le lettere «s» invece degli spazi.
Contando solo i mesi finiti, pero', la coppia **novembre-dicembre** non la vedeva
piu' nessuno (a dicembre il mese non e' finito, a gennaio l'anno e' cambiato):
a gennaio e febbraio la matrice guarda anche novembre e dicembre dell'anno prima,
per le province che l'anno prima lavoravano, e il motore di alert le passa tutti
i ritiri, non solo quelli dell'anno. La matrice di Verifiche conta anche lei solo
i mesi finiti, e quella delle Primarie non colora di rosso il mese in corso
(revisione del 10/10/2026).

**Le province del contratto stanno nella matrice anche senza ritiri** (segnalazione
alta del 20/09, corretta il 12/10/2026). `provinceDelContratto(commessa, anno)`
(`primarieReteAnalytics.ts`) legge la colonna «Province» del riparto per regione:
«Tutte le provincie» o vuota = tutta la regione, altrimenti le sigle; il riparto
di ripiego non da' province. `computeProvinceMatrixData(records, mese, {
commesse })` mette a zero quelle senza ritiri (`del_contratto`, `senza_ritiri`),
e da marzo una provincia mai servita ha i suoi due mesi a zero come le altre.
Senza `commesse` la matrice e' quella dei movimenti. Dal 13/10/2026 la funzione
della pagina (`computeProvinceMatrix`) legge `CommessaEcotyre` insieme ai ritiri
e li passa; se i contratti non si leggono la pagina resta su con la matrice dei
soli movimenti, risponde `contratto_letto: false` e la tabella lo dice.
`ProvinceMatrix.jsx` segna la riga «del contratto, nessun ritiro nell'anno». I
contratti alla matrice li passa anche il motore degli alert (vedi «Il motore
degli alert al cambio d'anno»), e la dashboard usa `provinceDelContratto` per le
province ferme (vedi «La dashboard»). Prova: `prove/provinceDelContratto.mjs`.

Dal 13/10/2026 anche la matrice di Verifiche (`matriceProvinceRete`, sezioni 3
e 4) legge `CommessaEcotyre` insieme ai ritiri, una lettura in piu' per la
pagina. Aggiunge con kg e ritiri a zero le province di
`provinceDelContratto(commessaDellAnno(commesse, anno), anno)` dell'anno
mostrato. Ogni riga porta `del_contratto` e `senza_ritiri`, e se i contratti non
si leggono la risposta dice `contratto_letto: false`. `MatriceProvince.jsx`
segna la riga «del contratto, nessun ritiro nell'anno» e nel riquadro delle
province ferme usa la stessa frase al posto dei mesi. La tessera «Province con
ritiri» conta solo le righe con ritiri. Il sottotitolo dell'Excel e del PDF
elenca le province a zero, e un contratto non letto si dice nel riquadro ambra e
nel file. Sui dati veri dell'11/10 non cambia niente: le 23 province del
contratto 2026 hanno tutte ritiri. Prova: `prove/matriceProvinceVerifiche.mjs`,
con la funzione sul banco e la vista disegnata con React lato server. La vista
carica i dati in un effetto, che lato server non gira: lo stato iniziale (dati,
anno, caricando) lo passa un `useState` finto che legge una coda
(`globalThis.__STATI_INIZIALI`). Il finto vale solo per i file di `src/`, e
react-dom tiene il React vero. Si puo' riusare per le altre viste che caricano
in un effetto.

**Due correzioni a mano dello stesso genere, tolte l'11/10/2026.**
`src/lib/esportaTabella.js` riportava al giorno italiano solo le 22:00 e le
23:00 tonde, e le date dei PDF e degli Excel di dettaglio uscivano un giorno
prima per un trasporto finito alle 23:30 UTC; la scheda dell'extra raccolta
(`giornoDaData` in `src/lib/extraRaccoltaStato.js`) sbagliava le 22:00 UTC
d'inverno e le ore fra le 22 e mezzanotte UTC d'estate. Ora usano `giornoRoma`
tutte e due. Prove: `prove/esportaTabellaGiorno.mjs`,
`prove/extraRaccoltaStato.mjs`.

Gli specchi in `src/lib` devono restare identici agli originali: lo controlla
`prove/specchi.mjs`. **Prima di spingere: `npm run lint` e `npm run prove`.**

## Regole della commessa

Regole di dominio che il codice deve rispettare sempre. Valgono per ogni nuovo
conto, filtro, export o assistente: se una modifica le viola, e' sbagliata anche
quando "funziona".

### Chi conferisce dove

Un movimento non va da chiunque a chiunque, e ci sono due livelli.

**Chi ha un sito proprio conferisce in primaria solo li'.** Green Tyre Project a
Green Tyre Project, Nappi Sud a Nappi Sud, Gatim a Gatim. Una primaria di Nappi
Sud verso Tecnogum non esistera' mai: agli altri impianti ci arriva in
secondaria, dove non e' piu' un raccoglitore ma il produttore. Una rotta del
genere va segnalata anche se fossero cento viaggi - non e' rara, e' impossibile.

**Chi non ha un sito proprio stocca presso terzi** e puo' avere piu' di una rotta
buona: C.L. Service stocca sia a Nappi Sud (59 viaggi) sia a T-Cycle (33),
Emmesse conferisce a Irigom (24) e a Gatim (6). Per costoro vale una soglia: una
destinazione sotto il 5% dei loro viaggi e sotto i cinque viaggi e' sospetta.

Il controllo sta in `base44/shared/rotteConferimenti.ts`, legge le rotte dalla
storia dell'anno e non ha bisogno che nessuno le scriva a mano.

### Gli impianti che svuotano la giacenza dell'anno prima

Un impianto puo' non essere piu' contrattualizzato nell'anno in corso e avere
lo stesso movimentazioni e dichiarazioni: deve svuotare la giacenza dell'anno
precedente, e lo fa con secondarie e terziarie (regola dell'utente, 23/09/2026).
Nessun modulo che parla di giacenze, dichiarazioni, verifiche o fatturazione puo'
escludere un sito perche' non ha un contratto quest'anno: si escludono solo dai
target e dalla predittivita', che sono cose dell'anno in corso.

**La regola vale per chi ha movimenti NOSTRI**, cioe' con SMOCO partner
operativo (utente, 10/10/2026: «considera sempre come partner operativo Smoco e
non altri»). Il 23/09 qui si citavano INNOREC e PRT come esempi: PRT invece non
compariva per dei movimenti, ma per una rilevazione del piazzale tutta a zero
entrata col caricamento iniziale del 13/09 (`seedGiacenzeStoccaggio`), preso dal
file del portale senza guardare il partner. Non e' contrattualizzato nel 2026 e da
anni non ha movimenti con SMOCO: dal 10/10/2026 e' fuori. Un piazzale si toglie da
Giacenze > Stoccaggi, «Elimina unita' locale», che cancella tutte le sue
rilevazioni: e' da quelle che lo leggono le Giacenze, la chiusura d'anno (che
altrimenti chiederebbe la sua lettura del 31/12 e gli creerebbe una riga
dell'anno dopo) e la lista dell'anno nuovo.

### Su quali tonnellate si paga ciascuna prestazione

**La raccolta si paga a chi ha raccolto.** La base sono le tonnellate dei
formulari di quel raccoglitore, nel canale giusto, nel mese in cui e' finito il
trasporto.

**Stoccaggio e trattamento si pagano su tutto cio' che arriva al sito**, anche
quando l'ha portato un altro. Se Nappi Sud raccoglie 100 t e sul suo piazzale
conferiscono altri raccoglitori per 30 t, a Nappi Sud si pagano 100 t di raccolta
e 130 t di stoccaggio. Su Gatim conferisce anche Emmesse, e il conferito di
Emmesse si somma in fattura a quello che Gatim ha raccolto e trattato. Il "di
cui" sotto ogni riga di impianto o stoccaggio dice chi ha portato cosa, cosi' la
differenza resta visibile invece di sparire in un totale.

I canali restano separati anche quando il prezzo e' lo stesso: lo stoccaggio di
Nappi Sud costa 16 euro la tonnellata sia sulla rete sia sull'ACI, e sono due
righe, non una.

**Il prezzo unico.** Di regola raccolta e trattamento sono due prestazioni con
due prezzi. L'eccezione si dichiara sulla tariffa di raccolta col flag
`comprensiva_trattamento`: allora il trattamento presso l'impianto dello stesso
fornitore non si fattura a parte e in fatturazione compare come «compreso nel
prezzo unico». Nel 2026 riguarda solo Green Tyre Project sull'ACI, 225 euro la
tonnellata. Se per lo stesso fornitore e canale esistono sia il prezzo unico sia
una tariffa di trattamento, il gestionale lo segnala: si pagherebbe due volte.

**Il prezzo puo' dipendere dalla zona o dalla destinazione.** La cascata e'
destinazione, provincia, regione, generica. La raccolta ACI di Nappi Sud costa 82
euro in Basilicata e 92 in Campania, e la regione si legge dalla provincia del
demolitore a cui afferisce il formulario; la raccolta di Emmesse costa 72 euro se
scarica a Gatim e 90 se scarica a Irigom. In fatturazione la destinazione sta in
colonna e la riga porta il criterio con cui la tariffa e' stata scelta.

### Quando una tariffa vale, e con che unita' (11/10/2026)

**Una regola sola, `tariffaValeIl` in `base44/shared/validitaTariffa.ts`**
(specchio in `src/lib`). La usano fattura attiva, passiva, foglio
dell'amministrazione e lista dell'anno nuovo. Prima erano quattro letture
diverse: fattura e passiva tenevano una tariffa `non_attivo` se aveva una data
di fine, foglio e lista la scartavano, e la passiva scartava una tariffa senza
stato e senza date, che il foglio teneva. Adesso:

- **`non_attivo` non vale mai**, nemmeno dentro la sua finestra;
- lo stato vuoto e' `attivo`;
- la finestra si confronta col giorno italiano, estremi compresi.

Rinegoziare un prezzo CHIUDE la tariffa vecchia con la data di fine e la lascia
`attivo` (`gestisciAnagrafiche`, dal 19/09). Se una tariffa disattivata con la
data di fine tocca il mese, attiva e passiva lo dicono con l'anomalia
`tariffa_disattivata`: un prezzo non sparisce in silenzio. Chi vuole che valga
la rimette attiva.

**Le tariffe non si leggono con `{ stato: 'attivo' }`**: si perderebbero quelle
con lo stato vuoto, che valgono. Si legge tutto e si toglie in memoria solo la
disattivata (`tariffaNonDisattivata`): lo fanno `controlloRotte`, la scheda
dell'intervento di extra raccolta (`tariffaPassivaProposta` in
`src/lib/extraRaccoltaCalc.js`, con `tariffaValeIl` sul giorno italiano) e lo
strumento `tariffe` di EcoTyna.

**Le unita'.** In anagrafica, sulle attive come sulle passive
(`controlliUnitaTariffa`), un prezzo sopra 10 €/kg o sotto 1 €/t e' un errore.
Un'unita' che il calcolo non sa leggere fa **una riga a zero, ma detta**: la
nota «unita' … sconosciuta: riga a zero» e l'anomalia `unita_sconosciuta`. Prima
la passiva metteva uno zero muto e la fattura moltiplicava i chili, cioe' mille
volte il dovuto. Nel foglio dell'amministrazione un prezzo al chilo diventa a
tonnellata anche sui trasporti e sulle voci proposte.

**I conflitti fra tariffe** stanno in `base44/shared/conflittiTariffa.ts`, che
usano sia `gestisciAnagrafiche` sia «Prepara le tariffe». Il fornitore e' lo
stesso **per id o per nome normalizzato**, come per la passiva; destinazione,
produttore e destinatario si confrontano normalizzati, e la direzione vuota vale
PASSIVA. Cosi' «GATIM» e «GATIM S.R.L.» non possono avere due prezzi per lo
stesso periodo. L'elenco delle tariffe segna «Duplicata» con la stessa chiave
(`src/lib/conflittiTariffa.js`). Prove: `prove/validitaTariffa.mjs`,
`prove/controlloRotteTariffe.mjs`, `prove/strumentiTariffe.mjs`.

**Le tariffe di rete e ACI sono annuali anche in anagrafica** (prova generale
del cambio d'anno, 15/10/2026, difetto 7). `controlliPeriodoTariffa` in
`validitaTariffa.ts` (specchio in `src/lib`): RETE, ACI e TUTTE, attive e
passive, vogliono inizio e fine, e la fine al piu' il 31/12 dell'anno di inizio.
Altrimenti `gestisciAnagrafiche` risponde 400 con `campo` ed `errori`, in create
e in update, sul record com'e' dopo il salvataggio: anche cambiare il solo
prezzo di una rete rimasta aperta chiede la fine. L'extra raccolta resta
libera, e una tariffa disattivata non si controlla. `TariffeForm` propone come
«Al» il 31/12 dell'anno del «Dal» e mostra l'errore sotto il campo. «Riapri»
(`fineRiapertura`) riapre una rete o ACI al piu' fino al 31/12 del suo anno, e
una tariffa gia' al 31/12 non si riapre sull'anno dopo: l'anno nuovo ha bisogno
della sua. Prima una tariffa senza fine valeva l'anno dopo in silenzio (il
10/02/2028 gennaio si fatturava a 205 €/t senza un avviso) e la lista del nuovo
anno la contava «pronta». **Una prova che crea una rete o ACI la scrive con la
fine**, altrimenti riceve 400 (`prove/anagraficheDoppioni.mjs` e
`prove/storicoModifiche.mjs` sono state corrette cosi').

### Il surplus sulle tariffe (12-13/10/2026)

Richiesta dell'utente del 12/10/2026, testuale: *«occorre avere una colonna
laddove ci sono le tariffe che mensilmente diamo ai nostri fornitori per
indicare un eventuale surplus, inteso sempre come €/t, da dare loro qualora il
consorzio o eventuali altri accordi commerciali lo indichino, indicando date di
inizio e fine validità. [...] ci sarà in entrambi i casi una riga con l'importo
standard ed una per il surplus (sempre riferito alle stesse tonnellate raccolte
o trattate nel mese)»*, tutto «in modo ordinato, elegante e professionale
nonché semplice a colpo d'occhio». Il primo caso e' il **Fuel Surcharge** del
consorzio Ecotyre: +5 €/t a tutti i raccoglitori dal 01/10/2026 al 31/12/2026.
Risposte gia' date lo stesso giorno: vale su rete, ACI ed extra raccolta, ognuno
con la sua riga e mai sommati; SMOCO fattura a Ecotyre gli stessi 5 €/t e li
paga ai raccoglitori.

**Il gestionale lo fa dal 13/10/2026**, su un progetto del 12/10 rimasto fuori
dal repository
(`C:\Users\HOME\AppData\Local\Temp\claude\C--Users-HOME-Desktop-BASE44\fefffb82-6ab8-42f5-a5f9-6921a1f0fff7\scratchpad\surplus\progetto.md`).
Le righe standard non cambiano: il surplus e' una riga in piu', sotto ogni
fornitore nella passiva e una per canale nell'attiva, sulle stesse tonnellate,
che non si contano due volte da nessuna parte. Senza surplus ogni conto dice gli
stessi numeri di prima, e lo controllano le prove di ogni modulo;
`prove/datiVeri.mjs` resta 158/158, perche' il surplus non tocca Giacenze e
Dichiarazioni. Quando il Fuel Surcharge sara' scritto, coi dati dell'11/10/2026:
ottobre fin qui, rete, +1.183,25 € ai raccoglitori su 236,65 t esterne (le
85,18 t di SMOCO non si pagano) e, stima del progetto, +1.609,15 € in attiva;
ACI ed extra raccolta di ottobre non avevano ancora terminati. Con le
tonnellate di settembre come esempio di un mese intero: rete +5.601,20 € in
attiva, +4.332,80 € a nove raccoglitori, margine +1.268,40 € (253,68 t di
SMOCO x 5); ACI +94,45 €, +69,95 €, margine +24,50 €; extra raccolta nessun
intervento.

#### Le domande del progetto: decise il 13/10/2026 sera

Il giro e' stato fatto con le proposte del progetto. Il 13/10/2026 sera
l'utente ha accettato quelle sulle domande nuove (le cinque regole del
paragrafo che segue) e poi ha deciso le altre: dove serve con parole sue, per
il resto si affida *«alla tua professionalità e alla capacità di rendere
questo gestionale sempre più performante»*. Le proposte sono quindi regole, e
nessuna domanda del surplus resta aperta tranne la forma della prefattura.
- **D1, la prefattura: si sapra' il 04/11/2026.** Come il portale portera' il
  Fuel Surcharge nella prefattura lo dira' quella di ottobre, attesa per il
  04/11/2026. Il confronto riconosce gia' le quattro forme (vedi «Il surplus
  nella prefattura»); se Ecotyre lo comunica fuori dalla prefattura, il
  confronto lo scrive e non lo conta (regola 3).
- **D2, le tonnellate di SMOCO.** Ecotyre paga il surplus su tutto il canale e
  SMOCO, che sulle sue tonnellate e' il raccoglitore, non lo paga a nessuno:
  resta a SMOCO, e il margine sale.
- **D3, i tre report dell'amministrazione dell'attiva: FATTA il 13/10/2026 sera.**
  L'utente: il Fuel Surcharge *«deve essere una voce disgiunta con un proprio
  rigo (per canale)»*. Una riga per surplus sotto i formulari, con la Quantita'
  vuota, il totale dei soli formulari e il TOTALE che la comprende (vedi «La
  fatturazione attiva verso Ecotyre»).
- **D4, i fornitori.** Il surplus arriva come riga a parte nello stesso
  consuntivo del mese.
- **D5, la base di Ecotyre**: comprende le tonnellate «Trasp.» (Tecnogum).
- **D6, i subraccoglitori**: il surplus delle loro tonnellate va al principale
  che le fattura, come la tariffa.
- **D7, un mese chiuso**: il gestionale lo segnala e non riapre niente; si fa
  la fattura integrativa del solo surplus. Dal 13/10/2026 sera il mese e'
  «gia' fatturato» anche con l'attiva approvata o esportata (regola 2).
- **D8, chi legge**: deciso il 13/10/2026 sera. `SurplusTariffa` lo legge solo
  l'amministratore, e a chi non lo e' la parte attiva arriva dalla funzione
  `leggiSurplus` (vedi «Chi legge il surplus»). Prima la lettura era aperta
  come quella di `Tariffa`.

Le due domande nuove sono chiuse lo stesso giorno. Il campo «Riferimento» resta
generico: la comunicazione del consorzio l'ha ricevuta il responsabile
dell'utente. Il TOTALE QUANTITA' dei file dell'elenco dell'extra raccolta conta
solo i chili fatturati, e le secondarie hanno una riga loro (vedi «Il surplus
nell'extra raccolta»). Quella sui costi mostrati a chi non e' amministratore e'
chiusa il 13/10/2026 (vedi «I costi dei fornitori sono dell'amministratore»).

**Il Fuel Surcharge e' dei raccoglitori, sulle sole primarie** (decisioni
dell'utente del 13/10/2026 sera, testuali): *«il surplus per il fuel surcharge
riguarda solo le primarie, quindi va a favore dei soli raccoglitori; per
l'extra raccolta noi fatturiamo al consorzio solo le primarie con eventuali
surplus [...]; le eventuali secondarie di extra raccolta saranno trattate come
normali trasporti di secondaria con il loro €/t oppure €/viaggio a seconda del
tragitto e dei contratti»*, e *«il fuel surcharge non riguarda i produttori ma
i trasportatori ovvero i raccoglitori, su questo non ci devono essere
confusioni»*. Il Fuel Surcharge scritto dall'utente (rete, ACI ed extra
raccolta; la raccolta, a tutti i raccoglitori; +5/+5 €/t; dal 01/10 al
31/12/2026) e' gia' cosi', e non si tocca. Il motore sa ancora un surplus su
trattamento, stoccaggio o trasporto delle secondarie: serve a un accordo
commerciale che lo chieda, mai al Fuel Surcharge.

#### Le risposte del 13/10/2026 sera: cinque regole

L'utente, dopo aver pubblicato: *«rispondo alle Domande nuove del surplus:
accetto i tuoi consigli»*. Le proposte accettate sono regole:
1. **Un raccoglitore senza la tariffa del mese riceve lo stesso il surplus**
   sulle sue tonnellate, con l'avviso che la tariffa manca. Vale anche per
   trattamento e stoccaggio; la riga standard resta «senza tariffa» a zero,
   con la sua anomalia (vedi «La passiva, il congelamento e i consuntivi»).
2. **L'avviso «mese gia' fatturato»** al salvataggio di un surplus scatta anche
   quando l'attiva del mese e' approvata o esportata, non solo chiusa, oltre
   che con la passiva congelata (vedi «Il salvataggio»).
3. **Il Fuel Surcharge comunicato fuori dalla prefattura** il confronto lo
   SCRIVE soltanto: non e' una differenza, e l'esportazione non chiede conferma
   per lui ogni mese (vedi «Il surplus nella prefattura»).
4. **La riga del Fuel Surcharge anche nei file Excel e PDF dell'elenco
   dell'extra raccolta** (vedi «Il surplus nell'extra raccolta»).
5. **La scorciatoia «Fuel Surcharge del consorzio» vale anche negli anni
   dopo**, con le date da confermare ogni anno. Non si copia mai da sola
   nell'anno nuovo: i contratti sono annuali (vedi «La pagina delle tariffe»).

**Dove si scrivono i surplus.** Dopo la pubblicazione l'utente non ha trovato
la sezione: *«non ho trovato la voce 'surplus'»*. Sta in **Fatturazione ›
Tariffe & Anagrafiche, linguetta «Surplus»**, accanto a «Tariffe». La scheda
ci metteva circa 14 secondi ad aprirsi, e senza un surplus in corso in cima non
c'era niente che lo dicesse. Ora si apre subito, appena letti i surplus ha
sempre la sua fascia, e si raggiunge col collegamento
`/fatturazione?tab=tariffe&sezione=surplus` (vedi «La pagina delle tariffe»).

#### L'archivio e il motore

**Un archivio a parte, `SurplusTariffa`, non un campo della Tariffa.** Un
lettore che se ne dimentica fa MANCARE un surplus, e la mancanza si vede come
differenza; un record «surplus» dentro Tariffa, dimenticato da un filtro,
diventerebbe invece il prezzo della rete. In piu' lo stesso surplus vale per
decine di tariffe e per l'extra raccolta, che tariffe non ne ha, e la copia
dell'anno nuovo (`preparaAnno`) non lo porta nel 2027.

**Un record = un surplus su un canale** (RETE, ACI, EXTRA_RACCOLTA, mai TUTTE),
e i canali dello stesso surplus hanno lo stesso `gruppo`. I campi: `nome` (la
descrizione della riga in fattura), `origine` (CONSORZIO o
ACCORDO_COMMERCIALE), `riferimento`, `prestazione` (come la tariffa), `a_chi`
(`tutti` o `elenco`, con `fornitori_json` `[{ id, nome }]`), `euro_t_passiva`
(quanto SMOCO paga al fornitore, un costo), `euro_t_attiva` (quanto SMOCO
fattura a Ecotyre), le due date, tutte e due obbligatorie, e `stato`. Un
importo vuoto vuol dire niente in quella direzione: un accordo commerciale puo'
essere solo passivo.

**Le regole stanno in `base44/shared/surplus.ts`** (specchio `src/lib/surplus.js`)
e non si riscrivono altrove:
- **Quando vale**: `surplusValeIl` e' `tariffaValeIl`, cioe' il giorno italiano
  della fine del trasporto, estremi compresi; `non_attivo` non vale mai. Si
  legge tutto e si toglie in memoria il disattivato (`surplusNonDisattivati`),
  mai `{ stato: 'attivo' }`.
- **I giorni di un periodo si confrontano come testo** (`surplusTocca`,
  `surplusNelPeriodo`; revisione del 13/10/2026). La fine del mese si puo'
  passare `${anno}-${mm}-31` anche nei mesi di 30 giorni, la stessa stringa che
  va a `disattivateNelPeriodo`, e solo un estremo vuoto e' aperto. Prima
  '2026-09-31', letto come data di calendario, diventava «senza fine», e a
  settembre risultava gia' in corso il Fuel Surcharge che comincia il 01/10. Non
  si rileggono quegli estremi con `new Date` o con un controllo di calendario.
- **A chi**: `valePerFornitore` riconosce il fornitore per id o per nome
  normalizzato («GATIM» e «GATIM S.R.L.» sono lo stesso). Un elenco vuoto non
  vale per nessuno. L'interno non riceve il surplus passivo: lo decide chi
  calcola.
- **Per un movimento**: `surplusDelMovimento(surplusAll, { tipologia,
  prestazione, quando, fornitore, fornitori? }, 'PASSIVA'|'ATTIVA')`. Nella
  passiva la prestazione e' obbligatoria. Nell'attiva no: vale su tutte le
  tonnellate fatturate del canale, mai sul trasporto delle secondarie; con un
  elenco il fornitore si da' per prestazione (`fornitori`): il raccoglitore per
  la raccolta, la destinazione per trattamento e stoccaggio.
- **Quanto**: `importoSurplus(kg, euro_t)`, al centesimo di Excel, una volta sui
  chili del fornitore (passiva) o del canale (attiva) nel mese. Mai formulario
  per formulario: a settembre 2026 la rete farebbe 5.601,22 invece di 5.601,20.
- **Al salvataggio**: `controlliSurplus` restituisce errori e avvisi col campo
  che li causa. Le due date, con la fine entro il 31/12 dell'anno di inizio
  (contratti annuali senza tacito rinnovo); almeno un importo, ciascuno almeno
  0,01 €/t, e sopra 50 €/t un avviso («e' un surplus o un prezzo?»); niente
  parte attiva sul trasporto delle secondarie, che non si fatturano a Ecotyre;
  «tutti» senza elenco e «solo questi» con almeno un fornitore.
- **I conflitti**: `conflittiSurplus`. Stesso nome normalizzato, stesso canale,
  giorni in comune, e in piu' stessa prestazione con un fornitore in comune,
  oppure parte attiva su tutti e due: e' lo stesso surplus due volte, 409,
  perche' si pagherebbe due volte. E' chiudibile solo se l'esistente comincia
  prima, non finisce dopo, ha la stessa prestazione e il nuovo copre tutti i suoi
  fornitori: si chiude il giorno prima dell'inizio del nuovo (`giornoPrimaDi`).
  Nomi diversi sulle stesse tonnellate sono un avviso, e si pagano tutti e due,
  ognuno con la sua riga.
- **In pagina**: `surplusDellaTariffa` per la colonna «Surplus» (solo i surplus
  nei giorni della tariffa, niente sulle disattivate), `statoSurplus`,
  `etichettaSurplus` («Fuel Surcharge (consorzio Ecotyre), dal 01/10/2026 al
  31/12/2026»), `periodoSurplus`, `testoEuroT`, i nomi di canali, prestazioni e
  destinatari, `mesiDelSurplus` e `surplusNelPeriodo` per i mesi toccati.

Sui dati veri dell'11/10/2026 il Fuel Surcharge tocca 29 tariffe: 22 di
raccolta (17 rete, 5 ACI) e le 7 attive; nessuna di trattamento, stoccaggio o
trasporto. Prova: `prove/surplus.mjs`.

**Lo storico.** Ogni scrittura passa da `traccia` (`CAMPI_TRACCIATI.SurplusTariffa`,
vedi «Lo storico delle modifiche»). Un `SurplusTariffa` senza `euro_t_attiva`
> 0, cioe' un accordo pagato solo da SMOCO, e' riservato in ogni campo, come una
Tariffa passiva; con l'importo da Ecotyre resta riservato solo
`euro_t_passiva`. La regola sta in `campoRiservato` (`campiTracciati.ts` e
specchio), e chi mostra i surplus a chi non e' amministratore fa lo stesso.
Prove: `prove/storicoModifiche.mjs` sezione 8, `prove/surplus.mjs` sezioni 5, 7
e 8.

#### Chi chiama un calcolo legge SurplusTariffa

Il surplus sta in un archivio a parte e nei calcoli il suo argomento e'
facoltativo: chi chiama `calcolaPassivaMese`, `calcolaRigheAttiva`,
`calcolaMargineAnno` o `contestoPrezzi` senza passarglielo ottiene i numeri
senza la riga del surplus, e nessun errore. E' il prezzo della scelta
dell'archivio a parte. `prove/surplusLetture.mjs` cerca ogni chiamata in
`base44/functions`, `base44/shared` e `src`, e pretende che passi il surplus nel
campo che il calcolo legge: `surplusAll` per la passiva, `surplus` o
`surplusAll` per l'attiva e il margine, il terzo argomento per `contestoPrezzi`.
Un `{ surplus: x }` dato alla passiva si perderebbe in silenzio. Il surplus
passato deve venire da una lettura di `SurplusTariffa` nel file, oppure da chi
chiama la funzione che lo riceve come parametro (il margine lo riceve da
`calcolaMargine`). Dal 13/10/2026 vale come lettura anche la chiamata di
`leggiSurplus` di `src/lib/leggiSurplus.js`, importata col suo nome o con un
altro: e' la strada delle pagine che servono anche a chi non e'
amministratore. Fanno fallire la prova anche un surplus vuoto scritto a mano,
un alias o una riesportazione che la guardia non segue, un riferimento senza
chiamata e una lettura di `SurplusTariffa` con un filtro sullo stato.
- Le chiamate senza surplus stanno in `SENZA_SURPLUS` col loro motivo, di due
  tipi: per natura (il contesto vuoto di `extraRaccoltaCalc.js`) o da portare,
  cioe' un debito scritto nel codice e detto a video. Dal 13/10/2026 sera
  l'elenco da portare e' vuoto: l'unico debito erano i file Excel e PDF
  dell'elenco dell'extra raccolta, che ora hanno la riga del surplus e ricevono
  il contesto della pagina (regola 4). Un'eccezione che non serve piu' fa
  fallire la prova.
- Chi aggiunge un calcolo che fa numeri col surplus lo aggiunge a `CALCOLI`.
- La guardia prova anche se stessa su sorgenti costruiti, e si lancia su
  un'altra copia del repository con `node prove/surplusLetture.mjs <cartella>`:
  e' cosi' che si fa la controprova su HEAD.

#### Il salvataggio: solo da gestisciAnagrafiche

Il surplus si scrive solo da `gestisciAnagrafiche`, entita' `SurplusTariffa`, e
solo l'amministratore lo scrive. Payload: `{ operazione, id? | gruppo?, dati,
motivo?, anteprima? }`. Ogni record passa da `traccia`.
- **Un record per canale, lo stesso `gruppo`.** `create` riceve
  `dati.tipologie` (rete, ACI, extra raccolta), con `importi_per_canale` quando
  gli importi cambiano fra i canali. `update` e `delete` lavorano su un canale
  con `id`, o su tutto il surplus con `gruppo`; in un `update` col gruppo,
  `tipologie` crea i canali aggiunti ed elimina con traccia quelli tolti.
- **Un gruppo ha una riga per canale** (revisione del 13/10/2026). La modifica
  di tutti i canali insieme e la scheda unica della pagina contano su questo.
  Una creazione, o una modifica con id che sposta un record, che metterebbe una
  seconda riga su un canale che il gruppo ha gia' si ferma con 400 (campo
  `gruppo`). L'importo nuovo da una data e' un surplus nuovo, senza gruppo:
  quello di prima si chiude da solo il giorno prima, con la sua traccia. Una
  modifica che lascia il record dov'e' passa sempre, quindi due righe doppie si
  correggono una per una.
- **Il gruppo della creazione** arriva in cima al payload, come per update e
  delete, oppure in `dati.gruppo`; due valori diversi danno 400. La risposta
  rimanda sempre il gruppo dei record scritti, mai quello del payload: prima del
  13/10 l'ACI «aggiunto» col gruppo in cima finiva in un gruppo nuovo, e
  l'eliminazione del surplus lo lasciava a pagare e fatturare 5 €/t.
- **Tutto si controlla prima della prima scrittura** (`controlliSurplus`,
  `conflittiSurplus`): un canale sbagliato o in conflitto ferma anche gli altri.
  Lo stesso surplus negli stessi giorni da' 409. Il chiudibile si chiude prima di
  scrivere il nuovo: se una scrittura si ferma, manca un surplus invece di
  pagarne due. Con `anteprima: true` si fanno tutti i controlli e non si scrive
  niente: la pagina lo usa per chiedere conferma.
- **I mesi gia' chiusi (D7).** Se un surplus nuovo, cambiato o eliminato cambia
  un mese, fino a quello di oggi, con l'attiva gia' fatturata o la passiva
  congelata, la risposta porta `mesi_chiusi` e la frase negli `avvisi`, con la
  stima; non si riapre niente. **L'attiva gia' fatturata e' approvata,
  esportata o chiusa** (`STATI_GIA_FATTURATI`; regola 2, risposta dell'utente
  del 13/10/2026 sera). Un documento approvato o esportato e' gia' andato, o
  sta andando, all'amministrazione per la fattura: prima l'avviso scattava solo
  con `chiusa`. La frase dice lo stato vero («la fatturazione attiva è
  esportata») e, se non e' chiusa, aggiunge: «Se la fattura a Ecotyre non è
  ancora emessa, rielaborando il mese il surplus entra nel documento.». Un
  documento elaborato o verificato no: si rielabora e il surplus entra. In
  anteprima il salvataggio si ferma per la conferma come per un mese chiuso.
  L'attiva si stima sulle righe del documento gia' fatturato
  (`eRigaDiMovimento`; con «solo questi fornitori» per eccesso), la passiva sul
  conto congelato, fornitore per fornitore, senza gli interni e coi
  subraccoglitori al principale, in proporzione ai giorni se il surplus copre
  solo una parte del mese. Un mese chiuso fuori dal gestionale si dice senza
  importo. Documenti e congelati si leggono solo se un mese cambia davvero: il
  Fuel Surcharge scritto prima del suo periodo non costa letture.
- **Un salvataggio che si ferma a meta'** risponde 500 con `fatti` e
  `non_riuscito`. Con `fatti` vuoto la frase dice «non è stato salvato: non è
  stato scritto niente», mai «salvato solo in parte»; con `fatti` pieno si
  riprova solo quello che manca, con lo stesso gruppo.

Prova: `prove/gestisciSurplus.mjs` (banco delle funzioni con l'SDK finto; la
sezione 7 per i mesi gia' fatturati, approvata ed esportata comprese; la
sezione 10 gira sulla copia dei dati veri: settembre fatto chiudere da' le stime
del progetto, rete 5.601,20 € e 4.332,80 €, ACI 94,45 € e 69,95 €).

#### La passiva, il congelamento e i consuntivi

**Chi chiama `calcolaPassivaMese` gli passa `surplusAll`**, l'archivio letto
tutto: `calcolaPassiva`, `congelaPassivaMese`, `elaboraConsuntivo` (solo per
l'amministratore, l'unico a cui si calcola la passiva), `reportConferimenti`
(solo con `con_passiva`), il margine ed EcoTyna.

**Le righe standard non cambiano**, ne' di numero ne' di valore;
`totale_tonnellate` e la quadratura restano senza surplus. Ogni fornitore dei
tre blocchi ha in piu' `surplus` (una riga per surplus e per importo, sulle sue
tonnellate del periodo di validita'), `totale_standard` e `totale_surplus`;
`totale_euro` = standard + surplus, cioe' quello che gli dobbiamo, ed e' il
numero che leggono margine, consuntivi, congelamento, file ed EcoTyna. Le chiavi
di `totali` comprendono il surplus, `totali.standard` e `totali.surplus` le
scompongono. `surplus_del_mese` ha un elemento per surplus in corso nel canale,
anche a zero: quanto si paga, a chi, le tonnellate degli interni
(`tonnellate_interni`, `interni`), chi dell'elenco non ha righe (`senza_righe`)
e la `nota` pronta. Un elenco sbagliato e' un'informazione, non un'anomalia.

**Su che cosa si paga**, sul giorno italiano di `trasporto_finito_il`:
- la raccolta al fornitore che fattura (dopo la catena dei subfornitori: il
  surplus del sub va al principale), e nell'extra raccolta solo sugli interventi
  primari;
- trattamento e stoccaggio su tutto quello che arriva al sito;
- il trasporto delle secondarie sulle tonnellate del canale della tratta, anche
  sui viaggi misti, solo sulle tratte che hanno una riga; nell'extra raccolta
  solo sugli interventi secondari, e solo se il loro trasporto si paga (col
  contratto della tratta o col prezzo scritto: vedi «Le secondarie
  dell'extra raccolta sono trasporti di secondaria» in «Canali indipendenti»).

Il Fuel Surcharge e' una raccolta: vale solo per i raccoglitori (vedi «Le
domande del progetto»). Le altre prestazioni servono agli accordi commerciali.

Un fornitore interno non ha la riga. Il centesimo e' `importoSurplus` sui chili
del fornitore nel mese: uno per fornitore, per surplus, per canale.

**Senza la tariffa del mese il surplus si paga lo stesso** (regola 1, risposta
dell'utente del 13/10/2026, accettata come proposta). La riga standard resta
«senza tariffa» a zero, con la sua anomalia. La riga del surplus resta e porta
`avviso` («Tariffa del mese mancante: il surplus c'è, la riga standard no.»,
oppure «... su 2,00 t delle 6,00: ...») e `tonnellate_senza_tariffa`.
`surplus_del_mese` ha `senza_tariffa` e la frase nella `nota`. Vale per
raccolta, trattamento e stoccaggio. Non vale per un interno, per il prezzo
unico di Green Tyre (il trattamento compreso nella raccolta) ne' per l'extra
raccolta, i cui prezzi stanno sull'intervento; il trasporto delle secondarie
senza tariffa non ha la riga, e quindi nemmeno il surplus. L'anomalia della
tariffa che manca lo dice in `avviso_surplus`, con `tonnellate_surplus`:
«Tariffa del mese mancante: il surplus c'è (Fuel Surcharge), la riga standard
no.», oppure «... (Fuel Surcharge) su 4,00 t delle 10,00, ...» se il surplus
comincia a meta' mese. **Mai nella descrizione**: la descrizione e' la chiave
con cui la stessa anomalia si dice una volta sola, nel mese
(`anomaliePerChiave`) e nell'anno di EcoTyna. Con la frase dentro, la tariffa
che manca da gennaio diventava due voci, una prima e una dopo il 01/10
(revisione del 13/10/2026). Senza surplus non c'e' nessun campo nuovo e
l'anomalia e' identica campo per campo.

**Chi mostra un'anomalia aggiunge `avviso_surplus` accanto alla descrizione**
(chiusura del giro, 13/10/2026):
- la pagina (`PassivaAnomalie.jsx`), sotto la descrizione e nel colore dei
  problemi, come la riga del surplus nel Dettaglio (`AvvisoSurplus`);
- il file del canale (`passivaExport.js`, `anomaliaNelFile`): in fondo
  all'Excel e nelle note del PDF «descrizione. avviso»; la riga del surplus ha
  l'avviso in testa alla nota;
- EcoTyna, nell'anno: la voce unita su piu' mesi riscrive l'avviso sulle
  tonnellate di tutti i mesi, coi nomi dei surplus di tutti
  (`avvisoSurplusDellAnno` in `strumentiAssistente.ts`); un'anomalia di un mese
  solo tiene la frase del mese. Prima la voce teneva i campi del primo mese, e
  col Fuel Surcharge da ottobre e la tariffa che manca da gennaio l'anno non
  diceva il surplus.

Prova: `prove/surplusTariffaMancante.mjs`, anche sui dati veri (settembre col
Fuel Surcharge simulato e ottobre col vero non hanno raccoglitori pagati senza
tariffa, e i numeri non cambiano).

**Le secondarie dell'extra raccolta** si pagano come trasporti di secondaria
(decisione del 13/10/2026), e lo stesso camion nello stesso giorno si paga una
volta: le regole stanno in «Canali indipendenti».

**I consuntivi.** `costoAttesoDallaPassiva` da' `importo` = standard + surplus
(il fornitore fattura il surplus come riga a parte nello stesso consuntivo, D4),
con `importo_standard`, `importo_surplus` e le righe del surplus; le tonnellate
restano quelle standard. Quando l'importo non torna, `esitoConsuntivo` dice se
lo scarto e' esattamente un surplus (`scarto_surplus`): `manca` (il consuntivo
non lo porta), `scritto_dopo` (il congelato usato per il confronto non lo
aveva), `non_dovuto` (messo in un mese in cui non vale, o su tutto il mese
quando vale da un giorno, `in_parte`, `surplusPerIlConfronto`). Il verdetto non
cambia, cambia la frase. La riga «Fuel Surcharge» del file del fornitore non e'
un carico (`RIGA_SURPLUS` in `consuntivoFornitore.ts`).

**«Scritto dopo il congelamento» solo di quello che e' stato scritto o cambiato
dopo** (revisione del 13/10/2026). Confrontato col conto congelato, il Fuel
Surcharge che c'era gia' cresce anche solo per un carico del mese chiuso in
ritardo o per un peso corretto, cioe' proprio il caso per cui si congela. La
prima stesura lo chiamava «scritto il 13/10/2026 dopo il congelamento» anche su
un congelamento del 05/11. `surplusScrittiDopo(costoOggi, costoAllora,
congelato_il)` confronta ogni surplus col conto congelato:
- con gli stessi €/t e lo stesso periodo, la differenza e' delle tonnellate e
  non si dice;
- con altri €/t o un altro periodo e' stato «cambiato» dopo, e conta solo la
  differenza (5→6 €/t su 15 t fa 15,00 €, non 90); `anche_tonnellate` dice se
  comprende tonnellate nuove;
- se nel congelato non c'era, conta tutto solo se e' stato scritto dopo il
  congelamento: scritto prima, a quel fornitore mancavano solo le tonnellate.

Gli istanti della piattaforma senza la Z sono UTC. `elaboraConsuntivo` le passa
`congelato_il`, e chi la chiamasse altrove deve fare lo stesso: senza, un
surplus che non c'era nel congelato si conta come scritto dopo. Si segnala e
non si riapre niente (D7). Prove: `prove/passivaSurplus.mjs` (tiene l'impronta
dei totali di ogni mese del 2026 col codice di prima del surplus, sulla copia
dell'11/10/2026: con un'altra copia quella parte si salta e lo dice) e
`prove/consuntivoSurplus.mjs` (sezione 5 per il congelamento).

**La tariffa che manca e' nostra, non del fornitore** (prova del cambio d'anno,
15/10/2026, difetti 16 e 17; D4, decisione dell'utente del 15/10/2026).
`costoAttesoDallaPassiva` conta `senza_tariffa_t` (righe «senza tariffa» o con
unita' sconosciuta, e le tratte del vettore delle secondarie che la passiva
salta e annota solo nelle anomalie) e `da_confermare_t` (righe prezzate con una
tariffa copiata da «Prepara le tariffe» e non confermata, con `anno_copia`). Se
una delle due e' piu' di zero, `esitoConsuntivo` mette a null `quadra_importo`,
lo scarto e il previsto; la ragione va in `non_controllato` e in
`importo_sospeso`, e se il resto torna il verdetto e' null («da confrontare»).
Il testo dice «Non si è potuto controllare l'importo: nella passiva di gennaio
2027 manca la tariffa…», mai «si scosta di». `congelaPassivaMese` risponde 409
con `tariffe_mancanti` e `tariffe_da_confermare` e congela solo con
`conferma: true`; la pagina chiede con l'elenco. Un conto congelato quando la
tariffa mancava o era copiata, e che oggi c'e' o e' confermata, dice «rifai il
congelamento», anche quando il prezzo confermato e' lo stesso e il conto non si
e' mosso. Il file Excel della verifica riceve `esitoPerIlFile(esito)`: «—» col
perche', non 0,00 €. Prova: `prove/consuntivoSurplus.mjs`, sezioni 6-8.

L'attiva, la prefattura e il margine col surplus sono nelle loro sezioni: «La
fatturazione attiva verso Ecotyre», «Il surplus nella prefattura: ogni ordine
col suo», «Il margine». Il foglio della passiva dell'amministrazione e' in «Il
foglio della passiva dell'amministrazione».

#### Le pagine dell'attiva e del margine

Le pagine riconoscono, contano e scrivono la riga del surplus in un punto solo,
`src/lib/surplusVista.js` (anche la pagina delle esportazioni, per D3), e la
mostrano con `NomeSurplus.jsx`: barretta ed etichetta «Surplus» nel token
`--eco-surplus`, nome in corsivo, la stessa forma della passiva.
`eRigaSurplus` e' la stessa regola di `attivaCalcolo.ts`, e
`prove/attivaReportSurplus.mjs` le confronta.
- **La riga del surplus non e' una prestazione**: va in fondo
  (`surplusInFondo`), non si conta fra le prestazioni ne' fra i chili
  (`contiAttiva`), e le sue tonnellate stanno fra parentesi.
- **Due record con lo stesso nome** (un importo che cambia a meta' mese) sono
  due righe. Si dice «2 righe del Fuel Surcharge» (`righeAParole`) e si
  distinguono dall'importo, o dal periodo se l'importo e' lo stesso
  (`nomiVociSurplus`, `nomiSurplusDistinti`). Sotto un totale c'e' un solo «di
  cui» per nome (`surplusPerNome`).
- **Nel file e nel PDF del dettaglio** il nome va nella colonna Ordine e «t ×
  €/t · periodo» nel FIR, la Quantita' resta vuota e l'origine va nel
  sottotitolo. Il PDF di `esportaTabella` tiene tre righe per cella (la nota
  intera del calcolo veniva tagliata proprio sulle tonnellate) e scrive la riga
  col colore 'surplus' come i fogli della passiva: testo indaco scuro in
  corsivo, fondo indaco chiaro, barra a sinistra (13/10/2026; prima il colore
  'surplus' non lo conosceva e la scriveva come le altre). L'Excel del
  dettaglio non colora nessuna riga, nemmeno le sospese.
- **Riconciliazione di un documento chiuso**: se e' cambiato solo il surplus
  parla `surplus_a_parte` (si fattura a parte, il documento non si riapre da
  solo). Se sono cambiati anche dei movimenti c'e' una frase sola: riaprire e
  rielaborare OPPURE fare un'integrazione in due righe (formulari e surplus).
  Mai le due indicazioni insieme, altrimenti il surplus si fattura due volte.
- **I tre report dell'amministrazione ricevono tutte le righe del documento**
  (D3, decisa il 13/10/2026 sera) e mettono il surplus nella sua riga: vedi
  «La fatturazione attiva verso Ecotyre». La parte 7 di
  `prove/attivaReportSurplus.mjs` lo verifica eseguendo davvero
  `AttivaEsportazioni.jsx` e premendo i suoi pulsanti (`ESPORTAZIONI=<file>`
  prova una versione proposta della pagina prima di metterla al suo posto).

#### La pagina delle tariffe

In Tariffe & Anagrafiche (dell'amministratore) ci sono la **colonna «Surplus»**
delle tariffe, calcolata con `surplusDellaTariffa` e non scritta sulla tariffa
(una pastiglia «+5,00 €/t», tratteggiata per quello in arrivo), il filtro delle
tariffe col surplus, la **fascia** dei surplus in corso sopra la tabella e la
**scheda «Surplus»**: una carta per surplus coi suoi canali insieme, il periodo
con l'avanzamento, le azioni (modifica, chiudi prima, storico, elimina) e la
scorciatoia «Fuel Surcharge del consorzio», che compila il modulo da
controllare con la comunicazione. Il modulo (`SurplusForm.jsx`) dice sotto ogni
campo gli errori e gli avvisi di `controlliSurplus` e dei conflitti, e «Che cosa
succede» prima di salvare (`pianoDelSalvataggio`); se il salvataggio tocca mesi
passati chiede prima l'anteprima al server, che dice i mesi chiusi, e si
conferma. I conti della pagina stanno in
`src/components/fatturazione/surplusTariffe.js`. Col Fuel Surcharge salvato,
sulla copia dell'11/10: la pastiglia su 29 tariffe, la fascia «29 tariffe
interessate (22 di raccolta, 7 attive)». Le 29 sono 17 tariffe di raccolta
della rete, 5 dell'ACI e 7 attive (la rete, le cinque regioni dell'ACI e
l'extra raccolta). Un rilievo del 13/10/2026 dava «28 tariffe interessate (22
di raccolta, 7 attive)»: non si riproduce. `tariffeDelleSchede` conta ogni
tariffa una volta per surplus e in un gruppo solo (le attive, o le passive per
prestazione), quindi il totale e' sempre la somma delle parti, e conta proprio
le tariffe a cui la colonna mette la pastiglia. Quel testo uscirebbe solo
togliendo dal totale un'attiva (per esempio quella dell'extra raccolta)
lasciata fra le attive. La sezione 11 di `prove/surplusPagina.mjs` lo controlla
su 5.000 combinazioni a caso e sui dati veri, dove fascia, colonna e filtro
«Con surplus» dicono lo stesso 29.

**Un surplus, piu' canali, date diverse: la pagina dice il periodo di ogni
canale** (revisione del 13/10/2026). I record dello stesso surplus sui diversi
canali stanno in una scheda (`schedeSurplus`), ma i canali possono avere date
loro. Succede col cambio d'importo da una data fatto su un canale solo: il Fuel
Surcharge a 6 €/t sulla sola rete dal 01/11 chiude al 31/10 la rete del +5,
mentre ACI ed extra raccolta restano al 31/12 nello stesso gruppo. Nessuna parte
della pagina prende «canali» e «fino al» da tutta la scheda:
- la fascia passa da `schedaNellaFascia`: solo i canali in corso o in arrivo,
  ognuno fino al suo giorno («Rete fino al 31/10/2026, ACI ed Extra raccolta
  fino al 31/12/2026»); i conclusi non si nominano, e gli importi vengono dagli
  stessi canali;
- la frase «Che cosa succede» riceve i `cambi` di `pianoDelSalvataggio` e dice
  le date che si salveranno, canale per canale (finche' Dal e Al non si
  toccano, ogni canale tiene le sue);
- l'avviso del modulo (`testoDateDiverse`) dice di quale canale sono le date
  nei campi Dal e Al;
- la chiusura del surplus di prima nomina sempre il canale che si chiude e
  quelli che restano com'erano.

Altrimenti la fascia fa sembrare che la rete prenda 5 + 6 €/t, mentre la
colonna, giusta, dice +6. A chi non e' amministratore la fascia confronta solo
la parte da Ecotyre. Dopo ogni salvataggio la pagina usa il gruppo che la
risposta rimanda, e il 400 sul gruppo lo mostra sotto la scelta dei canali.
Prova: `prove/surplusPagina.mjs` (la sezione 9 fa scrivere i record alla
funzione vera sul banco, e disegna fascia, colonna e modulo al 13/10 e al
05/11).

**La sezione dei surplus si trova, e la scheda si apre subito** (13/10/2026,
dopo la pubblicazione l'utente: «non ho trovato la voce 'surplus'»). Senza un
surplus in corso o in arrivo, in cima a Tariffe & Anagrafiche c'e' una fascia
breve nel colore del surplus: «Surplus sulle tariffe (es. Fuel Surcharge):
nessuno scritto» (o «nessuno in corso o in arrivo»). Ha «Scrivi il Fuel
Surcharge» (solo all'amministratore: apre la linguetta Surplus col modulo della
scorciatoia) e «Apri la sezione Surplus». Se i surplus non si sono letti la
fascia non dice «nessuno» (`fasciaVuota`): parla l'avviso della lettura. La
linguetta «Surplus» porta il conto di quelli in corso, e le linguette vanno a
capo sul telefono. Collegamento diretto:
`/fatturazione?tab=tariffe&sezione=surplus` (`sezioneDelCollegamento` di
`surplusTariffe.js`; `leggiCollegamento` di
`src/lib/collegamenti.js` non da' la sezione). La scheda aspetta solo tariffe,
fornitori e surplus. Primarie e secondarie servono solo agli elenchi di
province, destinazioni e stoccaggi del modulo delle tariffe: si leggono dopo,
in background, una volta per apertura, e non si rileggono dopo un salvataggio.
Prima la scheda aspettava circa 14 secondi (10.487 primarie l'11/10). Il
modulo aperto prima che gli elenchi arrivino funziona lo stesso e lo dice.
Prova: `prove/tariffeSiApreSubito.mjs`, con un client finto lento
sull'orologio finto.

**La scorciatoia «Fuel Surcharge del consorzio» negli anni dopo** (regola 5,
risposta dell'utente del 13/10/2026 sera: vale anche dopo, date da confermare
ogni anno, mai copiata da sola perche' i contratti sono annuali).
`bozzaFuelSurcharge(oggi, surplusAll)` propone:
- nel 2026 la comunicazione vera (01/10 - 31/12, 5,00 €/t, costante
  `FUEL_SURCHARGE_CONSORZIO`, l'unico anno scritto nel codice della pagina);
- negli anni dopo le date dell'ultimo Fuel Surcharge del consorzio scritto
  (stesso nome normalizzato, origine consorzio, non disattivato) spostate
  all'anno di oggi, coi suoi canali e i suoi importi CANALE PER CANALE
  (`ultimoFuelSurcharge`: di ogni canale l'importo del suo record che comincia
  per ultimo);
- senza precedenti, l'anno intero.

Se i canali hanno importi diversi il modulo si apre con gli importi per canale,
e se un canale li ha cambiati durante l'anno la nota li dice uno per uno («con
l'ultimo importo di ogni canale: Rete 6,00 €/t, ACI ed Extra raccolta 5,00
€/t»). Revisione del 13/10/2026: la proposta metteva su tutti i canali
l'importo di quello che comincia per ultimo; col caso della regola 7 del
progetto (la sola rete a 6 dal 01/11) il 2027 salvato com'era pagava e
fatturava 1 €/t in piu' su ACI ed extra raccolta. Il modulo dice «Date da
confermare.» con la provenienza finche' Dal e Al restano quelli proposti; il
titolo del modulo chiede sempre di controllare importi e date con la
comunicazione. Niente si scrive da solo: e' una bozza, e la salva chi la
conferma. Prova: `prove/surplusPagina.mjs` sezioni 6 e 10 (con la richiesta
fatta girare su `gestisciAnagrafiche` vera).

#### Il surplus nell'extra raccolta

La pagina lavora per intervento, mentre fattura e passiva lavorano per mese: le
funzioni sono in `src/lib/extraRaccoltaCalc.js`.
- `surplusIntervento(r, contesto)` da' la quota di un intervento con le regole
  dei due calcoli. Attiva: interventi primari col peso effettivo; con «tutti»
  anche sui chili raccolti da SMOCO; con un elenco guarda il raccoglitore per la
  raccolta e la destinazione per trattamento e stoccaggio. Passiva: la raccolta
  al fornitore che fattura (catena dei subfornitori), mai sulle secondarie;
  trattamento o stoccaggio alla destinazione, anche sulle secondarie e sulla
  seconda prestazione; il trasporto delle secondarie solo se il viaggio ha un
  costo. Un interno non lo riceve: la voce resta, con importo 0 e `interno`
  vero.
- `surplusDelMese` da' il conto col centesimo che fa fede: per mese e surplus
  l'attivo, per mese, surplus e fornitore che fattura il passivo, ogni gruppo
  arrotondato una volta. `quote_attivo` e `quote_passivo` sono le somme delle
  quote dei singoli interventi.
- `totaliExtraRaccolta` fa i riquadri: sugli interventi di un mese i ricavi sono
  quelli della fattura e i costi quelli della passiva, al centesimo; la fascia
  del surplus dice lo scarto delle quote quando c'e'.
- `calcExtraRaccolta` ha `ricavo` e `costo_totale` col surplus,
  `ricavo_standard` e `costo_standard` senza.
- `contestoPrezzi(tariffe, fornitori, surplus, subfornitori, tariffePassive)`:
  la pagina chiede i surplus a `leggiSurplus()` (`src/lib/leggiSurplus.js`):
  una chiamata, tutti i record che chi e' collegato puo' leggere, mai con un
  filtro sullo stato (vedi «Chi legge il surplus»). Legge l'anagrafica intera, e
  passa il modulo `src/lib/subfornitori.js`, che in node non si carica perche'
  importa con l'alias. Il quinto argomento sono le tariffe passive, per il
  contratto della tratta delle secondarie: la pagina le legge solo per
  l'amministratore, e il foglio della passiva (`PassivaModulo`) passa quelle che
  legge gia' (chiusura del giro, 14/10/2026: prima non le passava). Interno,
  id e catena della passiva vengono dai soli fornitori attivi, come in
  `calcolaPassiva`; l'id per un elenco dell'attiva viene da tutti, come in
  `elaboraFatturazioneAttiva`.
- `bloccoExtraRaccolta(interventi, anno, mese, contesto)`
  (`src/lib/extraRaccoltaAmministrazione.js`) restituisce `surplus` (una riga
  per fornitore e per surplus), `surplus_interni`, `totale_standard` e
  `totale_surplus`; `totale_euro` li comprende. Le righe degli interventi
  restano lo standard e le tonnellate non cambiano.
- La parte ai fornitori (€/t passivo, importi, chi e' interno) la vede solo
  l'amministratore.

**Il Fuel Surcharge e' dei raccoglitori, mai dei produttori** (utente,
13/10/2026 sera: «il fuel surcharge non riguarda i produttori ma i trasportatori
ovvero i raccoglitori, su questo non ci devono essere confusioni»).
- Ogni quota attiva di `surplusIntervento` porta `fornitore` e
  `fornitore_chiave`, cioe' a chi e' dovuta: il raccoglitore che fattura (catena
  dei subfornitori) per la raccolta e per un surplus senza prestazione, la
  destinazione per trattamento e stoccaggio.
- `surplusDelMese` ha `per_fornitore`: una riga per mese, surplus e fornitore
  che lo riceve, con `kg_attivo`, `kg_passivo`, `ricavo` (parte da Ecotyre sui
  suoi chili), `costo` (quello della passiva; 0 con `interno`; null se il
  surplus non ha quella parte) e `sul_movimento` (i subraccoglitori).
- `aggregaPerProduttore` e' lo standard qualunque contesto riceva. Il 13/10
  mattina sommava le quote del surplus, e un produttore aveva un Fuel Surcharge
  suo.
- Chi riceve un surplus, a parole, sta in `aiChiSurplus` e `titoloSurplus` di
  `extraRaccoltaCalc.js`: «Fuel Surcharge ai raccoglitori», «... agli impianti»,
  «... ai trasportatori delle secondarie».

**I file Excel e PDF dell'elenco hanno la riga del Fuel Surcharge** (regola 4,
risposta dell'utente del 13/10/2026 sera). Fino ad allora ricevevano il
contesto dei soli prezzi (`contestoFile`, tolto) e riportavano gli importi
standard. Ora la pagina passa a `exportExtraRaccoltaExcel` e
`exportExtraRaccoltaPDF` lo stesso contesto della pagina, coi surplus, e
`{ isAdmin }`. In `extraRaccoltaExport.js`:
- `datiExportExtra` somma lo standard (`ricavo_standard`) e prende il surplus
  da `surplusDelMese`: una riga per mese e per surplus col centesimo del mese,
  come in fattura (sommando le quote dei singoli interventi il Fuel Surcharge di
  ottobre della prova farebbe 22,34 invece dei 22,33 della fattura). Restituisce
  `surplus`, `totale_standard`, `totale_surplus`, e `totale_imponibile` =
  standard + surplus, cioe' la fattura.
- Nel riepilogo, dopo i sovracosti e prima del Totale imponibile, la riga dice
  il nome, l'importo da Ecotyre e «Surplus di ottobre 2026: t × €/t, sulle
  stesse tonnellate dei N interventi fatturati · origine e periodo»; nel PDF un
  riquadro col totale del surplus e una tabella delle sue righe («SURPLUS SULLE
  TARIFFE: RIGA A PARTE IN FATTURA, SULLE STESSE TONNELLATE FATTURATE»). La
  riga e' vestita come nei fogli della passiva (indaco, corsivo, barra).
- **L'analisi per produttore, coi costi e il margine, esce solo
  all'amministratore** (`opzioni.isAdmin === true`; senza, si nega). Prima del
  13/10 usciva a chiunque premesse il pulsante. Dal 13/10/2026 sera l'analisi
  e' lo standard, e il suo TOTALE pure: il surplus e' dei raccoglitori, non dei
  produttori, e ha il suo blocco (qui sotto).
- **Il TOTALE QUANTITA' conta solo i chili fatturati a Ecotyre**, cioe' le
  primarie col peso effettivo (decisione del 13/10/2026 sera). Le secondarie
  hanno la riga «Trasporti di secondaria (non si fatturano a Ecotyre)», in kg;
  nel PDF il riquadro «Secondarie, non fatturate (kg)» e il sottotitolo «N
  interventi, di cui ... trasporti di secondaria». Prima il totale le sommava
  (6.465 kg sopra un surplus su 4,465 t).
- **Il blocco «FUEL SURCHARGE AI RACCOGLITORI»**, uno per surplus, fra il
  riepilogo e l'analisi: un gruppo per mese (e per importo se cambia a meta'
  mese), con l'intestazione «Ottobre 2026 · consorzio Ecotyre · dal ... al ... ·
  5,00 €/t da Ecotyre, 5,00 €/t ai raccoglitori», e una riga per raccoglitore
  con tonnellate e ricavo da Ecotyre; all'amministratore anche costo, margine e
  note (sub, interno). Il totale del mese e' la riga in fattura; se le righe
  fanno un centesimo diverso, una nota lo dice. Chi non e' amministratore non
  vede i surplus pagati solo ai fornitori. Nel PDF i blocchi prendono il posto
  della tabella «SURPLUS SULLE TARIFFE»; all'amministratore l'intestazione del
  gruppo e' divisa fra la prima colonna e quella delle note, perche' una cella
  si taglia a tre righe.
- All'amministratore il file chiude col «CONTO DEL MESE»: costi, ricavi e
  margine, ciascuno standard, surplus e totale (costi = passiva del mese, ricavi
  = Totale imponibile), poi il margine % complessivo col surplus.
- Senza surplus il file dell'amministratore e' quello di prima, cella per
  cella; a chi non e' amministratore manca l'analisi.
- **La pagina** dice accanto ai pulsanti «... e il blocco «Fuel Surcharge ai
  raccoglitori»: per raccoglitore le tonnellate[, il costo] e il ricavo da
  Ecotyre, mai per produttore», e il tooltip della quota da Ecotyre «da
  Ecotyre, per <raccoglitore>». **La scheda** dice «..., per il raccoglitore
  <nome>».

Prove: `prove/extraRaccoltaSurplus.mjs`, che sui dati veri controlla che ogni
mese del 2026 pagina, fattura e passiva diano gli stessi numeri e che i
pulsanti passino ai file il contesto coi surplus e i permessi (sezioni 6-7 per
i raccoglitori); `prove/extraRaccoltaExport.mjs`, sezioni 2 e 6-15, sui file
veri riaperti; `prove/documentiCheEscono.mjs`, sezione 11.

#### In EcoTyna

`strumentiAssistente.ts` dice il surplus come lo dice il modulo.
- La fatturazione, attiva e passiva, legge `SurplusTariffa` e lo passa ai
  calcoli (`surplus` / `surplusAll`). Il totale lo comprende, e accanto ci sono
  `euro_standard`, `euro_surplus`, `surplus` e `nota_surplus`, una frase gia'
  all'italiana. Senza surplus questi campi non ci sono: niente zeri.
- Nell'attiva la riga del surplus (`eRigaSurplus`) non conta ne' fra gli ordini
  ne' fra i chili. Nella passiva le tonnellate di SMOCO, interna, stanno in
  `tonnellate_interni_non_pagate`.
- Un documento elaborato prima del surplus: la differenza si dice come surplus
  (`differenza_del_surplus_euro`, `avviso_surplus`). A periodo chiuso si fa la
  fattura integrativa del solo surplus, e il mese non si riapre.
- Le anomalie della passiva portano `avviso_surplus` quando su una tariffa che
  manca il surplus si paga lo stesso (regola 1). Su piu' mesi la voce e' una
  sola e l'avviso si riscrive sulle tonnellate di tutti (vedi «La passiva, il
  congelamento e i consuntivi»).
- Lo strumento `tariffe` mette accanto a ogni tariffa il campo `surplus` (la
  regola della colonna, `surplusDellaTariffa`) e in coda l'elenco dei surplus,
  un record per canale. Se i surplus non si leggono lo dice, senza mai
  rispondere «nessun surplus». A chi non e' amministratore: vedi «I costi dei
  fornitori sono dell'amministratore».
- Lo storico delle modifiche dice l'archivio «surplus sulle tariffe» e lo trova
  chiedendo delle tariffe, del surplus, del Fuel Surcharge o del carburante
  (vedi «Lo storico delle modifiche»).

Prova: `prove/strumentiSurplus.mjs`, anche sui dati veri con settembre come mese
di Fuel Surcharge: rete +5.601,20 / +4.332,80 €, ACI +94,45 / +69,95 €.

#### Chi legge il surplus (13/10/2026)

Decisione del gruppo B del 13/10/2026 sera: `SurplusTariffa` lo legge solo
l'amministratore (`rls.read` come la scrittura). `euro_t_passiva` e' un costo, e
un accordo pagato solo da SMOCO e' tutto un costo, nome e fornitori compresi.
- **Le funzioni dei conti** leggono con `asServiceRole` e non cambiano. Anche
  `cruscottoOperativo`, che dal 14/10/2026 legge i surplus per il promemoria di
  quello finito l'anno prima e ne passa al calcolo solo nome, canale, date,
  stato e la parte da Ecotyre.
- **Le pagine dell'amministratore** (Tariffe & Anagrafiche, la Passiva)
  leggono l'archivio dal browser come prima.
- **Una pagina che serve anche agli altri** chiede i surplus alla funzione di
  sola lettura `leggiSurplus`, nel browser `leggiSurplus()` di
  `src/lib/leggiSurplus.js`: all'amministratore tutti i record, agli altri la
  sola parte attiva. Chi e' amministratore lo decide il server. Oggi e' l'Extra
  Raccolta (portata il 14/10/2026, nello stesso giro della chiusura
  dell'archivio). Una pagina che leggesse l'archivio direttamente, aperta da
  chi non e' amministratore, riceverebbe un elenco vuoto e direbbe «nessun
  surplus» senza un errore.
- **La parte attiva** sta in `base44/shared/surplusVisibile.ts`
  (`surplusPerChiLegge`) ed e' un elenco di campi scritto, `CAMPI_PARTE_ATTIVA`:
  id, nome, origine, canale, prestazione, a chi, `euro_t_attiva`, date e stato;
  `fornitori_json` solo con «solo questi», perche' l'attiva vale sulle tonnellate
  di quei fornitori. Restano fuori `euro_t_passiva`, riferimento, note, gruppo e
  i campi della piattaforma (`created_by` e' un indirizzo email). Un surplus
  senza parte attiva (solo passivo, o sul trasporto delle secondarie) non si
  nomina. Un campo nuovo dell'archivio non arriva agli altri finche' non lo si
  aggiunge li'.
- **Lo storico delle modifiche** ne tiene una copia. Le righe di
  `euro_t_passiva`, e tutte quelle di un surplus senza importo da Ecotyre,
  nascono riservate, e le riceve solo l'amministratore (revisione del
  14/10/2026, vedi «Lo storico delle modifiche»). Un surplus che perde la parte
  attiva lascia leggibili le righe scritte quando l'aveva: il registro non si
  corregge.
- Sui dati veri dell'11/10/2026, con un Fuel Surcharge simulato su tutto il
  2026, un accordo solo passivo e un «solo questi» su ogni canale, la fattura a
  Ecotyre e la pagina dell'extra raccolta dicono gli stessi numeri con la sola
  parte attiva, ogni mese e su tutti e tre i canali.

Prova: `prove/chiLeggeCosa.mjs`, che monta anche la pagina Extra Raccolta con
l'archivio chiuso, amministratore o no.

Dal 14/10/2026 anche `Tariffa` si legge cosi': la funzione e' `leggiTariffe`, e
la regola e' in «I costi dei fornitori sono dell'amministratore» (prova
`prove/tariffeRiservate.mjs`).

#### Un colore solo

Il surplus ha una forma e un colore in ogni pagina e in ogni foglio: nelle
pagine il token `--eco-surplus` di `src/index.css` (un indaco, chiaro e scuro
col tema), con le classi di `STILE_SURPLUS` (`src/lib/surplusVista.js`) o
`PassivaSurplus.jsx`; nei fogli e nei PDF l'indaco 6366F1, col testo 3730A3 e
il fondo EEF2FF. Indaco e non ambra o rosso, che qui vogliono dire «c'e' un
problema»: il surplus non lo e'. Il colore da solo non basta: la riga dice
anche la parola «Surplus», o e' in corsivo con la barra. Il 13/10 la pagina e
la scheda dell'extra raccolta l'avevano fatta con le classi indaco di Tailwind,
un tono diverso e fuori dal tema: ora prendono `STILE_SURPLUS`. Prova:
`prove/surplusUnColore.mjs`, che fallisce se un file che mostra il surplus usa
classi indaco, viola o porpora sue (le eccezioni, col motivo, sono elencate) e
guarda la riga del surplus nel PDF del dettaglio.

### Le due regole del portale sull'ACI

Una richiesta ACI non si stima sotto i **1.500 kg**, e un formulario ACI non si
chiude a piu' del **10% del peso stimato del suo ticket**. Il ticket e' il
`numero_ordine_interno` (colonna AL, Numero_Ordine_Interno, nei file delle
primarie e degli assegnati); il peso stimato e' `peso_stimato` (colonna U), letto
sullo stesso ID ordine (colonna A).

Da qui una conseguenza che sembra un errore e non lo e': **lo stesso formulario
puo' comparire su due ID ordine diversi.** Succede quando il carico supera la
soglia del primo ticket e il peso effettivo viene ripartito su un secondo ordine,
col suo ticket e il suo stimato. Il 9 giugno 2026 il formulario RGYTR022620TW sta
su ET26091175 (ticket 162684-15, stimato 2.800, effettivo 1.960) e su ET26102183
(ticket 163142-85, stimato 1.500, effettivo 1.500): tutti i 3.460 kg sul primo
ticket avrebbero sforato i 3.080 ammessi.

In fattura conta **solo la somma dei pesi effettivi**. La scomposizione - un rigo
per ID con ticket, stimato ed effettivo - si mostra lo stesso, perche' rende
leggibile da dove viene il totale. E' un'anomalia vera, invece, lo stesso
formulario due volte sullo **stesso** ordine: quello e' un ritiro caricato due
volte e si pagherebbe due volte.

Da qui due regole che valgono **in ogni modulo**, non solo nella fatturazione:

- **i pesi si sommano**: ogni quota e' peso vero;
- **i formulari si contano una volta sola, per numero**. Chi conta formulari usa
  `contaFormulari()` da `base44/shared/formulari.ts` (nelle pagine dallo
  specchio `src/lib/formulari.js`, dal 12/10/2026), mai `righe.length`: due
  quote dello stesso documento contate come due formulari fanno sballare la
  quadratura contro la stampa del portale, che quel formulario lo elenca una
  volta. Chi confronta il gestionale con un elenco esterno - la quadratura FIR, i
  report settimanali degli impianti - fonde prima le quote con `unisciQuote()`,
  altrimenti una riga del report col peso intero si abbina a una quota sola e
  risultano insieme una differenza di peso e un movimento mancante.

A distinguere le quote e' il **ticket**: si mostra sempre accanto al peso
effettivo, ed e' quello che rende il conto leggibile invece che sospetto.

**La pagina Terminati ACI le mostra** (alte A12 e A13 del 20/09; 12/10/2026).
- Nel dettaglio ci sono il formulario, il ticket e lo stimato accanto
  all'effettivo.
- Accanto agli ordini ci sono i formulari distinti delle righe che un numero ce
  l'hanno (`contaFormulariConNumero` di `formulari.ts` e del suo specchio,
  revisione del 13/10/2026); senza nessuno si scrive «—». `contaFormulari`, che
  conta per uno ogni riga senza numero, con il filtro «cancellato» diceva 6
  formulari per 6 ordini che non ne hanno nessuno; resta la regola di passiva,
  quadratura e report.
- Un riquadro elenca gli ordini stimati sotto i 1.500 kg, i formulari oltre il
  110% dello stimato del ticket e quelli ripetuti sullo stesso ordine
  (`src/lib/controlliPortaleAci.js`). Le righe interessate hanno il segno.

**Negli Assegnati ACI lo stimato sotto i 1.500 kg si segnala** (decisione
dell'utente del 13/10/2026: «nessun aci può avere uno stimato inferiore a
1.500 kg, se negli assegnati del portale è indicato così limitati a segnalarlo
e provvederemo a farlo modificare al consorzio»). La pagina Assegnati, nella
vista ACI (`entity` 'AssegnatoAci'), legge gli ordini appena si apre (una
lettura, che il dettaglio riusa) e sopra la matrice ha un riquadro col conto
sugli ordini dei filtri attivi: «Un ordine con lo stimato sotto i 1.500 kg
ammessi: da far correggere al consorzio», con l'ID (che porta all'ordine), il
ticket, il punto di raccolta e lo stimato. La regola e' una sola,
`stimatoSottoMinimo` di `src/lib/controlliPortaleAci.js`, la stessa dei
Terminati ACI; `problemiDellaRiga` scrive i chili all'italiana («stimato
1.400 kg»). La pagina passa alla tabella il segno di ogni riga (`segni`, Map id
-> frasi), e `AssegnatiTable` colora la riga e mette il triangolo accanto
all'ID, col perche' nel title, come nei Terminati ACI (dal 14/10/2026, chiusura
del giro: prima la tabella ignorava i segni). Il gestionale non corregge
niente: lo fa il consorzio. Il 12/10/2026 gli assegnati ACI di SMOCO erano 2,
nessuno sotto il minimo; ET26084363 (1.400 kg) e' gia' terminato. Prova:
`prove/assegnatiAciStimato.mjs`.

Le soglie `MINIMO_ACI_KG` e `SOGLIA_ACI` stanno in `formulari` (e nello
specchio) dal 13/10/2026: le importano da li' sia `passivaCalcolo.ts` sia
`controlliPortaleAci.js`, e nessuno ne tiene una copia. `prove/terminatiAci.mjs`
controlla che la pagina e la passiva dicano le stesse. Dati dell'11/10: 156 ordini e 154 formulari (due ripartiti); un ordine
sotto i 1.500 kg (ET26084363, 1.400 kg); nessuno oltre soglia, nessun doppio.

**Tariffa zero non e' un dato mancante.** Il trattamento della rete su Tecnogum
e' davvero a zero, perche' nessun contratto lo prevede. Eco Faso e' una
autodemolizione dove SMOCO va a raccogliere, non un trasportatore: e' giusto che
non abbia un prezzo. Nel 2026 non sono coinvolti MGM, Barone Trasporti,
Minervini ed Eco Faso.

**Nappi Sud e' raccoglitore e stoccaggio insieme**, ed e' la distinzione che fa
sbagliare i moduli:

- come **raccoglitore** ritira dai punti di raccolta con un target suo e porta
  in primaria al proprio piazzale (`Nappi Sud -> NAPPI SUD`). Altri raccoglitori
  possono stoccare li', per esempio C.L. Service;
- come **stoccaggio** e' il **produttore** delle secondarie che partono dal suo
  piazzale verso Irigom e Tecnogum. In quei viaggi non e' un raccoglitore: e'
  l'origine del rifiuto.

Ne discendono due cose. Il suo consuntivo verso un impianto sono le **secondarie**
che gli spedisce, non le primarie, che porta a se stesso. E il suo target di
raccolta e' uno solo: fra gli impianti si divide **in proporzione alle secondarie
che ciascuno riceve da lui**, altrimenti compare intero sotto entrambi e il
residuo risulta il doppio di quello vero.

**Il gia' arrivato della predittivita'** (solo rete, 22/09/2026) ha un conto solo,
`giaArrivatoDiRete` in `base44/shared/proiezioneSecondarie.ts` (specchio in
`src/lib`), usato dal motore della predittivita' (e quindi da ogni scheda, dal
programma del mercoledi' e dagli assistenti): le
primarie di rete arrivate al **sito** dell'impianto seguito, cioe' all'impianto e
al suo piazzale (`tipo_destinazione` 'stoc'), piu' le secondarie di rete da altri
stoccaggi. Le primarie del piazzale contano perche' "il residuo totale diminuisce
anche con le primarie" (utente); le secondarie dal proprio piazzale a se stesso
non si contano, sarebbero contate due volte. Il piazzale conta al netto di quello
che riparte verso altri impianti seguiti (scelta confermata dall'utente il
25/09/2026), in ordine di arrivo (27/09/2026): esce prima la giacenza del
piazzale al 31/12 dell'anno prima, che non si toglie perche' non era nel gia'
arrivato dell'anno, e solo dopo le primarie dell'anno, in ordine cronologico.

### Il target annuo di un impianto si scrive solo in Target & Status

Il target annuo dell'impianto si scrive **solo in Target & Status**
(`ImpiantoTargetSecondaria.target`, in kg, per anno) e le Giacenze lo leggono da
li' (`targetImpiantoDellAnno`: il record attivo di esattamente quell'anno, nessun
ripiego sugli anni prima). Il target delle primarie di un sito non si scrive: e' la
somma dei target annui dei raccoglitori di quell'anno legati a quel sito
(`TargetRaccoglitore.impianto`), **piu' la quota che a quel sito arriva dalla
ripartizione sullo storico dei conferimenti** (`ripartisciTargetPrimarie`). Le
righe di target **senza ruolo** non dicono se portano all'impianto o allo
stoccaggio: la loro somma va su una riga sola del sito, di norma quella
dell'impianto, perche' il totale non lo conti due volte. Le righe che **il ruolo
ce l'hanno** vanno sulla riga di quel ruolo (`TargetRaccoglitore.ruolo`,
`targetPrimariePerRuolo` in `annoTarget.ts`): «T-cycle va gestito come impianto
per le 1050 t e come stoccaggio per le 250 t» (utente, 04/10/2026), e le quote
ripartite il ruolo ce l'hanno sempre, perche' lo dice il viaggio. Il conto sta in
`targetImpianti.ts`; `targetPrimarieDelSito`, che questo file citava, in
produzione non la chiama piu' nessuno (resta nello specchio e nelle prove).
I vecchi `GiacenzaSito.target_totale_t` e `target_primarie_t` restano nel database
e non si scrivono piu' (in Giacenze si vedono in sola lettura): servono solo di
**ripiego di transizione**, quando Target & Status non da' niente, con l'anomalia
`target_da_portare`. Il pulsante "Porta in Target & Status i target scritti in
Giacenze" (`portaTargetInTargetStatus`) crea i record che mancano, con
`segue_predittivita: false`. Il vecchio confronto fra i due (divergenze, alert
`target_impianto_divergente`, voce della dashboard) non c'e' piu':
`checkTargetAlerts` chiude soltanto gli alert rimasti aperti. Tutto in
`base44/shared/targetImpianti.ts` (`targetRigaGiacenze`).

Il target **mensile per impianto** (`ImpiantoTarget`) non si legge e non si
scrive piu' (11/10/2026). Non ha mai avuto una riga, e la tabella degli impianti
di Target & Status e il foglio Impianti dell'Excel mostravano un target zero con
un delta verde: ora mostrano le primarie ricevute (vedi «L'Andamento di Target &
Status»).

**Il nome del target e quello del portale: un abbinatore solo** (11/10/2026).
`stessoRaccoglitore` e `targetDelPortale` stanno in
`base44/shared/andamentoTarget.ts` (specchio `src/lib/andamentoTarget.js`), e
`targetRaccoglitori.ts` li riesporta per le funzioni: non si riscrivono. Vale
prima il nome normalizzato uguale, poi l'abbreviazione (le parole del target
tutte nel nome del portale: «PNEUSERVICE SRL» per «PNEUSERVICE CONVERSANO SRL»),
mai il contrario. Lo usano gli alert, EcoTyna, l'Andamento di Target & Status
col suo PDF e il suo Excel, la vista B del mix, la ripartizione delle Giacenze,
la predittivita' e `contrattiAnno` per il target del contratto di raccolta. In
`contrattiAnno` un target abbreviato che vale per piu' raccoglitori, nessuno col
nome uguale, non si assegna a nessuno; e il target si abbina al soggetto
confrontando il nome normalizzato, non la grafia: lo stesso target abbreviato
scritto in due grafie in due regioni («PNEUSERVICE SRL» in Puglia, «Pneuservice
S.r.l.» in Basilicata) si somma, mentre prima la seconda grafia restava senza
soggetto (600 t invece di 700). `prove/andamentoTarget.mjs` controlla che le
funzioni siano le stesse e che `targetRaccoglitori.ts` e `assistente.ts` non ne
abbiano una copia; `prove/contrattiAnnoTarget.mjs` e
`prove/contrattiDueGrafie.mjs` controllano i contratti. Restano due copie da
togliere: `stessoNome` in `src/lib/reportGeneraleVista.js`, che usa il Report
generale, e in `base44/shared/reportSettimanale.ts`. Per la prima l'ostacolo non
c'e' piu': dal 13/10/2026 la vista importa gia' lo specchio
`src/lib/andamentoTarget.js` (per `targetMensiliValidi`), che si carica in node
come le sue prove, `prove/reportGenerale.mjs` e `prove/targetImpianti.mjs`, la
caricano.

### Le date obbligatorie dei formulari (22/09/2026)

Parole dell'utente: «le date immissione, inizio e fine trasporto sono
obbligatorie nei formulari, se non ci sono vanno segnalate e questo vale sempre
dove ci sono ordini terminati non solo nei report settimanali». La regola sta in
`base44/shared/movimenti.ts` (specchio `src/lib/movimenti.js`):
`DATE_OBBLIGATORIE`, `dateMancanti`, `dateIncoerenti`, `dateDaSistemare`,
`testoDate`. Non si riscrive. Il «sempre» si ferma all'anno scorso
(`dateDaControllare` e `primoAnnoControllato`: utente 25/09/2026, «tieni il 2024 e
toglilo dagli avvisi»); senza fine trasporto non c'e' anno e si segnala sempre.
Quanti sono si conta in **ordini distinti**, mai in
righe (`chiaveOrdine`, `ordiniDaSistemare`, `mancantiOrdine`, `incoerentiOrdine`,
`testoOrdine`, `ordineSenzaFine`, nello stesso file): lo stesso ordine sta in
archivio con piu' righe - una per classe o per prodotto - e contarle tutte
faceva uscire due numeri diversi per lo stesso insieme (23/09/2026).
Un terminato senza fine trasporto resta fuori da
ogni periodo, ma si segnala sempre dicendo quali date mancano; uno con la fine
trasporto ma senza un'altra data, o con la fine prima dell'inizio, si conta e si
segnala lo stesso. Quella e' l'unica incoerenza: un trasporto cominciato prima
dell'immissione e' la regola a portale, dove l'immissione e' il giorno della
registrazione, e segnalarlo voleva dire 941 avvisi incorreggibili (misurato il
22/09/2026). Dove si vede:

- **elenchi** (Terminati Rete e ACI, Secondarie, Terziarie, Extra Raccolta): segno
  sulla riga, avviso per canale, filtro "date da sistemare", colonna negli Excel
  (componenti in `src/components/primarie-rete/DateDaSistemare.jsx`);
- **conti**: le funzioni restituiscono `date_da_sistemare` per canale
  (`riepilogoDate` e `riepilogoDateVista` in
  `base44/shared/raccoltoCalculator.ts`: `{ totale, senza_fine_trasporto,
  mancanti, incoerenti, esempi, testo }`), mostrato in Dashboard, matrice
  province, report mensile, SLA e Target & Status. I report settimanali, le
  rotte, gli alert ed EcoTyna usano `riepilogoVociDate` di
  `base44/shared/reportSettimanali.ts`, che conta gli stessi ordini ma risponde
  `{ ordini, senza_fine, esempi }`: due nomi diversi perche' chi le mostra ne
  legge una sola forma;
- **report settimanali**: un formulario registrato senza una data obbligatoria o
  con date incoerenti e' un'**anomalia** del suo canale e conta nel verdetto
  (`conformitaPerCanale`), non una rettifica a nostra cura;
- **alert**: la regola "date obbligatorie" del motore degli alert, per modulo e
  canale, si apre e si chiude da sola a ogni caricamento (anche delle schede di
  extra raccolta) e compare nel cruscotto;
- **giacenze e dichiarazioni**: per soggetto e canale (`formulariDaSistemare` in
  `base44/shared/giacenzaPortale.ts`); senza fine trasporto un ordine non entra
  nella giacenza calcolata, e se il portale lo conosce la differenza si dice;
- **fatturazione** (anomalie per canale), **qualifica**, **richieste ECT**,
  **evasione assegnati**, **prefattura** ed **EcoTyna**.

Chi la rete non la dichiara per accordo (`dichiara_rete` falso in
`GiacenzaSito`, oggi Tecnogum) non ha una giacenza di rete che il portale tenga
per noi: i suoi carichi non si aggiungono alla fotografia come "non ancora nel
file". Il taglio e' `nonDichiaraRete` in `calcolaGiacenze` e in
`riepilogoDichiarazioni`, con la variante per le dichiarazioni in
`base44/shared/dichiarazioniImpianti.ts`; in `giacenzaPortale.ts` non c'e'.

**La fatturazione conta ordini, come gli elenchi** (11/10/2026).
`dateDaSegnalare` e `anomaliaSenzaFineAnno` di `filtroPeriodo.ts` fondono le
righe dello stesso ordine (`chiaveOrdine`) sommando i chili: un ordine con la P
e la M senza inizio trasporto e' «un terminato», in fatturazione, margine ed
EcoTyna come in Giacenze e Dichiarazioni.

### Una riga di un altro periodo si verifica sempre (01/10/2026)

Il fatto: Nappi Sud non aveva messo nel report della sua settimana una richiesta
terminata del 14 settembre — non ce l'aveva mandata e non l'aveva annotata nel
suo Excel — e il confronto di quella settimana usciva **perfetto**. La riga e'
comparsa nel report della settimana dopo, dove il gestionale la scartava come
«fuori dalla settimana verificata» senza dire niente, in grigio, in fondo, fra
le righe non considerate. Quando se n'e' accorto l'ufficio registrazioni il
**termine di dieci giorni dalla data di partenza** era passato, e l'utente si e'
preso un richiamo per non averlo segnalato.

Parole dell'utente: «tutte le volte che io carico una verifica settimanale ma
compaiono nell'elenco anche formulari afferenti a settimane precedenti, tu debba
verificare anch'esse pur se non appartenenti alla specifica settimana in esame e
rilevare tutte queste anomalie».

La regola vale **in ogni confronto**, settimanale e mensile:

- una riga di un altro periodo **non si scarta mai**. Si confronta, e porta
  `fuori_settimana { anno, settimana, arretrata }` nei report settimanali
  (`verificaReport` in `base44/shared/reportSettimanali.ts`), o finisce negli
  `arretrati` del consuntivo (`confrontaConsuntivo` in
  `base44/shared/consuntivoFornitore.ts`). Resta fuori solo una riga **senza
  formulario**, su cui non c'e' niente da registrare;
- la settimana di una riga abbinata e' quella del **movimento registrato**, non
  quella che il report scrive: se il report sbaglia la data ma il carico e' della
  settimana verificata, la riga resta nella quadratura;
- resta **fuori dalla quadratura** del periodo verificato, dove il gestionale non
  la colloca (regola 1). Se report e gestionale dicono la stessa settimana e'
  soltanto un carico vecchio, quindi un'**osservazione** — altrimenti ogni report
  cumulativo del mese uscirebbe «parziale» per le sue righe a posto. Se le due
  settimane non coincidono, una delle due date e' sbagliata: **anomalia**;
- un formulario si cerca su **tutti** i movimenti, non solo nei ventuno giorni
  intorno alla settimana: di un carico registrato a luglio il gestionale diceva
  «non presente nel gestionale», che e' una bugia facile da credere;
- **il termine di registrazione** sta in `base44/shared/termineRegistrazione.ts`
  (specchio `src/lib/termineRegistrazione.js`): dieci giorni dalla data di
  partenza, **domeniche escluse**, il giorno della partenza non si conta. Ogni
  formulario che nel gestionale non risulta porta la sua `scadenza`, in qualunque
  settimana. Nell'esito salvato non si scrive **niente che dipenda da oggi**:
  «scaduto da quanto» lo calcolano la scheda e il PDF con `statoTermine`, o ogni
  verifica risulterebbe cambiata ogni giorno e si riscriverebbe da sola;
- si vede: alert nel modulo Verifiche (`REGOLA_ARRETRATI` in
  `esitoVerifica.ts`, si chiude da solo quando risultano registrati),
  **critico** se almeno un termine e' scaduto o almeno un carico e' di una
  settimana precedente, altrimenti **warning**, in testa
  alla scheda, in una sezione del PDF prima della quadratura, nel foglio Excel
  «Settimane precedenti», con una pastiglia rossa nell'elenco delle settimane
  (`arretrati_da_registrare`, `settimane_arretrate`), e nella **storia scritta**,
  formulario per formulario, perche' al quarantesimo giorno il dettaglio se ne va;
- dai **registri di carico e scarico** si leggono anche i trenta giorni prima
  della settimana (`GIORNI_ARRETRATI_DAL_REGISTRO` in `src/lib/verifiche.js`):
  col filtro alla settimana esatta un carico rimasto indietro non arrivava
  nemmeno al confronto.

### Un numero sbagliato di una lettera non e' due difformita' (01/10/2026)

Parole dell'utente: «verifica tutte le informazioni contenute in ogni rigo e poi
confrontale con il nostro gestionale; le cose importanti su cui decidere sono il
numero del formulario, l'id ordine, ma chi ci invia il report puo' anche
sbagliare, ad esempio scambiando una lettera o una cifra, pertanto tu fai i
paragoni con piu' informazioni della stessa riga».

Un identificativo sbagliato di un carattere, confrontato da solo, non produce un
errore ma **due**: «questo ce lo fattura e noi non l'abbiamo» e «questo l'abbiamo
noi e lui non lo riporta». Due accuse al posto di una frase, su un documento che
autorizza una fattura.

- Un numero quasi uguale **non basta**, e un peso uguale **non basta**: si abbina
  quando il numero e' quasi uguale (formulario entro 2 caratteri, ID ordine entro
  1) **e almeno un'altra informazione della riga lo conferma** - peso, data,
  classe, produttore, destinatario, trasportatore. Senza conferme la riga resta
  una difformita': meglio una difformita' da guardare che un abbinamento
  inventato. Si dice sempre da che cosa lo si e' riconosciuto. Nelle verifiche
  settimanali le conferme sono piu' strette (vedi in fondo alla sezione).
- Anche una riga abbinata dal numero **esatto** si controlla in tutto: l'ID
  ordine e la data sbagliati si dicono comunque.
- **I nomi non fanno difformita'**: la stessa ditta si scrive in dieci modi, e un
  elenco di grafie seppellirebbe le differenze vere. Servono a riconoscere e a
  spiegare. La **classe** si segnala solo se cambia canale (9 = ACI), perche' e'
  quella che cambia il prezzo.
- `base44/shared/numeroFir.ts`: `normalizzaFir`, `FORMATO_FIR`, `distanzaFir` e
  `descriviDifferenzaFir`, che spiega l'errore in italiano dicendo sempre quali
  caratteri e in che posizione («"B" al posto di "P" in posizione 13»,
  «caratteri "PB" invertiti in posizione 12»), con la coda «, probabile scambio
  fra caratteri simili» quando i due caratteri si somigliano. Lo usano le verifiche settimanali (`verificaReport`) e i consuntivi
  (`confrontaConsuntivo`): una regola sola, in un posto solo.
- I chili tornano, quindi la quadratura delle quantita' resta buona, **ma il
  verdetto non e' verde**: il riquadro non puo' dirsi a posto mentre sotto c'e'
  scritto che due numeri sono sbagliati.

**Nelle verifiche settimanali i simili si cercano dopo gli identici, e solo fra
i movimenti liberi** (audit del 20/09, alta A57; 12/10/2026). Prima
`verificaReport` abbinava riga per riga e a distanza 1 accettava sempre il
formulario vicino, anche se un'altra riga l'aveva gia' preso. Il caso: il report
di Irigom porta RGYTR027030CR e RGYTR027031CR, e nel gestionale c'e' solo il
primo. La seconda riga usciva «duplicata», con formulario, peso e data
«errati», invece di «formulario non presente nel gestionale».

Ora i passaggi sono tre:
- i formulari identici, anche fuori dalla fascia di giorni: solo da qui nasce
  «Riga duplicata»;
- i simili fino a due caratteri;
- il peso con la data.

Gli ultimi due guardano solo i movimenti rimasti liberi. I simili, inoltre, si
cercano solo fra i movimenti dell'impianto verificato, perche' lo stesso
blocchetto serve impianti diversi.

Un simile vale solo con una conferma dalla riga, e la conferma e' **lo stesso
peso o la data entro un giorno, a un carattere come a due** (per i due
caratteri dalla revisione del 13/10/2026, per uno dalla decisione dello stesso
giorno). Classe, produttore o codice PDR (ingresso) e destinatario (uscita)
contano solo insieme a uno di questi (`confermeBastano`). In un report di
stoccaggio quasi tutte le righe hanno la stessa classe, e i blocchetti sono
numerati in sequenza: con la sola classe o il solo produttore, un formulario non
registrato vicino di una o due cifre a un carico che il report non riporta
diventava «formulario errato», perdeva il termine di registrazione e toglieva
il carico dagli assenti. Il nome dell'impianto stesso e il trasportatore non
confermano niente, perche' stanno su ogni riga del suo report. L'esito porta
`riconosciuto_da` e il messaggio lo dice. I consuntivi (`confrontaConsuntivo`
in `consuntivoFornitore.ts`) hanno ancora la regola di prima, una conferma
qualsiasi: in un consuntivo di raccoglitore la classe e' quasi sempre la
stessa, e allinearli e' il passo dopo.

Senza conferma la riga e' «non presente», col suo termine di registrazione,
l'osservazione «Simile a ...» e `simile_a` sull'esito; a due caratteri
l'osservazione dice anche perche' non basta, con la distanza («ma a un
carattere di distanza servono lo stesso peso o la data entro un giorno (in
comune c'e' solo la classe)»). Questa osservazione non conta fra le osservazioni del riepilogo. Il
PDF dell'esito scrive il «Simile a ...» sotto il formulario, nella tabella dei
non registrati (`notaSimile`, `prove/esitoVerificaPdfSimile.mjs`).

**I simili si assegnano in un ordine unico** (revisione del 13/10/2026). Il
secondo passaggio raccoglie tutte le coppie (riga, movimento libero, distanza,
conferme, punteggio) e le assegna per distanza crescente, poi per numero di
conferme, poi per punteggio; a parita' conta l'ordine del report. Riga per riga,
una riga che veniva prima con una conferma debole rubava il movimento al refuso
vero che veniva dopo. L'esito non dipende dall'ordine delle righe:
`prove/reportSettimanali.mjs` (A57) prova ogni caso con le righe invertite.

**Anche il terzo passaggio assegna in un ordine unico** (revisione del
13/10/2026). Stesso peso e data entro un giorno: le coppie (riga con data,
movimento libero, punteggio) si assegnano dal punteggio piu' basso, a parita'
nell'ordine del report. Riga per riga, la riga che veniva prima nel report
prendeva il carico anche con la data a un giorno, e quella con la stessa data
usciva «non presente nel gestionale»: invertendo le righe si invertiva l'esito.
Le righe senza data vengono dopo le altre, perche' il loro punteggio non conta
la data che manca; abbinano solo se fra i movimenti rimasti liberi ce n'e' uno
solo di quel peso. Il limite e' quello dei simili: l'assegnazione per punteggio
non cerca il massimo delle righe abbinate (domanda aperta all'utente).
`prove/reportSettimanali.mjs` (blocco «IL TERZO PASSAGGIO IN UN ORDINE UNICO»)
prova i casi in tutte le permutazioni, e 150 scenari a caso con un seme fisso.

### Lo stesso soggetto di un punto di raccolta (11/10/2026)

Una verifica della sede operativa vale finche' il punto di raccolta e' dello
stesso soggetto. Lo decide `stessoSoggetto(a, b)` in
`base44/shared/sediOperative.ts` (specchio in `src/lib/sediOperative.js`): **la
partita IVA decide solo quando c'e' da tutti e due i lati**; altrimenti contano
ragione sociale e comune; se da un lato non si sa niente la risposta e' null, e
non si invalida. Prima si confrontavano le due chiavi migliori: lo stesso
gommista, controllato quando il file dei PDR non portava la partita IVA e
ricaricato con la partita IVA, risultava «passato a un altro soggetto», la
pagina lo fermava con «ora intestato a EUROGOMME SRL: il controllo va rifatto»,
cioe' allo stesso nome, e `verificaSediPdr` non riportava la decisione gia'
presa. La usano `verificaApplicabile` e `decisioneDiAltroPunto`. Prove:
`prove/sediOperative.mjs` (server e pagina) e `prove/sediOperativeSoggetto.mjs`
(la funzione intera).

### Le dichiarazioni e il mese di competenza

Le dichiarazioni si fanno a consuntivo: i PFU raccolti a luglio, lavorati e usciti
dall'impianto ad agosto, si dichiarano a settembre. **Il rigo dell'extra raccolta
sta sul mese del formulario** (fine trasporto), non su quello in cui la
dichiarazione arriva: altrimenti la stessa raccolta compare due volte, un mese col
conferito senza dichiarazione e un altro con la dichiarazione senza conferito.
Quando e con quale dichiarazione e' stata fatta si scrive nella nota.

**Gli stoccaggi non dichiarano** (regola dell'utente, 21/09/2026). Non trattano:
ricevono i PFU e li rimandano in secondaria, e in quel viaggio sono il
produttore. La dichiarazione si chiede all'impianto che li riceve, solo dopo il
secondo viaggio, per rete, ACI ed extra raccolta. Nel modulo Dichiarazioni
Impianti le secondarie stanno quindi sulla riga dell'impianto di destinazione,
nel mese in cui arrivano e con scritto da quale stoccaggio; uno stoccaggio ha
solo entrate, partenze e piazzale (scheda Stoccaggi). Chi e' insieme impianto e
stoccaggio (Irigom, T-Cycle) si tiene diviso per `tipo_destinazione` del
movimento: quello che arriva al suo stoccaggio non e' suo da dichiarare.

**Un mese senza dichiarazione puo' essere a posto** (22/09/2026): si segna in
`DichiarazioneSito.motivo_assenza`, con quantita' a zero. `non_dovuta` quando il
trattamento di quel canale non e' a nostro carico (la rete di Tecnogum: vale
anche senza segnarla, con `dichiara_rete` falso in Giacenze); `solo_metalli`
quando dall'impianto sono usciti solo metalli ferrosi e nessuna gomma (Irigom,
rete di aprile 2026): a portale non si carica nulla e il ferro si dichiara con
la prossima uscita di gomma. Nessuno dei due e' un mancante.

**Piu' mesi caricati a portale lo stesso giorno** (prova del cambio d'anno del
15/10/2026, difetto 13). Il portale fa un caricamento per giorno e per
impianto. Dopo il passo mese per mese, `agganciaMesiInsieme`
(`agganciaDichiarazioni.ts`) prova insieme i nostri mesi consecutivi rimasti
senza riscontro (fino a `MAX_MESI_INSIEME` = 12, l'arretrato di Gatim) contro UN
caricamento, cioe' un giorno solo, entro `TOLLERANZA_KG`. Si agganciano solo se
i mesi degli ordini che chiude (`c.mesi`, per fine trasporto) sono proprio i
nostri. Le righe prendono il giorno del caricamento e il segno `insieme_mesi`;
l'esito dice `insieme_ad_altri_mesi`. Mai caricamenti di giorni diversi: una
data presa in prestito sposta il dichiarato dopo la fotografia (novembre con la
data dell'08/01/2027). I materiali di ogni mese sono i suoi, letti per fine
trasporto (`materiali_mesi`), quando i chili di ogni mese tornano. Se non
tornano si potrebbero solo stimare: non si scrivono, e l'esito lo dice
(`materiali_non_scritti`). Prima Gatim con novembre e dicembre 2026 caricati il
12/01/2027 aveva i due mesi «da inserire» e la pagina chiedeva un doppione da
35.000 kg. Prova: `prove/storiaDichiarazioni.mjs`, sezione 11.

### Decisioni della direzione del 20/09/2026 sulla fatturazione attiva

- Nel 2026 a Ecotyre si fattura a **202 euro la tonnellata** sulla **rete** e
  sull'**extra raccolta**; l'**ACI** ha le sue tariffe per regione. Nei report il
  prezzo si scrive a tonnellata (la prefattura del portale lo scrive al chilo,
  0,202: e' lo stesso prezzo). **Non e' una costante del gestionale**: per rete e
  ACI la tariffa deve stare in tabella `Tariffa`, e senza quella la riga va a zero
  euro in `errore` (`daTariffa` e `senzaTariffa` in `attivaCalcolo.ts`). I 202
  scritti nel codice (`TARIFFA_BASE_EXTRA_RACCOLTA` in `ecotyreTariffe.ts`) sono
  solo la base dell'extra raccolta 2026, e valgono solo per gli interventi senza
  prezzo proprio. Le tariffe seminate da `seedTariffeAttive2026` chiudono il
  **31/12/2026** - contratto annuale senza tacito rinnovo (06/10/2026) - tranne
  l'extra raccolta, che resta aperta perche' sono campagne occasionali.
- **Chi emette la fattura attiva e' SMOCO** (utente, 11/10/2026): i fornitori di
  raccolta e trattamento fatturano a SMOCO, e SMOCO fa a Ecotyre una fattura per
  canale. Il fatturante delle righe attive e' `FATTURANTE_ATTIVA` = 'SMOCO Srl'
  (`ecotyreTariffe.ts`), come nel foglio ACI dell'amministrazione, che ha «SMOCO
  Srl» su ogni riga da gennaio a settembre 2026. Le `VoceFatturazione` salvate
  prima portano 'ECOTYRE' e non si riscrivono: i due fogli ACI e il dettaglio di
  una riga stampano il soggetto, non il campo. Nessun codice confronta il
  fatturante con 'ECOTYRE', e `prove/fatturanteAttiva.mjs` lo tiene vero.
- **L'ANNO NUOVO VA PREPARATO, E LE TARIFFE SONO LA VOCE CHE MORDE PER PRIMA**
  (10/10/2026, `base44/shared/inizializzazioneAnno.ts`, funzione `preparaAnno`,
  scheda Target & Status > **Nuovo anno**, prove in
  `prove/inizializzazioneAnno.mjs`). Il contratto e' annuale senza tacito
  rinnovo: il 31 dicembre scade tutto. Dal 1° gennaio una riga senza tariffa
  vale **zero euro** e nasce con `stato_validazione: 'errore'`, sulla attiva
  come sulla passiva: al primo formulario di gennaio la fatturazione e'
  inservibile. `copiaAnnoTarget` portava avanti impianti, target, collegamenti,
  contratto ed elenco siti; **le tariffe no, e nessuno lo diceva**.
  La scheda e' una lista di controllo di otto voci - tariffe attive, tariffe
  passive, base dell'extra raccolta (dall'11/10/2026), contratto Ecotyre, target
  e siti, fotografia dei piazzali al 31/12,
  aperture degli impianti al 31/12 (dal 10/10/2026),
  contratti ai subfornitori - ognuna con il suo stato, il motivo per cui serve e
  dove si rimedia. **Si misura sui fatti**, non su una scadenza scritta nel
  codice: una tariffa «da rinnovare» e' una che copre il 31 dicembre e non copre
  il 1° gennaio dopo, e la regola resta vera anche fra tre anni.
  L'unica cosa che il gestionale fa da se' e' **preparare le tariffe**: stessa
  riga, validita' sull'anno nuovo, **prezzo dell'anno prima** e la nota «copiato
  dal {anno-1}, da confermare» (`conNotaCopia`, la stessa convenzione di
  `copiaAnnoTarget`). Due prudenze che non si tolgono: non sovrascrive niente e
  si puo' ripetere (chi ha gia' il suo seguito esce dall'elenco), e finche'
  nessuno conferma **la voce resta gialla** - un prezzo vecchio che passa per
  nuovo e' peggio di un prezzo che manca, perche' nessuno lo guarda piu'.
  La fotografia dei piazzali al 31/12 si legge a portale **quel giorno**: la
  pagina Unita' Locali mostra il saldo di adesso, non lo storico. Chi la chiede a
  gennaio legge un numero sbagliato e non se ne accorge - e' successo su sei
  piazzali del 2025, e quella lettura non torna piu'.

  **LE APERTURE DEGLI IMPIANTI (audit del 10/10/2026).** La lista aveva sei voci
  e nessuna guardava il punto da cui ogni IMPIANTO riparte: il peso non
  dichiarato del 31 dicembre, rete e ACI. Non lo scriveva nessuno - la chiusura
  chiedeva le due letture, le confrontava con la lettera di Ecotyre e le
  buttava; la copia d'anno crea le righe senza apertura, apposta; restava un
  campo a mano. Il 2 gennaio ogni impianto sarebbe ripartito da zero mentre il
  portale si porta dietro la giacenza vera: con i numeri del 10/10, circa 1.617 t
  di scarto su quattro impianti. Ora:
  - **la chiusura, salvando, scrive le aperture** dell'anno dopo dalle letture
    (`apertureDegliImpianti` in `shared/chiusuraAnno.ts`), con il giorno in
    `GiacenzaSito.apertura_del`: uno zero letto e uno zero mai scritto hanno lo
    stesso numero e conseguenze opposte, e la data li distingue. Si scrive solo
    quello che e' stato letto, e un'apertura gia' scritta non si cambia senza
    `sostituisci`;
  - **l'apertura si LEGGE al netto di quello che si dichiara dopo** (revisione
    del 10/10/2026, `aperturaNetta` in `shared/giacenzaPortale.ts`). La lettura
    del 31/12 contiene novembre e dicembre non ancora dichiarati; quelle
    dichiarazioni si caricano a gennaio ma sono dell'anno chiuso, e l'anno nuovo
    sottrae solo le sue. Senza questo, la giacenza restava gonfiata tutto l'anno
    (Dichiarazioni 8 t, portale 0) e l'ACI, che a portale non ha riscontro, in
    tutti e due i moduli. La lettura resta scritta com'e'; Giacenze e
    Dichiarazioni la usano al netto, e la scheda dell'impianto dice «letta X, di
    cui dichiarate dopo Y». Un'apertura senza `apertura_del` (scritta a mano)
    non e' una lettura e resta quella. Prova: `prove/aperturaNetta.mjs`;
  - **se la riga dell'anno dopo non c'e', la crea come la copia d'anno**, con la
    nota «copiato dal …, da confermare». Senza quella nota la copia d'anno la
    scambia per un elenco gia' compilato a mano e salta TUTTI gli altri siti: i
    piazzali resterebbero senza riga. La prova lo fa vedere (`prove/aperture2027.mjs`):
    chiusura e copia funzionano in tutti e due gli ordini;
  - **la lista ha la settima voce**, «Aperture degli impianti al 31/12».

  **LA CHIUSURA DEL 31/12/2026 E LE APERTURE DEL 2027** (prova generale del
  cambio d'anno, 15/10/2026, difetti 4, 5, 6, 11, 12, 29 e 31; decisioni
  dell'utente del 15/10/2026, D2 e D3).
  - **Un'apertura mai letta e' «—», mai zero** (`aperturaNetta`,
    `aperturaDelSito` in `shared/giacenzaPortale.ts`). Vale per un campo vuoto
    su una riga con `apertura_del`, o su un impianto che l'anno prima c'era (la
    sua riga, o la riga dell'anno scritta dalla chiusura:
    `sitiDellAnno().haLAnnoPrima`) in un anno cominciato. Per quell'impianto
    anche uno zero senza `apertura_del` non e' una lettura: la scheda Siti
    scriveva 0 dove il campo non c'era, e dalla chiusura del giro non lo scrive
    piu' (`TargetManager.jsx`: la casella vuota resta «—» e non si salva). Il
    perche' ha le stesse parole nei due moduli (`PERCHE_SENZA_APERTURA`,
    `PERCHE_ACI_NON_LETTA`, `PERCHE_RETE_NON_LETTA`). Un impianto nuovo
    dell'anno riparte da zero; una giacenza scritta a mano diversa da zero resta
    quella; il 2026 non cambia. La notte non dice «si scosta» per un impianto
    senza apertura: lo dice a parte (`notaSenzaApertura`). Nei numeri del giorno
    la giacenza del canale e' null, ma il resto da dichiarare e' quello che si
    conosce, con `senza_apertura` e `resta_almeno`: i carichi dell'anno senza la
    casella dall'anno prima, l'ACI coi suoi mesi, la rete il minimo. Un resto
    null faceva dire alla chiusura del mese «fatto» e alla dashboard 0 t. Nelle
    Dichiarazioni la riga del canale c'e' anche senza arrivi; l'ACI tiene i
    mesi, la rete e' «—» mese per mese, e il perche' sta in `flusso.perche`. La
    scheda dell'impianto dice «manca l'apertura del 31/12» in testa (non
    «giacenza a portale non disponibile»), «—» col perche' nella giacenza al
    31/12 dell'anno prima (non 0,00), e mostra il canale senza mesi; il
    riepilogo tiene la riga e il suo «—» porta il perche' del canale
    (`SezioneImpianto.jsx`, `Riepilogo.jsx`, chiusura del giro).
  - **La chiusura propone, l'amministratore salva** (`proposteDegliImpianti`).
    La rete e' la parte dell'impianto del file del 31/12: righe del ruolo
    'imp', piu' i carichi che il file non ha, meno il dichiarato dopo. E' il
    `giacenza_portale_t` delle Giacenze al 31/12, e il testo dice quale id
    contare (T-Cycle: 118 righe dell'impianto e 72 del piazzale sotto la stessa
    ragione sociale, distinte solo dall'id). L'ACI e' la giacenza che il
    gestionale calcola al 31/12 (D2), con accanto la lettera di Ecotyre e lo
    scarto. Le caselle vuote prendono la proposta (`proponi`, solo per la
    chiusura in corso). Un numero diverso si salva solo confermato (`conferme`,
    `da_confermare`). Una proposta sotto zero non si propone (`negativa`, avvisi
    `aci_negativa`/`rete_negativa`), e un numero sotto zero non si salva mai
    (`rifiutate`). Con una giacenza ACI al 31/12 e la casella vuota c'e'
    l'avviso `aci_vuota`.
  - **La riga dell'anno dopo nasce anche senza lettura.** Porta ruolo,
    tipologia e dichiara_rete, e la nota «… · dalla chiusura del 31/12/AAAA»,
    che la copia d'anno riconosce (`rigaDellaChiusura`). A chi la rete non la
    dichiara la rete non si chiede. **Finche' la riga dell'anno manca**,
    Giacenze, Dichiarazioni ed elenco «Da dichiarare» prendono ruolo e
    dichiara_rete dall'anno prima (`sitiDellAnno`, D3). Lo dicono le risposte
    (`portata_dal`, `nota_portata`, `siti_portati`, `nota_siti_portati`), una
    frase nella nota della notte, e dalla chiusura del giro anche le pagine:
    «portato dal 2026, da confermare sul contratto 2027» accanto al sito nella
    Situazione delle Giacenze, nella scheda dell'impianto delle Dichiarazioni e
    nella riconciliazione di «Da dichiarare», e la frase dei siti portati in
    testa alle Dichiarazioni.
  - **I carichi di fine dicembre che il portale chiude a gennaio** entrano da
    soli nell'apertura (nel 2026 il 93,4% dei carichi si e' chiuso a portale uno
    o piu' giorni dopo la fine del trasporto). La chiusura scrive l'istante e i
    movimenti gia' visti: `apertura_salvata_il` e `apertura_rettificate_json` su
    GiacenzaSito, `chiusura_salvata_il` e `chiusura_rettificate_json` su
    GiacenzaStoccaggio. Leggendo si aggiungono quelli arrivati dopo (`arrivi` in
    `aperturaNetta`/`letturaDelTrentuno`, `rilevazioniDopoLaChiusura`), e la
    scheda lo dice (`arrivatiDopoLaChiusuraDellAnno`). La chiusura non va
    rifatta, e senza una chiusura salvata non si legge niente in piu'.
  - La chiusura legge anche il file degli ordini non dichiarati e il report
    delle dichiarazioni: il salvataggio si rinvia anche sui loro caricamenti
    (`TIPI_RINVIO.chiusura` + `TIPI_PROPOSTE`, `prove/rinvioCaricamenti.mjs`).
  - I testi della chiusura scrivono le date gg/mm/aaaa (`giornoScritto`), anche
    nel foglio Excel. La Nuova rilevazione propone il giorno italiano, e avvisa
    se un 31/12 sostituirebbe la fotografia della chiusura (l'01/01/2027 alle
    00:30 proponeva il 31/12, e salvata portava il 2026 di Nappi Sud da 35,88 a
    25,88 t).
  Prove: `prove/aperturaNetta.mjs`, `prove/aperture2027.mjs`,
  `prove/provaDel2Gennaio.mjs`, `prove/chiusuraAnno.mjs`,
  `prove/pagineDichiarazioniGiacenze.mjs`, `prove/cambioAnnoRitocchi.mjs`
  (sezioni 8 e 9).

  Due voci della lista, scritte lo stesso giorno, mentivano. **«Target e siti»**
  contava `ImpiantoTarget`, un archivio che non ha mai avuto una riga e che la
  copia non scrive: sarebbe rimasta rossa per sempre. Ora conta i target annui
  dei raccoglitori (`TargetRaccoglitore`), quelli che la copia scrive e la griglia
  mostra. **«Contratto Ecotyre»** dava per pronto un contratto solo copiato, mentre
  una tariffa nello stesso stato era gialla: ora e' «parziale» anche lui. E le
  tariffe copiate **si confermano con un pulsante** (`preparaAnno`, azione
  `conferma_tariffe`): prima la lista chiedeva di confermarle e l'unico modo era
  cancellare la nota a mano, tariffa per tariffa. Sulla tariffa resta scritto chi
  l'ha confermata e quando.

  **L'ottava voce, «Base extra raccolta del {anno}»** (11/10/2026). La tariffa
  EXTRA_RACCOLTA resta aperta per scelta, quindi la voce delle tariffe attive la
  vede coperta anche nell'anno dopo e tace. Ma dal 1° gennaio un intervento
  senza prezzo scritto si fattura col prezzo dell'anno prima e l'avviso «prezzo
  di un altro anno», oppure a zero euro in errore. La voce si misura con
  `prezzoAttivoExtra` al 1° gennaio: pronta con la tariffa dell'anno o con una
  base scritta nel gestionale; gialla se il prezzo e' di un altro anno o se la
  tariffa e' copiata e da confermare; rossa se non c'e' niente. Scrivere la
  tariffa nuova dalle anagrafiche chiude da sola quella aperta.

  **«Da rinnovare» vuol dire che la copia servirebbe** (11/10/2026). Una tariffa
  del 31/12 e' coperta nell'anno nuovo se una del 1° gennaio ha la stessa chiave
  piena, oppure se la copia si scontrerebbe con lei
  (`tariffaCopertaNelNuovoAnno`, con la chiave dei conflitti di
  `conflittiTariffa.ts`). Una TUTTE copre RETE e ACI; una vecchia TUTTE e'
  coperta da una TUTTE, o da una RETE e una ACI insieme. Prima la tratta di RETE
  del 2026, con la TUTTE del 2027 gia' scritta a mano, restava «manca» per
  sempre, e il pulsante preparava 0 tariffe senza dire perche'. `chiaveTariffa`
  confronta fornitore, destinazione, produttore e destinatario **normalizzati**,
  come la passiva: il 110 scritto a mano su «GATIM» e' il rinnovo del 105 di
  «GATIM S.R.L.», e la copia non gli si affianca piu'. La copia passa dagli
  stessi controlli dei conflitti di chi salva a mano (`pianoCopiaTariffe`): una
  copia che si sovrappone a una tariffa gia' scritta non si crea e torna in
  `scartate` (`preparaAnno`) col motivo, che si vede nella conferma e nel
  messaggio finale, col prezzo all'italiana. Con zero tariffe da copiare la
  conferma non propone «Prepara».

  **Un prezzo copiato e non confermato non fattura in silenzio** (15/10/2026,
  difetto 15; D4, decisione dell'utente del 15/10/2026). Il 10/02/2027 gennaio
  si fatturava a 202 €/t con le righe «verificato» e nessun avviso.
  - La riga attiva resta «da_controllare» col prezzo e la nota «prezzo copiato
    dal {anno} con «Prepara le tariffe», da confermare in Target & Status ›
    Nuovo anno». Il dettaglio dell'attiva la scrive «da confermare» in ambra,
    anche nei file, e la conta fra le anomalie (`AttivaDetail.jsx`, chiusura
    del giro): prima usciva «ok» in verde con «Nessuna anomalia».
  - L'anomalia `tariffa_da_confermare` (nome concordato col margine e con
    EcoTyna: non si cambia) c'e' una per canale nell'attiva, e una per
    fornitore, prestazione, tratta e tariffa nella passiva.
  - `prezzoAttivoExtra` dice «Tariffa copiata dal 2026, da confermare:
    202 €/t».
  - `cambiaStatoFatturazione` «verifica» risponde 400 finche' ci sono righe
    cosi'.
  - Una copia esce dallo stato «da confermare» in tre modi: col pulsante di
    conferma; con un prezzo cambiato a mano con «Modifica»
    (`noteDopoIlPrezzo`); oppure se la tariffa e' nuova e scritta a mano, anche
    con «Duplica», con la nota della copia (`noteDellaTariffaNuova`, in
    create). La nota della copia se ne va e restano chi e quando. Le copie le
    scrive soltanto `preparaAnno`, che non passa da `gestisciAnagrafiche`.

  **La lista: tariffe aperte «da chiudere», contratti contati sui
  controfirmati** (15/10/2026, difetti 7 e 21).
  - Tariffe aperte: una rete o ACI senza fine, o con la fine oltre il suo
    31/12, e' «manca» se e' degli anni prima e «parziale» se e' dell'anno, col
    campo `da_chiudere`. Le passive si nominano senza prezzo, perche' sono costi
    e la lista la legge chiunque. La sola extra raccolta non fa «pronte» le
    attive.
  - Contratti, voce 6: gli annullati non contano. `preparaAnno` calcola gli
    attesi con `situazioneContratti`, come `contrattiAnno` e con la cache, e li
    passa come `totaliContratti`: «pronto» solo con tutti gli attesi
    controfirmati, «parziale» se qualcuno lo e', «manca» con nessuno. Prima
    diceva «pronto – Nel 2026 non ce n'erano: niente da rinnovare» mentre il
    modulo Contratti ne aspettava 32, con 0 controfirmati.
  - Senza gli attesi (la dashboard, che non rilegge i movimenti) non e' mai
    «pronto». Ma con i contratti fatti tutti controfirmati la voce porta
    `tace_in_dashboard`: resta gialla nella scheda e da sola non accende
    `avvicinandosi`. La prova della dashboard chiama la lista come la chiama
    `cruscottoOperativo`, senza `totaliContratti`.

  **Tariffe & Anagrafiche con l'elenco vuoto** (difetto 32): «Nessuna tariffa
  in vigore oggi: N tariffe sono scadute il 31/12/AAAA. Per l'anno nuovo:
  Target & Status › Nuovo anno › «Prepara le tariffe», oppure «Mostra
  archiviate».», con l'anno calcolato. Prima diceva «Nessuna tariffa. Clicca
  "Aggiungi tariffa" per iniziare», con 65 tariffe scadute.
- I report per l'amministrazione sono **tre, separati**: rete, ACI, extra
  raccolta. Le loro colonne non si toccano senza l'assenso dell'amministrazione.
- La prefattura del portale copre **solo rete e ACI**. L'extra raccolta non e'
  gestita a portale: il suo report nasce da quello che si scrive a mano nel modulo
  Extra Raccolta (formulario, prezzo, eventuali sovracosti di raccolta e di
  lavorazione).
- Le **terziarie** che il portale paga in prefattura (ordini TER, 8 euro/t con
  allegato VII, 10 col formulario) restano **fuori** dalla fatturazione attiva:
  nel confronto stanno in una sezione a parte, pronta per quando servira', e non
  contano come differenza.
- Il mese di una prefattura si ricava dal file (date di fine trasporto): caricata
  sul mese sbagliato viene rifiutata.
- La fine della programmazione delle secondarie al **18 dicembre vale solo per il
  2026** (`base44/shared/fineProgrammazione.ts`): per gli altri anni va comunicata.

### Le omologhe: vale «OMOLOGA OK» (12/10/2026)

`leggiRegistroOmologhe` (`src/lib/omologhe.js`) accetta solo `/omologa\s*ok/i`,
anche «OMOLOGA OK(R12)». Prima bastava la parola «omologa», e «OMOLOGA DA
RIFARE» sarebbe passata per un'omologa recepita (alta A15). Sul registro di
Irigom del 09/10 le 143 annotazioni sono tutte OK. Prova:
`prove/omologheRegistro.mjs`.

## I moduli e i loro conti

### La predittivita' delle secondarie: un anno, un motore (26/09/2026)

Rifondata dopo un'analisi che aveva trovato tre conti diversi per "quanti viaggi
servono" (Dashboard, Proiezione e suggerimento del lunedi' davano 97 e 54 viaggi
per lo stesso impianto). Ora c'e' **un motore solo**, `base44/shared/predittivita.ts`,
che legge da `predittivitaDati.ts` e risponde con `predittivitaRisposta.ts`; le
funzioni (`calcolaPianificazioneSecondaria`, `proiezioneSecondarie`,
`analisiSettimanalePredittiva`) e gli assistenti passano tutti di li'. Le regole
che l'utente ha dato, da non riderivare:

- **Un anno alla volta.** Parte dall'ancora delle giacenze al 31/12 dell'anno
  prima, guarda solo i movimenti dell'anno, sola rete, per fine trasporto. Al 31/12
  l'anno si chiude: il 1 gennaio il modulo mostra l'anno nuovo, con le logiche del
  nuovo contratto; gli anni chiusi si riaprono in sola lettura. Le regole che
  non sono input stanno in `base44/shared/regolePredittivita.ts` (un anno nuovo
  si aggiunge col contratto).
- **La configurazione si scrive in Target & Status** (utente, 27/09/2026: "mettiamo
  tutto in 'Target & Status' e gli altri moduli leggono da li'"), scheda Impianti
  e stoccaggi (`src/components/target-status/ConfigurazioneImpianti.jsx`), anno per
  anno col selettore dell'anno (`?anno=` nell'indirizzo). La vecchia scheda
  Configurazione della predittivita' e la pagina Target annuali non ci sono piu'
  (i loro indirizzi portano li'). E' per anno (`ImpiantoTargetSecondaria.anno`,
  `FornitoreSecondaria.anno`): l'anno di un record e' `annoDelRecord(r)`, cioe'
  il suo o il 2026 se non lo dice (`base44/shared/annoTarget.ts`, specchio in
  `src/lib/annoTarget.js`). Percio' questi due archivi **non** si leggono mai con
  `.filter({ anno })` (perderebbe i record senza anno): si leggono interi con
  `fetchAll` e si tengono per anno in memoria; ogni record nuovo porta `anno`.
- **Un anno nuovo nasce come copia del precedente**: pulsante "Copia dal
  {anno-1}" in Target & Status, funzione `copiaAnnoTarget` (`{ anno, simula }`,
  prima sempre con `simula: true` e la conferma dell'utente). Copia impianti e
  loro target, collegamenti degli stoccaggi (con la priorita' scritta per
  esteso), target dei raccoglitori annui e mensili, contratto Ecotyre (solo se
  l'anno non ne ha uno, e senza le variazioni del consorzio in vigore, con la
  nota che le ricorda: decisione dell'utente del 14/10/2026, vedi «Le
  variazioni del contratto in corso d'anno») ed elenco dei siti delle giacenze;
  tutto "copiato dal {anno-1}, da confermare". Salta quello che l'anno ha gia':
  si puo' ripetere e completa una copia interrotta. Il piano e' puro
  (`pianoCopiaAnno`, provato in `prove/annoTarget.mjs`,
  `prove/copiaAnnoTarget.mjs` e `prove/copiaSenzaVariazioni.mjs`).
- **Quello che si copia si conferma**, e ogni conferma lascia la sua riga nello
  storico delle modifiche (14/10/2026, vedi «Lo storico delle modifiche»).
  Impianti e collegamenti si confermano dal segno «da confermare» in Impianti e
  stoccaggi, i target dei raccoglitori dalla riga o con «Conferma tutte», il
  contratto con «Conferma il contratto <anno>» nella scheda Commessa Ecotyre.
  Salvare fine della programmazione e chili per viaggio (`RegoleAnno`) non
  conferma il contratto: la sua voce nello storico_json tiene davanti la nota
  della copia. Prima la copriva, e il contratto risultava confermato coi numeri
  dell'anno prima senza che nessuno l'avesse guardato. Prova:
  `prove/confermeNelloStorico.mjs`, sezione 4b.
- **Gli anni chiusi** (prima dell'anno in corso, ora italiana: `annoChiuso`) si
  leggono soltanto: la pagina non lascia scrivere e le funzioni che scrivono li
  rifiutano. Scrive solo l'amministratore (`soloAmministratore`).
- **Chi la predittivita' segue**: solo gli impianti con un target e
  `segue_predittivita !== false` (se manca vale vero). Green Tyre Project, T.R.S.
  e Gatim hanno solo il target, che le Giacenze leggono, e la predittivita' non li
  segue (interruttore "Segui nella predittivita'"); con loro non si seguono neanche
  i loro stoccaggi. Il discriminante e' solo `segue_predittivita === false`
  (`base44/shared/predittivitaDati.ts`), non l'operazione R3: 'R3' lo dichiarano
  anche Tecnogum sull'ACI e Irigom sull'extra raccolta.
- **Fine della programmazione e chili a viaggio** stanno sul contratto Ecotyre
  dell'anno (`CommessaEcotyre.fine_programmazione`, `kg_per_viaggio`, scritti in
  Impianti e stoccaggi). `fineProgrammazione(anno, commessa)` e
  `regolePredittivita(anno, commessa)` li usano quando ci sono (la data solo se e'
  dentro quell'anno); senza, vale quello di prima: per il 2026 il 18/12/2026 e 13 t.
  Un anno senza contratto e senza riga in `fineProgrammazione.ts` ripiega sul 31
  dicembre e lo dice all'utente con un avviso (`avvisoFineProgrammazione`, avviso
  `fine_non_definita`): meglio un avviso che una data inventata.
  La data propria di un impianto (`data_fine`) vince su quella dell'anno.
- **Tecnogum e Irigom (2026).** Tecnogum 2.295 t: primarie di Ecorecuperi (800 t),
  250 t da T-Cycle, il resto da Nappi Sud. Irigom 4.445 t: primarie di Smoco e
  Pneuservice (nel 2026 anche Emmesse, dopo l'incendio di Gatim di giugno), il
  resto da Nappi Sud. Nappi Sud non basta per tutti e due.
- **La priorita'** degli impianti di uno stoccaggio (`FornitoreSecondaria.priorita`,
  o le regole dell'anno; 2026: Nappi Sud prima Tecnogum, poi Irigom) **non** vuol
  dire servirne uno e poi l'altro: ogni settimana lo stoccaggio li serve tutti, al
  primo va il numero di viaggi che gli fa raggiungere il target entro la fine della
  programmazione (18/12/2026, o quella del contratto dell'anno), agli altri quello che avanza, fino alla loro parte
  e mai piu' della loro media settimanale arrotondata per eccesso (niente parte
  dell'anno concentrata in una settimana). Un impianto a fine programmazione non
  riceve piu' niente; il tetto e' il materiale del piazzale (giacenza + entrate al
  ritmo), al netto del plafond gia' usato.
- **Si programma sul target** (utente, 27/09/2026; la terza proiezione, il piu' basso
  dei due flusso per flusso, non c'e' piu'): la proiezione usa quello che resta
  del target di raccolta di ogni raccoglitore che porta agli impianti, e la
  divisione fra gli impianti si fa su quello che ci sara' davvero negli stoccaggi:
  le entrate di uno stoccaggio sono sempre quelle al ritmo reale, in tutti e due
  i conti (`entrate_se_rispettano_il_target_kg` e' solo un'informazione; con il
  target dei suoi raccoglitori Nappi Sud risultava avere 713 t invece di 441, e a
  Irigom si promettevano 24 viaggi) (`SCENARI = ['target', 'ritmo']`,
  `SCENARIO_PROGRAMMA = 'target'`). Accanto
  resta il **ritmo** reale delle ultime 12 settimane (anche a cavallo d'anno), per
  vedere se i raccoglitori ci stanno arrivando. Un flusso senza target (Emmesse
  su Irigom) vale il ritmo in tutte e due. I target si cambiano durante l'anno in
  Target & Status e tutto si rifa' dai numeri di adesso e da quello che e' gia'
  stato fatto.
- **Il target di un raccoglitore senza impianto si ripartisce come nelle
  Giacenze** (11/10/2026), con `ripartisciTargetPrimarie` sugli stessi
  conferimenti (`conferitiPerRipartizione`, `targetImpianti.ts`) e sugli stessi
  target mensili. Della ripartizione si tengono le quote dei siti seguiti: la
  quota di un sito non seguito resta fuori, non gonfia gli altri. Prima la
  predittivita' divideva l'annuo in proporzione ai chili dell'anno: sullo stesso
  target Nappi Sud aveva 30 t nelle Giacenze e 150 qui, e chi aveva cambiato
  impianto a luglio restava atteso dove non andava piu' (Tecnogum aspettava
  175,70 t da chi li' non porta). I target dei raccoglitori, annui e mensili, si
  leggono interi, e l'anno lo decide `recordDellAnno`, come in
  `calcolaGiacenze`. Una quota arrivata al piazzale porta `ruolo: 'stoc'`, ma il
  motore sceglie ancora il livello dal sito e non dal ruolo (`predittivita.ts`):
  per un sito che e' anche impianto quella quota va al livello dell'impianto, e
  cambiarlo e' una decisione da chiedere all'utente. Prova:
  `prove/stessoTargetStessoSito.mjs`.
- **Il gia' arrivato e il piazzale** (27/09/2026): dal piazzale di un impianto
  esce per prima la giacenza vecchia, quella al 31/12 dell'anno prima, poi in
  ordine cronologico quello arrivato dopo (FIFO): finche' esce la giacenza
  vecchia non si toglie niente dal gia' arrivato. Le partenze verso impianti
  **senza target** non si tolgono: non sono oggetto della predittivita' e stanno
  nel modulo Secondarie (consumano pero' il piazzale nell'ordine di arrivo).
  Quelle ACI, come Irigom verso Gatim, restano fuori comunque, perche' conta
  solo la rete.
- **13 t a viaggio** nel 2026, o `CommessaEcotyre.kg_per_viaggio` dell'anno (piu' formulari divisi per classe fanno lo stesso
  viaggio). Un viaggio **fatto** e' un camion in un giorno sullo stesso percorso
  (`chiaveViaggio`).
- **Il programma della settimana dopo** si fissa il **mercoledi' alle 8**, con un
  secondo giro alle 14 (`analisiSettimanalePredittiva`, `PianificazioneSettimanale`
  con `origine` 'programma'): il lunedi' si registrano i formulari della settimana
  prima, e l'utente guarda il martedi'/mercoledi'. La funzione e' solo per
  l'amministratore (il workflow gira come amministratore); scrive solo i percorsi
  non ancora fissati, quindi il giro delle 14 non cambia quello delle 8. Con un
  caricamento in corso rinvia (409), a meno che la settimana sia gia' fissata; se
  il programma gia' fissato non si legge, non scrive niente. L'amministratore lo
  corregge a mano (`origine` 'manuale', che il mercoledi' non tocca). Il
  programmato non si sovrascrive mai con il fatto: accanto si vede se si e' in
  anticipo o in ritardo. Le righe senza `origine` sono del piano di prima e non si
  leggono piu'.
- **La simulazione** (utente, 27/09/2026: "permettere a me una simulazione se
  io variassi quanto dice la predittivita'", per accontentare il piu' possibile
  tutti e due gli impianti): scheda Simulazione, conto in
  `base44/shared/simulazioneViaggi.ts` (specchio in `src/lib`). Chi programma
  prova i viaggi a settimana di ogni percorso fino alla fine della
  programmazione e vede, accanto alla proposta, se e quando ogni impianto
  arriva al target e quanto manca; se chiede a uno stoccaggio piu' del suo
  materiale, i viaggi possibili si dividono in proporzione e si dice. Non scrive
  niente: il programma resta quello della scheda Programma.
- **Niente email**: il modulo ha il pulsante "Esporta la situazione", la
  fotografia a ogni aggiornamento. La pagina dice sempre fin dove arrivano i dati
  caricati.
- **Si legge solo quello che serve**: la finestra dell'anno e del ritmo con
  `$gte` sulla fine trasporto, piu' i terminati senza fine trasporto; mai gli
  archivi interi, che conservano ormai gli anni passati.

### La fatturazione attiva verso Ecotyre

Le righe si calcolano in un punto solo, `base44/shared/attivaCalcolo.ts`:
l'anteprima (`getRiepilogoEcotyre`) e il documento (`elaboraFatturazioneAttiva`)
passano entrambi di li', cosi' non possono dire due ricavi per lo stesso mese.
Chi aggiunge una regola la aggiunge li', e aggiunge un caso a
`prove/attivaCalcolo.mjs` (`npm run prove`).

- **Rete e ACI** prendono il prezzo dalla tabella delle tariffe attive; la
  validita' si confronta sul giorno italiano, come nella passiva.
- **L'extra raccolta prende prezzo e sovracosti dall'intervento**
  (`prezzo_attivo_t` e i tre `sovracosto_*`), gli stessi che usa la pagina Extra
  Raccolta: pagina e fattura devono dire lo stesso ricavo. Ogni sovracosto e' una
  riga a corpo, senza chili. Le **secondarie di extra raccolta non si fatturano**:
  il ricavo sta sulla raccolta.
- **Una riga senza prezzo e' un errore**, non una riga verificata: il documento
  non si puo' verificare finche' la tariffa manca.
- **I tre canali non si sommano mai**, nemmeno nel riepilogo per tipo di servizio.
- **Il prezzo nei report e' davvero a tonnellata** (11/10/2026).
  `prezzoATonnellata` di `ecotyreTariffe.ts` (e del suo specchio) porta il
  valore della tariffa a €/t con l'unita' della riga. La usano i report
  (`fatturazioneExport.js`) e il format amministrazione
  (`formatAmministrazione.js`, che per la rete lo divide per mille). Prima una
  tariffa in €/kg usciva 0,202 sotto «Euro/TON» e 0,0002 al chilo. Una riga a
  viaggio non ha un prezzo a tonnellata: null, non zero.
- **Il formulario ripetuto sullo stesso ordine si dice, e la riga resta**
  (segnalazione alta del 20/09, corretta il 12/10/2026). `calcolaRigheAttiva`
  usa `formulariDoppi` di `formulari.ts`, la regola della passiva, canale per
  canale: anomalia `formulario_ripetuto` con pesi ed euro all'italiana
  («... e nella fattura a Ecotyre conta 2 volte (940,80 € in tutto)»). Le righe
  non si tolgono: quale tenere lo decide l'amministrazione. Lo stesso
  formulario su due ordini e' la ripartizione dell'ACI, non un doppione. La
  frase conta le copie che vanno davvero in fattura, cioe' quelle col peso
  effettivo (`in_fattura`, accanto a `quanti`): «conta una volta (470,40 €): la
  copia senza peso effettivo non si fattura», oppure «non entra» se nessuna ha
  il peso. Un peso che manca si scrive «—» (13/10/2026). Nell'anteprima
  (`RiepilogoEcotyre.jsx`) `formulario_ripetuto` sta in `DA_GUARDARE`: esce in
  ambra.
- **La regione del prezzo ACI e' quella di `regioneDi`** (12/10/2026): prima la
  provincia, poi la regione, scritta col nome della regione («PUGLIA» diventa
  «Puglia»), per tutte le righe dell'attiva. `findTariffa` confronta la regione
  senza maiuscole e senza spazi in piu' (`normRegione`, nei due specchi). Prima
  un ritiro senza provincia con «PUGLIA» nel file prendeva 230 €/t invece di
  240 in silenzio.

  **Un ACI senza regione ne' provincia e' un errore** (decisione del
  13/10/2026): la riga non prende nessuna tariffa, nemmeno quella ACI senza
  regione, resta a zero euro con `stato_validazione` 'errore' e la nota
  `NOTA_ACI_SENZA_REGIONE`, e il documento ACI resta «elaborata» finche' la
  provincia non si corregge nel caricamento (`cambiaStatoFatturazione` conta le
  righe in errore). L'anomalia `regione_mancante` ha `gravita: 'errore'`; la
  voce `senza_tariffa`, che mandava alle tariffe, per questo caso non nasce
  piu'. I chili restano nel mese e il surplus li conta come prima.
  Nell'anteprima (`RiepilogoEcotyre.jsx`) gli errori stanno in un riquadro
  rosso a parte («Da correggere: il documento del canale non si verifica
  finché restano»), e il badge del canale dice «senza prezzo».
  **Chi decide sulle anomalie conta anche `gravita === 'errore'`, non solo
  `senza_tariffa`**: le conferme di «Elabora Mese» e «Rielabora» in
  `AttivaDashboard.jsx` (`erroriDaCorreggere`, `fraseErrore`: «ACI: un ritiro
  senza provincia né regione (2,00 t). Il prezzo ACI cambia con la regione:
  sarà salvato a zero euro e in errore, e il documento ACI non potrà essere
  verificato finché non correggi la provincia nel caricamento.»), il toast di
  una «Verifica» respinta («Una riga senza prezzo (una tariffa che manca o un
  ritiro senza provincia)») e il riquadro delle prestazioni con errori, che dice
  le due cause. Con le tariffe ACI del 2026, tutte regionali, contando solo le
  tariffe mancanti il mese si elaborava senza chiedere niente (revisione del
  14/10/2026, portata dalla chiusura del giro). Sui dati veri dell'11/10/2026
  nessun ritiro ACI e' senza provincia. Prove:
  `prove/attivaDoppioniRegione.mjs` (con la funzione vera
  `cambiaStatoFatturazione` e la pagina eseguita),
  `prove/attivaConfermaSenzaProvincia.mjs` (le conferme della pagina).
- **Le date del riepilogo sono giorni italiani** (13/10/2026).
  `RiepilogoEcotyre.jsx` scrive la data di elaborazione e la fine trasporto
  dei movimenti della riconciliazione con `giornoRoma`: tagliando i primi
  dieci caratteri, un documento elaborato alle 00:30 del 1° ottobre era «del
  30/09» e un ritiro del 1° settembre «31/08». Prova:
  `prove/riepilogoEcotyreGiorno.mjs`.
- **Il surplus sulle tariffe e' UNA riga in piu' per canale** (13/10/2026; le
  regole del surplus in «Il surplus sulle tariffe»). `calcolaRigheAttiva({ ...,
  surplus })` riceve i record di `SurplusTariffa`, letti tutti con `fetchAll`;
  il disattivato si toglie in memoria. Ogni formulario che si fattura si guarda
  col giorno italiano della fine trasporto (`surplusDelMovimento`, direzione
  ATTIVA). Sotto le righe del canale c'e' una riga per surplus: `origine_dato`
  'SURPLUS', `surplus_id`, **`quantita` 0**, le tonnellate in `kg_riferimento`,
  gli ordini in `record_count`, l'importo arrotondato **una volta sul mese**
  (`importoSurplus`): formulario per formulario settembre 2026 farebbe 5.601,22
  invece di 5.601,20. La base e' tutto il canale, comprese le tonnellate di
  SMOCO e quelle «Trasp.»; con l'elenco valgono solo i fornitori dell'elenco
  (raccoglitore per la raccolta, destinazione per trattamento e stoccaggio),
  anche attraverso chi fattura per loro. **Chi conta ordini, chili, regioni o
  prezzi usa `eRigaDiMovimento`**, non `!eRigaACorpo`; chi somma gli euro prende
  anche il surplus, cioe' quello che si fattura. Il riepilogo
  (`getRiepilogoEcotyre`) dice `totale` (con il surplus), `totale_standard`,
  `totale_surplus` e `surplus[]`; la riga resta fuori da regioni, dicitura e
  badge dei prezzi. La riconciliazione la riconosce e lo spiega («Fuel
  Surcharge: +5,00 € sulle 1,00 t arrivate dopo.»), e su un documento chiuso
  aggiunge `surplus_a_parte`: va fatturato a parte, il documento non si riapre
  da solo. `calcolaRigheAttiva` restituisce anche `surplus_del_mese` per
  canale, con gli `ordini_ids` per la prefattura. Prova: `prove/attivaSurplus.mjs`.

**Nei file dell'esportazione il surplus e' una voce a se', con la sua riga**
(D3, decisa dall'utente il 13/10/2026 sera: il Fuel Surcharge *«deve essere
una voce disgiunta con un proprio rigo (per canale)»*). `AttivaEsportazioni.jsx`
passa ai quattro file tutte le righe del documento del canale. `tabellaAttiva`
(`fatturazioneExport.js`) e `tabellaAmministrazione` (`formatAmministrazione.js`)
le separano con `soloFormulari` e `soloSurplus`: `righe` sono i soli formulari,
cella per cella quelli di prima; `surplus` le righe dei surplus
(`{ celle, nome, origine, validita, base, euro_t, kg, ordini, totale }`); il
totale dei formulari e' `totale_formulari` (nel format `totale_euro_formulari`),
quello col surplus `totale` (`totale_euro`), sommati in centesimi. La riga del
surplus riempie le colonne del modello coi pezzi di `pezziSurplusReport`
(`surplusVista.js`): il nome sotto il Tipo (nell'extra raccolta sotto l'Ordine),
l'origine sotto l'Ordine (nell'extra raccolta nelle Note), la validita' sotto
la Data, «+5,00 €/t sulle 1.120,24 t del mese» sotto il FIR. **La Quantita'
resta vuota**: le tonnellate sono quelle dei formulari. Il prezzo e' quello del
foglio: 0,005 €/kg nel format della rete (sei decimali, perche' l'importo e' una
formula su quella cella), a tonnellata altrove; nel format ACI le Note restano
vuote. Pezzi corti perche' il PDF tiene tre righe per cella.
- **Excel**: sotto i formulari (nel report dell'attiva dopo la riga vuota) il
  «Totale formulari» in grassetto, cioe' il TOTALE di prima; le righe dei
  surplus vestite come nella passiva (`vestiRigaSurplusFoglio`: fondo indaco
  chiaro, corsivo indaco scuro, barra a sinistra, testi a capo nella cella, le
  colonne non si allargano); il TOTALE. Nel format le somme non prendono due
  volte le tonnellate: i chili del Totale formulari e del TOTALE sono `SUM` dei
  soli formulari, gli euro del TOTALE `SUM` dal Totale formulari all'ultimo
  surplus, l'importo del surplus `ROUND(kg*prezzo,2)` sulla rete e
  `ROUND(kg/1000*prezzo,2)` sull'ACI, coi chili scritti nella formula. Il foglio
  «Note» del report dice la riga a parole.
- **PDF**: le righe dei surplus col colore 'surplus' di `esportaTabella`, il
  TOTALE col surplus, il totale dei formulari nel sottotitolo («380 righe e la
  riga del Fuel Surcharge · formulari € 226.288,48 · cliente Ecotyre»). Dal
  14/10/2026 c'e' anche la riga «Totale formulari», sotto l'ultimo formulario e
  sopra il surplus e il TOTALE: gli euro nel report, anche i chili nel format.
  La scrive l'opzione `subtotali: [{ dopo, etichetta, valori }]` di
  `esportaTabellaPdf`. Ogni subtotale va prima della riga numero `dopo` (un
  `dopo` fuori misura finisce in fondo o in cima), e il piede non lo conta:
  ottobre rete dice ancora «114 righe», cioe' 113 formulari e il Fuel
  Surcharge. Il sottotitolo resta quello di prima. Senza surplus il PDF non
  cambia.
- La pagina dice, prima e dopo, che il surplus e' nel file e quanto fa («Nel
  file il Fuel Surcharge (€ 5.601,20) ha la sua riga, sotto i formulari, e il
  TOTALE lo comprende.»), in verde; un canale col solo surplus non da' un file.
  Il sottotitolo del format scrive i chili col punto anche sotto i diecimila
  (7.600, prima 7600). Senza surplus file e frasi sono quelli di prima.

Coi dati dell'11/10/2026: ottobre rete 113 formulari, 321.830 kg, 65.009,66 € +
Fuel Surcharge 1.609,15 € = 66.618,81 €; settembre identico (380 righe,
1.120.240 kg, 226.288,48 €). Prove: `prove/reportAmministrazioneSurplus.mjs` (i
file veri riaperti, le formule calcolate, i PDF di jspdf, un ottobre costruito a
471,65 t e +2.358,25 €, ottobre vero e settembre),
`prove/attivaEsportazioniSurplus.mjs` (la pagina eseguita) e la parte 7 di
`prove/attivaReportSurplus.mjs` (le righe sui dati veri). L'impronta dei tre
file (la vecchia parte 7b) non c'e' piu'.

**La riconciliazione.** Il portale chiude gli ordini giorni dopo il trasporto: un
ritiro del 30 giugno chiuso il 4 luglio entra negli archivi dopo che giugno e'
stato elaborato. A ogni apertura del mese il documento salvato si confronta con i
dati di oggi (`riconciliaAttiva`, chiave ordine + formulario: gli id dei record
cambiano a ogni importazione) e le differenze si mostrano: arrivati dopo,
cambiati, non piu' nel mese.

**Gli stati.** elaborata, verificata, approvata, (esportata), chiusa. Ogni azione
parte solo dallo stato giusto; un periodo chiuso si riapre solo con «riapri», che
lascia scritto nelle note del documento chi, quando e da che stato. Una
rielaborazione scrive prima i documenti nuovi e ritira i vecchi solo alla fine;
cio' che era gia' approvato o esportato non si cancella, resta come superato col
motivo.

**La chiusura del mese attivo** non e' un passaggio interno: un mese si chiude
quando l'amministrazione conferma che la fattura al cliente e' stata emessa ed e'
andata a buon fine. Il giorno della conferma (e il numero di fattura, se c'e')
restano sul documento. L'esportazione fa avanzare lo stato solo da «approvata».

**La prefattura del portale Ecotyre** (`base44/shared/prefattura.ts`,
`confrontaPrefattura`; la function di piattaforma invocata dal browser e'
`prefatturaEcotyre`, scheda «Prefattura Ecotyre»). Si carica in Excel o in PDF e
si confronta ordine per ordine con le righe di `attivaCalcolo.ts`, PRIMA di
esportare: solo in prefattura (con la ragione: altro mese, cancellato,
sconosciuto), solo nel gestionale, peso diverso, stesso peso e importo diverso
(col prezzo per tonnellata ricavato). Il canale di un ordine non si chiede: e'
quello che ha nel gestionale. La prefattura non ha un tracciato garantito: le
colonne si riconoscono dai nomi e gli ordini dalla forma (`ET26084363`). Il PDF si
legge dal suo testo (vedi piu' sotto), non con un agente. Una prefattura nuova non
cancella la precedente: la segna superata.

### La prefattura del portale in PDF si legge dal suo testo

**La prefattura in PDF** non la legge un agente: con oltre quattrocento righe si
rifiuta di restituirle tutte (provato il 20/09/2026). Il browser ne estrae il testo
con pdf.js (`src/lib/pdfTesto.js`, caricata solo quando serve) e
`leggiLineePdfPrefattura` lo legge riga per riga. Il PDF porta in testa il
riepilogo stampato (ordini, chili, euro per classi 1-4 e classe 9) e il mese: se
le righe lette non sommano quel riepilogo il caricamento viene rifiutato. Sul PDF
vero di luglio 2026: 416 righe, identiche all'Excel una per una.

### Il surplus nella prefattura: ogni ordine col suo (13/10/2026)

Come il portale scrivera' il Fuel Surcharge non si sa ancora (D1): la prima
prefattura col surplus sara' quella di ottobre 2026.
`confrontaPrefattura(righe, vive, altrove, surplus_del_mese)` riconosce le
quattro forme possibili e mette il surplus nel riquadro `surplus` del suo
canale (esito, testo, scarto):
- (a) **nel prezzo**: lo scarto di un ordine e' esattamente il surplus atteso su
  quell'ordine, quindi non e' un importo diverso;
- (b) **una riga per ordine** col Tipo o il Prodotto «Fuel Surcharge»: i suoi
  chili non si sommano all'ordine;
- (c) **una riga sola** senza ordine: va al canale che nomina, al canale unico
  del file o al canale con quell'importo; «insieme» se e' di tutti, altrimenti
  finisce in `surplus_da_attribuire`;
- (d) **niente**: Ecotyre lo comunica a parte, e si fattura a parte. Il
  confronto lo scrive e non lo conta (vedi sotto).

La riga del surplus si riconosce dalle parole, mai dal Prodotto vuoto (ce
l'hanno anche le terziarie); un produttore «Carburanti» resta un formulario. Nel
PDF, come nell'Excel, una riga che comincia con «Totale» non e' una riga di
surplus in piu'. `prefattura.euro` del canale resta lo standard.

**Il Fuel Surcharge fuori dalla prefattura non e' una differenza** (regola 3,
risposta dell'utente del 13/10/2026 sera). Se Ecotyre lo comunica a parte, la
prefattura non lo porta mai: contarlo fra le differenze voleva dire una
conferma a ogni esportazione, ogni mese, per una cosa gia' saputa. Ora il
riquadro del canale lo SCRIVE soltanto (sulla rete della prova, luglio 2026:
«Fuel Surcharge, 5.611,20 € (1.122,24 t × 5,00 €/t), non è nella prefattura: si
fattura a parte. Non è una differenza:
la prefattura non porta nessun surplus, né nei prezzi né in una riga.»), con
`conta` falso e `a_parte` vero. Il confronto lo ripete per canale in
`surplus_a_parte` (canale, nome, euro, testo; rete e ACI ognuno il suo, mai
sommati), il mese «coincide» se il resto torna, e `AttivaEsportazioni.jsx` non
chiede conferma per lui. La pagina della prefattura lo dice sotto l'esito, col
cartellino «non in prefattura: si fattura a parte» nel tono dell'osservazione
(`esitoDelSurplus`), non nell'ambra di «c'e' qualcosa da chiarire». La pagina
delle esportazioni lo scrive accanto all'esito del confronto, canale per
canale, col colore del surplus. **Solo quando la prefattura non porta nessun
surplus** (`surplusNelFile` falso: nessuna riga di surplus, nessun canale con
una delle forme a-c, nessuna ipotesi di un surplus nel prezzo). Se lo porta su
un altro canale, o in una riga che non si sa di chi sia, il canale dove manca
e' un surplus mancato: conta ancora, e il riquadro dice «va chiarito prima di
fatturare». Una differenza vera dei formulari chiede conferma come sempre, e si
conta da sola. Prove: `prove/prefatturaSurplus.mjs` (anche sulla prefattura
vera di luglio 2026, e la pagina montata senza browser) e
`prove/attivaEsportazioniSurplus.mjs`, sezione 5.

**Uno scarto si dice arrotondamento solo se lo e'** (revisione del 13/10/2026).
Nelle forme a e b ogni ordine si confronta col suo surplus (i chili del
gestionale per i suoi €/t, con `importoSurplus`, entro un centesimo), e
`surplus.ordini` dice quali ordini non l'hanno, quali l'hanno diverso (due
volte, per esempio), quali l'hanno senza che il gestionale lo preveda, quali
sono senza importo e quali sono gia' fra le differenze. Nella forma c la riga
torna se fa la riga del gestionale o la somma arrotondata ordine per ordine
(`surplus.arrotondamento`), con un centesimo di margine. La tolleranza di prima,
mezzo centesimo per ordine (2,05 € sulla rete di luglio 2026), lasciava passare
una riga sola sbagliata di 2,00 €, un ordine senza la sua riga di surplus e uno
con la riga doppia. Un importo che la prefattura non ha non e' zero: esito
`senza_importo`, «—». Il surplus conta fra le differenze solo se non torna, se
manca o se c'e' solo nella prefattura. La pagina (`PrefatturaEcotyre.jsx`)
elenca gli ordini da chiarire sotto il riquadro (`ordiniSurplusDaChiarire` di
`surplusVista.js`). Prova: `prove/prefatturaSurplus.mjs`, sulla prefattura vera
di luglio 2026 modificata nelle quattro forme.

### Il margine

`base44/shared/margine.ts`, funzione `calcolaMargineAnno` (la chiama la function
di piattaforma `calcolaMargine`), scheda «Margine» della
fatturazione (solo admin). Ricavo attivo meno costo passivo, mese per mese e
canale per canale, con una sola lettura degli archivi. **Non ha regole sue**: usa
`attivaCalcolo.ts` e `passivaCalcolo.ts` (il calcolo della passiva, che la
funzione `calcolaPassiva` si limita a chiamare), quindi i numeri sono gli stessi
delle due fatturazioni al centesimo. Tre canali, tre margini, mai un totale. Il
costo di un mese comprende stoccaggio, trattamento e secondarie di quel mese, che
possono riguardare tonnellate raccolte prima: il numero che conta e' l'anno.

**Il surplus nel margine** (13/10/2026). `calcolaMargine` legge
`SurplusTariffa` e lo passa come `dati.surplusAll` all'attiva e alla passiva:
ricavo e costo lo comprendono gia'. Un surplus incassato e pagato sulle stesse
tonnellate non cambia il margine. Lo cambiano le tonnellate di un interno
(SMOCO: si incassa e non si paga, D2), importi diversi fra attiva e passiva, un
surplus solo passivo o solo attivo, e ciascuna ragione si dice in
`surplus[].perche`. Ogni mese e l'anno hanno `ricavo_surplus`, `costo_surplus`,
`surplus_netto`, `tonnellate_surplus_interni` e `surplus[]` col testo pronto per
la scheda, che mostra la colonna «di cui surplus». Gli €/t ai fornitori il
margine li legge dal record. Settembre 2026 col Fuel Surcharge: +1.268,40 €
sulla rete (253,68 t di SMOCO x 5) e +24,50 € sull'ACI. Prova:
`prove/margineSurplus.mjs`.

**Un margine con prezzi mancanti e' «—»** (prova del cambio d'anno,
15/10/2026, difetto 18). Il 15/01/2027, senza le tariffe 2027, la dashboard
diceva «Rete € 0,00 · nessun ricavo · 7,10 t» e l'extra raccolta «€ −113,50 ·
−77,2% del ricavo». Ogni mese e l'anno hanno `prezzi_mancanti` (righe
dell'attiva in errore piu' passive senza tariffa), `parziale` e
`testo_prezzi_mancanti`. Con prezzi che mancano, margine, % ed €/t sono null;
ricavo e costo restano e si dicono parziali. «Nessun ricavo» si scrive solo con
0 t. `righe_da_confermare` (e `testo_da_confermare`) conta le tariffe copiate e
non confermate, e il margine resta un numero. La frase arriva in tutti i posti
che mostrano il margine: la scheda Margine, la sezione Economia della
dashboard, il PDF della settimana e, dalla chiusura del giro, la colonna «Nota»
dell'Economia nel PDF del quadro (`esportaQuadro.js`). Extra Raccolta: con un
intervento da fatturare senza prezzo `totaliExtraRaccolta` e l'analisi per
produttore dell'Excel e del PDF scrivono il margine «—» con la frase
`testoInterventiSenzaPrezzo`. Prove: `prove/margine.mjs`,
`prove/dashboardPagina.mjs`, `prove/riepilogoSettimanale.mjs`,
`prove/extraRaccoltaSurplus.mjs` (6e), `prove/cambioAnnoRitocchi.mjs` (6).

### Il foglio della passiva dell'amministrazione (11/10/2026)

**La riga va sotto la voce della sua tariffa.** La passiva scrive su ogni riga
la tariffa che ha scelto (`tariffa_id`). Quando due voci riconoscono la stessa
riga, il foglio (`src/lib/passivaAmministrazione.js`) la mette sotto quella la
cui tariffa (`tariffaDellaVoce`) e' proprio quella; prima andava alla prima in
ordine di stampa. Una raccolta di Logistica da NA scaricata a Nappi Sud va sotto
«conferiti c\o Nappi Sud» a 71, non sotto «Campania - NAPOLI» col prezzo
sbagliato.

**Anche un centesimo di differenza fra voce e passiva si dice** (soglia 0,005
€). Se e' un centesimo, l'avviso spiega che e' arrotondamento: la passiva
arrotonda riga per riga, il foglio sulla voce.

**Il foglio legge tutto.** Voci, tariffe e interventi si leggono con
`fetchAllClient`, le tariffe con la stessa regola di `calcolaPassiva`. Un errore
di lettura si dice, non diventa un elenco vuoto. Il viaggio misto e il centesimo
dell'extra raccolta nel foglio sono in «Canali indipendenti». Prove:
`prove/passivaGrana.mjs`, `prove/validitaTariffa.mjs`.

**Il surplus sulle tariffe nel foglio e nei file (13/10/2026).** Il surplus (il
Fuel Surcharge) non e' una voce del modello: e' una riga `tipo: 'surplus'` che
`foglioPassiva` aggiunge sotto le voci del soggetto, col numero del calcolo (t x
€/t arrotondato una volta per fornitore). Il foglio non lo rifa'.
- Le tonnellate della riga sono le stesse del mese e NON si sommano: il totale
  del soggetto e del blocco in tonnellate resta quello delle voci (piu' i chili
  che nessuna voce prende, dal 13/10/2026: vedi sotto), in euro comprende il
  surplus (`totale_standard` e `totale_surplus` lo scompongono).
- Nel periodo di validita' la riga c'e' anche a zero per i soggetti del modello
  senza movimenti, mai per un interno.
- Nell'Excel le tonnellate sono un numero col formato `(#,##0.00)` e il totale
  e' `=ROUND(t*€/t;2)`. Le somme sono due elenchi: le tonnellate prendono solo
  le voci (`sommandiT`), gli euro anche il surplus (`sommandiE`), e lo stesso
  vale per il trasporto e per l'extra raccolta; nella fascia del canale c'e' «di
  cui …» come formula.
- Nel file del canale (`passivaExport.js`) le tonnellate del surplus sono TESTO
  «(12,50)», cosi' una somma sulla colonna non le prende.
- L'extra raccolta prende il suo surplus dal modulo: `PassivaModulo` legge
  `SurplusTariffa` e `Fornitore` una volta per foglio e passa
  `contestoPrezzi([], fornitori, surplusAll, subfornitori, tariffe)` a
  `bloccoExtraRaccolta` (le tariffe passive, gia' lette per le voci, dal
  14/10/2026: danno il contratto della tratta delle secondarie); `extraConSurplus` veste quelle righe e non le prende
  mai anche dal calcolo, cosi' il surplus si dice una volta sola.
- Un fornitore senza dettaglio porta in `righePiatte` lo standard, non il
  totale.
- La riga del surplus di chi non ha la tariffa del mese (regola 1 del
  13/10/2026 sera) porta l'avviso in testa alla nota, e dice quello che fa il
  foglio, non il calcolo. Se una voce del soggetto prezza lo stesso quelle
  tonnellate (fonte `modello`, `tariffario` o `movimenti`, con prezzo e totale
  sopra zero) la frase e': «Tariffa del mese mancante: nel foglio la riga
  standard ha il prezzo del modello; il surplus c'è lo stesso.» Al posto del
  modello puo' dire «la tariffa degli altri movimenti della voce» o «il prezzo
  che il tariffario dà alla voce». Se il foglio prezza solo una parte aggiunge
  «su 10,00 t delle 13,00 senza tariffa, le altre no». La frase del calcolo
  («la riga standard no») resta solo quando nel foglio la riga standard e'
  davvero a zero: prezzo zero, tariffe diverse («vari»), oppure chili che
  nessuna voce prende (`coperturaSenzaTariffa`, `avvisoSurplusDelFoglio`).
  Revisione del 13/10/2026: un foglio aveva la riga standard di ALFA a 910 €
  dal modello, e la riga del surplus subito sotto diceva «la riga standard
  no». Prova: `prove/surplusTariffaMancante.mjs`, sezioni 2 e 3.
- La riga si vede: in pagina `PassivaSurplus.jsx` col token `--eco-surplus` e
  la parola «Surplus»; nei fogli e nei PDF l'indaco 6366F1, in corsivo con la
  barra (vedi «Un colore solo» in «Il surplus sulle tariffe»).

Senza surplus settembre 2026 del modello e' identico al centesimo. Prova:
`prove/passivaAmministrazioneSurplus.mjs` (anche settembre 2026 dei dati veri,
senza surplus come prima e col Fuel Surcharge simulato coi numeri del progetto:
rete raccoglitori 69.684,18 €, di cui 4.332,80).

**Quello che si legge e' quello che Excel rifa'** (decisioni dell'utente del
13/10/2026). Nel foglio Excel ogni totale e' una formula che porta dentro il
numero gia' calcolato: l'amministrazione lo apre, Excel ricalcola, e se la
formula dice un'altra cosa il numero cambia sotto gli occhi di chi lo legge.
- **I chili che nessuna voce prende stanno nelle tonnellate del fornitore e del
  blocco, non negli euro.** Sono chili che il fornitore ha davvero portato nel
  mese, e il segnale che il modello va aggiornato; un prezzo non ce l'hanno.
  Nella rete a due livelli la riga del fornitore diceva 12 t (voci + senza voce)
  e la formula sommava le sole voci, 10 t: appena Excel ricalcolava diventava 10.
  Ora la formula li somma come il numero che porta dentro, anche nel Totale
  complessivo dell'ACI piatta, e anche quando la riga del surplus sta fra la
  voce e i chili senza voce.
- **L'extra raccolta dice il nome del surplus.** Il calcolo della passiva non
  ce l'ha (PassivaModulo le passa un oggetto vuoto: il suo surplus lo conta il
  modulo Extra Raccolta), e la fascia dell'Excel e il riquadro del PDF dicevano
  «di cui surplus» dove rete e ACI dicono «di cui Fuel Surcharge». Ora i surplus
  si prendono dalle righe del blocco degli interventi, uno per surplus
  (`passivaAmministrazione.js`), e il nome e' lo stesso dappertutto.

Prova: `prove/passivaAmministrazioneRicalcolo.mjs`, che rifa' ogni formula del
foglio come Excel (SUM, ROUND, somme di celle) e pretende il numero della
cella, anche su ogni mese del 2026 dei dati veri col modello, con le voci
dell'archivio e col Fuel Surcharge vero; settembre 2026 del modello resta al
centesimo.

**Le righe «—»** (prova del cambio d'anno, 15/10/2026, difetto 19; D4 e D5,
decisioni dell'utente del 15/10/2026). Prima gennaio 2027 senza le tariffe 2027
usciva rete 2.515,50 € (GATIM 6 t × 70 €) e ACI 344,00 € coi prezzi del 2026, e
la nota diceva solo «il prezzo arriva dal modello». La voce ha `prezzo_anno`: il
modello dell'amministrazione e le voci copiate portano i prezzi del 2026, e
vuoto vuol dire l'anno della voce. Nel foglio di un anno dopo, una voce con
movimenti «senza tariffa» e prezzo di un anno prima e' «—»: prezzo e totale
null, fuori dal totale, con la nota «Tariffa 2027 mancante: il prezzo della
voce (70 €/t) e' del 2026…». Lo stesso vale per una voce o una tratta prezzata
con una tariffa copiata e non confermata («Tariffa 2027 copiata dal 2026 e non
ancora confermata (70 €/t)…»). Le tratte delle secondarie senza la tariffa del
mese non hanno una riga, ma il totale del trasporto le dice. Ogni blocco e il
foglio hanno `senza_prezzo` (`mancanti`, `da_confermare`, `tratte`, `testo`):
l'Excel scrive «—» come testo, fuori dalle somme, con «Totale parziale: …»
sotto il totale, la pagina lo dice sopra il foglio, e dalla chiusura del giro
anche il PDF (`passivaAmministrazionePdf.js`): «—» in ambra nel prezzo e nel
totale (non «vari» e «0,00 €»), «Totale parziale» sotto il blocco e il
trasporto, «parziale» nei riquadri e accanto al totale del canale, e la legenda
con le due ragioni. Una voce senza movimenti tiene il prezzo, che e' un
riferimento. «Prezzo del 2026, contratto scaduto: vale anche per il 2027?» di
`VociPassivaDialog` cambia solo `prezzo_anno`, e fa passare la voce da «—» a un
totale: `prezzo_anno` e' fra i campi tracciati (`campiTracciati`, i due
specchi), e la conferma lascia la sua riga nello storico. Prove:
`prove/passivaAmministrazioneRicalcolo.mjs`, sezioni 5-7,
`prove/modelloPassivaAmministrazione.mjs`, `prove/cambioAnnoRitocchi.mjs` (5).

### Un nome, un record: anagrafica e consuntivi (11/10/2026)

**Fornitori e servizi.** `gestisciAnagrafiche` rifiuta un Fornitore o un
Servizio nuovo, o rinominato, il cui nome normalizzato esiste gia' (409 col
doppione). Una modifica che lascia il nome com'e' passa sempre. I doppioni nati
prima («GATIM» e «GATIM S.R.L.») li toglie l'amministratore dalla pagina,
tenendo il record a cui puntano le tariffe. Prova:
`prove/anagraficheDoppioni.mjs`. Una modifica che svuota il nome (vuoto o null)
risponde 400, come una creazione senza nome: dal 13/10/2026 il nome si cambia
dalla scheda Fornitori, e un nome vuoto, che non ha chiave, passava il
controllo dei doppioni. Quando un nome usato puo' cambiare lo dice «Prima di
eliminare, chi lo usa».

**I consuntivi dei fornitori.** Ce n'e' uno per nome normalizzato, ruolo, anno,
mese e canale (`chiaveConsuntivo`). Ricaricare il file lo **sostituisce** dopo
una conferma: la pagina la chiede, la funzione senza `sostituisci: true`
risponde 409. Il caricamento di prima resta scritto nelle **note**
(`notaSostituzione`): quando, quale file, com'era andato e l'importo, piu' la
storia se era gia' alleggerito. Si usano le note e non la storia perche' la
storia si scrive al quarantesimo giorno e una storia gia' presente non si
riscrive (`togliIlDettaglio`). Prova: `prove/consuntivoRicaricato.mjs`.

### Prima di eliminare, chi lo usa (12/10/2026)

Prima tariffe e fornitori si eliminavano subito (audit del 20/09, alta A88). Ora
`gestisciAnagrafiche` conta i riferimenti con
`base44/shared/riferimentiAnagrafica.ts`.

Per un fornitore:
- le tariffe, per id o per nome;
- i fornitori che fatturano tramite lui;
- le voci del foglio della passiva;
- i contratti;
- le primarie di rete e ACI, le secondarie, gli interventi di extra raccolta e
  le terziarie terminati che lo nominano (le terziarie dal 14/10/2026, anche
  come impianto da cui partono: la loro ragione sociale).

Con un doppione dello stesso nome normalizzato contano solo i collegamenti per
id, perche' i nomi li prende l'altro record.

Per una tariffa contano i movimenti terminati che soddisfano tutte queste
condizioni:
- sono del suo canale (TUTTE = rete e ACI);
- la fine del trasporto, letta sul giorno italiano, cade nel periodo di
  validita';
- stanno nel suo ambito di regione (`regioneDi`) e di provincia;
- per una passiva, il fornitore ha il ruolo della prestazione.

Una tariffa `non_attivo` non da' il prezzo a niente. La classe non si guarda: si
dice il perimetro, non il conto esatto della passiva. Le terziarie per una
tariffa non contano (`ARCHIVI_CON_TARIFFA`): le paga il portale in prefattura, e
per eliminare una tariffa non si leggono.

Con riferimenti la funzione risponde 409 con l'elenco e propone l'alternativa:
«disattiva» per il fornitore, «chiudi periodo» per la tariffa. Elimina solo con
`conferma_eliminazione: true`, e il motivo nello storico dice che cosa c'era. Un
archivio che non si legge da' errore: un controllo a meta' direbbe «nessuno lo
usa». Le pagine `FornitoriManager` e `TariffeUnificate` mostrano l'elenco: le
tariffe con «Chiudi periodo» ed «Elimina comunque», i fornitori con «Disattiva»
e, solo senza movimenti, «Elimina comunque».

**Un fornitore con movimenti terminati non si elimina** (decisioni dell'utente
del 13/10/2026), nemmeno con la conferma: i suoi movimenti sono gia' nei conti,
fatturati o da fatturare. `riferimentiFornitore` dice `eliminabile: false` e la
proposta `disattiva` (`gia_disattivato` per uno gia' spento); `gestisciAnagrafiche`
risponde 409 senza `richiede_conferma` e non scrive niente. La finestra di
`FornitoriManager` mostra l'elenco e solo «Disattiva», o solo «Chiudi» se e'
gia' disattivato: niente «Elimina comunque». Senza movimenti (tariffe, voci,
contratti) si elimina come prima, con la conferma; a uno gia' disattivato la
finestra dice che lo e' e non propone di disattivarlo. Il record letto per i
riferimenti e' il «prima» dello storico dell'eliminazione: una lettura sola.

**Le terziarie contano** (revisione del 14/10/2026). Sono movimenti terminati
dell'archivio, di SMOCO, e chi aveva solo terziarie si eliminava senza domande:
sui dati dell'11/10 IMPRIMET SRL (6), KATANE' TRASPORTI S.R.L. (3), PIRRERA
ANTONIO (3) e RIA PIETRINA (4).

**La ragione sociale di un fornitore gia' usato non cambia** (revisione del
14/10/2026). Dalla scheda Fornitori il nome si modifica. Rinominare scollegava il
fornitore da quello che lo cerca per nome: i movimenti (portano il nome del
portale), la catena dei subfornitori, il fornitore interno, le voci e i
contratti. Poi si eliminava senza domande. Ora:
- una rinomina che lascia la stessa chiave (`normalizzaRagioneSociale`:
  maiuscole, punti, S.R.L.) passa sempre, senza letture in piu';
- una che cambia la chiave passa solo a un fornitore che niente usa ancora
  (`siRinomina`: riferimenti a zero, come un nome sbagliato appena scritto);
- altrimenti si risponde 409 con `rinominabile: false` e il testo di
  `testoRinomina`: chi cambia davvero ragione sociale si aggiunge come fornitore
  nuovo, e il vecchio si disattiva e resta per i movimenti col nome di prima.

Le letture sono quelle dell'eliminazione, e si fanno solo quando la chiave
cambia. Il record da modificare che non si legge non si modifica (errore, come
per l'eliminazione). La ragione sociale non passa dallo storico: le rinomine che
passano non cambiano nessun conto. La scheda lo dice sotto il nome.

**Il record che non si legge non si elimina** (revisione del 13/10/2026). La
lettura del fornitore o della tariffa da eliminare finiva in un catch che dava
null, e con null il controllo si saltava: un errore passeggero bastava a
eliminare senza domande un fornitore usato. Ora risponde errore e non elimina
niente.

**A una tariffa gia' chiusa non si propone di chiudere il periodo** (revisione
del 13/10/2026). Una tariffa con la data di fine passata, o uguale a oggi (giorno
italiano), ha la proposta `periodo_chiuso`. La regola sta in
`riferimentiTariffa(t, { movimenti, fornitori, oggi })` di
`base44/shared/riferimentiAnagrafica.ts` (senza `oggi` vale `oggiRoma()`), e il
testo in `testoRiferimenti`: gestisciAnagrafiche passa solo `oggi: oggiRoma()` e
non ha regole sue (revisione del 13/10/2026; prima stava li', e chi chiamava
riferimentiTariffa da solo non la vedeva). Il testo dice che vale solo per i
giorni che ha coperto, e la finestra non mostra «Chiudi periodo». Dal 01/01/2027
tutte le tariffe del 2026 sono in questo caso. «Chiudi periodo» chiede la data in
gg/mm/aaaa, propone oggi in Italia e rifiuta una data dopo la fine che la
tariffa ha gia': chiudere accorcia, mai allunga (contratti annuali senza tacito
rinnovo).

Dati dell'11/10:
- 34 fornitori su 37 hanno riferimenti: 33 non si eliminano (hanno movimenti
  terminati; erano 29 prima di contare le terziarie), 1 si elimina con la
  conferma, e 34 non cambiano chiave del nome; 3 sono liberi (GTP, il doppione
  GATIM S.R.L., Ecotyre Scrl);
- 63 tariffe su 65 hanno movimenti nel periodo.

Prove: `prove/eliminaAnagrafiche.mjs`, che fissa «oggi» con una Date finta
perche' l'esito non cambi col calendario, e `prove/anagraficheDoppioni.mjs`.

### La scheda dei fornitori (13/10/2026)

In Fatturazione, scheda Fornitori, la matita apre la scheda del fornitore:
ragione sociale, tipo, partita IVA, regione e «Recapiti per i contratti»
(referente, cellulare, telefono, email, PEC). La stessa scheda aggiunge un
fornitore nuovo. Si scrive solo con `gestisciAnagrafiche`, e solo i campi
cambiati (`datiDaScrivere`): un recapito tolto diventa null, una scheda non
cambiata non scrive niente. `cellulare`, `pec` e `referente` sono campi del
`Fornitore` e passano dallo storico delle modifiche (`CAMPI_TRACCIATI.Fornitore`,
non riservati, etichetta la ragione sociale); stato, nome e ruoli no, e non
costano letture. I contratti li leggono con `RECAPITI_DALL_ANAGRAFICA`
(FORNITORE_TEL_2, FORNITORE_EMAIL_2, FORNITORE_REFERENTE), e l'anagrafica vince
sul contratto dell'anno prima. Una modifica che svuota il nome risponde 400. Su
un telefono la scheda e la finestra di eliminazione scorrono (`max-h-[90vh]
overflow-y-auto`, come le altre finestre di Fatturazione). Telefono ed email
non sono nello storico: bastano due righe in `CAMPI_TRACCIATI.Fornitore`, uguali
nei due specchi, e la prova che oggi fissa i tre campi. Prove:
`prove/recapitiFornitore.mjs`, `prove/eliminaAnagrafiche.mjs` e la sezione 9 di
`prove/storicoModifiche.mjs`.

### La pratica mensile di Irigom

Le dichiarazioni di Irigom le prepariamo noi, nella scheda Irigom di
Dichiarazioni Impianti (`PraticaIrigom.jsx`). Il registro di carico e scarico lo
legge `src/lib/registroIrigom.js` (`leggiRegistroIrigom`): le lettere di colonna
dei fogli Dettaglio e Cons., i colori e le note stanno la', non in
praticaIrigom.js. Le regole stanno in
`src/lib/praticaIrigom.js` e sono provate sul caso vero di agosto 2026
(`prove/praticaIrigom.mjs`, dati in `prove/dati/`): toccarle vuol dire rifare
quella prova.

- **Ferro**: formulari del foglio Dettaglio, colonna AH. Destinatario MMF mai;
  cella arancione FFC000 per intero; altrimenti conta la **nota** di Excel
  ("ECT: 6,62" in tonnellate, anche "27,5 ECP 1,06 ECT"), non il colore, che
  cambia nell'anno. La somma deve fare la colonna X del foglio Cons.
- **Allegati VII** (J numero, AL peso): si cerca la **combinazione con la somma
  piu' vicina al ciabattato uscito** (V), mai sotto se si puo', prima fra i soli
  **SMOCO**; se non bastano si aggiungono i **TRANSAR** e per ultimi gli altri
  trasportatori (regola dell'utente del 22/09/2026, `scegliAllegati` in
  `src/lib/praticaIrigom.js`: la cascata dei tre bacini e' sua, e per ciascuno
  chiama `combinazioneVicina`, che prova tutte le somme possibili e poi toglie
  gli allegati di coda che non servono, cosi' restano quelli di testa). Tante
  terziarie quanti allegati; le TER in ordine crescente vanno agli allegati in
  ordine di scelta. Agosto 2026 e' stato dichiarato con la regola di prima - i
  primi dell'ordine finche' bastano - che resta come `criterio: 'ordine'` per
  rifare una pratica gia' consegnata.
- **Le celle gialle** del peso degli allegati VII nel foglio Dettaglio (6 ad
  agosto 2026, fra cui il n. 30 che abbiamo dichiarato) non contano nei nostri
  ragionamenti (utente, 25/09/2026): non sono un marcatore di 'non nostro', non
  cambiano la scelta degli allegati e non vanno segnalate.
- **Ripartizione**: ciabattato a peso pieno dell'allegato, l'ultima terziaria il
  resto; ferro uguale per tutte alle decine, l'ultima il resto; mai oltre 38.000
  kg per dichiarazione, sul peso con cui la dichiarazione si chiude a portale.
- **Quanto** (22/09/2026, terza lettura aggiunta il 03/10/2026): **tre** letture
  del **totale da caricare a portale**, sempre mostrate insieme
  (`src/lib/praticaIrigom.js`). **Uscite**: V + X + Y del foglio Cons., tutto
  cio' che e' uscito nel mese, extra raccolta compresa. **Registro**: le uscite
  del mese **piu' il ferro che i mesi senza nave hanno lasciato indietro** e che a
  portale non e' ancora stato dichiarato (regola dell'utente del 03/10/2026,
  `ferroArretrato`, parametro `arretrato` di `componiMese`, prove in
  `prove/ferroArretratoIrigom.mjs`). **Giacenza**: dopo la dichiarazione del mese M a portale deve
  restare **AD + AE della riga di M nel foglio Cons.** (gomma in impianto:
  cippato, SACI e interi; piu' ferro in giacenza) meno l'extra ancora in
  impianto. Totale a portale = giacenza di rete a portale a fine mese (per fine
  trasporto) - quello che deve restare. Il CSS-C in giacenza (Z) non resta: e'
  end of waste. Il ferro e' la parte che si aggiusta: totale a portale - V - Y.
  Registro e giacenza sono due strade indipendenti per lo stesso numero, e **lo
  scarto che la pagina mostra e' giacenza contro REGISTRO**, non contro le uscite:
  il confronto con le sole uscite resta accanto (`scartoUscite`) ed e' un'altra
  cosa. Se le due strade non danno lo stesso totale c'e' qualcosa da capire prima
  di caricare.
- **L'extra raccolta partita con la nave sta dentro l'ultima terziaria**
  (utente, 22/09/2026): a portale quella terziaria si chiude col peso intero,
  rete + extra (agosto 2026: 19.880 + 460 = 20.340, totale a portale 534.600).
  Il rigo dell'extra resta, con la stessa terziaria, e dice che quella parte e'
  extra raccolta. Nel riepilogo Excel e nel file di gestione rete ed extra
  restano **separati** (IRIGOM 534.140, EXTRA RACCOLTA 460): l'utente chiude la
  terziaria a mano, e dal report del portale il gestionale vede solo il totale.
  La DichiarazioneSito RETE del mese vale il **totale a portale** (534.600): e'
  quello che il portale decurta e che `agganciaDichiarazioni` riconosce con 2 kg
  di tolleranza; nella nota c'e' `[extra compresa: N kg]`. L'extra ha la sua
  DichiarazioneSito sul mese del formulario.
- **L'extra raccolta va sulla riga della pratica, non sulla prima che capita**
  (11/10/2026, `rigaExtraDellaPratica` in `src/lib/praticaIrigom.js`, prove in
  `prove/praticaIrigomExtra.mjs`). Sull'extra due campagne nello stesso mese
  sono legittime. La pratica prendeva con un `find` la prima riga EXTRA di
  Irigom del mese, e con una campagna scritta a mano davanti ci scriveva sopra:
  luglio 700 kg invece di 600. Adesso riconosce la sua riga dal segno che mette
  in ogni nota (`SEGNO_PRATICA_EXTRA`, «Dichiarata con la pratica di»). Senza
  una riga sua: nel mese niente, la crea; una sola riga, la aggiorna, come
  prima; piu' righe, o due col segno, rifiuta e dice quali, come per la rete. La
  scelta si fa **prima** di scrivere la rete: una pratica registrata a meta' e'
  peggio di una che non parte.
- **Il portale puo' avere una dichiarazione che il gestionale non ha**
  (01/10/2026). L'aggancio parte dalle NOSTRE righe mensili e cerca il peso nel
  report del portale: se la nostra riga non c'e' - l'utente ha dichiarato a
  portale senza prima scriverla qui - non c'e' niente da agganciare, e quel
  caricamento finiva fra l'«arretrato dell'anno prima», che era falso, e la
  pagina non mostrava l'arretrato affatto. E' costato un «questo lo trovo molto
  strano» sul quantitativo di agosto di Green Tyre Project. Adesso
  `caricamentiPortale` tiene **di che mese sono gli ordini che il caricamento
  chiude** (fine trasporto), `confrontaConIlPortale` separa le **dichiarazioni da
  inserire** (ordini dell'anno verificato) dall'arretrato vero (anni
  precedenti), e `riepilogoDichiarazioni` le calcola a ogni apertura della
  pagina, dove stanno in testa in rosso. Il mese e' un'inferenza, quindi si
  **propone**: i valori li scrive l'utente.
- **Quanto resta da dichiarare di un mese sono gli INGRESSI del mese in quell'
  impianto** (regola dell'utente, 01/10/2026), meno **quello che di quei carichi
  e' uscito**: `da_dichiarare_kg` nei flussi di `riepilogoDichiarazioni`. Prima lo
  diceva solo la fotografia del portale (`non_dichiarato_kg`), che e' di un giorno
  preciso e puo' essere vecchia di settimane: un mese appena conferito usciva a
  zero e la riga dell'impianto **spariva** dal riepilogo. La fotografia resta un
  riscontro.
- **Una dichiarazione non appartiene al suo mese: svuota i mesi di prima**
  (regola dell'utente, 09/10/2026, `base44/shared/usciteDichiarate.ts`, prove in
  `prove/usciteDichiarate.mjs`). Il portale aggancia le quantita' agli **ordini
  piu' vecchi ancora aperti**, quindi la dichiarazione di marzo porta via gennaio,
  febbraio e parte di marzo. Il dichiarato **di quel mese** quindi non e' quello
  che di quel mese e' uscito, e sottraendolo li' le caselle contraddicevano la
  colonna del totale: su T-Cycle 532,68 t contro 352,94. Parole sue: «tenerlo in
  giallo potrebbe confondere... marcando in verde i quantitativi effettivamente
  usciti e lasciando in basso la parte restante in giacenza oltre agli ingressi
  del mese e colorare diversamente le celle in cui avviene il caricamento a
  portale».
  **Non si deduce, si legge**: il report delle dichiarazioni di trattamento ha una
  riga per ORDINE (`peso_associato_kg`, `data_dichiarazione`) e dice quanto di ogni
  mese di arrivo e' uscito e con quale caricamento. Due accortezze: solo le righe
  con partner operativo SMOCO, e il mese di un carico passato da uno stoccaggio e'
  quello in cui la **secondaria** e' arrivata all'impianto (senza, su Irigom tre
  mesi uscivano negativi e il totale diceva 652,28 t invece di 637,44). Il conto si
  chiude sulla **giacenza del canale**, che e' il numero certo: quello che il report
  non ha ancora - una dichiarazione caricata dopo l'ultimo export - si ripartisce
  dai mesi piu' vecchi e la casella lo segna come stimato (`~`). Dove invece il
  portale ha agganciato piu' delle nostre dichiarazioni non si aggiusta niente: si
  scrive (`uscito_oltre_kg`). **Il report e' solo della rete**: per ACI ed extra
  raccolta il portale non pubblica nessun aggancio, e li' il mese parte dal suo
  dichiarato; ma dall'11/10/2026 il conto si chiude sulla giacenza su tutti e
  tre i canali, con la casella «dall'anno prima» in testa alla riga (vedi
  «Giacenze e Dichiarazioni», punto 13).
  Nel riepilogo ogni riga ha tre linee - uscito (verde pieno se tutto, chiaro se in
  parte; **indaco** il mese in cui si e' caricato a portale), conferito nel mese,
  resta in giacenza - e la somma della terza, casella «dall'anno prima» compresa,
  E' la colonna «Da dichiarare»: 352,94
  su T-Cycle, 637,44 su Irigom, 321,70 su Green Tyre, 251,72 su Gatim, gli stessi
  numeri del portale mese per mese.
- **L'elenco degli ordini da dichiarare dice di quali mesi e'** (regola
  dell'utente, 09/10/2026, `per_mese` in `getOrdiniDaDichiarare`, prove in
  `prove/ordiniPerMese.mjs`). Il conto era giusto - su T-Cycle 114 ordini per
  352.940 kg, esattamente la giacenza - ma l'elenco parte dal carico piu' vecchio
  e mostra cento righe per pagina: la prima pagina finiva a settembre (318.460 kg)
  e sotto c'era il totale di tutte (352.940). «Non compaiono poi in elenco gli
  ingressi di ottobre e mi chiedo: come fai a trovarti con la giacenza attuale?».
  I mesi si contano su **tutto l'elenco filtrato**, non sulla pagina, stanno sopra
  la tabella e fanno da riscontro alla giacenza; il totale sotto le righe dice di
  essere dell'elenco, e dove la pagina non basta si scrive anche il suo.
- **Ogni mese** (procedura dell'utente, 22/09/2026). L'utente aggiorna il
  registro di Irigom e lo dice; **l'agente lo legge e riferisce**: quanti e quali
  formulari di ferro valgono (colore della cella e nota, con il motivo di ognuno),
  quanti e quali DDT di CSS-C, quali allegati VII della nave coprono il mese e
  **quante terziarie aprire a portale**. Per leggere il registro da fuori dal
  browser c'e' `C:\Users\HOME\Desktop\BASE44\strumenti\irigom\leggi_registro.mjs`
  (stesse regole del gestionale). Ricevuti i numeri TER e i PDF, si fanno Word ed
  Excel, si scrive il blocco del mese nel foglio DICHIARAZIONI del file di
  gestione e gli allegati scelti prendono il numero della terziaria nel nome e
  **scritto in alto a destra sulla prima pagina** (`src/lib/timbraPdf.js`); la
  cartella del mese scaricata li porta gia' cosi' in `EXPORT/TERZIARIE`. Il
  blocco del mese si scarica dal gestionale, pronto da incollare nel foglio
  DICHIARAZIONI (`src/lib/bloccoGestione.js`, pulsante e file nella cartella del
  mese): serve da qualunque computer, perche' il file di gestione sta solo su
  quello di casa. Quando quel computer e' acceso lo stesso blocco lo scrive, con
  Excel e coi formati dei mesi gia' presenti,
  `C:\Users\HOME\Desktop\BASE44\strumenti\irigom\scrivi_blocco_mese.ps1` dal file
  `Dati per il file di gestione.json` della cartella (`datiFileGestione` in
  `src/lib/documentiIrigom.js`); istruzioni in `LEGGIMI.md` accanto.
- I Word nascono dai modelli in `ModelloDocumento` (docx con segnaposto; le
  tabelle con `tabellaWord`, lo stile di agosto). Il registro e i PDF si leggono
  nel browser e non si conservano: resta la `PraticaIrigom` con i numeri.
- `unisciRun` (interna a `src/lib/docxModello.js`, la chiama `leggiModello`)
  fonde solo i run con lo stesso stile: fonderli tutti faceva perdere grassetti
  e caratteri ai documenti generati. Dove un paragrafo resta con un segnaposto
  spezzato, e solo li', `unisciRunTutti` li fonde tutti.

### La Quadratura FIR: il flusso non si indovina dal titolo (30/09/2026)

Segnalazione dell'utente sulla settimana 39: *"mi hai restituito l'ok per le
primarie ma non per le secondarie ne' rete ne' aci, inoltre mi parli di extra
raccolta che non esiste... tutto e' caricato correttamente nel gestionale e se
faccio i calcoli sul mio vecchio file excel tutto corrisponde"*. Aveva ragione su
tutta la linea: i numeri erano giusti in ogni passaggio.

**SONO QUATTRO FLUSSI, NON SEI.** Regola sua, testuale: *"le verifiche sono solo
di questo tipo che ti elenco, sempre in riferimento alla specifica settimana,
solo negli stati terminati: a) primarie rete b) primarie aci c) secondarie rete
d) secondarie aci"*. `FLUSSI` e `ORDINE_FLUSSI` in `quadraturaFir.ts` sono quei
quattro. L'extra raccolta non si quadra con WINSINFO: e' **solo rete, mai ACI**,
e c'e' solo se in quella settimana il modulo Extra Raccolta ha movimenti
terminati. Si legge come flusso `informativo` in `FLUSSI_DATI`, non entra in
nessun confronto a tre fonti, non tocca la conformita' e si dice in una riga
(`osservazioneExtraRaccolta`) **solo quando c'e' davvero**.

**LE INTESTAZIONI LE RICEVE, NON LE SCRIVE.** Parole sue: *"non le faccio io, a
me tocca riceverle e controllarle"*. Quindi il flusso **non si deduce dal testo**:
si propone e si fa confermare. Nella pagina ogni tabella letta ha due menu, fonte
e flusso, sempre visibili e gia' compilati (scelta sua), e un pulsante che rifa'
il confronto. `normalizzaLettura` accetta un `flusso` esplicito che vince su
tutto; sotto viene quello che l'agente ha **letto** (`canale` + `tipo`, due
domande semplici invece di un indovinello sul titolo), e solo per ultimo
`flussoDaTitolo`. Il flusso scelto si conserva in `righe_json`, cosi' rifare il
confronto non torna a indovinare.

**I due difetti che hanno rotto la settimana 39:**

1. **La secondarieta' si decide PRIMA del canale.** Il canale veniva letto per
   primo e `"WINSINFO ECT SEC-ACI"` - le secondarie ACI - finiva fra le
   **primarie ACI**, dove si scontrava con le primarie ACI vere.
2. **Il vocabolario cercava `SECOND`.** La stampa scrive `SEC`: `"WIN SEC"` e
   `"PORTALE ECT SEC"` non erano niente, e le secondarie di rete restavano fuori
   dal confronto. Ora `\bSEC\b` e `\bSEC[-\s]` valgono secondarie, e
   `fuoriPerimetro` esce per primo perche' "EXTRA RACCOLTA" contiene RACCOLTA e
   finirebbe fra le primarie di rete.

**NIENTE SPARISCE IN SILENZIO.** `confronta` prendeva le tabelle con un `find`:
due tabelle sullo stesso flusso e sulla stessa fonte e la seconda spariva senza
una riga. Ora si contano, si marcano `doppia`, il flusso **non si confronta** e lo
si dice: sommarle o tenerne una a caso darebbe un numero sbagliato senza dirlo.
Le tabelle **senza** flusso portano i loro numeri nelle osservazioni ("«WIN
SINFO»: 85 formulari per 263.780 kg letti e quadranti, ma non ancora
attribuiti"), invece di
sparire mentre il flusso corrispondente dichiarava "Manca nel file": erano due
affermazioni opposte sugli stessi formulari.

**TRE ESITI, TRE FRASI.** `lettura.verificata` era un flag solo e la pagina
scriveva sempre *"la somma delle righe lette non torna con i totali stampati"*,
anche quando le somme tornavano al chilo e il motivo era un titolo non
riconosciuto: si accusava una trascrizione esatta. Ora viaggiano separati
`totali_quadrano`, `fonti_riconosciute`, `flussi_riconosciuti`, e
`motivoLetturaNonConfermata` sceglie la frase giusta.

**UN FLUSSO CHE LA STAMPA NON COPRE NON E' "DA SISTEMARE".** Le sue celle
finivano fra gli `incongruenti` e il canale diceva "N righe da sistemare" per un
confronto che non era mai stato fatto. Ora il flusso porta `fuori_stampa` e le sue
righe si contano a parte.

**IL LETTORE EXCEL** sta in `src/lib/pivotQuadratura.js`, senza dipendenze dal
browser perche' le prove lo possano chiamare. Due cose che non fa piu': prendere
ogni pivot che trova (sul file vero dell'utente ne leggeva **undici** su sei
fogli - giacenze, terziarie, richieste da evadere - e una pivot di chili per
classe usciva come "12920 formulari"; ora una pivot della quadratura deve avere
due misure, un **conteggio** e un **peso**), e rubare il titolo alla pivot del
vicino (le pivot settimanali non hanno titolo, hanno "Nr. Settimana | 39": il
lettore pescava `RACCOLTA` da un'altra colonna e lo stesso titolo finiva sulle
primarie **e** sulle secondarie, che poi si scontravano). Sul file vero: da 11
tabelle a 2, quelle giuste.

**LA SETTIMANA LA SCEGLIE L'UTENTE.** *"Anche se il numero della settimana non
c'e' nel foglio poco importa, saro' io a caricartelo nella settimana giusta"*:
se sul file non c'e', non si dice niente. Resta il controllo che conta, cioe' il
file che dichiara una settimana **diversa** da quella aperta.

Prove in `prove/quadraturaFirFlussi.mjs`.

#### La parola "gestionale" sulla stampa non siamo noi

Precisato dall'utente il 30/09/2026: quando una pivot della stampa e' intitolata
**"GESTIONALE ECT ACI"**, quel "gestionale" e' il **file Excel** di chi manda il
foglio (`Gestione Ecotyre 2026`), lo strumento su cui loro confrontano il portale
con quello che estraggono da WINSINFO. Non e' questo gestionale.

Quindi `"GESTIONALE ECT ACI"` e `"PORTALE ECT SEC"` sono **la stessa fonte**: il
portale Ecotyre. Le fonti restano tre - WINSINFO, il portale, noi - e la terza
non compare mai fra le intestazioni della stampa, perche' la calcoliamo qui.

Scrivendo testi che l'utente legge, non chiamare mai "il gestionale" una fonte
esterna: si dice "il portale", "WINSINFO", oppure "il file Excel di chi manda la
stampa".

### La ricerca per punto di raccolta nei Terminati Rete (12/10/2026)

Richiesta dell'utente, testuale: *«nei terminati rete serve un campo ricerca per
pdr»*. Il campo sta accanto a quello per ID ordine
(`src/components/shared/CercaPdr.jsx`; `CercaIdOrdine` resta com'e' per le altre
pagine).
- Un numero da solo («315», «PDR 315») e' il codice del punto (`id_pdr`, la
  chiave che lega ordini e anagrafica PDR) e vale uguale, non contenuto: «31»
  dentro 315, 1310 e 23100 darebbe tre punti diversi.
- Altrimenti si cerca il nome come lo scrive il portale, `punto_di_raccolta` o
  `ragione_sociale`: tutte le parole, in qualunque ordine, e maiuscole, spazi,
  accenti e punteggiatura non contano.
- La ricerca resta dentro gli altri filtri, come in Assegnati Rete, e il
  conteggio dice anche quanti ordini ha il punto in tutto l'archivio, perche' un
  filtro dimenticato non faccia credere che non ce ne siano. La ricerca per ID
  invece guarda sempre tutto l'archivio.
- Cercando si apre il Dettaglio Ordini. Sotto il campo compaiono i punti
  trovati, con codice e numero di ordini; con piu' punti si sceglie quello
  giusto con un clic.

**La colonna PDR nel Dettaglio Ordini** (13/10/2026). Accanto alla ragione
sociale c'e' la colonna «PDR»: il codice `id_pdr` e, dopo un punto mediano, il
nome del punto di raccolta come lo scrive il portale (`punto_di_raccolta`). La
ragione sociale da sola non distingue due punti della stessa ditta (MASTRIA
GOMME SRL, viale Pio X e viale Europa; 71 ditte con piu' punti nell'archivio
dell'11/10/2026). Il codice viene prima, senza il punto delle migliaia perche'
e' un codice, e non si taglia nemmeno a 375 px; il nome si tronca come la
ragione sociale (`truncate max-w-[200px]`), e il title dice codice e nome
interi. Senza codice la cella dice «—». Si ordina per codice, come numero.

Prova: `prove/terminatiReteUnaLettura.mjs`.

### La dashboard: il quadro della commessa e l'elenco unico delle cose da gestire (11/10/2026)

La pagina (`src/pages/Dashboard.jsx`, componenti in `src/components/dashboard/`) e' il **quadro della commessa Ecotyre dell'anno scelto**, per SMOCO partner operativo. L'anno e' uno solo e sta nell'indirizzo (`/?anno=2025`); niente filtro dei mesi: «2025, 2026» sommava due contratti. Le sezioni sono tre canali mai sommati (Rete col contratto, ACI, Extra raccolta), poi Impianti, Fatturazione attiva, Economia (solo amministratore), Chiusura del mese e «A quando sono aggiornati i dati». **«Da gestire» e' l'unico elenco dei problemi.** Una sezione non ripete il testo di una voce: mostra solo il segno «2 da gestire», che porta al pannello filtrato. Righe gialle sotto le card, riepiloghi delle date, pannello dei target e badge in alto sono tolti: dicevano le stesse cose da tre calcoli fatti in momenti diversi.

- **Le richieste all'apertura**: `cruscottoOperativo` e `getDashboardRaccolta({ anno: [anno] })`, che porta il campo `quadro` (`base44/shared/quadroCommessa.ts`, solo server). Per l'amministratore, e solo dopo che le prime due hanno risposto, c'e' anche `calcolaMargine({ anno })`, che ora segue l'anno scelto. `getDashboardStats` e' tolta, e il pannello non chiama piu' `checkTargetAlerts`: la voce «Target raccoglitori» viene dagli Alert gia' letti, una per mese. La chiusura del mese si scarica (`lazy`) e si legge solo quando si apre; parte sempre chiusa perche' `statoChiusuraMese` legge piu' di dieci pagine. Chi aggiunge una lettura all'apertura guarda il bilancio di `prove/dashboardRaccoltaQuadro.mjs` (PrimariaRete intera una volta, non tre).
- **I numeri** vengono fatti dalle funzioni, la pagina li mostra soltanto. Target, raccolto, percentuale e atteso del quadro sono quelli di `kpi`; i campi di prima di `getDashboardRaccolta` restano identici al carattere, perche' li leggono le prove e `controllaInvarianti`. Gli impianti vengono dalla fotografia della notte (`quadroImpianti` in `cruscotto.ts`): il «Da dichiarare» e' la colonna delle Dichiarazioni sommata, canale per canale, senza la rete non dovuta e senza le giacenze sotto zero. Le giacenze dei piazzali restano in Giacenze, perche' nella fotografia i piazzali di un impianto non sono separati. Un valore che manca e' «—» col perche', mai 0.
- **Il perche' dei numeri si apre al tocco** (`src/components/shared/Perche.jsx`, un Popover), mai `title=`, che su iPhone e iPad non si vede.
- **Le parole e i numeri della rete** (cifre, mesi, regioni) stanno in `righeQuadro.js`, e li usano pagina e PDF. «Esporta il quadro (PDF)» (`esportaQuadro.js`) usa i dati a video. L'economia esce solo con «con l'economia» spuntata dall'amministratore, mai per gli altri, anche se la casella arrivasse accesa. «Da gestire» non va nel PDF.

- **La quadratura con il portale e' una sola** (revisione delle migliorie, 11/10/2026). La dashboard (`quadroImpianti` in `cruscotto.ts`) conta le stesse righe di Dichiarazioni Impianti (`riepilogoDichiarazioni`, `totali.siti_che_quadrano` / `siti_da_quadrare`): gli impianti e gli stoccaggi puri della rete che hanno una giacenza a portale, letti dalla fotografia della notte. Una riga di stoccaggio ha il canale in fondo alla chiave (`nappi sud|RETE`); l'ACI degli stoccaggi si conta a parte (`aci_stoccaggi`), mai con la rete. Anche l'etichetta e' quella della pagina: «Rete: quadratura con il portale». Contando i soli impianti, l'11/10/2026 la dashboard diceva «5 su 5» e la pagina «6 su 6». Dal 12/10/2026 anche il guardiano (`indicatoriGiorno.ts`) conta le stesse righe, e la sua nota e la voce dicono chi si scosta, impianto o stoccaggio (vedi «Il guardiano notturno», prudenza 3).
- **Un anno chiuso si misura al 31/12, dal 1° gennaio** (prova generale del cambio d'anno, 15/10/2026, difetto 1). La regola e' una, `giornoDellaMisura(anno, giornoDati, oggi)` di `attesoContratto.ts` (specchio in `src/lib`): un anno prima di quello italiano di oggi si misura al 31/12 qualunque sia l'ultimo ritiro caricato (atteso uguale al contratto, `fine_anno: true`, proiezione finale uguale al raccolto, mesi interi); l'anno in corso senza ancora un ritiro suo non ha giorno («—», atteso `null`, mai 0,00: «nessun ritiro del 2027 ancora terminato»); altrimenti il giorno dei dati. Senza `oggi` resta la regola di prima. La usano `quadroRete`, `quadroAci`, `quadroExtra`, `contrattoReteDegliAnni`, `contrattoDellaRete` (quindi EcoTyna), Target & Status (`giornoMisura` per la tabella per regione e la card dello scarto) e KpiCards; il contesto generale di EcoTyna (`assistente.ts`) dice «nessun ritiro RETE del 2027 e' ancora terminato (l'ultimo e' del 22/12/2026): l'atteso del 2027 non c'e' ancora, non e' zero». `quotaDeiPesi` da' 1 al 31/12 e `null` per un giorno dei dati dell'anno prima. Le etichette leggono `quadro.giorno_misura`, non `giorno_dati`. Prima il 05/01/2027, con l'ultimo ritiro al 22/12, il 2026 diceva «Atteso al 22/12: 11.274,709 t» e una proiezione, e il 15/01 numeri diversi: due misure dello stesso anno. Il perche' della tabella delle regioni dice la cosa vera (`percheSenzaScarto`): senza contratto, con un target di ripiego (il 2025: «ha un target di ripiego ... e senza contratto non c'è un riparto per regione»), senza riparto per regione, senza ritiri. Prove: `prove/quadroCommessa.mjs` (sezione 8), `prove/ecotynaContratto.mjs` (4), `prove/targetAttesoAllaData.mjs` (6), `prove/cambioAnnoRitocchi.mjs` (2).
- **L'attiva di un anno passato** (`mesiAttivaAnnoPassato`) si guarda dal primo mese che ha un documento. Un anno senza documenti, come il 2025 fatturato prima del gestionale, non ha mesi: c'e' la nota `mesi_attiva_nota`, a video e nel PDF. Mai dodici «da elaborare».
- **Mesi dell'attiva di due anni, tutti con l'anno** (`statoMesiAttiva` in `base44/shared/cruscotto.ts`, difetto 37 della prova del cambio d'anno, 15/10/2026). Prima usciva «Ottobre 2026, Novembre 2026, Dicembre 2026, Gennaio»; adesso ogni mese porta il suo anno, anche in «Prefattura Ecotyre non caricata». Con i mesi di un anno solo, quello guardato resta senza anno. Prova: `prove/cruscotto.mjs`.
- **Province ferme** (`provinceFerme`, `quadroCommessa.ts`): le province che lavorano, cioe' con un ritiro nell'anno o in quello prima, tutto l'anno, e che non hanno ritiri dal primo dei due mesi finiti in poi (fine trasporto, giorno italiano). Non sono `province_with_zeros` di Terminati Rete, che risponde a un'altra domanda (due mesi a zero in qualunque momento dell'anno); e Terminati Rete (`fermeDallAnnoPrima` in `primarieReteAnalytics.ts`) guarda l'anno prima solo a gennaio e febbraio: da allineare. `provinceFerme` riceve anche le province del contratto dell'anno (`provinceDelContratto`, le passa `quadroRete`): una provincia del contratto senza ritiri ne' nell'anno ne' in quello prima entra fra le ferme con `mai_servita` e `ultimo` vuoto, da marzo come nella matrice, e il riquadro dice «del contratto, mai servita nel <anno>» (13/10/2026).
- **«Controlli automatici»** riassume le voci con origine `presidi` e la voce del guardiano fermo (area Manutenzione), dovunque stiano (`riassuntoControlli`). Il suo segno porta al filtro `FILTRO_CONTROLLI`, non alla sezione «dati». «Tutti regolari» si scrive solo a cruscotto letto e con la notte che ha scritto. **Chi aggiunge un controllo automatico che diventa una voce** le da' origine `presidi` o area Manutenzione, altrimenti la riga dice «tutti regolari» accanto alla voce.
- **Lo stoccaggio ACI che non quadra** (13/10/2026) e' una voce sua di «Da gestire»: «giacenze:scostamenti-aci» (Giacenze, attenzione, sezione impianti, /giacenze), col dettaglio sulla classe 9 e il giorno del controllo, mai insieme alla rete. Si legge dalla fotografia (`fg.siti`, `scostamentiAci`), quindi vale anche per una fotografia scritta prima. La voce della rete dice solo la rete: il suo dettaglio e' `notaDelGiorno` sulle righe della rete, non la nota intera.
- **Il surplus finito l'anno prima** (13/10/2026): dal 1° gennaio `vociSurplusFiniti` ricorda un surplus con l'importo da Ecotyre finito l'anno prima e non riscritto nell'anno in corso con lo stesso nome (senza accenti ne' maiuscole, come `conflittiSurplus`; un disattivato non conta come riscritto). Titolo «Fuel Surcharge del 2026: finito il 31/12/2026», area «Surplus sulle tariffe», canali e date senza importi, collegamento `/fatturazione?tab=tariffe&sezione=surplus`, chiave `surplus-finito:<nome>|<anno>`. Il dettaglio dice che, se il consorzio lo rinnova, va riscritto con le date nuove, perche' non si copia da solo nell'anno nuovo. Un accordo pagato solo da SMOCO non si dice: e' un costo riservato (`campoRiservato`). `cruscottoOperativo` legge `SurplusTariffa` (una lettura, l'archivio e' piccolo) e passa `dati.surplus` coi soli nome, origine, canale, date, stato e `euro_t_attiva`, mai `euro_t_passiva` (chiusura del giro, 14/10/2026: prima non lo leggeva, e la voce non sarebbe uscita mai). Riscritto il surplus, la voce sparisce da sola.
- **I raccoglitori che non fanno il contratto** (chiusura del giro, 14/10/2026, sulla richiesta dell'utente dello stesso giorno: le 100 t di ottobre in Puglia scritte solo nel target di SMOCO, e la dashboard ferma a 11.550 t). `vociContrattoRaccoglitori` in `cruscotto.ts` fa la stessa regola dell'avviso della scheda Target raccoglitori (`scartiDalContratto`) sugli stessi numeri: la somma dei target annui dei raccoglitori dell'anno, regione per regione com'e' scritta, contro il riparto del contratto. Sotto mezza tonnellata e' un arrotondamento (sui dati veri dell'11/10 Campania 4.400,38 e Calabria 1.649,62 non fanno voci). Una voce sola, area «Target raccoglitori», sezione rete: «I raccoglitori della Puglia hanno 100,00 t più del contratto 2026», o «In 2 regioni ...», col dettaglio regione per regione e che cosa fare (registrare la variazione nel contratto, o correggere i target), collegamento `/target-status?tab=raccoglitori&anno=`, chiave `contratto-raccoglitori:<anno>`. Senza riparto per regione, o senza nessun target dei raccoglitori nell'anno (lo dice la voce dell'anno nuovo), niente. Un target senza regione non si conta, e la voce lo dice. Nessuna lettura in piu': `cruscottoOperativo` legge gia' contratti e target annui per l'anno nuovo. Prova: `prove/cruscotto.mjs` (anche la funzione vera sul banco, da utente non amministratore).
- **Due voci del solo amministratore** (14-15/10/2026): gli errori del sito (`vociErroriSito`, vedi «Il registro degli errori del sito») e il promemoria della copia di sicurezza (`vociPromemoriaCopia`, vedi «La copia di sicurezza di tutti gli archivi»). `cruscottoOperativo` gira col ruolo di servizio e risponde a tutti: i due registri li legge solo se chi chiede e' l'amministratore (`eAmministratore(user)`), con una lettura ciascuno - gli errori non visti, al piu' `LIMITE_ERRORI_CRUSCOTTO`, e l'ultima riga di `CopiaSicurezza` - e passa a `cruscotto` solo i campi che le voci usano, piu' `amministratore`. A chi non lo e' non si legge niente e non arriva niente. Una lettura che cade toglie solo la sua voce: un registro non letto non e' «nessun errore» ne' «copia mai fatta». Tutte e due in sezione dati e senza «Chiedi a EcoTyna» (`AREE_SENZA_ECOTYNA`). Prova: `prove/cruscotto.mjs`, anche la funzione vera sul banco da amministratore e da utente.

Prove: `prove/dashboardPagina.mjs` (richieste, numeri disegnati, voci, PDF, sorgente), `prove/quadroCommessa.mjs`, `prove/dashboardRaccoltaQuadro.mjs`, `prove/cruscottoQuadro.mjs`, `prove/dashboardDatiVeri.mjs` (sulla copia dei dati veri: Irigom compreso e la pagina disegnata).

**L'elenco «Da gestire»**: `base44/shared/cruscotto.ts`, funzione `cruscottoOperativo`, pannello
`src/components/dashboard/DaGestire.jsx`. Un solo elenco, ordinato per gravita',
di cio' che richiede attenzione, ogni voce col collegamento a dove si risolve.
Legge **solo archivi piccoli** (alert, registro dei caricamenti, ordini aperti,
documenti di fatturazione, prefatture, riepilogo della qualifica,
richieste del consorzio, controlli delle sedi operative dei PDR
`VerificaSedePdr`), e dei grandi solo le poche righe che dicono fin dove arrivano
i dati: chi aggiunge un controllo non deve farle rileggere le
primarie. Le anomalie di prezzo delle fatturazioni arrivano dal margine, che la
pagina chiede dopo e solo per l'amministratore. Un controllo nuovo si aggiunge
li', con un caso in `prove/cruscotto.mjs`.

**A quando sono aggiornati i dati: due date** (11/10/2026). Accanto al giorno
del caricamento c'e' «dati fino al», l'ultimo giorno che c'e' dentro il file:
fine trasporto dei terminati, giorno della fotografia del portale, ultima
dichiarazione SMOCO (`nostraRiga`). Lo legge
`datiFinoAl(svc, ARCHIVI_DEL_CRUSCOTTO)` in `base44/shared/statoArchivi.ts`, con
poche righe ordinate per archivio e mai l'archivio intero; l'elenco e la lettura
sono quelli di EcoTyna. La voce gialla dei dati vecchi ha due misure. Sul giorno
del caricamento: oltre `GIORNI_DATI_VECCHI` (10) giorni, per ogni file. Sul
«fino al», solo per primarie e non dichiarati (`FINO_AL_FITTO`) e solo quando i
dati si fermano **piu' di tre settimane prima del caricamento**
(`GIORNI_SCARTO_FINO_AL` = 21): anche le primarie hanno i loro buchi, 17 giorni
fra il 22/12/2025 e l'08/01/2026 e 11 a Ferragosto 2026 nel file vero, e
misurando il «fino al» su oggi un file caricato il 05/01 la mattina stessa
risultava «fermo al 22/12». Per terziarie, secondarie e dichiarazioni settimane
senza righe sono normali (63 giorni senza terziarie a inizio 2026, 29 senza
dichiarazioni SMOCO a maggio): li' il «fino al» si mostra soltanto.

**I mesi dell'attiva dell'anno prima non ancora chiusi restano in griglia e fra
le voci finche' non si chiudono, in qualunque mese** (`anniMesiAttiva`,
`statoMesiAttiva`, 11/10/2026). Prima il 15 gennaio l'elenco era vuoto e
dicembre spariva proprio quando va chiuso; la prima correzione valeva solo per
gennaio e febbraio, e il 1° marzo un dicembre mai elaborato spariva di nuovo. Si
parte dal primo mese dell'anno prima che ha un documento: un anno mai fatturato
nel gestionale non si guarda. `cruscottoOperativo` legge sempre i documenti
dell'anno prima, ma le sue prefatture (portano le righe del portale) solo se un
suo documento e' ancora aperto (`servonoPrefattureAnnoPrima`). Prove:
`prove/cruscotto.mjs`, `prove/statoArchivi.mjs`.

#### Gli avvisi a scomparsa (11/10/2026)

Ogni voce si nasconde «per oggi» o «per 7 giorni»; le critiche solo per oggi, e restano nel conteggio del pannello («1 nascosto (1 critico fino a stasera)»): una critica non sparisce mai in silenzio. La voce torna da sola quando scade, quando diventa piu' grave, quando cambia la sua `firma` o quando una sua misura sale. Una voce che elenca dei nomi (oggi «Target raccoglitori»: raccoglitore e regione) li scrive in `elementi`: torna anche quando entra un nome nuovo a conto uguale (BETA al posto di ALFA), non quando un nome esce. La voce dei target dice la soglia vera dell'alert aperto: checkTargetAlerts lo apre sotto il 70% e lo tiene aperto fino al 90%, quindi «a rischio» vuol dire sotto il 90% del target. **Se il numero scende resta nascosta**: «un avviso non grida al lupo», applicato al ritorno. Le regole stanno in `src/lib/avvisiNascosti.js` (pura, `prove/avvisiNascosti.mjs`). Ogni voce di `cruscotto.ts` ha `chiave` e `sezione`. Una voce il cui numero cresce da solo coi giorni («dati di 12 giorni fa», «non gira da 3 giorni», l'arretrato) scrive anche `firma` e `misure`, altrimenti tornerebbe ogni mattina: **chi aggiunge una voce di questo tipo deve scriverle**. La memoria sta nel `localStorage` per utente, sempre dentro `try`, e non in un archivio, per tre ragioni: solo l'amministratore scrive negli archivi; il limite di richieste; perderla non fa danni. La decisione su un alert («ignora») resta nella pagina Alert.

#### Dove si corregge un alert (11/10/2026)

In Alert & Controllo ogni riga dice «Si corregge in …» col collegamento (`src/lib/doveSiRisolve.js`) e il modulo col suo nome, non col codice. Un modulo che non si conosce non ha collegamento: nessuna pagina inventata.

### Il riepilogo della settimana per la direzione (14-15/10/2026)

Una delle cose da creare proposte all'utente il 14/10/2026 e approvate lo stesso giorno («per me ok sulle cose da sistemare, sulla velocità e su quanto da creare, procedi pure»): «un riepilogo settimanale per la direzione, il lunedì, in PDF o per email: target e scarti per regione, alert critici, dichiarazioni da fare, fatture del mese». Il pulsante «Riepilogo della settimana (PDF)» sta nella dashboard, per tutti (`src/components/dashboard/RiepilogoSettimanale.jsx`). Gli argomenti del PDF li fa `src/lib/riepilogoSettimanale.js`, e il PDF esce dal corredo comune (`esportaSezioniPdf`, vedi «I documenti che escono»), con jspdf scaricato solo al clic.

- **I numeri sono quelli che la dashboard ha gia' letto**: il quadro dell'anno (`getDashboardRaccolta`), il cruscotto (`cruscottoOperativo`) e, per l'amministratore, il margine (`calcolaMargine`), con le parole e le cifre della pagina (`righeQuadro.js`, `formato.js`): il PDF e la dashboard dicono lo stesso numero con la stessa scrittura. L'unica lettura in piu' e' il raccolto della settimana, la funzione `riepilogoSettimana` (il conto in `base44/shared/riepilogoSettimana.ts`, solo server, nessuno specchio), e parte solo al clic: la pagina la passa al pulsante in `leggiSettimana` e non la chiama mai in un effetto. Sono tre letture filtrate sulla fine trasporto della settimana, un giorno in piu' davanti perche' la mezzanotte italiana del lunedi' e' ancora domenica in UTC, una pagina per archivio: sulla copia dei dati veri dell'11/10/2026 la settimana dal 28/09 al 04/10 sono 83 righe di rete, una di ACI e nessuna di extra raccolta. Risponde tonnellate e ritiri, nessun euro: la chiama chiunque guardi la dashboard.
- **La settimana** e' da lunedi' a domenica sul giorno italiano di `trasporto_finito_il`, mai la chiusura a portale: quella appena finita o quella in corso, scelta a video, coi giorni scritti; numero e anno sono quelli della settimana ISO. Un giorno che i dati non coprono ancora e' «—», non zero. La funzione rifiuta un giorno che non e' un lunedi' e una settimana non ancora cominciata. Se la settimana non ha giorni dell'anno scelto in testa alla pagina, il pulsante dice quale anno scegliere.
- **Le sezioni**: la rete della settimana (giorno per giorno e chi ha raccolto), il contratto Ecotyre dell'anno (target con le variazioni, atteso, scarto), i mesi, le regioni con target, scarto e settimana, i raccoglitori piu' indietro e piu' avanti; ACI ed extra raccolta a parte, ognuno con le sue tabelle, e nessuna riga, colonna o riquadro li somma; gli impianti dalla fotografia della notte (quadratura col portale, da dichiarare per canale, chi non quadra, i caricamenti entrati dopo la notte); «Da gestire» intero, comprese le voci nascoste a video, e gli ID degli ordini rimasti «eseguito»; la fatturazione attiva dell'anno, mese per mese e canale per canale. Una parte che non si e' potuta leggere lo dice nella sua sezione, col perche': mai uno zero al posto di un numero che non c'e'.
- **Costi e margine solo all'amministratore**: a chi non lo e' la sezione dell'economia non c'e', e le voci del margine e della passiva (`margine:`, `passiva:`) non entrano anche se arrivassero. Il nome del file della sua copia finisce con «con economia (riservato)». Nella sua copia entrano anche le voci di «Da gestire» che sono solo sue: gli errori del sito e il promemoria della copia di sicurezza.
- **Niente email**: il PDF si scarica e lo manda chi lo ha fatto. La nota sotto il pulsante lo dice («Da girare alla direzione: il PDF si scarica e lo mandi tu, il gestionale non manda email.»), e all'amministratore aggiunge «La tua copia, da amministratore, ha anche costi e margine.».

Prove: `prove/riepilogoSettimanale.mjs` (la settimana, anche a cavallo del mese e dell'anno; il conto; la funzione sul banco; il PDF col jspdf vero su dati costruiti e sui dati veri dell'11/10/2026; la pagina; i caratteri e le celle; il meno negli altri PDF del corredo), `prove/dashboardPagina.mjs` (la lettura solo al clic, la nota per ruolo sul pulsante disegnato pronto), `prove/pacchettiLeggeri.mjs`.

### La chiusura del mese passo passo (11/10/2026)

`base44/shared/chiusuraMese.ts` (le regole, pure), la funzione `statoChiusuraMese` e il pannello `src/components/dashboard/ChiusuraMese.jsx` (props `{ isAdmin, anno }`, montato dalla dashboard per l'anno scelto). Una riga - «Settembre 2026: 4 di 8 fatti, mancano ...» - che si apre in dieci passi: dati del mese, terminati, dichiarazioni, attiva rete/ACI/extra, passiva rete/ACI/extra, quadrature FIR. Ogni passo ha lo stato (`fatto`, `da_fare`, `non_serve`), il perche', le voci e il collegamento al modulo col periodo (`?tab=&anno=&mese=&canale=`). Sotto, i mesi prima ancora aperti, che si aprono uno per volta chiedendo `{ anno, mese }`.

- **Il mese** e' l'ultimo finito sul giorno italiano (`meseDaChiudere`): a gennaio e' il dicembre dell'anno prima, e un dicembre mai chiuso resta fra i mesi aperti anche a marzo (`mesiAncoraAperti`, dal primo mese con un documento dell'attiva, nell'anno e in quello prima). Aperto vuol dire attiva di un canale non chiusa, o passiva non congelata dal primo mese da chiedere in poi (vedi il punto dopo).
- **Il primo mese chiuso nel gestionale e' settembre 2026** (`PRIMO_MESE_DEL_GESTIONALE` in `chiusuraMese.ts`, revisione del 12/10/2026). Gennaio-agosto 2026 sono stati fatturati fuori e si chiudono come gia' fatti (decisione dell'utente dell'11/10/2026: un'azione sui documenti, non una regola qui, vedi il punto dopo). I passi che prima non si facevano qui - attiva elaborata, passiva congelata, consuntivi - si chiedono dal primo fatto scritto o da settembre 2026, quale viene prima (`primoDaChiedere`); le quadrature FIR hanno il loro confine fisso, la settimana 37 del 2026 (vedi il punto «Quadrature FIR»); mai da «il mese che si chiude adesso», che scivolava col calendario (dal 01/11/2026 settembre, mai congelato, diventava «non serve»). Un mese di prima lo dice col perche' vero: «Il gestionale chiude i mesi da settembre 2026: agosto 2026 si è chiuso fuori». La costante e' scritta una volta.
- **I mesi fatturati prima del gestionale si segnano chiusi** (giro K8, 12/10/2026; decisione dell'utente dell'11/10/2026: «si chiudili nel gestionale come se fossero gia' stati fatti»). Non c'e' una regola speciale: la funzione `segnaMesiChiusiFuori` (solo l'amministratore) porta i documenti ATTIVA non superati dei mesi scelti, canale per canale, allo stato «chiusa» che tutti leggono gia' (Fatturazione attiva, dashboard `statoMesiAttiva`, «Da gestire», chiusura del mese, EcoTyna). Scrive `data_chiusura`, `fattura_confermata_da` e la riga in coda alle note `NOTA_CHIUSO_FUORI` («Chiuso fuori dal gestionale: fatturato prima dell'avvio, decisione dell'utente dell'11/10/2026. Segnato chiuso il gg/mm/aaaa da ...: era «elaborata».»), piu' una riga per documento in `ModificaDato` (campo `stato`, origine `ORIGINE_CHIUSO_FUORI`). **Mai `fattura_confermata_il` ne' `fattura_numero`**: non si sanno e non si inventano. Senza `conferma: true` risponde il piano di `pianoMesiChiusiFuori` (mese per mese e canale per canale: `chiude`, `gia_chiusa`, `senza_documento`, `da_rielaborare`; prima e dopo con la regola dei mesi aperti, `mancanzeDelMese`). Con la conferma, un mese da settembre 2026 in poi, non finito o non riconosciuto fa rifiutare tutta la richiesta. **Un canale senza documento non si chiude** (un documento creato apposta direbbe zero euro fatturati), e nemmeno **l'extra raccolta a zero righe con movimenti finiti nel mese**: chiusa, non si rielaborerebbe piu'. Si torna indietro col Riapri di sempre. `passiAttiva` riconosce un documento chiuso fuori (`chiusoFuoriDalGestionale`: chiuso, con la nota, senza `fattura_confermata_il`) e dice «Fatturata fuori dal gestionale, prima dell'avvio», non «Approvata» ne' «fattura confermata». Nel pannello, sotto «Mesi prima ancora aperti», l'amministratore ha «Segna come gia' chiusi» per i mesi con `prima_del_gestionale`; `statoChiusuraMese` manda `primo_mese_del_gestionale` come etichetta. Sulla copia dell'11/10/2026: 24 documenti in 8 mesi, tutti allineati ai dati di oggi al centesimo e alla riga. Lo strumento `storico_modifiche` di EcoTyna li trova (vedi «Lo storico delle modifiche»).
- **Un anno passato** (revisione del 12/10/2026): la fotografia del guardiano e' dell'anno in corso, e il suo resto non dice niente di un mese di un anno prima (dicembre 2025 riceveva i 337,96 t di Green Tyre del 2026). Li' le dichiarazioni «non servono», col perche'. A gennaio, quando si chiude dicembre, la fotografia e' gia' dell'anno nuovo: si guarda solo che cosa e' caricato, mai i mesi della fotografia.
- **Si legge lo stato che i moduli scrivono, mai un conto rifatto**: i documenti dell'attiva di tutti gli anni (il primo dice da quando il gestionale fattura) e il registro delle esportazioni, la prefattura del mese (senza righe), i congelamenti (senza totale), i consuntivi (senza importo), le quadrature, le dichiarazioni dell'anno, la pratica di Irigom, l'ultima fotografia del guardiano, gli alert aperti, il registro dei caricamenti, l'extra raccolta intera (sette righe l'11/10/2026: solo stato, fine trasporto, tipo e peso, mai prezzi e sovracosti); delle primarie solo le righe «eseguito» e le poche del «dati fino al». Diciassette letture, nessuna scrittura. Una lettura che cade lascia il passo «non verificato» (`lettura_non_riuscita`): mai un verde falso, e mai un rosso falso. Congelamenti non letti arrivano a `mesiAncoraAperti` come `null`, non come elenco vuoto: allora la passiva non si giudica, invece di dire «manca il congelamento» di mesi magari congelati (12/10/2026).
- **Nessun importo esce**: il pannello lo vede anche chi non e' amministratore. Chi aggiunge un passo che tocca la passiva passa alle regole stati e date, non i record interi.
- **Dati completi**: il «fino al» delle primarie oltre l'ultimo giorno del mese, e primarie e secondarie caricate dal termine di registrazione dei formulari partiti quel giorno (dieci giorni, domeniche escluse: per il 30/09/2026 il 12/10). Prima il passo dice «da fare dal».
- **Terminati**: gli alert delle date valgono per tutti i mesi e si dicono tutti (i senza fine trasporto possono essere del mese); gli «eseguito» contano se la fine trasporto e' nel mese, sul giorno italiano.
- **Dichiarazioni: non si chiede «settembre e' dichiarato?».** Il resto viene dalla fotografia del guardiano. Se la fotografia porta i mesi aperti per canale (`mesi_aperti`, con la provenienza sull'ACI) si dicono quelli. Altrimenti si dice solo cio' che si sa: l'ultima dichiarazione caricata, i mesi fino a quello che si chiude con la dichiarazione scritta e non caricata (anche prima dell'ultima caricata: giugno scritto e settembre caricato lasciano giugno da caricare), quanto resta. **Non si elencano come mancanti i mesi senza una riga**: GATIM rete ha luglio e agosto a zero perche' non e' arrivato niente. **Lo stato di un mese e' per provenienza**, mai il migliore fra primaria e secondaria: la primaria caricata non copre la secondaria che manca. **Solo la rete si aggancia**: su ACI ed extra raccolta il portale non aggancia niente, un resto e' sempre qualcosa senza dichiarazione e il passo resta da fare; senza `mesi_aperti` nella fotografia resta da fare anche quando il resto e' fatto solo di arrivi del mese dopo (la scelta prudente). Dal 12/10/2026 il guardiano scrive i mesi per canale e per provenienza (prudenza 8 del guardiano notturno): la regola prudente resta per le fotografie di prima e per un canale senza i dodici mesi, dove il campo manca. La casella «dall'anno prima» e' giacenza sulla rete, da dichiarare sull'ACI. Irigom rete: la pratica del mese, registrata e caricata, oppure registrata di soli metalli («a portale non si carica nulla»: mai «caricata»). Stoccaggi e rete non dovuta non si chiedono.
- **Attiva per canale**: elaborata, prefattura (rete e ACI; l'esito del confronto non resta scritto e si guarda in Fatturazione), approvata, esportata dopo l'approvazione, chiusa con la fattura confermata. **Esportata dopo l'approvazione vale anche per un'esportazione legata al documento**: l'interfaccia manda sempre `documento_ids: [doc.id]`, e `registraEsportazione` registra anche quelle di un documento «elaborata» (il 05/10/2026 alle 09:25 rete e ACI di settembre); conta solo con la data dopo `data_approvazione`. `numero_voci` 0 = non serve, ma per l'extra raccolta solo se nel mese non c'e' un intervento finito (`movimentiExtraNelMese`, contati come `calcolaRigheAttiva`): con un intervento pesato il documento e' di prima e manca la rielaborazione; con interventi solo senza peso manca il peso. Un numero che manca non e' zero.
- **Passiva per canale**: congelata, coi consuntivi caricati e quadrati; chi li aveva mandati il mese prima e ora manca si dice (nome normalizzato e ruolo). Prima del primo congelamento e del primo consuntivo i due passi non servono, ma il confine non va mai oltre settembre 2026: col primo congelamento di ottobre, settembre si chiede lo stesso. L'extra raccolta con un documento a zero righe e interventi finiti nel mese serve.
- **Quadrature FIR**: le settimane ISO del mese, ferme all'anno come `intervalloSettimana`, completate e piene su ogni canale. **Si chiedono dalla settimana 37 del 2026** (`PRIMA_SETTIMANA_DA_QUADRARE`, `settimanaDaQuadrare` in `chiusuraMese.ts`, fissa come `PRIMO_MESE_DEL_GESTIONALE`). Decisione dell'utente del 13/10/2026: «ciò che è vecchio non conta più», come i report settimanali cancellati dopo quaranta giorni. La 36 (31/08-06/09) e le settimane prima sono «non_serve» anche se hanno una quadratura caricata da chiarire, col perche' «le quadrature si chiedono dalla settimana 37 del 2026, quello che c'è prima non conta più». Settembre 2026 chiede quattro settimane (37-40). Il confine non dipende piu' dalla prima quadratura caricata. Prove: `prove/chiusuraMese.mjs` (QUADRATURE FIR), `prove/statoChiusuraMese.mjs`.

Prove: `prove/chiusuraMese.mjs` (le regole, con la fotografia vera del guardiano e il foglio DICHIARAZIONI del 09/10), `prove/statoChiusuraMese.mjs` (la funzione intera con un SDK finto che conta le letture e sa `$in`, ordinamento e numero di righe, e il giorno di oggi fissato), `prove/chiusuraMesePannello.mjs` (i passi disegnati con React lato server), `prove/chiusuraMeseDatiVeri.mjs` (la funzione intera sulla copia dei dati veri dell'11/10/2026, coi sei scenari dei revisori del 12/10; si salta senza la copia o con un'altra copia), `prove/mesiChiusiFuori.mjs` (segnaMesiChiusiFuori e statoChiusuraMese intere sulla copia dei dati veri, con un archivio finto scrivibile: piano, conferma, storico, dopo; si salta senza la copia). **Nelle prove le esportazioni si scrivono come le registra l'interfaccia**, con `documento_ids` pieni: una prova con `documento_ids: []` passava senza provare niente.

**I collegamenti portano scheda e periodo** (11/10/2026). Le pagine leggono l'indirizzo con `leggiCollegamento` di `src/lib/collegamenti.js`: Fatturazione `?tab=passiva|attiva&anno=&mese=&canale=` (scheda, mese della passiva e dell'attiva, canale della passiva), Verifiche Fornitori `?tab=consuntivi&anno=&mese=&canale=`, Verifiche `?tab=quadratura-fir`, Dichiarazioni Impianti `?tab=irigom&anno=&mese=` (la pratica di Irigom si apre su quel mese quando le pratiche sono lette). Un parametro che non si capisce si ignora e la pagina si apre come sempre; una scheda dell'amministratore aperta da un altro utente pure. Il mese si scrive col nome delle pagine («Settembre») o col numero. Chi aggiunge in `chiusuraMese.ts` un collegamento con `?tab=` deve trovare la scheda nell'elenco `SCHEDE` della pagina: `prove/collegamentiPagine.mjs` lo controlla, insieme alla regola pura.

### La Guida dentro il gestionale (14-15/10/2026)

Proposta all'utente il 14/10/2026 e accettata lo stesso giorno («per me ok ... su quanto da creare, procedi pure»): una pagina «Guida» (`/guida`, `src/pages/Guida.jsx`, pigra in `src/App.jsx`) nel menu per tutti, subito dopo Richieste. I testi e la struttura stanno in `src/lib/guida.js`; la pagina li mostra soltanto e non legge nessun archivio: il livello viene da `usePermessi`, nessuna richiesta in piu' al server.

- **Una parte per ogni voce del menu** (`MODULI`: stesso nome, stesso percorso, stesso ordine di `NAV_ITEMS`): a che cosa serve, che cosa vedi, che cosa puoi esportare (o perche' niente), che cosa fa solo l'amministratore, le note per livello (`perLivello`). **Chi aggiunge una voce al menu scrive la sua parte nella guida**: `prove/guida.mjs` legge `NAV_ITEMS` eseguendo l'elenco com'e' scritto (apici singoli o doppi, apostrofi, proprieta' in qualsiasi ordine; dal 15/10/2026, prima una regex perdeva le voci scritte diversamente), conta le `label:` scritte contro le voci lette e cade su un modulo senza guida, un nome cambiato o una guida per un modulo tolto.
- **E la aggiunge al modulo di richiesta** (chiusura del 15/10/2026). La guida dice «Scegli il modulo. Se non è nell'elenco, scegli «Altro»», ma `MODULI` di `src/pages/Richieste.jsx` non aveva Dashboard, Omologhe, Dichiarazioni RENTRI, Dichiarazioni Impianti, Verifiche Fornitori, Richieste, Guida e Utenti: chi chiedeva una correzione su quelle pagine doveva scegliere «Altro». Ora l'elenco ha tutte le voci del menu, nello stesso ordine, e «Altro» in fondo; il valore salvato di EcoTyna resta 'Assistente' (`ETICHETTE_MODULI`). La sezione 1 di `prove/guida.mjs` lo controlla.
- **Per livello**: `livelloDellaGuida(livello, isAdmin)`; amministratore e' solo chi lo e' per il ruolo, e un livello «admin» scritto altrove, o non ancora letto, vale consultazione. Chi legge vede il suo livello (le righe `puo`/`nonPuo` di `src/lib/livelli.js`, le stesse della pagina Utenti) e solo le sue note; l'amministratore vede i tre livelli e tutte le note, col suo segnato. «I passi del mese» (caricamenti, copia di sicurezza, verifiche settimanali, liste di inizio mese, Richieste ECT, i passi di `chiusuraMese.ts`, la fatturazione) sono solo dell'amministratore, anche nella ricerca. A chi non e' amministratore il blocco si chiama «Lo fa solo l'amministratore» e porta a «Apri una richiesta».
- **Sezioni per tutti**: «Come chiedere una correzione o un caricamento» (Richieste: la risposta resta nella pagina, nessuna email), «Le parole del portale», «Come chiedere a EcoTyna» (gli esempi aprono `/assistente?domanda=`; aperti negli Assegnati, chiusi nei Terminati, Richieste ECT solo per le email).
- **La ricerca** sta in cima alla pagina: senza accenti, alla radice delle parole, tutte le parole devono esserci, parole evidenziate e moduli trovati gia' aperti. **Non e' sticky, e non puo' esserlo** finche' il Layout resta com'e': il `<main>` ha `overflow-y-auto` ma non scorre mai (il contenitore ha solo `min-h-screen`, scorre la finestra), e uno sticky si aggancia al primo antenato con un suo scorrimento, quindi se ne va col resto. In fondo alla pagina c'e' «Torna alla ricerca». La sezione 7 della prova cade se la pagina torna sticky, o il commento lo promette, senza un'altezza fissa nel Layout.
- **La guida non promette quello che il gestionale non fa**: ogni frase e' presa dalle pagine e da questo file. I collegamenti (`collegamentiDellaGuida`) sono rotte vere di `App.jsx`, mai rimandi; un `?tab=` sta fra le `SCHEDE` e le `TabsTrigger` della pagina, che legge l'indirizzo. Le novita' del 14/10/2026 (riepilogo della settimana, copia di sicurezza, errori del sito) si nominano solo se le pagine le montano.
- **Il promemoria della copia** («se passano sette giorni senza una copia, «Da gestire» della Dashboard te lo ricorda») e' stato tolto il 15/10/2026, quando `vociPromemoriaCopia` (`base44/shared/promemoriaCopia.ts`) non la chiamava nessuno, e rimesso alla chiusura dello stesso giorno, quando `cruscotto.ts` ha cominciato a chiamarla. La sezione 8 di `prove/guida.mjs` lega la promessa alla chiamata nei due sensi: la guida, e la sezione della copia in Caricamento Dati («dopo sette giorni la dashboard te lo ricorda»), la possono fare solo se un file di `src` o `base44` (prove e commenti esclusi) chiama la regola; e quando la chiamata c'e' la guida la deve fare nei passi del mese. Allo stesso modo la parte della Dashboard solo dell'amministratore nomina gli errori del sito e il promemoria della copia se e solo se «Da gestire» li dice.
- Una colonna a 375 px: nessuna tabella, nessuna larghezza fissa, moduli che si aprono al tocco con `<details>`.

Prove: `prove/guida.mjs` (menu e guida, il modulo di richiesta, collegamenti, rotta pigra, livelli, ricerca, pagina col React finto, piattaforma e 375 px, novita' del giro e promemoria della copia, pagina disegnata con React vero lato server: a chi consulta e all'operatore base solo le note del loro livello).

### Il target del contratto e l'atteso alla data (11/10/2026)

Il target annuo RETE e il riparto per regione vengono dal contratto Ecotyre
dell'anno. Fra piu' `CommessaEcotyre` dello stesso anno vale la **modificata per
ultima** (`commessaDellAnno` in `base44/shared/annoTarget.ts`, `updated_date` o
`created_date`), in Target & Status, nella Dashboard, nella predittivita' e in
EcoTyna: la Dashboard prendeva la creata per ultima, EcoTyna la prima
restituita. Il resto sta in `base44/shared/attesoContratto.ts` (specchio
`src/lib/attesoContratto.js`):

- `targetAnnuoDellAnno` / `regioniDellAnno`: il contratto. Le 11.200 t del 2025,
  le 11.550 t del 2026 e il riparto per regione del 2026 sono **solo un ripiego
  dichiarato** (fonte `'ripiego'`, e la pagina lo dice). Un anno senza contratto
  ha target `null`: si mostra «—» con un avviso, mai «0%» o le 11.550 t del 2026
  nel grafico (il 2027 prima della copia lo faceva). Nessuna pagina o funzione
  si scrive costanti sue: `TARGET_BY_YEAR`, `TARGET_ANNUO`, `RISERVA_REGIONI` e
  `TARGET_ANNUO_TON` sono tolte.
- `attesoAllaData(commessa, anno, giornoDati)`: l'atteso segue il profilo
  mensile del contratto riportato all'annuo (quello del 2026 somma 11.571,64 t),
  con i mesi finiti interi e il mese dei dati per i giorni che i dati coprono
  (`giorniCopertiNelMese`: fino all'ultima fine trasporto, mai oltre oggi). La
  usano la tessera e la sezione Rete della Dashboard (percentuale dell'anno,
  «atteso al gg/mm», scarto a parole: «avanti di», «indietro di»), la tabella
  delle regioni della Dashboard, con la riga «Fuori dalle regioni del
  contratto», l'Andamento per
  regione di Target & Status, la proiezione di fine mese di `checkTargetAlerts`
  e il riepilogo della commessa di EcoTyna. L'Andamento contava sul giorno del
  dispositivo: con i dati fermi al 7 e oggi il 10, lo scarto era peggiore di tre
  giorni di raccolta.
- **Un target copiato e non ancora confermato** (`daConfermare` di
  `annoTarget.ts`: il contratto, i target mensili) si mostra «copiato, da
  confermare» e **non apre alert**: `checkTargetAlerts` lo restituisce in
  `da_confermare`, e lo scostamento grave di `runAlertEngine` lo salta.
  Vale anche per l'ACI e per l'Andamento (prova del cambio d'anno, 15/10/2026,
  difetti 23 e 24): `quadro.aci.da_confermare` e' il `daConfermare` del
  contratto, e Canale ACI e la sezione ACI della dashboard scrivono «copiata dal
  <anno prima>, da confermare» accanto a previsione e corrispettivi e
  «calcolato col prezzo del <anno prima>» sul valore del raccolto (i
  corrispettivi ACI sono annuali, senza tacito rinnovo). `righeAndamento` porta
  per ogni riga `annuoDaConfermare`, `targetCopiati`, `targetScritti` e per ogni
  mese `daConfermare`; la frase sopra le tabelle e il segno della riga stanno in
  `andamentoTarget` (`fraseTargetCopiati`, `segnoTargetCopiati`,
  `targetCopiatiDellAnno` sui record), cosi' TargetTable, Report generale e i
  file dell'Andamento dicono le stesse parole e lo stesso numero: il PDF e la
  presentazione (`statusExports.js`, il conto dell'anno passato dalla pagina) e
  l'ultima colonna «Target da confermare» del foglio Raccoglitori di
  `exportStatusExcel`. I numeri restano quelli scritti; le celle copiate in
  corsivo arancio e il loro Δ senza colore. Il 15/01/2027 sui dati veri: «161
  target su 161 copiati dal 2026».

Prove: `prove/targetAttesoAllaData.mjs`, `prove/annoTarget.mjs`,
`prove/cambioAnnoRitocchi.mjs` (sezione 3, i file dell'Andamento).

### Le variazioni del contratto in corso d'anno (14/10/2026)

Richiesta dell'utente del 14/10/2026, testuale: *«abbiamo avuto per il mese di
ottobre dal consorzio 100 t in più che per il momento ho aggiunto al target di
Smoco in Puglia (ho fatto la variazione lì)...ti chiedo come variano gli altri
moduli e sezioni di conseguenza considerando che il target è passato a 11.650 t
nell'anno 2026?...non sto notando che da altre parti la modifica viene
interessata, compresa la dashboard»*. Il «Totale raccoglitori» era 11.650 t, ma
il contratto (`CommessaEcotyre`) era rimasto a 11.550: dashboard, atteso alla
data, proiezione, Andamento ed EcoTyna leggono il contratto, e non si
muovevano. **Una variazione del consorzio si registra nel contratto**, non
nella scheda dei raccoglitori.
- **La variazione**: «Registra una variazione» nella scheda Commessa Ecotyre
  (`src/components/target-status/VariazioneContratto.jsx`, solo
  l'amministratore, mai su un anno chiuso): mese, regione, tonnellate in piu' o
  in meno, la destinazione se si sa, il motivo e il giorno della comunicazione.
  Le regole sono in `attesoContratto.ts` (specchio in `src/lib`):
  `variazioneDelContratto(commessa, variazione)` da' errori, avvisi e la `patch`
  (target annuo, target della regione, target mensile rivisto del mese e, se si
  dice, la quantita' della destinazione, arrotondati al chilo, mai sotto zero),
  scritta con una scrittura sola (`scriviConTraccia`), piu' la voce nello
  storico della commessa (`storicoConVariazione`) col motivo. Senza target
  mensile rivisto la variazione va nell'annuo e nella regione, e lo dice.
- **L'elenco**: `variazioniDelContratto(commessa)` le legge dallo storico, con
  `in_vigore`. Una variazione i cui numeri un salvataggio della tabella (a mano
  o da un foglio importato) riscrive esce dai numeri e resta in elenco barrata,
  con chi l'ha superata; la scheda lo dice prima di salvare
  (`variazioniCheSiChiudono`), non dopo (revisione del 14/10/2026: prima
  l'elenco continuava a dire «compresa nel contratto» e la stessa variazione si
  poteva registrare due volte).
- **L'avviso dei raccoglitori**: quando l'annuo dei raccoglitori di una regione
  non fa il contratto (`scartiDalContratto`, sotto mezza tonnellata no), la
  scheda Target raccoglitori lo dice («I raccoglitori della Puglia hanno 100,00 t
  più del contratto ...») col pulsante che apre la variazione gia' compilata; il
  mese si propone solo se si capisce dallo storico dei target mensili
  (`propostaDelMese`). Lo stesso avviso e' una voce di «Da gestire» della
  dashboard (`vociContrattoRaccoglitori`, vedi «La dashboard»).
- **L'atteso di una regione e' suo** (`attesoDellaRegione`, revisione del
  14/10/2026): la parte senza variazioni segue il profilo del contratto, le
  variazioni in vigore della regione stanno intere nel loro mese, e quelle delle
  altre regioni non la toccano; le regioni sommano l'atteso del totale. Si usa
  al posto di `attesoAllaData` col target della regione, che dava a ogni regione
  la quota nazionale e spalmava le 100 t di ottobre anche su Campania e Sicilia.
  La usano l'Andamento di Target & Status, la tabella delle regioni della
  dashboard (`getDashboardRaccolta`) ed EcoTyna (`assistente.ts`): queste due
  dalla chiusura del giro del 14/10/2026. Dal giro dopo anche lo strumento
  `contratto_ecotyre`, con `contrattoDellaRete` (vedi piu' sotto).
- **Le variazioni a parole** (giro del 14/10/2026). I numeri si muovono da se',
  ma EcoTyna, la dashboard e la card dell'Andamento dicevano solo 11.650 t. Ora
  dicono anche da dove vengono, solo per le variazioni in vigore
  (`variazioniDelContratto(...).filter(v => v.in_vigore)`), e senza nessuna
  lettura in piu'.
  - EcoTyna: `testoVariazioni` (`assistente.ts`) scrive la riga sotto
    «Contratto Ecotyre», per esempio «Il contratto 2026 comprende una variazione
    del consorzio, …: ottobre, Puglia +100,00 t (…). Per questo il target annuo
    e' 11.650,00 t: senza, sarebbe 11.550,00 t». La regione dice «di cui
    +100,00 t di variazioni del consorzio». Una variazione superata va su una
    riga a parte e non si dice mai in vigore. Il target mensile rivisto si
    nomina solo per le variazioni che ci sono scritte (`nel_mese`): su un
    contratto senza profilo la variazione e' solo nel target annuo e nella
    regione (revisione del 14/10/2026).
  - Dashboard: `quadroRete` porta `variazioni`, senza chi le ha registrate,
    perche' il quadro lo vede chiunque. `fraseVariazioni` e `sottoVariazioni`
    (`righeQuadro.js`) danno la riga sotto la cifra «Target annuo del
    contratto», che va anche nel PDF, e la frase del suo perche'. La stessa
    frase, con l'anno, sta nel perche' della sezione Rete (`SezioneRete.jsx`,
    chiusura del giro), dopo «Target: il contratto Ecotyre ... il modificato
    per ultimo.».
  - Andamento: `kpis.variazioni` (`TargetStatus.jsx`, solo col target dal
    contratto) e `notaVariazioni` (`KpiCards.jsx`).
  - Senza variazioni i testi sono quelli di prima, carattere per carattere.
  Prove: `prove/variazioniAParole.mjs` e
  `prove/variazioniNelPercheDellaRete.mjs` (la sezione disegnata col riquadro
  del perche' aperto: lato server il
  popover del pulsante «i» non si disegna, e la prova sostituisce `Perche` con
  un contenitore che mostra quello che avrebbe dentro).
- **Le pagine gia' aperte si aggiornano da sole** (richiesta dell'utente del
  14/10/2026, testuale: *«falla tu la registrazione ed aggiorna tutto, ma fai in
  modo che quando si faccia una tale variazione i moduli collegati come la
  dashboard si aggiornino di conseguenza»*). Le funzioni leggono contratto e
  target quando sono chiamate, ma le pagine li chiedono quando si aprono. Chi
  scrive contratto o target, a scrittura riuscita, chiama
  `annunciaTarget({ anno, parti, origine })` (`src/lib/eventiDati.js`, solo
  delle pagine; parti `contratto`, `annui`, `mensili`). Per la stessa scheda
  c'e' l'evento della finestra `target-cambiati`, per le altre un
  `BroadcastChannel`. Niente localStorage, ogni passo in un try. Annunciano la
  variazione, il salvataggio della commessa, ogni scrittura della griglia dei
  raccoglitori e la copia dell'anno di Impianti e stoccaggi (le parti che dice
  di aver scritto; se si ferma a meta', quelle della simulazione, perche' una
  parte puo' essere gia' scritta). Chi mostra quei numeri usa
  `useTargetCambiati(interessa, rileggi)` e rilegge solo la parte toccata: una
  volta per raffica (1,5 s), non piu' di una ogni 30 s, a scheda nascosta al
  ritorno, mai due insieme. Chi ha scritto non rilegge per se' stesso
  (`useOrigine`).
  - Dashboard: il quadro se il cambio e' dell'anno a video. «Da gestire» se
    cambiano contratto o target annui dell'anno in corso o di quello dopo, per
    la voce «Nuovo anno» (revisione del 14/10/2026). I mensili dell'anno dopo
    non fanno rileggere niente.
  - Target & Status: Andamento, Commessa, Target raccoglitori e il report
    generale rileggono il contratto o i target cambiati, mai il raccolto.
  - La pagina scrive «… riletti alle hh:mm»; se la rilettura cade, dice che i
    numeri a video sono di prima.
  - L'annuncio non esce dal browser: un altro computer, o un browser senza
    `BroadcastChannel`, vede i numeri nuovi riaprendo la pagina (per questo il
    punto dopo). La copia dell'anno che scrive solo i siti di Giacenze non si
    annuncia: la voce «Target e siti» della dashboard gia' aperta se ne accorge
    ricaricando. Per un caso cosi' raro non c'e' una parte in piu'.
- **Chi scrive la commessa la rilegge subito prima** (revisione del
  14/10/2026). L'annuncio non arriva da un altro computer, e `storico_json` si
  riscrive intero: partendo dal record letto all'apertura, una variazione
  registrata nel frattempo spariva dai numeri senza avviso, e il «prima» diceva
  il target di allora. Rileggono il contratto dell'anno prima di scrivere, con
  una lettura per salvataggio, la variazione («fresca»), la scheda Commessa
  Ecotyre e `RegoleAnno` di Impianti e stoccaggi (fine della programmazione e
  chili per viaggio: il primo inventario l'aveva liquidata con «niente»), e la
  conferma del contratto copiato nella scheda Commessa Ecotyre (14/10/2026).
  Storico e «prima» si scrivono da quello riletto. La scheda Commessa confronta
  campo per campo tre versioni: il record da cui vengono i numeri a video,
  quello riletto e quello a video (`riallineaAlContratto`).
  - Un campo cambiato solo altrove prende il valore salvato.
  - Un campo cambiato qui e li' blocca la scrittura: la scheda lo dice, mostra
    l'avviso «esce dai numeri» se una variazione ne uscirebbe, e si salva
    premendo di nuovo.
  - Altrimenti si scrive l'unione, e il messaggio dice che cosa viene dal
    salvato.
  - Un contratto creato altrove mentre qui si scriveva il primo si aggiorna:
    non se ne crea un secondo.
  - Lo stesso confronto vale quando l'annuncio arriva con modifiche a video.
  `prove/variazioneContratto.mjs` cerca ancora nel sorgente della scheda
  `const valori = valoriDa(dati, anno);`: chi tocca il salvataggio guarda
  anche `riallineaAlContratto` e `scriviContratto(dati, fresca)`, dove ora si
  decide che cosa si scrive.
- **Chi legge il target del contratto** (inventario del 14/10/2026, in breve).
  - Quando e' chiamato, quindi coi numeri del momento: `getDashboardRaccolta`
    (quadro e regioni), `cruscottoOperativo` («Da gestire»: raccoglitori contro
    contratto e «Nuovo anno»), EcoTyna (`situazioneGestionale`,
    `contratto_ecotyre`, `target_raccoglitori`), la predittivita'
    (`predittivitaDati`: fine della programmazione e chili per viaggio).
  - Le pagine, all'apertura e all'annuncio: Dashboard, Target & Status,
    Impianti e stoccaggi.
  - Solo regioni e province del contratto, non le tonnellate:
    `matriceProvinceRete`, `computeProvinceMatrix`, `runAlertEngine` (province
    inattive).
  - **Restano fotografie del loro giorno**, ed e' giusto cosi': gli alert dei
    target mensili (`checkTargetAlerts`, alle 9, che legge i target dei
    raccoglitori e non il contratto), i PDF e gli Excel gia' scaricati, i Word
    dei contratti ai subfornitori. Nessuna funzione che salva un conto legge il
    target del contratto.
  - La copia dell'anno (`pianoCopiaAnno` di `annoTarget.ts`) legge il contratto
    dell'anno prima quando si copia, e lo porta senza le variazioni: vedi il
    punto dopo.
- **Il nuovo anno nasce senza le variazioni del consorzio** (decisione
  dell'utente del 14/10/2026, «ok» alla proposta: valevano per l'anno in cui
  il consorzio le ha date). Prima la copia dell'anno portava nel 2027 il
  contratto coi numeri della variazione (11.650, Puglia 2.600, ottobre 1.200,
  IRIGOM 4.550) col solo «copiato dal 2026, da confermare»: nel 2027 nessuno
  avrebbe saputo da dove venivano le 100 t in piu'.
  - La regola e' una, `contrattoSenzaVariazioni(commessa, annoNuovo,
    raccoglitori)` di `attesoContratto.ts` (specchio in `src/lib`), e la usa
    `pianoCopiaAnno` (funzione `copiaAnnoTarget`). Ogni variazione in vigore si
    toglie dal target annuo, dalla prima riga della sua regione (dove
    `variazioneDelContratto` l'ha scritta: con due righe della stessa regione
    non se ne tolgono 200 t), dal mese rivisto solo se ci e' stata scritta
    (`nel_mese`) e dalla prima riga della sua destinazione solo se nessun
    salvataggio l'ha riscritta dopo. La destinazione non decide `in_vigore`:
    si segue nello storico con `numeroDellaVariazione`, come la regione e il
    mese. Al chilo, mai sotto zero; un annuo mancante resta mancante. **Le
    variazioni superate non si tolgono**: vale il contratto scritto dopo, come
    per `in_vigore` (quando la regione porta ancora le loro tonnellate lo dice
    la nota, vedi sotto).
  - Sul caso vero il 2027 nasce a 11.550, Puglia 2.500, ottobre 1.100, IRIGOM
    4.450. Profilo iniziale, budget, classi e previsione ACI, che le variazioni
    non toccano, si copiano come sono, e cosi' raccoglitori, mensili, impianti,
    collegamenti e siti.
  - **La nota sta nello storico del contratto copiato, in una voce sola**:
    «copiato dal 2026, da confermare · La variazione del consorzio del 2026 non
    è copiata, perché valeva per il 2026: ottobre, Puglia +100,00 t, ... Se il
    consorzio la conferma anche per il 2027, registrala come variazione del 2027
    nella scheda Commessa Ecotyre.», con `variazioni_non_copiate`. Una voce
    sola perche' `daConfermare` cerca la nota della copia nell'ultima voce: una
    seconda voce dopo farebbe sembrare confermato il contratto. Confermato il
    contratto (un salvataggio della scheda aggiunge la sua voce), il promemoria
    resta leggibile in «Modifiche», in fondo alla scheda Commessa Ecotyre.
  - La nota dice anche, una frase per caso: le destinazioni riscritte dopo una
    variazione (si copiano come sono scritte: controllale); i target dei
    raccoglitori dell'anno nuovo che, col contratto senza variazioni, non fanno
    piu' la regione (il caso vero del 14/10: SMOCO in Puglia 1.950, cioe'
    raccoglitori 2.600 contro 2.500; senza la frase il 2027 nasceva con
    l'avviso del cruscotto e nessuno l'aveva detto prima); le variazioni
    superate dal solo mese, quando la regione porta ancora le loro tonnellate
    (si copiano come sono, e la nota c'e' anche senza variazioni in vigore). I
    raccoglitori si copiano sempre come sono: se il consorzio conferma la
    variazione per il nuovo anno, registrandola tornano a fare il contratto;
    se no, si correggono nella scheda Target raccoglitori.
  - La risposta della funzione, anche simulata, porta
    `contratto_senza_variazioni` ({ variazioni, righe, raccoglitori, parti,
    nota, motivo }). La finestra «Copia dal 2026 al 2027» (`DialogoAzione` di
    `ConfigurazioneImpianti.jsx`) mostra i numeri con e senza e un paragrafo
    per parte, prima di confermare e dopo; il titolo «senza le variazioni» c'e'
    solo se se ne toglie qualcuna. Le righe di ModificaDato del contratto hanno
    il motivo «copia dal 2026, da confermare; senza la variazione del consorzio
    del 2026 (ottobre, Puglia +100,00 t)». Se non c'e' niente da dire, copia e
    risposta sono quelle di prima, campo per campo.
  - `annoTarget.ts` e `attesoContratto.ts` si importano a vicenda: regge perche'
    nessuno dei due usa l'altro mentre si carica. Una costante in cima a uno
    dei due calcolata con una funzione dell'altro lo romperebbe: la prova li
    impacchetta nei due ordini. `preparaAnno` e `inizializzazioneAnno` non
    copiano il contratto: la voce «Contratto Ecotyre» di «Nuovo anno» lo vede
    copiato e da confermare come prima.
  - **Il ruolo dei target si copia ed e' nella chiave** (prova del cambio
    d'anno, 15/10/2026, difetto 26): `pianoCopiaAnno` porta `ruolo` sugli annui
    e sui mesi e lo mette in `kRacc`, come l'identita' della riga nella scheda
    Target raccoglitori. Prima le primarie di T-Cycle (1.050 t impianto, 250 t
    piazzale) nel 2027 diventavano 1.300 t senza ruolo. Una riga senza ruolo si
    copia come prima. Prova: `prove/copiaAnnoTarget.mjs`.
  Prova: `prove/copiaSenzaVariazioni.mjs` (la regola, il piano, la funzione
  intera sulla copia dei dati veri dell'11/10/2026, la finestra a 375 px, i due
  moduli che si importano a vicenda).
- **EcoTyna legge il contratto con `contratto_ecotyre`**, non con la somma dei
  raccoglitori: vedi «EcoTyna: le domande sui dati non sono domande di norma».
- Prove: `prove/aggiornamentoDopoVariazione.mjs`, col calendario fermo al
  14/10/2026 e al 15/11/2026 per la voce «Nuovo anno»: con la data vera sarebbe
  diventata rossa dal 01/01/2027 senza che il codice cambiasse. Per EcoTyna
  `prove/ecotynaContratto.mjs` e `prove/pianoContrattoEcotyre.mjs`.

Sulla copia dei dati veri dell'11/10/2026, con la variazione di ottobre (+100 t
in Puglia, IRIGOM): target annuo 11.550 → 11.650; Puglia 2.500 → 2.600; ottobre
nel contratto 1.100 → 1.200; atteso del totale all'08/10 8.689,23 → 8.715,04 (la
sola parte di ottobre passata, 100 t per 8 giorni su 31), scarto +129,32 →
+103,51; Puglia attesa 1.880,79 → 1.906,59 e le altre quattro regioni
invariate, nella dashboard, nell'Andamento e in EcoTyna; residuo 2.731,45 →
2.831,45; proiezione 11.721,90 t (101,49%) → 11.788,37 t (101,19%). Prove: `prove/variazioneContratto.mjs` (le regole, l'avviso,
la dashboard intera, l'Andamento ed EcoTyna sui dati veri, la finestra
disegnata), `prove/targetAttesoAllaData.mjs`. Con i dati fino al 12/10, i
numeri del sito del 14/10/2026: atteso del totale 8.830,901 → 8.869,611 t,
Puglia 1.911,45 → 1.950,16 t, e `contratto_ecotyre` dice gli stessi. Con
Impianti e stoccaggi aperta prima della variazione e salvata dopo, l'atteso
della Puglia al 12/10 passava da 1.950,160 a 1.979,500 t e il totale da
8.869,611 a 8.869,681 t, con le variazioni da 1 a 0. Dalla revisione del
14/10/2026 restano 1.950,160 e 8.869,611 t, con la variazione in vigore.

### L'Andamento di Target & Status: le stesse parole in pagina, Excel, PDF e presentazione (11/10/2026)

Le righe dell'Andamento le costruisce **`righeAndamento`**
(`andamentoTarget.ts`), una volta sola per la pagina, il PDF e il file Excel
(`exportStatusExcel`). Il file perdeva i target senza raccolto (il 2 gennaio
quasi tutti) e quelli scritti abbreviati: con 1.800 t di target ne mostrava
1.000.

La tabella degli impianti si chiama **«Primarie RETE ricevute dagli impianti»**
dappertutto: conta le sole primarie, e non e' il «Conferito RETE» delle
Giacenze, che comprende anche le secondarie in arrivo. Il residuo e' «Residuo»
(«Residuo dell'anno» nelle card: target meno raccolto; negativo, target
superato). Lo scarto e' raccolto meno atteso ai giorni coperti dai dati
(positivo avanti, negativo indietro) e si chiama come la card, che dice i mesi
che guarda: «Scarto del mese sull'atteso», o «Scarto di agosto sull'atteso» col
filtro sui mesi. La presentazione e il riepilogo del PDF lo chiamano allo stesso
modo e lo leggono da `scartoMese`, mai dal vecchio delta di segno opposto; la
presentazione riceve l'anno dalla pagina, e titolo e nome del file lo portano
(prima i numeri del 2025 si leggevano come quelli del 2026). «Leftover», «Delta
Mese In Corso» e «Totale Conferito» non si usano piu'. Un valore che manca (il
target di un anno senza contratto, lo scarto senza dati) esce «—», mai 0,00: in
`statusExports.js` si formatta con `tonnellate` di `src/lib/target.js`, come le
card, e non con `formatTonnellate`, che per null scrive 0,00. Data e nome del
file sono quelli italiani (`oggiRoma`). Prove: `prove/statusExportsParole.mjs`,
che impacchetta `statusExports.js` con jsPDF e pptxgenjs finti e legge le celle,
e `prove/presentazioneTarget.mjs`, che chiama la presentazione come la chiama la
pagina.

**I filtri della scheda non toccano i numeri dell'anno** (segnalazione alta del
20/09, corretta il 12/10/2026). La pagina legge il raccolto RETE una volta, per
anno e canale e senza filtri (`raccoltoAnno`): lo ricevono le card «Raccolto
RETE nell'anno» e «Residuo dell'anno», la tabella «Raccolta RETE per regione e
contratto», il Report generale e il riepilogo delle date. I filtri si applicano
in memoria con `filtraRaccolto` (`src/lib/raccoltoFiltrato.js`, ricostruisce
tutti i raggruppamenti da `by_raccoglitore_impianto`) e vanno solo alle tabelle
che li prevedono e allo scarto sull'atteso, che dice con quali filtri vale. Prima
col filtro Mese = Settembre la card dell'anno diceva il solo settembre (sui dati
veri dell'11/10: 1.120,24 t invece di 8.818,55, residuo 10.429,76 invece di
2.731,45). Un filtro cambiato non fa piu' una chiamata. La variabile filtrata si
chiama ancora `raccolto`: `prove/andamentoTarget.mjs` legge la riga di
`righeAndamento`. Prova: `prove/andamentoFiltriAnno.mjs` (il filtro in memoria
contro la funzione filtrata, il sorgente della pagina, le note delle card).

**Un target mensile doppio vale una volta: l'ultimo modificato, ovunque**
(12/10/2026, una regola sola dalla revisione del 13/10/2026). Stesso
raccoglitore, regione, impianto, ruolo e mese: la griglia ne mostra uno («vale
l'ultimo modificato») e la scelta la fa `targetMensiliValidi`
(`andamentoTarget.ts` e lo specchio `src/lib/andamentoTarget.js`): per
`updated_date`, a pari data quello che viene dopo. La usano `righeAndamento`
(pagina, `exportStatusExcel`, dashboard), la tabella per regione della stessa
pagina (`regioneData` in `TargetStatus.jsx`), `aggregaTargetMensili` (avvisi),
il riepilogo dei dati di EcoTyna (`situazioneGestionale`, `assistente.ts`: da
`aggregaTargetMensili` prende solo l'elenco dei nomi, il target del mese lo
somma su `targetMensiliValidi(mensili)`), `targetRaccoglitoreMese` (evasione
degli assegnati), `calcolaReportGenerale`, `calcolaReportSettimanale` e
`ripartisciTargetPrimarie` (Giacenze e predittivita'). Dal 13/10/2026 la usa
anche `targetAnnuoSoggetto` (`classeAlbo.ts`), il target con cui si confronta la
classe dell'Albo, e quindi anche lo strumento qualifica_fornitori di EcoTyna
(prova: `prove/classeAlbo.mjs`). Il 12/10 stava solo in `aggregaTargetMensili`:
con 80 t e poi 50 t gli avvisi dicevano 50 e la pagina 130. Fino al 13/10 la
tabella per regione e EcoTyna dicevano 130 dove la tabella per raccoglitore e
gli avvisi dicevano 50. Impianti o ruoli diversi si sommano ancora. Un modulo
nuovo che legge `TargetMensile` passa da `targetMensiliValidi`, importata da
`andamentoTarget.ts` (o dallo specchio) o da `targetRaccoglitori.ts`, che la
riesporta. Non si ricopia. Perche' lo specchio prende i mesi da `pfuConstants.js`
lo dice «Gli specchi». Prova: `prove/targetMensiliDoppi.mjs` (lo stesso numero
da tutti quelli che leggono i target mensili, compresi i quattro lettori
dell'ultimo giro: `regioneData` presa dal sorgente della pagina,
`situazioneGestionale` con un SDK finto, report settimanale e ripartizione fra
gli impianti). La ripartizione con due impianti nello stesso mese mette il
secondo su un sito che non e' quello di riferimento (GATIM 30, senza conferiti:
GATIM 30, IRIGOM 50, TECNOGUM 920). Sul sito di riferimento un target buttato
via rientrava nel resto dell'anno, e la verifica passava a vuoto (ultimo giro
della revisione del 13/10/2026). Una prova di una ripartizione usa un sito che
non e' quello di riferimento.

### I tipi di regola alert (11/10/2026)

Il menu della pagina Alert Engine (`TIPI_REGOLA`), l'elenco dell'archivio
(`base44/entities/RegolaAlert.jsonc`) e il motore (`runAlertEngine`:
`checkRegola` e i controlli aggregati) hanno gli stessi otto tipi, tutti
valutati davvero: `tratta_autorizzata`, `tratta_combinazione`,
`tratte_autorizzate_classe`, `anomalia_peso`, `province_inattive`,
`mix_classi_deviazione`, `scostamento_target`, `ritardo_sla`. Il menu offriva
anche campo obbligatorio, range valori, SLA tempi, congruenza peso e custom, che
il motore non ha mai trattato: una regola di quei tipi sembrava attiva e non
apriva niente. Un tipo nuovo si aggiunge in tutti e tre i posti, con la sua
valutazione (`prove/regoleAlert.mjs`). Una regola gia' salvata con un tipo tolto
resta, e la pagina la segna «non valutata dal motore».

### Il motore degli alert al cambio d'anno (12/10/2026)

`runAlertEngine` guardava solo i record dell'anno di oggi e chiudeva come
risolto ogni alert aperto la cui condizione non ritrovava: il 02/01/2027 un
ritiro del 20/12/2026 col peso zero, mai corretto, diventava «risolto: condizione
non presente nei dati 2027» (A54 dell'audit del 20/09). Lo stesso per tratte,
rotte, scostamenti e SLA. Ora:

- **Si controllano l'anno in corso e quello prima** (`primoAnnoControllato` di
  `movimenti.ts`, la stessa regola delle date obbligatorie). Nessuna lettura in
  piu': l'archivio del modulo si legge gia' tutto.
- **Alert nuovi sull'anno prima solo a gennaio e febbraio**
  (`MESI_NUOVI_ANNO_PRIMA`): i formulari di dicembre si registrano e si
  correggono a gennaio. Dopo, l'anno prima serve solo a riscrivere e a chiudere
  gli alert che ci sono. Aprirne tutto l'anno vorrebbe dire misurare un anno
  finito con le tratte dell'anno nuovo, e il giorno della pubblicazione aprire
  alert sul 2025.
- **Sull'anno prima vale la regola di tratta dell'anno prima**
  (`REGOLE_DI_TRATTA`: tratta_autorizzata, tratta_combinazione,
  tratte_autorizzate_classe; `scrittaPrimaDellAnno`, `tratteDiQuestAnno`;
  revisione del 13/10/2026). Le regole di tratta non hanno un anno: valgono dal
  giorno in cui sono scritte. Sull'anno prima si applica solo una regola
  configurata prima del 01/01 di quest'anno: conta `configurata_il`
  (decisioni dell'utente del 13/10/2026), il giorno italiano dell'ultima
  modifica della configurazione, con `impronta_configurazione` (modulo, tipo e
  config, chiavi in ordine). Le regole stanno in
  `base44/shared/configurazioneRegolaAlert.ts` (specchio
  `src/lib/configurazioneRegolaAlert.js`). Quella apre alert nuovi a gennaio e febbraio,
  come peso e rotte, e il viaggio del 30/12 registrato il 04/01 ha il suo
  alert: col primo rimedio, nessun alert di tratta sull'anno prima, non l'aveva
  mai. Una regola creata o cambiata quest'anno, sull'anno prima, non apre, non
  riscrive e non chiude: tolta a gennaio una destinazione ammessa l'anno prima,
  nasceva un alert falso per ogni viaggio di allora. L'alert gia' aperto di un
  viaggio dell'anno prima resta com'e' e si conta in
  `alerts_anni_non_controllati`, anche se la regola nuova ammette quella
  destinazione: allora era un errore. La pagina le regole le crea, le attiva e
  le disattiva.

  «Scritta» vuol dire configurata (decisioni dell'utente del 13/10/2026):
  attivare e disattivare una regola non la cambia. La regola porta
  `configurata_il`, il giorno italiano dell'ultima modifica della configurazione
  (modulo, tipo, destinazioni, combinazioni, classi, soglie), e
  `impronta_configurazione`, cioe' modulo, tipo e config scritti con le chiavi
  in ordine. «Salva regola» li scrive con `configurataOggi`; «Attiva/Disattiva»
  scrive solo `attiva` (`cambioAttivazione`). Una regola salvata prima del
  13/10/2026, senza i due campi, al primo tocco del pulsante prende il giorno
  della sua ultima scrittura (`updated_date`, che arriva in UTC senza fuso:
  `giornoDellIstante`), mai il giorno del clic. Il motore (`scrittaPrimaDellAnno`)
  usa `configurata_il` solo se l'impronta torna con la configurazione di oggi
  (`giornoDellaConfigurazione`); senza il giorno, o con una configurazione
  cambiata fuori dalla pagina (a mano nell'archivio), ripiega su `created_date`
  e `updated_date` come prima: tolta a gennaio una destinazione fuori dalla
  pagina, nessun alert falso sul 2026. Una regola senza nessuna data vale come
  scritta quest'anno. La pagina scrive «configurata il gg/mm/aaaa» accanto a
  ogni regola che ha un giorno di cui il motore si fida. Chi aggiunge alla
  pagina la modifica della configurazione scrive `configurataOggi` con la
  configurazione nuova, altrimenti l'impronta non torna e la regola ripiega
  sulle date di sistema.
- **Un alert si chiude da solo solo se il suo record sta negli anni
  controllati** (`perimetroDellAlert`). Regole sul formulario e rotte: l'anno e'
  quello del record, ricavato dall'archivio (ID ordine o formulario, fine
  trasporto sul giorno italiano); un record che non e' piu' fra i terminati con
  fine trasporto chiude l'alert e la nota lo dice. Fuori dagli anni controllati
  l'alert resta aperto com'e' (si chiudono solo i doppioni) e la risposta lo
  conta (`alerts_anni_non_controllati`): il cambio d'anno e la fine di febbraio
  non fanno sparire niente.
- **Mix classi e ritardo SLA** si misurano sull'anno in corso e la loro chiave
  non porta l'anno: un loro alert scritto l'ultima volta (`updated_date`) in un
  anno prima resta aperto. **Lo scostamento dal target ha l'anno nel record_id**
  (prova del cambio d'anno, 15/10/2026, difetto 22):
  `raccoglitore|regione|mese anno` («ALFA SRL|Puglia|Gennaio 2027»), con lo
  SPAZIO prima dell'anno, e il testo dice «Gennaio 2027». Un alert per anno; un
  ignorato vale solo per il suo anno; un alert scritto prima senza l'anno e'
  dell'anno di `created_date` (non `updated_date`: un ignorato ha
  `updated_date` nel giorno in cui lo si ignora) e nello stesso anno prende
  record_id e testo nuovi senza doppioni. Prima un ignorato del 2026 bloccava
  il gennaio 2027, e un aperto veniva riscritto coi numeri del 2027 senza anno.
  **Mai la barra prima dell'anno**: `raccoglitore|regione|mese|anno` e' il
  record_id degli avvisi di `checkTargetAlerts`, che cerca il «gia' aperto» fra
  tutti gli aperti di primarie_rete, e uno scostamento con quel record_id
  bloccava «Target non raggiunto» e l'aggiornamento di «Target a rischio». Le
  date obbligatorie girano su tutti gli anni. Prova: `prove/alertCambioAnno.mjs`
  (sezioni 15 e 16, le due funzioni vere sullo stesso archivio).
- **Province inattive: si chiude da solo solo l'alert dei mesi che la matrice ha
  guardato** (`perimetroProvince`, `mesiDellaMatrice`, 13/10/2026). La matrice
  rivaluta i mesi finiti dell'anno e, a gennaio e febbraio, novembre e dicembre
  dell'anno prima. Un alert la cui coppia di mesi sta fuori resta aperto e si
  conta in `alerts_anni_non_controllati`: prima, il 02/01/2027 l'alert di
  settembre-ottobre 2026 si chiudeva «risolto ... nei dati 2027». Il testo porta
  sempre l'anno dei due mesi («(Settembre 2026 - Ottobre 2026)»), e la nota di
  chiusura dice l'anno dei mesi («nei dati 2026», o «2026 e 2027» per una coppia
  a cavallo d'anno). Nei testi di prima un mese senza anno vale l'anno
  dell'ultima scrittura dell'alert (`updated_date`): un alert aperto lo scrivono
  solo i motori. Un testo senza coppia si chiude solo se scritto quest'anno, come
  mix e SLA. Se `computeProvinceMatrixData` cambia i mesi che guarda, va
  cambiato `mesiDellaMatrice`: lo dice la sezione 8 della prova. Un alert fuori
  da quei mesi non si riscrive nemmeno con la coppia trovata oggi (revisione
  successiva del 13/10/2026). La chiave e' provincia|||regola, senza i mesi:
  l'alert di ottobre-novembre 2026 a gennaio diventava quello di
  novembre-dicembre, e all'arrivo del ritiro di dicembre si chiudeva «risolto»,
  con ottobre e novembre ancora a zero. Ora resta sulla sua coppia e si conta
  anche se la provincia ha un'altra coppia a zero. Finche' e' aperto, la coppia
  nuova non apre un alert suo; chiuso a mano come risolto, nasce al giro dopo.
  Ignorato, vale solo per la sua coppia di mesi (decisioni dell'utente del
  13/10/2026, `provinceIgnorate`, `provinciaIgnorata`): la stessa coppia non
  riapre niente, una coppia nuova a zero apre un alert nuovo, e l'ignorato resta
  ignorato col suo testo. Prima bloccava la provincia per quella regola per
  sempre. Si confronta l'ultimo mese della coppia (`coppiaProvincia`), non il
  testo: i testi di prima non hanno l'anno, e quello di una provincia del
  contratto mai servita («(Gennaio 2026 - Settembre 2026)») e' la coppia
  agosto-settembre, anche se poi arriva tardi un ritiro di marzo. In un ignorato
  il mese senza anno e' dell'anno di `created_date`: `updated_date` e' il giorno
  in cui lo si e' ignorato. Un ignorato senza la coppia nel testo blocca la
  provincia come prima. Se la coppia a zero di oggi torna quella ignorata,
  l'alert aperto della provincia non si riscrive con quella coppia: si chiude,
  perche' la sua condizione non c'e' piu' (revisione del 14/10/2026: AV ignorata
  per agosto-settembre, il 02/11 nasce settembre-ottobre, il 09/11 arriva il
  ritiro del 28/10; prima l'aperto diventava «Agosto 2026 - Settembre 2026» e
  restava aperto per sempre). Un aperto che sta gia' sulla stessa coppia
  ignorata (un doppione di prima) si chiude con «la stessa coppia di mesi è già
  stata ignorata» (`ignorateOggi`). Il pulsante «Ignora» di Alert & Controllo
  non dice ancora che vale per quei due mesi: il motore funziona anche senza.
- **Le province del contratto mai servite** (A58, 13/10/2026). Il motore legge i
  contratti (`CommessaEcotyre`) una volta per giro, solo se c'e' una regola delle
  province, e li passa alla matrice con `{ commesse }`. Una provincia senza
  nessun ritiro nell'anno ha il testo «Provincia BA (Puglia), del contratto:
  nessun ritiro nell'anno (Gennaio 2026 - Settembre 2026)». Se la lettura non
  riesce il giro si ferma (500, nessuna scrittura): senza contratti quegli alert
  si chiuderebbero come risolti.
- **Le rotte si leggono anno per anno**: la quota di una destinazione e' sui
  viaggi dell'anno, e sommando due anni un viaggio fuori rotta del 2026 spariva
  fra quelli del 2027.
- La chiusura dell'anno delle Giacenze **non** fa da confine: scrive le
  rilevazioni del 31/12 sito per sito, non dice che i formulari sono giusti e
  leggerla costerebbe una richiesta a ogni giro.
- Nessun campo `anno` sull'alert: ogni campo scritto va dichiarato nello schema,
  e l'anno si ricava.
- Le note di chiusura automatica (`runAlertEngine`, `checkTargetAlerts`) hanno il
  giorno all'italiana («Chiuso automaticamente il 02/01/2027: ...», con
  `dataItaliana`). Nel testo degli alert le rotte dicono giorno e kg
  all'italiana («del 15/12/2026, 5.000 kg»); mix, SLA e scostamento scrivono
  percentuali e giorni con la virgola (`unDecimale`).
- La risposta ha `anni_controllati`, `anni_alert_nuovi` e `record_per_anno`.
  `record_scansionati` resta quello dell'anno in corso, perche' la pagina scrive
  «su N record del <anno> controllati». Il messaggio dopo «Esegui» lo compone
  `messaggioEsecuzione` (`src/lib/messaggioMotoreAlert.js`, in `src/lib` perche'
  la pagina caricata in node chiede il browser). Dice i record dell'anno prima e
  a che cosa servono, quanti alert il gestionale non controlla piu' da solo
  restano aperti (si chiudono a mano), e scrive ogni numero col punto delle
  migliaia. Gli alert rimasti aperti stanno in un numero solo
  (`alerts_anni_non_controllati`), che mette insieme un anno passato, le
  province su mesi che la matrice non guarda piu' e i viaggi dell'anno prima con
  una regola di tratta creata o cambiata quest'anno: un viaggio del 2026 a
  gennaio 2027 non e' «di un periodo non piu' controllato», e il messaggio dice
  quello che hanno in comune.
  Ogni anno prima porta in fondo «(non con le regole di tratta create o cambiate
  nel <anno>)», o «quest'anno» se la risposta non porta l'anno: le regole di
  tratta scritte prima del 01/01 aprono alert nuovi sull'anno prima fino a
  febbraio, quelle di quest'anno non lo misurano, nemmeno per aggiornare e
  chiudere. A ottobre il testo e' «... del 2025 per tenere aggiornati e chiudere
  i suoi alert (non con le regole di tratta create o cambiate nel 2026).» Prima
  diceva «(tranne le tratte)», ed era falso: a gennaio una regola di tratta
  scritta prima del 01/01 apre alert sull'anno prima (revisione del 13/10/2026,
  `prove/alertEsecuzioneMessaggio.mjs` sezione 6).
- Nel motore il genere di un alert («date», «rotta» o il tipo della regola) non
  si chiama `tipo`: `prove/regoleAlert.mjs` legge i confronti `tipo === '...'`
  come i tipi di regola valutati.

Prova: `prove/alertCambioAnno.mjs`. E' la funzione vera sul banco con la data
finta: il 02/01/2027 e ad aprile l'alert del 20/12/2026 resta aperto; corretto il
peso si chiude con «nei dati 2026»; nel 2028 resta com'e'. Copre anche la
finestra degli alert nuovi, le rotte per anno, lo SLA scritto nel 2026 e nel 2027
e le note di `checkTargetAlerts`. Le sezioni 8-12 coprono province, tratte
sull'anno prima e contratti. La 11 copre l'alert delle province fuori dai mesi
della matrice, che non si riscrive (CE con il ritiro di dicembre registrato a
gennaio, AV ad aprile, BA a marzo). La 12 copre la data della regola di tratta
(il viaggio del 30/12 registrato il 04/01, la regola disattivata e riattivata o
rifatta a gennaio, l'alert del 2026 con Gatim ammessa nel 2027);
la 13 la regola configurata nel 2026, disattivata e riattivata il 02/01/2027,
che apre ancora l'alert del viaggio del 30/12 registrato a gennaio, il giro
vero della pagina con `cambioAttivazione` e la configurazione cambiata a mano;
la 14 «Ignora» sulle province (stessa coppia, coppia nuova, testi senza anno,
BA mai servita, la coppia ignorata che torna il 09/11).
`prove/alertRegolaConfigurata.mjs` copre la regola e lo specchio, l'impronta,
il giorno di cui fidarsi, che cosa scrivono i due pulsanti (anche alle 23:30
UTC del 31/12) e i due campi nell'archivio;
`prove/alertEsecuzioneMessaggio.mjs` copre il messaggio della pagina, e nella
sezione 6 lo compone dalla risposta del motore vero sul banco con la data finta.

### Le attivita' della to-do list che si chiudono da sole (28/09/2026)

`base44/shared/todoOrdini.ts` (specchio `src/lib/todoOrdini.js`), la function
`controllaTodoOrdini`, TERZO dei cinque ricalcoli dopo le primarie
(`RICALCOLI` in `src/lib/importGrandeFile.js`: `evasioneAssegnati`, `ritiriEct`,
`todoOrdini`, `verifiche`, `qualifica`, eseguiti in quest'ordine).

Sull'attivita' si scrive l'ID dell'ordine da completare. Parole dell'utente:
«verifica quando essi passano dallo stato assegnato a quello di terminato e **solo
allora** indicarli come completati».

- **Il passaggio si deve VEDERE, non basta lo stato di adesso.** Il primo controllo
  di un'attivita' scrive che cosa sta guardando (`ordini_attesi`) e quali di quegli
  ordini sono ancora aperti (`ordini_da_attendere`), e **non chiude niente**. Si
  chiude quando quegli ordini risultano terminati. Se l'ordine era **gia' terminato**
  quando l'attivita' e' comparsa, nessun passaggio e' avvenuto: non si chiude mai da
  sola, e `notaOrdini` lo dice in testo neutro. Serve perche' `riferimento_ordine`
  esisteva da prima col significato di "ordine correlato": senza il passaggio, al
  primo giro si sarebbero chiuse in blocco decine di attivita' vecchie - uscendo
  dalla vista, che parte dalle aperte - con accanto un motivo vero in se' e falso
  come spiegazione.
- Il passaggio si **consuma** anche quando non porta a una chiusura (attivita' gia'
  spuntata a mano): cosi' una riapertura a mano resta aperta. E chi e' stato chiuso
  dal gestionale una volta non si richiude con gli stessi ordini
  (`chiusa_dal_gestionale`): a decidere e' chi lavora. Se chi l'ha riaperta ci
  scrive ordini diversi il segno si toglie e la chiusura di prima passa in
  un'annotazione (15/10/2026, vedi «La to-do list: modifica e annotazioni»).
- Un ordine **cancellato** a portale, dopo il passaggio, manda l'attivita' fra le
  cancellate (vedi «La to-do list: i cancellati dal portale», 14/10/2026): fino a
  quel giorno non chiudeva niente e chiedeva all'utente che cosa farne. Un
  **"eseguito"** si segnala sempre; un terminato **senza fine trasporto** non
  conta (regola 1); una fine trasporto **nel futuro** non chiude niente.
- Un ID che non si trova si dice con tutte le sue cause possibili (scritto male,
  ordine non ancora caricato, codice che non e' un ordine): mandare a ricaricare un
  file che c'e' gia' e' una bugia comoda. E se la domanda per numero d'ordine non
  torna **niente** mentre gli ID ci sono, la function **rinvia** invece di scrivere
  "non si trova" su ogni attivita'.
- Il campo `riferimento_ordine` si riscrive solo se l'utente lo ha davvero
  modificato: confrontare col testo normalizzato faceva diventare "da chiedere a
  Ecotyre" in "DA, CHIEDERE, A, ECOTYRE" appena si apriva e si chiudeva la casella,
  e di quel campo non c'e' storico.

### La to-do list: i completati nella loro sezione (12/10/2026)

Parole dell'utente: «gli ordini della 'to-do list' quando sono completati vanno
spostati nella sezione completati e non solo evidenziati come tali». Prima
un'attivita' completata restava nell'elenco barrata e sbiadita, e una richiesta
ECT evasa stava nella tabella delle aperte con la targhetta verde.

- **Due parti per scheda.** Le attivita' (`src/components/todo/ElencoAttivita.jsx`)
  e le richieste ECT (`RichiesteEct.jsx` con `RichiesteCompletate.jsx`) hanno
  l'elenco DA FARE e, sotto, la sezione dei completati (`SezioneCompletati.jsx`):
  un `<details>` **chiuso all'apertura**, col numero, coi piu' recenti in alto e
  per ognuno il giorno e il perche'. Chi riapre torna fra i da fare.
- **La divisione non ricalcola niente** (`src/lib/todoSezioni.js`, senza import,
  si prova con node). Attivita': lo stato salvato (`completato`, a mano o da
  `controllaTodoOrdini`). Richieste: `esitoDellaPagina`, cioe' l'esito salvato, o
  `statoRichiesta` quando manca o e' il `da_confermare` di prima del 29/09/2026
  (per la regola di oggi e' evasa). All'apertura nessuna scrittura in piu'.
- **I numeri contano solo i da fare.** Attivita': «Da fare» (aperte + in corso),
  «Aperti», «In corso», e la pagina si apre su «Da fare». Richieste: «Da
  ritirare» e «Senza ID ordine». Non ci sono piu' «Tutti» con dentro le chiuse,
  «Completati», «Chiuse», «Tutte», «Da spuntare».
- **Il giorno del completamento.** Chiusa dal gestionale: `chiusa_dal_gestionale_il`
  e `chiusura_nota` (senza il prefisso: il giorno si dice una volta). Spuntata a
  mano: `completata_il` (`Todo.jsonc`), scritto da `campiCambioStato` quando
  l'amministratore la completa - spunta o targhetta - e tolto (null) quando la
  riapre; nient'altro si tocca. Una spunta di prima del 12/10/2026 non ha il
  giorno e si dice «non registrato»: **mai la data dell'ultima modifica**, perche'
  il controllo degli ordini riscrive anche le chiuse. Una richiesta ha il giorno
  del RITIRO (foglio o fine trasporto, regola 1), o della spunta se il ritiro
  non c'e'.
- **Le evase senza spunta stanno fra le completate**, ma aspettano la risposta al
  consorzio: si contano sull'intestazione della sezione, che si vede anche da
  chiusa (e' la voce `ect:da-rispondere` della dashboard), e la spunta si mette da
  li'. Tolta la spunta, una richiesta col ritiro resta fra le completate; una
  spuntata a mano senza ritiro torna da ritirare.
- Su un'attivita' completata `OrdiniAttivita` non ripete la nota della chiusura:
  la dice la riga della sezione.
- Un cambio di stato che non si salva si dice sulla pagina, non solo nella
  console. Prova: `prove/todoCompletati.mjs` (divisione, giorni, pagine disegnate
  con React lato server, sorgente).
- **Il numero nel menu** (decisioni dell'utente del 13/10/2026): accanto a
  «To-Do List» c'e' il «Da fare» della pagina. `contaDaFare`
  (`src/lib/todoSezioni.js`) fa una lettura filtrata sugli stati aperto e in
  corso, al massimo 500 righe, mai l'elenco intero, poi `conteggiAttivita(...)`.
  Si legge come gli altri contatori di `Layout.jsx`: all'avvio, ogni cinque
  minuti e una volta uscendo da /todo, mai a ogni pagina. «99+» oltre 99,
  nascosto a zero, e una lettura che cade lascia il numero com'era. La pagina
  manda il numero con `EVENTO_TODO` ({ detail: { da_fare } }) ogni volta che
  rilegge l'elenco (aperta, un'attivita' aggiunta, chiusa, riaperta, eliminata),
  senza letture, e solo con l'elenco intero: con 500 righe lette il suo conto
  potrebbe essere piu' basso di quello vero (chiusura del giro, 14/10/2026).
  Prova: `prove/menuTodo.mjs` (sezione 3 per la pagina).
- **«Scaduto» dal giorno dopo, sul giorno italiano** (`eScaduta(todo, oggi)` in
  `src/components/todo/ElencoAttivita.jsx`, difetto 34 del 15/10/2026).
  `data_scadenza` arriva dal campo data come 'AAAA-MM-GG' e si confronta come
  giorno con `oggiRoma()`. Mai `new Date(data_scadenza)`: la mezzanotte UTC e'
  l'una di notte italiana, e l'attivita' si diceva scaduta dall'una del giorno
  stesso. A video la scadenza si scrive gg/mm/aaaa direttamente dalla stringa.
  Prova: `prove/menuTodo.mjs`, sezione 4.

### La to-do list: i cancellati dal portale (14/10/2026)

Parole dell'utente: *«nella to-do list, qualora vi fossero degli ordini tra
quelli aperti che venissero non eseguiti e quindi terminati bensì cancellati a
portale devono comparire automaticamente nei cancellati con data di
cancellazione; a me non serve decidere sul gestionale ciò che è già chiaro ed
evidente sul portale»*.

- **Lo stato `cancellato`** (enum di `Todo.stato` in `base44/entities/Todo.jsonc`:
  senza quel valore l'aggiornamento poteva essere rifiutato dallo schema). Lo
  scrive solo `controllaTodoOrdini` (amministratore; agli altri `da_chiudere`),
  con `chiusa_dal_gestionale`, `chiusa_dal_gestionale_il` e `chiusura_nota`
  «cancellata dal gestionale il GG/MM/AAAA: l'ordine ET... (motivo) risulta
  cancellato a portale». Ordini tutti cancellati: fra i **Cancellati**
  (`src/components/todo/AttivitaCancellate.jsx`, sotto i completati, chiusa
  all'apertura, Riapri ed Elimina solo amministratore). Alcuni terminati e gli
  altri cancellati: completata, «evasa in parte». Un assegnato, un "eseguito", un
  terminato senza data o un ID che non si trova la tengono aperta.
- **Il passaggio vale anche per i cancellati** («ordini tra quelli aperti»): si
  chiude solo se il gestionale ha visto gli ordini aperti (`ordini_da_attendere`)
  e adesso non ne resta nessuno; il primo giro non chiude niente. Un'attivita'
  scritta su un ordine gia' cancellato resta da fare - parla d'altro: contestare
  la cancellazione, rifare l'ordine - e l'avviso dice perche' (`fermo` in
  `avvisoOrdini`). Senza questa regola spariva appena salvata, perche' la pagina
  la controlla subito (revisione del 14/10/2026). Eccezione di una volta sola:
  un'attivita' che porta ancora la domanda del gestionale di prima («che cosa
  farne lo decidi tu», `DOMANDA_DI_PRIMA`) coi suoi ordini tutti cancellati passa
  fra le cancellate; la domanda si toglie con la stessa scrittura.
- **Il giorno della cancellazione il portale non lo scrive.** `Ordine_chiuso_il`
  di un cancellato e' il clic su Chiudi di un trasporto gia' fatto (PRIMARIE del
  12/10/2026: 3 cancellati su 460, tutti con fine trasporto e FIR; copia dei dati
  veri dell'11/10: 3 su 452 di rete, 0 su 6 ACI). A video il giorno che si sa,
  per quello che e': «Passata fra le cancellate il ...» (`chiusa_dal_gestionale_il`)
  per le attivita', «Annullata da sola il ...» per le richieste (`visto_il` in
  `ordini_stato_json`, portato avanti dal salvato). Mai `ordine_chiuso_il` come
  giorno della cancellazione, e nessun campo `cancellata_il`.
- **Riaperta a mano** (Riapri porta ad `aperto`, mai alla spunta) non si
  ricancella con gli stessi ordini (con ordini diversi vedi «La to-do list:
  modifica e annotazioni»). Una cancellata il cui ordine il portale riassegna resta cancellata,
  e l'avviso dice «se serve ancora riaprila»; la riga del caricamento la dice fra
  le attivita' «gia' chiuse», non fra quelle che «restano aperte»
  (`testoControlloTodo`, `stato` in `da_guardare`).
- **I numeri.** Il «Da fare» della pagina, `EVENTO_TODO` e `contaDaFare` non
  contano le cancellate; l'elenco vuoto dice dove sono (`testoElencoVuoto`, usato
  da `ElencoAttivita.jsx`): con sole cancellate non dice piu' «Nessuna attività».
- **Le richieste ECT** (`richiesteEct.ts`): coi loro ordini tutti cancellati sono
  `annullata` da sole, con alcuni terminati e gli altri cancellati `evasa` in
  parte (da rispondere al consorzio; la voce `ect:da-rispondere` della dashboard
  lo dice con `evasaInParte`, invece di «gli ordini risultano tutti ritirati»).
  Chiuse cosi' (`chiusaDalPortale`) le puo' riaprire il portale riassegnando
  l'ordine: ogni caricamento delle primarie le ricalcola (`daRicalcolare` in
  `riconosciRitiriEct` di `importaBlocco`) e scrive PRIMA lo stato degli ordini e
  POI l'esito (`ordiniEdEsitoRichiesta`, la stessa del caricamento del foglio ECT).
  Al contrario l'esito restava indietro di un giro, e la pagina, la dashboard ed
  EcoTyna dicevano tre cose diverse: una richiesta col suo ordine cancellato
  restava salvata «aperta» e la dashboard la diceva oltre il termine.
  `esitoDellaPagina` rilegge le stesse richieste che `daRicalcolare` ricalcola.
  Lo schema `RichiestaEct.jsonc` lo dice: `visto_il` dei cancellati, `annullata`
  ed `evasa` anche dal portale, `da_confermare` solo prima del 29/09/2026.
- Prove: `prove/todoCancellatiDalPortale.mjs` (regola, sezioni, richieste, banco
  con `controllaTodoOrdini` e `importaRichiesteEct` veri, pagina montata e sezioni
  disegnate con React), `prove/todoOrdini.mjs`, e
  `prove/cancellatiDalPortaleAgganci.mjs` per gli agganci fuori dalla regola: gli
  schemi, il ricalcolo dopo le primarie sul banco con `importaBlocco` vero, la
  voce della dashboard, l'elenco vuoto disegnato con React.

### Le richieste ECT: il foglio del 09/10/2026 e il cambio d'anno (15/10/2026)

Dalla prova generale del cambio d'anno (difetti 10, 3 e 2) e dalla sua revisione.
Il foglio del 09/10/2026 non si caricava; a gennaio le richieste di dicembre
sparivano da dashboard, To-Do List e ricalcolo dopo le primarie; ricaricato a
gennaio, il foglio rifaceva le richieste di dicembre come doppioni senza spunta.

- **Le colonne si leggono dall'intestazione** (`colonneFoglio` in
  `base44/shared/richiesteEct.ts`, specchio `src/lib/richiesteEct.js`). Il foglio
  del 09/10/2026 ha «numero d'ordine» dopo la provincia: letto per posizione,
  ogni riga passava per intestazione e il caricamento diceva «non contiene
  richieste». Nelle righe in cima, fino a quella con «ordine immesso», si cercano
  provincia, numero d'ordine, ordine immesso, ordine evaso, trasportatore e mail.
  La nota e' la prima colonna senza titolo dopo queste. Senza intestazione vale
  l'ordine di prima (`COLONNE_DI_PRIMA`). Una riga con l'ID ma senza immissione e'
  una richiesta. Il file vero del 09/10/2026 ne ha 56, 13 con l'ID (l'area arriva
  alla riga 67, ma le ultime otto righe sono vuote).
- **L'ID del foglio vale come scritto a mano** (`idOrdiniDelFoglio`: maiuscolo,
  separato da virgole, forma `^[A-Z]{2,4}\d{6,}$` come nella to-do list). Va in
  `id_ordine_manuale` solo se nel gestionale non ce n'e' gia' uno e solo se TUTTI i
  suoi ordini sono fra assegnati e primarie. Il motivo: un ID scritto male, preso
  una volta, non si correggeva piu' dal foglio, perche' lo schema non dice da
  dove viene un ID a mano. La risposta di `importaRichiesteEct` ha `id_dal_foglio`,
  `id_del_foglio_non_trovati` e `id_diversi_dal_foglio` (con `gestionale_trovato`),
  e la pagina li scrive. Un ordine nuovo si prende ricaricando il foglio dopo le
  primarie. Resta un caso: un ID scritto male che coincide con un altro ordine
  vero, una volta preso, vale come scritto a mano anche se il foglio poi lo
  corregge; per chiuderlo serve un campo nello schema che dica da dove viene
  `id_ordine_manuale`.
- **Ogni richiesta ha il suo anno**: quello della mail, o dell'immissione se la
  mail manca (`annoRichiesta`). Mai un anno solo per tutto il foglio. Le richieste
  salvate si leggono tutte con una lettura sola, senza filtro, e si abbinano
  quelle degli anni che il foglio porta. Il terzo passaggio di `abbinaRichieste`
  (riga e produttore) vale solo nello stesso anno; fra due gemelle vince quella
  con lo stesso ordine.
- **Il termine senza anno si legge dalla mail** (`scadenzaDaNota(nota,
  giornoDellaMail)`): e' il primo giorno o mese che non viene prima della mail.
  L'anno dopo vale solo entro 183 giorni dalla mail (`GIORNI_TERMINE_AVANTI`).
  Mail del 18/12/2026: «entro il 10/01» = 10/01/2027, «entro gennaio» =
  31/01/2027. Mail del 12/09: «entro l'11/09» resta l'11/09, cioe' oltre il
  termine. Un anno scritto nella nota vale com'e'; con un numero al posto della
  mail vale la regola di prima. Il termine corretto a mano dall'amministratore
  (`scadenza_manuale`, 15/10/2026) vale sopra quello della nota e nessun
  caricamento lo tocca, nemmeno a cavallo dell'anno: vedi «La to-do list:
  modifica e annotazioni».
- **Le richieste da seguire non finiscono il 31/12** (`richiesteDaSeguire(richieste,
  anno)`): quelle dell'anno, piu' quelle degli anni prima ancora aperte,
  `da_confermare` o evase senza spunta (`ancoraDaSeguire`). La usano
  `cruscottoOperativo` e `riconosciRitiriEct` (`importaBlocco`), ognuno con UNA
  lettura di `RichiestaEct` senza filtro d'anno (48-64 richieste l'anno). Mai
  piu' `filter({ anno })` sulle richieste.
- **Il ricalcolo dopo le primarie** guarda anche le richieste degli anni prima
  chiuse dal portale, ma le riapre solo con una prova in positivo
  (`riapertaDalPortale`: un ordine visto cancellato e' di nuovo nell'archivio e non
  e' cancellato). Un cancellato uscito dal file del portale e' «sconosciuto», e
  non deve riaprire una richiesta di due anni prima.
- **La To-Do List** usa `richiesteDellaTodo`: le richieste da seguire, piu' quelle
  degli anni prima chiuse quest'anno (`chiusaNellAnno`: spuntate quest'anno, o
  viste cancellate quest'anno). Cosi' una richiesta di dicembre spuntata a
  gennaio resta fra le completate, e la spunta si puo' togliere. Sulla riga da
  fare e, dalla chiusura del giro, sulla scheda fra le completate
  (`RichiesteCompletate.jsx`) compare «richiesta del 2026» quando l'anno non e'
  quello di oggi. `evasione_confermata_il` e `visto_il` sono gia' giorni italiani
  (la pagina scrive la spunta col giorno di Roma, il caricamento `oggiRoma()`):
  tagliarne l'anno e' giusto.
- **EcoTyna** (lo strumento `richieste_ect`, vedi «L'anno di cui parla EcoTyna»)
  fa la stessa regola, scritta per conto suo: se cambia qui, va cambiata anche
  li'.
- Prove: `prove/richiesteEct.mjs` (le due impaginazioni; il file vero in sola
  lettura, se c'e'; gli anni col banco di `importaRichiesteEct`; `importaBlocco`
  vero per `ritiri_ect`; i tre casi della revisione), `prove/cruscotto.mjs`
  («IL CAMBIO D'ANNO IN DA GESTIRE») e `prove/cambioAnnoRitocchi.mjs` (7).

### La to-do list: modifica e annotazioni (15/10/2026)

Parole dell'utente: *«nella to-do list permetti la modifica delle richieste aperte per successive integrazioni e\o annotazioni»*. «Richieste aperte» sono le voci ancora da fare delle due schede: le attivita' aperte o in corso e le richieste ECT non chiuse.

- **Modifica** (matita, solo amministratore, su ogni attivita' da fare, anche una vecchia senza stato salvato). Al posto della riga si apre lo stesso modulo del «Nuovo To-Do» (`src/components/todo/ModuloAttivita.jsx`), gia' compilato (`valoriDelModulo`). Si scrivono SOLO i campi cambiati (`campiModificaAttivita` in `src/lib/todoSezioni.js`): titolo, descrizione, categoria, priorita', scadenza (tolta = null) e ordini. Gli ordini hanno la regola della casella della riga: soli ID in maiuscolo separati da virgole, una frase com'e', il campo non toccato non si riscrive. Mai lo stato, la spunta, gli ordini attesi o le annotazioni. Cambiati gli ordini, la pagina rilancia subito `controllaTodoOrdini`, come alla creazione. Una completata o una cancellata si modifica dopo Riapri. Todo non e' in `CAMPI_TRACCIATI`: scrittura diretta.
- **Ordini diversi su una riaperta** (revisione del 15/10/2026). Un'attivita' chiusa dal gestionale e riaperta non si richiude con gli STESSI ordini. Se chi l'ha riaperta ci scrive ordini DIVERSI (dalla modifica o dalla casella della riga), `campiOrdiniNuovi` scrive anche `chiusa_dal_gestionale: false`: i nuovi ordini si guardano come su un'attivita' nuova (il primo giro guarda, il passaggio chiude o manda fra le cancellate). Prima il passaggio si consumava senza chiudere, l'attivita' restava aperta per sempre e il modulo prometteva il contrario. La nota della chiusura di prima resta in `chiusura_nota`, ma la seconda chiusura la riscriverebbe: la pagina la copia in un'annotazione (`notaOrdiniNuovi`) con la STESSA scrittura (`scriviAnnotazioni(archivio, id, cambia, altri)`: una get e un update, solo in quel caso). Non tolgono il segno: lo stesso elenco riscritto in un altro ordine, gli ordini tolti, una frase senza ID. Il modulo lo dice (`chiusaDalGestionale`).
- **Annotazioni.** Campo `annotazioni` in `Todo.jsonc` e `RichiestaEct.jsonc`: un elenco con lo schema di ogni riga (id, testo, scritta_il, scritta_da, corretta_il, corretta_da, testo_originale). Le regole stanno in `src/lib/annotazioni.js`, senza import. Si accodano senza toccare le altre, col giorno e l'ora italiani e l'email di chi e' collegato. Una correzione dice «corretta il gg/mm/aaaa alle hh:mm», e il testo della prima volta resta in `testo_originale`. `scriviAnnotazioni` RILEGGE il record, scrive solo quel campo (piu' gli `altri` dati) e rifiuta un elenco che perderebbe una riga. A video (`Annotazioni.jsx`) le ultime due e «tutte (N)». Si leggono anche sulle completate, sulle cancellate e sulle richieste completate. Chi scrive lo mette la pagina in `ScrittureTodo` (`scrittureTodo.js`), solo per l'amministratore. Nessuna lettura all'apertura.
- **Richieste ECT.** `NoteRichiesta.jsx` sta nella colonna del produttore (ferma a sinistra a 375 px): nota interna (`note_interne`), termine corretto a mano e annotazioni. Il caricamento del foglio (`importaRichiesteEct`), il ricalcolo dei ritiri (`importaBlocco`, ritiri_ect) e `controllaTodoOrdini` scrivono solo i loro campi: annotazioni, note_interne e id_ordine_manuale restano. Resta anche `scadenza_manuale` (il termine corretto a mano, punto sotto).
- **Il termine delle richieste ECT si corregge a mano** (15/10/2026). Campo `scadenza_manuale` (date) in `RichiestaEct.jsonc`: quando c'e' vale lui, null = torna il termine del foglio (`scadenza`, che `importaRichiesteEct` ricalcola dalla nota a ogni caricamento con `scadenzaDaNota`). Il caricamento del foglio e il ricalcolo dei ritiri (`importaBlocco`, ritiri_ect) non lo nominano MAI, nemmeno in un commento, come `id_ordine_manuale`. Il termine si legge solo dalla regola (`termineRichiesta`, `scadenzaDi`, `testoTermine`, `oltreIlTermine` in `base44/shared/richiesteEct.ts`, specchio `src/lib/richiesteEct.js`), mai da `r.scadenza`: colonna «Entro», conto e ordine «in ritardo» della To-Do List, completate, voce «richieste del consorzio oltre il termine» della dashboard (`cruscotto.ts`), strumento `richieste_ect` di EcoTyna (`scadenza_corretta_a_mano`, `scadenza_dal_foglio`, `nota_termini_corretti`). `statoRichiesta` non legge il termine. Il campo sta in `NoteRichiesta.jsx` («Correggi il termine», solo amministratore, solo richieste aperte); scrive la scheda (`RichiesteEct.jsx`, `salvaTermine`): una update, nessuna lettura, la riga si aggiorna in locale. A video «entro il gg/mm/aaaa (corretto a mano; dal foglio: gg/mm/aaaa)» o «(corretto a mano; il foglio non ne dice uno)». La rls dell'archivio e' quella di prima: create, update e delete solo per l'amministratore.
- **Il giorno del foglio non e' una correzione** (revisione del 15/10/2026). `correzioneDelTermine(r, giorno)`: vuoto o uguale al termine del foglio = null. Il campo si apre col termine che vale: aperto e salvato senza toccare niente non scrive niente, come la modifica delle attivita'. Prima scriveva il giorno del foglio in `scadenza_manuale`: il termine restava «corretto a mano» e bloccato, e col foglio ricaricato dopo un sollecito («entro il 12/10») la richiesta non risultava in ritardo ne' in pagina ne' in dashboard ne' in EcoTyna. La regola la usano sia il campo sia chi scrive (`salvaTermine`), cosi' in archivio non entra mai una correzione uguale al foglio.
- **La pagina non toglie l'elenco quando rilegge** (revisione del 15/10/2026). «Caricamento...» compare solo alla prima lettura. Alle riletture l'elenco resta montato con «Aggiorno l'elenco…», perche' dentro ci sono il modulo della modifica e i campi delle annotazioni: togliendolo, il testo non salvato spariva.
- Prove: `prove/todoModificaAnnotazioni.mjs` (179 verifiche; sezione 3 sul banco con le funzioni vere e la loro controprova) e, per il termine, `prove/termineRichiesteEct.mjs` (107 verifiche: banco con `importaRichiesteEct` e `importaBlocco` veri, anche a cavallo dell'anno, e la controprova).

### EcoTyna: le domande sui dati non sono domande di norma (29/09/2026)

L'utente si era lamentato: *"ogni volta che chiedo qualcosa ad Ecotyna riguardo la
commessa non mi risponde in maniera puntuale ... ma e' generica e mi invia link
presi online"*. Le cause erano quattro, tutte nel modo in cui l'assistente era
istruita, e sono state misurate sul codice:

1. **La ricerca online non si decide a parole chiave.** `PAROLE_NORMA`
   (`base44/shared/assistente.ts`) contiene il vocabolario del mestiere
   (*formulari, classe, trasporto, registro, serve, posso*) e frammenti che si
   incastrano dentro altre parole (*cer* in "cerca", *adr* in "quadratura"), e la
   regola `norma: norma || !dati` accendeva la ricerca ogni volta che non
   riconosceva una parola-dati. Adesso decide il pianificatore con
   **`serve_normativa`** (`base44/shared/pianoAssistente.ts`): se ha preso i
   numeri dagli strumenti e dice che la norma non c'entra, non si cerca online e
   non si caricano le schede del corso RT. Il campo **non e' obbligatorio e la
   mancanza vale "serve"**: si sbaglia dal lato delle fonti, perche' una risposta
   normativa senza fonti e' un danno e un link di troppo su un numero e' un
   fastidio.
2. **Lo schema senza fonti.** Su una domanda sui dati si usa
   `SCHEMA_RISPOSTA_DATI`, che non ha i campi `fonti` e `novita_normative`: un
   campo che c'e' il modello lo riempie, e riempirlo lo porta nel registro del
   consulente che cita invece che del responsabile tecnico che risponde. E' l'unico
   modo di spegnere i link alla radice.
3. **Il prompt a due voci.** Con `soloDati` escono `REGOLE_FONTI`, la regola del
   controllo online, quella su Normattiva e quella sul corso RT, ed entrano sei
   righe (l'inquadramento e le cinque regole da D a D-quinquies) su come si
   risponde a un numero: il numero
   nella prima frase, in italiano naturale (regola T, 11/10/2026), con la sua
   etichetta (soggetto, canale, periodo), niente
   premesse, niente consigli non chiesti. **Le regole che tengono onesti i numeri
   restano tutte**: i canali che non si sommano, il periodo attaccato
   all'etichetta, gli elenchi che non si contano a occhio, le date obbligatorie.
4. **Il nome del fornitore.** `risolviNome`
   (`base44/shared/normalizzaRagioneSociale.ts`) riconosce il nome scritto come
   capita: uguale, abbreviazione, contenimento, e il confronto senza spazi perche'
   togliendo i punti "ECO.GEA" diventa "ecogea". Prima il filtro dentro
   `movimenti()` pretendeva il nome identico e "Silvano" contro "SILVANO RENATO"
   dava **zero righe, che uscivano come "ha raccolto 0,00 t"**. Se i nomi che
   corrispondono sono piu' d'uno **non si sceglie**: si dichiara l'ambiguita' e si
   chiede il nome per esteso, perche' in archivio ci sono davvero SILVANO RENATO e
   SILVANO TRASPORTI SRL, e sommarli darebbe un numero che sembra giusto.

**Le regole da non perdere:**

- **Zero non e' "non lo so".** Quando uno strumento non risolve un soggetto,
  `tonnellate` e `formulari` sono `null`, arriva `avviso_soggetto` e il prompt
  vieta di scrivere un numero per quel soggetto. Lo stesso vale per il riepilogo:
  `provaA` registra le letture non riuscite in `guasti`, che finiscono **in cima**
  al testo, e dove il dato manca si scrive `n/d`, non `0,00 t`.
- **Un intervallo di mesi si apre tutto.** `mesiChiesti`
  (`base44/shared/strumentiAssistente.ts`) legge elenchi e intervalli: "da marzo a
  maggio" sono tre mesi, non due. Un intervallo a cavallo del capodanno non si
  indovina - invertirlo darebbe undici mesi al posto di tre - e si dice che non si
  e' capito. Prima "nei mesi di luglio e agosto" diventava in silenzio tutto
  l'anno.
- **La riserva degli "eseguito" si dice sempre.** `movimenti()` legge i terminati
  e, con una lettura sua, gli ordini in stato "eseguito" dello stesso canale,
  luogo e periodo: `riservaEseguiti` li restituisce in `riserva_eseguiti` e la
  regola **D-quinquies** del prompt obbliga a dirli in una riga dopo il numero.
  **Non si sommano al totale** (il raccolto sono i terminati) **e non si
  tacciono**: un ordine nel limbo e' materiale davvero ritirato, e il 24/09/2026
  ne bastava uno per far dire 8.164,18 t dove il file diceva 8.167,80. Se quella
  seconda lettura non riesce, il totale si dice comunque e la riserva si dichiara
  `lettura_non_riuscita`: e' il totale che non deve mai mentire. I nomi dei
  raccoglitori si riconoscono sui terminati **e** sugli "eseguito", altrimenti a
  chi ha solo ordini nel limbo si risponderebbe "non risulta fra i raccoglitori".
  Vale anche per `target_raccoglitori`, dove la riserva fa sembrare un
  raccoglitore piu' indietro di quanto sia. Prove in `prove/riservaEseguiti.mjs`.
- **I numeri si scrivono all'italiana** (utente, 10/10/2026). I dati arrivano al
  modello come numeri informatici e a volte li ricopiava («1600.00 euro per 3.38
  t»). La regola e' nelle istruzioni (3-duodecies) e la risposta passa da
  `numeriAllItaliana` (`shared/formato.ts`), che converte SOLO l'inequivocabile:
  un numero con un'unita' (t, kg, euro, €, %), col punto decimale e una o due
  cifre (o quattro e piu'), o con la virgola delle migliaia, o intero lungo.
  Decimali come vuole l'utente: fino a tre se servono e sono significativi,
  tonnellate almeno due, euro sempre due, niente zeri inutili in coda. «3.385 t»
  (tre o tremila?) si decide coi numeri che EcoTyna ha ricevuto (`numeriDeiDati`);
  senza, resta com'e'. Ore, date e numeri d'ordine non si toccano. Prova:
  `prove/numeriEcotyna.mjs`. E un filtro gia' messo col nome vicino (Green Tyre
  come raccoglitore e come fornitore) non e' un filtro ignorato.
  Nemmeno un filtro che lo strumento fa gia' da se' (`impliciti` nel catalogo:
  il raccolto e' sempre raccolta, le giacenze escono per canale, target e
  predittivita' sono solo rete): sulle risposte del 10/10 compariva «non filtrato
  per la prestazione» e «non distingue per canale» su numeri giusti.
  E raggruppare non e' filtrare: `raggruppa` non finisce mai fra gli ignorati.
- **Le date si scrivono gg/mm/aaaa** (utente, 10/10/2026). Regola 3-terdecies nelle
  istruzioni e `dateAllItaliana` sulla risposta (`testoAllItaliana` fa numeri e
  date): 2026-10-05 diventa 05/10/2026, un istante col suo orario diventa il
  giorno italiano (giornoRoma), le date dentro nomi di file e codici restano.
- **La fatturazione si calcola, non si legge** (audit del 10/10/2026). Lo
  strumento `fatturazione` fa lo stesso conto del modulo sui movimenti di oggi,
  attiva e passiva, col mese o senza: senza mese, mese per mese fino a quello in
  corso, con gli archivi letti una volta (`passivaSuiDatiDiOggi`). Le voci dei
  documenti salvati della passiva non esistono - il modulo calcola e non salva -
  e leggendo quelle, a «quanto abbiamo pagato a Green Tyre quest'anno», EcoTyna
  rispondeva «nessun importo». Il numero dell'anno e' lo stesso dei mesi del
  modulo sommati e del costo del margine: `prove/passivaDiEcotyna.mjs`.
  Accetta anche **piu' mesi** (`mesi`, letti con `mesiChiesti` come nel
  raccolto), e il pianificatore legge **«da gennaio a oggi»** come l'anno fino a
  oggi: nominava un mese, e la regola che toglie il mese alle domande sull'anno
  non scattava. Visto in produzione il 10/10/2026, subito dopo la correzione:
  ottobre al posto dell'anno, e «il cumulativo non e' disponibile».
- **Gli strumenti usano le regole dei moduli, non le loro** (chiusura
  dell'audit, 11/10/2026). Ogni strumento di
  `base44/shared/strumentiAssistente.ts` che dice lo stato di qualcosa lo prende
  dalla stessa funzione del modulo: una copia, anche identica il giorno in cui
  la si scrive, diventa una seconda regola appena il modulo si corregge.
  - `caricamenti`: legge il registro con `leggiRegistro` e lo giudica con
    `statoDelRegistro`, come la dashboard. L'ultimo caricamento e' l'ultimo
    riuscito; quello che lascia un archivio a meta' (in corso, interrotto, non
    riuscito) esce in `caricamenti_da_ripetere_o_in_corso` col testo di
    `avvisoCaricamento`, e la regola 3-quindecies del prompt obbliga a dirlo. Il
    «fino al» e' `datiFinoAl` (`statoArchivi.ts`), la lettura della dashboard:
    per il report delle dichiarazioni contano solo le righe SMOCO
    (`nostraRiga`), quindi una dichiarazione di Baucina piu' recente non sposta
    la data, e se fra le ultime mille righe non ce n'e' nessuna nostra lo dice
    invece di chiamare vuoto l'archivio. Prima una riscrittura «parziale» del
    09/10 passava per «primarie caricate il 09/10», mentre la dashboard diceva
    «ricarica il file». Prova: `prove/caricamentiFinoAl.mjs`, che confronta lo
    strumento con `freschezzaArchivi`.
  - `tariffe`: legge tutte le tariffe, non solo quelle con stato 'attivo'; la
    validita' la decidono `tariffaNonDisattivata` e `tariffaValeIl`
    (`validitaTariffa.ts`). Una 'non_attivo' e' «disattivata, non vale mai» e va
    in fondo all'elenco. Prova: `prove/strumentiTariffe.mjs`.
  - `dichiarazioni_impianti`: legge con `leggiDichiarazioni`. Di una gemella di
    rete o di ACI si conta la prima e si dice il doppione; due campagne di extra
    raccolta si sommano. Il sito e' normalizzato. `caricato_a_portale` e' quello
    che decurta la giacenza a portale: per ACI ed extra raccolta e' il
    dichiarato delle Giacenze e di Dichiarazioni Impianti; per la rete coincide
    col dichiarato caricato di Dichiarazioni Impianti, mentre il «dichiarato
    nell'anno» delle Giacenze viene dal report del portale, contato per fine
    trasporto, e puo' differire (una nave che aggancia carichi dell'anno prima,
    un report scaricato prima del caricamento). La nota dello strumento lo dice,
    e la differenza va detta, non nascosta. Prova:
    `prove/strumentiDichiarazioniImpianti.mjs`.
  - `giacenze`: passa anche `secondarie_extra_in_t` e `secondarie_extra_out_t`,
    perche' `conferito_extra_t` sono le sole primarie, e `dichiarato_aci_t` e
    `dichiarato_extra_t` (null sui piazzali, che non dichiarano). **Impianti e
    stoccaggi sono due numeri**: dal 03/10 anche gli impianti hanno la giacenza
    ACI e quella di extra raccolta (apertura + arrivato - dichiarato), e il
    riepilogo della commessa chiamava «ACI negli stoccaggi» il totale di tutti i
    siti mentre lo strumento sommava i soli stoccaggi, 10 t contro 3 sulla
    stessa domanda. Ora tutti e due scrivono «impianti X t, stoccaggi Y t»,
    rifatti sulle righe. Prova: `prove/assistenteGiacenzeCanali.mjs`, sulla
    funzione vera. Dal 14/10/2026 passa anche l'attesa per noi chiusa e i
    totali con `totaleGiacenze` («—» col perche' quando una riga non ha il
    numero), e il perche' di un anno prima del gestionale una volta sola, in
    `avviso_anno`: punto 24 di «Giacenze e Dichiarazioni: lo stesso numero».
  - `riepilogo_dichiarazioni`: **quanto resta da dichiarare lo dice la pagina
    Dichiarazioni**. Lo strumento chiama `riepilogoDichiarazioni` col client di
    chi chiede, una volta per domanda (`ctx.leggi`), e per ogni impianto passa i
    flussi con `resta_t` e `apertura_t`, i `mesi_aperti`, la quadratura col
    portale (`scarto_t`, `quadra`), i doppioni e le dichiarazioni che il portale
    ha e noi no. In testa a `mesi_aperti` c'e' la voce «dall'anno prima»
    (`dall_anno_prima` vero), cosi' la somma dei mesi aperti fa `resta_t`; il
    conto apertura + arrivato - dichiarato si chiude sul canale, non sulla riga,
    perche' l'ACI puo' avere due righe. Per la rete di chi per accordo non la
    dichiara `resta_t` e' vuoto, mai zero, e la regola 3-quaterdecies del prompt
    dice di scrivere «—» col perche'. Per un anno chiuso passa `anno_chiuso`,
    `portale_al` (il 31/12) e il perche' della pagina, non la data della
    fotografia di oggi. Esce gia' diviso per canale: il canale non e' un suo
    parametro (`impliciti`), cosi' il pianificatore non lo chiama tre volte, e
    lo sceglie per «quanto resta da dichiarare a X». Prova:
    `prove/strumentiRiepilogoDichiarazioni.mjs`, che controlla anche che
    `resta_t` sia la giacenza di rete dello strumento giacenze.
- **Il riepilogo della commessa conta come la Dashboard** (11/10/2026).
  `situazioneGestionale` (`assistente.ts`) sceglie il contratto con
  `commessaDellAnno`, cioe' il modificato per ultimo e non il primo restituito.
  Target annuo e riparto li prende con `targetAnnuoDellAnno` e
  `regioniDellAnno`, col ripiego 2025-2026 detto come tale. Quota attesa e
  atteso per regione li conta con `attesoAllaData` sul giorno dei dati: l'ultima
  fine trasporto di un ritiro RETE terminato, letta con
  `datiFinoAl(svc, ['PrimariaRete'])` e mai oltre oggi (`giornoDeiDati`). Prima
  prendeva `commesse[0]` e contava sul calendario: 11.000 t e 80,8% dove la
  Dashboard diceva 11.550 t e 79,7%. Senza il giorno dei dati l'atteso non si
  inventa: «non calcolabile», col motivo. La frase resta «quota attesa a oggi
  N%», seguita da «fino al gg/mm/aaaa». Prova:
  `prove/assistenteAttesoContratto.mjs`, contro la Dashboard vera. Dal
  14/10/2026 l'atteso di una regione e' `attesoDellaRegione`, e sotto la riga
  del contratto c'e' quella delle variazioni del consorzio in vigore
  (`testoVariazioni`): vedi «Le variazioni del contratto in corso d'anno».
  Le giacenze senza un numero («RETE: —» col perche', mai 0,00) e lo strumento
  `giacenze` che dice il perche' dell'anno una volta sola: punto 24 di
  «Giacenze e Dichiarazioni: lo stesso numero».
- **Il contratto lo dice `contratto_ecotyre`** (variazione del contratto,
  14/10/2026). Registrata la variazione di ottobre, a *«Qual è oggi il target
  annuo 2026 del contratto Ecotyre sulla rete, e com'è messa la Puglia rispetto
  all'atteso?»* il pianificatore sceglieva `target_raccoglitori`, che il
  contratto non lo legge: «11.650,00 t, come risulta dal modulo Target &
  Status» era la somma dei target dei raccoglitori (quel giorno uguale per
  caso; prima della variazione 11.650 contro 11.550), e sulla Puglia il dato
  «non è filtrato per area geografica». Con gli strumenti che rispondono,
  `chiediAssistente` non legge il riepilogo `situazioneGestionale`, che le
  regioni le ha.
  - **I numeri sono quelli della dashboard.** `contratto_ecotyre`
    (`strumentiAssistente.ts`) da' target annuo del contratto, raccolto, % del
    target, atteso alla data e scarto, residuo, proiezione, ritmo, le regioni
    (contratto, di cui variazioni, atteso, raccolto, scarto, %), le variazioni
    in vigore e superate a parole (`testoVariazioni` e
    `testoVariazioniSuperate` di `assistente.ts`) e i mesi chiesti; dice
    `regioni_di_ripiego` quando il riparto e' il ripiego, che la dashboard
    mostra senza dirlo. Li conta `contrattoDellaRete`
    (`base44/shared/contrattoRete.ts`), piu' `quadroRete` di
    `quadroCommessa.ts`; nessuna lettura per regione.
    **Dal 14/10/2026 e' una regola sola** (migliorie, gruppo H-2): il
    contratto della rete (target annuo, raccolto, atteso alla data, scarto,
    regioni con le variazioni, avvisi del target) lo conta
    `contrattoReteDegliAnni`, che `getDashboardRaccolta` chiama con gli anni
    del filtro e `contrattoDellaRete` con un anno. La dashboard non ha piu'
    regole del contratto sue: una regola nuova sul contratto si scrive in
    `contrattoRete.ts`, una volta. `prove/ecotynaContratto.mjs` confronta
    ancora EcoTyna con la funzione vera campo per campo, ma con una regola
    sola i due lati cambiano insieme e quel confronto non vede un cambio della
    regola comune: lo vede `prove/dashboardContrattoUnaRegola.mjs`, che fa
    girare la funzione di oggi contro quella del commit 5939d15 (git show) su
    21 casi costruiti e sui dati veri, prima e dopo la variazione di ottobre,
    2025, 2026 e 2027. Richiede la risposta intera identica al carattere e le
    stesse letture, archivio per archivio. Se la regola del contratto cambia
    apposta, il riferimento si sposta sul commit di quel cambio, come in
    `prove/dashboardDatiVeri.mjs`.
  - **`target_raccoglitori` non e' il contratto.** `somma_target_raccoglitori_t`
    (prima `target_totale_t`) e' la somma dei raccoglitori; il contratto c'e'
    accanto (blocco `contratto_ecotyre`), e `nota_livelli` spiega i due
    livelli. Le differenze raccoglitori meno contratto si calcolano solo contro
    il contratto vero, come la scheda e il cruscotto
    (`vociContrattoRaccoglitori`): il totale solo con `fonte_target`
    'contratto', le regioni solo con `fonte_regioni` 'contratto', e solo se ci
    sono i target dei raccoglitori dell'anno (senza, la differenza era
    -11.650). Altrimenti `confronto_col_contratto_perche` dice perche'. Una
    differenza col ripiego non e' una variazione da registrare.
  - **Con la regione chiesta**, ogni raccoglitore porta `nella_regione_chiesta`
    (target, fatto, residuo, %), e sono quelli i numeri da dire. Il fatto per
    regione dei raccoglitori segue l'Andamento: regione della provincia, poi
    «Altro». Il raccolto per regione del contratto segue invece la dashboard:
    campo regione, poi provincia (`regioneDellaDashboard`). Ognuno e' lo
    specchio del suo modulo. Sui dati veri dell'11/10 le due regole danno gli
    stessi numeri (0 righe diverse su 10.035).
  - **Il giorno dell'atteso e' `atteso_alla_data.al`.** `dati_fino_al` dello
    strumento e' il giorno della misura della dashboard (`giornoDellaMisura`):
    il 31/12 per un anno chiuso (con `anno_chiuso`), mai l'ultima fine
    trasporto dell'anno dopo; null per un anno senza ritiri.
  - **La scelta dello strumento.** Nel catalogo `contratto_ecotyre` sta prima
    di `target_raccoglitori`, con le parole delle domande (contratto, target
    annuo, atteso, regione, «come stiamo»), e `target_raccoglitori` rimanda a
    lui. Fra le regole del pianificatore (`istruzioniPiano` di
    `pianoAssistente.ts`, chiusura del giro) c'e' quella esplicita: contratto,
    target annuo, atteso, scarto, una regione rispetto al contratto o «come
    stiamo» vanno a `contratto_ecotyre`; `target_raccoglitori` solo per i
    singoli raccoglitori. La regola 3-septdecies delle istruzioni della
    risposta (`chiediAssistente`) dice quali numeri dire e con che giorno. In
    chat lo strumento si chiama «Contratto Ecotyre» (`ETICHETTE_STRUMENTO`).
  Prove: `prove/ecotynaContratto.mjs`; `prove/pianoContrattoEcotyre.mjs` (la
  scelta la fa il modello, quindi si prova il testo che gli arriva);
  `prove/assistentePagina.mjs` per l'etichetta.
- **Un nome solo, EcoTyna**, nel menu, nel titolo della pagina e in tutti i
  testi a video (prima «Assistente» e «Chiedi all'Assistente»). Nell'elenco dei
  moduli di una richiesta 'Assistente' e' il valore che si salva, e resta:
  cambia solo l'etichetta (`prove/nomeEcotynaAVideo.mjs`).
  `/assistente?domanda=...` scrive la domanda nella casella e **non la invia**:
  la manda l'utente, e il parametro esce dall'indirizzo. E' il collegamento da
  usare per un «Chiedi perche'» da un'altra pagina. `prove/assistentePagina.mjs`
  controlla anche che ogni strumento abbia la sua etichetta in
  `ETICHETTE_STRUMENTO` (`ChatAssistente.jsx`): chi aggiunge uno strumento
  aggiunge l'etichetta.
- **EcoTyna non dichiara certezze che non ha** (segnalazioni alte A71, A72 e A76
  del 20/09, corrette il 12/10/2026; l'utente aveva chiesto un'EcoTyna «piu'
  realistica»).
  - *La data di verifica di una fonte la mette il gestionale, non il modello.*
    `fontiDellaRisposta` (`base44/shared/baseConoscenza.ts`) scrive
    `verificato_il` e `voce` solo se la fonte e' quella di una voce della base di
    conoscenza. Vale cosi': stessi estremi dell'atto e articoli che la voce cita
    tutti (la voce sul FIR, art. 193, non ha verificato l'art. 258); la stessa
    pagina per un indirizzo; tutte le parole per le regole della direzione e le
    FAQ. La data e' quella della voce o del suo aggiornamento approvato; fra piu'
    voci vale la verifica piu' vecchia. Prima ogni fonte senza data prendeva
    d'ufficio il 14/09/2026 (`VERIFICATO_IL`). Lo schema della risposta non ha
    piu' `verificato_il`, perche' un campo che c'e' il modello lo riempie. Ha
    invece `voce_id`, un suggerimento che vale solo se la fonte e' davvero quella
    voce. La chat scrive «(base di conoscenza, verificata il gg/mm/aaaa)» solo
    con `voce`.
  - *Una fonte e' di una voce solo se lo e' davvero* (revisione del 13/10/2026).
    La pagina principale di un sito (rentri.gov.it,
    albonazionalegestoriambientali.it, pneumaticifuoriuso.it, che il prompt
    stesso da' al modello) non basta. Serve anche un atto o un articolo che la
    voce cita, o una parola del titolo della voce che non sia il nome del sito
    (`confermaDelSito`). Un articolo che la voce non cita non prende la data,
    nemmeno se la voce cita l'atto senza articoli (DM 59/2023 art. 21). Una fonte
    con una data successiva alla verifica della voce non e' di quella voce
    (`dopoLaVerifica`), salvo che la data la scriva la voce stessa. Il `voce_id`
    del modello vale solo se tutte le parole della fonte stanno nel titolo della
    voce (`eLaVoce`): «Linee guida ISPRA sul formulario» non e' la voce
    «Formulario e microraccolta». Prima la FAQ RENTRI del 02/10/2026 scritta con
    l'indirizzo del sito usciva «verificata il 14/09/2026».
    Il titolo o l'id della voce nella fonte non bastano se la fonte cita atti o
    articoli che la voce non cita (`attiDellaVoce`, lo stesso controllo di
    `stessaFonte`, usato anche da `confermaDelSito`). Il prompt mostra le voci per
    titolo, e «Chi si iscrive al RENTRI - DM 59/2023 art. 21» prendeva il
    14/09/2026 (seconda revisione del 13/10/2026). `dateScritte` legge la data
    in ogni notazione: gg/mm/aaaa, gg.mm.aaaa, gg-mm-aaaa, l'anno a due cifre
    («02/10/26»; dal 70 in su e' del Novecento, «5.2.98» e' il 1998 e non il
    2098), il mese per esteso o abbreviato («2 ott. 2026», «sett.», «genn.»,
    «magg.») e l'anno davanti (aaaa-mm-gg, aaaa/mm/gg, aaaa.mm.gg). La FAQ RENTRI
    del 2 ottobre 2026 scritta in uno qualunque di questi modi e' «dopo»: fino
    all'ultimo giro della revisione del 13/10/2026, coi trattini o col mese
    abbreviato, prendeva ancora «verificata il 17/09/2026». Due numeri soli
    («art. 214-216», «c. 52-53») non sono una data. Una data non e' un estremo
    d'atto (`estremiAtto`): «17/09/2026» dava «09/2026», e la voce sul FIR
    digitale, che cita la precisazione della direzione del 17/09/2026, prendeva
    ogni fonte con una data di settembre. Resta aperto: una fonte con
    l'indirizzo di un altro sito prende la data della voce se ne porta il titolo
    o l'atto, perche' la strada degli atti non guarda l'url.
  - *«Verificata sulle fonti»* lo decide `verificataSulleFonti`
    (`base44/shared/fontiConoscenza.ts`, specchio `src/lib/fontiConoscenza.js`).
    Serve almeno una fonte su un sito ufficiale (`DOMINI_UFFICIALI`, gli stessi
    di `FONTI_UFFICIALI`) con la ricerca online accesa (`ufficiale`), oppure una
    voce della base di conoscenza. La ricerca accesa da sola non basta, e un
    indirizzo ufficiale scritto senza ricerca non e' una verifica.
  - *Consultata, non verificata* (decisione del 13/10/2026). Una pagina trovata
    con la ricerca online, che nessuna voce cita, porta «(consultata il
    gg/mm/aaaa)» col giorno della domanda, mai «verificata il».
    `fontiDellaRisposta` scrive `consultata_il` (il giorno italiano di oggi, o
    `giorno` se lo si passa) solo con la ricerca accesa, un indirizzo e nessuna
    voce; quello che scrive il modello non passa. `chiediAssistente` passa il
    giorno calcolato all'inizio della domanda (chiusura del giro, 14/10/2026):
    una risposta finita dopo mezzanotte non porta il giorno dopo. La regola sta
    in `consultataIl` (`base44/shared/fontiConoscenza.ts`, specchio
    `src/lib/fontiConoscenza.js`): le risposte di prima, senza il campo, prendono
    il giorno italiano della domanda (`created_date`). Un indirizzo senza la
    ricerca online e' scritto a memoria: nessun giorno. Prima accanto a una
    pagina trovata online non c'era nessun giorno. `Messaggio` e' esportato da
    `ChatAssistente.jsx` perche' la prova lo disegna con React lato server.
    Prova: `prove/ecotynaFonti.mjs`, sezione 9 (in fondo la domanda alle 23:59
    con la risposta dopo mezzanotte).
  - *«Dati del gestionale»* vuol dire che uno strumento ha risposto, o che il
    riepilogo generale e' stato letto al posto di strumenti andati in errore o
    di un pianificatore non riuscito. Non vale piu' `analisi.dati`, cioe' le
    parole della domanda. Se il pianificatore dice «nessuno strumento», il
    riepilogo entrato per una parola («microraccolta» contiene «raccolt») non
    accende il riquadro.
  - *Le fonti delle FAQ sono testo.* «Corretta, salva come FAQ» salva «titolo -
    riferimento url» (`leggiFontiTesto`). `fontiDi` e la pagina leggono anche
    gli oggetti delle FAQ di prima, che nel prompt di EcoTyna, del controllo
    mensile, del corso e della qualifica uscivano come «[object Object]».
  Prova: `prove/ecotynaFonti.mjs` (le sezioni 6, 7 e 8 per le revisioni del
  13/10/2026; la 8 per le date in ogni notazione), sulla funzione intera col banco `prove/dati/bancoEcoTyna.mjs`. Il
  banco ha il modello finto, gli archivi da far fallire (`guasti`) e il riepilogo
  della commessa sostituibile (`riepilogo`, anche 'errore').
- **Un file da un elenco tagliato si dice parziale** (A73, 12/10/2026). Il
  modello scrive il file con le righe che vede, e gli elenchi arrivano tagliati
  (`elenco()`) o accorciati per il prompt (`serializza`). La regola 3-quater
  offre il file solo su un elenco INTERO. Se l'utente lo chiede lo stesso, il
  file lo riconosce il gestionale, dalle righe (revisione del 13/10/2026).
  `elenchiTagliati` legge i blocchi del prompt come JSON e tiene le righe che il
  modello ha visto, di ogni elenco tagliato (`righe`) e degli elenchi interi
  (`interi`), come proprieta' non enumerabili. `fileDaElenchiTagliati`
  (`base44/shared/fileEcoTyna.ts`) scrive `parziale` solo sul file le cui righe
  vengono da un elenco tagliato: almeno due righe che gli somigliano piu' che a
  qualunque riga di un elenco intero, con 2 punti per un testo in comune e 1 per
  un numero. Non lo scrive piu' su ogni file della risposta: prima il raccolto
  per raccoglitore, intero, usciva parziale perche' accanto c'erano le date da
  sistemare tagliate. La riga di un elemento di un array prende solo i valori
  suoi (`valoriPropri`): i valori semplici, non gli array di righe ne' gli
  elenchi annidati, che si visitano e si contano a parte. Un elemento che e'
  esso stesso un elenco non e' una riga. Le righe di un elenco tagliato
  prendono invece tutto quello che hanno sotto (`valoriDi`). Prima della seconda
  revisione del 13/10/2026, l'elemento del canale della fatturazione attiva
  conteneva i 20 ordini su 30 arrivati dopo il documento, e il file fatto da
  quegli ordini usciva senza nessun avviso. Lo stesso valeva per i cambiati, i
  non piu' nel mese e le date da sistemare dell'attiva (un array di elenchi,
  uno per canale). Un blocco troncato a meta', che non si legge, segna ancora
  tutti i file con il «se»; un file che modifica un allegato non si segna mai.
  La chat mostra `parziale` accanto a «Scarica», e il file scaricato porta
  l'avviso in testa: A1 di ogni foglio Excel, primo paragrafo di Word, PDF e
  testo (`testaParziale`, `testoDelDocumento` in `src/lib/fileEcoTyna.js`). Il
  CSV no (decisione del 13/10/2026): si carica in altri programmi, e la riga
  d'avviso diventava la riga delle intestazioni. Per il CSV l'avviso resta
  accanto a «Scarica» e nella risposta, e REGOLE_FILE lo dice al modello. REGOLE_FILE chiede al modello di copiare nomi,
  codici e numeri come li vede, perche' il file si riconosce dalle righe.
  Limite: un file in cui il modello ha riscritto tutti i valori non si
  riconosce. Il rifacimento dal server senza taglio (`da_strumento`) non c'e',
  perche' servirebbe un «senza taglio» nei ventidue elenchi degli strumenti.
  Gli esempi tagliati portano il segno (decisione del 13/10/2026).
  `settimana_formulari` dava 5 esempi dei senza fine trasporto e 10 delle date
  da sistemare, e la riserva degli eseguiti 10 esempi, senza nessun avviso. Ora
  portano «ELENCO TAGLIATO: qui ci sono N formulari (ordini) dei M». Gli esempi
  della riserva lo portano come `avviso_esempi`, perche' nello stesso oggetto
  c'e' `per_raccoglitore` col suo `elenco_tagliato`. `elenchiTagliati` legge
  `avviso_<elenco>` come il taglio di quell'elenco soltanto; prima un avviso
  dell'oggetto valeva per tutti i suoi elenchi, e con 25 raccoglitori nel limbo
  il file degli esempi diceva «20 righe su 25». Chi taglia un elenco che sta
  accanto a un altro usa `avviso_<nome>`. Sui dati veri dell'11/10 non ci sono
  senza fine trasporto ne' eseguiti: la prova li aggiunge a una copia.
  Prova: `prove/ecotynaFileTagliati.mjs` (le sezioni 5, 6, 7 e 8 per le
  revisioni e le decisioni del 13/10/2026; la 7 e la 8 anche sulla copia dei
  dati veri, se c'e').
- **La provincia per sigla o per nome** (A74, 12/10/2026). Gli archivi scrivono
  la sigla. `provinciaChiesta` (`base44/shared/province.ts`) riconosce anche il
  nome e le forme d'ufficio («provincia di Bari», «Reggio Calabria»,
  «Barletta»); «Reggio» da solo resta non riconosciuto. Nel raccolto e
  nell'anagrafica PDR una provincia non riconosciuta non filtra per un valore
  inventato: da' numero non calcolabile e `avviso_provincia`. Una provincia
  riconosciuta che non trova niente lo dice: o non ne ha nell'anno, o non ne ha
  con gli altri filtri. Il «ne ha N» dell'avviso conta i formulari
  (`contaFormulari`), non le righe, come lo strumento: sui dati veri dell'11/10
  l'ACI di Salerno 2026 diceva 8 e ne ha 6 (revisione del 13/10/2026). Il prompt
  lo dice nella regola 3-sedecies. Prima «Bari» al posto di «BA» dava 0 t senza
  avviso; sui dati veri dell'11/10 sono 602,84 t in 210 formulari. Prova:
  `prove/ecotynaProvince.mjs`.
- **Lo stesso vale per il comune** (revisione del 14/10/2026). Un comune scritto
  male o diverso dal portale («Lavelo» per LAVELLO) dava uno zero «vero».
  `ordini_aperti`, `ordini_chiusi` e `raccolto` lo cercano fra i comuni degli
  ordini del canale di ogni anno (`comuneRiconosciuto` in
  `strumentiAssistente.ts`, nessuna lettura in piu'). Gli aperti leggono i
  terminati solo se il comune non e' fra gli aperti, con la stessa lettura (e la
  cache) del controllo PDR: se c'e' e' uno zero vero, detto col nome del portale.
  Se non c'e' da nessuna parte il numero e' non calcolabile, con `avviso_comune`
  e i comuni a una o due lettere di distanza («forse LAVELLO»), senza scegliere
  al posto di chi chiede. Prova: `prove/ecotynaModuliGiusti.mjs`, sezione 7.
- **Torna al testo verificato** (A75, 12/10/2026). Accanto al badge «Aggiornata
  il» di una voce verificata, l'amministratore ritira l'aggiornamento approvato
  per errore. Il ritiro funziona come `mettiDaParte`: attiva = false, motivo
  obbligatorio, nota nello storico, tutti gli aggiornamenti attivi della voce.
  Un aggiornamento ritirato a mano si rimette in uso dalle messe da parte; uno
  superato no. Le regole stanno in `src/lib/ritiroConoscenza.js`. Prova:
  `prove/baseConoscenzaRitiro.mjs`.
- **EcoTyna e la classe dell'Albo** (revisione del 13/10/2026). Lo strumento
  `qualifica_fornitori` passa i documenti da `applicaControlloClasse`
  (`classeAlbo.ts`) prima di `documentoDelRequisito`, come il modulo. Altrimenti
  un'iscrizione in classe F con 3.200 t di target era «valida» per EcoTyna e
  «non conforme» per il modulo. Raccoglitore vuol dire soggetto con un target
  nell'anno: due letture per domanda (TargetRaccoglitore e TargetMensile),
  nessuna per soggetto. Sui dati veri dell'11/10 sono gli stessi 11 raccoglitori
  del modulo. Il dettaglio porta i `motivi`. Se i target non si leggono, lo
  strumento lo dice (`controllo_classe_non_eseguito`). Prova:
  `prove/ecotynaQualificaClasse.mjs`, che confronta lo stato con la funzione
  vera `qualificaFornitori`. Dal 13/10/2026 i documenti si raggruppano per
  soggetto e voce, e conta quello su cui si regge il requisito
  (`documentoDelRequisito`), non ogni documento attivo. Il vecchio scaduto
  accanto al nuovo valido non e' «scaduto», a dicembre il fornitore non si conta
  due volte, e il dettaglio porta il file e la nota sul contratto caricato dopo
  anche quando il requisito e' valido. Nessuna lettura in piu'. Prova:
  `prove/contrattoNuovoRaggiungibile.mjs`, sezione 6.

### EcoTyna: il modulo giusto per ogni domanda sulla commessa (14/10/2026)

Parole dell'utente: *«oggi ho provato a chiederle circa gli ordini aperti in una
determinata provincia e lei mi ha risposto erroneamente perchè pescava tra le
'richieste ect' e non tra gli assegnati. [...] quello che voglio dire è che lei
deve avere esattamente bene a mente il modulo o i moduli giusti per cercare le
risposte su domande afferenti alla commessa Ecotyre del nostro gestionale»*.
Nessuno strumento leggeva gli Assegnati, e il pianificatore prendeva il nome che
somigliava di piu': «richieste» diventava `richieste_ect`, cioe' le richieste
arrivate via email.

- **La mappa delle domande** (`MAPPA_DOMANDE` in `base44/shared/pianoAssistente.ts`,
  fra le Regole di `istruzioniPiano`; le descrizioni del catalogo la ripetono).
  Conta che cosa chiede la domanda, non il nome dello strumento che le somiglia:
  per chi chiede «richieste», «ritiri» e «ordini» sono la stessa cosa, gli
  ordini del portale.
  - Ordini APERTI (quanti, quali, dove, da quanto aspettano, «da ritirare», «in
    attesa», l'arretrato): `ordini_aperti`, gli Assegnati. RETE per i gommisti,
    ACI per demolitori e autodemolizioni, EXTRA_RACCOLTA per le campagne.
  - Ordini CHIUSI (se e quando e' stato chiuso un ordine, l'ultimo ritiro di un
    PDR, quanti in un periodo e in una provincia, quanti ne ha fatti un
    raccoglitore): `ordini_chiusi`, i Terminati Rete, i Terminati ACI o l'Extra
    Raccolta, sul giorno di fine trasporto. Per le sole tonnellate resta
    `raccolto`.
  - «Ordini» senza dire aperti o chiusi: con un periodo, o con «fatti»,
    «gestiti», «serviti», sono i CHIUSI («quanti ordini ha fatto Emmesse a
    settembre?»); senza periodo gli APERTI («quanti ordini ci sono a Siracusa?»).
  - Secondarie e terziarie, aperte o chiuse: `secondarie` e `terziarie`. La
    predittivita' resta `proiezione_secondarie`.
  - Il fatturato o il costo di un fornitore in un periodo: `fatturazione` PASSIVA
    col fornitore (riservata all'amministratore: lo strumento lo dice da se');
    quanto spetta da Ecotyre: ATTIVA. I prezzi in €/t restano `tariffe`.
  - `richieste_ect` SOLO per le richieste arrivate via email, ricevute dal
    consorzio, le Richieste ECT o la To-Do List: mai per ordini aperti o chiusi.
  - Un ID ordine o un formulario: `cerca_movimento`, che dal 14/10/2026 guarda
    anche Assegnati Rete e ACI (un ordine aperto risultava «non trovato»).
- **Gli strumenti nuovi contano come i moduli** (`base44/shared/strumentiAssistente.ts`).
  - `ordini_aperti` legge Assegnati Rete, Assegnati ACI o le schede «assegnato»
    dell'extra raccolta e conta come la pagina (`computeAssegnatiMatrix`): un
    ordine per riga, la provincia in sigla, l'eta' con `etaArretrato` del
    cruscotto. Non prende anno e mese: un aperto si conta qualunque sia
    l'immissione, e il periodo travasato dal piano toglieva quelli di prima. Dice
    anche gli «eseguito» del canale con l'ID.
  - `ordini_chiusi` legge le righe del raccolto con gli stessi filtri
    (`movimenti()`: con la cache nessuna lettura in piu'), piu' PDR e comune.
    Conta gli ORDINI (`chiaveOrdine`) come la matrice per provincia dei
    Terminati Rete, con formulari e tonnellate accanto. Il giorno e' la fine del
    trasporto, mai la chiusura a portale (regola 1).
  - Il PDR con la regola del campo «PDR» dei Terminati Rete (`pdrChiesto`,
    `delPdr`): un numero da solo e' il codice `id_pdr` e vale uguale, non
    contenuto; altrimenti tutte le parole del nome. Le funzioni non leggono `src`,
    quindi la regola e' scritta due volte e la prova le confronta sui dati veri.
  - `secondarie` e `terziarie` leggono l'archivio intero del modulo, una volta
    per domanda, e contano come le pagine: le chiuse per fine trasporto nel
    periodo, le aperte tutte. Le secondarie restano divise per canale; le
    terziarie non hanno canale.
  - Sui dati veri dell'11/10/2026 dicono i numeri dei moduli: a Cosenza, rete,
    da luglio a settembre 46 ordini chiusi (181,40 t); l'ultimo ritiro del PDR
    42872 il 07/10/2026 (due ordini); terziarie di agosto 17; aperti di rete a
    Siracusa nel file PRIMARIE.xlsx 3, come la pagina.
- **La guardia dopo il pianificatore** (`correggiPiano`). Il pianificatore e' un
  modello: quando sbaglia, sbaglia il modulo, e la risposta esce sicura con un
  numero vero di un'altra cosa. Senza modello, dalle parole della domanda, si
  correggono gli errori evidenti della mappa: le Richieste ECT senza che la
  domanda parli di email, una domanda sulle email senza le Richieste ECT, uno
  strumento che non legge quello che la domanda chiede, il canale degli ordini
  sbagliato (demolitori = ACI). Uno strumento legittimo scelto in piu' non si
  tocca: la guardia corregge, non ripianifica. I filtri che la domanda dice e il
  piano ha dimenticato si aggiungono. Il perche' viaggia coi parametri sotto
  `CHIAVE_SCELTA` e arriva a «Dove ho guardato»; due chiamate uguali a meno della
  nota o dell'ordine dei filtri diventano una.
- **La guardia corregge solo gli errori EVIDENTI** (revisione del 14/10/2026).
  - Fra ordini aperti e chiusi sceglie solo se la domanda lo dice a parole:
    aperti, da ritirare, in attesa; oppure chiusi, ritirati, terminati, fatti,
    gestiti, serviti. Altrimenti la scelta del pianificatore resta. Solo al
    posto di uno strumento sbagliato decide il periodo: con un periodo i chiusi
    («quanti ordini ha fatto Emmesse a settembre?»), senza gli aperti («quanti
    ordini ci sono a Siracusa?»).
  - Il canale lo impone solo se la domanda ne nomina uno in positivo e da solo e
    il piano ne aveva uno diverso. Non contano «esclusa l'extra raccolta»,
    «esclusi i demolitori», «senza l'ACI», «ACI compresa», «oltre a», «in tutto».
    Aci Sant'Antonio, Aci Catena, Aci Castello, Aci Bonaccorsi e le frazioni di
    Acireale sono comuni della rete, non il canale ACI.
  - Una sigla di provincia attaccata a una parola con la maiuscola fa parte di un
    nome (CL Service, BS Ecoservizi). Una provincia che e' una parola del nome
    scritto dal piano non si aggiunge come filtro («Ecologia Bari» non e' la
    provincia di Bari).
  - Un piano vuoto con `serve_normativa` vero, o su una domanda di procedura («va
    chiuso», «entro quanti giorni», «quali documenti servono», «quante copie»),
    resta vuoto.
  - I mesi si leggono in tutte le forme: «luglio-settembre», «dal 1 luglio al 30
    settembre», «da luglio a oggi», «da luglio in poi». «Luglio e settembre» sono
    due mesi; «da luglio 2025 a oggi» non si traduce in mesi.
  - Ogni filtro preso dalla domanda si scrive in «Dove ho guardato» («filtri
    presi dalla domanda: ...»).
  - Limite noto: la guardia non corregge un anno scritto dal pianificatore che
    contraddice la domanda («nel 2025» con il periodo 2026), perche' non cambia i
    valori scritti dal piano.
- Prova: `prove/ecotynaModuliGiusti.mjs`: la mappa fra le regole, il catalogo,
  la batteria delle domande scritte come le scrive l'utente (errori di battitura
  compresi), gli strumenti sui dati veri contro i moduli, gli Assegnati come la
  pagina, «Dove ho guardato», e la sezione 7 per la revisione.

#### L'anno di cui parla EcoTyna (15/10/2026)

Dalla prova generale del cambio d'anno: il 05/01/2027 «quanto abbiamo raccolto a
dicembre?» rispondeva «Dicembre 2027: 0 t», e l'esempio della Guida sugli ordini
chiusi a Cosenza da luglio a settembre dava 0 (2027) invece di 46 ordini (2026).

- **Un mese detto senza anno e' l'ultimo gia' cominciato** (difetto 8). Per gli
  strumenti dei fatti gia' avvenuti (`STRUMENTI_DEI_FATTI` in
  `pianoAssistente.ts`: raccolto, ordini_chiusi, secondarie, terziarie,
  fatturazione, report_mensile, dichiarazioni_impianti) la regola e' questa: se
  l'anno non e' detto ne' scritto, o il piano ha scritto solo l'anno di oggi, e
  i mesi vengono tutti dopo quello in corso, l'anno e' quello di oggi meno uno.
  La scelta lo scrive («dicembre 2026, l'ultimo dicembre finito») e la risposta
  lo deve dire (blocco «ANNO DEL MESE»). Contratto, target e predittivita'
  restano sull'anno di oggi. La Guida lo dice in «Come chiedere a EcoTyna».
  Prova: `prove/mesiChiesti.mjs`.
- **settimana_formulari ha l'anno ISO** (difetto 14). Senza settimana valgono
  settimana e anno ISO di oggi (il 02/01/2027 e' la 53 del 2026; prima diceva
  «settimana 53 del 2027, dal 2028-01-03 al 2027-12-31»). Con la sola settimana
  vale l'ultima con quel numero gia' cominciata. Una settimana che non esiste lo
  dice, senza numeri. Prova: `prove/settimanaIso53.mjs`.
- **L'anno di oggi messo dal piano per abitudine non passa** a
  settimana_formulari e richieste_ect, se la domanda non dice un anno
  (`domandaDiceLAnno`: «2025», «quest'anno», «l'anno scorso», «del '25», «due
  anni fa»...). Un anno PASSATO scritto dal piano passa sempre (seconda revisione
  del 15/10/2026).
- **richieste_ect senza anno** (difetto 2) fa una lettura sola e da' le
  richieste dell'anno di oggi, piu' quelle degli anni prima non ancora chiuse
  (aperte, da confermare, evase senza risposta al consorzio) e quelle degli anni
  prima chiuse quest'anno, come la To-Do List (`richiesteDellaTodo`). Ogni riga
  ha il suo anno e, se serve, `chiusa_nel`. La regola e' copiata da
  `richiesteEct.ts`: se cambia la', va cambiata anche qui. Prova:
  `prove/numeriEcotyna.mjs`.
- **tariffe** (difetto 15): una tariffa copiata e non confermata
  (`daConfermare`) dice «vale oggi, copiata dal 2026 e da confermare», con
  `avviso_copiate` (D4). Prova: `prove/strumentiTariffe.mjs`.

### La voce di EcoTyna: il testo detto, frase per frase (11/10/2026)

L'utente: *«vorrei rendere EcoTyna piu' realistica e con una voce meno robotica»*. La voce resta la sintesi del browser, senza servizi a pagamento. Quello che la faceva sembrare una macchina che legge era tutto nel nostro codice:

1. **Il testo detto, non quello scritto** (`src/lib/parlato.js`, `testoParlato`). I numeri si scrivono in parole, all'italiana: «412,30 t» e' «quattrocentododici virgola trenta tonnellate», i decimali a zero non si dicono, «1 t» e' «una tonnellata». Le unita' vanno per esteso (t, kg, €/t, %). Le date si dicono in parole: «05/10/2026» e' «cinque ottobre duemilaventisei», il primo del mese e' «primo». Le sigle si dicono come in ufficio: PFU «pi effe u»; FIR, ACI, RENTRI, CER e MUD come parole; EoW «end of waste». Le ragioni sociali perdono la forma societaria e il tutto maiuscolo. Codici d'ordine, codici di formulario e nomi di file si saltano: resta «l'ordine». Le norme che hanno la forma di un codice (lettere e almeno tre cifre) si dicono prima che i codici si saltino: «art. 184-ter» e' «articolo centottantaquattro ter», anche coi suffissi da bis a decies e scritti attaccati («184ter»); «2008/98/CE» e' «duemilaotto novantotto ci e» (`ATTI_EUROPEI`: CE, CEE, UE, Euratom). Un mese come lo portano gli strumenti, «2026-09», e' «settembre duemilaventisei», non l'intervallo «da duemilaventisei a zero nove» (revisione delle migliorie, 11/10/2026). Una tabella si annuncia con una frase sola. Una sigla nuova del mestiere si aggiunge a `SIGLE`. I numeri in parole servono anche alla bocca: `visemi.js` segue le lettere vere.
2. **Frase per frase** (`dividiInFrasi`, `leggiAVoce`). Gli enunciati non superano `MASSIMO_FRASE` caratteri, perche' Chrome tronca da solo un enunciato lungo. Fra le frasi c'e' la pausa `PAUSE.frase`, fra i paragrafi `PAUSE.paragrafo`, e nella pausa la bocca e' chiusa. Una lettura fermata non riparte: dopo `ferma()` nessun avviso della sintesi fa partire la frase successiva. Un enunciato che non parte si riprova una volta. Uno che non avvisa la fine non lascia la lettura appesa. Una voce online senza rete ripete la frase con la voce del computer.
3. **La voce migliore, ma le voci online le sceglie l'utente** (`ordinaVoci`, `voceDaUsare`, `voceDaProporre`). L'ordine e': Natural/Neural, Premium, Enhanced, Google, le altre online, le voci di base; a parita', l'italiano d'Italia e una voce femminile. Le voci piu' naturali (Edge «Elsa Online (Natural)», Chrome «Google italiano») **ricevono il testo da dire**. Per la regola di riservatezza non si scelgono da sole: finche' l'utente non risponde si usa la migliore che resta sul computer, e la pagina propone una volta quella online (`eco_voce_online`). Nel selettore ogni voce mostra la qualita' e «online». Il tono e' 1 sulle voci naturali e 1,05 su quelle di base. Anche la dettatura di Chrome ed Edge passa dal servizio vocale del browser: l'intestazione di `voce.js` lo dice.
4. **La versione parlata** (`da_dire`). chiediAssistente la chiede in tutti e due gli schemi con la regola V: due o tre frasi, niente elenchi ne' codici, i numeri della risposta esatti con la loro etichetta, gli avvisi detti in breve, tutte le regole dei numeri. Passa da `testoAllItaliana`, si salva in `DomandaAssistente.da_dire` e arriva alla pagina nella risposta della funzione. Se l'archivio rifiuta il campo, la risposta si salva lo stesso. La voce dice `da_dire`; senza, dice `riassuntoParlato`. Il testo intero si sente solo con «Leggi tutta la risposta».

**Il tono scritto** e' la regola T del prompt. Si da' del tu. La prima frase risponde in italiano naturale, con soggetto, verbo e numero con la sua etichetta, senza stile telegrafico («GREEN TYRE PROJECT SRL, rete, luglio 2026: ...»). I nomi si scrivono come si dicono («Green Tyre»), ma per intero quando si somigliano. La regola D chiede la prima *frase*, non piu' la prima *riga*. Il tono cambia la forma, non i numeri: D-quater e tutte le regole dei numeri restano.

**La modalita' conversazione** (`src/lib/conversazione.js`, interruttore «Conversazione», spenta finche' non la si accende, `eco_conversazione`). Finita la risposta, EcoTyna torna ad ascoltare. Mentre parla, la ferma una frase con almeno due parole che lei non sta dicendo, se sono la meta' o se fra loro c'e' una parola da domanda (`PAROLE_DOMANDA`; `eInterruzione`: la sua eco dalle casse non conta, nemmeno coi numeri trascritti in cifre). Una parola da domanda che differisce di una lettera da una sua e sta accanto alle parole che lei ha vicino («quanto Irigom» per il suo «Quando Irigom», «puoi» per «poi», «cosa e'» per «cos'e'») e' la sua capita male e non conta: con un nome storpiato si fermava da sola e la sua frase partiva come domanda al modello (revisione, 12/10/2026). «chi» invece conta sempre: lei dice «che ha raccolto» in quasi ogni risposta, e «chi ha raccolto di piu'» e' la domanda piu' comune. **Un comando** (`soloComando`) e' fatto solo di parole di stop (basta, ferma, stop, aspetta...) e di riempitivi (`RIEMPITIVI`: ok, grazie, cosi', un attimo...): la ferma se ha almeno una parola che lei non sta dicendo, e non parte mai come domanda. «aspetta, perche'?» o «basta, e Gatim?» non sono comandi: la fermano e partono. Una parola di stop sua con accanto una parola non finita (il provvisorio «basta ricarica» della sua «Basta ricaricare il file») non la ferma: la ferma solo una parola di stop che lei non dice. Dalla domanda nata sopra la sua voce `togliEco` toglie in testa solo la sua eco vera: pezzi della sua frase nell'ordine in cui li dice (almeno due parole di fila, tre in tutto), le sue parole subito prima di un «basta», le parole di stop; le sue parole sparse restano, e anche due parole sue di fila («sulla rete quanto ha fatto Gatim»), perche' perdere il canale costa piu' di un pezzetto di eco. Limite noto: il riconoscimento manda risultati provvisori parola per parola, e un'eco molto storpiata in testa alla frase («puoi Irigom dove...») puo' ancora fermarla; con le cuffie non succede. La domanda dettata parte da sola dopo `TEMPI.silenzio` e un conto di `TEMPI.conto`, con «Invia ora» e «Annulla», **come dal pulsante Invia**: la conversazione chiama `invia()` senza argomenti, col testo della casella e i file in coda (`invia(q)` e' la strada degli esempi, che non allega: dalla conversazione buttava il file in coda). Premere Invia durante il conto non la manda due volte; mentre un file si sta ancora leggendo non parte niente. Riprendere a parlare ferma il conto; scrivere a mano annulla l'invio; il pulsante Ferma non riapre il microfono; un comando non e' una domanda. Se la pagina si apre con la modalita' gia' accesa, il microfono non si apre da solo. `creaRiconoscimento` (`voce.js`) mette in fila le sessioni, e una sessione annullata non manda piu' niente.

Un tranello trovato qui: `'0123'.includes('')` e' vero. `cifraSeguita` in `visemi.js` scambiava per un separatore il punto finale di «sono 38.». Per controllare il carattere dopo o prima si usa `fra(elenco, ch)`, che rifiuta il carattere mancante.

Prove:
- `prove/parlato.mjs`: testo detto, frasi, voci, lettura con un motore finto, eco.
- `prove/conversazione.mjs`: la modalita' coi timer finti e le sessioni del riconoscimento.
- `prove/ecotynaDaDire.mjs`: chiediAssistente intero, cioe' schemi, regole T e V, conversione e salvataggio di `da_dire`, archivio che rifiuta il campo.
- `prove/visemi.mjs`: l'acca muta e il punto finale.

## I caricamenti, lo storico e il registro

### Lo storico: si carica solo cio' che serve all'operativita' (25/09/2026)

Il portale si ancora al 31/12 di ogni anno: quando un anno e' dichiarato e le
sue giacenze svuotate, ricaricarne i movimenti non serve piu'. L'utente carica
quindi i file di primarie, secondarie e terziarie dal 1 gennaio dell'anno
scorso (nel 2026 dal 2025, nel 2027 dal 2026), ma gli anni prima devono restare
nella memoria storica del gestionale. Due regole, entrambe sulla **fine del
trasporto** (l'immissione conta solo per gli assegnati, la chiusura mai):

- **Il caricamento conserva lo storico** (`base44/shared/storicoConservato.ts`).
  Il portale filtra l'export per data di **immissione**, che per l'utente conta
  solo per gli ordini aperti: per i terminati comanda la fine del trasporto.
  Quindi un **terminato** assente dal file resta in archivio com'e', qualunque
  sia la sua fine, e conta nel suo anno: non e' un "ordine mancante". Nei file
  del 25/09/2026 (dal 1/1/2025) mancavano 3.254 terminati finiti nel 2024 e 909
  finiti nel 2025-2026 ma immessi nel 2024, fino a febbraio 2024: restano tutti.
  Un terminato fuori dal file resta com'era all'ultimo caricamento che lo
  conteneva, e va bene cosi': a portale si puo' correggere al massimo un ordine
  del mese precedente, e l'export parte dal 1 gennaio dell'anno scorso, quindi
  nessun ordine ancora correggibile puo' restare fuori (utente, 25/09/2026). Un **assegnato** assente dal file e' un vero mancante e si
  segnala. I **cancellati** immessi prima dell'anno scorso, assenti dal file,
  non servono piu' (utente, 25/09/2026) e si lasciano andare
  (`cancellatiDaLasciare`); non avendo fine trasporto, per loro vale
  l'immissione. Quelli piu' recenti restano nel controllo, perche' servono come
  statistica: un cancellato resta cancellato e inevaso, e puo' tornare
  assegnato con lo stesso ID ordine solo se viene riaperto perche' e' stato
  cancellato per errore. Si cancella per ID a blocchi, dopo una prova in sola
  lettura del filtro; senza niente da conservare resta il `deleteMany({})` di
  sempre. Esportare sempre dal 1/1 dell'anno scorso tiene piccoli i file.
  Dal 28/09/2026 si conserva come un terminato anche un ordine in stato
  **"eseguito"** assente dal file, e si segnala: e' una regola dell'utente,
  spiegata nella sezione sul caricamento delle primarie. Vale per tutti gli
  archivi che conservano lo storico, secondarie e terziarie comprese, perche'
  `ordiniDaConservare` e' una sola. E lo
  svuotamento selettivo smette prima dei dodici secondi dell'invocazione dicendo
  dove e' arrivato, cosi' il caricamento lo riprende; quando il filtro per ID non
  regge, all'azione `svuota` delle primarie risponde con un motivo invece di
  lanciare, cosi' la frase "serve un caricamento completo, dal primo anno" arriva
  intera a chi carica. Per secondarie e terziarie (`importEcotyreFile`) resta il
  comportamento di prima: si ferma con un errore, che e' cio' che quel percorso
  deve fare per non scrivere il file sopra un archivio non svuotato.
- **Le date obbligatorie si controllano dall'anno scorso** (`dateDaControllare`
  e `primoAnnoControllato` in `base44/shared/movimenti.ts`): un terminato con la
  fine trasporto prima non si segnala piu', ovunque. Senza fine trasporto non ha
  anno, e si segnala sempre.

### Il caricamento delle primarie: che cosa si crede e che cosa si ripara (28/09/2026)

`src/lib/importGrandeFile.js` (il browser) con `base44/functions/importaBlocco/entry.ts`
(il server). Le prove: `prove/caricamentoPrimarie.mjs`, che impacchetta la
function vera e il modulo del browser con un SDK finto e i guasti in mezzo.

- **Il verdetto si regge su cio' che la piattaforma ha CONFERMATO di aver
  scritto, non su cio' che una lettura racconta.** Leggere di piu' non si vince
  mai: una piattaforma indietro di qualche secondo da' due, tre, sei letture
  uguali e tutte sbagliate, e "le righe non ci sono" e "la lettura e' indietro"
  sono lo stesso numero. Una lettura serve a due cose sole: accorgersi che
  qualcosa non torna e raccontare che cosa. Non decide.
- **Si parte dalla BASE NOTA, non da zero.** L'archivio si porta allo storico
  conservato - un numero e un elenco di ordini che la preparazione ha gia'
  calcolato (`storicoConservato.ts`) - e si verifica che sia esattamente
  quello; poi ogni blocco del file si scrive **al massimo una volta** e non si
  riscrive mai. Quindi l'archivio non puo' avere piu' righe di **base + file**,
  ne' in totale ne' per singolo ordine: dopo lo svuotamento in archivio ci sono
  solo righe di ordini conservati, le scritture aggiungono solo righe del file, e
  i due insiemi sono disgiunti per costruzione, perche' un ordine si conserva
  soltanto se il file non lo contiene. Senza niente da conservare la base e'
  zero e tutto torna alla frase di prima: "si svuota e si verifica a zero".
- **Il confronto e' ordine per ordine, col dettaglio.** Il solo totale non basta:
  un blocco entrato due volte (+200 righe) e uno mai arrivato (-200) si
  compensano. Non si pretende un id_ordine per riga: lo stesso ordine sta in
  archivio con piu' righe, una per classe. Il metro e' "quante righe deve avere
  questo ordine", cioe' quelle del file **piu'** quelle dello storico.
- **La riparazione e' idempotente**: per ogni ordine che non torna si TOLGONO le
  sue righe e si RISCRIVONO quelle del file, cosi' comunque fosse messo
  l'archivio quell'ordine finisce esatto e doppioni non se ne creano. Non esiste
  una scrittura "aggiungi" cieca. Fra perdere righe e duplicarle si sceglie
  sempre la prima: perdere e' rumoroso e si rimedia ricaricando, duplicare e'
  silenzioso e i ricalcoli partono sopra i pesi doppi.
- **Due regole che la riparazione non puo' violare.** (1) Si toccano **solo gli
  ordini presenti nel file**: la riparazione si regge sul poter riscrivere cio'
  che toglie, e di un ordine che il file non porta non c'e' niente da
  riscrivere - togliere lo storico conservato vorrebbe dire perderlo per sempre.
  Il freno e' nel browser e, come ultima rete, nell'azione `cancella_ordini`,
  che non filtra gli ID buoni: se ne arriva uno a cui il browser non dichiara
  nessuna riga nel file rifiuta la richiesta per intero, non tocca niente e
  risponde 200 con `non_fatta` (senza il campo `nel_file` il controllo non si fa
  affatto, per chi chiamava prima di questa rete). Il
  prezzo: una riga rimasta in archivio di un ordine che il file non contiene non
  si toglie da sola, si dice, e si rimedia ricaricando lo stesso file. (2) Se un
  ordine **conservato** risultasse con meno righe di quante la preparazione ne
  aveva contate non si ripara: **si dice** (`avviso_storico_non_torna`), perche'
  il file non le contiene e l'unico rimedio e' ricaricare l'export completo dal
  primo anno. Quella frase si costruisce **dopo** che la lettura e' stata
  giudicata, cioe' solo su una lettura buona: una lettura incoerente dice per
  definizione meno righe di quante ne sono state confermate, ed e' proprio
  quella che fa sembrare corti gli ordini conservati - la si usava per mandare a
  esportare l'intero storico dal portale per un guasto che non esisteva. E
  quell'ordine **non e' un "ordine mancante"**: esce una volta sola, col suo
  rimedio, e l'archivio non si dichiara "non allineato col file" (`storico_perso`
  si sottrae). Il caricamento resta **parziale** lo stesso e i ricalcoli non
  partono.
- **Lo svuotamento si riprende solo se sta andando avanti davvero.** Quando
  l'invocazione finisce i dodici secondi la function dice dove e' arrivata e il
  browser richiama, e una ripresa non consuma i tentativi. Ma
  `cancellati_ordini` sono gli ID **passati** a `deleteMany`, non le righe
  uscite: una piattaforma che accetta il filtro senza eseguirlo risponde bene lo
  stesso, e con quel numero come prova il ciclo non finiva mai - la barra
  scriveva "200 ordini tolti, si continua" all'infinito e l'unica via d'uscita
  era chiudere la scheda, cioe' il gesto che lascia l'archivio svuotato a meta'.
  Si pretende che le righe rimaste **scendano**, e le riprese hanno comunque un
  tetto (`MAX_RIPRESE_SVUOTAMENTO`).
- **"Nessun dato modificato" si dice del CARICAMENTO, non dell'invocazione.**
  Gli archivi si svuotano e si riscrivono uno per volta: se il filtro per ID non
  regge sul secondo, il primo e' gia' riscritto col file nuovo. Il server puo'
  solo dire "io non ho toccato niente"; il browser tiene la bandierina del
  caricamento intero e la finestra dice il verde solo quando e' vera. La
  bandierina va guardata su **tutte** le porte da cui un errore puo' uscire, non
  su una: per questo vive in `importaPrimarie`, che avvolge tutto il caricamento
  e abbassa `dati_intatti` su qualunque errore esca da li'. Chiusa su una porta
  sola restavano aperte le altre - lo svuotamento che non si ritenta, una
  scrittura rifiutata, e soprattutto la **registrazione finale**, che si guasta a
  caricamento completato e ad archivio interamente riscritto: un 401 (la sessione
  scade, un caricamento dura minuti) bastava a far uscire il verde.
- **Gli ID del file allo svuotamento si mandano SEMPRE, sugli archivi che hanno
  uno storico** (`storico: true` in `ARCHIVI_PRIMARIE`, `ARCHIVI_CON_STORICO` di
  la'). Senza ID la `svuota` fa il `deleteMany` di tutto: se la preparazione non
  rispondesse i conservati - campo assente, oppure a zero - lo storico degli anni
  prima sparirebbe, il caricamento chiuderebbe "successo" e nessuna frase lo
  direbbe. Mandandoli sempre, la `svuota` **ricalcola per conto suo** che cosa
  conservare (la seconda lettura di sicurezza voluta dall'utente) e una
  preparazione muta diventa un guasto rumoroso. E un archivio con storico che
  dopo lo svuotamento resta **senza nessuna riga** si dichiara: non si chiude
  come riuscito e non si ritenta alla cieca, perche' quelle righe il file non le
  contiene e l'unico rimedio e' un caricamento completo dal primo anno.
- **Le pagine dell'archivio si leggono in ordine di `id` e si deduplicano**
  (`pagineArchivio` in `importaBlocco/entry.ts`, regola di `shared/fetchAll.ts`):
  `id_ordine` non e' unico, quindi non e' stabile fra una pagina e l'altra. Da
  quella lettura esce il conto delle righe di ciascun ordine conservato, che fa
  da metro a tutto il confronto finale.
- **Lo stato "eseguito" e' un limbo, e si segnala** (`eEseguito` e
  `riepilogoEseguiti` in `movimenti.ts`, `src/components/primarie-rete/AvvisoEseguiti.jsx`):
  dati completi ma Chiudi non premuto a portale, quindi quell'ordine non entra in
  nessun conto - raccolto, giacenze, report, target, fatturazione - e sparirebbe
  in silenzio. Non si somma ai terminati: si conta a parte, un canale per volta.
  **Un "eseguito" assente dal file si CONSERVA come un terminato, e si segnala**
  (regola dell'utente, 28/09/2026: *"un ordine in stato eseguito va segnalato e
  mantenuto, cosi' che al prossimo caricamento abbia un altro stato, terminato o
  cancellato"*). E' uno stato **di passaggio** e si risolve da solo: al
  caricamento dopo, se l'ordine rientra nell'export, il portale gli ha dato lo
  stato definitivo e il file lo riscrive com'e' diventato; se e' immesso prima
  dell'anno scorso l'export non lo porta, la riga resta "eseguito" e l'avviso
  continua a farlo vedere - che e' il "mantenuto e segnalato" chiesto.
  Trattarlo come un ordine mancante, invece, faceva
  chiedere la forzatura e, forzando, CANCELLAVA proprio l'ordine che l'avviso
  sugli eseguiti serve a far vedere. Conservarlo non basta: `ordiniDaConservare`
  restituisce anche quanti sono (`eseguiti`), il numero arriva a
  `storico_conservato` e al registro, e le frasi dicono "ordini terminati o
  eseguiti" invece di chiamarli terminati. Senza quel conto un eseguito immesso
  prima dell'anno scorso non comparirebbe da nessuna parte, perche'
  `avviso_eseguiti` guarda il FILE. **La regola vale anche per secondarie e
  terziarie**, e fino all'08/10/2026 valeva solo a meta': `importEcotyreFile`
  chiamava la stessa funzione ma prendeva solo ordini e righe, buttando via
  `c.eseguiti`. Si conservavano e non li segnalava nessuno - il contrario di
  "segnalato E mantenuto". Adesso il conto arriva fino alla finestra del
  caricamento, e **l'avviso sta anche sulle pagine**: Secondarie (un canale per
  volta, che e' la scheda aperta) e Terziarie (due avvisi, perche' li' il canale
  lo decide il materiale e rete e ACI non si sommano mai). Senza quell'avviso una
  secondaria nel limbo non si vedeva da nessuna parte. Guardia in
  `prove/storicoConservato.mjs`. Dal 14/10/2026 l'elenco con gli ID lo fa una
  regola sola, per tutti i caricamenti, la dashboard e le pagine: vedi «Gli
  ordini rimasti "eseguito": una regola sola, a ogni caricamento».
- **Un caricamento aggiorna i moduli solo se e' riuscito** (`moduliDaRicalcolare`),
  e quando non partono si dice quali restano indietro (`ricalcoliFermi`). I
  ricalcoli (`RICALCOLI` in `src/lib/importGrandeFile.js`) sono **cinque** per le
  primarie - evasione degli assegnati, ritiri delle richieste del consorzio,
  ordini da completare della to-do list, verifiche e quadrature, qualifica
  fornitori - **due** per le secondarie e **due** per l'extra raccolta (verifiche
  e qualifica, piu' `alertExtra` - l'alert delle date obbligatorie - quando la
  riga di registro non si e' potuta scrivere: quel terzo non compare in
  `ricalcoliFermi`, che legge solo `RICALCOLI`), e **uno** per il report delle dichiarazioni di trattamento, che
  allinea le dichiarazioni caricate a portale: l'utente l'ha chiesto il
  02/10/2026, «dovrebbe farlo in automatico quando carico quei due file». La
  predittivita' non ha piu' un ricalcolo qui dal 26/09/2026: la pagina si
  ricalcola da sola a ogni apertura e il programma della settimana dopo si fissa
  il mercoledi' alle 8 (`analisiSettimanalePredittiva`); il modulo c'e', vedi la
  sua sezione. Erano quattro
  per le primarie finche' non si e' aggiunta la to-do list (28/09/2026): il
  numero scritto qui era rimasto indietro, verificato il 08/10/2026.
- **Le due conferme sono separate** (`CONFERMA_ORDINI_MANCANTI` e
  `CONFERMA_ARCHIVIO_RIMPICCIOLITO`) e si accumulano: possono scattare insieme, e
  mandandone una sola il pulsante "Forza caricamento" girava in tondo. Un collega
  che sta caricando adesso non e' un tentativo morto: glielo si dice subito,
  senza offrirgli niente da forzare.

### Gli ordini rimasti «eseguito»: una regola sola, a ogni caricamento (14/10/2026)

Parole dell'utente: *«ad ogni caricamento di primarie, secondarie o terziarie,
qualora risultassero degli ordini in stato "eseguito", quindi non terminato, non
cancellato e non assegnato, devono essere sempre segnalati indicando l'id ordine
affinchè vi si possa porre subito rimedio; questo è infatti uno stato di "limbo"
che non ha alcun senso e deve tramutarsi in un altro dei tre stati. fallo nel
modo migliore, più elegante, professionale e meno invasivo possibile»*.

Fino a quel giorno lo dicevano in quattro modi diversi: la finestra del
caricamento delle primarie (solo i conti, dal file), le pagine (gli ID in una
tendina), lo storico conservato (solo quanti) e la chiusura del mese. Secondarie
e terziarie, al caricamento, non lo dicevano affatto, e la dashboard nemmeno.

- **La regola e' una** (`base44/shared/ordiniEseguiti.ts`, specchio
  `src/lib/ordiniEseguiti.js`). `ordiniEseguiti(archivi, { oggi, annoInizio })`
  prende le righe in «eseguito» (`eEseguito`) e le divide in sei gruppi mai
  sommati (`GRUPPI_ESEGUITI`): primarie rete, primarie ACI, secondarie rete e
  ACI, terziarie rete e ACI. Secondarie e terziarie si dividono per materiale con
  `canaleDi`, come nelle loro pagine. Per ogni ordine: ID (o formulario),
  raccoglitore o trasportatore, punto di raccolta o stoccaggio, provincia,
  destinazione, immissione, fine trasporto e da quanti giorni, chili (null se
  nessuna riga dice il peso) e che cosa manca (`cosaManca`). L'extra raccolta
  non c'e': ha solo assegnato e terminato.
- **Da quanti giorni** si misura dalla fine del trasporto, il giorno da cui
  l'ordine si poteva chiudere: il caricamento che l'ha visto «eseguito» per la
  prima volta non e' scritto da nessuna parte.
- **Una lettura per archivio, filtrata per stato** (`FILTRO_ESEGUITI`;
  `leggiEseguiti` in `base44/shared/ordiniEseguitiLettura.ts`, a parte perche'
  le pagine non leggono archivi per nome): poche righe, di solito nessuna, mai
  una per riga o per soggetto. Un archivio che non risponde vale null e finisce
  in `non_letti`: mai «nessun eseguito».
- **Chi la usa.**
  - Le primarie: `importaBlocco` (azione registra) rilegge PrimariaRete e
    PrimariaAci a scrittura finita, cosi' vede quelli del file e quelli
    conservati dagli anni prima, e scrive gli ID nel registro (`testoRegistro`).
    Il browser li prende (`eseguitiDopoIlCaricamento` in
    `src/lib/importGrandeFile.js`); se la rilettura non e' riuscita ripiega sul
    conto fatto sul file, meglio dei soli ordini del file che un «nessuno» falso.
  - Secondarie e terziarie: `importEcotyreFile` fa lo stesso dopo la scrittura
    (`avviso_eseguiti`, e `non_riletti` quando la rilettura non riesce).
  - Sotto la scheda di Caricamento Dati: `EsitoEseguiti`
    (`src/components/shared/OrdiniInEseguito.jsx`), un riquadro ambra piccolo,
    mai una finestra che interrompe, e niente se non ce n'e'. «Quali sono» apre
    gli ID; un pulsante li copia tutti, uno scarica il foglio
    (`src/lib/ordiniEseguitiExcel.js`, un foglio per gruppo con la veste dei
    documenti del gestionale).
  - La dashboard: una voce sola di «Da gestire» (`voceEseguiti`, area «Chiusura
    a portale»), con gli ID nel dettaglio e il collegamento al modulo;
    `cruscottoOperativo` passa `dati.eseguiti`. Firma fissa e gli ID come
    elementi: nascosta, torna solo per un ordine nuovo, non ogni mattina perche'
    crescono i giorni. Senza niente trovato e con un archivio non letto, la voce
    «non verificati»: mai un verde falso.
  - Le pagine: `AvvisoEseguiti.jsx` passa le righe della pagina alla stessa
    regola e mostra lo stesso elenco (`ElencoEseguiti`).
- **Si segnala e si mantiene** (decisione del 28/09/2026, nella sezione sopra):
  mai cancellato, mai sommato ai terminati. Si risolve da solo al caricamento
  dopo, quando il portale gli da' lo stato definitivo.
- **Fuori dall'export non sparisce da solo** (revisione del 14/10/2026). Un
  «eseguito» immesso prima dell'anno da cui parte l'export (`fuori_export`: di
  solito un limbo a cavallo del 1° gennaio) il file di sempre non lo riscrive.
  Dopo il Chiudi a portale resta «eseguito» finche' non si carica un export che
  parte dal suo anno.
  - Le frasi lo dicono con gli anni: `fraseFuoriExport` e `spiegazioneEseguiti`,
    usate dalla voce di «Da gestire», dall'esito sotto la scheda di Caricamento
    Dati e dall'avviso delle pagine.
  - La promessa «spariscono da soli» vale solo per quelli che l'export riporta.
  - Ogni gruppo porta `fuori_export` e `anno_fuori_export`, contati prima di
    tagliare l'elenco.
- Prova: `prove/ordiniEseguiti.mjs` (la regola, lo specchio, i caricamenti di
  secondarie, terziarie e primarie sul banco, il registro, la dashboard, a video,
  i dati veri). Sulla copia dei dati veri dell'11/10/2026 non ce n'e' nessuno
  (10.487 righe di primarie rete, 162 ACI, 725 secondarie, 427 terziarie).

### Il registro dei caricamenti

La preparazione di un caricamento apre una riga `in_corso` in `UploadLog` con
l'utente; la registrazione finale la chiude. Una riga rimasta `in_corso` e' la
traccia di un caricamento interrotto (archivio forse incompleto), e blocca per
dieci minuti un secondo caricamento dello stesso archivio da parte di un altro
utente. **Fa eccezione** la riga il cui messaggio comincia con «Caricamento non
riuscito» (`NON_RIUSCITO`): resta `in_corso` per non perdere la traccia, ma non
blocca nessuno, perche' li' non sta scrivendo piu' nessuno (`apriCaricamento` in
`importaBlocco` e in `importEcotyreFile`).

**Lo stato di un archivio ha una regola sola** (chiusura dell'audit,
11/10/2026): `base44/shared/registroCaricamenti.ts`, specchio
`src/lib/registroCaricamenti.js`. `leggiRegistro(Log, tipi)` legge (una lettura
`$in` di 200 righe, poi per tipo se e' piena);
`statoDelRegistro(righe, tipi, adesso)` giudica: l'ultimo **riuscito**, e il
**bloccante** (`in_corso`, oppure una riscrittura finita `parziale` o `errore`)
che nessun caricamento riuscito dopo ha **superato**; `avvisoCaricamento(a)` lo
dice a video: «Caricamento non riuscito: ricarica il file (…)», «Caricamento
interrotto: …», «Archivio in caricamento: …». Un `parziale` che **non** ha
riscritto l'archivio (aggiunta) conta come riuscito, per tutti. La usano i
motori (`statoCaricamenti` in `reportSettimanali.ts`, l'unica con quel nome), la
dashboard (`freschezzaArchivi` in `cruscotto.ts`), i conti che si salvano
(`controlloCaricamenti` in `statoArchivi.ts`), l'avviso delle pagine
(`src/components/shared/AvvisoCaricamenti.jsx`), lo strumento `caricamenti` di
EcoTyna e i ricalcoli dopo un caricamento (`caricamentoAperto` in
`src/lib/importGrandeFile.js`). Fino all'11/10/2026 le regole erano quattro: la
dashboard aveva una sua `statoCaricamenti` che conosceva solo `successo` e
`in_corso`, e dopo una riscrittura parziale i motori rinviavano mentre lei dava
i dati per freschi; `caricamentoAperto` prendeva la prima riga che non fosse in
`errore`, e dopo una riscrittura delle primarie finita «parziale» i ricalcoli
partivano su un archivio a meta'; EcoTyna considerava fallito solo un esito che
contenesse «err».

**Ogni riga che riscrive un archivio porta la modalita'.** `importPdrFile` era
l'unico a non scriverla, e un suo «parziale» dopo lo svuotamento passava per un
caricamento riuscito (anagrafica con cento PDR in meno «caricata oggi»). Ora
scrive `sostituzione` o `aggiunta`, e un errore arrivato dopo `deleteMany` porta
`sostituzione` quando l'anagrafica di prima non si e' potuta rimettere (vedi il
paragrafo dopo). Le righe `pdr` `parziale` senza modalita' gia' in archivio
valgono come riscritture (`pdrParzialeDiPrima`: la pagina chiede sempre la
sostituzione). Prova: `prove/registroPdr.mjs`.

**La sostituzione dei PDR non lascia l'anagrafica a meta'** (alta A16,
12/10/2026). `importPdrFile` legge l'anagrafica intera prima di toccarla; la
stessa lettura serve al controllo dei PDR mancanti. Se un blocco non entra dopo
tre tentativi la funzione si ferma, toglie quello che e' entrato del file nuovo
e riscrive le righe di prima senza i campi che la piattaforma assegna da se'
(`ripristinaAnagrafica`). Lo stesso vale per un errore imprevisto dopo lo
svuotamento.
- Ripristino riuscito: risposta 502 con `dati_intatti: true`. La riga del
  registro e' un errore senza modalita', come un file rifiutato a dati intatti:
  la dashboard non grida e l'ultimo caricamento riuscito resta quello.
- Ripristino non riuscito: la riga porta `sostituzione` e il registro dice di
  ricaricare il file.

Prova: `prove/registroPdr.mjs`, con un'anagrafica in memoria.

**I ricalcoli dopo un caricamento** leggono il registro una volta sola
(`registroAperti`), e ciascuno si ferma solo se e' a meta' un archivio che legge
(`LETTI_DAL_RICALCOLO`): evasione, ritiri ECT e to-do le sole primarie;
verifiche e qualifica primarie e secondarie; allineamento delle dichiarazioni e
alert dell'extra raccolta nessuno. Prima una riscrittura delle secondarie finita
«parziale» teneva fermi anche i ricalcoli delle primarie, che le secondarie non
le guardano. La riga `extra_raccolta` del registro si scrive comunque, prima dei
ricalcoli: la scheda e' gia' salvata, e senza la riga l'alert delle date
dell'extra raccolta non partiva piu' finche' non si salvava un'altra scheda.
Prove: `prove/caricamentoAperto.mjs`, `prove/cruscotto.mjs` (UNA REGOLA SOLA),
`prove/statoArchivi.mjs`.

### Lo storico delle modifiche: chi ha cambiato un numero che fa i conti (11/10/2026)

La piattaforma conserva solo `updated_date`: di un target, di un'apertura o di una tariffa non si sapeva chi l'avesse cambiata, quando, da quale valore e perche'. Il 10/10/2026 una voce della passiva e' passata da 300 a 90 €/t e lo ricordava solo la memoria di una sessione. Dall'11/10/2026 ogni scrittura a mano di quei numeri lascia una riga per campo in **`ModificaDato`**: entita, record_id, etichetta («IRIGOM S.R.L. · 2026»), campo, prima, dopo (testo; un valore che mancava resta assente, non zero), unita, operazione (create/update/delete), utente, il, origine, motivo, anno, riservato.

- **Quali campi**: `CAMPI_TRACCIATI` in `base44/shared/campiTracciati.ts`, specchio `src/lib/campiTracciati.js`. Ci sono i target degli impianti e dei raccoglitori (annui e mensili), le aperture di `GiacenzaSito`, prezzo, unita', date e stato delle tariffe, tutta la commessa, `quantita_kg`/`caricata_inviata`/`motivo_assenza` delle dichiarazioni, costi e prezzi dell'extra raccolta e le voci della passiva. Un campo nuovo che fa i conti si aggiunge li', in tutti e due i file. Dal 13/10/2026 ci sono anche i surplus sulle tariffe (`SurplusTariffa`): nome, canale, prestazione, i due importi (`euro_t_passiva` riservato, `euro_t_attiva` no, e un surplus senza importo da Ecotyre riservato in ogni campo), le date, stato, a chi e i fornitori dell'elenco. Un campo json che e' un elenco di fornitori si dichiara con `elenco: 'nome'`: l'ordine non conta, e la differenza si dice coi nomi («GATIM S.R.L. → GATIM S.R.L., EMMESSE SRLS»), mai con l'id dell'anagrafica. Prova: `prove/storicoModifiche.mjs`, sezione 8. Dal 13/10/2026 anche i recapiti del fornitore che leggono i contratti (`Fornitore`: cellulare, pec, referente; testo, non riservati; l'etichetta e' la ragione sociale, senza anno). Lo stato, il nome e i ruoli del fornitore non si tracciano e non costano letture. Prova: `prove/storicoModifiche.mjs`, sezione 9.
- **Come si scrive**: nelle pagine `scriviConTraccia(entita, id, patch, { motivo, origine })`, `eliminaConTraccia`, `creaMoltiConTraccia` ed `eliminaMoltiConTraccia` (`src/lib/scriviConTraccia.js`); nelle funzioni `traccia(svc, entita, id, patch, { utente: utenteDellaRichiesta(user), origine, motivo })` (`base44/shared/traccia.ts`). Si rilegge il record, si scrive e si registrano solo i campi tracciati che cambiano. Una scrittura senza campi tracciati non costa nessuna lettura in piu', quindi conviene far passare di li' tutte le scritture di quegli archivi.
- **Quando un valore e' cambiato**: i JSON si confrontano sul contenuto (la commessa riscrive tutte le tabelle a ogni salvataggio), i numeri come numeri, e un vuoto vale il suo default (stato 'attivo', costi dell'extra raccolta a 0). Pero' un'apertura vuota che diventa 0 si registra: un valore mancante non e' zero. Creazione e cancellazione registrano i campi diversi dal default, e almeno una riga c'e' sempre.
- **Produrre e registrare sono due passi**: ogni scrittura risponde `{ record, traccia: { scritta, righe, motivo? } }`. Se la traccia non si scrive il dato resta, e la pagina lo dice con `avvisoTraccia(esito)` o `notaTraccia`, senza finestre di sistema. Le funzioni rimandano `traccia` nella risposta (`gestisciAnagrafiche`, `preparaAnno`).
- **RLS**: create solo l'amministratore; update e delete `user_condition role «nessuno»`, cioe' nessuno: un registro che si corregge non e' un registro. E' la prima entita' chiusa a tutti in scrittura, e la regola non si scrive mai come `null`. Read dal 14/10/2026 (revisione): l'amministratore legge tutto, gli altri le sole righe con `riservato` falso, `{ "$or": [ { "user_condition": { "role": "admin" } }, { "data.riservato": false } ] }`. Lo storico tiene una copia campo per campo dei surplus, che dal 13/10 legge solo l'amministratore: con la lettura aperta, `euro_t_passiva` e tutto un accordo solo passivo (nome, riferimento, fornitori) si leggevano qui da chiunque fosse collegato. A video non cambia niente: sono le righe che la riga Storico gia' mostrava a chi non e' amministratore. EcoTyna legge con `asServiceRole` e toglie i costi con `vedeICosti`. `riservato` si scrive sempre vero o falso (`righeDiModifica`, i mesi chiusi fuori, la conferma di `preparaAnno`): una riga senza il campo resterebbe all'amministratore. Prove: `prove/chiLeggeCosa.mjs` sezione 10 e `prove/scrittureTracciate.mjs`. **Chi chiude un archivio in lettura guarda anche le sue copie**: lo storico, `ContenutoEsteso` e la passiva congelata (`ChiusuraPassivaMese`, ancora aperta).
- **A video**: `src/components/shared/StoricoModifiche.jsx`, che chiuso non legge niente (una griglia di cento target non fa cento richieste). Si trova in commessa, impianti, celle dei target, siti di Giacenze, tariffe, dichiarazioni del mese, extra raccolta e voci della passiva; il testo all'italiana viene da `src/lib/storicoModifiche.js`. Lo `storico_json` di commessa e target resta: il pallino arancione delle celle lo legge.
- **EcoTyna**: lo strumento `storico_modifiche` (`base44/shared/storicoModifiche.ts`) dice sempre che lo storico comincia a ottobre 2026: «nessuna modifica» non vuol dire «mai cambiato». Le righe dei mesi dell'attiva chiusi fuori dal gestionale (`segnaMesiChiusiFuori`, archivio DocumentoFatturazione) si dicono «documento della fatturazione attiva» e si trovano chiedendo di fatturazione o di chiusura (gruppo `['fattur','chius']` in `COSE`; revisione del 13/10/2026). Prova: `prove/storicoModifiche.mjs`, sezione 6. Le righe dei surplus si dicono «surplus sulle tariffe» (`NOMI_ARCHIVI`; prima EcoTyna diceva «SurplusTariffa», il nome interno) e si trovano chiedendo delle tariffe, perche' il surplus e' parte del prezzo, o del surplus, del Fuel Surcharge o del carburante, con tutti i loro campi, date, stato ed elenco compresi (13/10/2026). Un archivio tracciato nuovo ha il suo nome in `NOMI_ARCHIVI` e le sue parole in `COSE`. Prova: `prove/storicoModificheSurplus.mjs`. Le righe dei fornitori (dal 13/10/2026) si dicono «anagrafica dei fornitori (recapiti per i contratti)» e si trovano chiedendo dei recapiti, del cellulare, del referente, dell'anagrafica o dei contratti; niente «pec» fra le parole, perche' sta dentro «specifico» e «specchio» (chiusura del giro, 14/10/2026; prova: `prove/storicoModifiche.mjs`, sezione 9).
- **Fuori, con il loro motivo**: i caricamenti dei file (il loro storico e' UploadLog), le copie d'anno in blocco, le sistemazioni una tantum e i semi. Il debito scritto e' nella lista `DA_PORTARE` di `prove/scrittureTracciate.mjs`: chi ne porta una sull'involucro la toglie dall'elenco. Lo stesso giorno ci sono passate le aperture di `chiusuraAnno`, le righe tolte da `ripulisciDichiarazioni` (col record intero come «prima», non il riassunto dell'elenco: `prove/storicoScrittureDiServizio.mjs`) e il modello delle voci della passiva in `PassivaModulo`; `TariffeUnificate` e `NuovoAnno` dicono quando la traccia di `gestisciAnagrafiche` o `preparaAnno` non si e' scritta. Resta `ImportaReportGenerale`: centinaia di target una volta l'anno, e con l'involucro ogni scrittura diventerebbe tre richieste senza ritentativi; ogni cella ha gia' il suo `storico_json`. Va portato con una scrittura del registro a blocchi. `elaboraFatturazionePassiva`, superata, crea fornitori con `Fornitore.create`, che dal 13/10/2026 e' un archivio tracciato: risponde 410 subito dopo l'autenticazione, quel codice non gira, e sta in `FUORI_PER_NATURA` col suo motivo (chiusura del giro, 14/10/2026).
- **Revisione dell'11-12/10/2026.** I JSON si confrontano con le chiavi in ordine: il criterio di una voce della passiva riscritto dalla pagina con le chiavi in un altro ordine e' lo stesso criterio (8 voci vere di Irigom registravano un cambio mai avvenuto). Una tabella senza nessun valore (dodici null, [] o {}) vale vuoto; lo zero resta un valore. I campi json di `CAMPI_TRACCIATI` dicono l'unita' dei loro numeri (`celle` per i dodici mesi, `colonne` { colonna: { nome, unita } }): `differenzeJson(prima, dopo, campoTracciato(entita, campo))` restituisce { voce, prima, dopo, unita }, la percentuale salvata come frazione esce per cento, e a video si legge «P, percentuale 30% → 35%», «Campania, prezzo 120,00 €/t → 125,00 €/t», «giugno 900,50 t → 950,00 t». Un campo json nuovo con numeri dentro deve dire la sua unita' li'. In `storicoModifiche.ts` l'unita' di una riga si decide una volta, non lato per lato (`unitaMostrata`): su un impianto cancellato il «dopo» e' vuoto, e il target in tonnellate arrivava con 'kg'. Una riga di tabella aggiunta o tolta senza valori si dice per nome («righe Campania, Puglia, Basilicata, Calabria e Sicilia aggiunte, ancora senza valori»), mai col suo JSON.
- **La copia dell'anno passa dallo storico** (`copiaAnnoTarget`, 11/10/2026): una riga 'create' per campo, con origine «Target & Status, copia dell'anno» e motivo «copia dal <anno prima>, da confermare» (le righe del contratto, quando la copia ne toglie le variazioni del consorzio, aggiungono quali: «...; senza la variazione del consorzio del 2026 (ottobre, Puglia +100,00 t)», dal 14/10/2026, vedi «Le variazioni del contratto in corso d'anno»); il registro si scrive a blocchi per archivio (sui dati veri 329 righe, le scritture da 11 a 19). `creaTracciati`/`creaConTraccia` accetta `unoPerUno: true` per chi ha bisogno dell'id di ogni record; se una creazione a blocchi si ferma a meta', registra quelle fatte e poi lancia. La finestra della copia in `ConfigurazioneImpianti.jsx` (`DialogoAzione`) dice in ambra quando il registro non si scrive (`notaTraccia`). Le funzioni che rimandano `traccia` sono gestisciAnagrafiche, preparaAnno, copiaAnnoTarget, chiusuraAnno e ripulisciDichiarazioni.
- **La conferma di un valore copiato** (decisioni dell'utente del 13/10/2026; una regola sola per tutti dal 14/10/2026): confermare toglie il segno «da confermare» e non cambia nessun campo tracciato, ma lascia la sua riga. La regola e' `righeDiConferma` in `campiTracciati` (nei due specchi): una riga per record, sul primo campo di `CAMPI_DELLA_CONFERMA` che ha un valore. I campi sono: Tariffa `valore`; ImpiantoTargetSecondaria `target`; TargetRaccoglitore `target_tonnellate`; TargetMensile `non_raccoglie` e poi `target` (sui dati veri i 22 mesi che non raccolgono hanno il target a zero, e due righe direbbero due volte la stessa cosa); CommessaEcotyre `target_annuo_t`; GiacenzaSito `dichiara_rete` e poi `tipo_destinazione`. Il valore e' uguale prima e dopo (controllato, non cambiato); operazione update, chi, quando, origine, l'anno e il motivo `motivoDellaConferma(anno)`, «confermato il valore copiato dall'anno prima (<anno prima>), sul contratto <anno>» (`MOTIVO_CONFERMA`). La riga e' riservata come una modifica dello stesso campo. Un record senza valore ha la riga sull'ultimo campo, senza prima e dopo, e lo zero e' un valore; un archivio fuori dall'elenco (FornitoreSecondaria, che non si traccia) non lascia righe.
  Si scrive con `registraConferma`: nelle pagine `registraConferma([{ entita, record }], { origine })` (`src/lib/scriviConTraccia.js`), nelle funzioni `registraConferma(svc, confermati, { utente, origine, anno })` (`shared/traccia.ts`). Tutte le righe di una conferma partono con una scrittura sola (`registraConferme`, a blocchi di cento) e senza letture: il record e' quello in mano alla pagina unito alla risposta della scrittura. Se il registro non si scrive la conferma resta e la pagina lo dice (`avvisoTraccia`).
  La usano `DaConfermare` in `ConfigurazioneImpianti.jsx` (impianti; i collegamenti non si tracciano e si confermano con la sola nota) e `confermaRighe` in `TargetRaccoglitoriGrid.jsx` (annui e mensili; se si ferma a meta' registra quelle fatte). La usa anche il pulsante «Conferma il contratto <anno>» di `CommessaEcotyreForm.jsx`, nuovo: prima il contratto copiato si confermava solo correggendolo, e uno uguale a quello dell'anno prima restava da confermare. Quel pulsante rilegge il contratto prima di scrivere, come ogni scrittura della commessa.
  Le tariffe di `preparaAnno` (`conferma_tariffe`) usano ancora `righeConferma`, uguali campo per campo a `righeDiConferma` (`prove/confermeNelloStorico.mjs`, sezione 2): chi tocca `preparaAnno` le porta sulla regola. Sui dati veri dell'11/10/2026 confermare tutto quello che la copia del 2027 scrive in Target & Status lascia 168 righe: 6 impianti, 14 annui, 147 mensili e il contratto. «Conferma tutte» dei raccoglitori ne scrive 161 in due blocchi. Vanno aggiunte le 65 delle tariffe.
  Una correzione salvata dopo la copia conferma il record e lascia le righe di quello che cambia, non quella della conferma. Restano senza riga i siti di Giacenze e le tariffe a cui la nota della copia si toglie a mano: la nota di `storico_modifiche` lo dice e non dice piu' che le conferme di Target & Status non lasciano righe (14/10/2026). Prove: `prove/confermeNelloStorico.mjs` (regola, banco, motore, le tre pagine vere, EcoTyna), `prove/storicoModifiche.mjs` sezione 6 e `prove/inizializzazioneAnno.mjs`.
- **Un pulsante che lascia una riga nel registro non si preme due volte** (revisione del 14/10/2026). Il registro non si corregge: update e delete sono vietati a tutti, e un doppio clic lascia due righe. Il pulsante si spegne mentre la scrittura e' in volo, e un ref ferma il secondo clic di un doppio clic, che arriva prima che il pulsante spento sia a video. Esempi: `DaConfermare` in `ConfigurazioneImpianti.jsx`, `confermando` nella griglia dei raccoglitori, `salvando` piu' la rilettura con `daConfermare` nella commessa. Se la pagina toglie il segno solo rileggendo, come `DaConfermare`, una conferma riuscita tiene il pulsante spento finche' non arriva il record confermato: se la rilettura non riesce, a video resta il record di prima, ancora «da confermare», e un altro clic scriverebbe un'altra riga. Il blocco e' per id, quindi tiene anche se nel frattempo la scheda si rilegge con oggetti nuovi; arrivato il record confermato si toglie, cosi' una copia rifatta piu' avanti si puo' confermare di nuovo. Una conferma non riuscita lo riaccende. Prova: `prove/confermeNelloStorico.mjs`, sezione 4a, col doppio clic, la scheda non riletta e la conferma che non riesce; gli update si tengono fermi con `stato.trattieni`.
- **Prove**: `prove/scrittureTracciate.mjs` fallisce se una create/update/delete di un archivio tracciato compare fuori dall'involucro, anche via alias o `entities[...]`, se un'eccezione non serve piu' o se qualcuno tocca una riga di `ModificaDato`. `prove/storicoModifiche.mjs` prova regola, motore, pagine, le funzioni vere e lo strumento.

### I conti che si salvano non si salvano su un archivio a meta' (11/10/2026)

`congelaPassivaMese`, `elaboraFatturazioneAttiva`, `chiusuraAnno` con
`azione: 'salva'`, `prefatturaEcotyre` con `azione: 'carica'` e
`riepilogoDichiarazioni` con `registra` (il guardiano) rispondono **409**
`{ error, rinviato: true, caricamenti_in_corso }` e non scrivono niente, se un
caricamento **di un archivio che legge** e' in corso, interrotto o non riuscito.
Lo stato si legge **prima e dopo** aver letto gli archivi
(`controlloCaricamenti`, `base44/shared/statoArchivi.ts`), come in
`controlloQualifiche` e nei motori. Fa eccezione la prefattura: controlla solo
prima, perche' le righe salvate vengono dal file, e se rinvia annota il foglio
gia' caricato fra i file da rimuovere. Preparare il dossier della chiusura, il
confronto della prefattura e la pagina delle Dichiarazioni non rinviano: non
scrivono.

**Ogni conto guarda solo i suoi archivi.** I tipi stanno in
`registroCaricamenti.ts` e il rinvio li prende da `TIPI_RINVIO`
(`statoArchivi.ts`): l'attiva le sole primarie (`TIPI_ATTIVA`); il congelamento
della passiva primarie e secondarie (`TIPI_PASSIVA`); la prefattura primarie e
terziarie (`TIPI_PREFATTURA`); la chiusura dell'anno tutti i movimenti
(`TIPI_CHIUSURA`); il guardiano movimenti, fotografia del portale e report delle
dichiarazioni (`TIPI_GIACENZE`). Con gli stessi tipi per tutti, delle terziarie
rimaste aperte fermavano la fatturazione attiva del mese, che le terziarie non
le legge. **Il solo canale dell'extra raccolta non legge archivi caricati da
file** (`tipiDeiCanali(tipi, canali)` in `registroCaricamenti.ts`, revisione
finale dell'11/10/2026): il congelamento della passiva e l'elaborazione
dell'attiva del solo extra raccolta non si rinviano per primarie o secondarie a
meta', e `controlloCaricamenti` con tipi vuoti non legge nemmeno il registro.
Con piu' canali, o senza canale, i tipi restano quelli del conto. Chi aggiunge
una lettura a una di queste funzioni aggiunge il tipo:
`prove/rinvioCaricamenti.mjs` misura gli archivi letti con l'SDK finto e
fallisce se rinvio e letture non coincidono.

**L'avviso sopra i totali** (`AvvisoCaricamenti`) usa gli stessi tipi e lo
stesso testo della dashboard: Giacenze e Dichiarazioni `TIPI_GIACENZE`, Attiva
`TIPI_ATTIVA`, Passiva, Margine e Consuntivi `TIPI_PASSIVA`; sulla passiva del
solo extra raccolta nessuno (`tipiDeiCanali`), e l'avviso non compare. Il motivo
del 409 arriva a video dal corpo della risposta (vedi «Regole tecniche della
piattaforma e delle pagine»). Prove: `prove/rinvioCaricamenti.mjs`, sulle
funzioni vere con l'SDK finto, e `prove/statoArchivi.mjs`.

### I file del Caricamento Dati si sostituiscono (29/09/2026)

Regola dell'utente: *"i file excel che carico nel modulo 'caricamento dati' si
devono sostituire ogni volta che carico il successivo, sempre che sia stato
caricato al 100%. non ha senso mantenere un file precedente che dice le stesse
cose di quello successivo a cui aggiunge di volta in volta poche righe"*.

Sono gli export del portale Ecotyre: ogni volta ripetono tutto e aggiungono le
righe nuove. Finivano in area **pubblica** (`UploadFile`, non
`UploadPrivateFile`) e il loro indirizzo restava per sempre in
`UploadLog.file_url`, senza che nessuno li cancellasse mai: erano i file piu'
grossi del gestionale.

La regola sta in `base44/shared/fileArchivio.ts` (`fileDaSostituire`,
`sostituisciFilePrecedenti`, `arretratiDaSostituire`,
`sostituisciFileArretrati`):

- **Al caricamento**, se l'esito e' `successo` (nessuna riga fallita), i
  caricamenti precedenti dello stesso `tipo_file` perdono il file. Un esito
  `parziale`, `errore` o `in_corso` non tocca niente: uno dei file di prima
  potrebbe essere ancora l'unico completo. Agganciato in `importEcotyreFile` e
  `importPdrFile`, con un tetto di 10 per caricamento. **Oggi non trova nessun
  candidato**, e non per la cancellazione: `fileDaSostituire` e
  `arretratiDaSostituire` cercano i precedenti fra i record che hanno `file_url`
  scritto, e dal passaggio all'area privata del 30/09/2026 quel campo resta
  **sempre vuoto** (`riferimentoDaSalvare` scrive `file_url: ''` e salva
  `file_uri`; lo dice anche la descrizione del campo in `UploadLog.jsonc`).
  Riabilitare la cancellazione quindi non basterebbe: andrebbe esteso il filtro a
  `file_uri`. Verificato l'08/10/2026.
- **Ogni notte** (`alleggerisciDocumenti`) l'arretrato: per ogni tipo si tiene il
  file del caricamento riuscito piu' recente e si tolgono gli altri, fino a 40
  per giro. Serve perche' ci sono tipi che si caricano una volta al mese o meno, e
  il loro file resterebbe ad aspettare il caricamento dopo.

**Il record del registro non si tocca**: righe importate, righe in archivio
prima, forzature, foglio riconosciuto e messaggio sono il controllo
anti-regressione e la storia dei caricamenti. Se ne va solo `file_url`, e al
messaggio si aggiunge la riga che dice quando e perche'.

**La trappola**: un caricamento **forzato** riusa il file del tentativo che non
era riuscito (`pendingFileUriRef` in `src/pages/CaricamentoDati.jsx`), quindi due
record del registro puntano allo stesso indirizzo. Cancellarlo perche' "e' del
caricamento di prima" cancellerebbe il file del caricamento buono: per questo si
decide prima quali indirizzi si TENGONO e solo dopo si toglie il resto, e lo
stesso indirizzo non si cancella due volte.

Primarie, dichiarazioni di trattamento e ordini non dichiarati non hanno questo
problema: si leggono nel browser a blocchi e il file non sale mai
(`TIPI_LETTURA_BROWSER` in `src/lib/importGrandeFile.js`). Il file delle
richieste ECT invece sale e il suo indirizzo non lo conserva nessun record:
`importaRichiesteEct` non prova piu' a cancellarlo - la piattaforma non cancella -
e lo ANNOTA nel registro `FileDaRimuovere` (audit del 03/10/2026), altrimenti
nessuno saprebbe piu' che esiste.

### La copia di sicurezza di tutti gli archivi (14-15/10/2026)

Una delle cose da creare proposte all'utente il 14/10/2026 e approvate lo stesso
giorno («per me ok ... su quanto da creare, procedi pure»): «una copia di
sicurezza periodica dei dati: un'esportazione completa, per esempio ogni
settimana, scaricabile dall'amministratore. Oggi la copia dei dati veri la
facciamo a mano.» Sta in Caricamento Dati, sezione «Copia di sicurezza»
(`src/components/caricamento/CopiaSicurezza.jsx`, ancora `#copia-sicurezza`),
solo per l'amministratore; la lettura, il file e il registro stanno in
`src/lib/copiaSicurezza.js`.

- **Tutti gli archivi.** `ARCHIVI_DELLA_COPIA` ha un nome per ogni file di
  `base44/entities`, e `prove/copiaSicurezza.mjs` cade dicendo quale manca:
  **chi aggiunge un archivio lo aggiunge li'**. Ogni archivio si legge a pagine
  da 5000 in ordine di id, coi doppioni tolti, come `fetchAll`; uno che non
  finisce in cento pagine non si copia a meta' senza dirlo.
- **Piano.** Al massimo `RICHIESTE_AL_MINUTO` (40) richieste in ogni minuto,
  sulle circa settanta di tutta l'app, contando anche le letture delle due
  funzioni chiamate per gli attesi (15 e 18). Con l'avanzamento a video e
  «Annulla».
- **Un momento solo.** Prima di leggere guarda il registro dei caricamenti: con
  un caricamento in corso non comincia. Alla fine, se il registro e' cambiato
  durante la lettura, la copia non si scarica. Anche mentre la pagina stessa
  carica un file o rifa' i ricalcoli il pulsante aspetta (`fermo`).
- **Il formato e' quello della copia dei dati veri**: `{ meta, archivi, attesi
  }`, JSON compresso nel browser (`CompressionStream`, o fflate dove manca), col
  nome `treadrider-copia-AAAA-MM-GG.json.gz` sul giorno italiano. Gli attesi
  sono le risposte di `riepilogoDichiarazioni` e `calcolaGiacenze` con `{ anno
  }`, senza `registra`: non scrivono. Rinominata, la copia diventa quella del
  quinto controllo, ma solo se e' completa (vedi «I quattro controlli» e
  `../dati-veri/LEGGIMI.md`).
- **I dati non lasciano il PC.** Il file si prepara nel browser e finisce nei
  Download. Nel gestionale resta solo una riga di `CopiaSicurezza`, coi
  conteggi e senza i dati: giorno, chi, archivi, righe, kB, archivi non letti,
  attesi mancanti. La scrive e la legge solo l'amministratore; update e delete
  non li ha nessuno. Produrre il file e registrarlo sono due passi: se la riga
  non si scrive, il file c'e' lo stesso e la pagina lo dice.
- **I documenti allegati non sono nella copia**: i record tengono i loro
  riferimenti (`file_uri`, `file_url`). Un `file_uri` basta a chiunque sia
  collegato per farsi aprire il documento (vedi «Il `file_uri` e' la chiave del
  documento»), e la copia ha anche costi e prezzi dei fornitori: la sezione dice
  di conservarla come un documento riservato.
- **Solo l'amministratore.** La pagina la disegna sotto `isAdmin` e la libreria
  chiede al server chi e' collegato prima di leggere: un altro utente
  leggerebbe gli archivi riservati vuoti, e la copia direbbe il falso. E'
  l'unico lettore generico ammesso oltre agli Assegnati (vedi «I costi dei
  fornitori sono dell'amministratore»).
- **Il promemoria in «Da gestire»** (agganciato alla chiusura del 15/10/2026).
  La regola e' `vociPromemoriaCopia` (`base44/shared/promemoriaCopia.ts`, pura):
  nessuna copia negli ultimi sette giorni («L'ultima copia di sicurezza è del
  gg/mm/aaaa: scaricane una», un'informazione, attenzione dai quattordici
  giorni), mai fatta, o l'ultima incompleta (con gli archivi che mancano). Una
  copia senza gli attesi resta buona come copia di sicurezza, e il promemoria
  tace. I giorni sono italiani. Un registro non letto non e' «mai fatta»: niente
  voce. Solo per l'amministratore. Fino alla chiusura la regola non la chiamava
  nessuno, e la sezione prometteva «dopo sette giorni la dashboard te lo
  ricorda» a vuoto: ora `cruscottoOperativo` legge l'ultima riga del registro
  (una lettura, una riga, solo per lui) e `cruscotto.ts` la passa alla regola.
  La voce porta a `/caricamento-dati#copia-sicurezza`.

Prove: `prove/copiaSicurezza.mjs` (l'elenco degli archivi, il registro, la
lettura sull'SDK finto con piu' di 5000 righe e doppioni, il ritmo, il file
riaperto, che cosa ferma la copia, il promemoria a 0, 6, 7 e 8 giorni e mai
fatta, la pagina per l'amministratore e per gli altri),
`prove/copiaSicurezzaDatiVeri.mjs` (la copia della copia dei dati veri riletta
da `prove/datiVeri.mjs`), `prove/cruscotto.mjs` (il promemoria nella dashboard,
anche sul banco).

## I file, la privacy e i permessi

### I costi dei fornitori sono dell'amministratore, anche in EcoTyna (11/10/2026)

Dal 16/09 `calcolaPassiva` e `calcolaMargine` rispondono «sola lettura» a chi
non e' amministratore, e la scheda Tariffe & Anagrafiche e' sua. EcoTyna, su una
domanda di piu' mesi, faceva il conto della passiva da se' coi permessi del
servizio e lo diceva a chiunque fosse collegato; lo strumento delle tariffe dava
anche i prezzi dei fornitori. Ora `chiediAssistente` mette nel contesto della
domanda chi chiede (`cache.amministratore`), e gli strumenti `fatturazione`
(tipo PASSIVA) e `tariffe` (direzione PASSIVA) rispondono `riservato` con la
frase `COSTI_RISERVATI`; senza direzione le tariffe restano le sole attive.
**Senza contesto si nega**: un costo detto per sbaglio non si ritira. Uno
strumento nuovo che legge costi, prezzi passivi o margini deve passare da
`vedeICosti(ctx)`.

Anche lo strumento `storico_modifiche` passa da `vedeICosti`: le modifiche ai costi (tariffe passive, costi dell'extra raccolta, voci della passiva) hanno `riservato: true` in `ModificaDato`, e a chi non e' amministratore non si dicono (11/10/2026).

**Il surplus ai fornitori e' un costo** (13/10/2026). `euro_t_passiva` di
`SurplusTariffa` non esce dall'attiva: `surplus_del_mese` di
`calcolaRigheAttiva` porta solo la parte attiva. `getRiepilogoEcotyre`, che
risponde a chiunque sia collegato, elenca i campi del surplus uno per uno: un
campo nuovo del calcolo non arriva alla pagina finche' non lo si aggiunge li'.
Prima mandava `euro_t_passiva` anche a un utente qualunque. Il margine legge
gli €/t ai fornitori dal record. Prova: `prove/attivaSurplus.mjs`, sezione 5,
con ruolo 'user'.

In EcoTyna lo strumento `tariffe` dice i surplus a chi non e' amministratore
solo se Ecotyre li paga (`euro_t_attiva`), e solo con l'importo da Ecotyre
(`da_ecotyre_euro_t`). `euro_t_passiva`, riferimento e note restano fuori, e un
surplus solo passivo (un accordo con un fornitore) non si nomina nemmeno; lo
stesso fa lo storico delle modifiche (`campoRiservato`). La fatturazione
PASSIVA resta `riservato`. Prova: `prove/strumentiSurplus.mjs`, sezione 4, che
cerca nel JSON l'importo passivo e i nomi dell'accordo.

**Le pagine e i file, 13/10/2026.** La chiusura del giro del surplus ha trovato
due pagine che mostravano costi a tutti, gia' prima del surplus: il server
della passiva rispondeva 403, le pagine no. Ora a chi non e' amministratore la
Fatturazione mostra la sola Attiva (Passiva e Storico sono i documenti della
passiva coi loro importi), e l'Extra Raccolta nasconde i riquadri Costi e
Margine e le colonne Costo totale e Margine. I file Excel e PDF dell'elenco
dell'extra raccolta hanno l'analisi per produttore, coi costi e il margine, solo
con `opzioni.isAdmin === true`: senza, si nega. Prove:
`prove/costiSoloAmministratore.mjs`, `prove/extraRaccoltaExport.mjs`.

**Contratti, modelli e surplus li legge solo l'amministratore** (13/10/2026,
decisione del gruppo B). `ContrattoFornitore` (valori e importi sono i prezzi
dei fornitori, `file_uri` anche delle versioni sostituite), `ModelloContratto`
(il `file_uri` del .docx) e `SurplusTariffa` hanno `rls.read` dell'amministratore.
Chi non e' amministratore non perde niente a video: la scheda Contratti legge
`contrattiAnno`, che manda i valori al solo amministratore; i file si aprono da
`apriFile`; il surplus arriva da `leggiSurplus` (vedi «Chi legge il surplus»).
Nessuna pagina legge contratti e modelli dal browser, e nessuna funzione li legge
coi permessi di chi chiede. Prova: `prove/chiLeggeCosa.mjs`, sezioni 1-4.

**Anche le tariffe le legge solo l'amministratore** (14/10/2026, «per me ok
sulle cose da sistemare»). `Tariffa` aveva `rls.read` true. Il gestionale
mostrava le passive al solo amministratore, ma dal browser chiunque fosse
collegato leggeva l'archivio intero. Ora `rls.read` e' dell'amministratore, come
per `SurplusTariffa`.
- **Chi non e' amministratore** riceve le sole tariffe ATTIVE dalla funzione di
  sola lettura `leggiTariffe`. Nel browser si chiama `leggiTariffe()` di
  `src/lib/leggiTariffe.js`, che risponde `{ parte, tariffe }` e lancia un errore
  se la risposta e' muta.
- All'amministratore la funzione da' tutto l'archivio (`parte: 'tutto'`). Agli
  altri le attive coi soli campi di `CAMPI_TARIFFA_ATTIVA`
  (`base44/shared/tariffeVisibili.ts`): id, direzione, cliente, canale, dicitura
  del servizio, regione, provincia, classe, EER, unita', valore, date e stato.
  Restano fuori le note, i campi delle passive e quelli della piattaforma.
- Una tariffa senza direzione e' passiva. Chi e' amministratore lo decide il
  server.
- Le tariffe arrivano per data di creazione, la piu' recente prima, come le
  leggeva la pagina: fra due ugualmente specifiche `sortTariffe` tiene
  quell'ordine.
- **L'Extra Raccolta** chiede tutto a `leggiTariffe` con una chiamata sola.
  - Tutti ricevono le attive dell'extra raccolta.
  - Con `parte === 'tutto'` riceve anche i contratti dei trasporti delle
    secondarie e le passive dell'extra raccolta, che passa alla scheda
    (`tariffePassive`).
  - Prima leggeva l'archivio due volte, tre con la scheda.
  - Le tre letture della pagina (tariffe, fornitori, surplus) partono insieme.
  - Se la funzione cade la pagina lo dice, e la scheda riceve null e dice che non
    propone i costi. Mentre legge, la scheda riceve undefined.
- **La scheda dell'intervento** (`ExtraRaccoltaForm.jsx`) si monta solo per
  l'amministratore e non legge `Tariffa`. Montata per tutti, leggeva le passive
  anche nella pagina degli altri.
- **Chi legge Tariffa dal browser**: solo Tariffe & Anagrafiche
  (`TariffeUnificate.jsx`) e la Passiva (`PassivaModulo.jsx`), disegnate solo
  all'amministratore. Le funzioni la leggono tutte con `asServiceRole` (19 file il
  14/10/2026, piu' `leggiTariffe`).
- Una pagina nuova, aperta da altri, che leggesse `Tariffa` direttamente
  riceverebbe un elenco vuoto senza un errore. Nell'Extra Raccolta vorrebbe dire
  la sola base dell'anno (202) al posto della tariffa della tabella.
- **Lo storico** delle passive era gia' riservato (`campoRiservato`,
  `ModificaDato`).
- Sui dati veri dell'11/10/2026 la pagina riceve le stesse tariffe di prima, nello
  stesso ordine. Ogni mese del 2026 la fattura sui tre canali e l'extra raccolta
  dicono gli stessi numeri.

Prova: `prove/tariffeRiservate.mjs`. Copre la regola, l'inventario dei lettori, la
parte attiva, la funzione sul banco e con un SDK che applica davvero la regola di
lettura, la pagina vera con l'archivio chiuso, lo storico e i dati veri.

**La copia di sicurezza e' l'unico lettore generico ammesso oltre agli
Assegnati** (14/10/2026, chiusura del 15/10/2026). `src/lib/copiaSicurezza.js`
legge per nome (`client.entities[nome]`) tutti gli archivi, compresi `Tariffa`,
`ContrattoFornitore` e `ModelloContratto`, perche' e' una copia di tutto. Lo fa
solo per l'amministratore, che quegli archivi li legge comunque: Caricamento
Dati disegna la sezione sotto `isAdmin`, e la libreria chiede `auth.me` e si
ferma se `role !== 'admin'` prima di qualunque lettura. `prove/chiLeggeCosa.mjs`
e `prove/tariffeRiservate.mjs` (sezione 2 di tutte e due) ammettono l'eccezione
solo con queste due guardie, e hanno le loro controprove: senza il controllo del
ruolo, col controllo dopo la prima lettura o con la sezione disegnata a tutti,
cadono. Fino alla chiusura le due prove cadevano sulla copia, e `npm run prove`
era rosso.

**Due fughe chiuse dalla chiusura del giro** (14/10/2026, trovate dal gruppo
delle tariffe):
- **`controlloRotte` mandava i prezzi passivi di raccolta a chiunque.** La
  funzione controlla solo che ci sia un utente collegato, e le «tariffe da
  verificare» portavano il prezzo per destinazione, la generica, l'unita' e il
  prezzo dentro il testo; la scheda Controllo rotte di Verifiche scriveva «72
  €/t» a tutti. Ora `tariffeDaVerificare` (`shared/rotteConferimenti.ts`) li da'
  solo con `{ conPrezzi: true }`, e senza dire chi chiede si nega:
  `controlloRotte` passa `conPrezzi` solo all'amministratore. Agli altri, ed
  EcoTyna quando chiede per loro, ogni destinazione dice solo se ha un prezzo
  suo (`tariffa_propria`), e il testo «si paga la generica.» senza la cifra. La
  scheda scrive «senza prezzo suo» solo dove e' vero. Prova:
  `prove/controlloRotteTariffe.mjs` (fino a quel giorno chiedeva da utente
  semplice e pretendeva la generica di 80: pretendeva la fuga).
- **La direzione di una tariffa non si cambia.** La scheda la tiene in sola
  lettura, ma `gestisciAnagrafiche` accettava un update da PASSIVA ad ATTIVA: lo
  storico calcola `riservato` sul record di dopo, e la riga «valore 72 → 210»
  nasceva leggibile da chi non e' amministratore. Ora la funzione risponde 400
  («crea una tariffa nuova») e non scrive niente; senza direzione una tariffa e'
  passiva, e scriverci PASSIVA non e' un cambio. Prova:
  `prove/direzioneTariffaFissa.mjs`.

**Dopo la pubblicazione** si verifica dal vivo con un utente non amministratore:
l'Extra Raccolta deve avere i ricavi della fattura e nessun avviso di tariffe non
lette, `Tariffa` letta dagli strumenti dello sviluppatore deve dare un elenco
vuoto, e Verifiche > Controllo rotte non deve scrivere €/t.

### I documenti aziendali non salgono mai in area pubblica (30/09/2026)

Regola dell'utente, testuale: *"fai in modo che documenti aziendali non girino per
il web, questa cosa della sicurezza e della privacy e' molto importante, anzi
stringente"*.

**Il fatto tecnico, confermato dall'assistenza della piattaforma.** Le uniche
integrazioni sui file sono `UploadFile`, `UploadPrivateFile`, `CreateFileSignedUrl`
e `ExtractDataFromUploadedFile`: **nessuna cancella**, ne' dall'SDK ne' dal
pannello. `DeleteFile`, `DeletePrivateFile` e `RemoveFile` **non sono endpoint**:
`integrations.Core` accetta qualunque nome di metodo, per questo `typeof
core.DeleteFile === 'function'` era vero e ogni chiamata tornava "Method Not
Allowed". Non c'e' nessun limite di spazio per app; i limiti sono solo sul singolo
file (50MB documenti, 100MB video).

Quindi **un file pubblico e' una porta che si apre una volta e non si richiude
piu'**: il suo `file_url` funziona per chiunque abbia il link, per sempre.

**La regola.** Si carica solo con `UploadPrivateFile`. Un file privato non ha un
indirizzo suo: si apre con un link firmato da `CreateFileSignedUrl` che scade (60
– 3600 secondi). Chi deve leggerlo se lo fa firmare, legge, e il link muore da
solo: non serve cancellare niente, ed e' per questo che e' la difesa giusta su una
piattaforma che non sa cancellare.

`base44/shared/fileScaricabile.ts` e' il passaggio obbligato: `urlScaricabile`
firma un `file_uri` e lascia passare un `file_url` storico; `riferimentoDaSalvare`
decide che cosa si scrive sul record. Le funzioni che scaricano - `importPdrFile`,
`importEcotyreFile`, `importaRichiesteEct` - accettano `file_uri` e, solo per i
caricamenti vecchi, `file_url`.

#### Il `file_uri` e' la chiave del documento: non si manda al browser (05/10/2026)

**Precisazione dell'assistenza della piattaforma**, che corregge una cosa scritta
come vera in tre posti di questo repository:

> *«A file_uri works as a capability within your app. Any signed-in user of your
> app who holds a private file_uri can call CreateFileSignedUrl with it and get a
> working signed URL. Signing isn't checked against that user, or against the RLS
> of the record that holds the reference. There's currently no setting that limits
> CreateFileSignedUrl to asServiceRole calls from a backend function. Signed file
> URLs keep working from the browser even with core integration protection turned
> on.»*

Quindi «privato» vuol dire **irraggiungibile da fuori**, non «al sicuro da tutti».
Dentro l'applicazione un file vale quanto l'archivio che ne tiene il riferimento:
chi legge il `file_uri` apre il file, e **nascondere il pulsante non e' un
permesso**. La difesa verso l'esterno (nessun indirizzo, nulla da indovinare)
resta intera ed e' la ragione per cui si carica solo con `UploadPrivateFile`.

**Il danno che questo apriva, misurato sul codice.** La funzione
`qualificaFornitori`, che la pagina chiama a ogni apertura e che risponde a
qualunque utente collegato, mandava nel riepilogo il `file_uri` di ogni documento
di qualifica. Nella pagina il pulsante «Apri» si disegna solo per
l'amministratore, quindi l'intenzione era scritta - ma sono **DURC, polizze,
visure, patenti degli autisti e CQC**, documenti di terzi con dati personali di
dipendenti di altre aziende, e con quel valore in mano li apriva chiunque fosse
collegato.

**Come si fa adesso**, le prime due delle tre strade che l'assistenza indica:

1. **Il riferimento non esce dal server.** `qualificaFornitori` manda `ha_file`
   (c'e' / non c'e'), non il `file_uri`; `DocumentoQualifica` ha la **lettura
   riservata all'amministratore** (chi non e' amministratore vede il riepilogo
   della funzione, che gira con `asServiceRole`; le uniche letture dirette dal
   browser stanno nel percorso di caricamento e in quello del catalogo, che sono
   gia' dell'amministratore).
2. **Si apre dalla funzione `apriFile`**, che prende `{ entita, id }`, legge il
   record con `asServiceRole`, controlla chi sta chiedendo e firma con scadenza
   **300 secondi**. Non accetta ne' indirizzi ne' `file_uri` dal corpo
   (`controllaRichiesta`, `base44/shared/fileRiservato.ts:113`): il server non va
   dove gli si dice di andare. Non e' la regola di `riferimentoDalCorpo`
   (`base44/shared/fileScaricabile.ts:106-110`), che il `file_uri` dal corpo lo
   ACCETTA - e' la sola strada dei caricamenti - e rifiuta solo l'indirizzo.
   Il permesso di ogni archivio sta in un posto solo,
   `base44/shared/fileRiservato.ts` (`ARCHIVI_APRIBILI`), ed e' un **elenco**:
   un archivio che nessun pulsante apre non ci sta, perche' una funzione che firma
   qualunque campo di qualunque entita' sarebbe peggio del buco che chiude. Nel
   browser si passa da `src/lib/apriFile.js`. Prove: `prove/fileRiservato.mjs`.

**Quello che resta da decidere.** `UploadLog`, `VerificaReport`, `QuadraturaFir`,
`EsportazioneFatturazione` e `ModelloDocumento` (per quest'ultimo l'apertura a
tutti e' voluta, `chi: 'tutti'`) tengono ancora il `file_uri` su record con
`read: true`, quindi i loro file restano apribili da qualunque utente
collegato. `ContrattoFornitore` e `ModelloContratto` dal 13/10/2026 li legge
solo l'amministratore (vedi «I costi dei fornitori sono dell'amministratore»). Per `UploadLog` la lettura aperta **serve** (otto pagine la usano per
accorgersi di un caricamento nuovo), quindi la sola strada e' la terza
dell'assistenza: spostare il riferimento in un archivio che solo
l'amministratore legge, con la migrazione dei record che ce l'hanno adesso. E' una
decisione sull'accesso, non una correzione: va chiesta prima di farla.

Dal 12/10/2026 `ContrattoFornitore.versioni_json` tiene anche i `file_uri` delle
versioni sostituite, sullo stesso record, che dal 13/10/2026 legge solo
l'amministratore. Il controfirmato
caricato e il suo `DocumentoQualifica` condividono lo stesso file. La funzione
`contrattiAnno`, invece, non manda piu' nessun `file_uri`: prima lo mandava, di
contratti e modelli, a chiunque aprisse la scheda. L'inventario dei file
(`base44/shared/inventarioFile.ts`) elenca anche i file delle versioni
sostituite (`fileDelleVersioni`, in `altri_file` sulla voce del record). Sono in
uso e marcati «NON RIMUOVERE»: sono la copia mandata al fornitore o quella
firmata, e senza quelle righe un giorno sarebbero sembrati orfani. Il
riferimento finisce dove finisce quello degli altri file: nell'elenco che solo
l'amministratore scarica (revisione del 13/10/2026).

**Convertiti il 30/09/2026** (erano gli ultimi quattro pubblici): `PdrUpload`,
`SecondarieUpload`, `RichiesteEct`, `CaricamentoDati`. `prove/fileSemprePrivati.mjs`
e' la guardia: fallisce se qualcuno rimette `UploadFile` da qualunque parte.

**I file caricati PRIMA restano pubblici e non si possono richiamare.** L'unico
rimedio e' farli rimuovere a mano dal team della piattaforma, e per chiederlo
servono i loro identificativi: li produce la funzione `inventarioFile`
(`base44/shared/inventarioFile.ts`), scaricabile in CSV dal pulsante "Elenco dei
file caricati" in Caricamento Dati, solo amministratore. I pubblici escono per
primi perche' sono quelli che scottano.

**UNA RIGA DI QUELL'ELENCO PUO' ESSERE UN FILE CHE UN RECORD STA USANDO**, e va
letta prima di chiederne la rimozione. Dal 02/10/2026 l'inventario ha **due
sorgenti**: i record, e il registro `FileDaRimuovere` dei file che nessun record
usa piu' (`in_uso: false`). Il 02/10/2026 e' mancato poco che costasse caro:
l'elenco e' stato mandato all'assistenza chiedendo la rimozione dei file, e
dentro c'erano anche i **144 documenti di qualifica** dei fornitori (DURC,
contratti, polizze, visure), i **4 modelli** con cui si generano le lettere e una
stampa di quadratura. Li ha fermati l'assistenza, controllando lei: *«if we delete
them, those records will stay in your app but their documents will no longer
open»*. Da allora ogni riga del CSV porta la colonna **`azione`** - «DA FAR
RIMUOVERE: indirizzo pubblico. Prima togli il riferimento dal gestionale», «NON
RIMUOVERE: e' il documento che questo record sta usando» e, dal 02/10/2026, «DA
FAR RIMUOVERE: nessun record lo usa» (`AZIONE_PUBBLICO`, `AZIONE_PRIVATO`,
`AZIONE_ORFANO`: sono **tre**, non due) - e la funzione
restituisce `richiesta`, la frase coi conti da scrivere insieme al file
(`testoRichiesta`). Un elenco di file mandato senza dire che cosa farne si legge
come una lista di cancellazioni.

**Fatto il 02/10/2026.** L'assistenza ha rimosso dallo storage i **52 file
pubblici** (compresi i due `GESTIONEECOTYRE2026.xlsx`) e svuotato la cache CDN: i
loro indirizzi non caricano piu'. I riferimenti nei record erano gia' stati tolti
prima con `scollegaFilePubblici` (72 riferimenti), che e' l'ordine giusto. I 149
privati **non sono stati toccati, e non vanno toccati**.

**Niente password sui file.** Valutata e scartata: una password che l'app conosce
non e' un segreto dall'app, e una che deve digitare una persona rompe ogni lettura
automatica (pulizia notturna, riconfronto di una quadratura, allegati
dell'assistente). La difesa vera e' il link firmato che scade, **piu' il
riferimento che non arriva a chi non deve aprire quel documento**: il permesso di
chi puo' far firmare la piattaforma non lo controlla (vedi sopra, 05/10/2026), lo
controlla `apriFile`.

#### La piattaforma non cancella i file, e non si prova nemmeno piu'

Verificato il 30/09/2026 nell'alert del gestionale (Alert & Engine →
`archivio-file`): le tre operazioni esistono nell'SDK e **ognuna risponde
`Method Not Allowed`**. 59 file sono rimasti.

`cancellaFile` percio' **non chiama piu' niente** e restituisce **sempre**
`riuscita: false`. Non e' pigrizia: ogni tentativo costava **tre richieste a
vuoto per file** contro il limite al minuto di tutta l'app - nove a ogni domanda
con allegati fatta a EcoTyna, sei a ogni caricamento, tre a ogni quadratura - e
non poteva riuscire. Il vecchio tentativo resta come `provaACancellare`, che non
chiama nessuno, per il giorno in cui la piattaforma aggiungesse davvero
l'operazione; li' dentro vive ancora la distinzione fra **il rifiuto
dell'operazione e il fallimento di un file**: `negata` quando **tutte** le
operazioni disponibili sono state rifiutate in quanto operazioni (`Method Not
Allowed`, `501`, `not supported`), mentre basta **un** fallimento di altro genere
perche' si resti prudenti e si riprovi. Smettere per sbaglio vorrebbe dire non
cancellare mai piu'. E quando il rifiuto e' dell'operazione si smette al primo
tentativo, nei quattro punti che passano da `cancellaFile` (i documenti a 40
giorni, l'alleggerimento della qualifica, la sostituzione al caricamento,
l'arretrato notturno): ripeterlo su ogni file, con
59 file, erano 177 richieste contro il limite di **tutta** l'app, e l'esito non
cambiava.

**Il punto da non toccare mai**: sette punti del gestionale decidono su quel
`riuscita` se svuotare il riferimento al file sul record. Se `cancellaFile`
dicesse "riuscita" senza che il file sia sparito, il record perderebbe
l'indirizzo di un file che resta vivo e raggiungibile da chiunque abbia il link:
quel file non si potrebbe piu' nemmeno **far rimuovere**, perche' non sapremmo
piu' quale chiedere. E' il danno peggiore possibile in questa storia, e si evita
in un punto solo.

`supportoCancellazione` e' stato tolto. Decideva con `typeof core.DeleteFile ===
'function'`, che e' **sempre vero**: il modulo `integrations` dell'SDK e' un
Proxy che per qualunque nome restituisce una funzione che fa una POST a
`/integration-endpoints/Core/<nome>`. Non era un rilevamento, era una costante
travestita da rilevamento, e da li' nasceva un alert che diceva all'utente "le
funzioni ci sono ma vengono rifiutate" e gli consigliava di **farsele abilitare**.
Al suo posto c'e' `STATO_CANCELLAZIONE`, che e' un fatto scritto.

**L'alert ha un testo solo, e vero.** Niente ritentativo notturno promesso,
niente cancellazione da farsi abilitare, niente pulsante da cercare in un
pannello che non ce l'ha, niente spazio che cresce verso un limite che non
esiste. Dice: la piattaforma non sa cancellare, i dati e la storia scritta sono
al loro posto, **i file pubblici vanno fatti rimuovere per primi**, l'elenco si
scarica da Caricamento Dati, e l'avviso **non si chiude da solo** perche' solo
una persona sa quando il team li ha rimossi. *(Fino al 02/10/2026 le frasi erano
tre - operazioni assenti, operazioni rifiutate, fallimenti di passaggio - e il
numero nel titolo erano i file che restano, `bloccati`, non i tentativi fatti.
Prima ancora il caso vero cadeva nel terzo e l'avviso prometteva un ritentativo
che non puo' riuscire - "il gestionale riprova da solo alla prossima pulizia
notturna" - e quella era la bugia peggiore, perche' faceva aspettare. Tutto
superato da quando non si tenta piu'.)*

**C'era un QUARTO punto che ci provava, e non passava da `cancellaFile`**
(trovato e chiuso l'08/10/2026): `prefatturaEcotyre/entry.ts`, a ogni prefattura
caricata, girava a mano sui tre nomi `DeleteFile`, `DeletePrivateFile` e
`RemoveFile` con la guardia `typeof core[n] !== 'function'`, che **e' sempre
vera** per il Proxy dell'SDK - lo stesso falso rilevamento per cui
`supportoCancellazione` e' stato tolto. Erano tre richieste a vuoto per
caricamento, cioe' esattamente il costo che questa sezione dichiara eliminato. E
c'era di peggio: quel file non veniva annotato in `FileDaRimuovere`, e
`PrefatturaEcotyre` non tiene campi file, quindi **non compariva nell'inventario e
non si sarebbe potuto far rimuovere** - il danno che il paragrafo qui sopra dice
di aver chiuso in un punto solo. Adesso il giro a mano non c'e' piu' e il foglio
letto si annota nel registro (`annotaFileDaRimuovere`, come in
`importaRichiesteEct`), quindi esce nell'inventario con «DA FAR RIMUOVERE: nessun
record lo usa». **Due guardie in `prove/fileDaRimuovere.mjs`**: i tre nomi nel
CODICE possono stare solo in `shared/fileArchivio.ts` (nei commenti dappertutto,
o questa storia non si potrebbe scrivere), e le due funzioni che leggono un foglio
e non ne conservano l'indirizzo devono annotarlo.

**La sostituzione dei file percio' non puo' funzionare** finche' la piattaforma
non abilita la cancellazione. Il record del registro perde `file_url` solo se il
file se ne va davvero, quindi non si e' creata nessuna bugia: l'archivio dice il
vero, e' lo spazio che non si libera.

**L'alleggerimento a 40 giorni continua a funzionare**, perche' li' se ne va il
TESTO (i campi pesanti e le parti in `ContenutoEsteso`), non il file: verificato a
video il 30/09/2026, la colonna "Dettaglio fino al" delle Verifiche dice 07/11 e
08/11 e le pagine Verifiche e Verifiche Fornitori funzionano. Il peso vero erano
quei testi e gli Excel del portale; i file allegati sono un extra che non dipende
da noi. Da chiedere all'assistenza della piattaforma.

#### I link pubblici non restano scritti nei record

`UploadLog` ha `rls.read: true` - serve, otto pagine ci si agganciano per
accorgersi di un caricamento nuovo - quindi **qualunque utente collegato** poteva
leggere il registro e trovarci l'indirizzo pubblico di `GESTIONEECOTYRE2026.xlsx`
e di ogni export del portale. Restringere la lettura avrebbe rotto
l'aggiornamento automatico di quelle pagine; la via chirurgica e' svuotare il
campo, che e' il rimedio che descrive l'assistenza ("removing it from your
records hides it in your app").

Lo fa `scollegaFilePubblici`, pulsante "Togli i link pubblici dai record" in
Caricamento Dati, solo amministratore. **Non e' reversibile**: il campo svuotato
non torna. Gli indirizzi, invece, non si perdono: dall'audit del 03/10/2026 la
funzione li annota nel registro `FileDaRimuovere` prima di svuotarli, e
l'inventario li rilegge da li' come orfani, quindi l'elenco per il team della
piattaforma si scarica anche dopo. Per questo la
funzione senza `conferma: true` si limita a contare, e se un archivio non si
riesce a leggere non tocca niente: svuotarne una parte lascerebbe gli altri link
in giro senza dirlo.

### La conservazione dei documenti dei fornitori (29/09/2026)

Richiesta dell'utente, testuale: *"quando carico i documenti dei fornitori, che
siano report settimanali o mensili a consuntivo o gli ordini assegnati ad inizio
mese, al fine di non appesantire il dominio, devono automaticamente cancellarsi
dopo i famosi 40 giorni, ma deve restare il contenuto ovvero la storia scritta
per poterne fruire in futuro"*.

**I file non sono il problema.** Un Excel o un CSV si legge nel browser e sulla
piattaforma non sale niente; solo un PDF o un'immagine vengono caricati perche'
l'agente li legga, e si cancellano subito dopo la lettura. Quello che pesa e' il
CONTENUTO: righe lette ed esiti riga per riga finiscono in `ContenutoEsteso` a
pezzi da ottomila caratteri (`base44/shared/testoLungo.ts`).

**La regola, una sola** (`base44/shared/conservazione.ts`): al quarantesimo
giorno **dal caricamento** — non dalla competenza, o un consuntivo di settembre
che arriva a novembre nascerebbe scaduto — di un documento se ne vanno le righe
lette e il confronto riga per riga. **Il record non si cancella**: restano i suoi
contatori, il verdetto per canale e una **storia scritta** in italiano di
circa mille caratteri, al massimo 4300: `tagliaStoria` taglia a 4000 e `conNota`
aggiunge in coda la nota (altri 300). Prima di questa data le verifiche dei report settimanali
si cancellavano per intero e le liste degli assegnati dopo due mesi: se ne andava
proprio la storia che l'utente vuole tenere.

- **A giorni** (`daAlleggerire` di `shared/conservazione.ts` - l'omonima di
  `shared/fileArchivio.ts` e' quella dei tre anni della qualifica - piu'
  `alleggerisciDocumenti`, workflow notturno alle 3:15): `VerificaReport`,
  `QuadraturaFir`, `ConsuntivoFornitore`.
- **A mesi** (`alleggerisciVecchi` in `base44/shared/evasioneAssegnatiDati.ts`):
  `ListaAssegnati` e `ControlloEvasione`, perche' il controllo dell'evasione
  lavora ancora sulle liste del mese in corso e di quello prima. Due padroni
  della stessa cancellazione sarebbero un bug: qui i quaranta giorni non si
  aggiungono, si coordinano.
- **Subito**, senza aspettare i quaranta giorni
  (`alleggerisciControlliSuperati`): i `ControlloEvasione` **superati**. Ogni
  caricamento delle primarie ne deposita uno nuovo per ogni lista, col dettaglio
  di ogni richiesta: era la voce piu' pesante di tutto l'archivio. Di ogni lista
  resta per esteso l'ultimo. Vale la regola generale del gestionale: vale il piu'
  recente, il superato resta nello storico.

**La storia sta in un campo normale** (`storia`), mai scritto con `valoreCampo`:
sopra gli ottomila caratteri tornerebbe in `ContenutoEsteso`, cioe' il peso che
si e' appena tolto. Per questo `tagliaStoria` taglia a 4000 e lo dice. La storia
**non contiene i NOSTRI costi**: il record lo legge chiunque (`rls read: true`) e
la fatturazione passiva e' riservata all'amministratore, quindi `storiaConsuntivo`
riporta chili e formulari ma non l'importo previsto ne' gli scarti in euro. L'unico
euro che la storia dice e' `importo_consuntivo`, l'importo che il fornitore ha
scritto sul proprio documento (`conservazione.ts`): e' un suo dato, non un nostro
costo, ed e' voluto.
Le storie non sommano mai i canali (regola 3) e i pesi seguono `formatoKg`.

**Tre cose da non rompere:**

1. **L'ordine di `togliIlDettaglio`**: prima si svuotano i campi e si scrive la
   storia, poi si cancellano le parti in `ContenutoEsteso`, e il giorno
   (`alleggerito_il`) si segna per ULTIMO. Al contrario, nel campo resterebbe il
   segnaposto `@parti:N` senza le parti e `leggiCampo` lancerebbe: non un campo
   vuoto, un campo rotto. Un alleggerimento interrotto si riconosce dai campi
   vuoti con la storia scritta e senza il giorno, e `daAlleggerire` lo riprende:
   senza quella ripresa le parti pesanti resterebbero in archivio per sempre,
   perche' si cancellano per record e il record non le nomina piu'. Al secondo
   passaggio la storia **non si riscrive**, o diventerebbe povera.
2. **Un documento senza dettaglio non si riconfronta e non si esporta.**
   `daRiconfrontare` esclude gli alleggeriti (una dichiarazione di nessuna
   movimentazione non ha righe per definizione e senza quella esclusione si
   rigonfierebbe), `senzaRighe` esclude le liste senza righe da `eseguiControlli`
   e da `altreListe`, e i pulsanti PDF/Excel si spengono con una guardia anche
   dentro `scarica`: un PDF che va all'impianto col verdetto giusto e zero
   formulari dentro e' una bugia coerente, il peggio.
3. **Il motivo si scrive vero.** `nota(oggi, motivo)`: quaranta giorni, mese
   chiuso, lista piu' recente, superato dal controllo del giorno X. Scrivere
   "caricato da oltre quaranta giorni" su un controllo superato in giornata
   sarebbe una bugia che resta in archivio per sempre.

Ricaricare il file azzera `alleggerito_il` e `storia`: il documento torna intero.

### La qualifica dei fornitori

**Un documento della qualifica si chiede per ruolo oppure a fornitori indicati
per nome, mai in tutti e due i modi.** Il catalogo nasceva solo per ruolo
(raccolta, trasporto secondarie, impianto, stoccaggio, cliente): un documento che
riguarda un fornitore solo — le patenti degli autisti, la CQC, un'autorizzazione
particolare — andava messo su un ruolo intero e risultava mancante a tutti gli
altri, sporcando gli alert. Ora `TipoDocumentoQualifica.solo_per_soggetti` porta
l'elenco `[{ chiave, nome }]`: quando c'e', il documento vale SOLTANTO per quei
fornitori e i ruoli non contano (`richiestoA` in `base44/shared/qualificaFornitori.ts`).
La chiave e' la ragione sociale normalizzata, la stessa delle movimentazioni.
Scadenze, mancanze e non conformita' passano dalla valutazione di sempre, quindi
gli alert e l'email giornaliera li coprono senza modifiche.

**Una voce intestata a un fornitore che nell'anno non risulta e' un errore
silenzioso**: nessuno la chiederebbe mai e sembrerebbe tutto a posto.
`anomalieCatalogo` la segnala, e la segnalazione arriva in tre posti: il riquadro
rosso in cima al modulo, la dashboard (dal campo `anomalie_catalogo` del
RiepilogoQualifica, senza rifare la valutazione) e l'email del controllo
giornaliero, che parte anche quando non c'e' nessun'altra novita'.

**Un DURC non e' una visura e non e' una White List.** Caricare un documento
valido nella casella sbagliata e' l'errore piu' facile da fare e il piu' difficile
da vedere. L'agente lo controlla gia', ma il suo e' un giudizio:
`base44/shared/tipiDocumento.ts` e' la rete di sicurezza che non dipende dal
modello. Riconosce la famiglia del documento dal nome della casella e dal tipo
letto nel file, e segnala solo quando riconosce con certezza tutti e due e sono
diversi. Se anche solo uno dei due non si riconosce non dice niente: meglio un
controllo in meno che dichiarare sbagliato un documento giusto. Il confronto si
rifa' anche dentro `statoRequisito`, cosi' vale per i documenti analizzati prima
che il controllo esistesse, senza doverli rileggere con l'agente.

**Quando il file non si legge si dice, e si dice cosa fare.** `problemiLettura`
distingue tre casi: il modello dichiara il file illeggibile; il modello dice di
averlo letto ma non ne ha tirato fuori un solo dato (scansione senza testo, file
protetto, pagina bianca); il tipo non e' dichiarato. I primi due sono bloccanti,
quindi il requisito diventa "non conforme" e finisce negli alert, nell'email
giornaliera e nei conteggi della dashboard. Se invece e' l'analisi a fallire, il
motivo viaggia insieme allo stato "da verificare" e arriva anche nell'email.

**I 97 documenti caricati dall'archivio nel settembre 2026 non hanno
`analisi_json`**: furono letti con l'OCR di Windows e scritti a mano, non
dall'agente. Il controllo sul tipo quindi non li tocca (non c'e' una lettura da
confrontare) e non produce falsi allarmi. Non si usa `sintesi` come ripiego a
questo livello: quelle sintesi dicono "trovato nell'archivio contratti" e
farebbero scattare la famiglia "contratto" su mezzo catalogo.

**Il controllo giornaliero della qualifica non legge i documenti: li valuta.**
E' la distinzione che ha tenuto nascosto per mesi un quadro falso. Il workflow
`ControlloQualificaFornitori` (7:30, giorni feriali) ricalcola stati e scadenze e
manda il promemoria, ma chi legge davvero i file e' l'agente, e l'agente lo
chiama solo chi carica un documento. I novantasette documenti caricati
dall'archivio risultavano "analizzati" senza che nessuno li avesse mai letti: il
report li dava per buoni. Il presidio (`presidioQualifica`, workflow
`PresidioDocumentiQualifica`, 6:40 dei giorni feriali, cinquanta minuti prima del
promemoria) chiude il buco: prende fino a sei documenti per giro, nell'ordine in
cui conviene guardarli - mai letti, letture fallite, letture interrotte da piu'
di un quarto d'ora, documenti senza scadenza ricavata, letture piu' vecchie di
sei mesi (`daAnalizzare` in `base44/shared/analisiDocumento.ts`). Non rilegge
tutto ogni volta: un file non cambia, cambiano le norme e il tempo.

**Da gennaio a marzo resta da qualificare chi ha lavorato nell'ultimo trimestre
dell'anno prima** (prova generale del cambio d'anno, 15/10/2026, difetti 25 e
33). `individuaSoggetti(base44, anno, { oggi })` aggiunge chi ha terminati da
ottobre a dicembre dell'anno prima (giorno italiano della fine trasporto),
segnato `da_ultimo_trimestre` e `ruoli_da_ultimo_trimestre`, come i contratti
(decisione dell'utente del 13/10/2026); senza `oggi` conta solo l'anno
(`contrattiAnno` e `preparaAnno` guardano l'anno prima da se', e con `oggi`
l'ultimo trimestre lo conterebbero due volte). Prima il 01/01/2027 il controllo
delle 7:30 trovava 0 soggetti, i contratti scaduti il 31/12 non si dicevano e
la CQC di un fornitore del 2026 era «errore del catalogo» ogni giorno feriale.
Passano `oggi` `controlloQualifiche`, `qualificaFornitori` (la pagina, la
fatturazione passiva e il ricalcolo dopo un caricamento: senza, alle 9
riscriveva il riepilogo del 2027 salvato alle 7:30 senza gli scaduti) e
`presidioQualifica` (il contesto dell'intestatario). **Il registro dei
promemoria a cavallo dell'anno**: da gennaio a marzo `controlloQualifiche`
legge anche `AvvisoQualifica` dell'anno prima (una lettura filtrata per anno):
una soglia che non si ripete non riparte, un promemoria che si ripete aspetta i
sette giorni dall'ultimo invio anche se era del 31/12 (l'Albo di C.L. SERVICE
arrivava il 28/12/2026 e di nuovo il 05/01/2027). Si scrive solo il registro
dell'anno. Prove: `prove/presidiNotturni.mjs` (la qualifica al cambio d'anno),
`prove/cambioAnnoRitocchi.mjs` (1).

**L'analisi di un documento sta in `base44/shared/analisiDocumento.ts`**, non
dentro la sua funzione, perche' la usano in due: il pulsante del modulo e il
presidio. Un documento si controlla allo stesso modo comunque lo si guardi. Chi
analizza piu' documenti di fila passa `conoscenza` (le voci approvate lette una
volta sola) invece di rileggerle a ogni giro.

**La rianalisi dei 97 documenti, 21/09/2026**: 5 minuti a blocco di 48, due
richieste in parallelo, zero errori, circa 194 chiamate al modello. Il piano
builder ne rinnova 10.000 al mese: il costo di un controllo completo e' un giorno
di consumo normale. Il quadro vero che ne e' uscito: nessun fornitore
qualificato, 41 documenti scaduti, 56 mai ricevuti, 29 non conformi, e trentaquattro
conferme manuali revocate perche' la lettura ha trovato problemi bloccanti.

**Lo spazio dell'archivio: nel gestionale va solo cio' che scade e va
controllato.** Il contratto firmato si', gli allegati no: standard operativi,
disciplinari e descrizioni dei servizi non scadono e nessuno li verifica, quindi
restano nel repository sul computer, dove si leggono quando servono. Per
riferimento, il 21/09/2026 la cartella `CONTRATTI SUBFORNITORI` pesava 1,4 GB
mentre i documenti caricati nel gestionale erano 99. Due presidi: al caricamento
un file oltre 5 MB fa comparire un avviso (quasi sempre e' una scansione a colori
ad alta risoluzione, che in scala di grigi a 200 dpi pesa un decimo e si legge
uguale); e `alleggerisciQualifica` toglie il file ai documenti **sostituiti** da
oltre tre anni, lasciando la scheda - sintesi, scadenza, problemi, motivo della
sostituzione - che e' la storia del fornitore. Non e' automatico apposta:
cancellare file e' una decisione, l'amministratore guarda prima l'elenco. Se la
piattaforma non espone una cancellazione, la funzione si ferma al primo tentativo
e lo dice, invece di svuotare `file_uri` lasciando i file dov'erano.

**La spunta «verificato a mano» non e' una scadenza** (A65, 12/10/2026). Per i
tipi con scadenza (`tipo_scadenza` diverso da `nessuna`) un documento senza data
resta «da verificare» anche con la spunta, e lo dice («segnato come verificato a
mano, ma senza data di scadenza»). Fino ad allora il controllo stava dentro
`if (!doc.verificato_manualmente)`, e la spunta rendeva il documento valido per
sempre. La maschera «Correggi» (`motivoCorrezioneNonSalvabile` in
`src/components/qualifica/SoggettoDettaglio.jsx`) spegne «Salva» e dice
perche'; anche il salvataggio rifiuta, e la maschera resta aperta se non salva.
La regola vera sta in `statoRequisito`, cosi' vale anche per le spunte gia'
salvate.

**Le date lette dal modello si controllano, non si prendono a scatola chiusa**
(A64, 12/10/2026). Il controllo e' `dateIncongruenti` in
`base44/shared/qualificaFornitori.ts` e guarda tre cose: l'emissione nel futuro,
la scadenza che non viene dopo l'emissione (anche la stessa data letta due
volte) e la durata oltre la misura scritta. La misura la da' `durataScritta`:
prima `validita_mesi`/`validita_giorni` del catalogo, poi `DURATE_SCRITTE` per
famiglia, cioe' visura 6 mesi, DURC 120 giorni, Albo 5 anni e White List 12 mesi
dalla base di conoscenza, CQC 5 anni dal catalogo proposto. Il margine e'
`MARGINE_DURATA`, un quarto della durata. Serve perche' un rinnovo anticipato
dell'Albo decorre dalla scadenza precedente: sui provvedimenti veri lo scarto
arriva a tre mesi (ECO.GEA, provvedimento del 30/04/2026, validita' dal
31/07/2026 al 31/07/2031). Un documento con date incongruenti va «da verificare»
col motivo; uno scaduto resta scaduto, col motivo accanto. Si guardano solo le
date della lettura: una scadenza scritta a mano o la spunta chiudono il dubbio.
Il controllo sta in `statoRequisito` e non in `analizzaDocumento`, che salva la
data com'e', cosi' vale anche per i documenti letti prima. Una famiglia entra in
`DURATE_SCRITTE` solo se la sua durata e' scritta nel gestionale (base di
conoscenza o catalogo): l'autorizzazione d'impianto non c'e', perche' per l'AIA
la durata e' «secondo il provvedimento». Resta all'utente decidere se ogni
scadenza letta debba aspettare un clic dell'amministratore.

**Un contratto si firma prima di decorrere** (revisione del 13/10/2026). I
contratti dell'anno dopo si generano con la data della firma uguale alla
decorrenza (`segnapostiContratto.ts`, DATA_FIRMA = DATA_INIZIO: «Massafra, 02
Gennaio 2027») e si controfirmano a dicembre. La lettura prende quella data come
emissione. Per la famiglia «contratto» (`eContratto`: la categoria del catalogo o
il nome) un'emissione nel futuro non e' «letta male» fino all'anno dopo quello di
oggi (`firmatoPrimaDellaDecorrenza`): il contratto e' valido e il fornitore resta
qualificato. Oltre l'anno dopo resta un anno letto male. Gli altri due
controlli, scadenza dopo l'emissione e durata, valgono anche per i contratti. Il
requisito porta una nota informativa (`notaDecorrenza`): da quando vale il
contratto e, se accanto c'e' un contratto gia' in vigore, che fino ad allora
resta in vigore quello. La nota si aggiunge solo a un requisito valido o in
scadenza, in fondo ai problemi. Fino al 13/10/2026 stava in testa ai problemi di
ogni stato: con una rilettura fallita o con la scadenza non letta, la pagina e il
promemoria, che mostrano il primo problema, dicevano la nota al posto del
motivo. `statoRequisito` da solo non sa se c'e' un contratto in corso: a un
fornitore nuovo dice solo da quando vale. Chi lo sa lo passa con
`contesto.contrattoInCorso` (`documentoDelRequisito`). Anche chi valuta il file
lo sa: `FIRMA_ANTICIPATA` in `analisiDocumento.ts` entra nel prompt solo per i
contratti.

**Il contratto in corso vale fino alla decorrenza del nuovo** (revisione del
13/10/2026). Se il contratto controfirmato caricato dalla scheda Contratti
(`salvaContrattoFornitore`) decorre dopo oggi (`data_inizio`, o il 1 gennaio del
suo anno), i documenti della voce che oggi valgono ancora, cioe' con una
scadenza, anche scritta a mano, non passata, restano attivi. Il firmato di prima
dello stesso contratto e i documenti scaduti o senza scadenza si sostituiscono
come sempre. Per la famiglia contratto (`documentoDelRequisito` in
`qualificaFornitori.ts`) il migliore vale solo per la successione (revisione
del 13/10/2026). Si mette da parte il contratto, non piu' vecchio di quello in
corso, che decorre dopo oggi (emissione letta nel futuro) o di cui la decorrenza
non si conosce ancora (non letto, lettura fallita, date che non stanno in piedi)
e che non vale gia' da solo. Il requisito si regge sul contratto in corso
finche' il successivo non e' valido; letto bene, il successivo ne prende il
posto. Cosi' il 2027 ancora da leggere, o con la lettura fallita, o con un
bloccante del modello, non fa scendere il fornitore «da completare» o «critico»
finche' il 2026 vale. Il successivo messo da parte porta una nota col suo stato
e il motivo: attenzione, oppure informativa se e' in analisi. I contratti che
valgono insieme (rete e ACI dello stesso anno) si guardano tutti: regge il
requisito il peggiore (scaduto o non conforme, poi da verificare, in analisi,
in scadenza, valido; a parita' il piu' recente). Cosi' uno non conforme fa il
fornitore critico e la fatturazione passiva avvisa prima di pagare. Prima
vinceva sempre il migliore fra i documenti attivi, e un ACI non conforme
accanto alla rete valida lasciava il fornitore qualificato. Un documento piu'
vecchio del contratto in corso (emissione, o caricamento, prima della sua) non
e' «caricato dopo»: si guarda insieme agli altri e, scaduto, si chiude come gli
altri finiti. Gli altri tipi di documento restano col piu' recente. Un
contratto scaduto e piu' vecchio di quello scelto, quando quello scelto e'
valido o in scadenza, sta fra i `superati` del requisito: non porta alert ne'
promemoria, e `salvaRiepilogo` lo manda fra i sostituiti
(`chiudiContrattiSuperati`: una scrittura per documento, nessuna lettura in
piu'). E' il passo della decorrenza: senza, il vecchio
restava attivo per sempre e il presidio lo avrebbe fatto rileggere ogni 180
giorni. La chiusura la fa anche il calcolo chiesto da chi consulta la pagina,
come il riepilogo. Due contratti veri dello stesso anno (rete e ACI) restano
attivi finche' valgono. Un contratto nuovo letto male, scaduto prima di
cominciare, non si chiude. Prove: `prove/qualificaDocumenti.mjs`,
`prove/contrattoFirmato.mjs` e, per la successione e i contratti che valgono
insieme, le sezioni 1, 2 e 7 di `prove/contrattoNuovoRaggiungibile.mjs`.

**Il contratto nuovo si raggiunge dalla scheda** (revisione del 13/10/2026). Il
requisito espone gli altri contratti attivi della voce uno per uno
(`altri_documenti`: id, file, date, stato, problemi, lettura e `relazione`,
cioe' 'successivo', 'in_corso' o 'insieme'; mai il file_uri) e
`contratti_in_corso` (quelli in vigore oggi, con una scadenza non passata). La
nota sul contratto caricato dopo porta `documento_id`. La scheda del fornitore
(`SoggettoDettaglio.jsx`) da' a ogni documento i suoi pulsanti Apri, Rianalizza
e Correggi (`AzioniDocumento`, ciascuno con la sua maschera, che scrive solo su
quel documento) nel riquadro `DocumentoAccanto`, e la nota sta li', non sopra i
pulsanti del documento del requisito. Prima i pulsanti stavano solo su
`req.documento`: col 2027 letto male accanto al 2026, «Correggi» scriveva la
scadenza del 2027 sul 2026, e il 2027 non si apriva ne' si rileggeva. La pagina
si aggiorna da sola finche' c'e' un documento in lettura, anche fra gli altri
(`documentoInLettura` in `QualificaFornitori.jsx`). Il caricamento a mano
(«Sostituisci») non manda fra i sostituiti i `contratti_in_corso`
(`documentiDaSostituire`): restano attivi fino alla scadenza, e li chiude
`chiudiContrattiSuperati`, con un avviso a video. Gli altri documenti, e i
contratti scaduti, non conformi o da verificare, si sostituiscono come sempre.
Prova: `prove/contrattoNuovoRaggiungibile.mjs`.

**La classe dell'Albo si legge nelle forme vere, e un controllo saltato si dice**
(A66, 12/10/2026). `letturaClasseCategoria4` in `base44/shared/classeAlbo.ts`
legge le forme dei provvedimenti e delle visure dei fornitori: «categoria 4
classe C», «Categoria 4: raccolta e trasporto ... - classe E», «categoria 4 e 5
classe F», «categoria 4 in classe D», «4 - F» (a margine del provvedimento),
«4F», «Cat. 4_E», «4B e 5C». Legge anche la forma per esteso del provvedimento,
«Raccolta e trasporto di rifiuti speciali non pericolosi - Classe: quantita'
annua ... inferiore a 3.000 t.»: la classe la dice il limite superiore
(`classeDaQuantita`). Fra il 4 e «classe» non passa una cifra (salvo il codice
EER) ne' un'altra «categoria». «CATEGORIE 4 E 5» non e' la classe E, e due classi
diverse per la 4 danno null. Se un raccoglitore con target maggiore di zero non
ha la classe da nessun documento, il documento dell'Albo (casella di famiglia
`albo_gestori`) porta l'avviso di attenzione «Controllo classe/target non
eseguito», col perche' (mai letto, classe non scritta, classi in contrasto) e
col target. L'avviso non cambia lo stato, quindi nemmeno i conti del modulo. Le
prove sono `prove/classeAlbo.mjs` e `prove/qualificaDocumenti.mjs`, che fa
girare anche `qualificaFornitori` vera sul banco.

La variazione di classe vera ha le quantita' fra parentesi: «da Classe: F
(quantita' ... inferiore a 3.000 t.) a Classe: E (quantita' ...)» (Green Tyre,
prot. 19235/2026). Vale la classe nuova, la E. Fino al 13/10/2026 si leggeva la
F e, con piu' di 3.000 t, il provvedimento della variazione stesso diventava non
conforme. «CATEGORIA 4 E CATEGORIA 5 CLASSE F» non e' la classe E: dopo la E viene
un'altra categoria.

**Il REN non e' l'Albo gestori.** Dal 13/10/2026 «Iscrizione all'Albo
autotrasportatori conto terzi (REN)» ha la sua famiglia in `tipiDocumento.ts`,
`albo_autotrasportatori`. Le parole sono «albo autotrasportatori», «albo degli
autotrasportatori», «autotrasportatori conto terzi», «autotrasporto di cose per
conto di terzi» e «albo nazionale degli autotrasportatori». «Iscrizione all
albo» e «provvedimento di iscrizione all albo» sono parole `generiche` dell'Albo
gestori: contano solo se nel testo non c'e' nessuna parola vera di nessuna
famiglia. Contro l'altro Albo danno «incerto», non «diverso», perche' stanno nel
nome di tutti e due. Nel RENTRI la parola «registro elettronico nazionale» e'
diventata «registro elettronico nazionale per la tracciabilita»: da sola e' il
nome del REN. Cosi' `problemaTipoSbagliato` segnala un provvedimento dell'Albo
gestori nella casella del REN e un certificato REN nella casella dell'Albo. Non
segnala invece un REN letto in uno dei suoi modi: prima un REN letto come
«Registro Elettronico Nazionale» risultava RENTRI e diventava «documento
sbagliato». `famigliaDocumento` in `qualificaFornitori.ts` resta, e riconosce
l'Albo gestori solo se il testo nomina i «gestori». La usano il controllo della
classe (`eIscrizioneAlbo`) e la durata (`durataScritta`): sul REN niente avviso
«controllo classe/target non eseguito» e niente cinque anni.

**I contratti** passano da generato a inviato a controfirmato, con la data di ogni
passaggio: un contratto generato non e' un contratto fatto.

**I contratti si fanno per canale: rete e ACI, mai sommati (giro K3,
12/10/2026).** Decisione dell'utente dell'11/10/2026: «si deve generare tutti i
contratti sia rete che aci come raccolta, trattamento e stoccaggio». La funzione
`contrattiAnno` legge; le regole stanno in `base44/shared/contrattiDellAnno.ts`
(`situazioneContratti`). Ogni soggetto ha una riga per prestazione e per canale
in cui ha quel ruolo nei movimenti dell'anno: raccolta ACI = trasportatore nelle
primarie ACI, trattamento ACI = impianto che riceve ACI, stoccaggio ACI =
piazzale che stocca ACI, le secondarie col loro canale. Il trasporto delle
secondarie resta UN contratto per vettore, registrato RETE e mostrato «rete e
ACI»: le tariffe del trasporto sono «TUTTE» e il format non parla di canale.
L'extra raccolta non ha contratti annuali. Tre prestazioni non sono contratti a
parte e non si contano (`non_dovuto`, col motivo): il trattamento di rete di un
impianto che Ecotyre paga da se' (`trattamento_fatturato_da_ecotyre`, Tecnogum),
quello compreso nel prezzo unico della raccolta (`comprensiva_trattamento`,
Green Tyre sull'ACI) e lo stoccaggio ACI di chi sull'ACI raccoglie e stocca
(vedi sotto).

**Raccolta e stoccaggio ACI: un contratto solo, coi due prezzi (decisione
dell'utente del 13/10/2026, rivista il 14/10/2026).** Chi sull'ACI raccoglie e
stocca (Nappi Sud; Ecorecuperi negli anni in cui lo fa) ha UN contratto ACI
«raccolta e stoccaggio», con CORRISPETTIVO_RACCOLTA e CORRISPETTIVO_STOCCAGGIO,
non due; a dicembre l'utente dara' i format aggiornati. Si registra come
raccolta ACI (`tipo_contratto` 'raccolta', archivi invariati). Il suo modello e'
una raccolta ACI che ha fra i punti il prezzo dello stoccaggio
(`eModelloRaccoltaEStoccaggio` in `segnapostiContratto.ts`): lo dice il format,
non un campo. In «Modelli dei contratti» c'e' la riga «Raccolta e stoccaggio
ACI» accanto a «Raccolta ACI», e un format non si salva nella riga sbagliata. Ha
i due prezzi il contratto vero di Nappi Sud 2026 (raccolta 92,00 e 82,00,
stoccaggio 16,00; nel 2024 61,00 e 10,00). Quello di Ecorecuperi del 2024
(«Raccolta&stoccaggio») NO: ha un prezzo solo, «Trasporto+Stoccaggio» 105,00, e
in quella riga si rifiuta con un messaggio che lo spiega. La riga della raccolta
ACI ha `raccolta_e_stoccaggio` e propone i due prezzi: parametro `stoccaggio` di
`valoriDelContratto`, avvisi «Per la raccolta, …» e «Per lo stoccaggio, …»,
tariffe con `servizio`. Il file si chiama «Contratto Raccolta e stoccaggio ACI
<anno> - …». La riga dello stoccaggio ACI e' `non_dovuto` («sta nel contratto di
raccolta e stoccaggio») e non si conta, nemmeno fra i da decidere. Sulla rete i
contratti restano due.

Chi decide se il contratto e' unico:
- senza un contratto di raccolta ACI dell'anno, i movimenti: le due righe ACI
  nello stesso stato (tutte e due attese o tutte e due da decidere) e nessun
  contratto di stoccaggio ACI a parte. Chi ha smesso di stoccare o di
  raccogliere ha le righe di sempre;
- con il contratto di raccolta ACI dell'anno, il contratto stesso
  (`eContrattoRaccoltaEStoccaggio`). Decide il suo modello, anche se poi e'
  stato sostituito: per questo `contrattiAnno` legge tutti i modelli, non solo
  gli attivi. Solo senza il modello decidono i valori salvati.

Fino al 14/10/2026 decidevano sempre i movimenti, e succedevano due cose:
- il contratto 2027 di Nappi Sud coi due prezzi, guardato il 15/04/2027 senza
  ancora un viaggio ACI dell'anno, tornava «sola raccolta»: 34 da decidere
  invece di 33, e la scheda riproponeva il modello senza lo stoccaggio;
- un contratto di sola raccolta firmato prima che il fornitore cominciasse a
  stoccare rendeva lo stoccaggio ACI «non dovuto», scoperto e fuori dai conti.

Se il contratto di raccolta ACI fatto e' di sola raccolta e quest'anno il
fornitore stocca anche sull'ACI, lo stoccaggio ACI resta da fare (mancante,
atteso) e la raccolta ha `si_puo_unire_lo_stoccaggio`. La scheda offre tutti e
due i modelli, la proposta ha anche il prezzo dello stoccaggio e gli avvisi lo
dicono sulle due righe. Rigenerata col modello coi due prezzi diventa il
contratto unico. Un contratto di stoccaggio ACI gia' fatto a parte resta suo e
si conta. Prova: `prove/contrattiCanali.mjs`, sezioni «RACCOLTA E STOCCAGGIO
ACI», «IL CONTRATTO GIA' FATTO DICE SE E' DI RACCOLTA E STOCCAGGIO» e «IL
CONTRATTO DI ECORECUPERI DEL 2024 HA UN PREZZO SOLO».

Il contratto unico lo sanno anche (chiusura del giro, 14/10/2026):
- **il controfirmato** (`salvaContrattoFornitore`, azione 'controfirmato'): la
  voce «contratto» del catalogo della qualifica si cerca per tutti e due i
  ruoli, raccolta e stoccaggio, e il firmato diventa il documento di ciascuna
  voce trovata (una sola voce per i due ruoli: un documento solo). Il modello si
  legge una volta, e solo per una raccolta ACI. Il contratto tiene il primo
  documento in `documento_qualifica_id`, la risposta li porta tutti
  (`documenti_qualifica`) e la scheda Contratti li legge uno dopo l'altro
  (`documentiDelFirmato`). Un ruolo senza voce, o con piu' voci, lo dice la
  frase «Per lo stoccaggio: ...». I documenti degli altri contratti dello stesso
  anno si riconoscono anche dal file firmato, non solo da
  `documento_qualifica_id`. Prova: `prove/contrattoFirmato.mjs`, «IL CONTRATTO
  ACI UNICO DI RACCOLTA E STOCCAGGIO DIVENTA IL DOCUMENTO DELLE DUE VOCI»;
- **EcoTyna**: lo strumento `qualifica_fornitori` mette `raccolta_e_stoccaggio`
  sulla riga del contratto, con la stessa regola e i modelli letti una volta
  per domanda, e la nota dice che cosa vuol dire. Prima diceva il contratto di
  Nappi Sud di sola raccolta, e a «Nappi Sud ha il contratto di stoccaggio
  ACI?» i dati dicevano di no. Prova: `prove/ecotynaQualificaClasse.mjs`,
  sezione 5.

La voce 6 di `inizializzazioneAnno.ts` («Contratti ai subfornitori») confronta
ancora quanti contratti ha l'anno rispetto all'anno prima: un anno che passa da
due contratti ACI separati a quello unico risulta «parziale» per uno. Va
portata su `totali.attesi` di `situazioneContratti`; sui dati veri non ci sono
contratti, e oggi non cambia niente.

**L'elenco di un anno e' un'unione, non un ripiego.** Fino all'11/10/2026 l'anno
prima si guardava solo se l'anno chiesto non aveva nessun soggetto:
un'inclusione manuale nel 2027, o i primi viaggi di gennaio, facevano sparire
tutti gli altri, e con loro i contratti 2027 gia' generati. Ora l'elenco e' fatto
da: i soggetti dell'anno, quelli dell'anno prima finche' l'anno chiesto non e'
finito, e chi ha gia' un contratto dell'anno. Per un anno non ancora cominciato
(i contratti del 2027 si preparano a dicembre) chi lavorava l'anno prima e'
atteso. Per l'anno in corso chi non ha piu' movimenti ne' un contratto e' «da
decidere» e non si conta, con un'eccezione decisa il 13/10/2026: gennaio non e'
ottobre. I contratti chiudono al 31/12 senza tacito rinnovo, quindi dal 1°
gennaio al 31 marzo una riga che ha come unica prova l'anno prima e' attesa
(`da_ultimo_trimestre`) se il fornitore ha lavorato nell'ultimo trimestre
dell'anno prima (dal 01/10, giorno italiano di `trasporto_finito_il`) per QUELLA
prestazione e su QUEL canale. Il trasporto delle secondarie resta un contratto
solo, registrato RETE. Chi ha smesso prima resta «da decidere» (T-Cycle
stoccaggio, fermo da maggio 2026). Dal 1° aprile si torna come in ottobre. Prima
di questa regola, il 08/01/2027 i contratti 2027 attesi erano 3 invece di 33
(revisione del 13/10/2026). La risposta ha `anno_prima_ultimo_trimestre` e la
scheda lo spiega nell'intestazione.

**I valori vengono dai dati, e quello che manca resta da scrivere.** La regola e'
`valoriDelContratto` in `base44/shared/segnapostiContratto.ts` (specchio
`src/lib/segnapostiContratto.js`):
- il prezzo dalle tariffe PASSIVE del fornitore per quella prestazione e quel
  canale (o «TUTTE») che valgono in almeno un giorno dell'anno, mai una
  disattivata. Si scrive solo se e' uno: con piu' prezzi (zona, destinazione,
  tratta) lo si dice e non se ne sceglie uno;
- le tariffe dell'anno copiate da «Prepara l'anno» e non ancora confermate
  (`daConfermare` di `annoTarget.ts`) NON sono il prezzo: portano il prezzo
  dell'anno prima, e si confermano proprio sul contratto. Stanno in
  `tariffe_copiate`, con l'avviso «copiata dal <anno prima> con «Prepara
  l'anno», da confermare: il prezzo lo decide il contratto». Prima, dopo la
  copia, 23 contratti 2027 proponevano il prezzo del 2026 (revisione del
  13/10/2026). Una copia resta «copiata dal <anno prima>» solo se ha ancora il
  prezzo dell'anno prima (`eAncoraLaCopia` in `contrattiDellAnno.ts`). Il
  confronto si fa con la stessa riga (`chiaveTariffa`, anche disattivata) o, se
  la riga e' cambiata, con le tariffe dell'anno prima dello stesso fornitore,
  prestazione e canale. Una copia che l'amministratore ha riscritto col prezzo
  nuovo senza confermarla (la finestra delle tariffe lascia la nota della
  copia: GATIM rete 2027 da 70 a 72) e' il prezzo dell'anno. Si propone con la
  fonte `tariffa_da_confermare` e l'avviso «scritta per il <anno> ma ancora
  segnata da confermare: confermala in «Prepara l'anno»», e sta in
  `proposta.tariffe` con `da_confermare`. Senza nessun prezzo dell'anno prima
  con cui confrontarla vale la sua nota, e resta una copia;
- il prezzo unico di raccolta e trattamento (`comprensiva_trattamento`) e' un
  fatto di struttura. La raccolta porta l'avviso «prezzo unico che comprende il
  trattamento» ogni volta che la riga del trattamento dice «sta nel contratto di
  raccolta», anche se le tariffe dell'anno sono solo copie o mancano (parametro
  `prezzoUnico` di `valoriDelContratto`, letto come lo legge il trattamento).
  Fino al 13/10/2026 la raccolta ACI 2027 di Green Tyre lo perdeva, con le copie
  e senza;
- la quantita' dal target della rete: `TargetRaccoglitore` sommato fra le
  regioni per la raccolta, `ImpiantoTargetSecondaria` per il trattamento. Non
  per lo stoccaggio, che ha un'altra quantita' (T-Cycle 2026: 1.050 t di
  trattamento, 250 t di stoccaggio). Sull'ACI il target non c'e'. I target
  copiati, cioe' `TargetRaccoglitore` segnato nello storico e l'impianto segnato
  nelle note, si propongono ancora come quantita', ma con fonte `target_copiato`
  e l'avviso «la quantita' la decide il contratto»;
- le date dal 02/01 al 31/12, o il giorno di gennaio del contratto prima;
- i dati del fornitore dall'anagrafica; rappresentante, camera di commercio,
  pagamento e polizza dal contratto dell'anno prima. Il secondo telefono
  (FORNITORE_TEL_2, il cellulare), la seconda email (FORNITORE_EMAIL_2, la pec),
  il referente e i numeri d'iscrizione vengono dal contratto dell'anno prima.
  Dal 13/10/2026 vengono prima dall'anagrafica (i campi `cellulare`, `pec` e
  `referente`, scritti dalla scheda Fornitori), e dal contratto dell'anno prima
  solo se li' mancano. Mai dedotti: il telefono non diventa il cellulare. Un
  recapito dell'anagrafica che il contratto dell'anno prima aveva gia' in un
  altro punto della stessa famiglia non si ripete (`RECAPITI_DALL_ANAGRAFICA`).

Date, anno, quantita' e prezzi dell'anno prima NON si riprendono, riconosciuti
dal tipo del punto nel catalogo e non solo dal nome (`siRicalcola`):
`CONTRIBUTO_NON_CONCORRENZA` e' un prezzo e passava, cosi' come le seconde
occorrenze `TARGET_TON_2`. Le sue tariffe arrivano solo come riferimento
(`tariffe_anno_prima`). Un valore che manca resta segnaposto visibile nel Word,
mai 0. Valori, proposte e tariffe vanno solo all'amministratore. Il `file_uri`
di contratti e modelli non esce dalla funzione: fino al 12/10 lo mandava a
chiunque aprisse la scheda.

**Riaprire un contratto riparte dai SUOI valori** (`valoriDiPartenza`). Prima i
due rami erano uguali, e il Word rigenerato tornava coi corrispettivi dell'anno
prima. Dalla proposta si prendono solo i punti che il contratto salvato non ha.
`valoriPerIlDocumento` ricalcola sempre DATA_*_IT e DATA_*_LUNGA dalla data: i
contratti di prima le avevano salvate fra i valori.

**Generare e caricare il firmato passano da `salvaContrattoFornitore`**: solo
amministratore, ed e' l'unica che vede i riferimenti ai file.
- Un contratto «inviato» o «controfirmato» non si rigenera senza
  `conferma_rigenera` (risposta 409 con `serve_conferma`; la pagina chiede la
  spunta). La versione di prima resta in `versioni_json`, con file, stato, date
  e valori.
- Un campo che la pagina non manda si svuota (null).
- «Carica il controfirmato» rende il firmato il documento del contratto
  (`documento_firmato`). Se il catalogo della qualifica ha UNA sola voce della
  famiglia «contratto» per quel ruolo, crea anche il `DocumentoQualifica`
  (`documento_qualifica_id`, stesso file) e mette fra i sostituiti il precedente
  di quella voce, ma non quello di un altro contratto dello stesso anno (rete e
  ACI sono due contratti veri). Con zero o piu' voci non sceglie e lo dice. Se
  il contratto decorre dopo oggi, i documenti della voce che oggi valgono ancora
  restano attivi fino alla decorrenza (vedi «Il contratto in corso vale fino
  alla decorrenza del nuovo»).
- «Segna inviato» e «segna controfirmato» senza file restano scritture dirette
  del solo stato.
- Il `DocumentoQualifica` creato dal firmato nasce «in_attesa». La scheda
  Contratti chiama subito `analizzaDocumentoQualifica`, con lo stesso contesto
  della scheda del fornitore (nome, partita IVA, codice fiscale). Senza questa
  chiamata, dopo dieci minuti la qualifica lo dava «da verificare» per
  un'analisi interrotta che non era mai partita (revisione del 13/10/2026).
- La quantita' salvata sul contratto (`quantitativo_previsto_t`, la legge
  EcoTyna) e' quella del punto che il modello ha, cioe' quella del Word
  (`campoDellaQuantita`): `TARGET_TON` nella raccolta, `QUOTA_TON` negli altri.
  Non e' la prima scritta fra le due: la proposta le riempie tutte e due.

**Il posto dei modelli** e' la sezione «Modelli dei contratti» nella scheda
Contratti (`src/components/qualifica/ModelliContratti.jsx`), solo per
l'amministratore. Si carica il format .docx di un tipo e di un canale, anche un
contratto gia' compilato. `src/lib/modelliContratto.js` accetta prima le
revisioni aperte (il «[RIFERIMENTO GRETA]» di Tecnogum ne ha 153), poi legge il
testo pezzo per pezzo e propone i punti che cambiano:
- i dati del fornitore, dal paragrafo «(di seguito il "FORNITORE")» e ovunque si
  ripetano (firme, comunicazioni, intestazioni);
- le date di validita' e della firma, col loro stile («02 Gennaio 2026», «1°
  aprile 2026», «01/06/2026»);
- l'anno del contratto; le date di altri atti e gli anni delle norme si mostrano
  spenti col motivo;
- la quantita' annua;
- i prezzi dell'allegato dei corrispettivi (non penali e sanzioni);
- pagamento, modalita' e massimale della polizza.

I `{{...}}` gia' scritti si tengono. L'amministratore accende, spegne, aggiunge
(`cercaNelFormat`) e conferma. `costruisciModello` cambia solo il testo di quei
pezzi: un valore spezzato fra due pezzi prende il segnaposto nel primo e il resto
si toglie dal secondo, con la formattazione intatta. Il modello si salva
nell'area privata con `punti_json`. Il valore di partenza dei prezzi NON si salva
nel modello: e' un costo dei fornitori e resta solo nel contratto. Dal
13/10/2026 `ModelloContratto` lo legge solo l'amministratore, ma i punti dei
modelli arrivano ancora a chiunque apra la scheda Contratti, da `contrattiAnno`. Un
prezzo in una casella di testo disegnata sopra il documento (T-Cycle stoccaggio
2026, «55,00» barrato) si propone spento. `compilaContratto` scrive ogni valore
nello stile del modello. Provato sugli otto format veri di CONTRATTI
SUBFORNITORI: il contratto generato coi valori di un altro fornitore differisce
dall'originale solo nelle righe dei punti. Il contratto di Ecological Systems
rifatto dal format di Gatim differisce da quello vero in 5 righe, tutte ritocchi
scritti a mano. Prove: `prove/contrattiCanali.mjs` (con una parte sui dati veri
dell'11/10/2026, gennaio e «Prepara l'anno», che si salta se la copia non c'e'),
`prove/contrattoFirmato.mjs`, `prove/modelliContratto.mjs` (la parte sui format
veri si salta se la cartella non c'e'), `prove/modelliContrattoResidui.mjs`.

**Un contratto gia' compilato come format: nel contratto nuovo nessun dato del
fornitore di partenza, e quelli di SMOCO mai toccati (revisione del
13/10/2026).** Caricato come format un contratto vero del 2026, il lettore
lasciava nel contratto di un altro fornitore diversi dati di quello di partenza:
- la camera di commercio nelle comunicazioni, accanto alla partita IVA nuova;
- la rappresentante con la carica al femminile («Amministratrice Unica»), con
  nome, carica e cellulare;
- il referente «per il Vettore»;
- il nome fra le linee della firma;
- «mese di ________2026».

E col contratto di Logistica srl cambiava il «Responsabile della Logistica» di
SMOCO e il suo telefono. Le regole di `src/lib/modelliContratto.js`:
- **I dati di SMOCO non si toccano mai.** Sono di SMOCO: le righe col suo codice
  fiscale 02971520735, «quanto a SMOCO», «per il Committente» e quelle con un
  indirizzo @smoco; la sua parte della riga della privacy; le sue persone,
  dovunque compaiano; il suo riquadro delle firme (anche a colonne o in
  tabella). Un'occorrenza che cade li' si mostra spenta: «e' un dato di SMOCO».
- **Tranne la data dell'Albo di SMOCO (13/10/2026).** L'iscrizione di SMOCO
  all'Albo gestori (categoria 8, n. BA-11513) e' del 16/05/2025 e vale fino al
  rinnovo del 2030. Decisione dell'utente: «ogni 5 anni c'è il rinnovo delle
  autorizzazioni sull'albo, quindi devi sempre considerare come data il
  «16/05/2025» (fino al 2030 quando verrà rinnovata)». E' un dato fisso e sta in
  un posto solo: `ALBO_SMOCO` in `segnapostiContratto.ts` e nello specchio, con
  la scadenza 15/05/2030 e `alboSmocoScaduto`. Al rinnovo si cambia li'. Il
  lettore dei format (`alboSmocoNelleRighe` in `src/lib/modelliContratto.js`)
  trova il numero (BA-11513, BA11513, BA 11513) seguito da «del <data>» e la
  categoria, scritta dopo la data o subito prima («cat.8 BA-11513»). Se la
  categoria e' 8 e la data e' diversa, la riscrive nello stile del format
  (`correggiAlboSmoco`: «16/05/2025», «16.05.2025», «16 maggio 2025»), e il
  resto della riga resta identico. Lo fanno `costruisciModello` e
  `compilaContratto`, anche sui modelli salvati prima, e la proposta lo dice
  (`albo_smoco`). Il «Contratto Raccolta 2026_RETE MODIFICATO» ha «del
  15/05/2020» e il contratto esce con «del 16/05/2025»; nessun altro dato di
  SMOCO cambia. Nelle due cartelle dei contratti ci sono 102 documenti con
  l'Albo di SMOCO: si correggono 15/05/2020 (63 volte), 16/05/2026 (7) e
  15/05/2025 (4). Le date dell'Albo di SMOCO non diventano mai un punto, nemmeno
  l'anno del contratto («16/05/2026» nei contratti rete 2026 di Green Tyre e
  Nappi Sud). L'iscrizione di categoria 4, con un'altra data (Eco Faso: «n.
  BA11513 del 01.04.2022 ... categoria 4»), non si tocca. Una data senza la
  categoria scritta non si corregge, e la proposta lo dice. Dopo il 15/05/2030
  compare l'avviso del rinnovo. Prove: `prove/modelliContratto.mjs` (sezione
  «L'ISCRIZIONE DI SMOCO ALL'ALBO», sui 102 documenti veri) e
  `prove/modelliContrattoResidui.mjs`.
- **Il nome del fornitore.** Se e' di una parola sola, si cerca senza
  distinguere maiuscole solo con la forma societaria («LOGISTICA SRL»); da solo
  vale solo scritto com'e'. Se e' di piu' parole, vale in qualunque maiuscola.
- **La camera di commercio** si cambia ovunque sia scritta dopo «Registro
  Imprese», «CCIAA» o «Camera di Commercio», come la sede.
- **Cariche e titoli.** Le cariche si riconoscono al maschile e al femminile
  (Amministratore/Amministratrice Unico/a e Delegato/a, Legale Rappresentante,
  Socio/a Amministratore/trice, Procuratore/trice...); i titoli sono Sig.,
  Sig.ra, Sig.re, Dott.ssa e simili. Il nome del rappresentante si cambia in
  tutte le occorrenze, in ogni ordine e maiuscola, anche fra i trattini bassi
  della firma. La carica si cambia in tre posti: davanti al nome, sotto o sopra
  la sua firma nella sua colonna, e subito dopo il nome («Guido Costanzo
  Amministratore Unico», «in qualita' di Legale Rappresentante»).
- **Recapiti e referente.** Tutti i telefoni e le email del fornitore diventano
  punti, ognuno col suo segnaposto (FORNITORE_TEL_2 per il cellulare,
  FORNITORE_EMAIL_2 per la pec). Il referente «per il Vettore: sig. ...» e'
  FORNITORE_REFERENTE. Mai da una riga di SMOCO. In una riga del fornitore, un
  recapito scritto dopo «SMOCO», «Committente» o un indirizzo @smoco e' di
  SMOCO. Una riga col nome del fornitore che parla anche di SMOCO non e' sua: i
  suoi numeri si mostrano spenti. FORNITORE_REFERENTE, FORNITORE_ISCRIZIONE,
  FORNITORE_ISCRIZIONE_DATA, FORNITORE_ALBO_PROVINCIA e FORNITORE_ALBO_CLASSE
  (con i loro _2 e _3) stanno nel catalogo `PUNTI_CONTRATTO`, fra i dati del
  fornitore, come testo e col nome che gli da' il lettore (13/10/2026; gli ultimi
  tre dall'ultimo giro della revisione, subito dopo il numero d'iscrizione). La
  data d'iscrizione, essendo testo, passa al contratto dell'anno dopo. Si
  scelgono a mano in «Modelli dei contratti», e nell'elenco del lettore stanno
  coi dati del fornitore e non in fondo.
- **L'anno** si cerca fra due «non cifre»: «________2026» e' l'anno del
  contratto.
- **Quello che il lettore non e' sicuro di aver preso diventa «da
  controllare»** (`da_controllare` del punto e della proposta). Sono: un pezzo
  del nome («Sig. Bianchi»), lo stesso telefono scritto in un altro modo, un
  numero in una riga del fornitore o che parla anche di SMOCO, la camera di
  commercio o un indirizzo scritti in un altro modo nelle comunicazioni (il
  Nappi Sud ACI 2026 ha ancora quelli di Gatim), una partita IVA diversa, i
  dati d'iscrizione del vettore (numeri di albo e REN, provincia, classe, data:
  vedi «Il domicilio e l'iscrizione del vettore»), un anno incerto. Si mostrano
  spenti col motivo. La sezione «Modelli dei contratti» li apre e chiede «ho
  controllato». Salvando con punti non controllati serve un secondo clic, e la
  nota del modello li elenca.

Titoli e articoli intorno al nome («dall'Amministratrice», «Sig.ra») restano
quelli del format: la nota del punto lo dice.

Prova: `prove/modelliContrattoResidui.mjs`, su tre format finti e su 30 contratti
veri (22 contratti del 2026 gia' compilati e gli 8 format, in sola lettura dalla
cartella CONTRATTI SUBFORNITORI; senza la cartella quella parte si salta). Nel
contratto generato per un altro fornitore non deve restare nessun nome, persona,
camera di commercio, telefono, email, partita IVA o anno vecchio. Righe, persone
e carica di SMOCO devono restare identiche.

**Il domicilio e l'iscrizione del vettore nei format di trasporto (seconda
revisione del 13/10/2026).** Caricato come format il contratto di trasporto di
Ecoservice o di Logistica srl, nel contratto nuovo restavano due cose del
vettore di partenza:
- il domicilio nelle comunicazioni («- quanto al Vettore ECOSERVICE S.r.l.
  presso Carrara (MS) …», «… Logistica srl presso Via delle Industrie 78, …»);
- la provincia del suo albo («della Provincia di SALERNO»).

La proposta non segnava la sede da controllare, e dell'iscrizione segnava solo i
numeri. Le regole di `src/lib/modelliContratto.js`:
- **L'indirizzo del fornitore si cerca dove comincia.** Nelle comunicazioni dopo
  «quanto al FORNITORE/Vettore», saltando il suo nome (anche con «Spett.le»
  davanti); dopo «presso»; e dovunque dopo il nome seguito da «con sede in» o
  «presso». Finisce con la provincia fra parentesi, o prima di un recapito, del
  codice fiscale o del punto e virgola.
- **Sede uguale o diversa.** Se e' la sede scritta uguale, e' gia' accesa. Se e'
  diversa, e' un'occorrenza spenta della sede e FORNITORE_SEDE_LEGALE diventa da
  controllare: accesa, diventa la sede del fornitore nuovo. Le linee da
  compilare («presso ________») non contano.
- **Dati d'iscrizione del vettore.** Nelle righe «Il Vettore e' … iscritt…»
  sono da controllare, insieme ai numeri, anche la provincia dell'albo
  (FORNITORE_ALBO_PROVINCIA), la classe dell'albo gestori
  (FORNITORE_ALBO_CLASSE) e la data o gli estremi scritti dopo il numero
  (FORNITORE_ISCRIZIONE_DATA). Nel format vuoto del trasporto sono le righe da
  compilare. L'iscrizione di SMOCO («Il Committente e' iscritto …») non si
  tocca.
- **Il nome in sigla e la coda del nome (ultimo giro della revisione del
  13/10/2026).** Il nome si prende con la forma societaria anche dopo il punto
  di una sigla: «R.P.N. S.R.L.», «M.G.M. S.r.l.». Prima si prendeva «R.P.N» e il
  contratto nuovo diceva «ALTRO FORNITORE S.R.L.. S.R.L.». Nelle comunicazioni,
  una coda del nome senza cifre ne' recapiti si salta davanti a «con sede in»,
  «sede legale in» e «domiciliato in», come davanti a «presso»: l'occorrenza
  della sede comincia dall'indirizzo, e accesa la riga resta «… S.R.L. con sede
  in <sede nuova>». Prima, sui contratti RPN, diventava «ALTRO FORNITORE
  S.R.L.Via Dante 9 …». Se la coda resta subito dopo il nome preso («OMEGA
  S.R.L. Unipersonale con sede in …»), FORNITORE_RAGIONE_SOCIALE e' da
  controllare e il motivo dice la coda.
- **L'iscrizione di SMOCO si prova per riga.** `prove/modelliContrattoResidui.mjs`
  controlla che nella riga «Il Committente e' iscritto …» (parte e indice) non
  cada nessuna occorrenza, ne' accesa ne' spenta, e che la riga esca identica.
  Il contesto di 40 caratteri non arriva a numero, data e classe di SMOCO: un
  lettore che li segnava passava lo stesso. Il controllo gira anche sui
  contratti veri, e la riga deve esserci in almeno tre, perche' non passi a
  vuoto.

Sui 30 contratti veri restano da controllare solo Irigom ACI impianto, Nappi Sud
ACI e i tre trasporti (Ielapi, Logistica srl, Ecoservice).
`prove/modelliContrattoResidui.mjs` fissa due cose:
- gli altri 25 contratti non hanno nessun punto da controllare;
- la sede del fornitore di partenza (la via, «citta' (PR)», «CAP citta'») e i
  suoi dati d'iscrizione restano nel contratto generato solo dove la proposta li
  segna da controllare.
