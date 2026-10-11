// QUANDO UNA TARIFFA VALE, E QUANDO UN'UNITA' NON SI SA LEGGERE: UNA REGOLA
// SOLA PER FATTURA, PASSIVA, FOGLIO E LISTA DELL'ANNO NUOVO (chiusura
// dell'audit, 11/10/2026).
//
// 2-validita-stato, 5.9: prima la fattura e la passiva tenevano una tariffa
//   'non_attivo' purche' avesse una data di fine, il foglio dell'amministrazione
//   e la lista dell'anno nuovo no; e la passiva scartava una tariffa senza
//   stato e senza date, che il foglio teneva. Ora 'non_attivo' non vale mai, lo
//   stato vuoto e' 'attivo' (validitaTariffa.ts), e se una disattivata tocca il
//   mese lo si dice.
// 5.8: un'unita' fuori elenco faceva zero muto nella passiva e mille volte il
//   dovuto nella fattura (si moltiplicava come se fosse al chilo).
// 5.7: un prezzo al chilo nel foglio dell'amministrazione diventa a tonnellata
//   anche sui trasporti e sulle voci proposte.
// 5.10: il foglio legge tariffe, voci e interventi per intero.
//
// node prove/validitaTariffa.mjs
import { readFileSync } from 'node:fs';
import { calcolaPassivaMese } from '../base44/shared/passivaCalcolo.ts';
import { calcolaRigheAttiva } from '../base44/shared/attivaCalcolo.ts';
import { calcolaTotale } from '../base44/shared/ecotyreTariffe.ts';
import { copreIlGiorno, tariffeDaRinnovare } from '../base44/shared/inizializzazioneAnno.ts';
import { caricaLibPagine } from './dati/libPagine.mjs';

const { tariffaDellaVoce, foglioPassiva, modelloDaPassiva } = await caricaLibPagine('lib/passivaAmministrazione');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const archivi = (x) => ({ primarieRete: [], primarieAci: [], secondarieAll: [], extraRaccoltaAll: [], tariffeAll: [], fornitoriAll: [], ...x });

const fornitori = [{ ragione_sociale: 'NAPPI SUD SRL' }, { ragione_sociale: 'IRIGOM SRL' }];
const primaria = (id, kg, giorno) => ({
  id, stato: 'terminato', id_ordine: 'ET' + id, numero_fir: 'F' + id, trasportatore: 'NAPPI SUD SRL', provincia: 'NA', regione: 'Campania',
  destinazione: 'IRIGOM SRL', tipo_destinazione: 'imp', classe: 'P', peso_effettivo: kg, automezzo: 'AA' + id, cer: '160103',
  trasporto_finito_il: giorno, ordine_immesso_il: '2026-09-01T00:00:00.000Z', trasporto_iniziato_il: giorno,
});
const raccolta = (x) => ({ id: 'p', direzione: 'PASSIVA', prestazione: 'RACCOLTA', tipologia: 'RETE', fornitore_nome: 'NAPPI SUD SRL', unita_misura: '€/t', valore: 58, ...x });
const attiva = (x) => ({ id: 'a', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', unita_misura: '€/t', valore: 202, ...x });
const voceNappi = { soggetto: 'NAPPI SUD SRL', voce: 'Campania', canale: 'RETE', blocco: 'raccoglitori', anno: 2026 };

// Le quattro letture della stessa tariffa nello stesso giorno.
function quattro(tPassiva, tAttiva, giornoIso) {
  // il giorno italiano dell'istante, come lo leggono tutti
  const giorno = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(giornoIso));
  const p = calcolaPassivaMese(archivi({ primarieRete: [primaria('1', 2000, giornoIso)], tariffeAll: [tPassiva], fornitoriAll: fornitori }), 2026, Number(giorno.slice(5, 7)) - 1, 'Mese', 'RETE');
  const rigaP = (p.raccoglitori.find(f => /NAPPI/.test(f.fornitore)) || { righe: [] }).righe[0] || {};
  const nomeMese = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][Number(giorno.slice(5, 7)) - 1];
  const a = calcolaRigheAttiva({ reteAll: [primaria('1', 2000, giornoIso)], aciAll: [], extraAll: [], fornitori, tariffe: [tAttiva], anno: 2026, mese: nomeMese });
  const rigaA = a.righe.RETE[0] || {};
  return {
    passiva: rigaP.importo > 0,
    attiva: rigaA.totale > 0,
    foglio: !!tariffaDellaVoce([tPassiva], voceNappi, 'RETE', 'raccoglitori', giorno),
    lista: copreIlGiorno(tPassiva, giorno),
    anomaliePassiva: p.anomalie, anomalieAttiva: a.anomalie, rigaP, rigaA,
  };
}
const tutti = (q, v) => q.passiva === v && q.attiva === v && q.foglio === v && q.lista === v;
const dice = (q) => JSON.stringify({ passiva: q.passiva, attiva: q.attiva, foglio: q.foglio, lista: q.lista });

