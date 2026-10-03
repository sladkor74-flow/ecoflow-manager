import * as XLSX from 'xlsx';
import { formattaPesi } from '@/lib/formatoExcel';
import { esportaTabellaPdf } from '@/lib/esportaTabella';
import { foglioPassiva } from '@/lib/passivaAmministrazione';

// LA PASSIVA NEL «FORMAT AMMINISTRAZIONE»: i file.
//
// Due modi, tutti e due chiesti dall'utente il 03/10/2026 («falli in entrambi i
// modi»):
//   UN FOGLIO SOLO   i tre blocchi uno sotto l'altro, com'e' nel suo file
//                    «Fatturazione passiva Ecotyre (settembre).xlsx»;
//   UN FOGLIO PER CANALE  piu' comodo da leggere e da stampare.
// Le righe sono le stesse: cambia solo come stanno nel file. La costruzione e'
// una sola (src/lib/passivaAmministrazione.js), quindi i due file non possono
// dire cose diverse.
//
// L'EER 160103 e' quello dei PFU e nel foglio dell'amministrazione sta sulla
// riga del soggetto, non su quella delle voci: si riporta uguale.

const EER_PFU = 160103;
const NOMI = { RETE: 'RETE', ACI: 'ACI', EXTRA_RACCOLTA: 'EXTRA RACCOLTA' };

/** Le righe di un blocco come vanno scritte nel foglio. */
function righeBlocco(titolo, blocco, etichettaPrezzo) {
  const out = [[titolo, 'Totale [t]', etichettaPrezzo, 'EER', 'TOTALE']];
  for (const r of blocco.righe) {
    if (r.tipo === 'soggetto') out.push([r.soggetto, r.tonnellate, null, EER_PFU, null]);
    // La voce senza nome e' il caso del fornitore con una riga sola: nel foglio
    // dell'amministrazione resta vuota, e il numero sta li' sotto il soggetto.
    else out.push([r.voce || null, r.tonnellate, r.prezzo, null, r.totale]);
  }
  out.push(['Totale complessivo', blocco.totale_t, null, null, blocco.totale_euro]);
  return out;
}

/** Le righe del trasporto delle secondarie: un viaggio per riga. */
function righeTrasporto(canale, trasporti) {
  const out = [[`TRASPORTO (secondarie ${NOMI[canale] || canale})`]];
  out.push(['PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO', 'PESO [t]', "UNITA' DI MISURA", 'COSTO', 'nr. di viaggi', 'TOTALE']);
  for (const t of trasporti.righe) {
    out.push([t.produttore, t.trasportatore, t.destinatario, t.tonnellate, t.unita_misura === 'euro_viaggio' ? '€\\vg' : '€\\t', t.prezzo, t.viaggi || null, t.totale]);
  }
  out.push([null, null, null, trasporti.totale_t, null, null, null, trasporti.totale_euro]);
  return out;
}

/** Il blocco intero di un canale, intestazione compresa. */
export function bloccoFoglio(f) {
  const righe = [];
  righe.push([NOMI[f.canale] || f.canale, f.mese, null, null, f.totale_euro]);
  righe.push([]);
  righe.push(...righeBlocco('RACCOGLITORI', f.raccoglitori, 'Costo di Raccolta [€\\t]'));
  righe.push([]);
  righe.push(...righeBlocco('IMPIANTI \\ STOCCAGGI', f.impianti, 'Costo [€\\t]'));
  righe.push([]);
  righe.push(...righeTrasporto(f.canale, f.trasporti));
  // Chi ha movimenti e non sta nel modello si dice qui, in fondo al suo blocco:
  // non si butta via e non gli si inventa un prezzo.
  const fuori = [...f.raccoglitori.non_previsti, ...f.impianti.non_previsti];
  if (fuori.length) {
    righe.push([]);
    righe.push(['NON PREVISTI DAL MODELLO: hanno movimenti nel mese e nessuna voce. Aggiungili al modello.']);
    for (const x of fuori) righe.push([x.soggetto, x.tonnellate]);
  }
  return righe;
}

// IL FOGLIO SI DEVE POTER LEGGERE E STAMPARE.
//
// L'utente, 03/10/2026: «il foglio excel dovrebbe essere un po' piu'
// professionale». SheetJS nella versione che usiamo non sa scrivere i grassetti
// ne' i colori, ma sa fare le tre cose che contano davvero su un foglio di
// numeri: le LARGHEZZE delle colonne (altrimenti i nomi dei fornitori si
// tagliano e gli euro diventano ####), il FORMATO dei numeri (migliaia e due
// decimali, non 6064.240000000001) e il BLOCCO delle prime righe, cosi' le
// intestazioni restano a video mentre si scorre.
function impagina(XLSX, ws, quante) {
  ws["!cols"] = [
    { wch: 42 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 14 },
    { wch: 16 }, { wch: 12 }, { wch: 14 },
  ];
  // Le colonne dei soldi e dei pesi: niente code di decimali.
  const r = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let R = r.s.r; R <= r.e.r; R++) {
    for (let C = r.s.c; C <= r.e.c; C++) {
      const c = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (!c || c.t !== 'n') continue;
      // L'EER non e' un numero da formattare: e' un codice.
      if (c.v === EER_PFU) { c.z = "0"; continue; }
      c.z = Number.isInteger(c.v) ? "#,##0" : "#,##0.00";
    }
  }
  if (quante) ws["!freeze"] = { xSplit: 0, ySplit: quante };
  return ws;
}

