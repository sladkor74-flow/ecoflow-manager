// Prova della manutenzione dell'archivio (base44/shared/fileArchivio.ts): quali
// documenti sostituiti possono perdere il file. npm run prove
import {
  daAlleggerire, giorniDa, fileDaSostituire, arretratiDaSostituire,
  cancellaFile, provaACancellare, cancellazioneNegata, sostituisciFilePrecedenti, segnalaFileNonRimossi,
  avvisoFileDallInventario,
} from '../base44/shared/fileArchivio.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const ADESSO = Date.parse('2026-09-21T10:00:00Z');
const anniFa = (n) => new Date(ADESSO - n * 365 * 86400000).toISOString();

const documenti = [
  { id: 'vecchio', stato: 'sostituito', file_uri: 'f1', soggetto_nome: 'ALFA', tipo_documento_nome: 'DURC', updated_date: anniFa(4) },
  { id: 'vecchissimo', stato: 'sostituito', file_uri: 'f2', soggetto_nome: 'BETA', tipo_documento_nome: 'Visura camerale', updated_date: anniFa(7) },
  { id: 'appena', stato: 'sostituito', file_uri: 'f3', soggetto_nome: 'GAMMA', tipo_documento_nome: 'DURC', updated_date: anniFa(1) },
  { id: 'senza_file', stato: 'sostituito', file_uri: '', updated_date: anniFa(6) },
  { id: 'attivo', stato: 'attivo', file_uri: 'f5', updated_date: anniFa(6) },
  { id: 'nato_vecchio_messo_da_parte_ieri', stato: 'sostituito', file_uri: 'f6', created_date: anniFa(8), updated_date: anniFa(0.2) },
];

const scelti = daAlleggerire(documenti, { adessoMs: ADESSO });
const ids = scelti.map(x => x.id);

console.log('CHI PUO PERDERE IL FILE');
verifica('sostituito da quattro anni', ids.includes('vecchio'));
verifica('sostituito da sette anni', ids.includes('vecchissimo'));
verifica('in tutto due, non uno di piu', scelti.length === 2, ids.join(','));

console.log('CHI NON SI TOCCA');
verifica('sostituito da un anno: e ancora recente', !ids.includes('appena'));
verifica('un documento attivo non si tocca mai', !ids.includes('attivo'));
verifica('senza file non ce niente da togliere', !ids.includes('senza_file'));
verifica('conta da quando e stato messo da parte, non da quando e nato', !ids.includes('nato_vecchio_messo_da_parte_ieri'));

console.log('COME SI PRESENTA');
verifica('prima i piu vecchi', scelti[0].id === 'vecchissimo' && scelti[0].anni === 7);
verifica('ogni riga dice chi e cosa', scelti[1].soggetto_nome === 'ALFA' && scelti[1].tipo_documento_nome === 'DURC');
verifica('la soglia si puo cambiare', daAlleggerire(documenti, { adessoMs: ADESSO, anni: 6 }).length === 1);
verifica('con soglia bassa entra anche quello di un anno', daAlleggerire(documenti, { adessoMs: ADESSO, anni: 1 }).length === 3);
verifica('giorniDa senza data non inventa numeri', giorniDa(null, ADESSO) === null);



// === I FILE DEL CARICAMENTO DATI (29/09/2026) ===
// "si devono sostituire ogni volta che carico il successivo, sempre che sia stato
// caricato al 100%": il record del registro resta, se ne va solo il file.
const registro = [
  { id: 'sec1', tipo_file: 'secondarie', file_url: 'u1', nome_file: 'sec settembre.xlsx', esito: 'successo', created_date: '2026-09-01T08:00:00Z' },
  { id: 'sec2', tipo_file: 'secondarie', file_url: 'u2', nome_file: 'sec ottobre.xlsx', esito: 'successo', created_date: '2026-10-01T08:00:00Z' },
  { id: 'sec3', tipo_file: 'secondarie', file_url: '', nome_file: 'sec agosto.xlsx', esito: 'successo', created_date: '2026-08-01T08:00:00Z' },
  { id: 'ter1', tipo_file: 'terziarie', file_url: 'u4', nome_file: 'ter settembre.xlsx', esito: 'successo', created_date: '2026-09-02T08:00:00Z' },
  { id: 'ter2', tipo_file: 'terziarie', file_url: 'u5', nome_file: 'ter ottobre a meta.xlsx', esito: 'parziale', created_date: '2026-10-02T08:00:00Z' },
  { id: 'pdr1', tipo_file: 'pdr', file_url: 'u6', nome_file: 'pdr.xlsx', esito: 'successo', created_date: '2026-03-01T08:00:00Z' },
  { id: 'gom1', tipo_file: 'gommisti', file_url: 'u7', nome_file: 'gom rotto.xlsx', esito: 'errore', created_date: '2026-05-01T08:00:00Z' },
  { id: 'gom2', tipo_file: 'gommisti', file_url: 'u8', nome_file: 'gom rotto 2.xlsx', esito: 'errore', created_date: '2026-06-01T08:00:00Z' },
];