console.log("1. UNA TARIFFA 'NON_ATTIVO' NON VALE MAI, PER NESSUNO");
{
  const chiusa = { stato: 'non_attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' };
  const q = quattro(raccolta(chiusa), attiva(chiusa), '2026-09-10T08:00:00.000Z');
  verifica('non_attivo con la data di fine: non vale in fattura, passiva, foglio e lista (prima fattura e passiva la usavano)', tutti(q, false), dice(q));
  verifica('la passiva lo dice: anomalia «tariffa_disattivata» con la data all\'italiana', q.anomaliePassiva.some(a => a.tipo === 'tariffa_disattivata' && /31\/12\/2026/.test(a.descrizione) && /rimettila attiva/.test(a.descrizione)), JSON.stringify(q.anomaliePassiva));
  verifica('e la riga resta «senza tariffa», non a zero muto', /senza tariffa/.test(q.rigaP.note || ''), JSON.stringify(q.rigaP));
  verifica('la fattura lo dice allo stesso modo', q.anomalieAttiva.some(a => a.tipo === 'tariffa_disattivata' && /31\/12\/2026/.test(a.descrizione)), JSON.stringify(q.anomalieAttiva));
  verifica('e la riga attiva e\' in errore', q.rigaA.stato_validazione === 'errore', JSON.stringify(q.rigaA));
  // fuori dalla sua finestra nessuno la nomina: non ha niente a che fare con quel mese
  const fuori = quattro(raccolta({ stato: 'non_attivo', data_inizio_validita: '2025-01-01', data_fine_validita: '2025-12-31' }), attiva({ stato: 'non_attivo', data_inizio_validita: '2025-01-01', data_fine_validita: '2025-12-31' }), '2026-09-10T08:00:00.000Z');
  verifica('una disattivata del 2025 non si segnala sul 2026', !fuori.anomaliePassiva.some(a => a.tipo === 'tariffa_disattivata') && !fuori.anomalieAttiva.some(a => a.tipo === 'tariffa_disattivata'));
}

console.log('2. LO STATO VUOTO E\' «ATTIVO», PER TUTTI');
{
  const q = quattro(raccolta({ stato: '' }), attiva({ stato: '' }), '2026-09-10T08:00:00.000Z');
  verifica('senza stato e senza date vale per tutti e quattro (prima la passiva la scartava e il foglio no)', tutti(q, true), dice(q));
}

