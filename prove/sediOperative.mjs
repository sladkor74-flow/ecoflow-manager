// IL CONTROLLO DELLE SEDI OPERATIVE DEI PUNTI DI RACCOLTA.
//
// Sul formulario va la sede operativa, non la sede legale. Il caso vero del
// 06/10/2026: EUROGOMME SRL di Lavello (PZ) risultava a portale in «Corso
// Vittorio Emanuele 138» - una vecchia sede legale - mentre l'officina sta sulla
// S.S. 93 al km 56,400, zona PALS. Gli indirizzi sono scritti in mille modi
// diversi, quindi quasi tutto il lavoro sta nel confrontarne due senza prendere
// per diverso quello che e' lo stesso posto.
//
// La difesa piu' importante e' l'ultima sezione: quello che torna da una ricerca
// in rete senza una fonte consultabile non diventa mai un indirizzo. npm run prove
import {
  normalizzaIndirizzo, numeroCivico, confrontaIndirizzi, fontiValide, esitoVerifica,
  daVerificare, riportaDecisione, indirizzoPerFormulario, ultimaVerificaPerPdr,
  chiaveSoggetto, verificaApplicabile, decisioneDiAltroPunto,
} from '../base44/shared/sediOperative.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('GLI INDIRIZZI SCRITTI IN MILLE MODI');
verifica('le abbreviazioni si sciolgono', normalizzaIndirizzo('V.le Berlinguer, 34') === 'VIALE BERLINGUER 34', normalizzaIndirizzo('V.le Berlinguer, 34'));
verifica('anche quelle dei corsi e delle contrade',
  normalizzaIndirizzo('C.SO UMBERTO I, 333') === 'CORSO UMBERTO I 333' && normalizzaIndirizzo('C.da Verneta') === 'CONTRADA VERNETA',
  normalizzaIndirizzo('C.da Verneta'));
verifica('e quelle delle strade provinciali', normalizzaIndirizzo('STR. PROV.  CASARANO') === 'STRADA PROVINCIALE CASARANO', normalizzaIndirizzo('STR. PROV.  CASARANO'));
verifica('la statale col chilometro si riconosce', normalizzaIndirizzo('S.S 93 KM 56,400') === 'SS 93 KM 56400', normalizzaIndirizzo('S.S 93 KM 56,400'));
verifica('un nome puntato non si incolla', normalizzaIndirizzo('VIALE J.KENNEDY 8/10') === 'VIALE J KENNEDY 8/10', normalizzaIndirizzo('VIALE J.KENNEDY 8/10'));
verifica('gli accenti e gli apostrofi non contano', normalizzaIndirizzo("VIA SANT'ANNA, SNC") === 'VIA SANT ANNA SNC', normalizzaIndirizzo("VIA SANT'ANNA, SNC"));
verifica('il civico si legge in fondo', numeroCivico('Corso Vittorio Emanuele,138') === '138' && numeroCivico('VIA X, SNC') === 'SNC' && numeroCivico('VIALE J.KENNEDY 8/10') === '8/10');

console.log('DUE INDIRIZZI A CONFRONTO');
verifica('lo stesso indirizzo scritto in due modi coincide',
  confrontaIndirizzi('VIA SERVIO TULLIO,50/52', 'Via Servio Tullio, 50/52') === 'coincide');
verifica('il civico 8/10 e il civico 8 sono la stessa officina',
  confrontaIndirizzi('VIALE J.KENNEDY 8/10', 'Viale Kennedy 8') === 'coincide', confrontaIndirizzi('VIALE J.KENNEDY 8/10', 'Viale Kennedy 8'));
verifica('l\'indirizzo del portale col comune attaccato coincide lo stesso',
  confrontaIndirizzi('Via Roma, 111', 'Via Roma 111, 85040 Nemoli (PZ)') === 'coincide');
