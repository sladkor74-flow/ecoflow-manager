// Prova della conservazione dei documenti dei fornitori
// (base44/shared/conservazione.ts): chi perde il dettaglio al quarantesimo
// giorno, e che cosa resta scritto quando lo perde. npm run prove
import {
  GIORNI_CONSERVAZIONE, LUNGHEZZA_STORIA, CAMPI_PESANTI, daAlleggerire, etaGiorni,
  campiPesantiPieni, eAlleggerito, tagliaStoria, conNota, nota, MOTIVO_MESE, motivoSuperato,
  storiaVerifica, storiaQuadratura, storiaLista, storiaControllo, storiaConsuntivo,
} from '../base44/shared/conservazione.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const ADESSO = Date.parse('2026-09-29T10:00:00Z');
const giorniFa = (n) => new Date(ADESSO - n * 86400000).toISOString();

console.log('QUANTO SI CONSERVA');
verifica('quaranta giorni, come chiesto dall utente', GIORNI_CONSERVAZIONE === 40);
verifica('la storia sta sotto la soglia del testo lungo', LUNGHEZZA_STORIA < 8000);

console.log('CHI PERDE IL DETTAGLIO');
const verifiche = [
  { id: 'vecchia', avviata_il: giorniFa(50), esito_json: '@parti:3', righe_report_json: 'x' },
  { id: 'al_limite', avviata_il: giorniFa(40), esito_json: '{}' },
  { id: 'un_giorno_prima', avviata_il: giorniFa(39), esito_json: '{}' },
  { id: 'gia_fatta', avviata_il: giorniFa(90), esito_json: '', alleggerito_il: '2026-09-01', storia: 'ok' },
  { id: 'gia_vuota', avviata_il: giorniFa(90), esito_json: '', righe_report_json: '', lettura_json: '' },
  { id: 'senza_data', esito_json: '{}' },
  { id: 'solo_file', avviata_il: giorniFa(60), esito_json: '', file_uri: 'f1' },
  // Svuotata, storia scritta, nessun giorno segnato: e' un alleggerimento
  // interrotto fra la seconda e la terza scrittura. Le sue parti pesanti sono
  // ancora in ContenutoEsteso e nessun altro le raggiungerebbe mai piu'.
  { id: 'interrotta', avviata_il: giorniFa(70), esito_json: '', righe_report_json: '', storia: 'la sua storia era stata scritta' },
];
const { scelti, senza_data } = daAlleggerire(verifiche, { entita: 'VerificaReport', adessoMs: ADESSO });
const ids = scelti.map(x => x.id);
verifica('cinquanta giorni: si alleggerisce', ids.includes('vecchia'));
verifica('esattamente quaranta giorni: si alleggerisce', ids.includes('al_limite'));
verifica('trentanove giorni: non ancora', !ids.includes('un_giorno_prima'));
verifica('gia alleggerita: non si tocca piu', !ids.includes('gia_fatta'));
verifica('senza niente da togliere: non si tocca', !ids.includes('gia_vuota'));
verifica('senza data non si tocca, ma si dice', !ids.includes('senza_data') && senza_data.includes('senza_data'));
verifica('un file rimasto basta a farla entrare', ids.includes('solo_file'));
verifica('un alleggerimento interrotto si riprende', ids.includes('interrotta'));
verifica('e si vede che e una ripresa', scelti.find(x => x.id === 'interrotta').ripreso === true);
verifica('chi e stato alleggerito per intero non si riprende', !ids.includes('gia_fatta'));
verifica('in tutto quattro', scelti.length === 4, ids.join(','));
verifica('prima le piu vecchie', ids.join(',') === 'interrotta,solo_file,vecchia,al_limite', ids.join(','));
verifica('dice quali campi togliere', scelti.find(x => x.id === 'vecchia').campi.join(',') === 'righe_report_json,esito_json');
verifica('dice quale file riprendere', scelti.find(x => x.id === 'solo_file').file_uri === 'f1');
verifica('la soglia si puo cambiare', daAlleggerire(verifiche, { entita: 'VerificaReport', giorni: 39, adessoMs: ADESSO }).scelti.length === 5);

