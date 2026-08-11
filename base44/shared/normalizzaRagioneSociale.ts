// Normalizza una ragione sociale rimuovendo il tipo società (SRL, S.R.L., SPA, ecc.),
// la dicitura "A Socio Unico" / "A S.U.", punti e normalizzando spazi/case.
// Es. "IRIGOM S.R.L." -> "irigom", "Irigom Srl" -> "irigom", "NAPPI SUD SRL" -> "nappi sud"
// "Nappi Sud Srl A Socio Unico" -> "nappi sud", "T.R.S. SRL" -> "trs", "TECNOGUM SRL" -> "tecnogum"
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
  return s.toLowerCase();
}