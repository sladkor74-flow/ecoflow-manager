// IL FATTURANTE DELLE RIGHE ATTIVE E' SMOCO Srl (chiusura dell'audit, 11/10/2026).
//
// Il fatto. Il calcolo dell'attiva scriveva fatturante 'ECOTYRE' su ogni riga, e
// lo salvava nelle VoceFatturazione; i due fogli ACI - il report dell'attiva e il
// «format amministrazione» - stampavano quel campo. Il format amministrazione
// ripiegava su 'SMOCO Srl' solo con il campo vuoto, cioe' mai. Ma la fattura la
// emette SMOCO: l'utente, 11/10/2026, «tutti i fornitori per raccolta e
// trattamento fatturano a noi di Smoco, mentre la Smoco fa un'unica fattura ad
// Ecotyre (anzi tre perche' i canali sono tre)». Il foglio ACI
// dell'amministrazione (02-SMOCO-Fatturazione ACI 2026.xlsx) ha «SMOCO Srl» su
// ogni riga di ogni mese, da gennaio a settembre 2026, e cosi' la prefattura del
// portale. Le righe gia' salvate non si toccano: i fogli stampano il soggetto,
// e la prova usa una riga com'e' salvata davvero. npm run prove
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { calcolaRigheAttiva } from '../base44/shared/attivaCalcolo.ts';
import * as tariffe from '../base44/shared/ecotyreTariffe.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const radice = fileURLToPath(new URL('..', import.meta.url));
const sorgente = (p) => readFileSync(join(radice, p), 'utf8').replace(/\r/g, '');

const { tabellaAmministrazione } = await caricaLibPagine('lib/formatAmministrazione');
const { tabellaAttiva } = await caricaLibPagine('lib/fatturazioneExport', [
  ["import { formattaPesi } from '@/lib/formatoExcel';", 'const formattaPesi = null;'],
]);

// Una riga ACI di settembre 2026 com'e' salvata in VoceFatturazione: col
// fatturante che il calcolo ci scriveva prima.
const salvata = {
  tipologia: 'ACI', tipo: 'ATTIVA', fatturante: 'ECOTYRE', servizio_ecotyre: 'TRASP_TRATT',
  regione: 'Puglia', ordine: 'ET26126228', data_fine_trasporto: '2026-09-01T00:00:00Z', numero_fir: 'BSDCL002361RK',
  classe: 'PFU Autodemolizione', quantita: 2140, tariffa_valore: 240, totale: 513.6, ticket_n: '162399-21', note: '',
};

console.log('CHI EMETTE LA FATTURA');
verifica('il soggetto e SMOCO Srl, come nel foglio dell amministrazione', tariffe.FATTURANTE_ATTIVA === 'SMOCO Srl', String(tariffe.FATTURANTE_ATTIVA));

console.log('I DUE FOGLI ACI STAMPANO SMOCO Srl, ANCHE SULLE RIGHE GIA SALVATE');
{
  const amm = tabellaAmministrazione('ACI', [salvata], 2026, 'Settembre');
  const iA = amm.colonne.findIndex(c => c.titolo === 'Fatturante');
  verifica('format amministrazione: SMOCO Srl, non ECOTYRE', amm.righe[0][iA] === 'SMOCO Srl', String(amm.righe[0][iA]));
  const rep = tabellaAttiva('ACI', [salvata], 2026, 'Settembre');
  const iR = rep.colonne.findIndex(c => c.titolo === 'Fatturante');
  verifica('report dell attiva: SMOCO Srl, non ECOTYRE', rep.righe[0][iR] === 'SMOCO Srl', String(rep.righe[0][iR]));
  verifica('e il resto della riga non cambia', rep.righe[0][0] === 'Puglia' && amm.righe[0][0] === 'Puglia' && rep.totale === 513.6 && amm.totale_euro === 513.6);
  // Il report dell'attiva non importa dalle librerie (la sua prova lo carica
  // senza alias): il nome e' scritto li', e deve restare quello di ecotyreTariffe.
  verifica('il nome scritto nel report e quello di FATTURANTE_ATTIVA',
    sorgente('src/lib/fatturazioneExport.js').includes(`const FATTURANTE = '${tariffe.FATTURANTE_ATTIVA}';`));
}

console.log('LE RIGHE NUOVE NASCONO GIA GIUSTE');
{
  const base = { stato: 'terminato', cer: '160103', classe: 'A', trasporto_finito_il: '2026-09-10T00:00:00.000Z' };
  const tar = [
    { id: 'r', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo' },
    { id: 'a', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', valore: 230, unita_misura: '€/t', stato: 'attivo' },
  ];
  const g = calcolaRigheAttiva({
    reteAll: [{ ...base, id: 'r1', id_ordine: 'ET1', numero_fir: 'F1', peso_effettivo: 1000 }],
    aciAll: [{ ...base, id: 'a1', id_ordine: 'EA1', numero_fir: 'FA1', peso_effettivo: 1000, classe: 'PFU Autodemolizione' }],
    extraAll: [{ ...base, id: 'x1', id_ordine: 'EX1', numero_fir: 'FX1', peso_effettivo: 1000, prezzo_attivo_t: 202, sovracosto_raccolta: 10 }],
    fornitori: [], tariffe: tar, anno: 2026, mese: 'Settembre',
  });
  const tutte = [...g.righe.RETE, ...g.righe.ACI, ...g.righe.EXTRA_RACCOLTA];
  verifica('rete, ACI ed extra raccolta: fatturante SMOCO Srl su ogni riga', tutte.length === 4 && tutte.every(r => r.fatturante === 'SMOCO Srl'), JSON.stringify(tutte.map(r => r.fatturante)));
}

console.log('NIENTE DIPENDE DA UN FATTURANTE ECOTYRE');
{
  // Prima di cambiare il nome si e' guardato che nessun codice lo confrontasse:
  // la prova lo tiene vero.
  const cartelle = ['base44/functions', 'base44/shared', 'src'];
  const trovati = [];
  const giro = (dir) => {
    for (const nome of readdirSync(join(radice, dir))) {
      const p = join(dir, nome);
      if (statSync(join(radice, p)).isDirectory()) { giro(p); continue; }
      if (!/\.(ts|js|jsx)$/.test(nome)) continue;
      const t = sorgente(p);
      if (/fatturante\s*[!=]==?\s*['"]ECOTYRE['"]|['"]ECOTYRE['"]\s*[!=]==?\s*\w*\.?fatturante/i.test(t)) trovati.push(p);
    }
  };
  for (const c of cartelle) giro(c);
  verifica('nessun confronto con fatturante ECOTYRE', trovati.length === 0, trovati.join(', '));
  verifica('e il dettaglio di una riga mostra il soggetto, non il campo salvato',
    sorgente('src/components/fatturazione/RigaDetailModal.jsx').includes('{FATTURANTE_ATTIVA}') && !sorgente('src/components/fatturazione/RigaDetailModal.jsx').includes('riga.fatturante'));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
