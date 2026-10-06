import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, FileDown } from 'lucide-react';

// IL PDF DELLA SCHEDA CHE SI STA GUARDANDO (06/10/2026).
//
// Chiesto dall'utente: «nei moduli giacenze e target & status e in tutte le loro
// sotto sezioni dovrebbe esserci un pulsante per esportare in pdf la situazione
// presente in ogni momento». Il pulsante sta dentro la scheda, non in testa alla
// pagina: cosi' quello che esce e' esattamente quello che si ha davanti, coi
// filtri e l'anno scelti in quel momento.
//
// Il PDF lo fa la macchina comune (src/lib/esportaTabella.js, esportaSezioniPdf):
// fascia SMOCO, riquadri di riepilogo, intestazioni ripetute a ogni cambio
// pagina, totali e piede con data e numero di pagina. Niente generatori scritti a
// mano con coordinate fisse: quello di Target & Status perdeva gli impianti oltre
// il ventiseiesimo senza dirlo.
//
// `sezioni` e' una funzione che costruisce gli argomenti al momento del clic
// (nomeFile, titolo, sottotitolo, riepilogo, sezioni, note): si valuta li' per
// prendere i dati come sono adesso, non come erano quando la pagina e' nata.
export default function EsportaPdf({ sezioni, etichetta = 'Esporta PDF', disabilitato = false, className = '' }) {
  const { toast } = useToast();
  const [lavoro, setLavoro] = useState(false);

  const esporta = async () => {
    setLavoro(true);
    try {
      const argomenti = typeof sezioni === 'function' ? sezioni() : sezioni;
      if (!argomenti || !(argomenti.sezioni || []).some(s => (s.righe || []).length)) {
        toast({ title: 'Niente da esportare', description: 'Questa scheda non ha righe da mettere nel PDF.' });
        setLavoro(false);
        return;
      }
      const { esportaSezioniPdf } = await import('@/lib/esportaTabella');
      await esportaSezioniPdf(argomenti);
      toast({ title: 'PDF esportato', description: `${argomenti.nomeFile}.pdf` });
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: e?.message || String(e), variant: 'destructive' });
    }
    setLavoro(false);
  };

  return (
    <Button size="sm" variant="outline" onClick={esporta} disabled={disabilitato || lavoro} className={className}>
      {lavoro ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}
      {etichetta}
    </Button>
  );
}
