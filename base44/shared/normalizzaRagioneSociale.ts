// Normalizza una ragione sociale rimuovendo il tipo società (SRL, S.R.L., SPA, ecc.)
// e normalizzando spazi/punteggiatura/case.
// Es. "IRIGOM S.R.L." -> "irigom", "Irigom Srl" -> "irigom", "NAPPI SUD SRL" -> "nappi sud"
// "TECNOGUM SRL" -> "tecnogum", "Tecnogum" -> "tecnogum"
export function normalizzaRagioneSociale(nome) {
  if (!nome) return '';
  let s = String(nome).trim().toUpperCase();
  // Rimuovi sigle tipo società in coda (con o senza punti): SRL, S.R.L., SRLS, SPA, S.P.A., SNC, SAS, SAPA
  s = s.replace(/[\s,]*S\.?\s*R\.?\s*L\.?\s*S?\.?$/g, '');
  s = s.replace(/[\s,]*S\.?\s*P\.?\s*A\.?\.?$/g, '');
  s = s.replace(/[\s,]*S\.?\s*N\.?\s*C\.?\.?$/g, '');
  s = s.replace(/[\s,]*S\.?\s*A\.?\s*S\.?\.?$/g, '');
  s = s.replace(/[\s,]*SAPA\.?$/g, '');
  s = s.replace(/[\s,]*SRLS\.?$/g, '');
  // Pulizia punteggiatura residua e normalizzazione spazi
  s = s.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.toLowerCase();
}