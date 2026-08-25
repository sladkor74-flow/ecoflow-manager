// Normalizza una ragione sociale rimuovendo il tipo società (SRL, S.R.L., SPA, ecc.),
// la dicitura "A Socio Unico" / "A S.U.", punti e normalizzando spazi/case.
// Es. "IRIGOM S.R.L." -> "irigom", "Irigom Srl" -> "irigom", "NAPPI SUD SRL" -> "nappi sud"
// "Nappi Sud Srl A Socio Unico" -> "nappi sud", "T.R.S. SRL" -> "trs", "TECNOGUM SRL" -> "tecnogum"
//
// Tabella alias esplicita: varianti di denominazione (già normalizzate) → chiave canonica.
// Permette di riconoscere come unico impianto forme diverse es. "T-CYCLE INDUSTRIES SRL" = "T-CYCLE SRL".
// Chiavi canoniche: tecnogum, irigom, t-cycle, nappi sud, smoco, ecorecuperi,
//                  pneuservice conversano, emmesse, gatim, trs
const ALIAS_TO_CANONICAL = {
  // TECNOGUM
  'tecnogum': 'tecnogum',
  // IRIGOM
  'irigom': 'irigom',
  // T-CYCLE (varianti con/senza "INDUSTRIES" e con/senza trattino)
  't-cycle': 't-cycle',
  't-cycle industries': 't-cycle',
  'tcycle': 't-cycle',
  // NAPPI SUD
  'nappi sud': 'nappi sud',
  // SMOCO
  'smoco': 'smoco',
  // ECORECUPERI
  'ecorecuperi': 'ecorecuperi',
  // PNEUSERVICE CONVERSANO
  'pneuservice conversano': 'pneuservice conversano',
  // EMMESSE
  'emmesse': 'emmesse',
  // GATIM
  'gatim': 'gatim',
  // TRS
  'trs': 'trs',
};

export function normalizzaRagioneSociale(nome) {
  if (!nome) return '';
  let s = String(nome).trim().toUpperCase();
  // Rimuovi "A SOCIO UNICO" / "A S.U." in coda (prima della sigla società)
  s = s.replace(/\s*A\s+SOCIO\s+UNICO$/g, '');
  s = s.replace(/\s*A\s+S\.?\s*U\.?$/g, '');
  // Rimuovi sigle tipo società in coda (con o senza punti): SRL, S.R.L., SRLS, SPA, S.P.A., SNC, SAS, SAPA
  s = s.replace(/[\s,]*S\.?\s*R\.?\s*L\.?\s*S?\.?$/g, '');
  s = s.replace(/[\s,]*S\.?\s*P\.?\s*A\.?\.?$/g, '');
  s = s.replace(/[\s,]*S\.?\s*N\.?\s*C\.?\.?$/g, '');
  s = s.replace(/[\s,]*S\.?\s*A\.?\s*S\.?\.?$/g, '');
  s = s.replace(/[\s,]*SAPA\.?$/g, '');
  s = s.replace(/[\s,]*SRLS\.?$/g, '');
  // Rimuovi punti e virgole, normalizza spazi
  s = s.replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
  s = s.toLowerCase();
  // Applica tabella alias esplicita
  return ALIAS_TO_CANONICAL[s] || s;
}