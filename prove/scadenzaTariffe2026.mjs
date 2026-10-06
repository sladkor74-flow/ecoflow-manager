// LE TARIFFE DEL 2026 FINISCONO CON IL 2026, L'EXTRA RACCOLTA NO.
//
// Regola dell'utente del 06/10/2026: il contratto con Ecotyre, come quelli con
// i fornitori, e' annuale e SENZA TACITO RINNOVO - va riproposto ogni anno, e
// non e' detto che gli attori della commessa siano sempre gli stessi. Percio'
// ogni tariffa di rete e di ACI, attiva o passiva, si chiude al 31/12/2026: al
// primo movimento del 2027 il gestionale non deve continuare a fatturare (o a
// pagare) i prezzi del 2026 senza dire niente.
//
// L'extra raccolta fa eccezione e resta aperta: sono prestazioni occasionali,
// una tantum, sui Comuni che le chiedono dentro campagne che si rinnovano ogni
// anno (Puliamo il Mondo, PFU Zero, Mare Vivo...), e il prezzo si concorda
// intervento per intervento.
//
// Quello che qui si difende davvero e' il confine: una tariffa chiusa il
// 31/12/2026 deve valere per TUTTO il 31 dicembre, ora italiana compresa,
// altrimenti chiudendole si perderebbe l'ultimo giorno dell'anno. npm run prove
import { readFileSync } from 'node:fs';
import { sortTariffe, findTariffa, resolveTariffa } from '../base44/shared/ecotyreTariffe.ts';
import { prezzoAttivoExtra, calcolaRigheAttiva } from '../base44/shared/attivaCalcolo.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const semeAttive = sorgente('base44/functions/seedTariffeAttive2026/entry.ts');
const semePassive = sorgente('base44/functions/seedTariffe2026/entry.ts');

console.log('I SEMI SCRIVONO LA SCADENZA');
verifica('il seme delle attive ha la scadenza al 31/12/2026',
  /const DATA_FINE = '2026-12-31'/.test(semeAttive));
verifica('ma non la scrive sulle tipologie senza scadenza',
  /if \(!TIPOLOGIE_SENZA_SCADENZA\.includes\(t\.tipologia\)\) data\.data_fine_validita = DATA_FINE;/.test(semeAttive));
verifica('e l\'extra raccolta e\' fra quelle',
  /const TIPOLOGIE_SENZA_SCADENZA = \['EXTRA_RACCOLTA'\]/.test(semeAttive));
verifica('il seme delle passive ha la stessa scadenza',
  /const DATA_FINE = '2026-12-31'/.test(semePassive));
verifica('e la scrive su ogni tariffa che crea',
  /data_fine_validita: DATA_FINE,/.test(semePassive));