// Il caso che ha fatto nascere tutto.
verifica('EUROGOMME: il corso in paese e la statale sono due posti diversi',
  confrontaIndirizzi('Corso Vittorio Emanuele,138', 'S.S 93 KM 56400, 85024 ZONA PALS') === 'diverso',
  confrontaIndirizzi('Corso Vittorio Emanuele,138', 'S.S 93 KM 56400, 85024 ZONA PALS'));
verifica('stessa via, civico lontano: incerto, lo guarda una persona',
  confrontaIndirizzi('VIA NAZIONALE 12', 'Via Nazionale, 480') === 'incerto',
  confrontaIndirizzi('VIA NAZIONALE 12', 'Via Nazionale, 480'));
verifica('un indirizzo vuoto non e\' una differenza: e\' un incerto',
  confrontaIndirizzi('', 'Via Roma 1') === 'incerto' && confrontaIndirizzi('Via Roma 1', '') === 'incerto');

console.log('SENZA FONTE NON E\' UN INDIRIZZO');
verifica('una fonte vale solo se e\' un indirizzo internet',
  JSON.stringify(fontiValide(['https://www.paginegialle.it/x', 'me lo ricordo', '', 'http://sito.it/a'])) === JSON.stringify(['https://www.paginegialle.it/x', 'http://sito.it/a']),
  JSON.stringify(fontiValide(['https://www.paginegialle.it/x', 'me lo ricordo'])));
const senzaFonti = esitoVerifica({
  portale: { indirizzo: 'Corso Vittorio Emanuele,138', comune: 'Lavello' },
  risposta: { indirizzo: 'S.S 93 KM 56400', comune: 'Lavello', confidenza: 'alta', fonti: ['lo so'] },
});
verifica('un indirizzo senza una fonte consultabile non si tiene',
  senzaFonti.esito === 'non_trovato' && senzaFonti.indirizzo_trovato === '' && /fonte/.test(senzaFonti.spiegazione), JSON.stringify(senzaFonti));
const conFonti = esitoVerifica({
  portale: { indirizzo: 'Corso Vittorio Emanuele,138', comune: 'Lavello' },
  risposta: { indirizzo: 'S.S. 93 km 56,400 - Zona PALS', comune: 'Lavello', provincia: 'pz', cap: '85024', confidenza: 'alta', fonti: ['https://www.google.com/maps/x', 'https://www.paginegialle.it/y'], spiegazione: 'Scheda dell\'attivita\' e pagine gialle' },
});
verifica('con due fonti e un indirizzo diverso, l\'esito e\' «diverso» e la confidenza resta alta',
  conFonti.esito === 'diverso' && conFonti.confidenza === 'alta' && conFonti.provincia_trovato === 'PZ' && conFonti.fonti.length === 2, JSON.stringify(conFonti));
// La citazione c'e': cosi' si prova la regola della fonte unica e non quella
// dell'eco, aggiunta dopo (la riga della fonte ora fa parte della risposta).
const unaSola = esitoVerifica({
  portale: { indirizzo: 'Via Roma 1', comune: 'Nemoli' },
  risposta: { indirizzo: 'Via Roma 1', comune: 'Nemoli', confidenza: 'alta', fonti: ['https://unsito.it/a'], citazione: 'Gommista - Via Roma 1, Nemoli' },
});
verifica('una fonte sola non fa una certezza: al massimo media',
  unaSola.esito === 'coincide' && unaSola.confidenza === 'media', JSON.stringify(unaSola));
