import React from 'react';
import { Link } from 'react-router-dom';
import { Factory, Sparkles } from 'lucide-react';
import Sezione, { Cifra } from '@/components/dashboard/Sezione';
import { t, tSegno, intero, giorno, giornoMese, NOMI_CANALE, COLORI } from '@/components/dashboard/formato';

// GLI IMPIANTI (migliorie dell'11/10/2026), dalla fotografia
// della notte (quadroImpianti, cruscotto.ts): la quadratura col portale e quanto
// resta da dichiarare, canale per canale e mai sommato. Non si rifa' nessun
// conto: la notte rifa' la quadratura con la regola di Dichiarazioni Impianti e
// Giacenze, e qui si somma quello che ha scritto. Se dopo la notte e' entrato un
// file che cambia i numeri, lo si dice: i numeri di adesso sono nei moduli. Le
// giacenze dei piazzali restano in Giacenze (quadroImpianti spiega perche').
//
// La quadratura e' quella di Dichiarazioni Impianti, con la sua etichetta e il
// suo numero (revisione delle migliorie, 11/10/2026): «Rete: quadratura con il
// portale», impianti e stoccaggi della rete con una giacenza a portale, l'ACI
// degli stoccaggi a parte. Qui si contavano i soli impianti e la stessa mattina
// le due pagine dicevano «5 su 5» e «6 su 6».
const CANALI = [['RETE', COLORI.rete], ['ACI', COLORI.aci], ['EXTRA_RACCOLTA', COLORI.extra]];

/** La riga sotto la quadratura: chi non quadra, e l'ACI degli stoccaggi a parte. */
export function sottoQuadratura(imp) {
  const parti = [imp.scostamenti.length ? `${intero(imp.scostamenti.length)} da verificare:` : 'tutti in linea'];
  const ac = imp.aci_stoccaggi;
  if (ac && ac.con_confronto > 0) parti.push(`ACI negli stoccaggi, a parte: ${intero(ac.quadrano)} su ${intero(ac.con_confronto)}`);
  return parti.join(' · ');
}

export default function SezioneImpianti({ impianti, annoInCorso, anno, daGestire, onDaGestire }) {
  const imp = impianti;
  const fresca = annoInCorso && imp && imp.stato === 'fresca';
  const domanda = imp && imp.giorno ? `Quali impianti non quadrano col portale al ${giorno(imp.giorno)}, e perché?` : '';
  return (
    <Sezione
      id="impianti" icona={Factory}
      titolo="Impianti"
      sottotitolo={fresca ? `Dal controllo della notte del ${giorno(imp.giorno)}: quadratura col portale e quanto resta da dichiarare, canale per canale.` : 'Quadratura col portale e quanto resta da dichiarare, canale per canale.'}
      perche={(
        <>
          <p>Ogni notte la quadratura di tutti gli impianti si rifà con la stessa regola di Dichiarazioni Impianti e Giacenze, e il risultato resta scritto: qui si legge quello.</p>
          <p>«Da dichiarare» è la colonna «Da dichiarare» delle Dichiarazioni, sommata impianto per impianto, canale per canale. La rete di chi non la dichiara per accordo (oggi Tecnogum) non c&apos;è; una giacenza sotto zero non entra nella cifra e si dice a parte.</p>
          <p>La quadratura col portale è quella di Dichiarazioni Impianti, con le stesse righe: gli impianti e gli stoccaggi della rete che hanno una giacenza a portale. L&apos;ACI degli stoccaggi si conta a parte, mai con la rete.</p>
          <p>Le giacenze dei piazzali di stoccaggio stanno in Giacenze: nella fotografia della notte i piazzali che stanno con un impianto non sono separati, e una somma fatta qui non sarebbe il numero di Giacenze.</p>
        </>
      )}
      collegamenti={[
        { a: '/giacenze', testo: 'Giacenze' },
        { a: '/dichiarazioni-impianti', testo: 'Dichiarazioni Impianti' },
        { a: '/secondarie', testo: 'Secondarie' },
        { a: '/terziarie', testo: 'Terziarie' },
      ]}
      daGestire={daGestire} onDaGestire={onDaGestire}
      destra={fresca && domanda ? (
        <Link to={`/assistente?domanda=${encodeURIComponent(domanda)}`} className="text-xs text-violet-700 hover:underline inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3" aria-hidden="true" /> Chiedi a EcoTyna
        </Link>
      ) : null}
    >
      {!annoInCorso ? (
        <p className="text-sm text-muted-foreground">La quadratura di ogni notte è sull&apos;anno in corso: per il {anno} si guarda Giacenze, scegliendo l&apos;anno.</p>
      ) : !imp ? (
        <p className="text-sm text-muted-foreground">Il controllo della notte non si è potuto leggere.</p>
      ) : !fresca ? (
        <div className="text-sm text-muted-foreground space-y-1">
          <p>{imp.stato === 'assente' ? 'Il controllo della notte non c\'è.' : `Il controllo della notte è del ${giorno(imp.giorno)}.`} {imp.perche}</p>
          <p>Quadratura e da dichiarare: —. I numeri di adesso sono in Giacenze e Dichiarazioni Impianti.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Cifra
              etichetta="Rete: quadratura con il portale"
              valore={`${intero(imp.quadrano)} su ${intero(imp.con_confronto)}`}
              sotto={sottoQuadratura(imp)}
            />
            {CANALI.map(([c, colore]) => {
              const d = imp.da_dichiarare && imp.da_dichiarare[c];
              return (
                <Cifra
                  key={c}
                  etichetta={<span className="inline-flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ background: colore }} aria-hidden="true" />Da dichiarare · {NOMI_CANALE[c]}</span>}
                  valore={t(d ? d.t : null)}
                  sotto={d ? (d.impianti ? `su ${intero(d.impianti)} ${d.impianti === 1 ? 'impianto' : 'impianti'}` : 'niente da dichiarare') : ''}
                />
              );
            })}
          </div>
          {imp.scostamenti.length > 0 && (
            <ul className="text-xs space-y-0.5">
              {imp.scostamenti.map(s => (
                <li key={s.sito}><span className="font-medium">{s.sito}</span>{s.stoccaggio ? ' (stoccaggio)' : ''}: {tSegno(s.scarto_t)} (calcolata {t(s.calcolata_t)}, portale {t(s.portale_t)})</li>
              ))}
            </ul>
          )}
          {imp.sotto_zero.length > 0 && (
            <p className="text-xs text-red-700">
              {imp.sotto_zero.length === 1 ? 'Una giacenza sotto zero' : `${intero(imp.sotto_zero.length)} giacenze sotto zero`}, da correggere (non entrano nella cifra): {imp.sotto_zero.map(s => `${s.sito} ${NOMI_CANALE[s.canale] || s.canale} ${t(s.giacenza_t)}`).join(' · ')}.
            </p>
          )}
          {imp.doppioni > 0 && <p className="text-xs text-muted-foreground">{intero(imp.doppioni)} {imp.doppioni === 1 ? 'dichiarazione doppia' : 'dichiarazioni doppie'}: la voce è in Da gestire.</p>}
          {imp.caricati_dopo.length > 0 && (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
              Dopo il controllo della notte sono stati caricati: {imp.caricati_dopo.map(a => `${a.nome} (${giornoMese(a.il)})`).join(', ')}. I numeri di adesso sono in Giacenze e Dichiarazioni Impianti.
            </p>
          )}
        </div>
      )}
    </Sezione>
  );
}
