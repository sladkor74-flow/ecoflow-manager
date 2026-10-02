// L'inventario dei file che la piattaforma tiene per noi
// (base44/shared/inventarioFile.ts).
//
// E' la lista che si manda a chi deve rimuoverli a mano, perche' la piattaforma
// non sa cancellare un file. Un elenco sbagliato qui vuol dire chiedere la
// rimozione di file che non esistono, o dimenticarne di veri: per questo si
// prova.
//
// npm run prove
import { voceFile, voceOrfana, perFile, csvInventario, contaInventario, ARCHIVI_CON_FILE, testoRichiesta, AZIONE_ORFANO, AZIONE_PRIVATO, AZIONE_PUBBLICO } from '../base44/shared/inventarioFile.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const def = ARCHIVI_CON_FILE.find(a => a.entita === 'UploadLog');
const defQualifica = ARCHIVI_CON_FILE.find(a => a.entita === 'DocumentoQualifica');

console.log('UNA RIGA SOLO SE QUEL RECORD TIENE DAVVERO UN FILE');
verifica('senza niente, nessuna voce', voceFile(def, { id: 'a' }) === null);
verifica('con i campi vuoti, nessuna voce', voceFile(def, { id: 'a', file_url: '', file_uri: '  ' }) === null);
verifica('un file pubblico si riconosce', voceFile(def, { id: 'a', file_url: 'https://x/y.xlsx' }).genere === 'pubblico');
verifica('un file privato si riconosce', voceFile(def, { id: 'a', file_uri: 'uri-123' }).genere === 'privato');
{
  // Un record convertito porta il file_uri e il file_url vuoto; se per qualche
  // motivo li avesse tutti e due, vince il pubblico: e' quello che va rimosso.
  const v = voceFile(def, { id: 'a', file_url: 'https://x/y.xlsx', file_uri: 'uri-123' });
  verifica('con tutti e due vince il pubblico', v.genere === 'pubblico' && v.riferimento === 'https://x/y.xlsx', JSON.stringify(v));
}
{
  const v = voceFile(def, { id: 'r1', file_uri: 'u1', tipo_file: 'secondarie', nome_file: 'SECONDARIE.xlsx', created_date: '2026-09-12T10:00:00Z' });
  verifica('la descrizione dice che file era', v.descrizione === 'secondarie · SECONDARIE.xlsx', v.descrizione);
  verifica('e quando e stato caricato', v.caricato_il === '2026-09-12', v.caricato_il);
}
{
  const v = voceFile(defQualifica, { id: 'q1', file_uri: 'u9', soggetto_nome: 'GATIM SRL', tipo_documento_nome: 'Visura' });
  verifica('la qualifica dice il soggetto e il documento', v.descrizione === 'GATIM SRL · Visura', v.descrizione);
}

console.log('UN FILE PER RIGA, NON UN RECORD PER RIGA');
{
  // Il caso vero: un caricamento forzato riusa il file del tentativo fallito, e
  // nel registro restano piu' righe con lo stesso indirizzo. Sul file
  // dell'utente, 72 record per 53 file.
  const voci = [
    voceFile(def, { id: 'r1', file_url: 'https://x/uguale.xlsx', tipo_file: 'terziarie', nome_file: 'A.xlsx', created_date: '2026-08-10T08:00:00Z' }),
    voceFile(def, { id: 'r2', file_url: 'https://x/uguale.xlsx', tipo_file: 'terziarie', nome_file: 'A.xlsx', created_date: '2026-08-10T09:00:00Z' }),
    voceFile(def, { id: 'r3', file_url: 'https://x/uguale.xlsx', tipo_file: 'terziarie', nome_file: 'A.xlsx', created_date: '2026-08-10T10:00:00Z' }),
    voceFile(def, { id: 'r4', file_uri: 'privato-1', tipo_file: 'pdr', nome_file: 'PDR.xlsx', created_date: '2026-09-01T08:00:00Z' }),
  ];
  const file = perFile(voci);
  verifica('tre record, un file solo', file.length === 2, JSON.stringify(file.map(f => f.riferimento)));
  const doppio = file.find(f => f.riferimento === 'https://x/uguale.xlsx');
  verifica('e si dice quanti record lo usavano', doppio.record === 3, String(doppio.record));
  verifica('con tutti i loro id', doppio.id.join(',') === 'r1,r2,r3', doppio.id.join(','));

  const conta = contaInventario(voci);
  verifica('il conto dei FILE e due', conta.file === 2, JSON.stringify(conta));
  verifica('il conto dei RECORD e quattro', conta.record === 4, JSON.stringify(conta));
  verifica('un pubblico e un privato', conta.pubblici === 1 && conta.privati === 1, JSON.stringify(conta));
}

