// Prova di DOVE ENTRA UN MOVIMENTO E DI COME SI LEGGONO LE DICHIARAZIONI, 11/10/2026.
//
// Chiusura dell'audit del 10/10/2026. Giacenze e Dichiarazioni Impianti devono
// dire gli stessi numeri su tutti e tre i canali (regola dell'utente,
// 03/10/2026), ma ciascuno decideva da se' due cose che li separavano:
//   - DOVE ENTRA UN MOVIMENTO: chi lo riceve, con che ruolo, su che canale. Le
//     Dichiarazioni non guardavano il tipo di destinazione delle secondarie, e
//     una secondaria arrivata al piazzale di un sito che e' anche impianto stava
//     sul piazzale in un modulo e sull'impianto nell'altro (C2, C9). Ora lo dice
//     shared/ingressoMovimento.ts, e i due moduli lo chiedono a lui;
//   - IL DICHIARATO CARICATO di un sito: le Giacenze sommavano tutte le righe,
//     il riepilogo le univa mese per mese (C4). Ora c'e' leggiDichiarazioni, in
//     shared/dichiarazioniImpianti.ts (con lo specchio nel browser).
// Qui le due funzioni da sole; i due moduli interi li confronta
// prove/dueModuliStessiNumeri.mjs.
// npm run prove
import { readFileSync } from 'node:fs';
import { ingressoMovimento, eSecondariaExtra } from '../base44/shared/ingressoMovimento.ts';
import * as dichiarazioni from '../base44/shared/dichiarazioniImpianti.ts';
import { normalizzaRagioneSociale } from '../base44/shared/normalizzaRagioneSociale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const norm = normalizzaRagioneSociale;
const dove = (r, archivio) => ingressoMovimento(r, archivio, norm);
const testo = (x) => JSON.stringify(x);

console.log('LE PRIMARIE: IL RUOLO DAL TIPO DI DESTINAZIONE, IL CANALE DAL MATERIALE');
{
  const imp = dove({ destinazione: 'Irigom S.r.l.', tipo_destinazione: 'imp', prodotto: '.class1' }, 'PrimariaRete');
  verifica('una primaria di rete all\'impianto', imp.tipo === 'primaria' && imp.canale === 'RETE' && imp.arrivo.ruolo === 'imp' && imp.partenza === null && !imp.senza_tipo, testo(imp));
  verifica('la chiave e\' quella di chi chiama', imp.arrivo.chiave === norm('IRIGOM SRL') && imp.arrivo.sito === 'Irigom S.r.l.', testo(imp.arrivo));
  const stoc = dove({ destinazione: 'NAPPI SUD SRL', tipo_destinazione: ' STOC ', prodotto: '.class1' }, 'PrimariaRete');
  verifica('al piazzale, anche scritto in maiuscolo e con gli spazi', stoc.arrivo.ruolo === 'stoc', testo(stoc));
  const nove = dove({ destinazione: 'GATIM SRL', tipo_destinazione: 'imp', classe: 'PFU Autodemolizione', prodotto: '.class9' }, 'PrimariaRete');
  verifica('una classe 9 nell\'archivio della rete e\' ACI: decide il materiale', nove.canale === 'ACI', testo(nove));
  verifica('una primaria ACI e\' ACI', dove({ destinazione: 'GATIM SRL', tipo_destinazione: 'imp' }, 'PrimariaAci').canale === 'ACI');
  const senza = dove({ destinazione: 'GATIM SRL', prodotto: '.class1' }, 'PrimariaRete');
  verifica('senza tipo di destinazione e\' dell\'impianto, e si dice', senza.arrivo.ruolo === 'imp' && senza.senza_tipo === true, testo(senza));
  verifica('senza destinazione non arriva a nessuno', dove({ destinazione: '  ', tipo_destinazione: 'imp' }, 'PrimariaRete').arrivo === null);
  const extra = dove({ destinazione: 'NAPPI SUD SRL', tipo_destinazione: 'stoc', tipo_movimento: 'primaria' }, 'ExtraRaccolta');
  verifica('una primaria di extra raccolta al piazzale', extra.tipo === 'primaria' && extra.canale === 'EXTRA_RACCOLTA' && extra.arrivo.ruolo === 'stoc' && extra.partenza === null, testo(extra));
  verifica('un intervento di extra raccolta senza tipo di movimento e\' una primaria', dove({ destinazione: 'ALFA SRL', tipo_destinazione: 'imp' }, 'ExtraRaccolta').tipo === 'primaria');
}

