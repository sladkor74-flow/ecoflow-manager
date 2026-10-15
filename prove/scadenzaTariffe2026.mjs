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

// LE TARIFFE COPIATE DAL 2026 E MAI CONFERMATE (prova generale del cambio
// d'anno, 15/10/2026, difetto 15). Il 28/12/2026 «Prepara le tariffe» copia nel
// 2027 le tariffe del 2026 col prezzo dell'anno prima e la nota «copiato dal
// 2026, da confermare». Nessuno le conferma, e il 10/02/2027 gennaio si
// elaborava a 202 €/t con le righe «verificato», la nota vuota, nessuna anomalia,
// e la verifica dei documenti diceva «verificata, errori 0»; la passiva pagava
// Gatim a 70 €/t senza una parola. D4, decisione dell'utente del 15/10/2026: una
// riga cosi' ferma il documento come una riga senza prezzo, e la conferma e' in
// Target & Status › Nuovo anno. Qui le funzioni vere (elaboraFatturazioneAttiva,
// cambiaStatoFatturazione) sul banco, e il calcolo della passiva.
console.log('LE TARIFFE COPIATE DAL 2026 E MAI CONFERMATE NON FATTURANO NE\' PAGANO GENNAIO IN SILENZIO');
{
  const { copiaTariffa, confermaTariffa } = await import('../base44/shared/inizializzazioneAnno.ts');
  const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
  const { calcolaPassivaMese } = await import('../base44/shared/passivaCalcolo.ts');
  const t26 = (p) => ({ unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', ...p });
  const T26 = [
    t26({ id: 'r26', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202 }),
    t26({ id: 'a26', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Calabria', valore: 230 }),
    t26({ id: 'e26', direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 202 }),
    t26({ id: 'g26', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_id: 'fG', fornitore_nome: 'GATIM S.R.L.', valore: 70 }),
    t26({ id: 'i26', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'TRATTAMENTO', fornitore_id: 'fG', fornitore_nome: 'GATIM S.R.L.', valore: 105 }),
  ];
  const COPIE = T26.map(t => ({ ...copiaTariffa(t, 2027), id: t.id.replace('26', '27') }));
  const CONFERMATE = COPIE.map(t => ({ ...t, ...confermaTariffa(t, { il: '2027-01-05', da: 'amministratore', anno: 2027 }) }));
  const FORNITORI = [{ id: 'fG', ragione_sociale: 'GATIM S.R.L.', stato: 'attivo', ruolo_raccolta: true, ruolo_trattamento: true }];
  const mov = (id, kg, p = {}) => ({
    id, stato: 'terminato', id_ordine: id, numero_fir: 'F' + id, trasportatore: 'GATIM S.R.L.', destinazione: 'GATIM S.R.L.', tipo_destinazione: 'imp',
    classe: 'P', cer: '160103', peso_effettivo: kg, provincia: 'VV', regione: 'Calabria', automezzo: 'AB' + id,
    ordine_immesso_il: '2027-01-08T08:00:00.000Z', trasporto_iniziato_il: '2027-01-12T08:00:00.000Z', trasporto_finito_il: '2027-01-12T10:00:00.000Z', ...p,
  });
  const RETE = [mov('ET27900004', 4000), mov('ET27900005', 2000)];
  const ACI = [mov('ET27800008', 1600, { numero_ordine_interno: '170001-01' })];
  const EXTRA = [mov('EXTRA11', 600, { prezzo_attivo_t: 0 }), mov('EXTRA12', 700, { prezzo_attivo_t: 210 })];
  const db = (tariffe) => ({ PrimariaRete: RETE, PrimariaAci: ACI, ExtraRaccolta: EXTRA, Fornitore: FORNITORI, Tariffa: tariffe, SurplusTariffa: [], DocumentoFatturazione: [], VoceFatturazione: [] });
  const elab = await caricaFunzione('elaboraFatturazioneAttiva');
  const stato = await caricaFunzione('cambiaStatoFatturazione');
  const docDi = (E, c) => (E.db.DocumentoFatturazione || []).find(d => d.tipologia === c) || {};
  const vociDi = (E, c) => (E.db.VoceFatturazione || []).filter(v => v.documento_id === docDi(E, c).id);
  const NOTA = /^prezzo copiato dal 2026 con «Prepara le tariffe», da confermare in Target & Status › Nuovo anno$/;

  const E = await chiama(elab, { db: db([...T26, ...COPIE]), corpo: { anno: 2027, mese: 'Gennaio' } });
  const rete = vociDi(E, 'RETE');
  verifica('gennaio 2027 si elabora col prezzo copiato: 6 t a 202 €/t, 1.212,00 €', E.stato === 200 && docDi(E, 'RETE').totale === 1212, JSON.stringify({ s: E.stato, t: docDi(E, 'RETE').totale, e: E.j.error }));
  verifica('ma ogni riga lo dice: «da_controllare» e la nota con l\'anno della copia e dove si conferma', rete.length === 2 && rete.every(v => v.stato_validazione === 'da_controllare' && NOTA.test(v.note)), JSON.stringify(rete.map(v => [v.stato_validazione, v.note])));
  const extra11 = vociDi(E, 'EXTRA_RACCOLTA').find(v => v.ordine === 'EXTRA11') || {};
  const extra12 = vociDi(E, 'EXTRA_RACCOLTA').find(v => v.ordine === 'EXTRA12') || {};
  verifica('la riga dell\'extra raccolta non presenta il 202 come «Tariffa base Ecotyre 2027»', /^Tariffa copiata dal 2026, da confermare: 202 €\/t/.test(extra11.note || '') && !/Tariffa base Ecotyre 2027/.test(extra11.note || '') && extra11.stato_validazione === 'da_controllare', JSON.stringify(extra11));
  verifica('e quella col prezzo scritto sull\'intervento resta «verificato»', extra12.stato_validazione === 'verificato' && extra12.tariffa_valore === 210, JSON.stringify(extra12));

  const vRete = await chiama(stato, { db: E.db, corpo: { documento_id: docDi(E, 'RETE').id, azione: 'verifica' } });
  verifica('la verifica del documento di rete si ferma (400) e il documento resta «elaborata»', vRete.stato === 400 && (vRete.db.DocumentoFatturazione.find(d => d.tipologia === 'RETE') || {}).stato === 'elaborata', JSON.stringify({ s: vRete.stato, j: vRete.j }));
  verifica('e dice quali tariffe e come confermarle', /2 righe sono prezzate con la tariffa a 202 €\/t, copiata dal 2026 con «Prepara le tariffe» e non ancora confermata/.test(vRete.j.error || '')
    && /sul contratto 2027 in Target & Status › Nuovo anno, poi rielabora il mese/.test(vRete.j.error || '') && vRete.j.da_confermare === 2, vRete.j.error);
  const vAci = await chiama(stato, { db: E.db, corpo: { documento_id: docDi(E, 'ACI').id, azione: 'verifica' } });
  verifica('l\'ACI anche, con la regione del prezzo', vAci.stato === 400 && /230 €\/t \(Calabria\)/.test(vAci.j.error || ''), JSON.stringify(vAci.j));
  const vExtra = await chiama(stato, { db: E.db, corpo: { documento_id: docDi(E, 'EXTRA_RACCOLTA').id, azione: 'verifica' } });
  verifica('e l\'extra raccolta per la sua riga senza prezzo scritto', vExtra.stato === 400 && /una riga è prezzata con la tariffa a 202 €\/t/.test(vExtra.j.error || ''), JSON.stringify(vExtra.j));

  // Il riepilogo e il calcolo: l'anomalia per canale, con tipologia, tonnellate e prezzo.
  const { calcolaRigheAttiva } = await import('../base44/shared/attivaCalcolo.ts');
  const calc = calcolaRigheAttiva({ reteAll: RETE, aciAll: ACI, extraAll: EXTRA, fornitori: FORNITORI, tariffe: [...T26, ...COPIE], anno: 2027, mese: 'Gennaio' });
  const an = (c) => calc.anomalie.find(a => a.tipo === 'tariffa_da_confermare' && a.tipologia === c);
  verifica('un\'anomalia «tariffa_da_confermare» per canale: rete 6 t a 202, ACI 1,6 t a 230, extra 0,6 t a 202', an('RETE') && an('RETE').tonnellate === 6 && an('RETE').prezzo === 202 && an('RETE').gravita === 'errore'
    && an('ACI') && an('ACI').tonnellate === 1.6 && an('ACI').prezzo === 230 && an('EXTRA_RACCOLTA') && an('EXTRA_RACCOLTA').tonnellate === 0.6 && an('EXTRA_RACCOLTA').prezzo === 202
    && calc.anomalie.filter(a => a.tipo === 'tariffa_da_confermare').length === 3, JSON.stringify(calc.anomalie));

  // La passiva: la riga dice da dove viene il prezzo, e il fornitore ha la sua anomalia.
  const pas = (tariffe) => calcolaPassivaMese({ primarieRete: RETE, primarieAci: [], secondarieAll: [], extraRaccoltaAll: [], tariffeAll: tariffe, fornitoriAll: FORNITORI }, 2027, 0, 'Gennaio', 'RETE');
  const P = pas([...T26, ...COPIE]);
  const rigaG = ((P.raccoglitori.find(f => /GATIM/.test(f.fornitore)) || {}).righe || [])[0] || {};
  verifica('la passiva paga Gatim col prezzo copiato, 70 €/t su 6 t, e la riga lo dice', rigaG.importo === 420 && NOTA.test(rigaG.note || '') && rigaG.nota_informativa === false && rigaG.tariffa_da_confermare === true, JSON.stringify(rigaG));
  const anP = P.anomalie.filter(a => a.tipo === 'tariffa_da_confermare');
  verifica('e due anomalie «tariffa_da_confermare»: la raccolta a 70 e il trattamento a 105, con tipologia, tonnellate e prezzo', anP.length === 2
    && anP.some(a => a.prestazione === 'RACCOLTA' && a.prezzo === 70 && a.tonnellate === 6 && a.tipologia === 'RETE' && /GATIM S\.R\.L\.: la tariffa di raccolta a 70 €\/t e' copiata dal 2026/.test(a.descrizione))
    && anP.some(a => a.prestazione === 'TRATTAMENTO' && a.prezzo === 105 && a.tonnellate === 6), JSON.stringify(anP));

  // La controprova: le tariffe confermate in Target & Status › Nuovo anno, il mese rielaborato.
  const E2 = await chiama(elab, { db: db([...T26, ...CONFERMATE]), corpo: { anno: 2027, mese: 'Gennaio' } });
  verifica('controprova: confermate, le righe sono «verificato» senza la nota', vociDi(E2, 'RETE').every(v => v.stato_validazione === 'verificato' && !v.note) && vociDi(E2, 'RETE').length === 2, JSON.stringify(vociDi(E2, 'RETE').map(v => [v.stato_validazione, v.note])));
  const v2 = await chiama(stato, { db: E2.db, corpo: { documento_id: docDi(E2, 'RETE').id, azione: 'verifica' } });
  verifica('e la verifica passa: «verificata», errori 0', v2.stato === 200 && v2.j.stato === 'verificata' && v2.j.errori === 0, JSON.stringify(v2.j));
  const calc2 = calcolaRigheAttiva({ reteAll: RETE, aciAll: ACI, extraAll: EXTRA, fornitori: FORNITORI, tariffe: [...T26, ...CONFERMATE], anno: 2027, mese: 'Gennaio' });
  verifica('e nessuna anomalia «tariffa_da_confermare»', !calc2.anomalie.some(a => a.tipo === 'tariffa_da_confermare'), JSON.stringify(calc2.anomalie));
  const P2 = pas([...T26, ...CONFERMATE]);
  const rigaG2 = ((P2.raccoglitori.find(f => /GATIM/.test(f.fornitore)) || {}).righe || [])[0] || {};
  verifica('nella passiva confermata la riga torna com\'era, senza nota ne\' anomalia', !rigaG2.note && !rigaG2.tariffa_da_confermare && !P2.anomalie.some(a => a.tipo === 'tariffa_da_confermare'), JSON.stringify({ r: rigaG2, a: P2.anomalie }));
  // Con la tariffa dell'extra raccolta del 2026 rimasta aperta resta il suo avviso.
  const aperta = [T26[0], T26[1], { ...T26[2], data_fine_validita: null }];
  const calc3 = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: EXTRA, fornitori: FORNITORI, tariffe: aperta, anno: 2027, mese: 'Gennaio' });
  verifica('con la tariffa 2026 dell\'extra raccolta rimasta aperta resta «prezzo_altro_anno», non «da confermare»', calc3.anomalie.some(a => a.tipo === 'prezzo_altro_anno') && !calc3.anomalie.some(a => a.tipo === 'tariffa_da_confermare'), JSON.stringify(calc3.anomalie));

  // UN PREZZO COPIATO E POI CORRETTO A MANO NON E' PIU' «COPIATO» (revisione del
  // 15/10/2026). Lo script del revisore: a gennaio arriva il contratto e
  // l'amministratore porta la rete attiva 2027 da 202 a 205 €/t con «Modifica»
  // in Tariffe & Anagrafiche. Il modulo rimanda la nota com'era («copiato dal
  // 2026, da confermare»), la tariffa restava da confermare, le righe a 205 €/t
  // dicevano «prezzo copiato dal 2026» e la verifica si fermava su «la tariffa a
  // 205 €/t, copiata dal 2026»: il prezzo del contratto 2027 detto copiato.
  console.log('UN PREZZO COPIATO E CORRETTO A MANO NON SI DICE PIU\' COPIATO');
  const anag = await caricaFunzione('gestisciAnagrafiche');
  const r27 = COPIE.find(t => t.id === 'r27');
  // quello che manda TariffeForm per una tariffa non archiviata
  const dalModulo = (valore) => ({ entita: 'Tariffa', operazione: 'update', id: 'r27', motivo: 'prezzo del contratto 2027', dati: {
    valore, unita_misura: r27.unita_misura, note: r27.note, data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31', tipologia: 'RETE',
    classe_materiale: null, regione: null, eer_codice: null, servizio_ecotyre: null } });
  const G = await chiama(anag, { db: db([...T26, ...COPIE]), corpo: dalModulo(205) });
  const r27dopo = G.db.Tariffa.find(t => t.id === 'r27') || {};
  verifica('la modifica del prezzo a 205 €/t si salva e la nota della copia se ne va', G.stato === 200 && r27dopo.valore === 205 && !/copiato dal 2026, da confermare/.test(r27dopo.note || '')
    && /^Prezzo scritto a mano sul contratto 2027 il \d{2}\/\d{2}\/\d{4} da .+: non è più quello copiato\.$/.test(r27dopo.note || ''), JSON.stringify({ s: G.stato, j: G.j, t: r27dopo }));
  verifica('chi salva lo legge negli avvisi', (G.j.avvisi || []).some(a => /col prezzo scritto a mano vale come confermata/.test(a)), JSON.stringify(G.j.avvisi));
  const E4 = await chiama(elab, { db: { ...db(G.db.Tariffa) }, corpo: { anno: 2027, mese: 'Gennaio' } });
  verifica('gennaio si elabora a 205 €/t con le righe «verificato» e senza la nota della copia', vociDi(E4, 'RETE').length === 2 && vociDi(E4, 'RETE').every(v => v.tariffa_valore === 205 && v.stato_validazione === 'verificato' && !/copiato/.test(v.note || '')),
    JSON.stringify(vociDi(E4, 'RETE').map(v => [v.tariffa_valore, v.stato_validazione, v.note])));
  const v4 = await chiama(stato, { db: E4.db, corpo: { documento_id: docDi(E4, 'RETE').id, azione: 'verifica' } });
  verifica('e la verifica di rete passa, senza dire «205 €/t, copiata dal 2026»', v4.stato === 200 && v4.j.stato === 'verificata' && !/copiata dal 2026/.test(JSON.stringify(v4.j)), JSON.stringify(v4.j));
  // Le altre copie, non toccate, restano da confermare: l'ACI ferma il suo documento.
  const vAci4 = await chiama(stato, { db: E4.db, corpo: { documento_id: docDi(E4, 'ACI').id, azione: 'verifica' } });
  verifica('l\'ACI copiata e non toccata resta da confermare', vAci4.stato === 400 && /230 €\/t \(Calabria\)/.test(vAci4.j.error || ''), JSON.stringify(vAci4.j));
  // La controprova: salvare la copia col suo prezzo (si cambiano solo le date o le note) non conferma niente.
  const G2 = await chiama(anag, { db: db([...T26, ...COPIE]), corpo: dalModulo(202) });
  const r27stesso = G2.db.Tariffa.find(t => t.id === 'r27') || {};
  verifica('controprova: risalvata a 202 €/t la tariffa resta «copiato dal 2026, da confermare»', G2.stato === 200 && r27stesso.note === 'copiato dal 2026, da confermare' && !(G2.j.avvisi || []).some(a => /vale come confermata/.test(a)), JSON.stringify({ s: G2.stato, t: r27stesso, a: G2.j.avvisi }));
  const E5 = await chiama(elab, { db: { ...db(G2.db.Tariffa) }, corpo: { anno: 2027, mese: 'Gennaio' } });
  const v5 = await chiama(stato, { db: E5.db, corpo: { documento_id: docDi(E5, 'RETE').id, azione: 'verifica' } });
  verifica('e la verifica di rete resta ferma', v5.stato === 400 && /tariffa a 202 €\/t, copiata dal 2026/.test(v5.j.error || ''), JSON.stringify(v5.j));

  // UNA TARIFFA NUOVA FATTA CON «DUPLICA» DA UNA COPIATA NON E' UNA COPIA
  // (revisione del 15/10/2026, lo script del revisore r11_duplicaCopiata). Il
  // 20/01/2027 arriva il contratto ACI con una regione nuova: «Duplica» sulla ACI
  // Calabria copiata (230 €/t) e Lazio a 245 €/t. Il modulo, duplicando, tiene
  // le note dell'originale: la tariffa nasceva «copiato dal 2026, da confermare»
  // e la verifica di gennaio diceva «245 €/t (Lazio), copiate dal 2026».
  console.log('UNA TARIFFA SCRITTA A MANO CON «DUPLICA» DA UNA COPIATA NON SI DICE COPIATA');
  const a27 = COPIE.find(t => t.id === 'a27');
  // quello che manda TariffeForm duplicando un'attiva (buildBase: note del modulo)
  const duplicata = (p = {}) => ({ entita: 'Tariffa', operazione: 'create', motivo: 'contratto ACI 2027: regione nuova', dati: {
    cliente: a27.cliente, direzione: 'ATTIVA', tipologia: 'ACI', unita_misura: a27.unita_misura, regione: 'Lazio',
    data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31', stato: 'attivo', note: a27.note, valore: 245, ...p } });
  const D = await chiama(anag, { db: db([...T26, ...COPIE]), corpo: duplicata() });
  const lazio = (D.db.Tariffa || []).find(t => t.regione === 'Lazio') || {};
  verifica('il Lazio a 245 €/t si salva senza la nota della copia, con chi l\'ha scritto e quando', D.stato === 200 && lazio.valore === 245 && !/copiato dal 2026, da confermare/.test(lazio.note || '')
    && /^Scritta a mano sul contratto 2027 il \d{2}\/\d{2}\/\d{4} da .+: non è una copia dell'anno prima\.$/.test(lazio.note || ''), JSON.stringify({ s: D.stato, j: D.j, t: lazio }));
  verifica('e chi salva lo legge negli avvisi', (D.j.avvisi || []).some(a => /non vale per una tariffa scritta a mano/.test(a)), JSON.stringify(D.j.avvisi));
  // gennaio con un ritiro ACI nel Lazio: la riga a 245 €/t non dice «copiato»; la Calabria copiata si'
  const ACI_LAZIO = [...ACI, mov('ET27800009', 2000, { numero_ordine_interno: '170001-02', provincia: 'RM', regione: 'Lazio' })];
  const E6 = await chiama(elab, { db: { ...db(D.db.Tariffa), PrimariaAci: ACI_LAZIO }, corpo: { anno: 2027, mese: 'Gennaio' } });
  const rigaLazio = vociDi(E6, 'ACI').find(v => v.regione === 'Lazio') || {};
  const rigaCalabria = vociDi(E6, 'ACI').find(v => v.regione === 'Calabria') || {};
  verifica('la riga del Lazio a 245 €/t e\' «verificato», senza «prezzo copiato dal 2026»', rigaLazio.tariffa_valore === 245 && rigaLazio.stato_validazione === 'verificato' && !/copiato/.test(rigaLazio.note || ''), JSON.stringify(rigaLazio));
  verifica('la Calabria copiata e non confermata resta «da_controllare»', rigaCalabria.tariffa_valore === 230 && rigaCalabria.stato_validazione === 'da_controllare' && NOTA.test(rigaCalabria.note || ''), JSON.stringify(rigaCalabria));
  const vAci6 = await chiama(stato, { db: E6.db, corpo: { documento_id: docDi(E6, 'ACI').id, azione: 'verifica' } });
  verifica('e la verifica ACI si ferma per la sola Calabria, senza nominare il Lazio', vAci6.stato === 400 && /230 €\/t \(Calabria\)/.test(vAci6.j.error || '') && !/Lazio|245/.test(vAci6.j.error || ''), JSON.stringify(vAci6.j));
  // La controprova: una tariffa nuova senza la nota della copia si salva con le sue note, intatte.
  const D2 = await chiama(anag, { db: db([...T26, ...COPIE]), corpo: duplicata({ note: 'contratto ACI 2027, art. 4' }) });
  const lazio2 = (D2.db.Tariffa || []).find(t => t.regione === 'Lazio') || {};
  verifica('controprova: senza la nota della copia le note restano quelle scritte, senza avvisi', D2.stato === 200 && lazio2.note === 'contratto ACI 2027, art. 4' && !(D2.j.avvisi || []).some(a => /scritta a mano/.test(a)), JSON.stringify({ t: lazio2, a: D2.j.avvisi }));
  // e le altre note dell'originale restano, tolta solo la copia
  const D3 = await chiama(anag, { db: db([...T26, ...COPIE]), corpo: duplicata({ note: 'copiato dal 2026, da confermare · listino Ecotyre' }) });
  const lazio3 = (D3.db.Tariffa || []).find(t => t.regione === 'Lazio') || {};
  verifica('e se l\'originale aveva altre note, restano: si toglie solo la copia', D3.stato === 200 && /^listino Ecotyre · Scritta a mano sul contratto 2027/.test(lazio3.note || ''), JSON.stringify(lazio3));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
