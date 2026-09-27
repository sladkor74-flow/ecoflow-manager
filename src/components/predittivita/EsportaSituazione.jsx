import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, FileDown } from 'lucide-react';
import { oggiRoma } from '@/lib/giornoItaliano';
import { ton, it, itBreve, viaggiDec, SCENARI, testoErrore } from './Comuni';
import { viaggiDellaRiga } from './ProgrammaSettimana';
import { perSettimana, esitoSettimana, statoSettimana, settimanaParziale } from './SchedaSettimane';
import { ordineDestinazioni } from './SchedaStoccaggi';

// "Esporta la situazione": la fotografia della predittivita' a ogni
// aggiornamento, al posto dell'email (utente, 26/09/2026). Un PDF con
// intestazione, programma della settimana prossima, impianti (le due proiezioni
// e la prudente), stoccaggi, ultime sei settimane programmato/fatto e avvisi.
// I pesi vanno in tonnellate (kg / 1000): il PDF le scrive con 2 decimali, 3 se
// i kg non sono tondi, come tutto il gestionale.

const t = (v) => (v === null || v === undefined ? null : (Number(v) || 0) / 1000);
const SETTIMANE_NEL_PDF = 6;

/** Gli argomenti di esportaSezioniPdf per la situazione di un anno. */
export function situazionePdf(risposta, oggi = oggiRoma()) {
  const kgv = Number(risposta.kg_per_viaggio) || 13000;
  const settimana = risposta.prossima_settimana || {};
  const anno = risposta.anno;

  // --- il programma della settimana prossima ---
  const programma = (risposta.programma || []).map(r => {
    const v = viaggiDellaRiga(r);
    const fissato = !r.fissato ? 'No: è il calcolo di oggi' : r.fissato.manuale ? 'Sì, a mano' : 'Sì, il mercoledì';
    return { celle: [r.stoccaggio, r.impianto, v, t(v * kgv), fissato, r.motivo || ''] };
  });
  if (programma.length) {
    const totale = (risposta.programma || []).reduce((s, r) => s + viaggiDellaRiga(r), 0);
    programma.push({ stile: 'totale', celle: ['Totale', null, totale, t(totale * kgv), null, null] });
  }

  // --- gli impianti: le due proiezioni e la prudente ---
  const impianti = [];
  for (const i of risposta.impianti || []) {
    const stato = i.target_superato ? 'Target raggiunto' : i.senza_stoccaggi ? 'Nessuno stoccaggio lo alimenta: il resto solo in primaria' : '';
    impianti.push({ stile: 'gruppo', celle: [i.nome, t(i.target_kg), t(i.gia_arrivato_kg), t(i.target_superato ? 0 : i.residuo_kg), stato, null, null, null, null] });
    if (i.target_superato) continue;
    for (const s of SCENARI) {
      const da = (i.da_stoccaggi || [])
        .filter(d => Number((d.kg || {})[s.chiave]) > 0)
        .map(d => `${d.nome} ${ton(d.kg[s.chiave])}: ${viaggiDec((d.viaggi_totali || {})[s.chiave])} viaggi, ${viaggiDec((d.viaggi_settimana || {})[s.chiave])} a settimana`)
        .join('; ');
      const esito = i.raggiunge[s.chiave] ? 'Sì' : `No, mancano ${ton(i.mancanza_kg[s.chiave])}`;
      impianti.push({ celle: [null, null, null, null, s.chiave === 'prudente' ? 'Prudente (si programma su questa)' : s.nome, t(i.primaria_attesa[s.chiave]), t(i.fabbisogno_secondarie[s.chiave]), da || '—', esito] });
    }
  }

  // --- gli stoccaggi ---
  const stoccaggi = (risposta.stoccaggi || []).map(s => ({
    celle: [
      s.nome,
      t(s.giacenza_kg),
      s.giacenza_da ? it(s.giacenza_da) : 'manca',
      t((s.entrate_attese || {}).target), t((s.entrate_attese || {}).ritmo), t((s.entrate_attese || {}).prudente),
      t(s.residuo_plafond_kg),
      t((s.disponibile || {}).prudente),
      ordineDestinazioni(s.destinazioni),
      t((s.non_assegnato || {}).prudente),
    ],
  }));

  // --- le ultime settimane, fino a quella in corso ---
  const passate = perSettimana(risposta.settimane).filter(g => statoSettimana(g, risposta) !== 'prossima').slice(0, SETTIMANE_NEL_PDF);
  const settimane = [];
  for (const g of passate) {
    const nota = statoSettimana(g, risposta) === 'in_corso' ? ' (in corso)' : settimanaParziale(g, risposta) ? ' (formulari forse non ancora tutti caricati)' : '';
    g.righe.forEach((x, n) => settimane.push({
      celle: [n === 0 ? `dal ${it(g.settimana)} al ${it(g.al)}${nota}` : null, x.stoccaggio, x.impianto, x.programmati, x.fatti, t(x.fatti_kg), esitoSettimana(x, risposta).testo],
    }));
  }

  const avvisi = (risposta.avvisi || []).map(a => ({ celle: [a.testo] }));

  return {
    nomeFile: `Predittivita-secondarie-${oggi}`,
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  PREDITTIVITÀ DELLE SECONDARIE, SOLO RETE',
    titolo: `Predittività delle secondarie ${anno}`,
    sottotitolo: risposta.sola_lettura ? `Anno chiuso, com'era al 31/12/${anno}` : `Situazione al ${it(oggi)}`,
    riepilogo: [
      { etichetta: 'Anno', valore: `${anno}${risposta.sola_lettura ? ' (chiuso)' : ''}` },
      { etichetta: 'Dati caricati fino al', valore: it(risposta.dati_al) },
      { etichetta: 'Programma della settimana', valore: settimana.dal && !risposta.sola_lettura ? `${itBreve(settimana.dal)} - ${it(settimana.al)}` : '—' },
      { etichetta: 'Un viaggio vale', valore: ton(kgv) },
    ],
    sezioni: [
      {
        titolo: risposta.sola_lettura ? `Programma: il ${anno} è chiuso` : `Programma della settimana dal ${it(settimana.dal)} al ${it(settimana.al)}`,
        colonne: [
          { titolo: 'Da', tipo: 'testo', peso: 1.2 },
          { titolo: 'A', tipo: 'testo', peso: 1.2 },
          { titolo: 'Viaggi', tipo: 'intero', peso: 0.6 },
          { titolo: 'Tonnellate', tipo: 't', peso: 0.8 },
          { titolo: 'Fissato', tipo: 'testo', peso: 1.1 },
          { titolo: 'Perché', tipo: 'testo', peso: 4.5 },
        ],
        righe: programma,
      },
      {
        titolo: 'Impianti: le due proiezioni e la prudente, fino alla fine della programmazione (tonnellate)',
        colonne: [
          { titolo: 'Impianto', tipo: 'testo', peso: 1.1 },
          { titolo: 'Target', tipo: 't', peso: 0.8 },
          { titolo: 'Già arrivato', tipo: 't', peso: 0.8 },
          { titolo: 'Manca', tipo: 't', peso: 0.8 },
          { titolo: 'Proiezione', tipo: 'testo', peso: 1.5 },
          { titolo: 'Arriverà in primaria', tipo: 't', peso: 0.9 },
          { titolo: 'Serve in secondaria', tipo: 't', peso: 0.9 },
          { titolo: 'Da quali stoccaggi', tipo: 'testo', peso: 2.6 },
          { titolo: 'Arriva al target?', tipo: 'testo', peso: 1.2 },
        ],
        righe: impianti,
      },
      {
        titolo: 'Stoccaggi (tonnellate)',
        colonne: [
          { titolo: 'Stoccaggio', tipo: 'testo', peso: 1.1 },
          { titolo: 'Nel piazzale adesso', tipo: 't', peso: 0.9 },
          { titolo: 'Dall\'ancora del', tipo: 'testo', peso: 0.8 },
          { titolo: 'Entrerà, sul target', tipo: 't', peso: 0.9 },
          { titolo: 'Entrerà, sul ritmo', tipo: 't', peso: 0.9 },
          { titolo: 'Entrerà, prudente', tipo: 't', peso: 0.9 },
          { titolo: 'Resta del plafond', tipo: 't', peso: 0.9 },
          { titolo: 'Si può spedire, prudente', tipo: 't', peso: 0.9 },
          { titolo: 'A chi va', tipo: 'testo', peso: 1.6 },
          { titolo: 'Non assegnato, prudente', tipo: 't', peso: 0.9 },
        ],
        righe: stoccaggi,
      },
      {
        titolo: `Ultime ${SETTIMANE_NEL_PDF} settimane: programmato e fatto`,
        colonne: [
          { titolo: 'Settimana', tipo: 'testo', peso: 1.6 },
          { titolo: 'Da', tipo: 'testo', peso: 1.1 },
          { titolo: 'A', tipo: 'testo', peso: 1.1 },
          { titolo: 'Viaggi programmati', tipo: 'intero', peso: 0.8 },
          { titolo: 'Viaggi fatti', tipo: 'intero', peso: 0.8 },
          { titolo: 'Tonnellate fatte', tipo: 't', peso: 0.8 },
          { titolo: 'Com\'è andata', tipo: 'testo', peso: 2.6 },
        ],
        righe: settimane,
      },
      {
        titolo: 'Avvisi',
        colonne: [{ titolo: 'Da guardare', tipo: 'testo', peso: 1 }],
        righe: avvisi.length ? avvisi : [{ celle: ['Nessun avviso.'] }],
      },
    ],
  };
}

export default function EsportaSituazione({ risposta }) {
  const { toast } = useToast();
  const [lavoro, setLavoro] = useState(false);
  const esporta = async () => {
    setLavoro(true);
    try {
      const { esportaSezioniPdf } = await import('@/lib/esportaTabella');
      const argomenti = situazionePdf(risposta);
      await esportaSezioniPdf(argomenti);
      toast({ title: 'Situazione esportata', description: `${argomenti.nomeFile}.pdf` });
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: testoErrore(e), variant: 'destructive' });
    }
    setLavoro(false);
  };
  return (
    <Button size="sm" variant="outline" onClick={esporta} disabled={!risposta || lavoro}>
      {lavoro ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}
      Esporta la situazione
    </Button>
  );
}