console.log('I PUBBLICI ESCONO PER PRIMI: SONO QUELLI CHE SCOTTANO');
{
  const voci = [
    voceFile(def, { id: 'p1', file_uri: 'privato-a', tipo_file: 'pdr', nome_file: 'P.xlsx', created_date: '2026-01-01T08:00:00Z' }),
    voceFile(def, { id: 'p2', file_url: 'https://x/pubblico.xlsx', tipo_file: 'primarie', nome_file: 'PRIMARIE.xlsx', created_date: '2026-09-01T08:00:00Z' }),
  ];
  const righe = csvInventario(voci).split('\n');
  verifica('intestazione giusta, con la colonna che dice che cosa farne', righe[0] === 'genere,azione,riferimento,archivio,cosa,descrizione,caricato_il,record_che_lo_usano', righe[0]);
  verifica('il pubblico e la prima riga, anche se caricato dopo', righe[1].startsWith('pubblico,DA FAR RIMUOVERE') && righe[1].includes('https://x/pubblico.xlsx'), righe[1]);
  verifica('il privato viene dopo', righe[2].startsWith('privato,'), righe[2]);
}

console.log('IL CSV NON SI ROMPE CON LE VIRGOLE E LE VIRGOLETTE');
{
  const voci = [voceFile(def, { id: 'x', file_url: 'https://x/a.xlsx', tipo_file: 'primarie', nome_file: 'REPORT, "settembre".xlsx' })];
  const riga = csvInventario(voci).split('\n')[1];
  verifica('il campo con la virgola sta fra virgolette', /"primarie · REPORT, ""settembre"".xlsx"/.test(riga), riga);
  verifica('e le colonne restano otto', riga.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).length === 8, riga);
}