console.log('QUANDO ARRIVA UN CARICAMENTO NUOVO');
const prec = fileDaSostituire(registro, { tipoFile: 'secondarie', idCorrente: 'sec2' });
verifica('il precedente dello stesso tipo perde il file', prec.map(x => x.id).join() === 'sec1', prec.map(x => x.id).join());
verifica('quello appena caricato non si tocca', !prec.some(x => x.id === 'sec2'));
verifica('chi non ha piu il file non si riconta', !prec.some(x => x.id === 'sec3'));
verifica('gli altri tipi non si toccano', !prec.some(x => x.tipo_file === 'terziarie'));
verifica('porta il nome del file, per poterlo dire', prec[0].nome_file === 'sec settembre.xlsx');

console.log("L'ARRETRATO, TIPO PER TIPO");
const arretrati = arretratiDaSostituire(registro);
const perTipo = Object.fromEntries(arretrati.map(g => [g.tipo_file, g]));
verifica('delle secondarie si tiene il piu recente', perTipo.secondarie.tenuto.id === 'sec2' && perTipo.secondarie.da_togliere[0].id === 'sec1');
verifica('un tipo con un file solo non compare', !perTipo.pdr);
verifica('si tiene il RIUSCITO piu recente, non il parziale',
  perTipo.terziarie.tenuto.id === 'ter1' && perTipo.terziarie.da_togliere[0].id === 'ter2');
verifica('se nessuno e riuscito si tiene il piu recente e basta',
  perTipo.gommisti.tenuto.id === 'gom2' && perTipo.gommisti.da_togliere.map(x => x.id).join() === 'gom1');
verifica('un registro vuoto non da niente da fare', arretratiDaSostituire([]).length === 0);
verifica('senza file non si tocca niente', arretratiDaSostituire([{ id: 'x', tipo_file: 'secondarie', file_url: '' }]).length === 0);

console.log("LA FORZATURA RIUSA LO STESSO FILE");
// Il tentativo fallito e la forzatura riuscita puntano allo stesso indirizzo:
// cancellarlo perche' "e' del caricamento di prima" cancellerebbe il file buono.
const conForzatura = [
  { id: 'f1', tipo_file: 'status', file_url: 'uguale', nome_file: 'status.xlsx', esito: 'errore', created_date: '2026-10-05T08:00:00Z' },
  { id: 'f2', tipo_file: 'status', file_url: 'uguale', nome_file: 'status.xlsx', esito: 'successo', created_date: '2026-10-05T08:10:00Z' },
  { id: 'f0', tipo_file: 'status', file_url: 'vecchio', nome_file: 'status settembre.xlsx', esito: 'successo', created_date: '2026-09-05T08:00:00Z' },
];
const dopoForzatura = fileDaSostituire(conForzatura, { tipoFile: 'status', idCorrente: 'f2', fileCorrente: 'uguale' });
verifica('il file del tentativo fallito non si cancella: e lo stesso del buono', !dopoForzatura.some(x => x.file_url === 'uguale'), dopoForzatura.map(x => x.file_url).join());
verifica('quello davvero vecchio si cancella', dopoForzatura.map(x => x.id).join() === 'f0');
const arrForzatura = arretratiDaSostituire(conForzatura);
verifica("nell'arretrato l'indirizzo tenuto non si tocca mai", !arrForzatura[0].da_togliere.some(x => x.file_url === 'uguale'), JSON.stringify(arrForzatura[0].da_togliere.map(x => x.id)));
verifica('e il piu vecchio se ne va', arrForzatura[0].da_togliere.map(x => x.id).join() === 'f0');

