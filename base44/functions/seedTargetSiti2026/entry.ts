import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// SUPERATA (27/09/2026). Questa funzione inseriva i record GiacenzaSito del 2026
// con i target scritti a mano. I target ora si scrivono solo in Target & Status:
// il target totale sull'impianto (ImpiantoTargetSecondaria, per anno), quello
// delle primarie come somma dei target dei raccoglitori. L'elenco dei siti di un
// anno nuovo nasce dalla copia dell'anno prima (copiaAnnoTarget). La funzione
// resta solo per rispondere a chi la chiama ancora: non scrive niente.
export async function POST(req) {
  const base44 = createClientFromRequest(req);
  const me = await base44.auth.me().catch(() => null);
  if (!me || me.role !== 'admin') {
    return Response.json({ error: "Solo gli amministratori possono eseguire questa operazione" }, { status: 403 });
  }
  return Response.json({
    ok: false,
    error: "Questa importazione non si usa piu': i target si scrivono in Target & Status (Impianti e stoccaggi e Target raccoglitori), e un anno nuovo si prepara con \"Copia dall'anno prima\" in Target & Status.",
  }, { status: 410 });
}
