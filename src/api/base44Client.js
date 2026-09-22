import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { conLimiteRichieste } from '@/lib/limiteRichieste';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
// Le richieste respinte per il limite della piattaforma si ripetono dopo una
// pausa (src/lib/limiteRichieste.js, specchio di base44/shared).
export const base44 = conLimiteRichieste(createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
}));