console.log('LE SECONDARIE: ARRIVANO DOVE DICE IL TIPO DI DESTINAZIONE');
{
  const alPiazzale = dove({ stoccaggio: 'NAPPI SUD SRL', destinazione: 'Irigom S.r.l.', tipo_destinazione: 'stoc', prodotto: '.class1' }, 'Secondaria');
  verifica('al piazzale di un sito che e\' anche impianto: sul piazzale (C2)', alPiazzale.tipo === 'secondaria' && alPiazzale.arrivo.ruolo === 'stoc' && alPiazzale.canale === 'RETE', testo(alPiazzale));
  verifica('e parte dal piazzale che la spedisce', alPiazzale.partenza && alPiazzale.partenza.ruolo === 'stoc' && alPiazzale.partenza.chiave === norm('NAPPI SUD SRL'), testo(alPiazzale.partenza));
  const aci = dove({ stoccaggio: 'NAPPI SUD SRL', destinazione: 'Irigom S.r.l.', tipo_destinazione: 'imp', classe: 'PFU Autodemolizione', prodotto: '.class9' }, 'Secondaria');
  verifica('una secondaria di classe 9 e\' ACI, all\'impianto', aci.canale === 'ACI' && aci.arrivo.ruolo === 'imp', testo(aci));
  const ex = dove({ stoccaggio: 'NAPPI SUD SRL', destinazione: 'BETA STOCCAGGI SRL', tipo_destinazione: 'stoc', tipo_movimento: ' Secondaria ' }, 'ExtraRaccolta');
  verifica('una secondaria di extra raccolta a un piazzale puro: sul piazzale, non un impianto (C9)', ex.tipo === 'secondaria' && ex.canale === 'EXTRA_RACCOLTA' && ex.arrivo.ruolo === 'stoc' && ex.partenza.ruolo === 'stoc', testo(ex));
  verifica('eSecondariaExtra riconosce il trasferimento, non la primaria', eSecondariaExtra({ tipo_movimento: 'SECONDARIA' }) && !eSecondariaExtra({ tipo_movimento: 'primaria' }) && !eSecondariaExtra({}) && !eSecondariaExtra(null));
  verifica('senza stoccaggio non parte da nessuno', dove({ destinazione: 'ALFA SRL', tipo_destinazione: 'imp' }, 'Secondaria').partenza === null);
}

console.log('LE TERZIARIE: NON SONO UN CANALE');
{
  const t = dove({ unita_locale_origine: 'Irigom S.r.l.', ragione_sociale: 'IRIGOM SRL', destinazione: 'CEMENTERIA SPA' }, 'Terziaria');
  verifica('il gruppo e\' TERZIARIE, mai la rete (C3, C11)', t.tipo === 'terziaria' && t.canale === 'TERZIARIE', testo(t));
  verifica('non arrivano a nessuno dei nostri, partono dall\'impianto', t.arrivo === null && t.partenza && t.partenza.ruolo === 'imp' && t.partenza.sito === 'Irigom S.r.l.', testo(t));
  verifica('senza unita\' locale vale la ragione sociale', dove({ ragione_sociale: 'INNOREC SRL' }, 'Terziaria').partenza.chiave === norm('INNOREC SRL'));
}

