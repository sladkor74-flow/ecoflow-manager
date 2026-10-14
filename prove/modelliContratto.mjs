// Prova del POSTO DEI MODELLI DEI CONTRATTI (src/lib/modelliContratto.js e
// src/lib/segnapostiContratto.js, giro K3 delle segnalazioni del 20/09,
// 12/10/2026).
//
// Richiesta dell'utente dell'11/10/2026: «crea un posto dove caricarti i vari
// format affinche' tu possa compilarli seguendo quello schema ed inserendo solo
// le cose che variano ovvero i dati del fornitore, le quantita' annue, il prezzo
// concordato, le date di validita', ecc...». Il gestionale legge il format,
// propone i punti che cambiano, li fa diventare segnaposto, e il contratto di un
// altro fornitore differisce dall'originale SOLO in quei punti.
//
// Due parti: un format finto costruito qui (con le insidie: un nome spezzato fra
// due pezzi con formattazione diversa, una revisione aperta, una penale in euro
// che non e' un prezzo, la data di un altro atto, un segnaposto gia' scritto,
// un'intestazione), e i format veri della cartella dei contratti, se su questo
// computer ci sono (sola lettura).
// node prove/modelliContratto.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { leggiFormat, proponiPunti, costruisciModello, compilaContratto, testoDelDocumento, puntiDelModello, applicaPunti } from '../src/lib/modelliContratto.js';
import { leggiModello } from '../src/lib/docxModello.js';
import { leggiData, leggiNumeroItaliano, valoriPerIlDocumento } from '../src/lib/segnapostiContratto.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const comeFile = (u8) => ({ name: 'format.docx', arrayBuffer: async () => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) });
const blobInFile = async (blob) => comeFile(new Uint8Array(await blob.arrayBuffer()));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// L'ISCRIZIONE DI SMOCO ALL'ALBO (decisione dell'utente del 13/10/2026): in
// categoria 8 la data e' sempre il 16/05/2025, fino al rinnovo del 2030, e il
// lettore corregge quella del format nel modello e nel contratto. Regola della
// prova, scritta qui e non presa dal lettore: ogni pezzo di riga che comincia
// col numero BA-11513 e non parla della categoria 4 (l'altra iscrizione, Eco
// Faso) ha la data del 16/05/2025, con lo stesso separatore.
const alboGiusto = (t) => String(t).split(/(?=BA-?\s?11513)/).map(p => (/^BA-?\s?11513/.test(p) && !/categoria\s*4|cat\.?\s*4(?!\d)/i.test(p)
  ? p.replace(/^(BA-?\s?11513\s+del\s+)\d{1,2}([./])\d{1,2}\2\d{4}/, (_m, a, s) => `${a}16${s}05${s}2025`) : p)).join('');
const conAlboGiusto = (righe) => righe.map(alboGiusto);

/** Ogni riga diversa fra l'originale e il modello si spiega coi segnaposto: il resto e' identico. */
function soloNeiPunti(originale, conSegnaposto) {
  if (originale.length !== conSegnaposto.length) return { ok: false, motivo: `righe ${originale.length} contro ${conSegnaposto.length}` };
  for (let i = 0; i < originale.length; i++) {
    if (originale[i] === conSegnaposto[i]) continue;
    const re = new RegExp('^' + conSegnaposto[i].split(/\{\{[A-Z0-9_]+\}\}/).map(esc).join('(.+?)') + '$', 's');
    if (!re.test(originale[i])) return { ok: false, motivo: `riga ${i}: ${JSON.stringify(originale[i]).slice(0, 160)} / ${JSON.stringify(conSegnaposto[i]).slice(0, 160)}` };
  }
  return { ok: true };
}

// ─── il format finto ───

const R = (testo, stile = '') => `<w:r>${stile ? `<w:rPr>${stile}</w:rPr>` : ''}<w:t xml:space="preserve">${testo}</w:t></w:r>`;
const P = (...run) => `<w:p><w:pPr><w:jc w:val="both"/></w:pPr>${run.join('')}</w:p>`;
const B = '<w:b/>';
const documento = `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${[
  P(R('CONTRATTO DI RACCOLTA PFU PER L\'ANNO 2026', B)),
  P(R('TRA SMOCO Srl, con sede in Massafra (TA) (di seguito "SMOCO")')),
  // il nome spezzato: «GATIM» in grassetto, « S.R.L.» no
  P(R('E '), R('GATIM', B), R(' S.R.L., con sede legale in Via Roma 1, 88046 Lamezia Terme (CZ), Partita IVA 02015210798, iscritta al Registro delle Imprese di Catanzaro n. 123, rappresentata dall\'Amministratore Unico Sig. Azzarito Domenico (di seguito il "FORNITORE")')),
  P(R('Il presente contratto è valido dal 02 Gennaio 2026 e sino al 31 dicembre 2026.')),
  P(R('Il quantitativo previsto è pari a circa 300 ton/anno, nel rispetto del D.M. 182/2019 e del D.Lgs. 152/2006.')),
  // una revisione aperta: si accetta, «VECCHIO» sparisce e «nuovo» resta
  P(R('Il testo '), `<w:del w:id="1"><w:r><w:delText>VECCHIO </w:delText></w:r></w:del><w:ins w:id="2"><w:r><w:t xml:space="preserve">nuovo </w:t></w:r></w:ins>`, R('vale per le Parti.')),
  // l'Albo di SMOCO con l'anno cambiato come se fosse quello del contratto
  // (Green Tyre e Nappi Sud rete 2026): si corregge in 16/05/2025 (13/10/2026)
  P(R('Intermediario: SMOCO Srl - Iscrizione Albo cat.8 BA-11513 del 16/05/2026')),
  // la data di un altro atto: resta com'e'
  P(R('Autorizzazione unica dell\'impianto n. 45 del 16/05/2026.')),
  P(R('Le fatture saranno pagate entro sessanta giorni data fattura mediante bonifico bancario.')),
  P(R('Il FORNITORE stipula una polizza di responsabilità civile pari a 1.500.000,00 Euro (unmilionecinquecentomila Euro).')),
  P(R('Note: {{NOTE_AGGIUNTIVE}}')),
  P(R('Massafra, 02 Gennaio 2026')),
  P(R('GATIM S.R.L.')),
  P(R('Azzarito Domenico')),
  P(R('Amministratore Unico')),
  P(R('Allegato 1')),
  P(R('CORRISPETTIVI')),
  P(R('Raccolta PFU: 70,00 € a tonnellata')),
  P(R('Penale: 500,00 € per ogni giorno di ritardo')),
].join('')}</w:body></w:document>`;
const intestazione = `<?xml version="1.0"?><w:hdr xmlns:w="w">${P(R('Contratto di raccolta anno 2026 - GATIM S.R.L.'))}</w:hdr>`;
const zip = zipSync({ 'word/document.xml': strToU8(documento), 'word/header1.xml': strToU8(intestazione), '[Content_Types].xml': strToU8('<Types/>') });