// L'eco: a una ricerca a cui si e' dato l'indirizzo puo' venire facile ripeterlo.
const eco = esitoVerifica({
  portale: { indirizzo: 'Via Roma 1', comune: 'Nemoli' },
  risposta: { indirizzo: 'Via Roma, 1', comune: 'Nemoli', confidenza: 'alta', fonti: ['https://a.it/1', 'https://b.it/2'] },
});
verifica('una conferma che ripete il nostro indirizzo senza citare la riga vale poco',
  eco.esito === 'coincide' && eco.confidenza === 'bassa' && /ripete l'indirizzo/.test(eco.spiegazione), JSON.stringify(eco));
const conCitazione = esitoVerifica({
  portale: { indirizzo: 'Via Roma 1', comune: 'Nemoli' },
  risposta: { indirizzo: 'Via Roma, 1', comune: 'Nemoli', confidenza: 'alta', fonti: ['https://a.it/1', 'https://b.it/2'], citazione: 'Gommista Rossi - Via Roma 1, 85040 Nemoli (PZ)', ricerche_fatte: 'gommista Nemoli' },
});
verifica('ma con la riga della fonte la conferma vale',
  conCitazione.confidenza === 'alta' && conCitazione.citazione.length > 10 && conCitazione.ricerche_fatte === 'gommista Nemoli', JSON.stringify(conCitazione));
const altroComune = esitoVerifica({
  portale: { indirizzo: 'Via Roma 1', comune: 'Nemoli' },
  risposta: { indirizzo: 'Via Roma 1', comune: 'Lagonegro', confidenza: 'alta', fonti: ['https://a.it/1', 'https://b.it/2'] },
});
verifica('stessa via in un altro comune e\' un\'altra sede', altroComune.esito === 'diverso', JSON.stringify(altroComune));

console.log('CHI SI CONTROLLA');
const pdr = [
  { id_pdr: 1, ragione_sociale: 'A GOMME', indirizzo_pdr: 'Via Roma 1', comune_pdr: 'Nemoli' },
  { id_pdr: 2, ragione_sociale: 'B GOMME', indirizzo_pdr: 'Via Milano 2', comune_pdr: 'Lavello' },
  { id_pdr: 3, ragione_sociale: 'C GOMME', indirizzo_pdr: 'Via Napoli 3', comune_pdr: 'Napoli' },
  { id_pdr: 4, ragione_sociale: 'D GOMME', indirizzo_pdr: 'Via Bari 4', comune_pdr: 'Bari', sospeso: 'SI' },
  { id_pdr: 5, ragione_sociale: 'E GOMME', indirizzo_pdr: 'Via Lecce 5', comune_pdr: 'Lecce' },
];
const verifiche = [
  { id_pdr: 2, indirizzo_portale: 'Via Milano 2', verificato_il: '2026-10-01', esito: 'coincide' },
  { id_pdr: 3, indirizzo_portale: 'Via Vecchia 9', verificato_il: '2026-09-20', esito: 'coincide' },
  { id_pdr: 5, indirizzo_portale: 'Via Lecce 5', verificato_il: '2026-01-02', esito: 'coincide' },
];
const scelti = daVerificare({ pdr, idPdrConOrdini: [1, 2, 3, 4, 5], verifiche, oggi: '2026-10-06', giorniValidita: 180, limite: 10 });
verifica('si controlla chi non e\' mai stato controllato, chi e\' cambiato a portale e chi e\' vecchio',
  JSON.stringify(scelti.map(s => s.pdr.id_pdr)) === JSON.stringify([1, 3, 5]), JSON.stringify(scelti.map(s => [s.pdr.id_pdr, s.motivo])));
verifica('e il sospeso resta fuori: non gli si fa un formulario', !scelti.some(s => s.pdr.id_pdr === 4));
verifica('chi e\' stato controllato da poco e non e\' cambiato non si ricontrolla', !scelti.some(s => s.pdr.id_pdr === 2));
const soloConOrdini = daVerificare({ pdr, idPdrConOrdini: [1], verifiche, oggi: '2026-10-06' });
verifica('chi non ha ordini non si controlla: il formulario non lo si prepara',
  soloConOrdini.length === 1 && soloConOrdini[0].pdr.id_pdr === 1, JSON.stringify(soloConOrdini.map(s => s.pdr.id_pdr)));
verifica('il limite si rispetta', daVerificare({ pdr, idPdrConOrdini: [1, 2, 3, 4, 5], verifiche, oggi: '2026-10-06', limite: 2 }).length === 2);
verifica('l\'ultima verifica di un punto di raccolta e\' quella piu\' recente',
  ultimaVerificaPerPdr([{ id_pdr: 7, verificato_il: '2026-01-01', esito: 'coincide' }, { id_pdr: 7, verificato_il: '2026-09-01', esito: 'diverso' }]).get(7).esito === 'diverso');

console.log('LA DECISIONE GIA\' PRESA');
const presa = { stato: 'corretto', indirizzo_portale: 'Corso Vittorio Emanuele,138', indirizzo_trovato: 'S.S. 93 km 56,400', indirizzo_per_formulario: 'S.S. 93 km 56,400', comune_per_formulario: 'Lavello', deciso_il: '2026-10-06', deciso_da: 'admin' };
const uguale = riportaDecisione({ indirizzo_portale: 'Corso Vittorio Emanuele, 138', indirizzo_trovato: 'SS 93 KM 56400' }, presa);
verifica('se non e\' cambiato niente, la decisione si riporta sulla verifica nuova',
  uguale.stato === 'corretto' && uguale.indirizzo_per_formulario === 'S.S. 93 km 56,400', JSON.stringify(uguale));
const cambiatoPortale = riportaDecisione({ indirizzo_portale: 'Via Nuova 1', indirizzo_trovato: 'SS 93 KM 56400' }, presa);
verifica('se il portale e\' cambiato, si torna a decidere e si dice perche\'',
  cambiatoPortale.stato === 'da_decidere' && /portale/.test(cambiatoPortale.nota), JSON.stringify(cambiatoPortale));
const cambiataRete = riportaDecisione({ indirizzo_portale: 'Corso Vittorio Emanuele,138', indirizzo_trovato: 'Via Altra 5' }, presa);
verifica('e lo stesso se e\' cambiato quello che si trova in rete',
  cambiataRete.stato === 'da_decidere' && /rete/.test(cambiataRete.nota), JSON.stringify(cambiataRete));

console.log('CHE COSA VA SUL FORMULARIO');
const record = { indirizzo_pdr: 'Corso Vittorio Emanuele,138', cap_pdr: '85024', comune_pdr: 'Lavello', provincia_pdr: 'PZ' };
verifica('senza verifica, l\'indirizzo del portale',
  indirizzoPerFormulario(record, null).origine === 'portale');
verifica('con la sede corretta, quella confermata dall\'amministratore',
  indirizzoPerFormulario(record, { ...presa, verificato_il: '2026-10-06' }).indirizzo === 'S.S. 93 km 56,400');
verifica('con una differenza non ancora decisa, il portale ma con l\'avvertimento',
  indirizzoPerFormulario(record, { esito: 'diverso', stato: 'da_decidere' }).origine === 'portale_da_controllare');
verifica('confermato il portale, lo dice e porta la data',
  /confermato il 2026-10-06/.test(indirizzoPerFormulario(record, { esito: 'coincide', stato: 'confermato_portale', deciso_il: '2026-10-06' }).nota));

console.log('UN GOMMISTA CHE SPARISCE E RINASCE CON UN\'ALTRA ANAGRAFICA');
// Il caricamento cancella e riscrive tutti i punti: l'unica chiave che
// sopravvive e' id_pdr, che pero' dice quale posto, non chi. Negli stessi dati
// del 06/10/2026: 181 partite IVA con piu' di un punto, 33 anche con ragione
// sociale diversa.
verifica('la partita IVA e\' la stessa anche scritta in un altro modo',
  chiaveSoggetto({ partita_iva: 'IT 01234567 891' }) === chiaveSoggetto({ partita_iva: '01234567891' }),
  chiaveSoggetto({ partita_iva: 'IT 01234567 891' }));
verifica('senza partita IVA valgono nome e comune',
  chiaveSoggetto({ ragione_sociale: 'Eurogomme S.r.l.', comune_pdr: 'Lavello' }) === chiaveSoggetto({ ragione_sociale: 'EUROGOMME SRL', comune_portale: 'LAVELLO' }));
const vecchiaAltroSoggetto = { id_pdr: 308, ragione_sociale: 'LONGO FRANCESCO & FIGLI SNC', partita_iva: '03171111111', indirizzo_portale: 'Via Vecchia 1', comune_portale: 'Lamezia Terme', verificato_il: '2026-04-01', esito: 'coincide', stato: 'confermato_portale', deciso_il: '2026-04-01', deciso_da: 'admin' };
const puntoRiusato = { id_pdr: 308, ragione_sociale: 'ALTRA GOMME SRL', partita_iva: '09999999999', indirizzo_pdr: 'Via Nuova 7', comune_pdr: 'Lamezia Terme' };
verifica('un controllo intestato a un altro soggetto non vale piu\'',
  verificaApplicabile(vecchiaAltroSoggetto, puntoRiusato).vale === false, JSON.stringify(verificaApplicabile(vecchiaAltroSoggetto, puntoRiusato)));
verifica('ma se cambia solo il nome e la partita IVA e\' quella, vale',
  verificaApplicabile(vecchiaAltroSoggetto, { id_pdr: 308, ragione_sociale: 'Longo Pneumatici Snc', partita_iva: '03171111111', comune_pdr: 'Catanzaro' }).vale === true);
verifica('e quando non si riesce a dire chi sia, non si invalida niente',
  verificaApplicabile({ id_pdr: 1 }, { id_pdr: 1 }).vale === true);
// La difesa che conta: sul formulario non deve finire l'indirizzo di un altro.
const perAltro = indirizzoPerFormulario(puntoRiusato, { ...vecchiaAltroSoggetto, stato: 'corretto', indirizzo_per_formulario: 'Zona Industriale 9' });
verifica('l\'indirizzo confermato di un altro soggetto non va sul formulario',
  perAltro.indirizzo === 'Via Nuova 7' && perAltro.origine === 'portale_soggetto_cambiato' && /LONGO/.test(perAltro.nota), JSON.stringify(perAltro));
const tornaInCoda = daVerificare({ pdr: [puntoRiusato], idPdrConOrdini: [308], verifiche: [vecchiaAltroSoggetto], oggi: '2026-04-02', giorniValidita: 180 });
verifica('e il punto torna subito fra quelli da controllare, col motivo scritto',
  tornaInCoda.length === 1 && /altro soggetto/.test(tornaInCoda[0].motivo), JSON.stringify(tornaInCoda.map(s => s.motivo)));
// Lo stesso gommista che si re-iscrive con un numero nuovo: la decisione vecchia
// non si applica da sola, ma si ritrova.
const reiscritto = { id_pdr: 39180, ragione_sociale: 'Longo Pneumatici Snc', partita_iva: '03171111111', indirizzo_pdr: 'Via Nuova 7', comune_pdr: 'Catanzaro' };
const giaDeciso = decisioneDiAltroPunto(reiscritto, [vecchiaAltroSoggetto, { id_pdr: 500, partita_iva: '11111111111', stato: 'corretto' }]);
verifica('la sede gia\' decisa per lo stesso soggetto su un altro punto si ritrova',
  giaDeciso && giaDeciso.id_pdr === 308, JSON.stringify(giaDeciso && giaDeciso.id_pdr));
verifica('ma per il punto nuovo non c\'e\' nessuna verifica: si ricontrolla',
  daVerificare({ pdr: [reiscritto], idPdrConOrdini: [39180], verifiche: [vecchiaAltroSoggetto], oggi: '2026-10-06' })[0].motivo === 'mai controllato');

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