console.log('LE DICHIARAZIONI MENSILI: UNA LETTURA SOLA PER I DUE MODULI (C4)');
{
  const { leggiDichiarazioni } = dichiarazioni;
  verifica('leggiDichiarazioni c\'e\'', typeof leggiDichiarazioni === 'function');
  if (typeof leggiDichiarazioni === 'function') {
    const righe = [
      // Due ACI gemelle di aprile, tutte e due caricate, col nome scritto in due modi.
      { id: 'a', sito: 'ALFA RECYCLING SRL', anno: 2026, mese: 'Aprile', canale: 'ACI', provenienza: 'primaria', quantita_kg: 2000, caricata_inviata: true },
      { id: 'b', sito: 'Alfa Recycling S.r.l.', anno: 2026, mese: 'Aprile', canale: 'ACI', provenienza: 'primaria', quantita_kg: 2000, caricata_inviata: true },
      // Due campagne di extra raccolta nello stesso mese, una sola caricata.
      { id: 'c', sito: 'ALFA RECYCLING SRL', anno: 2026, mese: 'Maggio', canale: 'EXTRA_RACCOLTA', provenienza: '', quantita_kg: 300, caricata_inviata: true },
      { id: 'd', sito: 'ALFA RECYCLING SRL', anno: 2026, mese: 'Maggio', canale: 'EXTRA_RACCOLTA', provenienza: '', quantita_kg: 200, caricata_inviata: false },
      // Una rete caricata e una no, e una dell'anno prima.
      { id: 'e', sito: 'ALFA RECYCLING SRL', anno: 2026, mese: 'Marzo', canale: 'RETE', provenienza: '', quantita_kg: 12000, caricata_inviata: true },
      { id: 'f', sito: 'ALFA RECYCLING SRL', anno: 2026, mese: 'Giugno', canale: 'RETE', provenienza: '', quantita_kg: 7000, caricata_inviata: false },
      { id: 'g', sito: 'ALFA RECYCLING SRL', anno: 2025, mese: 'Dicembre', canale: 'RETE', provenienza: '', quantita_kg: 9000, caricata_inviata: true },
    ];
    const l = leggiDichiarazioni(righe, { anno: 2026, chiaveDi: norm });
    const ns = norm('ALFA RECYCLING SRL');
    verifica('di una gemella ACI si tiene la prima: 2 t, non 4', l.kgCaricati(ns, 'ACI') === 2000, String(l.kgCaricati(ns, 'ACI')));
    verifica('e si sa che ce n\'e\' un\'altra', (l.perChiave.get(`${ns}|ACI|primaria|Aprile`) || {}).altre?.join() === 'b', testo(l.perChiave.get(`${ns}|ACI|primaria|Aprile`)));
    verifica('dell\'extra si sommano le campagne, ma caricato e\' solo quello che e\' a portale: 300 kg', l.kgCaricati(ns, 'EXTRA_RACCOLTA') === 300, String(l.kgCaricati(ns, 'EXTRA_RACCOLTA')));
    verifica('la rete: solo il caricato, e solo dell\'anno chiesto', l.kgCaricati(ns, 'RETE') === 12000 && l.kgCaricati(ns) === 12000, String(l.kgCaricati(ns, 'RETE')));
    verifica('un sito che non c\'e\' ha zero caricato', l.kgCaricati(norm('GATIM SRL'), 'RETE') === 0);
    // La stessa lettura del riepilogo, mese per mese: unisciDichiarazioni per chiave, poi kgCaricatiDi.
    const aMano = new Map();
    for (const r of righe.filter(x => x.anno === 2026)) {
      const k = dichiarazioni.chiaveDichiarazione(r, norm);
      aMano.set(k, dichiarazioni.unisciDichiarazioni(aMano.get(k), r));
    }
    const perCanale = (c) => [...aMano.entries()].filter(([k]) => k.split('|')[1] === c).reduce((s, [, x]) => s + dichiarazioni.kgCaricatiDi(x), 0);
    verifica('e\' la stessa regola del riepilogo, su tutti e tre i canali', ['RETE', 'ACI', 'EXTRA_RACCOLTA'].every(c => perCanale(c) === l.kgCaricati(ns, c)),
      ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => `${c} ${perCanale(c)}/${l.kgCaricati(ns, c)}`).join(' '));
  }
}

console.log('I DUE MODULI CHIEDONO, NON DECIDONO');
{
  // Le due funzioni si leggono senza i ritorni a capo di Windows: i file
  // dell'albero di lavoro possono essere CRLF.
  const leggi = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r/g, '');
  const giacenze = leggi('../base44/functions/calcolaGiacenze/entry.ts');
  const riepilogo = leggi('../base44/functions/riepilogoDichiarazioni/entry.ts');
  for (const [nome, s] of [['Giacenze', giacenze], ['Dichiarazioni', riepilogo]]) {
    verifica(`${nome}: dove entra un movimento lo chiede a ingressoMovimento`, /import \{[^}]*\bingressoMovimento\b[^}]*\} from "\.\.\/\.\.\/shared\/ingressoMovimento\.ts"/.test(s));
    verifica(`${nome}: le dichiarazioni mensili le legge con leggiDichiarazioni`, /\bleggiDichiarazioni\(/.test(s));
  }
  verifica('le Dichiarazioni non segnano piu\' le terziarie come rete', !/tipo: 'terziaria', canale: 'RETE'/.test(riepilogo));
  verifica('le Giacenze non sommano piu\' a mano le dichiarazioni caricate', !/dichiaratoCanaleMap/.test(giacenze));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