console.log('IL FORMAT FINTO: LA PROPOSTA');
const letto = await leggiFormat(comeFile(zip));
verifica('la revisione aperta si accetta prima di leggere', letto.revisioni >= 2 && letto.revisioni_accettate === true && !testoDelDocumento(letto.parti).join('\n').includes('VECCHIO')
  && testoDelDocumento(letto.parti).some(r => r.includes('Il testo nuovo vale')), testoDelDocumento(letto.parti).join(' | ').slice(0, 300));
const proposta = proponiPunti(letto, { tipo: 'raccolta', fornitori: [{ id: 'f-gatim', ragione_sociale: 'GATIM SRL', piva: '02015210798' }] });
const P_ = (s) => proposta.punti.find(p => p.segnaposto === s);
const attive = (s) => (P_(s)?.occorrenze || []).filter(o => o.attiva).length;
verifica('riconosce il fornitore del contratto compilato, e lo trova in anagrafica', proposta.fornitore?.ragione_sociale === 'GATIM S.R.L.' && proposta.fornitore?.anagrafica?.id === 'f-gatim' && proposta.anno === 2026, JSON.stringify(proposta.fornitore));
verifica('la ragione sociale ovunque: dati, firma, intestazione (anche spezzata fra due pezzi)', P_('FORNITORE_RAGIONE_SOCIALE')?.originale === 'GATIM S.R.L.' && attive('FORNITORE_RAGIONE_SOCIALE') === 3
  && P_('FORNITORE_RAGIONE_SOCIALE').occorrenze.some(o => o.parte === 'word/header1.xml'), JSON.stringify(P_('FORNITORE_RAGIONE_SOCIALE')?.occorrenze?.map(o => o.contesto)));
verifica('partita IVA, sede, camera di commercio', P_('FORNITORE_PIVA')?.originale === '02015210798' && P_('FORNITORE_SEDE_LEGALE')?.originale === 'Via Roma 1, 88046 Lamezia Terme (CZ)' && P_('FORNITORE_CCIAA')?.originale === 'di Catanzaro',
  JSON.stringify([P_('FORNITORE_PIVA')?.originale, P_('FORNITORE_SEDE_LEGALE')?.originale, P_('FORNITORE_CCIAA')?.originale]));
verifica('il legale rappresentante e la sua carica, anche sotto la firma', P_('FORNITORE_RAPPRESENTANTE')?.originale === 'Azzarito Domenico' && attive('FORNITORE_RAPPRESENTANTE') === 2
  && P_('FORNITORE_QUALIFICA')?.originale === 'Amministratore Unico' && attive('FORNITORE_QUALIFICA') === 2, JSON.stringify([attive('FORNITORE_RAPPRESENTANTE'), attive('FORNITORE_QUALIFICA')]));
verifica('le date di validita\', col loro stile', P_('DATA_INIZIO')?.originale === '02 Gennaio 2026' && P_('DATA_INIZIO')?.stile?.maiuscola === true && P_('DATA_FINE')?.originale === '31 dicembre 2026' && P_('DATA_FINE')?.stile?.maiuscola === false,
  JSON.stringify([P_('DATA_INIZIO'), P_('DATA_FINE')].map(p => p && [p.originale, p.stile])));
verifica('la data della firma', P_('DATA_FIRMA')?.originale === '02 Gennaio 2026' && attive('DATA_FIRMA') === 1);
verifica('la quantita\' annua', P_('TARGET_TON')?.originale === '300' && attive('TARGET_TON') === 1);
verifica('il prezzo concordato, nell\'allegato dei corrispettivi', P_('CORRISPETTIVO_RACCOLTA')?.originale === '70,00' && attive('CORRISPETTIVO_RACCOLTA') === 1, JSON.stringify(P_('CORRISPETTIVO_RACCOLTA')));
verifica('la penale in euro non e\' un prezzo', !proposta.punti.some(p => p.occorrenze.some(o => o.testo === '500,00')));
verifica('pagamento, modalita\' e polizza', P_('PAGAMENTO')?.originale === 'sessanta giorni data fattura' && P_('MODALITA_PAGAMENTO')?.originale === 'bonifico bancario' && /^1\.500\.000,00 Euro/.test(P_('POLIZZA_RC')?.originale || ''));
const anni = P_('ANNO')?.occorrenze || [];
verifica('l\'anno del contratto si', anni.filter(o => o.attiva).length === 2, JSON.stringify(anni.map(o => [o.contesto, o.attiva, o.motivo])));
const diNorma = (o) => o.attiva && ['182/2019', '152/2006', '182', '152', '2019', '2006'].includes(o.testo);
verifica('la data di un altro atto («del 16/05/2026») e le norme no', anni.some(o => !o.attiva && /altro atto/.test(o.motivo)) && !proposta.punti.some(p => p.occorrenze.some(diNorma)),
  JSON.stringify([anni.map(o => [o.contesto, o.attiva, o.motivo]), proposta.punti.flatMap(p => p.occorrenze.filter(diNorma).map(o => p.segnaposto + ' ' + o.contesto))]));
verifica('il segnaposto gia\' scritto nel format si tiene', P_('NOTE_AGGIUNTIVE')?.gia_segnaposto === true);
// L'Albo di SMOCO (13/10/2026): la data «16/05/2026» non e' l'anno del contratto
// ne' un altro atto qualunque: si corregge, e la proposta lo dice.
const alboF = proposta.albo_smoco || [];
verifica('la data dell\'Albo di SMOCO e\' riconosciuta: categoria 8, da correggere in 16/05/2025', alboF.length === 1 && alboF[0].testo === '16/05/2026' && alboF[0].categoria === '8'
  && alboF[0].correggi === true && alboF[0].nuovo === '16/05/2025', JSON.stringify(alboF));
