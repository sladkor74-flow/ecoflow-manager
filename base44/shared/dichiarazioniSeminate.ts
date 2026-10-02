// LE DICHIARAZIONI CHE NON SONO DICHIARAZIONI.
//
// Regola dell'utente, 02/10/2026: «cio' che non e' veramente dichiarato a
// portale puoi toglierlo, non confondiamoci con cose che non esistono».
//
// Due generi di record, e sono le uniche due cose che si tolgono.
//
// 1. LE RIGHE DEL SEME DEL 12/09/2026 (seedGiacenze2026). Per i mesi non ancora
//    dichiarati portano in quantita_kg il quantitativo che a quella data restava
//    DA dichiarare - scritto nel campo che tutto il modulo legge come «quanto
//    l'impianto ha dichiarato». Sono numeri veri messi nella colonna sbagliata.
//    Nella casella del mese si leggono come una dichiarazione in mano da
//    segnare, ed e' il «105.740» su cui l'utente e' tornato tre volte.
//
// 2. I RECORD VUOTI: quantita' zero, nessun motivo di assenza, nessun materiale.
//    Non dicono niente, e fanno danno: la casella del mese, trovando un record,
//    smette di dire che manca una dichiarazione, e resta muta del tutto. E' il
//    caso di Gatim settembre, che l'utente ha trovato vuoto mentre il portale
//    aspettava 122.170 kg.
//
// CHE COSA NON SI TOCCA, MAI, e il perche' conta piu' dell'elenco:
//   - una dichiarazione CARICATA A PORTALE: e' il fatto compiuto;
//   - una RICEVUTA VIA EMAIL: l'impianto ce l'ha mandata davvero, il documento
//     esiste, manca solo il caricamento;
//   - un mese con un MOTIVO DI ASSENZA (non dovuta, solo metalli): e' una
//     dichiarazione di volonta', non un vuoto;
//   - un mese con i MATERIALI scritti (granulo, cippato, CSS-C, ferro...):
//     qualcuno quei numeri li ha avuti da qualche parte.
// Quattro delle nove righe del seme, nel frattempo, sono diventate vere: il
// portale ha dichiarato luglio e agosto di Green Tyre, l'agosto ACI di Tecnogum
// e il luglio di extra raccolta di Irigom, e l'allineamento le ha segnate
// caricate. La prima guardia le salva da sola, senza che l'elenco cambi.

/**
 * Le righe scritte dal seme del 12/09/2026 con, in quantita_kg, cio' che restava
 * da dichiarare invece di cio' che era stato dichiarato. Copia fedele delle righe
 * con caricata_inviata false di seedGiacenze2026: si confrontano tutte e cinque
 * le chiavi, cosi' una riga che nel frattempo e' stata corretta a mano non viene
 * toccata per sbaglio.
 */
export const SEME_NON_DICHIARATO = [
  { sito: 'Gatim', canale: 'RETE', provenienza: '', mese: 'Giugno', quantita_kg: 112240 },
  { sito: 'Gatim', canale: 'RETE', provenienza: '', mese: 'Settembre', quantita_kg: 17940 },
  { sito: 'T.R.S.  SRL', canale: 'RETE', provenienza: '', mese: 'Agosto', quantita_kg: 9500 },
  { sito: 'T.R.S.  SRL', canale: 'RETE', provenienza: '', mese: 'Settembre', quantita_kg: 12680 },
  { sito: 'GREEN TYRE PROJECT SRL', canale: 'RETE', provenienza: '', mese: 'Luglio', quantita_kg: 256140 },
  { sito: 'GREEN TYRE PROJECT SRL', canale: 'RETE', provenienza: '', mese: 'Agosto', quantita_kg: 94700 },
  { sito: 'GREEN TYRE PROJECT SRL', canale: 'RETE', provenienza: '', mese: 'Settembre', quantita_kg: 105740 },
  { sito: 'TECNOGUM SRL', canale: 'ACI', provenienza: 'secondaria', mese: 'Agosto', quantita_kg: 6640 },
  { sito: 'Irigom S.r.l.', canale: 'EXTRA_RACCOLTA', provenienza: '', mese: 'Luglio', quantita_kg: 460 },
];

const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const num = (v) => Math.round(Number(v) || 0);

const MATERIALI = ['granulo_kg', 'fibre_kg', 'metalli_kg', 'ciabattato_kg', 'cippato_kg', 'cssc_kg', 'altro_kg'];

/** Vero se su quel record c'e' scritto almeno un materiale ricavato. */
export const conMateriali = (d) => MATERIALI.some(c => num(d && d[c]) > 0);

/**
 * Un record che NON si tocca in nessun caso: caricato a portale, ricevuto via
 * email, con un motivo di assenza, o con i materiali scritti.
 */
export function daTenere(d) {
  if (!d) return true;
  if (d.caricata_inviata) return true;
  if (d.ricevuta_email) return true;
  if (testo(d.motivo_assenza)) return true;
  if (conMateriali(d)) return true;
  return false;
}

/** Vero se quel record e' una delle righe del seme, tutte e cinque le chiavi uguali. */
export function eDelSeme(d) {
  if (!d) return false;
  return SEME_NON_DICHIARATO.some(s =>
    testo(s.sito) === testo(d.sito)
    && testo(s.canale || 'RETE') === testo(d.canale || 'RETE')
    && testo(s.provenienza) === testo(d.provenienza)
    && testo(s.mese) === testo(d.mese)
    && s.quantita_kg === num(d.quantita_kg));
}

/** Vero se quel record non dice niente: zero, nessun motivo, nessun materiale. */
export function eVuoto(d) {
  return !!d && num(d.quantita_kg) === 0;
}

/**
 * I record da togliere, con scritto perche'. Funzione pura: le prove la chiamano
 * senza toccare la piattaforma.
 *
 * Torna [{ id, sito, canale, provenienza, mese, quantita_kg, perche }].
 */
export function daTogliere(dichiarazioni) {
  const fuori = [];
  for (const d of dichiarazioni || []) {
    if (daTenere(d)) continue;
    const perche = eDelSeme(d)
      ? 'riga del seme del 12/09/2026: in quantita c\'e\' cio\' che restava DA dichiarare, non una dichiarazione'
      : (eVuoto(d) ? 'record vuoto: nessuna quantita, nessun motivo, nessun materiale' : '');
    if (!perche) continue;
    fuori.push({
      id: d.id,
      sito: d.sito,
      canale: d.canale || 'RETE',
      provenienza: d.provenienza || '',
      mese: d.mese,
      quantita_kg: num(d.quantita_kg),
      perche,
    });
  }
  return fuori.sort((a, b) => String(a.sito).localeCompare(String(b.sito)) || String(a.mese).localeCompare(String(b.mese)));
}