// === CANCELLARE UN FILE NON SI PUO', E NON SI PROVA PIU' ===
//
// L'assistenza della piattaforma, 30/09/2026: le uniche integrazioni sui file
// sono UploadFile, UploadPrivateFile, CreateFileSignedUrl e
// ExtractDataFromUploadedFile, e nessuna cancella. DeleteFile, DeletePrivateFile
// e RemoveFile non sono endpoint: integrations.Core e' un Proxy che restituisce
// una funzione per qualunque nome, ed e' per questo che sembravano esistere e
// rispondevano "Method Not Allowed".
console.log('NON SI CHIAMA PIU\' NIENTE');
{
  let chiamate = 0;
  const spia = new Proxy({}, { get: () => async () => { chiamate++; } });
  const base = { asServiceRole: { integrations: { Core: spia } } };
  const e = await cancellaFile(base, 'file://x');
  verifica('zero richieste alla piattaforma', chiamate === 0, 'chiamate=' + chiamate);
  verifica('e si dice che non si puo', e.negata === true && /nessuna operazione per cancellare/.test(e.come), JSON.stringify(e));
}
{
  // LA COSA PIU' IMPORTANTE DI TUTTO IL FILE. Sette punti del gestionale
  // decidono su "riuscita" se svuotare il riferimento al file sul record. Se
  // questa dicesse "riuscita" senza che il file sia sparito, il record
  // perderebbe l'indirizzo di un file che resta vivo e raggiungibile da chiunque
  // abbia il link: quel file non si potrebbe piu' nemmeno far rimuovere, perche'
  // non sapremmo piu' quale chiedere.
  const base = { asServiceRole: { integrations: { Core: new Proxy({}, { get: () => async () => ({ ok: true }) }) } } };
  const e = await cancellaFile(base, 'file://x');
  verifica('NON dice mai di esserci riuscita', e.riuscita === false, JSON.stringify(e));
  const vuoto = await cancellaFile(base, '');
  verifica('senza file non dichiara niente', vuoto.riuscita === false && vuoto.negata === false, JSON.stringify(vuoto));
}
{
  // Il vecchio tentativo resta, per il giorno in cui la cancellazione esistesse.
  const tutte = { DeleteFile: async () => { throw new Error('Method Not Allowed'); } };
  const e = await provaACancellare({ asServiceRole: { integrations: { Core: tutte } } }, 'file://x');
  verifica('provaACancellare riconosce ancora il rifiuto', e.negata === true, JSON.stringify(e));
  const buona = await provaACancellare({ asServiceRole: { integrations: { Core: { DeleteFile: async () => ({}) } } } }, 'file://x');
  verifica('e riconosce ancora il successo', buona.riuscita === true && buona.come === 'DeleteFile');
}

verifica('nessun fallimento, nessun rifiuto', cancellazioneNegata([]) === false);
verifica('tutti negati: negata', cancellazioneNegata([{ negata: true }, { negata: true }]) === true);
verifica('uno di altro genere: non si conclude', cancellazioneNegata([{ negata: true }, { negata: false }]) === false);

console.log('UN CARICAMENTO NON SPENDE PIU\' NIENTE PER CANCELLARE');
{
  let chiamate = 0;
  const core = new Proxy({}, { get: () => async () => { chiamate++; } });
  const righe = [];
  for (let i = 0; i < 5; i++) righe.push({ id: 'v' + i, tipo_file: 'secondarie', file_url: 'u' + i, nome_file: 'SECONDARIE.xlsx', esito: 'successo', created_date: `2026-09-0${i + 1}T08:00:00Z` });
  righe.push({ id: 'nuovo', tipo_file: 'secondarie', file_url: 'ultimo', nome_file: 'SECONDARIE.xlsx', esito: 'successo', created_date: '2026-09-29T08:00:00Z' });
  const alert = [];
  const base = {
    asServiceRole: {
      integrations: { Core: core },
      entities: {
        UploadLog: { filter: async () => righe, update: async () => { throw new Error('non si deve togliere il riferimento: e l unico elenco dei file da far rimuovere'); } },
        Alert: { filter: async () => [], create: async (d) => { alert.push(d); return d; }, update: async () => {} },
      },
    },
  };
  const esito = await sostituisciFilePrecedenti(base, { tipoFile: 'secondarie', idCorrente: 'nuovo', oggi: '2026-09-30' });
  verifica('zero richieste alla piattaforma', chiamate === 0, 'chiamate=' + chiamate);
  verifica('niente tolto', esito.tolti === 0);
  verifica('e restano tutti e cinque', esito.restano === 5, JSON.stringify(esito));
  verifica("l'alert e stato aperto", alert.length === 1);
  verifica('con il numero vero', alert[0].quanti === 5, String(alert[0].quanti));
}