console.log('DA QUANDO SI CONTA');
verifica('dal caricamento, non dalla competenza', etaGiorni({ avviata_il: giorniFa(10) }, 'VerificaReport', ADESSO) === 10);
verifica('se manca la prima data si usa la seconda', etaGiorni({ verificata_il: giorniFa(7) }, 'VerificaReport', ADESSO) === 7);
verifica('created_date e l ultima rete', etaGiorni({ created_date: giorniFa(3) }, 'VerificaReport', ADESSO) === 3);
verifica('senza nessuna data non si inventa un numero', etaGiorni({}, 'VerificaReport', ADESSO) === null);
verifica('il consuntivo si conta dal caricamento', etaGiorni({ caricato_il: giorniFa(5), mese: 1 }, 'ConsuntivoFornitore', ADESSO) === 5);
verifica('gia alleggerito si riconosce', eAlleggerito({ alleggerito_il: '2026-09-01' }) && !eAlleggerito({}));
verifica('i campi pieni si distinguono dai vuoti', campiPesantiPieni({ esito_json: '{}', righe_json: '   ' }, 'QuadraturaFir').join() === 'esito_json');
verifica('ogni archivio ha i suoi campi pesanti', CAMPI_PESANTI.ControlloEvasione.includes('esito_json') && CAMPI_PESANTI.ListaAssegnati.includes('righe_json'));

console.log('LA STORIA DI UN REPORT SETTIMANALE');
const v = {
  soggetto_nome: 'NAPPI SUD', anno: 2026, settimana: 39, data_inizio: '2026-09-21', data_fine: '2026-09-27',
  file_nome: 'report.xlsx', verificata_il: '2026-09-28T09:00:00Z', conformita: 'parziale',
  per_canale: [
    { canale: 'rete', nome: 'Rete', conformita: 'piena', anomalie: 0, assenti: 0 },
    { canale: 'aci', nome: 'ACI', conformita: 'parziale', anomalie: 2, assenti: 1 },
  ],
  righe_report: 42, conformi: 38, con_discrepanze: 3, non_trovate: 1, duplicate: 0,
  assenti_nel_report: 2, date_da_sistemare: 1, osservazioni: 2, rettifiche: 1,
  righe_escluse: 3, peso_escluse_kg: 12400, uscite_verificate: false,
};
const esitoV = {
  quadratura: [
    { chiave: 'ingresso_rete', nome: 'Ingressi di rete', formulari_report: 38, kg_report: 512340, formulari_gestionale: 38, kg_gestionale: 512340 },
    { chiave: 'ingresso_aci', nome: 'Ingressi ACI', formulari_report: 4, kg_report: 41000, formulari_gestionale: 5, kg_gestionale: 48000 },
    { chiave: 'uscita_rete', nome: 'Uscite di rete', formulari_report: 0, kg_report: 0, formulari_gestionale: 0, kg_gestionale: 0 },
  ],
  esiti: [
    { n: 4, anomalia: true, esito: 'discrepanze', report: { fir: 'FIRAAA001', kg: 1200 }, discrepanze: [{ messaggio: 'Peso diverso: report 1200 kg, gestionale 1400 kg' }] },
    { n: 9, anomalia: false, esito: 'conforme', report: { fir: 'FIRAAA002', kg: 900 }, discrepanze: [] },
  ],
  assenti: [{ fir: 'FIRAAA009', ordine: 'ET26001380', kg: 6900, fine: '2026-09-24' }],
  nota_date: '2 righe portano la data solo nella colonna dell\'inizio trasporto',
};
const sv = storiaVerifica(v, esitoV);
verifica('dice chi e quale settimana', sv.includes('NAPPI SUD') && sv.includes('settimana 39'));
verifica('dice il verdetto per canale, senza sommarli', sv.includes('Rete: conformita\' piena') && sv.includes('ACI: conformita\' parziale'));
verifica('non somma mai i canali in un totale', !/\b42 formulari\b/.test(sv));
verifica('porta i formulari e i chili per movimentazione', sv.includes('Ingressi di rete') && sv.includes('512.340'));
verifica('lascia fuori le movimentazioni senza niente', !sv.includes('Uscite di rete'));
verifica('dice chi non tornava, con il motivo', sv.includes('FIRAAA001') && sv.includes('Peso diverso'));
verifica('non elenca le righe conformi', !sv.includes('FIRAAA002'));
verifica('dice i formulari assenti dal report', sv.includes('FIRAAA009') && sv.includes('6.900'));
verifica('dice che le uscite non erano nel report', sv.includes('soli ingressi'));
verifica('dice le righe escluse con il peso', sv.includes('12.400'));
verifica('senza esito scrive lo stesso quello che sa', storiaVerifica(v, null).includes('conformita\' parziale'));

