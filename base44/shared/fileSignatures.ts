// Firme delle intestazioni Excel per riconoscimento automatico del tipo file.
// Per ogni tipo_file: colonne "chiave" (obbligatorie, la loro assenza blocca),
// "attese" (la loro assenza produce solo un avviso), "vietate" (la loro presenza blocca).
// Il confronto e' case-insensitive con trim degli spazi.

export const FILE_SIGNATURES: Record<string, {
  chiave: string[];
  attese: string[];
  vietate: string[];
}> = {
  primarie: {
    chiave: [
      'ID', 'Stato', 'Ordine_immesso_il', 'ID_Cliente', 'ID_PDR', 'Punto_di_Raccolta',
      'Provincia', 'Prodotto', 'CER', 'Quantita_ritirata', 'Peso_effettivo',
      'Trasportatore', 'Tipo_Destinazione', 'Destinazione', 'Automezzo',
      'Trasporto_finito_il', 'Ordine_chiuso_il', 'Numero_FIR'
    ],
    attese: [
      'Codice_Import', 'Ragione_Sociale', 'Indirizzo', 'CAP', 'Comune',
      'Codice_Regione', 'Macroarea', 'Codice_Prodotto', 'Tipo_contenitori',
      'Quantita_richiesta', 'Peso_stimato', 'KeyAccount', 'ID_Partner_Operativo',
      'Partner_Operativo', 'ID_Trasportatore', 'ID_Destinazione', 'Rimorchio',
      'Distanza', 'Trasporto_iniziato_il', 'Numero_Ordine_Interno',
      'Motivo_cancellazione', 'Fatturato_Trasporto', 'Fatturato_Riciclo'
    ],
    vietate: ['ID_Stoccaggio', 'ID_Impianto']
  },
  secondarie: {
    chiave: [
      'ID', 'Stato', 'Ordine_immesso_il', 'ID_Proprietario_Stoccaggio',
      'ID_Stoccaggio', 'Stoccaggio', 'Provincia', 'Prodotto', 'CER',
      'Quantita_ritirata', 'Peso_effettivo', 'Trasportatore',
      'Tipo_Destinazione', 'Destinazione', 'Automezzo',
      'Trasporto_finito_il', 'Ordine_chiuso_il', 'Numero_FIR'
    ],
    attese: [
      'Ragione_Sociale', 'Indirizzo', 'CAP', 'Comune', 'Codice_Regione',
      'Macroarea', 'Codice_Prodotto', 'Peso_stimato', 'KeyAccount',
      'ID_Partner_Operativo', 'Partner_Operativo', 'ID_Trasportatore',
      'ID_Destinazione', 'Rimorchio', 'Distanza', 'Trasporto_iniziato_il',
      'Numero_Ordine_Interno', 'Fatturato_Trasporto', 'Fatturato_Riciclo'
    ],
    vietate: ['ID_PDR', 'ID_Impianto']
  },
  terziarie: {
    chiave: [
      'ID', 'Stato', 'Ordine_immesso_il', 'ID_Impianto',
      'ID_Unita_Locale_Origine', 'Unita_Locale_Origine', 'Provincia', 'CER',
      'Quantita_ritirata', 'Peso_effettivo', 'Trasportatore',
      'Tipo_Destinazione', 'Destinazione', 'Automezzo',
      'Trasporto_finito_il', 'Ordine_chiuso_il', 'Numero_FIR'
    ],
    attese: [
      'Ragione_Sociale', 'Indirizzo', 'CAP', 'Comune', 'Codice_Regione',
      'Macroarea', 'Peso_stimato', 'KeyAccount', 'ID_Partner_Operativo',
      'Partner_Operativo', 'ID_Trasportatore', 'ID_Destinazione', 'Rimorchio',
      'Distanza', 'Trasporto_iniziato_il', 'Numero_Ordine_Interno'
    ],
    vietate: ['ID_PDR', 'ID_Stoccaggio']
  },
  dichiarazioni_trattamento: {
    chiave: [
      'KeyAccount', 'Ordine_primaria', 'Data_chiusura', 'ID_Cliente', 'ID_PDR',
      'Punto_di_Raccolta', 'Provincia', 'Prodotto', 'Status', 'CER',
      'Mod_trattamento', 'Peso_effettivo_Kg', 'Trasportatore', 'Destinazione',
      'Fine_trasporto', 'Numero_FIR', 'Peso_associato_Kg', 'Risultato_trattamento',
      'Data_dichiarazione', 'ID_Dichiarazione', 'Granulo_Kg', 'Fibre_Kg',
      'Metallo_Kg', 'Cippato_Kg', 'Ciabattato_Kg'
    ],
    attese: [
      'Indirizzo', 'CAP', 'Comune', 'Codice_Regione', 'Macroarea',
      'Tipo_contenitori', 'Nr_pezzi_ritirati', 'Partner_Operativo',
      'ID_destinazione', 'Automezzo', 'Rimorchio', 'Distanza', 'Data_immissione',
      'Inizio_trasporto', 'Data_esecuzione', 'Ordine_secondaria',
      'Trasportatore_secondaria', 'Mod_trattamento_sec', 'Peso_effettivo_sec_Kg',
      'FIR_All_VII_secondaria', 'ID_destinazione_secondaria', 'Destinazione_secondaria',
      'Ordine_terziaria', 'FIR_All_VII_terziaria', 'Mod_trattamento_ter',
      'Peso_effettivo_ter_Kg', 'ID_destinazione_finale', 'Destinazione_finale',
      'Riutilizzo_Kg', 'Gomme_intere_Kg', 'Prelavorazione_Kg',
      'Dim_min_granulato_mm', 'Dim_max_granulato_mm'
    ],
    vietate: ['Peso_non_dichiarato_Kg']
  },
  ordini_non_dichiarati: {
    chiave: [
      'KeyAccount', 'Ordine_primaria', 'Data_chiusura', 'ID_Cliente', 'ID_PDR',
      'Punto_di_Raccolta', 'Provincia', 'Prodotto', 'Status', 'CER',
      'Mod_trattamento', 'Peso_effettivo_Kg', 'Trasportatore', 'Destinazione',
      'Fine_trasporto', 'Numero_FIR', 'Peso_non_dichiarato_Kg'
    ],
    attese: [
      'Indirizzo', 'CAP', 'Comune', 'Codice_Regione', 'Macroarea',
      'Tipo_contenitori', 'Nr_pezzi_ritirati', 'Partner_Operativo',
      'ID_destinazione', 'Automezzo', 'Rimorchio', 'Distanza', 'Data_immissione',
      'Inizio_trasporto', 'Data_esecuzione', 'Ordine_secondaria',
      'Trasportatore_secondaria', 'Mod_trattamento_sec', 'Peso_effettivo_sec_Kg',
      'FIR_All_VII_secondaria', 'ID_destinazione_secondaria', 'Destinazione_secondaria'
    ],
    vietate: ['ID_Dichiarazione', 'Peso_associato_Kg', 'Granulo_Kg']
  }
};

// Normalizza un nome colonna per confronto case-insensitive con trim.
export function normalizeColName(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Verifica se un set di intestazioni soddisfa la firma di un tipo_file.
export function checkSignature(
  headers: string[],
  sig: { chiave: string[]; attese: string[]; vietate: string[] }
): { match: boolean; chiave_mancanti: string[]; vietate_trovate: string[]; attese_mancanti: string[] } {
  const headerSet = new Set(headers.map(normalizeColName));
  const chiave_mancanti = sig.chiave.filter(c => !headerSet.has(normalizeColName(c)));
  const vietate_trovate = sig.vietate.filter(c => headerSet.has(normalizeColName(c)));
  const attese_mancanti = sig.attese.filter(c => !headerSet.has(normalizeColName(c)));
  const match = chiave_mancanti.length === 0 && vietate_trovate.length === 0;
  return { match, chiave_mancanti, vietate_trovate, attese_mancanti };
}

// Trova quale tipo_file (tra quelli con firma) corrisponde alle intestazioni.
export function detectType(headers: string[]): string | null {
  for (const [tipo, sig] of Object.entries(FILE_SIGNATURES)) {
    const { match } = checkSignature(headers, sig);
    if (match) return tipo;
  }
  return null;
}