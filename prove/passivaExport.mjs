// Prova dell'export della fatturazione passiva (src/lib/passivaExport.js): i
// totali del foglio sono quelli del calcolo, un blocco per prestazione. npm run prove
// In fondo, il calcolo che l'export mostra: il viaggio misto diviso per peso,
// l'extra raccolta ai costi dell'intervento, le date obbligatorie.
import { calcolaPassivaMese, indiceMesePassiva, quoteViaggioMisto } from '../base44/shared/passivaCalcolo.ts';
import { eAci } from '../base44/shared/canaleSecondaria.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// la libreria importa xlsx e l'alias @: qui si prova la sola costruzione delle righe
const sorgente = (await import('node:fs')).readFileSync(new URL('../src/lib/passivaExport.js', import.meta.url), 'utf8')
  .replace("import * as XLSX from 'xlsx';", 'const XLSX = null;');
const { righePassiva } = await import('data:text/javascript;base64,' + Buffer.from(sorgente).toString('base64'));

const base = { stato: 'terminato', cer: '160103', classe: 'A' };
const dati = {
  primarieRete: [
    { ...base, id: '1', id_ordine: 'ET1', numero_fir: 'F1', peso_effettivo: 10000, trasporto_finito_il: '2026-06-10T00:00:00Z', trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', provincia: 'BA', tipo_destinazione: 'imp', automezzo: 'AA111AA' },
    { ...base, id: '2', id_ordine: 'ET2', numero_fir: 'F2', peso_effettivo: 2500, trasporto_finito_il: '2026-06-11T00:00:00Z', trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', provincia: 'BA', tipo_destinazione: 'imp', automezzo: 'AA111AA' },
  ],
  primarieAci: [], secondarieAll: [], extraRaccoltaAll: [],
  tariffeAll: [{ id: 't1', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Alfa s.r.l.', tipologia: 'RETE', valore: 60, unita_misura: '€/t' }, { id: 't2', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRATTAMENTO', fornitore_nome: 'Beta Impianti', tipologia: 'RETE', valore: 80, unita_misura: '€/t' }],
  fornitoriAll: [{ ragione_sociale: 'ALFA SRL', stato: 'attivo' }, { ragione_sociale: 'BETA IMPIANTI', stato: 'attivo' }],
};
const result = calcolaPassivaMese(dati, 2026, indiceMesePassiva('Giugno'), 'Giugno', 'RETE');
const tipi = [];
const righe = righePassiva(result, tipi);
const testo = righe.map(r => (r || []).join('|'));
verifica('in testa il canale, il mese e il totale del calcolo (750 + 1000)', righe[0][0] === 'RETE' && righe[0][1] === 'Giugno 2026' && righe[0][6] === 1750, JSON.stringify(righe[0]));
verifica('i tre blocchi del modello dell\'amministrazione', testo.some(t => t.startsWith('RACCOGLITORI|Totale [t]')) && testo.some(t => t.startsWith('IMPIANTI \\ STOCCAGGI')) && testo.some(t => t.startsWith('PRODUTTORE|TRASPORTATORE|DESTINATARIO')));
const iAlfa = righe.findIndex(r => r && r[0] === 'ALFA SRL');
verifica('fornitore col totale, poi il dettaglio con prezzo e importo', righe[iAlfa][1] === 12.5 && righe[iAlfa][5] === 750 && righe[iAlfa + 1][2] === 60 && righe[iAlfa + 1][3] === '€\\t' && righe[iAlfa + 1][5] === 750, JSON.stringify(righe.slice(iAlfa, iAlfa + 2)));
const totali = righe.filter(r => r && r[0] === 'Totale complessivo');
verifica('i totali dei blocchi sommano il totale in testa', totali.length === 3 && totali[0][5] === 750 && totali[1][5] === 1000 && totali[2][7] === 0 && totali[0][5] + totali[1][5] + totali[2][7] === righe[0][6]);
verifica('ogni riga sa in che blocco sta, per i formati', tipi.length === righe.length && tipi[0] === 'testa' && tipi[iAlfa] === 'blocco' && tipi[righe.findIndex(r => r && r[0] === 'PRODUTTORE')] === 'secondarie');

// ─── Il viaggio misto: rete e ACI sullo stesso camion (regola del 22/09/2026) ───
// «fai la proporzione in base al peso»: a viaggio l'importo si divide fra i
// canali in proporzione ai chili di ciascuno su quel viaggio, e le due parti
// fanno esattamente l'importo.
console.log('VIAGGIO MISTO');
const q = quoteViaggioMisto(100, 1000, 2000);
verifica('quote di un viaggio da 100 euro con 1 t rete e 2 t ACI: 33,33 + 66,67 = 100', q.RETE === 33.33 && q.ACI === 66.67 && Math.round((q.RETE + q.ACI) * 100) === 10000, JSON.stringify(q));
const q7 = quoteViaggioMisto(450, 7, 3);
verifica('quote con chili che non dividono il centesimo: la somma e\' sempre l\'importo', Math.round((q7.RETE + q7.ACI) * 100) === 45000 && q7.RETE === 315, JSON.stringify(q7));
verifica('senza chili la proporzione si fa sui formulari', quoteViaggioMisto(90, 0, 0, 2, 1).RETE === 60 && quoteViaggioMisto(90, 0, 0, 2, 1).ACI === 30);

const sec = (id, kg, giorno, targa, aci) => ({
  stato: 'terminato', cer: '160103', id, id_ordine: 'S' + id, numero_fir: 'FS' + id, peso_effettivo: kg,
  ordine_immesso_il: giorno, trasporto_iniziato_il: giorno, trasporto_finito_il: giorno,
  stoccaggio: 'NAPPI SUD', trasportatore: 'GAMMA TRASPORTI', destinazione: 'IRIGOM', tipo_destinazione: 'imp', automezzo: targa,
  ...(aci ? { classe: 'C', codice_prodotto: '.class9' } : { classe: 'A' }),
});
const secondarieMiste = [
  sec('1', 8000, '2026-06-03T00:00:00Z', 'AA111AA', false),  // viaggio misto: 8 t rete...
  sec('2', 2000, '2026-06-03T00:00:00Z', 'AA111AA', true),   // ...e 2 t ACI
  sec('3', 10000, '2026-06-04T00:00:00Z', 'AA111AA', false), // viaggio di sola rete
  sec('4', 5000, '2026-06-05T00:00:00Z', 'BB222BB', true),   // viaggio di sola ACI
];
const datiMisti = {
  primarieRete: [], primarieAci: [], secondarieAll: secondarieMiste, extraRaccoltaAll: [],
  tariffeAll: [{ id: 'ts', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRASPORTO_SECONDARIA', fornitore_nome: 'Gamma Trasporti', produttore: 'Nappi Sud', destinatario: 'Irigom', tipologia: 'TUTTE', valore: 450, unita_misura: '€/viaggio' }],
  fornitoriAll: [{ ragione_sociale: 'GAMMA TRASPORTI', stato: 'attivo' }],
};
verifica('le secondarie di prova si riconoscono per canale', eAci(secondarieMiste[1]) && !eAci(secondarieMiste[0]));
const vRete = calcolaPassivaMese(datiMisti, 2026, 5, 'Giugno', 'RETE');
const vAci = calcolaPassivaMese(datiMisti, 2026, 5, 'Giugno', 'ACI');
const rR = vRete.trasporti_secondaria[0].righe[0], rA = vAci.trasporti_secondaria[0].righe[0];
verifica('rete: un viaggio intero (450) e l\'80% del misto (360) = 810', rR.importo === 810 && rR.viaggi === 2 && rR.viaggi_interi === 1 && rR.viaggi_misti === 1 && rR.viaggi_quota === 1.8, JSON.stringify(rR));
verifica('aci: un viaggio intero (450) e il 20% del misto (90) = 540', rA.importo === 540 && rA.viaggi === 2 && rA.viaggi_interi === 1 && rA.viaggi_misti === 1 && rA.viaggi_quota === 1.2, JSON.stringify(rA));
verifica('le due viste insieme pagano i tre viaggi una volta sola: 1.350 euro', Math.round((rR.importo + rA.importo) * 100) === 3 * 450 * 100);
verifica('ogni vista ha le sue tonnellate; quelle dell\'altro canale solo del viaggio misto, fuori dal totale', rR.tonnellate === 18 && rR.tonnellate_altro_canale === 2 && rA.tonnellate === 7 && rA.tonnellate_altro_canale === 8
  && vRete.trasporti_secondaria[0].totale_tonnellate === 18 && vAci.trasporti_secondaria[0].totale_tonnellate === 7);
verifica('la nota della riga spiega il conto ed e\' un\'informazione', rR.nota_informativa === true && /1 viaggio intero a 450,00 €/.test(rR.note) && /0,8 viaggi, 360,00 €/.test(rR.note) && /8,00 t rete e 2,00 t ACI/.test(rR.note) && /passiva ACI/.test(rR.note)
  && /0,2 viaggi, 90,00 €/.test(rA.note) && /passiva RETE/.test(rA.note), rR.note + ' | ' + rA.note);
const nel = (vista) => righePassiva(vista).find(x => x && x[0] === 'NAPPI SUD');
verifica('nell\'export la nota breve del misto: quanti viaggi si pagano davvero', nel(vRete)[6] === 2 && nel(vRete)[7] === 810 && nel(vRete)[9] === '1 intero + 1 misto con l\'ACI, diviso per peso: 1,80 viaggi pagati'
  && nel(vAci)[9] === '1 intero + 1 misto con la rete, diviso per peso: 1,20 viaggi pagati', JSON.stringify([nel(vRete), nel(vAci)]));
verifica('il viaggio misto non e\' piu\' un\'anomalia', !vRete.anomalie.some(a => /misto/i.test(a.descrizione)) && !vAci.anomalie.some(a => /misto/i.test(a.descrizione)), JSON.stringify(vRete.anomalie.map(a => a.descrizione)));
const vSoloMisto = calcolaPassivaMese({ ...datiMisti, secondarieAll: secondarieMiste.slice(0, 2) }, 2026, 5, 'Giugno', 'ACI');
verifica('un canale che ha solo la sua quota di un misto: niente "zero viaggi", paga la quota', vSoloMisto.trasporti_secondaria[0].righe[0].importo === 90 && /nessun viaggio di soli formulari ACI/.test(vSoloMisto.trasporti_secondaria[0].righe[0].note));
// tre viaggi misti da un terzo: le quote arrotondate sommano comunque l'importo
const terzi = [1, 2, 3].flatMap(g => [sec(`r${g}`, 1000, `2026-06-1${g}T00:00:00Z`, 'CC333CC', false), sec(`a${g}`, 2000, `2026-06-1${g}T00:00:00Z`, 'CC333CC', true)]);
const tR = calcolaPassivaMese({ ...datiMisti, secondarieAll: terzi, tariffeAll: [{ ...datiMisti.tariffeAll[0], valore: 100 }] }, 2026, 5, 'Giugno', 'RETE').trasporti_secondaria[0].righe[0];
const tA = calcolaPassivaMese({ ...datiMisti, secondarieAll: terzi, tariffeAll: [{ ...datiMisti.tariffeAll[0], valore: 100 }] }, 2026, 5, 'Giugno', 'ACI').trasporti_secondaria[0].righe[0];
verifica('tre misti da 100 euro divisi a un terzo: 99,99 + 200,01 = 300', tR.importo === 99.99 && tA.importo === 200.01, `${tR.importo} + ${tA.importo}`);
const aTon = calcolaPassivaMese({ ...datiMisti, tariffeAll: [{ ...datiMisti.tariffeAll[0], valore: 20, unita_misura: '€/t' }] }, 2026, 5, 'Giugno', 'ACI').trasporti_secondaria[0].righe[0];
verifica('a tonnellata ogni canale paga i suoi chili: 7 t x 20 = 140, con la nota informativa', aTon.importo === 140 && aTon.nota_informativa === true && /ogni canale paga i suoi chili/.test(aTon.note), JSON.stringify(aTon));

// Una tariffa a viaggio della sola RETE, senza TUTTE, su una tratta dove viaggia
// anche l'ACI (revisione del 22/09/2026): la rete paga la sua quota del misto, e
// la quota ACI non ha un prezzo. Prima la nota della rete diceva che il resto
// stava nella passiva ACI, e la passiva ACI diceva solo "tratta senza tariffa":
// 90 euro non si pagavano da nessuna parte e nessuno lo diceva.
console.log('VIAGGIO MISTO CON LA SOLA TARIFFA DI RETE');
const soloRete = [{ ...datiMisti.tariffeAll[0], id: 'ts-rete', tipologia: 'RETE' }];
const datiSoloRete = { ...datiMisti, secondarieAll: secondarieMiste.slice(0, 2), tariffeAll: soloRete };
const sR = calcolaPassivaMese(datiSoloRete, 2026, 5, 'Giugno', 'RETE');
const sA = calcolaPassivaMese(datiSoloRete, 2026, 5, 'Giugno', 'ACI');
const rigaSR = sR.trasporti_secondaria[0].righe[0];
verifica('rete: paga la sua quota del misto, 360 euro', rigaSR.importo === 360 && rigaSR.viaggi_quota === 0.8, JSON.stringify(rigaSR));
verifica('rete: la nota non dice piu\' che il resto sta nella passiva ACI, dice che resta da pagare e quanto', !/sta nella passiva ACI/.test(rigaSR.note)
  && /La quota ACI del viaggio misto \(0,2 viaggi, 90,00 € a questa tariffa\) non ha una tariffa ACI o TUTTE per la tratta e resta da pagare\./.test(rigaSR.note)
  && rigaSR.nota_informativa === false, rigaSR.note);
verifica('rete: la quota scoperta sta nella riga, fuori dai totali', JSON.stringify(rigaSR.altro_canale_da_pagare) === JSON.stringify({ canale: 'ACI', viaggi_misti: 1, viaggi_quota: 0.2, tonnellate: 2, importo: 90 })
  && sR.trasporti_secondaria[0].totale_euro === 360 && sR.trasporti_secondaria[0].totale_tonnellate === 8, JSON.stringify(rigaSR.altro_canale_da_pagare));
const anSA = sA.anomalie.find(a => /Tratta secondaria senza tariffa/.test(a.descrizione));
verifica('aci: nessuna riga pagata, e l\'anomalia dice la quota scoperta con l\'importo alla tariffa di rete', sA.trasporti_secondaria.length === 0 && !!anSA
  && /Sul viaggio misto con la rete la passiva RETE paga solo la quota di rete dei chili: la quota ACI \(0,2 viaggi, 2,00 t\) resta da pagare, 90,00 € alla tariffa di rete della tratta \(450,00 €\/viaggio\), finche' la tratta non ha una tariffa ACI o TUTTE/.test(anSA.descrizione)
  && anSA.viaggi_misti === 1 && anSA.viaggi_quota === 0.2 && anSA.importo_da_pagare === 90 && anSA.tonnellate === 2, JSON.stringify(anSA));
verifica('le due viste dicono lo stesso importo scoperto: 360 pagati + 90 da pagare = 450', rigaSR.importo + rigaSR.altro_canale_da_pagare.importo === 450 && anSA.importo_da_pagare === rigaSR.altro_canale_da_pagare.importo);
verifica('nell\'export la nota breve dice anche la quota da pagare', nel(sR)[9] === '0 interi + 1 misto con l\'ACI, diviso per peso: 0,80 viaggi pagati; quota ACI di 1 misto senza tariffa ACI o TUTTE: 90,00 € da pagare', String(nel(sR)[9]));
// con tutti e quattro i viaggi: la rete paga i suoi (810), l'ACI resta senza
// prezzo per 7 t, e della quota scoperta si dice solo quella del misto
const sA4 = calcolaPassivaMese({ ...datiMisti, tariffeAll: soloRete }, 2026, 5, 'Giugno', 'ACI');
const anSA4 = sA4.anomalie.find(a => /Tratta secondaria senza tariffa/.test(a.descrizione));
verifica('aci con un suo viaggio intero: l\'anomalia porta le 7 t del canale e i 90 euro del misto', calcolaPassivaMese({ ...datiMisti, tariffeAll: soloRete }, 2026, 5, 'Giugno', 'RETE').trasporti_secondaria[0].righe[0].importo === 810
  && anSA4.tonnellate === 7 && anSA4.importo_da_pagare === 90, JSON.stringify(anSA4));
// con la sua tariffa anche l'ACI: il resto sta davvero nella passiva ACI, al prezzo ACI
const conAci = [...soloRete, { ...soloRete[0], id: 'ts-aci', tipologia: 'ACI', valore: 500 }];
const cR = calcolaPassivaMese({ ...datiMisti, tariffeAll: conAci }, 2026, 5, 'Giugno', 'RETE').trasporti_secondaria[0].righe[0];
const cA = calcolaPassivaMese({ ...datiMisti, tariffeAll: conAci }, 2026, 5, 'Giugno', 'ACI').trasporti_secondaria[0].righe[0];
verifica('tariffe RETE 450 e ACI 500: la rete 450 + 360, l\'ACI 500 + 100, e nessuna quota scoperta', cR.importo === 810 && cA.importo === 600 && /sta nella passiva ACI/.test(cR.note) && cR.nota_informativa === true && cR.altro_canale_da_pagare === null && cA.altro_canale_da_pagare === null, `${cR.importo} ${cA.importo} ${cR.note}`);
// a tonnellata, con la sola tariffa di rete: i chili ACI del misto restano da pagare
const tonR = calcolaPassivaMese({ ...datiSoloRete, tariffeAll: [{ ...soloRete[0], valore: 20, unita_misura: '€/t' }] }, 2026, 5, 'Giugno', 'RETE');
const tonA = calcolaPassivaMese({ ...datiSoloRete, tariffeAll: [{ ...soloRete[0], valore: 20, unita_misura: '€/t' }] }, 2026, 5, 'Giugno', 'ACI');
const rigaTon = tonR.trasporti_secondaria[0].righe[0];
verifica('a tonnellata con la sola rete: la rete paga 8 t x 20 e dice le 2 t ACI da pagare', rigaTon.importo === 160 && /La quota ACI del viaggio misto \(2,00 t, 40,00 € a questa tariffa\) non ha una tariffa ACI o TUTTE per la tratta e resta da pagare\./.test(rigaTon.note)
  && rigaTon.altro_canale_da_pagare.importo === 40 && rigaTon.altro_canale_da_pagare.viaggi_quota === null, rigaTon.note);
verifica('...e l\'anomalia ACI dice 40 euro alla tariffa di rete', tonA.anomalie.some(a => /la quota ACI \(2,00 t\) resta da pagare, 40,00 € alla tariffa di rete della tratta \(20,00 €\/t\)/.test(a.descrizione) && a.importo_da_pagare === 40), JSON.stringify(tonA.anomalie.map(a => a.descrizione)));

// ─── Extra raccolta: i costi sono quelli scritti sull'intervento (22/09/2026) ───
console.log('EXTRA RACCOLTA');
const intervento = (id, altro = {}) => ({
  stato: 'terminato', cer: '160103', classe: 'A', id, id_ordine: 'EX' + id, numero_fir: 'FX' + id, peso_effettivo: 2000,
  ordine_immesso_il: '2026-06-01T00:00:00Z', trasporto_iniziato_il: '2026-06-08T00:00:00Z', trasporto_finito_il: '2026-06-08T00:00:00Z',
  trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', tipo_destinazione: 'imp', provincia: 'BA', automezzo: 'AA111AA',
  costo_raccolta_t: 0, costo_trattamento_t: 0, costo_stoccaggio_t: 0, ...altro,
});
const tariffeRete = dati.tariffeAll; // RACCOLTA 60 e TRATTAMENTO 80, solo RETE
const datiExtra = (extra, tariffeAll = tariffeRete) => ({ ...dati, primarieRete: [], extraRaccoltaAll: extra, tariffeAll });
const e0 = calcolaPassivaMese(datiExtra([intervento('1')]), 2026, 5, 'Giugno', 'EXTRA_RACCOLTA');
verifica('costi a zero sull\'intervento: si paga zero, mai la tariffa di rete', e0.totali.raccoglitori === 0 && e0.totali.impianti_stoccaggi === 0 && e0.raccoglitori[0].righe[0].tariffa_valore === 0, JSON.stringify(e0.totali));
verifica('il contratto di rete non fa nemmeno scattare l\'avviso "costo zero"', !e0.anomalie.some(a => /costo di (raccolta|trattamento) e' zero/.test(a.descrizione)), JSON.stringify(e0.anomalie.map(a => a.descrizione)));
const tariffeExtra = [...tariffeRete,
  { id: 'e1', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Alfa s.r.l.', tipologia: 'EXTRA_RACCOLTA', valore: 70, unita_misura: '€/t' },
  { id: 'e2', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRATTAMENTO', fornitore_nome: 'Beta Impianti', tipologia: 'EXTRA_RACCOLTA', valore: 95, unita_misura: '€/t' }];
const e1 = calcolaPassivaMese(datiExtra([intervento('1')], tariffeExtra), 2026, 5, 'Giugno', 'EXTRA_RACCOLTA');
verifica('costo zero ma un contratto di extra raccolta lo prevede: si segnala col suo prezzo', e1.anomalie.some(a => /raccolta e' zero/.test(a.descrizione) && /contratto di extra raccolta prevede 70/.test(a.descrizione)) && e1.anomalie.some(a => /trattamento e' zero/.test(a.descrizione) && /prevede 95/.test(a.descrizione)) && e1.totali.totale_complessivo === 0);
const e2 = calcolaPassivaMese(datiExtra([intervento('1', { costo_raccolta_t: 55, costo_trattamento_t: 30 })], tariffeExtra), 2026, 5, 'Giugno', 'EXTRA_RACCOLTA');
verifica('costi scritti sull\'intervento: si pagano quelli (2 t x 55 e 2 t x 30), non i contratti', e2.totali.raccoglitori === 110 && e2.totali.impianti_stoccaggi === 60 && !e2.anomalie.some(a => /prevede/.test(a.descrizione)), JSON.stringify(e2.totali));
const eA = calcolaPassivaMese(datiExtra([intervento('1', { costo_raccolta_t: 55 }), intervento('2', { stato: 'assegnato', costo_raccolta_t: 55 })]), 2026, 5, 'Giugno', 'EXTRA_RACCOLTA');
verifica('in passiva entra solo il terminato, anche se l\'assegnato ha gia\' la fine trasporto', eA.totali.raccoglitori === 110 && eA.quadratura.tonnellate_totali === 2, JSON.stringify(eA.totali));
const eL = calcolaPassivaMese(datiExtra([intervento('1', { costo_raccolta_t: 55, trasporto_finito_il: '2026-06-30T22:30:00Z' })]), 2026, 5, 'Giugno', 'EXTRA_RACCOLTA');
verifica('il mese e\' quello della fine trasporto sul giorno italiano: il 1 luglio alle 00:30 e\' luglio', eL.totali.raccoglitori === 0 && calcolaPassivaMese(datiExtra([intervento('1', { costo_raccolta_t: 55, trasporto_finito_il: '2026-06-30T22:30:00Z' })]), 2026, 6, 'Luglio', 'EXTRA_RACCOLTA').totali.raccoglitori === 110);

// ─── Le date obbligatorie dei formulari (22/09/2026) ───
console.log('DATE OBBLIGATORIE');
const senzaFine = { ...dati.primarieRete[0], id: '9', id_ordine: 'ET9', numero_fir: 'F9', ordine_immesso_il: '2026-06-02T00:00:00Z', trasporto_iniziato_il: '2026-06-03T00:00:00Z', trasporto_finito_il: null };
const dR = calcolaPassivaMese({ ...dati, primarieRete: [...dati.primarieRete, senzaFine] }, 2026, 5, 'Giugno', 'RETE');
const aSF = dR.anomalie.find(a => a.tipo === 'date_senza_fine');
verifica('terminato senza fine trasporto: fuori dal mese (si paga lo stesso 1.750)', dR.totali.totale_complessivo === 1750, String(dR.totali.totale_complessivo));
verifica('...ma fra le anomalie del canale, con quanti e quali', !!aSF && aSF.quanti === 1 && aSF.ordini[0].ordine === 'ET9' && /ET9/.test(aSF.descrizione) && aSF.fornitore === 'Rete' && aSF.tonnellate === 10, JSON.stringify(aSF));
const aDS = dR.anomalie.find(a => a.tipo === 'date_da_sistemare');
verifica('i terminati del mese senza immissione e inizio trasporto si segnalano', !!aDS && aDS.quanti === 2 && /mancano le date di immissione e inizio trasporto/.test(aDS.descrizione), JSON.stringify(aDS));
const dA = calcolaPassivaMese({ ...dati, primarieRete: [...dati.primarieRete, senzaFine] }, 2026, 5, 'Giugno', 'ACI');
verifica('la vista ACI non si porta dietro le date della rete', !dA.anomalie.some(a => String(a.tipo || '').startsWith('date_')));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