// A quaranta giorni il dettaglio se ne va: di un carico di una settimana
// precedente non registrato, che aveva un termine, deve restare scritto tutto
// (01/10/2026).
const svArretrati = storiaVerifica(v, {
  ...esitoV,
  esiti: [
    ...esitoV.esiti,
    {
      n: 12, anomalia: true, esito: 'non_trovata', report: { fir: 'HTQKS004521ZT', kg: 7400, fine: '2026-09-14' },
      fuori_settimana: { anno: 2026, settimana: 38, arretrata: true },
      termine: { partenza: '2026-09-14', partenza_da: 'report_arrivo', scadenza: '2026-09-25', giorni: 10 },
      discrepanze: [{ messaggio: 'Formulario non presente nel gestionale, ed e\' della settimana 38' }],
    },
    {
      n: 13, anomalia: false, esito: 'discrepanze', report: { fir: 'RGYTR000028AA', kg: 9000, fine: '2026-07-10' },
      fuori_settimana: { anno: 2026, settimana: 28, arretrata: true }, discrepanze: [],
    },
  ],
});
verifica('la storia dice i carichi di altre settimane, quanti e quali', svArretrati.includes('Carichi di altre settimane comparsi in questo report: 2')
  && svArretrati.includes('HTQKS004521ZT del 14/09/2026, settimana 38') && svArretrati.includes('RGYTR000028AA del 10/07/2026, settimana 28'), svArretrati);
verifica('e di quello non registrato dice il termine, che era il fatto grave', svArretrati.includes('di cui 1 non registrato al momento della verifica')
  && svArretrati.includes('non registrato, termine di registrazione 25/09/2026') && svArretrati.includes('settimana 28: registrato'), svArretrati);
verifica('senza carichi di altre settimane non ne parla', !storiaVerifica(v, esitoV).includes('Carichi di altre settimane'));
verifica('una dichiarazione si racconta come tale',
  storiaVerifica({ ...v, file_tipo: 'dichiarazione', nota: 'email del 28/09' }, null).includes('dichiarata nessuna movimentazione'));
verifica('la storia sta in un campo, non in ContenutoEsteso', sv.length <= LUNGHEZZA_STORIA);

console.log('LA STORIA DI UNA QUADRATURA FIR');
const q = {
  anno: 2026, settimana: 39, data_inizio: '2026-09-21', data_fine: '2026-09-27', file_nome: 'winsinfo.pdf',
  verificata_il: '2026-09-28T09:00:00Z', tabelle: 4, righe_lette: 37, lettura_verificata: true, settimana_indicata: 38,
  per_canale: [{ canale: 'RETE', conformita: 'parziale', celle: 12, congruenti: 10, incongruenti: 2, non_confrontabili: 0, date_da_sistemare: 1 }],
};
const esitoQ = {
  flussi: [{
    titolo: 'Ingressi in primaria', tabelle_mancanti: ['portale Ecotyre'],
    celle: [
      { impianto: 'IRIGOM', trasportatore: 'EMMESSE', verdetto: 'scostamento', winsinfo: { n: 5, kg: 40000 }, ecotyre: { n: 5, kg: 40000 }, gestionale: { n: 4, kg: 32000 } },
      { impianto: 'GATIM', trasportatore: 'GATIM', verdetto: 'congruente', winsinfo: { n: 3, kg: 20000 } },
    ],
  }],
  osservazioni: ['Sul file e\' scritta la settimana 38'],
};
const sq = storiaQuadratura(q, esitoQ);
verifica('dice la settimana e il file', sq.includes('settimana 39') && sq.includes('winsinfo.pdf'));
verifica('dice che la trascrizione torna con i totali stampati', sq.includes('confermata dai totali'));
verifica('dice la settimana scritta sul file quando e diversa', sq.includes('settimana 38'));
verifica('dice il verdetto del canale', sq.includes('RETE: quadratura parziale'));
verifica('elenca chi non quadrava con le tre fonti', sq.includes('IRIGOM') && sq.includes('WINSINFO 5') && sq.includes('gestionale 4'));
verifica('non elenca le celle congruenti', !sq.includes('GATIM'));
verifica('dice le tabelle mancanti', sq.includes('manca la tabella di portale Ecotyre'));
verifica('senza esito resta il verdetto per canale', storiaQuadratura(q, null).includes('RETE: quadratura parziale'));

console.log('LA STORIA DI UNA LISTA E DEL SUO CONTROLLO');
const l = { raccoglitore_nome: 'EMMESSE', anno: 2026, mese: 9, richieste: 80, prioritarie: 12, inviata_il: '2026-09-01', caricata_il: '2026-09-02T08:00:00Z', file_nomi: 'assegnati.xlsx' };
const sl = storiaLista(l, [{ testo: '3 ID non corrispondevano a nessun ordine' }]);
verifica('dice il raccoglitore e il mese', sl.includes('EMMESSE') && sl.includes('9/2026'));
verifica('dice quante richieste e quante prioritarie', sl.includes('80 richieste') && sl.includes('12 prioritarie'));
verifica('dice quando e stata inviata', sl.includes('01/09/2026'));
verifica('porta gli avvisi di lettura', sl.includes('3 ID non corrispondevano'));