// Le tariffe come restano dopo la chiusura del 06/10/2026.
const tariffe = sortTariffe([
  { id: 'rete', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' },
  { id: 'aci-campania', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Campania', valore: 240, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' },
  { id: 'extra', direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' },
]);

console.log('IL 31 DICEMBRE E\' ANCORA DEL 2026');
const ultimoGiorno = findTariffa(tariffe, 'RETE', 'ECOTYRE', '', '', '', '2026-12-31T00:00:00.000Z', undefined);
verifica('un movimento del 31/12/2026 trova ancora i 202 euro della rete',
  ultimoGiorno?.id === 'rete', JSON.stringify(ultimoGiorno?.id));
// 31/12/2026 alle 23:30 italiane sono le 22:30 del 31 in UTC: stesso giorno.
const seraUltimoGiorno = findTariffa(tariffe, 'RETE', 'ECOTYRE', '', '', '', '2026-12-31T22:30:00.000Z', undefined);
verifica('e la trova anche un trasporto finito alle 23:30 di sera',
  seraUltimoGiorno?.id === 'rete', JSON.stringify(seraUltimoGiorno?.id));
const aciUltimoGiorno = findTariffa(tariffe, 'ACI', 'ECOTYRE', '', 'Campania', '', '2026-12-31T12:00:00.000Z', undefined);
verifica('lo stesso vale per l\'ACI della Campania',
  aciUltimoGiorno?.id === 'aci-campania', JSON.stringify(aciUltimoGiorno?.id));

console.log('IL 1 GENNAIO 2027 NON HA PIU\' PREZZO');
const capodanno = findTariffa(tariffe, 'RETE', 'ECOTYRE', '', '', '', '2027-01-01T10:00:00.000Z', undefined);
verifica('la rete del 2027 non prende il prezzo del 2026',
  capodanno === null, JSON.stringify(capodanno?.id));
verifica('e nemmeno passando da resolveTariffa, che non ha ripieghi',
  resolveTariffa(tariffe, 'RETE', '', '', '', '2027-01-05T10:00:00.000Z', 'TRASP_TRATT') === null);
verifica('l\'ACI della Campania del 2027 nemmeno',
  findTariffa(tariffe, 'ACI', 'ECOTYRE', '', 'Campania', '', '2027-01-02T10:00:00.000Z', undefined) === null);
// Una tariffa gia' scaduta prima non deve tornare buona: il confine vale da
// tutt'e due le parti.
const vecchia = sortTariffe([{ id: 'vecchia', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 190, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2025-01-01', data_fine_validita: '2025-12-31' }]);
verifica('e una tariffa chiusa a fine 2025 non vale il 1 gennaio 2026',
  findTariffa(vecchia, 'RETE', 'ECOTYRE', '', '', '', '2026-01-01T10:00:00.000Z', undefined) === null);
verifica('ma vale il 31 dicembre 2025',
  findTariffa(vecchia, 'RETE', 'ECOTYRE', '', '', '', '2025-12-31T10:00:00.000Z', undefined)?.id === 'vecchia');

console.log('L\'EXTRA RACCOLTA RESTA APERTA, PER SCELTA');
const interventoSenzaPrezzo = { trasporto_finito_il: '2027-03-10T10:00:00.000Z', classe: '', regione: '', cer: '160103', prezzo_attivo_t: 0 };
const prezzo2027 = prezzoAttivoExtra(interventoSenzaPrezzo, tariffe, '', 2027);
verifica('un intervento del 2027 senza prezzo scritto trova ancora la base in tabella',
  prezzo2027.origine === 'tabella' && prezzo2027.valore === 202, JSON.stringify([prezzo2027.origine, prezzo2027.valore]));
const interventoConPrezzo = { ...interventoSenzaPrezzo, prezzo_attivo_t: 260 };
verifica('e il prezzo concordato sull\'intervento vince comunque',
  prezzoAttivoExtra(interventoConPrezzo, tariffe, '', 2027).origine === 'intervento');

console.log('MA DICE DI CHE ANNO E\' IL PREZZO CHE APPLICA');
verifica('la riga sa che la tariffa e\' del 2026 e l\'intervento del 2027',
  prezzo2027.anno_tariffa === 2026 && prezzo2027.altro_anno === true, JSON.stringify([prezzo2027.anno_tariffa, prezzo2027.altro_anno]));
verifica('e la nota lo scrive, col periodo di validita\'',
  /e' il prezzo del 2026, non del 2027/.test(prezzo2027.nota) && /valida dal 01\/01\/2026, senza scadenza/.test(prezzo2027.nota), prezzo2027.nota);
const prezzo2026 = prezzoAttivoExtra({ ...interventoSenzaPrezzo, trasporto_finito_il: '2026-05-10T10:00:00.000Z' }, tariffe, '', 2026);
verifica('mentre nel 2026 non c\'e' + ' niente da segnalare',
  prezzo2026.altro_anno === false && !/ATTENZIONE/.test(prezzo2026.nota), prezzo2026.nota);

// La stessa cosa come la vede chi guarda il riepilogo Ecotyre: un'anomalia.
const grezze = [
  { id: 'extra', direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' },
];
const intervento = (id, giorno) => ({ stato: 'terminato', cer: '160103', id, id_ordine: id, numero_fir: 'F' + id, classe: 'A', peso_effettivo: 500, trasporto_finito_il: giorno, prezzo_attivo_t: 0 });
const marzo2027 = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: [intervento('EY1', '2027-03-02T10:00:00.000Z')], fornitori: [], tariffe: grezze, anno: 2027, mese: 'Marzo' });
const riga27 = marzo2027.righe.EXTRA_RACCOLTA[0];
verifica('nel 2027 l\'intervento senza prezzo esce comunque a 202 €/t: la tariffa e\' aperta per scelta',
  riga27?.tariffa_valore === 202 && riga27?.totale === 101, JSON.stringify(riga27 && [riga27.tariffa_valore, riga27.totale]));
verifica('ma il riepilogo porta l\'anomalia "prezzo di un altro anno"',
  marzo2027.anomalie.some(a => a.tipo === 'prezzo_altro_anno' && /2026/.test(a.descrizione) && /2027/.test(a.descrizione)),
  JSON.stringify(marzo2027.anomalie));
const maggio2026 = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: [intervento('EX9', '2026-05-10T10:00:00.000Z')], fornitori: [], tariffe: grezze, anno: 2026, mese: 'Maggio' });
verifica('nel 2026, con la tariffa del 2026, nessuna anomalia',
  !maggio2026.anomalie.some(a => a.tipo === 'prezzo_altro_anno'), JSON.stringify(maggio2026.anomalie));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