console.log('L\'AVVISO DICE UNA COSA SOLA, E VERA');
{
  const alert = [];
  const base = { asServiceRole: { entities: { Alert: { filter: async () => [], create: async (d) => { alert.push(d); return d; }, update: async () => {} } } } };
  await segnalaFileNonRimossi(base, {
    nonRiusciti: [{ nome_file: 'SECONDARIE.xlsx', pubblico: true }, { nome_file: 'contratto.pdf' }],
    bloccati: 2, oggi: '2026-09-30',
  });
  const d = alert[0];
  verifica('il titolo dice che cancellarli non si puo', /cancellarli non si puo/.test(d.titolo), d.titolo);
  verifica('dice che la piattaforma non ha l operazione', /non ha nessuna operazione per cancellare/.test(d.descrizione));
  verifica('e che la conferma viene dalla sua assistenza', /assistenza il 30\/09\/2026/.test(d.descrizione));
  verifica('rassicura sui dati e sulla storia scritta', /la storia scritta sono al loro posto/.test(d.descrizione));
  verifica('dice che i pubblici vengono per primi', /caricato in area pubblica/.test(d.descrizione) && /da far rimuovere per primi/.test(d.descrizione), d.descrizione.slice(0, 600));
  verifica('e manda al pulsante che produce l elenco', /Elenco dei file caricati/.test(d.descrizione));

  // Le bugie di prima: nessuna deve tornare.
  verifica('NON promette un ritentativo notturno', !/riprova da solo/.test(d.descrizione), d.descrizione);
  verifica('NON dice di farsi abilitare la cancellazione', !/si possa abilitare/.test(d.descrizione));
  verifica('NON manda a cercare un pulsante nel pannello', !/a mano dall.area file/.test(d.descrizione));
  verifica('NON spaventa con lo spazio che cresce', !/cresce soltanto lo spazio|cresce.*spazio occupato/.test(d.descrizione), d.descrizione);
  verifica('NON elenca funzioni che non esistono', !/DeleteFile|RemoveFile/.test(d.descrizione));
  verifica('NON promette che l avviso si chiude da solo', /non si chiude da solo/.test(d.descrizione) && !/Appena la cancellazione funziona/.test(d.descrizione), d.descrizione);
  verifica('anzi dice di chiuderlo a mano', /chiudilo tu quando te lo confermano/.test(d.descrizione));
}
{
  // Senza file pubblici il testo cambia: quelli privati non sono raggiungibili.
  const alert = [];
  const base = { asServiceRole: { entities: { Alert: { filter: async () => [], create: async (d) => { alert.push(d); return d; }, update: async () => {} } } } };
  await segnalaFileNonRimossi(base, { nonRiusciti: [{ nome_file: 'allegato.pdf' }], bloccati: 1, oggi: '2026-10-05' });
  verifica('coi soli privati si dice che nessuno li raggiunge', /non sono raggiungibili da nessuno/.test(alert[0].descrizione), alert[0].descrizione.slice(0, 500));
  verifica('e il titolo resta al singolare', /1 file caricato resta/.test(alert[0].titolo), alert[0].titolo);
}
{
  // L'avviso gia' aperto si AGGIORNA col testo nuovo: se lo si lasciasse stare,
  // quello vecchio resterebbe nel pannello con le frasi false per sempre.
  const aggiornati = [];
  const base = { asServiceRole: { entities: { Alert: { filter: async () => [{ id: 'a1' }], create: async () => {}, update: async (id, d) => aggiornati.push({ id, ...d }) } } } };
  const esito = await segnalaFileNonRimossi(base, { nonRiusciti: [{ nome_file: 'x.xlsx', pubblico: true }], bloccati: 1, oggi: '2026-10-05' });
  verifica('quello aperto viene riscritto', esito.alert === 'aggiornato' && aggiornati.length === 1 && /cancellarlo non si puo/.test(aggiornati[0].titolo), JSON.stringify(esito));
  // IL SINGOLARE E IL PLURALE: con un solo file il titolo diceva «1 file caricato
  // resta sulla piattaforma: CANCELLARLI non si puo'», una riga sola che si
  // contraddice a meta'. Non si vedeva finche' i file erano decine, e il
  // 10/10/2026 l'inventario ne ha contato uno.
  verifica('con un solo file il titolo e\' tutto al singolare',
    /^1 file caricato resta sulla piattaforma: cancellarlo non si puo/.test(aggiornati[0].titolo), aggiornati[0].titolo);
  verifica('e anche il da fare', /farlo rimuovere dal team/.test(aggiornati[0].descrizione));
}