const ctrl = {
  raccoglitore_nome: 'EMMESSE', anno: 2026, mese: 9, eseguito_il: '2026-09-28T09:00:00Z', dati_al: '2026-09-27',
  richieste: 80, evase: 60, evase_da_altri: 2, aperte: 18, prioritarie_aperte: 3, arretrate_aperte: 1,
  fuori_ordine: 4, trascurate: 2, fuori_lista: 5, annullate: 1, riassegnate: 0, non_piu_presenti: 0,
  raccolto_kg: 412000, target_kg: 500000, proiezione_kg: 470000, alert_alti: 1, alert_totali: 4,
};
const sc = storiaControllo(ctrl,
  [{ gravita: 'alta', testo: 'Tre richieste prioritarie sono aperte da oltre due settimane.' },
    { gravita: 'info', testo: 'Due ordini evasi sono stati immessi dopo l\'invio della lista.' }],
  { righe: [{ stato: 'aperta', id_ordine: 'ET26001380', produttore: 'GOMMISTA ROSSI', comune: 'NAPOLI', prioritaria: true }] });
verifica('dice i conti del mese', sc.includes('80 richieste in lista') && sc.includes('60 evase') && sc.includes('18 ancora aperte'));
verifica('dice i chili della rete', sc.includes('412.000') && sc.includes('500.000'));
verifica('tiene le segnalazioni alte', sc.includes('prioritarie sono aperte'));
verifica('lascia andare le informative', !sc.includes('dopo l\'invio della lista'));
verifica('dice quali erano rimaste aperte', sc.includes('ET26001380') && sc.includes('GOMMISTA ROSSI'));
verifica('senza alert ripiega sul conteggio', storiaControllo(ctrl, [], null).includes('1 segnalazione alta'));

console.log('LA STORIA DI UN CONSUNTIVO');
const cons = { fornitore: 'EMMESSE', ruolo: 'raccoglitore', canale: 'RETE', anno: 2026, mese: 9, file_nome: 'consuntivo.xlsx', caricato_il: '2026-10-02T08:00:00Z', confrontato_il: '2026-10-02T08:05:00Z', quadra: false, importo_consuntivo: 15840.5 };
const esitoC = {
  confronto: { voci: [{}, {}, {}], uguali: 200, peso_diverso: 3, solo_consuntivo: 1, kg_solo_consuntivo: 6900, solo_gestionale: 2, kg_solo_gestionale: 14200, senza_chiave: 0, totale_consuntivo_kg: 1482300, totale_gestionale_kg: 1489600 },
  esito: { non_controllato: ['l\'importo previsto, perche\' manca la tariffa della tratta'], scarto_importo: -320.4, quadra_importo: false },
  costo: { trovato: true, importo: 16160.9 },
};
const scons = storiaConsuntivo(cons, esitoC);
verifica('dice chi, come e quale mese', scons.includes('EMMESSE') && scons.includes('raccoglitore') && scons.includes('9/2026'));
verifica('dice il verdetto', scons.includes('NON corrispondeva'));
verifica('dice che cosa non tornava', scons.includes('3 con un peso diverso') && scons.includes('6.900'));
verifica('dice i chili a confronto', scons.includes('1.482.300') && scons.includes('1.489.600'));
verifica('dice l importo scritto dal fornitore', scons.includes('15840.50'));
verifica('NON dice i costi della passiva: il record lo legge chiunque',
  !scons.includes('16160') && !scons.includes('320') && !/previsto[^,]*euro/.test(scons));
verifica('dice quello che non si e potuto controllare', scons.includes('Non si e\' potuto controllare'));

console.log('IL TAGLIO E LA NOTA');
const lungo = 'riga lunghissima '.repeat(600);
const tagliato = tagliaStoria(lungo);
verifica('una storia lunga si taglia', tagliato.length <= LUNGHEZZA_STORIA);
verifica('e il taglio si dice', tagliato.includes('non e\' stato conservato'));
verifica('una storia corta non si tocca', tagliaStoria('due parole') === 'due parole');
const conLaNota = conNota('la storia', '2026-11-08');
verifica('la nota dice quando e perche', conLaNota.includes('08/11/2026') && conLaNota.includes('oltre 40 giorni'));
verifica('la nota non butta via la storia', conLaNota.startsWith('la storia'));
// Il motivo deve essere quello VERO: un controllo superato in giornata a cui si
// scrivesse "caricato da oltre quaranta giorni" resterebbe una bugia per sempre.
verifica('un controllo superato non dice i quaranta giorni',
  !nota('2026-10-06', motivoSuperato('2026-10-06')).includes('40 giorni'));
verifica('e dice da quale controllo e stato superato',
  nota('2026-10-06', motivoSuperato('2026-10-06')).includes('superato dal controllo del 06/10/2026'));
verifica('una lista archiviata dice che il mese e chiuso', nota('2026-11-01', MOTIVO_MESE).includes("mese e' chiuso"));
verifica('storia piu nota restano sotto il limite del campo', conNota(tagliato, '2026-11-08').length < 8000);

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
