// L'INVENTARIO DEI FILE CHE LA PIATTAFORMA TIENE PER NOI.
//
// Serve perche' la piattaforma non sa cancellare un file: confermato dalla sua
// assistenza il 30/09/2026 ("none of them deletes files... I couldn't find any
// delete option for uploaded files in the SDK or the dashboard"). L'unico modo
// per far sparire davvero un file e' chiederlo al loro team, e per chiederlo
// bisogna sapere quali file sono: questo elenco e' quella lista.
//
// Vale anche dopo: e' l'unico posto da cui si vede che cosa resta caricato, visto
// che nessun pannello lo mostra.
//
// DUE GENERI, E LA DIFFERENZA E' TUTTO:
//   pubblico (file_url)  - caricato fino al 30/09/2026 con UploadFile. L'indirizzo
//                          funziona per chiunque ce l'abbia, per sempre. Sono
//                          questi i file urgenti da far rimuovere.
//   privato (file_uri)   - si apre solo con un link firmato che scade. Finche'
//                          nessuno lo firma, e' gia' irraggiungibile.

/** Dove stanno i riferimenti ai file, archivio per archivio. */
export const ARCHIVI_CON_FILE = [
  { entita: 'UploadLog', campoUrl: 'file_url', campoUri: 'file_uri', cosa: 'file di caricamento dati', etichetta: (r) => `${r.tipo_file || ''} · ${r.nome_file || ''}` },
  { entita: 'EsportazioneFatturazione', campoUrl: 'file_url', campoUri: null, cosa: 'export di fatturazione', etichetta: (r) => `${r.tipo || ''} ${r.mese || ''} ${r.anno || ''}` },
  { entita: 'DocumentoQualifica', campoUrl: null, campoUri: 'file_uri', cosa: 'documento di qualifica fornitore', etichetta: (r) => `${r.soggetto_nome || ''} · ${r.tipo_documento_nome || ''}` },
  { entita: 'ContrattoFornitore', campoUrl: null, campoUri: 'file_uri', cosa: 'contratto fornitore', etichetta: (r) => `${r.fornitore_nome || ''} ${r.anno || ''}` },
  { entita: 'ModelloContratto', campoUrl: null, campoUri: 'file_uri', cosa: 'modello di contratto', etichetta: (r) => `${r.nome || ''}` },
  { entita: 'ModelloDocumento', campoUrl: null, campoUri: 'file_uri', cosa: 'modello di documento', etichetta: (r) => `${r.nome || ''}` },
  { entita: 'QuadraturaFir', campoUrl: null, campoUri: 'file_uri', cosa: 'stampa della quadratura FIR', etichetta: (r) => `settimana ${r.settimana || ''}/${r.anno || ''} · ${r.file_nome || ''}` },
  { entita: 'VerificaReport', campoUrl: null, campoUri: 'file_uri', cosa: 'report settimanale di un fornitore', etichetta: (r) => `${r.sito_nome || ''} · settimana ${r.settimana || ''}/${r.anno || ''}` },
];

const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** Una riga dell'inventario da un record. null se quel record non tiene nessun file. */
export function voceFile(def, r) {
  const url = def.campoUrl ? testo(r[def.campoUrl]) : '';
  const uri = def.campoUri ? testo(r[def.campoUri]) : '';
  if (!url && !uri) return null;
  return {
    entita: def.entita,
    id: testo(r.id),
    cosa: def.cosa,
    descrizione: testo(def.etichetta ? def.etichetta(r) : ''),
    genere: url ? 'pubblico' : 'privato',
    riferimento: url || uri,
    caricato_il: testo(r.created_date).slice(0, 10),
  };
}

const csvCampo = (v) => {
  const s = String(v ?? '');
  return /[",;\n]/.test(s) ? '"' + s.split('"').join('""') + '"' : s;
};

/**
 * L'inventario in CSV, i pubblici per primi perche' sono quelli che scottano.
 * Separatore virgola: e' un file che si manda all'assistenza, non si apre in
 * Excel italiano.
 */
export function csvInventario(voci) {
  const ordinate = [...(voci || [])].sort((a, b) => {
    if (a.genere !== b.genere) return a.genere === 'pubblico' ? -1 : 1;
    return String(a.caricato_il).localeCompare(String(b.caricato_il)) || String(a.entita).localeCompare(String(b.entita));
  });
  const righe = [['genere', 'riferimento', 'archivio', 'id_record', 'cosa', 'descrizione', 'caricato_il'].join(',')];
  for (const v of ordinate) {
    righe.push([v.genere, v.riferimento, v.entita, v.id, v.cosa, v.descrizione, v.caricato_il].map(csvCampo).join(','));
  }
  return righe.join('\n');
}

/** Quanti sono, divisi per genere: la riga di riepilogo da dire all'assistenza. */
export function contaInventario(voci) {
  const xs = voci || [];
  const pubblici = xs.filter(v => v.genere === 'pubblico');
  return {
    totale: xs.length,
    pubblici: pubblici.length,
    privati: xs.length - pubblici.length,
    per_archivio: [...new Set(xs.map(v => v.entita))].map(e => ({
      entita: e,
      quanti: xs.filter(v => v.entita === e).length,
      pubblici: xs.filter(v => v.entita === e && v.genere === 'pubblico').length,
    })).sort((a, b) => b.quanti - a.quanti),
  };
}
