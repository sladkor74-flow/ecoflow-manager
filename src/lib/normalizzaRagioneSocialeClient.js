// Versione client-side di normalizzaRagioneSociale (speculare a base44/shared/normalizzaRagioneSociale.ts)
// Usata per matching nomi raccoglitore <-> TargetRaccoglitore nella UI.

const ALIAS_TO_CANONICAL = {
  'tecnogum': 'tecnogum',
  'irigom': 'irigom',
  't-cycle': 't-cycle',
  't-cycle industries': 't-cycle',
  'tcycle': 't-cycle',
  'nappi sud': 'nappi sud',
  'smoco': 'smoco',
  'ecorecuperi': 'ecorecuperi',
  'pneuservice conversano': 'pneuservice conversano',
  'emmesse': 'emmesse',
  'gatim': 'gatim',
  'trs': 'trs',
};

export function normalizzaRagioneSociale(nome) {
  if (!nome) return '';
  let s = String(nome).trim().toUpperCase();
  s = s.replace(/\s*A\s+SOCIO\s+UNICO$/g, '');
  s = s.replace(/\s*A\s+S\.?\s*U\.?$/g, '');
  s = s.replace(/[\s,]*S\.?\s*R\.?\s*L\.?\s*S?\.?$/g, '');
  s = s.replace(/[\s,]*S\.?\s*P\.?\s*A\.?\.?$/g, '');
  s = s.replace(/[\s,]*S\.?\s*N\.?\s*C\.?\.?$/g, '');
  s = s.replace(/[\s,]*S\.?\s*A\.?\s*S\.?\.?$/g, '');
  s = s.replace(/[\s,]*SAPA\.?$/g, '');
  s = s.replace(/[\s,]*SRLS\.?$/g, '');
  s = s.replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
  s = s.toLowerCase();
  return ALIAS_TO_CANONICAL[s] || s;
}