export const nomeFilePassiva = (anno, mese, come, estensione) =>
  `Format_amministrazione_PASSIVA${come === 'canali' ? '_per_canale' : ''}_${mese}_${anno}.${estensione}`;

/**
 * UN FOGLIO SOLO, i canali uno sotto l'altro: e' la copia del file che usa
 * l'amministrazione.
 */
export function exportPassivaUnFoglio(fogli, anno, mese) {
  const righe = [];
  for (const f of fogli) {
    if (righe.length) { righe.push([]); righe.push([]); }
    righe.push(...bloccoFoglio(f));
  }
  const ws = XLSX.utils.aoa_to_sheet(righe);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, impagina(XLSX, formattaPesi(XLSX, ws), 1), 'PASSIVA');
  XLSX.writeFile(wb, nomeFilePassiva(anno, mese, 'unico', 'xlsx'));
}

/** UN FOGLIO PER CANALE, nella stessa cartella di lavoro. */
export function exportPassivaPerCanale(fogli, anno, mese) {
  const wb = XLSX.utils.book_new();
  for (const f of fogli) {
    const ws = XLSX.utils.aoa_to_sheet(bloccoFoglio(f));
    XLSX.utils.book_append_sheet(wb, impagina(XLSX, formattaPesi(XLSX, ws), 1), (NOMI[f.canale] || f.canale).slice(0, 31));
  }
  XLSX.writeFile(wb, nomeFilePassiva(anno, mese, 'canali', 'xlsx'));
}

/**
 * Il PDF: un blocco per canale, con le due tabelle e il trasporto. Le colonne
 * sono quelle del foglio, cosi' carta e Excel dicono le stesse cose.
 */
export async function exportPassivaPdf(fogli, anno, mese) {
  const righe = [];
  for (const f of fogli) {
    righe.push([`— ${NOMI[f.canale] || f.canale} —`, '', '', '', f.totale_euro]);
    for (const [titolo, blocco] of [['RACCOGLITORI', f.raccoglitori], ['IMPIANTI \\ STOCCAGGI', f.impianti]]) {
      righe.push([titolo, '', '', '', '']);
      for (const r of blocco.righe) {
        righe.push(r.tipo === 'soggetto'
          ? [r.soggetto, r.tonnellate, '', '', r.totale]
          : [`    ${r.voce || ''}`, r.tonnellate, r.prezzo, '', r.totale]);
      }
      righe.push(['Totale complessivo', blocco.totale_t, '', '', blocco.totale_euro]);
    }
    righe.push([`TRASPORTO (secondarie ${NOMI[f.canale] || f.canale})`, '', '', '', '']);
    for (const t of f.trasporti.righe) righe.push([`    ${t.produttore} → ${t.destinatario} (${t.trasportatore})`, t.tonnellate, t.prezzo, t.viaggi || '', t.totale]);
    righe.push(['Totale trasporto', f.trasporti.totale_t, '', '', f.trasporti.totale_euro]);
  }
  await esportaTabellaPdf({
    nomeFile: nomeFilePassiva(anno, mese, 'unico', 'pdf').replace(/\.pdf$/, ''),
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  FORMAT AMMINISTRAZIONE',
    titolo: `Fatturazione passiva — ${mese} ${anno}`,
    sottotitolo: fogli.map(f => `${NOMI[f.canale] || f.canale} ${f.totale_euro.toLocaleString('it-IT')} €`).join('  ·  '),
    colonne: [
      { titolo: 'Voce', tipo: 'testo', peso: 3, valore: (r) => r[0] },
      { titolo: 'Totale [t]', tipo: 'numero', peso: 1, valore: (r) => r[1] },
      { titolo: 'Costo', tipo: 'euro', peso: 1, valore: (r) => r[2] },
      { titolo: 'Viaggi', tipo: 'numero', peso: 0.7, valore: (r) => r[3] },
      { titolo: 'TOTALE', tipo: 'euro', peso: 1.2, valore: (r) => r[4] },
    ],
    righe,
  });
}

/** I fogli dei canali chiesti, costruiti dalle voci e dalla passiva gia' calcolata. */
export function fogliDa(voci, passivePerCanale, mese) {
  return Object.entries(passivePerCanale || {})
    .filter(([, p]) => p)
    .map(([canale, p]) => foglioPassiva(voci, p, canale, mese));
}