console.log("3. L'ULTIMO GIORNO, SUL GIORNO ITALIANO");
{
  const finoA = { stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-06-30' };
  // le 23 italiane del 30 giugno sono le 21 UTC: e' ancora il 30
  const ultimo = quattro(raccolta(finoA), attiva(finoA), '2026-06-30T21:00:00.000Z');
  verifica('il 30 giugno alle 23 la tariffa che finisce il 30 vale per tutti', tutti(ultimo, true), dice(ultimo));
  // mezzanotte italiana del primo luglio = 22:00 UTC del 30: e' luglio
  const dopo = quattro(raccolta(finoA), attiva(finoA), '2026-06-30T22:00:00.000Z');
  verifica('a mezzanotte italiana del primo luglio non vale piu\' per nessuno', tutti(dopo, false), dice(dopo));
}

console.log("4. LA LISTA DELL'ANNO NUOVO CONTA QUELLO CHE LA FATTURA USA");
{
  const t26 = raccolta({ id: 't26', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' });
  verifica('una tariffa attiva che finisce il 31/12 e\' da rinnovare', tariffeDaRinnovare([t26], 2027, 'PASSIVA').length === 1);
  verifica('una disattivata no: non vale nemmeno il 31/12', tariffeDaRinnovare([{ ...t26, stato: 'non_attivo' }], 2027, 'PASSIVA').length === 0);
}

console.log("5. UN'UNITA' CHE NON SI SA LEGGERE: ZERO, MA DETTO");
{
  const strana = raccolta({ stato: 'attivo', unita_misura: '€/ton' });
  const p = calcolaPassivaMese(archivi({ primarieRete: [primaria('1', 2000, '2026-09-10T08:00:00.000Z')], tariffeAll: [strana], fornitoriAll: fornitori }), 2026, 8, 'Settembre', 'RETE');
  const riga = p.raccoglitori.find(f => /NAPPI/.test(f.fornitore)).righe[0];
  verifica('passiva: la riga vale zero', riga.importo === 0, JSON.stringify(riga));
  verifica('ma la nota lo dice (prima: niente)', /«€\/ton» sconosciuta: riga a zero/.test(riga.note || ''), JSON.stringify(riga.note));
  verifica('e fra le anomalie, con le tonnellate', p.anomalie.some(a => a.tipo === 'unita_sconosciuta' && a.tonnellate === 2 && /NAPPI SUD SRL/.test(a.descrizione)), JSON.stringify(p.anomalie));

  verifica('fattura: calcolaTotale con un\'unita\' sconosciuta fa zero, non chili per prezzo (prima 2000 x 202)', calcolaTotale(2000, { unita_misura: '€/T', valore: 202 }) === 0 && calcolaTotale(2000, { unita_misura: '€/t', valore: 202 }) === 404);
  const a = calcolaRigheAttiva({ reteAll: [primaria('1', 2000, '2026-09-10T08:00:00.000Z')], aciAll: [], extraAll: [], fornitori, tariffe: [attiva({ stato: 'attivo', unita_misura: '€/T' })], anno: 2026, mese: 'Settembre' });
  const r = a.righe.RETE[0];
  verifica('la riga attiva vale zero ed e\' in errore, con la nota', r.totale === 0 && r.stato_validazione === 'errore' && /«€\/T» sconosciuta/.test(r.note), JSON.stringify(r));
  verifica('e l\'anomalia «unita_sconosciuta»', a.anomalie.some(x => x.tipo === 'unita_sconosciuta' && x.tonnellate === 2), JSON.stringify(a.anomalie));
  verifica('le unita\' buone restano buone: €/t, €/ton, €/kg, €/viaggio', calcolaTotale(2000, { unita_misura: '€/ton', valore: 202 }) === 404 && calcolaTotale(2000, { unita_misura: '€/kg', valore: 0.202 }) === 404 && calcolaTotale(2000, { unita_misura: '€/viaggio', valore: 400 }) === 400);
}

console.log('6. IL PREZZO AL CHILO NEL FOGLIO DIVENTA A TONNELLATA');
{
  // un trasporto di secondaria a 0,03 €/kg: nella colonna «€\t» va 30, non 0,03
  const tariffe = [{ id: 'tk', direzione: 'PASSIVA', prestazione: 'TRASPORTO_SECONDARIA', tipologia: 'TUTTE', fornitore_nome: 'LOGISTICA SRL', unita_misura: '€/kg', valore: 0.03, produttore: 'NAPPI SUD SRL', destinatario: 'IRIGOM SRL', stato: 'attivo' }];
  const sec = { id: 's1', stato: 'terminato', id_ordine: 'S1', numero_fir: 'FS1', stoccaggio: 'NAPPI SUD SRL', trasportatore: 'LOGISTICA SRL', destinazione: 'IRIGOM SRL', tipo_destinazione: 'imp', classe: 'P', peso_effettivo: 10000, automezzo: 'BB1',
    trasporto_finito_il: '2026-09-05T08:00:00.000Z', ordine_immesso_il: '2026-09-01T00:00:00.000Z', trasporto_iniziato_il: '2026-09-05T08:00:00.000Z' };
  const p = calcolaPassivaMese(archivi({ secondarieAll: [sec], tariffeAll: tariffe, fornitoriAll: [{ ragione_sociale: 'LOGISTICA SRL' }] }), 2026, 8, 'Settembre', 'RETE');
  const f = foglioPassiva([], p, 'RETE', 'Settembre', 2026, tariffe, null);
  const t = f.trasporti.righe[0] || {};
  verifica('trasporto: 30 €/t, a tonnellata (prima 0,03 scritto come se fosse a tonnellata)', t.prezzo === 30 && t.unita_misura === 'euro_tonnellata' && t.totale === 300, JSON.stringify(t));
  // e con un'unita' che la passiva non sa leggere la riga resta a zero anche nel
  // foglio: un prezzo scritto la rimetterebbe a prezzo pieno al ricalcolo di Excel
  const strane = [{ ...tariffe[0], unita_misura: '€/ton', valore: 30 }];
  const pStrana = calcolaPassivaMese(archivi({ secondarieAll: [sec], tariffeAll: strane, fornitoriAll: [{ ragione_sociale: 'LOGISTICA SRL' }] }), 2026, 8, 'Settembre', 'RETE');
  const tStrana = foglioPassiva([], pStrana, 'RETE', 'Settembre', 2026, strane, null).trasporti.righe[0] || {};
  verifica('trasporto con un\'unita\' sconosciuta: zero, prezzo zero, e la nota lo dice', tStrana.totale === 0 && tStrana.prezzo === 0 && /sconosciuta/.test(tStrana.note || ''), JSON.stringify(tStrana));
  // la voce che il gestionale propone dal calcolo, quando il modello e' vuoto
  const racc = [raccolta({ id: 'pk', stato: 'attivo', unita_misura: '€/kg', valore: 0.058 })];
  const pr = calcolaPassivaMese(archivi({ primarieRete: [primaria('1', 2000, '2026-09-10T08:00:00.000Z')], tariffeAll: racc, fornitoriAll: fornitori }), 2026, 8, 'Settembre', 'RETE');
  const proposta = modelloDaPassiva(pr, 'RETE', 2026).find(v => /NAPPI/.test(v.soggetto)) || {};
  verifica('la voce proposta: 0,058 €/kg diventa 58 €/t (prima 0,058 «a tonnellata»)', proposta.prezzo === 58 && proposta.unita_misura === 'euro_tonnellata', JSON.stringify(proposta));
}

console.log('7. IL FOGLIO LEGGE TUTTO, CON LA REGOLA DEL CALCOLO');
{
  const src = readFileSync(new URL('../src/components/fatturazione/PassivaModulo.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('le voci con fetchAllClient, non 1000 righe', /fetchAllClient\(base44\.entities\.VocePassivaAmministrazione, \{ anno: periodo\.anno \}/.test(src) && !/VocePassivaAmministrazione\.filter\([^)]*1000\)/.test(src));
  verifica('le tariffe passive come le legge calcolaPassiva, senza lo stato e senza tetto', /fetchAllClient\(base44\.entities\.Tariffa, \{ direzione: 'PASSIVA' \}/.test(src) && !/stato: 'attivo' \}, '-created_date', 2000/.test(src));
  verifica('gli interventi tutti, non 5000', /fetchAllClient\(base44\.entities\.ExtraRaccolta, null/.test(src) && !/ExtraRaccolta\.list\('-created_date', 5000\)/.test(src));
  verifica('e un errore di lettura non diventa un elenco vuoto', !/VocePassivaAmministrazione[^\n]*\.catch\(\(\) => \[\]\)/.test(src) && !/Tariffa[^\n]*\.catch\(\(\) => \[\]\)/.test(src));
}

console.log('8. GLI SPECCHI DELLE PAGINE');
{
  const corpo = (p) => {
    const righe = readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n').split('\n');
    let i = 0;
    while (i < righe.length && (righe[i].startsWith('//') || righe[i].trim() === '')) i++;
    return righe.slice(i).filter(r => !/^import .* from /.test(r)).join('\n').trim();
  };
  verifica('validitaTariffa: la regola delle pagine e\' quella delle funzioni', corpo('base44/shared/validitaTariffa.ts') === corpo('src/lib/validitaTariffa.js'));
  verifica('ecotyreTariffe: idem', corpo('base44/shared/ecotyreTariffe.ts') === corpo('src/lib/ecotyreTariffe.js'));
  verifica('conflittiTariffa: idem', corpo('base44/shared/conflittiTariffa.ts') === corpo('src/lib/conflittiTariffa.js'));
}

console.log("9. L'ELENCO DELLE TARIFFE SEGNA DOPPIE QUELLE CHE IL SERVER RIFIUTA");
{
  const { chiaveMatch, periodiSovrapposti } = await import('../src/lib/conflittiTariffa.js');
  const a = { direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'TRATTAMENTO', fornitore_id: 'idA', fornitore_nome: 'GATIM', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' };
  const b = { ...a, fornitore_id: 'idB', fornitore_nome: 'GATIM S.R.L.', direzione: undefined };
  verifica('«GATIM» e «GATIM S.R.L.» sono la stessa chiave anche per la pagina, e la direzione vuota e\' passiva', chiaveMatch(a, b) && periodiSovrapposti(a.data_inizio_validita, a.data_fine_validita, b.data_inizio_validita, b.data_fine_validita));
  verifica('un altro fornitore no', !chiaveMatch(a, { ...a, fornitore_id: 'idC', fornitore_nome: 'ALFA SRL' }));
  const elenco = readFileSync(new URL('../src/components/fatturazione/TariffeUnificate.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('TariffeUnificate usa la chiave del server, non fornitore_id', /from '@\/lib\/conflittiTariffa'/.test(elenco) && /chiaveMatch\(a, b\)/.test(elenco) && !/\['fornitore_id', 'direzione'/.test(elenco));
  const storico = readFileSync(new URL('../src/components/fatturazione/TariffeStorico.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('e lo storico di una tariffa anche', /chiaveMatch\(a, b\)/.test(storico) && !/'fornitore_id', 'direzione'/.test(storico));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
