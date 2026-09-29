# AGENTS.md

## Project Context

This is a Base44 app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and publish workflow.

## Base44 References

- CLI overview: https://docs.base44.com/developers/references/cli/get-started/overview.md
- Agent skills: https://docs.base44.com/developers/backend/overview/skills.md

If your agent supports Agent Skills, install or update Base44 skills before Base44-specific work:

```bash
npx skills add base44/skills
```

## Key Files

- `src/`: frontend application source.
- `src/api/base44Client.js`: frontend Base44 SDK client.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `base44 dev` as the default local development command when you need the local Base44 backend. It can run the backend and frontend together.
- When docs or code mention the frontend being started automatically, that usually means the Base44 project config includes `site.serveCommand`, for example `"serveCommand": "npm run dev"` in `base44/config.jsonc`.
- Use `npm run dev` only for frontend-only work against the hosted Base44 backend.
- Prefer the existing Base44 CLI workflow over adding new npm scripts for Base44-specific tasks.
- Reuse the existing SDK client and Vite plugin patterns before adding new Base44 integration paths.
- Run the relevant checks from `package.json` before finishing code changes.
- **Limite di richieste della piattaforma** (22/09/2026): le richieste agli archivi
  si contano per tutta l'app insieme, su un minuto; oltre, 429 "Rate limit
  exceeded". Ogni funzione avvolge il client con
  `conLimiteRichieste(createClientFromRequest(req))` (`base44/shared/limiteRichieste.ts`,
  specchio in `src/lib`, usato anche da `src/api/base44Client.js`): una richiesta
  respinta si ripete dopo una pausa, le chiamate a funzione solo su 429. Le
  letture intere passano da `fetchAll`/`perPagina`/`fetchAllClient`, a pagine da
  5000 righe (il massimo che la piattaforma restituisce). Niente pagine che
  rileggono archivi interi a intervalli: si guarda lo stato di cio' che e' in
  corso, e si rilegge tutto solo quando cambia (`ReportSettimanali.jsx`).

## Regole della commessa

Regole di dominio che il codice deve rispettare sempre. Valgono per ogni nuovo
conto, filtro, export o assistente: se una modifica le viola, e' sbagliata anche
quando "funziona".

### Il periodo di un movimento e' la fine del trasporto

A quale giorno, settimana, mese e anno appartiene un movimento lo decide
**`trasporto_finito_il`**, mai `ordine_chiuso_il` e mai i campi `mese`, `anno` o
`settimane` memorizzati sul record. Il portale chiude l'ordine giorni dopo la
fine del trasporto, e i due non cadono nello stesso mese: contato sul 2026,
96 primarie di rete su 2.827 (272,65 t), 2 ACI su 44, una secondaria e 65
terziarie su 99 (2.198,64 t).

Usa `dataPeriodo(record)` da `base44/shared/dataEnrichment.ts`, che incapsula la
regola. I campi memorizzati possono venire da importazioni vecchie, quando la
data di riferimento era la chiusura: non fidarsene, ricalcolare.

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

Un assegnato non e' un movimento: il suo periodo e' `ordine_immesso_il`.

### Canali indipendenti

RETE, ACI ed EXTRA RACCOLTA sono commesse separate: non si sommano mai, in
nessun modulo, nemmeno come totale di controllo o come conteggio di formulari, e
anche quando un viaggio di secondaria porta formulari di piu' canali. I target
esistono solo per la rete.

