// Prova del generatore di documenti Word dai modelli (src/lib/docxModello.js):
// i segnaposto spezzati da Word si ricompongono, ma lo stile del testo intorno
// non si perde. Prima un titolo in grassetto accanto a un testo normale finiva
// tutto nello stile del primo pezzo.
// npm run prove
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { leggiModello, generaDocx } from '../src/lib/docxModello.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const R = (testo, stile = '') => `<w:r>${stile ? `<w:rPr>${stile}</w:rPr>` : ''}<w:t xml:space="preserve">${testo}</w:t></w:r>`;
const P = (...run) => `<w:p><w:pPr><w:jc w:val="both"/></w:pPr>${run.join('')}</w:p>`;
const GRASSETTO = '<w:b/>';
const TIMES = '<w:rFonts w:ascii="Times New Roman"/>';
const documento = `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${[
  // 1. Segnaposto spezzato in due run con lo stesso stile.
  P(R('Mese: '), R('{{ME'), R('SE}}')),
  // 2. Due stili diversi e nessun segnaposto: devono restare due run.
  P(R('DICHIARAZIONE', GRASSETTO + TIMES), R(' del produttore')),
  // 3. Segnaposto spezzato fra run di stile diverso: si ricompone lo stesso.
  P(R('Quantita\' '), R('{{QUANT', GRASSETTO), R('ITA}}'), R(' kg')),
  // 4. Testo in grassetto accanto a un segnaposto intero: il grassetto resta.
  P(R('Consorzio Ecotyre', GRASSETTO), R(' - {{ANNO}}')),
].join('')}</w:body></w:document>`;

const zip = zipSync({ 'word/document.xml': strToU8(documento), '[Content_Types].xml': strToU8('<Types/>') });
const file = { name: 'prova.docx', arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) };

console.log('I SEGNAPOSTO SPEZZATI SI RICOMPONGONO');
const modello = await leggiModello(file);
verifica('trovati tutti e tre', ['MESE', 'QUANTITA', 'ANNO'].every(s => modello.segnaposti.includes(s)), JSON.stringify(modello.segnaposti));

console.log('LO STILE NON SI PERDE');
const xml = modello.parti['word/document.xml'];
verifica('il titolo resta in grassetto e Times', /<w:rPr><w:b\/><w:rFonts w:ascii="Times New Roman"\/><\/w:rPr><w:t xml:space="preserve">DICHIARAZIONE<\/w:t>/.test(xml));
verifica('il testo dopo il titolo resta un run a parte, senza grassetto', /<w:r><w:t xml:space="preserve"> del produttore<\/w:t><\/w:r>/.test(xml));
verifica('il grassetto di "Consorzio Ecotyre" resta', /<w:rPr><w:b\/><\/w:rPr><w:t xml:space="preserve">Consorzio Ecotyre<\/w:t>/.test(xml));
verifica('i run con lo stesso stile si fondono', xml.includes('Mese: {{MESE}}'));

console.log('IL DOCUMENTO GENERATO');
const { blob, segnaposti_vuoti } = generaDocx(modello, { MESE: 'Agosto', QUANTITA: '82.500', ANNO: '2026' });
const uscita = strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))['word/document.xml']);
const testo = uscita.replace(/<w:p[ >]/g, '\n<w:p ').replace(/<[^>]+>/g, '');
verifica('nessun segnaposto vuoto', segnaposti_vuoti.length === 0, JSON.stringify(segnaposti_vuoti));
verifica('il testo e\' quello atteso', testo.includes('Mese: Agosto') && testo.includes('Quantita\' 82.500 kg') && testo.includes('Consorzio Ecotyre - 2026'), testo);
verifica('gli spazi in testa e in coda restano', testo.includes('DICHIARAZIONE del produttore'), testo);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