// OGNI RIGA DI QUESTO ELENCO E' UN FILE IN USO, E DEVE DIRLO.
//
// Il 02/10/2026 e' mancato poco che costasse caro: l'elenco e' stato mandato
// all'assistenza della piattaforma chiedendo la rimozione dei file, e dentro
// c'erano anche i 144 documenti di qualifica dei fornitori, i 4 modelli delle
// lettere e una stampa di quadratura. Li ha fermati l'assistenza.
console.log('L\'ELENCO DICE CHE COSA FARNE, RIGA PER RIGA');
{
  const pubblico = voceFile(def, { id: 'p', file_url: 'https://x/a.xlsx', tipo_file: 'primarie', nome_file: 'A.xlsx' });
  const privato = voceFile(def, { id: 'q', file_uri: 'uri-b', tipo_file: 'pdr', nome_file: 'B.xlsx' });
  verifica('un file in uso lo dice', pubblico.in_uso === true && privato.in_uso === true);
  verifica('il pubblico va fatto rimuovere, ma prima si toglie il riferimento',
    /DA FAR RIMUOVERE/.test(pubblico.azione) && /Prima togli il riferimento/.test(pubblico.azione), pubblico.azione);
  verifica('il privato NON va rimosso: e\' il documento di un record',
    /^NON RIMUOVERE/.test(privato.azione) && /sta usando/.test(privato.azione), privato.azione);
  const conta = contaInventario([pubblico, privato, privato]);
  verifica('i conti dicono quanti sono in uso e quanti da far rimuovere',
    conta.in_uso === 2 && conta.da_far_rimuovere === 1 && conta.pubblici === 1 && conta.privati === 1, JSON.stringify(conta));
  const frase = testoRichiesta(conta);
  verifica('e la frase per l\'assistenza dice entrambe le cose, coi numeri',
    /Da rimuovere: 1 file con indirizzo pubblico/.test(frase) && /Da NON rimuovere: 1 file privati/.test(frase), frase);
  verifica('senza pubblici lo dice e basta', /Non ci sono piu' file con indirizzo pubblico/.test(testoRichiesta({ pubblici: 0, privati: 3 })), testoRichiesta({ pubblici: 0, privati: 3 }));
}

console.log('I FILE CHE NESSUN RECORD USA PIU');
{
  // Dal 02/10/2026 l'inventario non nasce piu' soltanto dai record. Un record
  // cancellato si portava via il nome del suo file, e quel file restava
  // caricato per sempre senza che si potesse nemmeno chiedere di rimuoverlo:
  // ora le cancellazioni lo scrivono nel registro FileDaRimuovere e da li
  // entra qui. E' l'unico file privato che si fa rimuovere, perche' e' l'unico
  // che nessuno sta usando.
  const reg = { id: 'f1', riferimento: 'uri-nappi-38', genere: 'privato', entita: 'VerificaReport', cosa: 'report settimanale di un fornitore', descrizione: 'NAPPI SUD SRL - settimana 38/2026', motivo: 'record cancellato', annotato_il: '2026-10-02', stato: 'da_chiedere' };
  verifica('senza riferimento non e una voce', voceOrfana({ id: 'x' }) === null);
  const v = voceOrfana(reg);
  verifica('un orfano non e in uso', v.in_uso === false, JSON.stringify(v));
  verifica('e si fa rimuovere, anche se privato', v.azione === AZIONE_ORFANO && v.genere === 'privato', v.azione);
  verifica('il giorno e quello in cui si e smesso di usarlo', v.caricato_il === '2026-10-02', v.caricato_il);
  verifica('e si sa ancora di che file era', v.descrizione.includes('NAPPI SUD SRL') && v.cosa.includes('report'), JSON.stringify(v));
}
{
  // L USO VINCE SEMPRE. Lo stesso file puo comparire come orfano nel registro e
  // come file di un record vivo: se una cancellazione non e andata in porto, o
  // se due record puntavano allo stesso file e se n'e' cancellato uno. In quel
  // caso NON si fa rimuovere: fra le due letture si tiene quella che non fa
  // danni.
  const inUso = voceFile(ARCHIVI_CON_FILE.find(a => a.entita === 'VerificaReport'), { id: 'v9', file_uri: 'uri-doppio', soggetto_nome: 'GATIM SRL', settimana: 40, anno: 2026 });
  const orfano = voceOrfana({ id: 'f9', riferimento: 'uri-doppio', genere: 'privato', entita: 'VerificaReport', annotato_il: '2026-10-02' });
  for (const ordine of [[inUso, orfano], [orfano, inUso]]) {
    const file = perFile(ordine);
    verifica('un file ancora usato non si fa rimuovere, in qualunque ordine arrivi',
      file.length === 1 && file[0].in_uso === true && file[0].azione === AZIONE_PRIVATO, JSON.stringify(file));
    verifica('e il record che lo usa si conta una volta sola', file[0].record === 1, String(file[0].record));
  }
  verifica('un orfano solo non ha nessun record che lo usa', perFile([orfano])[0].record === 0);
}
{
  // L'ordine dell'elenco: prima i pubblici, che scottano perche' il loro
  // indirizzo funziona per chiunque; poi gli orfani, che si fanno rimuovere;
  // per ultimi i privati in uso, che non si toccano.
  const pubblico = voceFile(ARCHIVI_CON_FILE.find(a => a.entita === 'UploadLog'), { id: 'u1', file_url: 'https://media.base44.com/files/public/app/a_b.xlsx', created_date: '2026-09-01T00:00:00Z' });
  const orfano = voceOrfana({ id: 'f1', riferimento: 'uri-orfano', genere: 'privato', entita: 'VerificaReport', annotato_il: '2026-10-02' });
  const privato = voceFile(ARCHIVI_CON_FILE.find(a => a.entita === 'DocumentoQualifica'), { id: 'd1', file_uri: 'uri-durc', soggetto_nome: 'GATIM SRL', tipo_documento_nome: 'DURC' });
  const file = perFile([privato, orfano, pubblico]);
  verifica('i pubblici per primi, poi gli orfani, poi i privati in uso',
    file.map(v => v.azione).join(' | ') === [AZIONE_PUBBLICO, AZIONE_ORFANO, AZIONE_PRIVATO].join(' | '), file.map(v => v.azione).join(' | '));
  const conta = contaInventario([privato, orfano, pubblico]);
  verifica('gli orfani si contano a parte', conta.orfani === 1 && conta.file === 3, JSON.stringify(conta));
  verifica('in uso sono gli altri due', conta.in_uso === 2 && conta.record === 2, JSON.stringify(conta));
  verifica('si fa rimuovere il pubblico piu l orfano', conta.da_far_rimuovere === 2, String(conta.da_far_rimuovere));
  const frase = testoRichiesta(conta);
  verifica('e la frase per l assistenza li nomina tutti e tre',
    /Da rimuovere: 1 file con indirizzo pubblico/.test(frase)
    && /Da rimuovere anche: 1 file che nessun record usa/.test(frase)
    && /Da NON rimuovere: 1 file privati/.test(frase), frase);
}
{
  // Un orfano con indirizzo pubblico e' una pratica sola, non due: si chiederebbe
  // due volte la rimozione dello stesso file.
  const orfanoPubblico = voceOrfana({ id: 'f2', riferimento: 'https://media.base44.com/files/public/app/c_d.xlsx', genere: 'pubblico', entita: 'UploadLog', annotato_il: '2026-10-02' });
  const conta = contaInventario([orfanoPubblico]);
  verifica('un orfano pubblico si conta una volta', conta.da_far_rimuovere === 1 && conta.pubblici === 1 && conta.orfani === 1, JSON.stringify(conta));
}
{
  verifica('senza orfani la frase non li nomina', !/nessun record usa/.test(testoRichiesta({ pubblici: 1, privati: 2, orfani: 0 })), testoRichiesta({ pubblici: 1, privati: 2, orfani: 0 }));
  const csv = csvInventario([voceOrfana({ id: 'f3', riferimento: 'uri-solo', genere: 'privato', entita: 'VerificaReport', annotato_il: '2026-10-02' })]);
  verifica('il CSV dice che si fa rimuovere e che nessun record lo usa',
    csv.includes(AZIONE_ORFANO) && /,0$/.test(csv.trim()), csv);
}

console.log('SI GUARDANO TUTTI GLI ARCHIVI CHE TENGONO UN FILE');
{
  // Se qualcuno aggiunge un campo file a un'entita' e si dimentica di questa
  // tabella, quel file resta fuori dall'inventario e nessuno lo fara' rimuovere.
  const attesi = ['UploadLog', 'DocumentoQualifica', 'ContrattoFornitore', 'ModelloContratto', 'ModelloDocumento', 'QuadraturaFir', 'VerificaReport', 'EsportazioneFatturazione'];
  for (const e of attesi) verifica(`${e} e nell'inventario`, ARCHIVI_CON_FILE.some(a => a.entita === e));
  verifica('ogni voce dice almeno un campo', ARCHIVI_CON_FILE.every(a => a.campoUrl || a.campoUri));
  verifica('e ogni voce sa descriversi', ARCHIVI_CON_FILE.every(a => typeof a.etichetta === 'function' && typeof a.cosa === 'string' && a.cosa));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
