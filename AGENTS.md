# AGENTS.md

## Project Context

This is a Base44 app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and publish workflow.

## Base44 References

- CLI overview: https://docs.base44.com/developers/references/cli/get-started/overview.md
- Agent skills: https://docs.base44.com/developers/backend/overview/skills.md

If your agent supports Agent Skills, install or update Base44 skills before Base44-specific work:

```bash
npx skills add base44/skills
```

## Key Files

- `src/`: frontend application source.
- `src/api/base44Client.js`: frontend Base44 SDK client.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `base44 dev` as the default local development command when you need the local Base44 backend. It can run the backend and frontend together.
- When docs or code mention the frontend being started automatically, that usually means the Base44 project config includes `site.serveCommand`, for example `"serveCommand": "npm run dev"` in `base44/config.jsonc`.
- Use `npm run dev` only for frontend-only work against the hosted Base44 backend.
- Prefer the existing Base44 CLI workflow over adding new npm scripts for Base44-specific tasks.
- Reuse the existing SDK client and Vite plugin patterns before adding new Base44 integration paths.
- Run the relevant checks from `package.json` before finishing code changes.

## Regole della commessa

Regole di dominio che il codice deve rispettare sempre. Valgono per ogni nuovo
conto, filtro, export o assistente: se una modifica le viola, e' sbagliata anche
quando "funziona".

### Il periodo di un movimento e' la fine del trasporto

A quale giorno, settimana, mese e anno appartiene un movimento lo decide
**`trasporto_finito_il`**, mai `ordine_chiuso_il` e mai i campi `mese`, `anno` o
`settimane` memorizzati sul record. Il portale chiude l'ordine giorni dopo la
fine del trasporto, e i due non cadono nello stesso mese: contato sul 2026,
96 primarie di rete su 2.827 (272,65 t), 2 ACI su 44, una secondaria e 65
terziarie su 99 (2.198,64 t).

Usa `dataPeriodo(record)` da `base44/shared/dataEnrichment.ts`, che incapsula la
regola. I campi memorizzati possono venire da importazioni vecchie, quando la
data di riferimento era la chiusura: non fidarsene, ricalcolare.

Due sole eccezioni, ed e' giusto che lo siano:
- la **giacenza a portale** (`riepilogoDichiarazioni`, `calcolaGiacenze`), perche'
  il portale conta un ordine nel momento in cui lo chiude;
- i **tempi di evasione**, che misurano proprio la distanza fra immissione e
  chiusura.

Un assegnato non e' un movimento: il suo periodo e' `ordine_immesso_il`.

### Canali indipendenti

RETE, ACI ed EXTRA RACCOLTA sono commesse separate: non si sommano mai, in
nessun modulo, nemmeno come totale di controllo o come conteggio di formulari, e
anche quando un viaggio di secondaria porta formulari di piu' canali. I target
esistono solo per la rete.

### Pesi

Le valutazioni si fanno sul peso effettivo (`peso_effettivo`), mai sullo stimato.
Tonnellate con due decimali, tre se i kg non sono tondi; kg sempre interi;
ovunque, export compresi.