console.log('UN AVVISO NON SI RISCRIVE A ZERO');
{
  // La pulizia gira ogni notte, e una notte senza niente da togliere non vuol
  // dire che i file di prima se ne siano andati: la piattaforma non li cancella.
  // L'avviso veniva riscritto con quanti = 0 e diceva «0 file caricati restano
  // sulla piattaforma: cancellarli non si puo'», una frase che si contraddice da
  // sola, ed e' stata in cima agli avvisi dell'amministratore per settimane.
  {
    const creati = [], aggiornati = [];
    const base = { asServiceRole: { entities: { Alert: {
      filter: async () => [{ id: 'a1', quanti: 59 }],
      create: async (d) => { creati.push(d); },
      update: async (id, d) => aggiornati.push({ id, ...d }),
    } } } };
    const esito = await segnalaFileNonRimossi(base, { nonRiusciti: [], bloccati: 0, oggi: '2026-10-10' });
    verifica('a zero, un avviso aperto si lascia stare', esito.alert === 'lasciato', JSON.stringify(esito));
    verifica('non si riscrive niente', aggiornati.length === 0 && creati.length === 0, JSON.stringify(aggiornati));
    verifica('e il conto vero resta quello di prima, non zero', esito.quanti === 59, String(esito.quanti));
  }
  {
    const creati = [];
    const base = { asServiceRole: { entities: { Alert: {
      filter: async () => [],
      create: async (d) => { creati.push(d); },
      update: async () => {},
    } } } };
    const esito = await segnalaFileNonRimossi(base, { nonRiusciti: [], bloccati: 0, oggi: '2026-10-10' });
    verifica('a zero e senza niente aperto non si apre nessun avviso', esito.alert === 'niente' && creati.length === 0, JSON.stringify(esito));
  }
  {
    // E quando i file ci sono davvero l'avviso si apre e si aggiorna come prima:
    // la guardia a zero non deve aver spento il presidio.
    const aggiornati = [];
    const base = { asServiceRole: { entities: { Alert: {
      filter: async () => [{ id: 'a1', quanti: 59 }],
      create: async () => {},
      update: async (id, d) => aggiornati.push({ id, ...d }),
    } } } };
    const esito = await segnalaFileNonRimossi(base, { nonRiusciti: [{ nome_file: 'x.xlsx' }], bloccati: 60, oggi: '2026-10-10' });
    verifica('con i file veri si aggiorna, e col numero nuovo', esito.alert === 'aggiornato' && esito.quanti === 60 && aggiornati[0].quanti === 60, JSON.stringify(esito));
    verifica('e il titolo non parte da zero', /60 file caricati restano/.test(aggiornati[0].titolo), aggiornati[0].titolo);
  }
}