**Un movimento si fattura in un canale solo.** Un record dell'extra raccolta non
deve comparire fra gli impianti del giro RETE: ci compariva, e la stessa riga di
trattamento si pagava due volte, una per scheda. Quando un viaggio di secondaria
porta insieme formulari di rete e formulari ACI, l'importo si paga una volta
sola: a tonnellata ogni canale paga i suoi chili; **a viaggio l'importo si divide
fra i canali in proporzione ai chili effettivi di ciascuno su quel viaggio**
(regola dell'utente del 22/09/2026, `quoteViaggioMisto` in
`base44/shared/passivaCalcolo.ts`: la quota della rete si arrotonda al centesimo,
l'ACI prende il resto, cosi' le parti fanno sempre l'importo). Il viaggio misto
non e' un'anomalia. Le tonnellate mostrate sono quelle del canale che si sta
guardando, mai la somma dei due.

**Extra raccolta in fatturazione** (22/09/2026). In attiva vale il prezzo scritto
sull'intervento; se e' zero o vuoto, la tariffa base: la Tariffa ATTIVA
EXTRA_RACCOLTA della data, e senza quella **202 euro/t nel 2026**. In passiva i
costi (raccolta, stoccaggio, trattamento) sono quelli che l'utente scrive a mano
sull'intervento prima di passarlo da assegnato a terminato: **mai il ripiego sulle
tariffe di rete**, ne' nel calcolo ne' nel modulo. In fatturazione entrano solo gli
interventi terminati, nel mese della fine trasporto. Una scheda si chiude
(terminato) solo con FIR, peso effettivo e le tre date obbligatorie.

### Pesi

Le valutazioni si fanno sul peso effettivo (`peso_effettivo`), mai sullo stimato.
Tonnellate con due decimali, tre se i kg non sono tondi; kg sempre interi;
ovunque, export compresi.

### Gli impianti che svuotano la giacenza dell'anno prima

Un impianto puo' non essere piu' contrattualizzato nell'anno in corso e avere
lo stesso movimentazioni e dichiarazioni: deve svuotare la giacenza dell'anno
precedente, e lo fa con secondarie e terziarie (regola dell'utente, 23/09/2026).
Nessun modulo che parla di giacenze, dichiarazioni, verifiche o fatturazione puo'
escludere un sito perche' non ha un contratto quest'anno: si escludono solo dai
target e dalla predittivita', che sono cose dell'anno in corso. Verificato il
23/09/2026: INNOREC e PRT compaiono in Giacenze e in Dichiarazioni Impianti con
le loro righe, pur senza target 2026.

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
  `contaFormulari()` da `base44/shared/formulari.ts`, mai `righe.length`: due
  quote dello stesso documento contate come due formulari fanno sballare la
  quadratura contro la stampa del portale, che quel formulario lo elenca una
  volta. Chi confronta il gestionale con un elenco esterno - la quadratura FIR, i
  report settimanali degli impianti - fonde prima le quote con `unisciQuote()`,
  altrimenti una riga del report col peso intero si abbina a una quota sola e
  risultano insieme una differenza di peso e un movimento mancante.

A distinguere le quote e' il **ticket**: si mostra sempre accanto al peso
effettivo, ed e' quello che rende il conto leggibile invece che sospetto.

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
  l'anno non ne ha uno) ed elenco dei siti delle giacenze; tutto "copiato dal
  {anno-1}, da confermare". Salta quello che l'anno ha gia': si puo' ripetere e
  completa una copia interrotta. Il piano e' puro (`pianoCopiaAnno`, provato in
  `prove/annoTarget.mjs` e `prove/copiaAnnoTarget.mjs`).
- **Gli anni chiusi** (prima dell'anno in corso, ora italiana: `annoChiuso`) si
  leggono soltanto: la pagina non lascia scrivere e le funzioni che scrivono li
  rifiutano. Scrive solo l'amministratore (`soloAmministratore`).
- **Chi la predittivita' segue**: solo gli impianti con un target e
  `segue_predittivita !== false` (se manca vale vero). Green Tyre Project, T.R.S.
  e Gatim fanno R3: hanno solo il target, che le Giacenze leggono, e la
  predittivita' non li segue (interruttore "Segui nella predittivita'"); con
  loro non si seguono neanche i loro stoccaggi.
- **Fine della programmazione e chili a viaggio** stanno sul contratto Ecotyre
  dell'anno (`CommessaEcotyre.fine_programmazione`, `kg_per_viaggio`, scritti in
  Impianti e stoccaggi). `fineProgrammazione(anno, commessa)` e
  `regolePredittivita(anno, commessa)` li usano quando ci sono (la data solo se e'
  dentro quell'anno); senza, vale quello di prima: per il 2026 il 18/12/2026 e 13 t.
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

**La prefattura del portale Ecotyre** (`base44/shared/prefattura.ts`, funzione
`prefatturaEcotyre`, scheda «Prefattura Ecotyre»). Si carica in Excel o in PDF e
si confronta ordine per ordine con le righe di `attivaCalcolo.ts`, PRIMA di
esportare: solo in prefattura (con la ragione: altro mese, cancellato,
sconosciuto), solo nel gestionale, peso diverso, stesso peso e importo diverso
(col prezzo per tonnellata ricavato). Il canale di un ordine non si chiede: e'
quello che ha nel gestionale. La prefattura non ha un tracciato garantito: le
colonne si riconoscono dai nomi e gli ordini dalla forma (`ET26084363`). Il PDF si
legge dal suo testo (vedi piu' sotto), non con un agente. Una prefattura nuova non
cancella la precedente: la segna superata.

### Il margine

`base44/shared/margine.ts`, funzione `calcolaMargine`, scheda «Margine» della
fatturazione (solo admin). Ricavo attivo meno costo passivo, mese per mese e
canale per canale, con una sola lettura degli archivi. **Non ha regole sue**: usa
`attivaCalcolo.ts` e `passivaCalcolo.ts` (il calcolo della passiva, che la
funzione `calcolaPassiva` si limita a chiamare), quindi i numeri sono gli stessi
delle due fatturazioni al centesimo. Tre canali, tre margini, mai un totale. Il
costo di un mese comprende stoccaggio, trattamento e secondarie di quel mese, che
possono riguardare tonnellate raccolte prima: il numero che conta e' l'anno.

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

### La pratica mensile di Irigom

Le dichiarazioni di Irigom le prepariamo noi, nella scheda Irigom di
Dichiarazioni Impianti (`PraticaIrigom.jsx`). Le regole stanno in
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
  trasportatori (regola dell'utente del 22/09/2026, `combinazioneVicina` in
  `src/lib/praticaIrigom.js`: tutte le somme possibili, poi si tolgono gli
  allegati di coda che non servono, cosi' restano quelli di testa). Tante
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
- **Quanto** (22/09/2026): due letture del **totale da caricare a portale**,
  sempre mostrate insieme. Uscite del registro V + X + Y (extra raccolta
  compresa), oppure la giacenza: dopo la dichiarazione del mese M a portale deve
  restare **AD + AE della riga di M nel foglio Cons.** (gomma in impianto:
  cippato, SACI e interi; piu' ferro in giacenza) meno l'extra ancora in
  impianto. Totale a portale = giacenza di rete a portale a fine mese (per fine
  trasporto) - quello che deve restare. Il CSS-C in giacenza (Z) non resta: e'
  end of waste. Il ferro e' la parte che si aggiusta: totale a portale - V - Y.
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
- `docxModello.unisciRun` fonde solo run con lo stesso stile: fonderli tutti
  faceva perdere grassetti e caratteri ai documenti generati.

### Le tre regole che l'utente non vuole ripetere (21/09/2026)

1. **Fine trasporto, MAI chiusura a portale.** In ogni modulo ogni ragionamento
   - periodo, tagli a una data, confronti con una fotografia del portale,
   ripieghi quando un campo manca - si fa sulla fine del trasporto.
   `ordine_chiuso_il` / `data_chiusura` si possono mostrare, mai usare per
   decidere.
2. **Ogni caricamento aggiorna tutto.** Un modulo fermo a una fotografia vecchia
   e' un difetto, non una spiegazione. La giacenza a portale di un impianto e'
   la fotografia degli ordini non dichiarati **piu'** i carichi che il
   gestionale conosce e il file no (riconosciuti dal **numero d'ordine** negli
   ordini non dichiarati e nel report delle dichiarazioni, mai dalla data)
   **meno** le dichiarazioni caricate dopo la fotografia. Quella di uno
   stoccaggio e' l'**ancora dell'anno** per classe piu' i movimenti finiti
   dopo; le letture successive sono il riscontro (`puntoDiPartenza` in
   `base44/shared/giacenzaStoccaggi.ts`, usato da Giacenze, riconciliazione,
   predittivita' e riepilogo delle dichiarazioni).
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
  luglio). Ora si cerca la fine trasporto e si escludono chiusura, immissione e
  inizio (`INTESTAZIONI` in `base44/shared/prefattura.ts`).
- **Campi `mese`, `anno`, `settimane` dei record.** Si scrivono da `dataPeriodo` e
  **non si rileggono mai** per decidere un periodo: si ricalcolano. L'unico punto
  che preferiva il campo memorizzato (`mese_immissione` in `pivotCalculator.ts`) e'
  stato tolto.

### Le date obbligatorie dei formulari (22/09/2026)

Parole dell'utente: «le date immissione, inizio e fine trasporto sono
obbligatorie nei formulari, se non ci sono vanno segnalate e questo vale sempre
dove ci sono ordini terminati non solo nei report settimanali». La regola sta in
`base44/shared/movimenti.ts` (specchio `src/lib/movimenti.js`):
`DATE_OBBLIGATORIE`, `dateMancanti`, `dateIncoerenti`, `dateDaSistemare`,
`testoDate`. Non si riscrive. Quanti sono si conta in **ordini distinti**, mai in
righe (`chiaveOrdine`, `ordiniDaSistemare`, `mancantiOrdine`, `incoerentiOrdine`,
`testoOrdine`, `ordineSenzaFine`, nello stesso file): lo stesso ordine sta in
archivio con piu' righe - una per classe o per prodotto - e contarle tutte
faceva uscire due numeri diversi per lo stesso insieme (23/09/2026).
Un terminato senza fine trasporto resta fuori da
ogni periodo, ma si segnala sempre dicendo quali date mancano; uno con la fine
trasporto ma senza un'altra data, o con date nell'ordine sbagliato, si conta e si
segnala lo stesso. Dove si vede:

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

Chi la rete non la dichiara per accordo (`dichiara_rete` falso, oggi Tecnogum)
non ha una giacenza di rete che il portale tenga per noi: i suoi carichi non si
aggiungono alla fotografia come "non ancora nel file".

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
  che rifiuta gli ID a cui il browser non dichiara nessuna riga nel file. Il
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
  `avviso_eseguiti` guarda il FILE. La regola vale anche per secondarie e
  terziarie (`importEcotyreFile` chiama la stessa funzione).
- **Un caricamento aggiorna i moduli solo se e' riuscito** (`moduliDaRicalcolare`),
  e quando non partono si dice quali restano indietro (`ricalcoliFermi`). I
  ricalcoli sono **quattro** per le primarie e **due** per le secondarie
  (`RICALCOLI`): la predittivita' non c'e' piu' dal 26/09/2026, vedi la sua
  sezione.
- **Le due conferme sono separate** (`CONFERMA_ORDINI_MANCANTI` e
  `CONFERMA_ARCHIVIO_RIMPICCIOLITO`) e si accumulano: possono scattare insieme, e
  mandandone una sola il pulsante "Forza caricamento" girava in tondo. Un collega
  che sta caricando adesso non e' un tentativo morto: glielo si dice subito,
  senza offrirgli niente da forzare.

### Le attivita' della to-do list che si chiudono da sole (28/09/2026)

`base44/shared/todoOrdini.ts` (specchio `src/lib/todoOrdini.js`), la function
`controllaTodoOrdini`, quinto ricalcolo dopo le primarie.

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
  dal gestionale una volta non si richiude (`chiusa_dal_gestionale`): a decidere e'
  chi lavora.
- Un ordine **cancellato** non chiude niente e si segnala col motivo; un
  **"eseguito"** si segnala sempre; un terminato **senza fine trasporto** non conta
  (regola 1); una fine trasporto **nel futuro** non chiude niente.
- Un ID che non si trova si dice con tutte le sue cause possibili (scritto male,
  ordine non ancora caricato, codice che non e' un ordine): mandare a ricaricare un
  file che c'e' gia' e' una bugia comoda. E se la domanda per numero d'ordine non
  torna **niente** mentre gli ID ci sono, la function **rinvia** invece di scrivere
  "non si trova" su ogni attivita'.
- Il campo `riferimento_ordine` si riscrive solo se l'utente lo ha davvero
  modificato: confrontare col testo normalizzato faceva diventare "da chiedere a
  Ecotyre" in "DA, CHIEDERE, A, ECOTYRE" appena si apriva e si chiudeva la casella,
  e di quel campo non c'e' storico.

### Come si legge un movimento: un punto solo

`base44/shared/movimenti.ts` (specchio per le pagine: `src/lib/movimenti.js`).
Chi deve decidere se un movimento conta, in che mese e in che canale lo chiede
li', e non riscrive la regola:

- `eTerminato(r)`: conta solo un movimento terminato;
- `periodoMovimento(r)`: giorno, anno, mese e settimana ISO dalla **fine del
  trasporto sul giorno italiano**; `filtraMovimenti(records, { anno, mese, canale })`;
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
Gli specchi in `src/lib` devono restare identici agli originali: lo controlla
`prove/specchi.mjs`. **Prima di spingere: `npm run lint` e `npm run prove`.**

### Decisioni della direzione del 20/09/2026 sulla fatturazione attiva

- Nel 2026 a Ecotyre si fattura a **202 euro la tonnellata** sulla **rete** e
  sull'**extra raccolta**; l'**ACI** ha le sue tariffe per regione. Nei report il
  prezzo si scrive a tonnellata (la prefattura del portale lo scrive al chilo,
  0,202: e' lo stesso prezzo).
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

### Il registro dei caricamenti

La preparazione di un caricamento apre una riga `in_corso` in `UploadLog` con
l'utente; la registrazione finale la chiude. Una riga rimasta `in_corso` e' la
traccia di un caricamento interrotto (archivio forse incompleto), e blocca per
dieci minuti un secondo caricamento dello stesso archivio da parte di un altro
utente. Chi legge «l'ultimo caricamento» esclude `errore` e `in_corso`.

### La dashboard e l'elenco unico delle cose da gestire

`base44/shared/cruscotto.ts`, funzione `cruscottoOperativo`, componente
`src/components/dashboard/Cruscotto.jsx`. Un solo elenco, ordinato per gravita',
di cio' che richiede attenzione, ogni voce col collegamento a dove si risolve.
Legge **solo archivi piccoli** (alert, registro dei caricamenti, ordini aperti,
documenti di fatturazione, prefatture, riepilogo della qualifica,
richieste del consorzio): chi aggiunge un controllo non deve farle rileggere le
primarie. Le anomalie di prezzo delle fatturazioni arrivano dal margine, che la
pagina chiede dopo e solo per l'amministratore. Un controllo nuovo si aggiunge
li', con un caso in `prove/cruscotto.mjs`.

Il target annuo dell'impianto si scrive **solo in Target & Status**
(`ImpiantoTargetSecondaria.target`, in kg, per anno) e le Giacenze lo leggono da
li' (`targetImpiantoDellAnno`: il record attivo di esattamente quell'anno, nessun
ripiego sugli anni prima). Il target delle primarie di un sito non si scrive: e' la
somma dei target annui dei raccoglitori di quell'anno legati a quel sito
(`targetPrimarieDelSito`, `TargetRaccoglitore.impianto`); per chi e' impianto e
stoccaggio sta sulla riga dell'impianto, perche' il totale non lo conti due volte.
I vecchi `GiacenzaSito.target_totale_t` e `target_primarie_t` restano nel database
e non si scrivono piu' (in Giacenze si vedono in sola lettura): servono solo di
**ripiego di transizione**, quando Target & Status non da' niente, con l'anomalia
`target_da_portare`. Il pulsante "Porta in Target & Status i target scritti in
Giacenze" (`portaTargetInTargetStatus`) crea i record che mancano, con
`segue_predittivita: false`. Il vecchio confronto fra i due (divergenze, alert
`target_impianto_divergente`, voce della dashboard) non c'e' piu':
`checkTargetAlerts` chiude soltanto gli alert rimasti aperti. Tutto in
`base44/shared/targetImpianti.ts` (`targetRigaGiacenze`).

I contratti passano da generato a inviato a controfirmato, con la data di ogni
passaggio: un contratto generato non e' un contratto fatto.

**La prefattura in PDF** non la legge un agente: con oltre quattrocento righe si
rifiuta di restituirle tutte (provato il 20/09/2026). Il browser ne estrae il testo
con pdf.js (`src/lib/pdfTesto.js`, caricata solo quando serve) e
`leggiLineePdfPrefattura` lo legge riga per riga. Il PDF porta in testa il
riepilogo stampato (ordini, chili, euro per classi 1-4 e classe 9) e il mese: se
le righe lette non sommano quel riepilogo il caricamento viene rifiutato. Sul PDF
vero di luglio 2026: 416 righe, identiche all'Excel una per una.

**Nello schema un elenco va dichiarato `"type": "array"`.** Scritto come `object`
il server rifiuta il dato con `Error in field X: Input should be a valid
dictionary` e la funzione risponde 500. E' successo per davvero: il registro delle
esportazioni (`EsportazioneFatturazione.documento_ids`) non ha registrato niente
dal giorno in cui e' nato, e nessuno se n'era accorto perche' il file veniva
comunque prodotto. Quando si aggiunge un campo che conterra' un elenco lo si
dichiara `array` con i suoi `items`, anche se per ora non ci scrive nessuno.

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

**Quando una pagina carica piu' riquadri indipendenti si usa
`Promise.allSettled`, non `Promise.all`.** Le funzioni che leggono gli archivi
grandi ogni tanto cadono: su Terminati Rete bastava `computeRaccoglitoriMix` a
500 per lasciare vuote anche la matrice per provincia, i tempi di evasione e gli
alert. Chi non ha risposto si dice per nome, con "Riprova"; il resto resta a
video.

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
contatori, il verdetto per canale e una **storia scritta** in italiano di poche
centinaia di caratteri. Prima di questa data le verifiche dei report settimanali
si cancellavano per intero e le liste degli assegnati dopo due mesi: se ne andava
proprio la storia che l'utente vuole tenere.

- **A giorni** (`daAlleggerire` + `alleggerisciDocumenti`, workflow notturno alle
  3:15): `VerificaReport`, `QuadraturaFir`, `ConsuntivoFornitore`.
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
**non contiene costi**: il record lo legge chiunque (`rls read: true`) e la
fatturazione passiva e' riservata all'amministratore, quindi `storiaConsuntivo`
riporta chili e formulari ma non l'importo previsto ne' gli scarti in euro.
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
  `importPdrFile`, con un tetto di 10 per caricamento.
- **Ogni notte** (`alleggerisciDocumenti`) l'arretrato: per ogni tipo si tiene il
  file del caricamento riuscito piu' recente e si tolgono gli altri, fino a 40
  per giro. Serve perche' ci sono tipi che si caricano una volta al mese o meno, e
  il loro file resterebbe ad aspettare il caricamento dopo.

**Il record del registro non si tocca**: righe importate, righe in archivio
prima, forzature, foglio riconosciuto e messaggio sono il controllo
anti-regressione e la storia dei caricamenti. Se ne va solo `file_url`, e al
messaggio si aggiunge la riga che dice quando e perche'.

**La trappola**: un caricamento **forzato** riusa il file del tentativo che non
era riuscito (`pendingFileUrlRef` in `src/pages/CaricamentoDati.jsx`), quindi due
record del registro puntano allo stesso indirizzo. Cancellarlo perche' "e' del
caricamento di prima" cancellerebbe il file del caricamento buono: per questo si
decide prima quali indirizzi si TENGONO e solo dopo si toglie il resto, e lo
stesso indirizzo non si cancella due volte.

Primarie, dichiarazioni di trattamento e ordini non dichiarati non hanno questo
problema: si leggono nel browser a blocchi e il file non sale mai
(`TIPI_LETTURA_BROWSER` in `src/lib/importGrandeFile.js`). Il file delle
richieste ECT invece saliva e il suo indirizzo non veniva salvato da nessuna
parte: ora `importaRichiesteEct` lo cancella appena l'ha letto, perche' dopo
nessuno saprebbe piu' che esiste.

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
   controllo online, quella su Normattiva e quella sul corso RT, ed entrano cinque
   righe (D, D-bis, D-ter, D-quater) su come si risponde a un numero: il numero
   nella prima riga con la sua etichetta (soggetto, canale, periodo), niente
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

**Due regole da non perdere:**

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
