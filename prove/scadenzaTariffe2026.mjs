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
import { prezzoAttivoExtra } from '../base44/shared/attivaCalcolo.ts';

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

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