verifica('la proposta lo dice, con la scadenza del 15/05/2030', proposta.avvisi.some(a => /iscrizione di SMOCO all'Albo \(cat\. 8 BA-11513\) nel format è «16\/05\/2026»: quella in vigore è del 16\/05\/2025, valida fino al 15\/05\/2030/.test(a)),
  JSON.stringify(proposta.avvisi));
verifica('l\'anno nella data dell\'Albo di SMOCO non e\' mai un punto, nemmeno spento', !anni.some(o => /BA-11513/.test(o.contesto)) && !proposta.punti.some(p => p.occorrenze.some(o => /BA-11513 del «/.test(o.contesto))),
  JSON.stringify(anni.map(o => o.contesto)));

console.log('IL MODELLO');
const modello = costruisciModello(letto, proposta.punti);
const testoOriginale = testoDelDocumento(letto.parti);
const testoModello = testoDelDocumento(modello.parti);
verifica('nessuna occorrenza saltata', modello.saltate.length === 0, JSON.stringify(modello.saltate));
// Il modello differisce dal format solo nei punti e nella data dell'Albo di SMOCO.
verifica('il modello differisce dal format solo nei punti', soloNeiPunti(conAlboGiusto(testoOriginale), testoModello).ok, soloNeiPunti(conAlboGiusto(testoOriginale), testoModello).motivo);
verifica('nel modello la data dell\'Albo di SMOCO e\' gia\' quella giusta, e il resto della riga resta', testoModello.includes('Intermediario: SMOCO Srl - Iscrizione Albo cat.8 BA-11513 del 16/05/2025')
  && (modello.albo_smoco || []).length === 1, JSON.stringify(modello.albo_smoco));
verifica('del fornitore di partenza nel modello non resta niente', !/GATIM|02015210798|Azzarito|70,00/.test(testoModello.join('\n')), testoModello.filter(r => /GATIM|02015210798|Azzarito|70,00/.test(r)).join(' | '));
verifica('la formattazione resta: il segnaposto sta nel pezzo in grassetto', /<w:rPr><w:b\/><\/w:rPr><w:t[^>]*>\{\{FORNITORE_RAGIONE_SOCIALE\}\}<\/w:t>/.test(modello.parti['word/document.xml']));
const salvati = new Map(modello.punti.map(p => [p.segnaposto, p]));
verifica('nel modello il valore di partenza dei prezzi non si conserva (lo legge chiunque sia collegato)', salvati.get('CORRISPETTIVO_RACCOLTA')?.originale === null && salvati.get('FORNITORE_PIVA')?.originale === '02015210798');
verifica('i segnaposto del modello, compreso quello gia\' scritto', ['FORNITORE_RAGIONE_SOCIALE', 'DATA_INIZIO', 'TARGET_TON', 'CORRISPETTIVO_RACCOLTA', 'NOTE_AGGIUNTIVE'].every(s => modello.segnaposti.includes(s)), JSON.stringify(modello.segnaposti));
verifica('i punti si rileggono dal record (punti_json)', puntiDelModello({ punti_json: JSON.stringify(modello.punti) }).length === modello.punti.length && puntiDelModello({}).length === 0);

console.log('IL CONTRATTO DI UN ALTRO FORNITORE');
const valoriAltro = {
  FORNITORE_RAGIONE_SOCIALE: 'ECOLOGICAL SYSTEMS S.R.L.', FORNITORE_SEDE_LEGALE: 'Contrada San Luca snc, 85054 Muro Lucano (PZ)', FORNITORE_PIVA: '01234567890',
  FORNITORE_CCIAA: 'di Potenza', FORNITORE_RAPPRESENTANTE: 'Gerardo Farenga', FORNITORE_QUALIFICA: 'Amministratore Unico',
  DATA_INIZIO: '2027-01-02', DATA_FINE: '2027-12-31', DATA_FIRMA: '2027-01-02', ANNO: '2027', TARGET_TON: 1250, CORRISPETTIVO_RACCOLTA: 75,
  PAGAMENTO: 'sessanta giorni data fattura', MODALITA_PAGAMENTO: 'bonifico bancario', POLIZZA_RC: '1.500.000,00 Euro (unmilionecinquecentomila Euro)', NOTE_AGGIUNTIVE: 'nessuna',
};
const modelloLetto = await leggiModello(await blobInFile(modello.blob));
const gen = compilaContratto(modelloLetto, valoriAltro, modello.punti);
const testoGen = testoDelDocumento((await leggiModello(await blobInFile(gen.blob))).parti);
const tutto = testoGen.join('\n');
verifica('nessun segnaposto vuoto', gen.segnaposti_vuoti.length === 0, JSON.stringify(gen.segnaposti_vuoti));
verifica('le date nello stile del format', tutto.includes('valido dal 02 Gennaio 2027 e sino al 31 dicembre 2027') && tutto.includes('Massafra, 02 Gennaio 2027'), tutto.slice(0, 600));
verifica('quantita\' e prezzo all\'italiana', tutto.includes('circa 1.250 ton/anno') && tutto.includes('Raccolta PFU: 75,00 € a tonnellata'));
verifica('il resto del documento non cambia: la penale, l\'altro atto, le norme', tutto.includes('Penale: 500,00 €') && tutto.includes('impianto n. 45 del 16/05/2026') && tutto.includes('D.M. 182/2019'));
verifica('la data dell\'Albo di SMOCO nel contratto e\' il 16/05/2025, mai l\'anno del contratto', tutto.includes('Iscrizione Albo cat.8 BA-11513 del 16/05/2025') && !/BA-11513 del 16\/05\/202[67]/.test(tutto));
verifica('anche l\'intestazione', tutto.includes('Contratto di raccolta anno 2027 - ECOLOGICAL SYSTEMS S.R.L.'));
const cambiate = conAlboGiusto(testoOriginale).map((r, i) => (r === testoGen[i] ? null : i)).filter(i => i !== null);
const conPunti = testoModello.map((r, i) => (/\{\{[A-Z0-9_]+\}\}/.test(r) && !/NOTE_AGGIUNTIVE/.test(r) ? i : null)).filter(i => i !== null);
verifica('il contratto generato differisce dall\'originale solo nelle righe dei punti', cambiate.every(i => conPunti.includes(i) || /NOTE_AGGIUNTIVE/.test(testoModello[i])) && testoGen.length === testoOriginale.length,
  JSON.stringify(cambiate.filter(i => !conPunti.includes(i)).map(i => [testoOriginale[i], testoGen[i]])));

console.log('UN VALORE CHE MANCA NON E\' ZERO');
const senza = compilaContratto(modelloLetto, { ...valoriAltro, TARGET_TON: null }, modello.punti);
const testoSenza = testoDelDocumento((await leggiModello(await blobInFile(senza.blob))).parti).join('\n');
verifica('il segnaposto resta visibile e si dice', senza.segnaposti_vuoti.includes('TARGET_TON') && testoSenza.includes('circa {{TARGET_TON}} ton/anno') && !testoSenza.includes('circa 0 ton'), senza.segnaposti_vuoti.join(','));
verifica('le forme vecchie delle date si ricalcolano sempre dalla data', valoriPerIlDocumento({ DATA_INIZIO: '2027-01-02', DATA_INIZIO_LUNGA: '2 gennaio 2026' }).DATA_INIZIO_LUNGA === '2 gennaio 2027');

// ─── la sezione nella scheda Contratti ───

console.log('LA SEZIONE «MODELLI DEI CONTRATTI»');
const leggiSorgente = (p) => (existsSync(new URL(p, import.meta.url)) ? readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r/g, '') : '');
const scheda = leggiSorgente('../src/components/qualifica/ContrattiAnno.jsx');
const sezione = leggiSorgente('../src/components/qualifica/ModelliContratti.jsx');
verifica('la scheda Contratti ha la sezione dei modelli, solo per l\'amministratore', /\{isAdmin && <ModelliContratti\b/.test(scheda) && /Modelli dei contratti/.test(sezione));
verifica('il format si legge e si propongono i punti, che l\'amministratore conferma', /leggiFormat\(/.test(sezione) && /proponiPunti\(/.test(sezione) && /costruisciModello\(/.test(sezione) && /cercaNelFormat\(/.test(sezione));
const creazione = (sezione.match(/ModelloContratto\.create\(\{[\s\S]*?\n\s*\}\);/) || [''])[0];
verifica('il modello si salva coi punti confermati (punti_json), per tipo e canale', /punti_json: JSON\.stringify\(costruito\.punti\)/.test(creazione) && /tipo_contratto: tipo, canale/.test(creazione), creazione.slice(0, 200));
verifica('il modello caricato va nell\'area privata, mai in quella pubblica', /UploadPrivateFile/.test(sezione) && !/UploadFile\b/.test(sezione.replace(/UploadPrivateFile/g, '')));
verifica('un modello superato resta nello storico, non si cancella', /stato: 'sostituito'/.test(sezione) && !/ModelloContratto\.delete/.test(sezione));
verifica('il modello si apre dalla funzione apriFile, non col riferimento al file', /linkFile\('ModelloContratto'/.test(sezione) && !/\.file_uri\b/.test(sezione));

// ─── i format veri ───

const CARTELLA = 'C:/Users/HOME/Desktop/ECOTYRE/ECOTYRE - repository/2026/CONTRATTI SUBFORNITORI/';
const VERI = [
  { tipo: 'raccolta', file: 'Contratto Raccolta 2026_RETE MODIFICATO.docx', piva: '02015210798', nome: 'GATIM', anno: 2026, punti: { TARGET_TON: '300', CORRISPETTIVO_RACCOLTA: '70,00', DATA_INIZIO: '02 Gennaio 2026' } },
  { tipo: 'trattamento', file: '[RIFERIMENTO GRETA] - Contratto ACI 2026 - TECNOGUM - Impianto_Rev_1.docx', piva: '01261820599', nome: 'TECNOGUM', anno: 2026, revisioni: true, punti: { CORRISPETTIVO_TRATTAMENTO: '95,00', DATA_INIZIO: '1° aprile 2026' } },
  { tipo: 'raccolta', file: 'EMMESSE/2026/Contratto ACI 2026 - EMMESSE - Raccolta_Rev_3.docx', piva: '16460251008', nome: 'EMMESSE', anno: 2026, punti: { CORRISPETTIVO_RACCOLTA: '110,00', DATA_INIZIO: '01/06/2026' } },
  { tipo: 'trattamento', file: 'GATIM/ACI 2026 - dal 01-03-2026/Contratto ACI 2026 - GATIM - Impianto_Rev_1.docx', piva: '02015210798', nome: 'GATIM', anno: 2026, punti: { CORRISPETTIVO_TRATTAMENTO: '105,00', DATA_INIZIO: '2 Marzo 2026' } },
  { tipo: 'raccolta', file: 'ECORECUPERI/2024/Ecorecuperi_ACI 2024 Raccolta&stoccaggio.docx', piva: '00377110945', nome: 'ECORECUPERI', anno: 2024, punti: { CORRISPETTIVO_RACCOLTA: '105,00', DATA_INIZIO: '01 Gennaio 2024' } },
  { tipo: 'stoccaggio', file: 'T-CYCLE/2026/Contratto 2026 T-CYCLE_Stoccaggio pfu.docx', piva: '07789361214', nome: 'T-Cycle', anno: 2026, punti: { QUOTA_TON: '250', CORRISPETTIVO_STOCCAGGIO: '25' }, spenti: ['CORRISPETTIVO_STOCCAGGIO_2'] },
  { tipo: 'trattamento', file: 'T-CYCLE/2026/Contratto 2026 T-CYCLE_TRATTAMENTO RETE.docx', piva: '07789361214', nome: 'T-Cycle', anno: 2026, punti: { QUOTA_TON: '1050', CORRISPETTIVO_PMG1: '70,00', CORRISPETTIVO_G2: '160,00' } },
  { tipo: 'trasporto_secondaria', file: 'Contratto Servizi Trasporto_ITA 2026.docx', piva: null, nome: null, anno: 2026, senzaAnno: true, punti: { DATA_INIZIO: '02/01/2026', DATA_FINE: '31/12/2026' } },
];
// Valori finti di un altro fornitore, per ogni punto che un format puo' avere.
const altro = {
  FORNITORE_RAGIONE_SOCIALE: 'ALTRO FORNITORE S.R.L.', FORNITORE_SEDE_LEGALE: 'Via Roma 1, 74016 Massafra (TA)', FORNITORE_SEDE_OPERATIVA: 'Via Napoli 2, 80100 Napoli (NA)',
  FORNITORE_PIVA: '12345678901', FORNITORE_CF: '12345678901', FORNITORE_CCIAA: 'di Taranto', FORNITORE_REA: 'CCIAA TA n.12345', FORNITORE_RAPPRESENTANTE: 'Mario Rossi', FORNITORE_QUALIFICA: 'Legale Rappresentante',
  FORNITORE_EMAIL: 'info@altro.example', FORNITORE_TEL: '099 1234567', DATA_INIZIO: '2027-01-02', DATA_FINE: '2027-12-31', DATA_FIRMA: '2027-01-02', ANNO: '2027',
  TARGET_TON: 1250, QUOTA_TON: 1250, CORRISPETTIVO_RACCOLTA: 72.5, CORRISPETTIVO_STOCCAGGIO: 18, CORRISPETTIVO_TRATTAMENTO: 99, CORRISPETTIVO_PMG1: 75, CORRISPETTIVO_G2: 165,
  CORRISPETTIVO_TRASPORTO: 30, PAGAMENTO: 'sessanta giorni data fattura', MODALITA_PAGAMENTO: 'bonifico bancario', POLIZZA_RC: '2.000.000,00 Euro (duemilioni Euro)',
};

if (!existsSync(CARTELLA)) {
  console.log('I FORMAT VERI: la cartella dei contratti non c\'e\' su questo computer, salto questa parte');
} else {
  console.log('I FORMAT VERI DELLA CARTELLA DEI CONTRATTI');
  for (const f of VERI) {
    const nomeBreve = f.file.split('/').pop();
    if (!existsSync(CARTELLA + f.file)) { verifica(`${nomeBreve}: il file c'e'`, false); continue; }
    const l = await leggiFormat(comeFile(new Uint8Array(readFileSync(CARTELLA + f.file))));
    const p = proponiPunti(l, { tipo: f.tipo });
    const pp = (s) => p.punti.find(x => x.segnaposto === s);
    if (f.revisioni) verifica(`${nomeBreve}: le revisioni aperte si accettano`, l.revisioni > 0 && l.revisioni_accettate);
    if (f.nome) {
      verifica(`${nomeBreve}: riconosce il fornitore e l'anno`, (p.fornitore?.ragione_sociale || '').toUpperCase().includes(f.nome.toUpperCase()) && p.anno === f.anno, JSON.stringify([p.fornitore, p.anno]));
      verifica(`${nomeBreve}: partita IVA, ragione sociale, sede, rappresentante`, pp('FORNITORE_PIVA')?.originale === f.piva && pp('FORNITORE_RAGIONE_SOCIALE')?.attivo && pp('FORNITORE_SEDE_LEGALE')?.attivo && pp('FORNITORE_RAPPRESENTANTE')?.attivo);
    } else {
      verifica(`${nomeBreve}: il format vuoto ha i campi da compilare del fornitore`, /^_+$/.test(pp('FORNITORE_RAGIONE_SOCIALE')?.originale || '') && /^_+$/.test(pp('FORNITORE_PIVA')?.originale || ''));
    }
    for (const [s, v] of Object.entries(f.punti)) verifica(`${nomeBreve}: ${s} = «${v}»`, pp(s)?.originale === v && pp(s)?.attivo, JSON.stringify(pp(s) && [pp(s).originale, pp(s).attivo]));
    for (const s of f.spenti || []) verifica(`${nomeBreve}: ${s} proposto spento (sta in una casella disegnata sopra)`, pp(s) && !pp(s).attivo, JSON.stringify(pp(s) && [pp(s).originale, pp(s).nota]));
    // Nel format del trasporto l'anno c'e' solo dentro le date: un punto ANNO a parte non serve.
    verifica(`${nomeBreve}: c'e' l'anno, e le date`, (f.senzaAnno || pp('ANNO')?.attivo) && pp('DATA_INIZIO')?.attivo && pp('DATA_FINE')?.attivo);

    const m = costruisciModello(l, p.punti);
    const orig = testoDelDocumento(l.parti);
    const mod = testoDelDocumento(m.parti);
    verifica(`${nomeBreve}: nessuna occorrenza saltata`, m.saltate.length === 0, JSON.stringify(m.saltate));
    // Fuori dai punti cambia solo la data dell'Albo di SMOCO (13/10/2026).
    const spiegato = soloNeiPunti(conAlboGiusto(orig), mod);
    verifica(`${nomeBreve}: il modello differisce dal format solo nei punti`, spiegato.ok, spiegato.motivo);
    const g2 = compilaContratto(await leggiModello(await blobInFile(m.blob)), altro, m.punti);
    const tg = testoDelDocumento((await leggiModello(await blobInFile(g2.blob))).parti);
    verifica(`${nomeBreve}: generato coi valori di un altro fornitore, nessun segnaposto vuoto`, g2.segnaposti_vuoti.length === 0, g2.segnaposti_vuoti.join(','));
    const cambiate2 = conAlboGiusto(orig).map((r, i) => (r === tg[i] ? null : i)).filter(i => i !== null);
    const coi = new Set(mod.map((r, i) => (/\{\{[A-Z0-9_]+\}\}/.test(r) ? i : null)).filter(i => i !== null));
    verifica(`${nomeBreve}: il contratto generato differisce solo nelle righe dei punti (${cambiate2.length} su ${orig.length})`, tg.length === orig.length && cambiate2.every(i => coi.has(i)),
      JSON.stringify(cambiate2.filter(i => !coi.has(i)).map(i => [orig[i], tg[i]])).slice(0, 400));
    if (f.piva) verifica(`${nomeBreve}: la partita IVA del fornitore di partenza non resta nel contratto nuovo`, !tg.join('\n').includes(f.piva));
    const prezzo = Object.keys(f.punti).find(s => /^CORRISPETTIVO_/.test(s));
    if (prezzo) verifica(`${nomeBreve}: il prezzo di partenza non resta nel modello`, m.punti.find(x => x.segnaposto === prezzo)?.originale === null);
  }

  // Il contratto vero di un altro fornitore, rifatto dal format: Ecological
  // Systems dal format di raccolta di rete (che e' il contratto di Gatim). Le
  // righe diverse sono solo ritocchi scritti a mano nel contratto vero.
  const ECO = 'ECOLOGICAL SYSTEMS/2026/inviati/Contratto raccolta rete 2026_Ecological Systems.docx';
  if (existsSync(CARTELLA + ECO)) {
    const lf = await leggiFormat(comeFile(new Uint8Array(readFileSync(CARTELLA + VERI[0].file))));
    const mf = costruisciModello(lf, proponiPunti(lf, { tipo: 'raccolta' }).punti);
    const le = await leggiFormat(comeFile(new Uint8Array(readFileSync(CARTELLA + ECO))));
    const pe = proponiPunti(le, { tipo: 'raccolta' });
    const valori = {};
    for (const x of pe.punti) {
      if (!x.originale) continue;
      valori[x.segnaposto] = x.tipo === 'data' ? leggiData(x.originale) : (x.tipo === 'prezzo' || x.tipo === 'quantita') ? leggiNumeroItaliano(x.originale) : x.originale;
    }
    const ge = compilaContratto(await leggiModello(await blobInFile(mf.blob)), valori, mf.punti);
    const tge = testoDelDocumento((await leggiModello(await blobInFile(ge.blob))).parti);
    const vero = testoDelDocumento(le.parti);
    const diverse = vero.map((r, i) => (r === tge[i] ? null : i)).filter(i => i !== null);
    verifica('Ecological Systems rifatto dal format: stesse righe, i suoi valori dentro', tge.length === vero.length
      && ['ECOLOGICAL SYSTEMS', valori.FORNITORE_PIVA, '75,00', '300 ton/anno'].every(v => v && tge.join('\n').includes(v)), JSON.stringify(valori).slice(0, 300));
    verifica(`Ecological Systems rifatto dal format: differisce dal contratto vero in poche righe scritte a mano (${diverse.length})`, diverse.length <= 6,
      JSON.stringify(diverse.map(i => [vero[i], tge[i]])).slice(0, 800));
  }
}

// ─── l'iscrizione di SMOCO all'Albo: sempre il 16/05/2025 (13/10/2026) ───
// Decisione dell'utente del 13/10/2026: «ogni 5 anni c'è il rinnovo delle
// autorizzazioni sull'albo, quindi devi sempre considerare come data il
// «16/05/2025» (fino al 2030 quando verrà rinnovata)». E' l'iscrizione di SMOCO
// in categoria 8, n. BA-11513: un dato fisso, scritto in un posto solo
// (ALBO_SMOCO in segnapostiContratto). Il lettore corregge la data che trova
// nella riga dell'Albo di SMOCO, nel modello e nel contratto, e lo dice; nessun
// altro dato di SMOCO cambia.
console.log('L\'ISCRIZIONE DI SMOCO ALL\'ALBO: SEMPRE IL 16/05/2025');
const catalogoF = await import('../base44/shared/segnapostiContratto.ts');
const catalogoP = await import('../src/lib/segnapostiContratto.js');
for (const [nome, c] of [['funzione', catalogoF], ['pagina', catalogoP]]) {
  verifica(`${nome}: ALBO_SMOCO e' l'iscrizione in categoria 8 BA-11513 del 16/05/2025, valida fino al 15/05/2030`, c.ALBO_SMOCO?.numero === 'BA-11513' && c.ALBO_SMOCO.categoria === '8'
    && c.ALBO_SMOCO.data === '2025-05-16' && c.ALBO_SMOCO.scadenza === '2030-05-15' && Object.isFrozen(c.ALBO_SMOCO), JSON.stringify(c.ALBO_SMOCO));
  verifica(`${nome}: scaduta solo dopo il 15/05/2030`, !c.alboSmocoScaduto('2030-05-15') && c.alboSmocoScaduto('2030-05-16'));
}
// In un posto solo: nel codice (non nei commenti) di src e base44 la data
// compare solo nel catalogo e nel suo specchio.
const fileDi = (dir) => readdirSync(new URL(dir, import.meta.url)).flatMap(n => {
  const p = `${dir}/${n}`;
  return statSync(new URL(p, import.meta.url)).isDirectory() ? fileDi(p) : (/\.(js|jsx|ts)$/.test(n) ? [p] : []);
});
const dataScritta = [...fileDi('../src'), ...fileDi('../base44')].filter(p => !/segnapostiContratto\.(ts|js)$/.test(p)).filter(p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r/g, '')
  .split('\n').some(r => !/^\s*(\/\/|\*|\/\*)/.test(r) && /2025-05-16|16[/.]05[/.]2025/.test(r.replace(/\/\/.*$/, ''))));
verifica('la data dell\'Albo di SMOCO e\' scritta nel codice solo in segnapostiContratto (e nel suo specchio)', !dataScritta.length, dataScritta.join(', '));

const formatAlbo = (righe) => zipSync({ 'word/document.xml': strToU8(`<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${righe.map(t => P(R(t))).join('')}</w:body></w:document>`), '[Content_Types].xml': strToU8('<Types/>') });
const RIGHE_ALBO = [
  'SMOCO è iscritta all’Albo Nazionale Gestori Ambientali con Autorizzazione n. BA11513 del 15.05.2020 per l’attività di intermediazione e/o commercio di rifiuti speciali non pericolosi in categoria 8 classe “A” e con Autorizzazione n. BA11513 del 01.04.2022 per raccolta e trasporto di rifiuti speciali non pericolosi in categoria 4 classe “C”.',
  'Intermediario: SMOCO Srl - Iscrizione Albo cat. 8 BA 11513 del 15 maggio 2020',
  'Riferimento: BA-11513 del 03/03/2021',
  'Il presente contratto è valido dal 02 Gennaio 2026 e sino al 31 dicembre 2026.',
];
const lettoAlbo = await leggiFormat(comeFile(formatAlbo(RIGHE_ALBO)));
const pAlbo = proponiPunti(lettoAlbo, { tipo: 'raccolta', oggi: '2026-10-13' });
const dataAlbo = (testo) => (pAlbo.albo_smoco || []).find(o => o.testo === testo);
verifica('categoria 8 scritta coi punti: diventa «16.05.2025»', dataAlbo('15.05.2020')?.categoria === '8' && dataAlbo('15.05.2020')?.nuovo === '16.05.2025', JSON.stringify(pAlbo.albo_smoco));
verifica('lo stesso numero in categoria 4 (01.04.2022) e\' un\'altra iscrizione: non si tocca', dataAlbo('01.04.2022')?.categoria === '4' && dataAlbo('01.04.2022')?.correggi === false);
verifica('la data scritta in lettere: «16 maggio 2025»', dataAlbo('15 maggio 2020')?.nuovo === '16 maggio 2025');
verifica('senza la categoria scritta non si sceglie, e si dice', dataAlbo('03/03/2021')?.categoria === null && dataAlbo('03/03/2021')?.correggi === false
  && pAlbo.avvisi.some(a => /non dice la categoria/.test(a) && a.includes('«03/03/2021»')), JSON.stringify(pAlbo.avvisi));
verifica('prima della scadenza nessun avviso di rinnovo', !pAlbo.avvisi.some(a => /rinnovo/.test(a)));
verifica('dopo il 15/05/2030 il lettore dice che la data va rinnovata', proponiPunti(lettoAlbo, { tipo: 'raccolta', oggi: '2030-05-16' }).avvisi.some(a => /valeva fino al 15\/05\/2030: la data del rinnovo va aggiornata/.test(a)));
const mAlbo = costruisciModello(lettoAlbo, pAlbo.punti);
const tAlbo = testoDelDocumento(mAlbo.parti);
verifica('nel modello si correggono solo le due date di categoria 8: il resto delle righe, e la categoria 4, restano',
  tAlbo[0] === RIGHE_ALBO[0].replace('del 15.05.2020', 'del 16.05.2025') && tAlbo[1] === 'Intermediario: SMOCO Srl - Iscrizione Albo cat. 8 BA 11513 del 16 maggio 2025'
  && tAlbo[2] === RIGHE_ALBO[2] && (mAlbo.albo_smoco || []).length === 2 && !mAlbo.saltate.length, JSON.stringify(tAlbo.slice(0, 3)));
// Un modello salvato prima del 13/10/2026 ha ancora la data del format: si
// corregge quando si genera il contratto, e il contratto lo dice.
const vecchioModello = applicaPunti(lettoAlbo.parti, pAlbo.punti);
const gVecchio = compilaContratto({ ...lettoAlbo, parti: vecchioModello.parti }, { DATA_INIZIO: '2027-01-02', DATA_FINE: '2027-12-31', ANNO: '2027' }, pAlbo.punti);
const tVecchio = testoDelDocumento((await leggiModello(await blobInFile(gVecchio.blob))).parti);
verifica('da un modello di prima il contratto esce con la data giusta, e lo dice', tVecchio[0] === tAlbo[0] && tVecchio[1] === tAlbo[1] && (gVecchio.albo_smoco || []).length === 2,
  JSON.stringify([tVecchio.slice(0, 2), gVecchio.albo_smoco]));
const gNuovo = compilaContratto(await leggiModello(await blobInFile(mAlbo.blob)), { DATA_INIZIO: '2027-01-02', DATA_FINE: '2027-12-31', ANNO: '2027' }, mAlbo.punti);
verifica('da un modello gia\' corretto non c\'e\' niente da correggere', (gNuovo.albo_smoco || []).length === 0, JSON.stringify(gNuovo.albo_smoco));

if (existsSync(CARTELLA)) {
  // Il format dell'utente: «Contratto Raccolta 2026_RETE MODIFICATO», «del 15/05/2020».
  const l = await leggiFormat(comeFile(new Uint8Array(readFileSync(CARTELLA + 'Contratto Raccolta 2026_RETE MODIFICATO.docx'))));
  const p = proponiPunti(l, { tipo: 'raccolta' });
  verifica('«Contratto Raccolta 2026_RETE MODIFICATO»: la proposta dice che «15/05/2020» diventa 16/05/2025', (p.albo_smoco || []).filter(o => o.correggi).map(o => o.testo).join() === '15/05/2020'
    && p.avvisi.some(a => a.includes('«15/05/2020»: quella in vigore è del 16/05/2025, valida fino al 15/05/2030')), JSON.stringify(p.avvisi));
  const m = costruisciModello(l, p.punti);
  const g = compilaContratto(await leggiModello(await blobInFile(m.blob)), altro, m.punti);
  const orig = testoDelDocumento(l.parti);
  const tg = testoDelDocumento((await leggiModello(await blobInFile(g.blob))).parti);
  const k = orig.findIndex(r => /BA-11513 del 15\/05\/2020/.test(r));
  verifica('...e nel contratto generato la riga dell\'Albo di SMOCO cambia solo nella data', k >= 0 && tg[k] === 'Intermediario: SMOCO Srl - CF nr 02971520735 – Iscrizione Albo cat.8 BA-11513 del 16/05/2025'
    && tg[k] === orig[k].replace('del 15/05/2020', 'del 16/05/2025'), JSON.stringify([orig[k], tg[k]]));
  verifica('...e nessun altro dato di SMOCO cambia (le righe col suo codice fiscale)', orig.every((r, i) => i === k || !r.includes('02971520735') || tg[i] === r),
    JSON.stringify(orig.map((r, i) => [r, tg[i]]).filter(([r, t], i) => i !== k && r.includes('02971520735') && t !== r).slice(0, 2)));
  // Tutti i contratti e i format delle due cartelle: il lettore corregge le date
  // dell'Albo di SMOCO esattamente come la regola della prova, e non altro.
  const radici = [CARTELLA, CARTELLA.replace('CONTRATTI SUBFORNITORI/', 'CONTRATTI (FORMAT)/')];
  const tutti = (d) => readdirSync(d).flatMap(n => (statSync(d + n).isDirectory() ? tutti(d + n + '/') : (/\.docx$/i.test(n) && !n.startsWith('~$') ? [d + n] : [])));
  const { correggiAlboSmoco } = await import('../src/lib/modelliContratto.js');
  let conAlbo = 0;
  const corrette = new Map();
  const diversi = [];
  for (const file of radici.filter(existsSync).flatMap(tutti)) {
    const lf = await leggiFormat(comeFile(new Uint8Array(readFileSync(file))));
    const prima = testoDelDocumento(lf.parti);
    if (!prima.some(r => /BA-?\s?11513/.test(r))) continue;
    conAlbo++;
    const c = correggiAlboSmoco(lf.parti);
    for (const o of c.correzioni) corrette.set(o.testo, (corrette.get(o.testo) || 0) + 1);
    const dopo = testoDelDocumento(c.parti);
    if (dopo.length !== prima.length || dopo.some((r, i) => r !== alboGiusto(prima[i]))) diversi.push(file.split('/').slice(-2).join('/'));
  }
  console.log(`  ${conAlbo} documenti con l'Albo di SMOCO; date corrette: ${[...corrette].map(([d, n]) => `${d} (${n})`).join(', ')}`);
  verifica('su tutti i contratti veri il lettore corregge come la regola della prova, e non tocca altro', conAlbo >= 60 && !diversi.length, diversi.slice(0, 5).join(' | '));
  verifica('si correggono il 15/05/2020, il 16/05/2026 e il 15/05/2025; il 16/05/2025 e il 01.04.2022 (categoria 4) mai',
    ['15/05/2020', '16/05/2026', '15/05/2025'].every(d => corrette.has(d)) && !corrette.has('16/05/2025') && !corrette.has('16.05.2025') && !corrette.has('01.04.2022'), JSON.stringify([...corrette]));
  const ECO_FASO = 'ECO FASO/Contratto_SMOCO_ECO FASO - 2026 (16.01.03. verso IRIGOM).docx';
  if (existsSync(CARTELLA + ECO_FASO)) {
    const le = await leggiFormat(comeFile(new Uint8Array(readFileSync(CARTELLA + ECO_FASO))));
    const pe = proponiPunti(le, { tipo: 'raccolta' });
    verifica('Eco Faso: categoria 8 gia\' del 16.05.2025 e categoria 4 del 01.04.2022, nessuna correzione e nessun avviso',
      (pe.albo_smoco || []).map(o => `${o.categoria}:${o.testo}:${o.correggi}`).join() === '8:16.05.2025:false,4:01.04.2022:false' && !pe.avvisi.some(a => /Albo/.test(a)), JSON.stringify(pe.albo_smoco));
  }
}

// ─── i punti nuovi del lettore nel catalogo (revisione del 13/10/2026, R3a) ───
// Il lettore dei format fa nascere il referente del fornitore («per il Vettore:
// sig. …») e i numeri d'iscrizione del vettore, con i loro _2 e _3. Il catalogo
// non li aveva: erano «altri punti» per chi li sceglieva a mano in «Modelli dei
// contratti», e nell'elenco del lettore finivano in fondo, dopo date e prezzi.
console.log('I PUNTI NUOVI DEI FORMAT STANNO NEL CATALOGO');
const catalogoFunzione = await import('../base44/shared/segnapostiContratto.ts');
const catalogoPagina = await import('../src/lib/segnapostiContratto.js');
// Ultimo giro della revisione del 13/10/2026: anche la data o gli estremi
// dell'iscrizione, la provincia dell'albo e la classe del vettore, che il
// lettore segna da controllare nei contratti di trasporto compilati. Senza il
// catalogo erano «altri punti» per chi li sceglieva a mano.
const NUOVI_DEL_LETTORE = {
  FORNITORE_REFERENTE: 'Referente del fornitore',
  FORNITORE_ISCRIZIONE: 'Numero d\'iscrizione del fornitore',
  FORNITORE_ISCRIZIONE_DATA: 'Data ed estremi dell\'iscrizione del fornitore',
  FORNITORE_ALBO_PROVINCIA: 'Provincia dell\'albo degli autotrasportatori del fornitore',
  FORNITORE_ALBO_CLASSE: 'Classe d\'iscrizione del fornitore all\'albo gestori ambientali',
};
for (const [nome, c] of [['funzione', catalogoFunzione], ['pagina', catalogoPagina]]) {
  for (const [s, titolo] of Object.entries(NUOVI_DEL_LETTORE)) {
    const voce = c.PUNTI_CONTRATTO.find(p => p.segnaposto === s);
    verifica(`${nome}: ${s} e' nel catalogo, fra i dati del fornitore, come testo, col nome che gli da' il lettore`, !!voce && voce.categoria === 'fornitore' && voce.tipo === 'testo' && voce.nome === titolo, JSON.stringify(voce));
  }
  const terzo = c.puntoDi('FORNITORE_ISCRIZIONE_3');
  verifica(`${nome}: FORNITORE_ISCRIZIONE_3 e' il terzo numero d'iscrizione del fornitore`, terzo.categoria === 'fornitore' && terzo.tipo === 'testo' && terzo.nome === 'Numero d\'iscrizione del fornitore (3°)', JSON.stringify(terzo));
  const secondaData = c.puntoDi('FORNITORE_ISCRIZIONE_DATA_2');
  verifica(`${nome}: FORNITORE_ISCRIZIONE_DATA_2 e' la seconda data d'iscrizione del fornitore`, secondaData.categoria === 'fornitore' && secondaData.nome === 'Data ed estremi dell\'iscrizione del fornitore (2°)', JSON.stringify(secondaData));
  // Fra i dati del fornitore, prima delle date: nell'elenco del lettore stanno li'.
  const posto = (s) => c.PUNTI_CONTRATTO.findIndex(p => p.segnaposto === s);
  verifica(`${nome}: i punti nuovi stanno dopo il numero d'iscrizione e prima delle date`, ['FORNITORE_ISCRIZIONE_DATA', 'FORNITORE_ALBO_PROVINCIA', 'FORNITORE_ALBO_CLASSE'].every(s => posto(s) > posto('FORNITORE_ISCRIZIONE') && posto(s) < posto('DATA_INIZIO')));
}
const LOGISTICA = 'LOGISTICA SRL/2026/Contratto Servizi Trasporto_Logistica srl - 2026.docx';
if (existsSync(CARTELLA + LOGISTICA)) {
  const l = await leggiFormat(comeFile(new Uint8Array(readFileSync(CARTELLA + LOGISTICA))));
  const p = proponiPunti(l, { tipo: 'trasporto_secondaria' });
  const nuovi = p.punti.filter(x => /^FORNITORE_(REFERENTE|ISCRIZIONE|ISCRIZIONE_DATA|ALBO_PROVINCIA|ALBO_CLASSE)(_\d+)?$/.test(x.segnaposto));
  verifica('il format di trasporto di Logistica ha il referente e i numeri d\'iscrizione', nuovi.some(x => x.segnaposto === 'FORNITORE_REFERENTE') && nuovi.some(x => x.segnaposto === 'FORNITORE_ISCRIZIONE'), nuovi.map(x => x.segnaposto).join());
  verifica('...e la data, la provincia dell\'albo e la classe dell\'iscrizione', ['FORNITORE_ISCRIZIONE_DATA', 'FORNITORE_ALBO_PROVINCIA', 'FORNITORE_ALBO_CLASSE'].every(s => nuovi.some(x => x.segnaposto === s)), nuovi.map(x => x.segnaposto).join());
  verifica('ognuno ha nel catalogo lo stesso nome e la stessa categoria che gli da\' il lettore', nuovi.every(x => {
    const c = catalogoPagina.puntoDi(x.segnaposto);
    return c.nome === x.nome && c.categoria === x.categoria && c.categoria === 'fornitore';
  }), JSON.stringify(nuovi.map(x => [x.segnaposto, x.nome, catalogoPagina.puntoDi(x.segnaposto).categoria])));
  const posto = (s) => p.punti.findIndex(x => x.segnaposto === s);
  verifica('nell\'elenco del lettore il referente sta coi dati del fornitore, prima delle date', posto('FORNITORE_REFERENTE') >= 0 && posto('FORNITORE_REFERENTE') < posto('DATA_INIZIO'),
    p.punti.map(x => x.segnaposto).join());
  verifica('...e cosi\' la data, la provincia dell\'albo e la classe dell\'iscrizione', ['FORNITORE_ISCRIZIONE_DATA', 'FORNITORE_ALBO_PROVINCIA', 'FORNITORE_ALBO_CLASSE'].every(s => posto(s) >= 0 && posto(s) < posto('DATA_INIZIO')),
    p.punti.map(x => x.segnaposto).join());
} else {
  console.log('  il format di trasporto di Logistica non c\'e\' su questo computer: salto il confronto col lettore');
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