console.log('LA DATA DELL\'AVVISO C\'E\' DAVVERO');
{
  // L'avviso ha detto «Al  c'e' un file che non serve piu'», con la data VUOTA:
  // chi lo chiamava passava giornoRoma() invece di oggiRoma(), e giornoRoma(v)
  // converte un istante dato - senza argomento torna stringa vuota. Nessun
  // errore, nessuna prova rotta, solo una frase mutilata a video.
  const apri = async (oggi) => {
    const creati = [];
    const base = { asServiceRole: { entities: { Alert: {
      filter: async () => [], create: async (d) => { creati.push(d); }, update: async () => {},
    } } } };
    await segnalaFileNonRimossi(base, { nonRiusciti: [{ nome_file: 'x.pdf' }], bloccati: 1, oggi });
    return creati[0];
  };
  const conData = await apri('2026-10-10');
  verifica('la data si legge, in italiano', /Al 10\/10\/2026 c'e' un file/.test(conData.descrizione), conData.descrizione.slice(0, 90));
  // E se la data non arriva, la frase comincia dal fatto invece che da «Al ».
  const senzaData = await apri('');
  verifica('senza data non si scrive una frase mutilata', !/Al\s\s/.test(senzaData.descrizione), senzaData.descrizione.slice(0, 90));
  verifica('e il fatto si dice comunque', /^c'e' un file che non serve piu'/.test(senzaData.descrizione), senzaData.descrizione.slice(0, 90));
}
console.log('IL CONTO VIENE DALL\'INVENTARIO, NON DALLA PULIZIA');
{
  // Il difetto di fondo: segnalaFileNonRimossi vede i file di UN giro di
  // pulizia, e un giro che non trova niente non vuol dire che i file di prima
  // se ne siano andati. L'inventario invece conta quello che esiste.
  const voci = [
    // Lo stesso file usato da DUE record: va chiesto una volta, non due.
    { entita: 'DocumentoQualifica', id: 'r1', riferimento: 'https://pubblico/uno.pdf', genere: 'pubblico', in_uso: true, descrizione: 'uno.pdf', cosa: 'documento' },
    { entita: 'DocumentoQualifica', id: 'r2', riferimento: 'https://pubblico/uno.pdf', genere: 'pubblico', in_uso: true, descrizione: 'uno.pdf', cosa: 'documento' },
    // Un orfano privato: nessun record lo usa piu'.
    { entita: 'FileDaRimuovere', id: 'o1', riferimento: 'uri://orfano', genere: 'privato', in_uso: false, descrizione: 'vecchio.xlsx', cosa: 'allegato' },
    // Un privato IN USO: non si fa togliere, e chiederlo per sbaglio e' gia'
    // successo il 02/10/2026 con i 144 documenti di qualifica.
    { entita: 'Omologa', id: 'u1', riferimento: 'uri://in-uso', genere: 'privato', in_uso: true, descrizione: 'omologa.pdf', cosa: 'omologa' },
  ];
  {
    const creati = [];
    const base = { asServiceRole: { entities: { Alert: {
      filter: async () => [],
      create: async (d) => { creati.push(d); },
      update: async () => {},
    } } } };
    const esito = await avvisoFileDallInventario(base, { conta: { da_far_rimuovere: 2 }, voci, oggi: '2026-10-10' });
    verifica('apre l\'avviso col numero dell\'inventario', esito.alert === 'aperto' && esito.quanti === 2, JSON.stringify(esito));
    verifica('e non dice zero', !/^0 file/.test(creati[0].titolo), creati[0].titolo);
    verifica('lo stesso file di due record si chiede una volta', /2 file caricati restano/.test(creati[0].titolo), creati[0].titolo);
    verifica('dice quale file pubblico viene per primo', /uno\.pdf/.test(creati[0].descrizione) && /da far rimuovere per primi/.test(creati[0].descrizione));
    verifica('e nomina l\'orfano', /vecchio\.xlsx/.test(creati[0].descrizione), creati[0].descrizione.slice(0, 700));
    verifica('ma NON il file che un record sta usando', !/omologa\.pdf/.test(creati[0].descrizione));
  }
  {
    // Niente piu' da far rimuovere: l'avviso non ha piu' oggetto e si chiude.
    // Tenerlo aperto a zero e' il difetto da cui siamo partiti.
    const aggiornati = [];
    const base = { asServiceRole: { entities: { Alert: {
      filter: async () => [{ id: 'a1', quanti: 59 }],
      create: async () => {},
      update: async (id, d) => aggiornati.push({ id, ...d }),
    } } } };
    const soloInUso = voci.filter(v => v.genere !== 'pubblico' && v.in_uso !== false);
    const esito = await avvisoFileDallInventario(base, { conta: { da_far_rimuovere: 0 }, voci: soloInUso, oggi: '2026-10-10' });
    verifica('a zero l\'avviso si chiude', esito.alert === 'chiuso', JSON.stringify(esito));
    verifica('e si dice perche\'', aggiornati[0].stato === 'risolto' && /non trova piu' nessun file/.test(aggiornati[0].risolto_note), JSON.stringify(aggiornati[0]));
  }
  {
    const creati = [];
    const base = { asServiceRole: { entities: { Alert: {
      filter: async () => [],
      create: async (d) => { creati.push(d); },
      update: async () => {},
    } } } };
    const esito = await avvisoFileDallInventario(base, { conta: { da_far_rimuovere: 0 }, voci: [], oggi: '2026-10-10' });
    verifica('e senza niente aperto non si apre niente', esito.alert === 'niente' && creati.length === 0, JSON.stringify(esito));
  }
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
