// Prova degli stati delle dichiarazioni degli impianti (base44/shared/dichiarazioniImpianti.ts):
// un mese senza dichiarazione puo' essere a posto lo stesso, se la dichiarazione
// non e' dovuta o se dall'impianto sono usciti solo metalli ferrosi.
// npm run prove
import { statoDichiarazione, controlliDichiarazione, quadratura, STATI, MOTIVI_ASSENZA } from '../base44/shared/dichiarazioniImpianti.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('GLI STATI');
verifica('senza dichiarazione', statoDichiarazione(null) === 'nessuna');
verifica('caricata', statoDichiarazione({ quantita_kg: 100, caricata_inviata: true }) === 'caricata');
verifica('in mano', statoDichiarazione({ quantita_kg: 100, ricevuta_email: true }) === 'ricevuta');
verifica('solo metalli (Irigom, aprile)', statoDichiarazione({ quantita_kg: 0, motivo_assenza: 'solo_metalli' }) === 'solo_metalli');
verifica('non dovuta, segnata', statoDichiarazione({ quantita_kg: 0, motivo_assenza: 'non_dovuta' }) === 'non_dovuta');
verifica('non dovuta per accordo (Tecnogum, rete)', statoDichiarazione(null, { canale: 'RETE', dichiara_rete: false }) === 'non_dovuta');
verifica("l'accordo vale solo per la rete", statoDichiarazione(null, { canale: 'ACI', dichiara_rete: false }) === 'nessuna');
verifica('con una quantita\' vale la quantita\'', statoDichiarazione({ quantita_kg: 500, motivo_assenza: 'solo_metalli', ricevuta_email: true }) === 'ricevuta');
verifica('ogni stato ha il suo nome', ['nessuna', 'non_dovuta', 'solo_metalli', 'inserita', 'ricevuta', 'caricata'].every(k => STATI[k] && STATI[k].nome));
verifica('i due motivi hanno nome e spiegazione', Object.values(MOTIVI_ASSENZA).every(m => m.nome && m.spiega));

console.log('I CONTROLLI');
const mancante = (d) => controlliDichiarazione(d, 50000, 'R1', { canale: 'RETE' }).some(c => c.tipo === 'mancante');
verifica('conferito senza dichiarazione: manca', mancante(null));
verifica('solo metalli: non manca niente', !mancante({ quantita_kg: 0, motivo_assenza: 'solo_metalli' }));
verifica('non dovuta: non manca niente', !mancante({ quantita_kg: 0, motivo_assenza: 'non_dovuta' }));
verifica('motivo e quantita\' insieme: lo dice', controlliDichiarazione({ quantita_kg: 100, motivo_assenza: 'non_dovuta' }, 100, 'R1', {}).some(c => c.tipo === 'motivo_con_quantita'));

console.log('LA GIACENZA E UNA FORMULA SOLA, PER TUTTI E TRE I CANALI');
{
  // Il canale era cablato nel nome del campo (dichiarato_caricato_rete_t), e cosi
  // la giacenza esisteva solo per la rete. Ora il chiamante passa il dichiarato
  // del canale di quella riga (utente, 03/10/2026).
  const base = { giacenza_iniziale_t: 10, entrato_confronto_t: 100, uscito_confronto_t: 0, giacenza_portale_t: null };
  verifica('il dichiarato del canale decurta', quadratura({ ...base, dichiarato_caricato_t: 40 }).giacenza_calcolata_t === 70);
  verifica('il vecchio campo della rete resta accettato', quadratura({ ...base, dichiarato_caricato_rete_t: 40 }).giacenza_calcolata_t === 70);
  // Sotto zero NON si azzera: e un errore da correggere e si deve vedere.
  verifica('una giacenza sotto zero resta negativa', quadratura({ ...base, dichiarato_caricato_t: 200 }).giacenza_calcolata_t === -90);
}

// «CONFERITI N KG E NESSUNA DICHIARAZIONE» NON SI DICE DI UN MESE GIA USCITO.
//
// Un mese senza dichiarazione scritta sopra puo' essere uscito tutto, perche' lo
// ha portato via la dichiarazione di un mese dopo: su T-Cycle e' il caso di
// gennaio, febbraio, aprile e maggio 2026. Dal 09/10/2026 l'avviso guarda quello
// che di quel mese resta (resta_kg, shared/usciteDichiarate.ts) e non la sola
// fotografia del portale, che e' di un giorno preciso.
console.log('L AVVISO DEL MESE SENZA DICHIARAZIONE SEGUE CIO CHE RESTA');
{
  const manca = (dove) => controlliDichiarazione(null, 87740, 'R1', { canale: 'RETE', ...dove }).some(c => c.tipo === 'mancante');
  verifica('gennaio di T-Cycle, uscito tutto con la nave di marzo: nessun avviso', !manca({ resta_kg: 0 }));
  verifica('un mese che ha ancora qualcosa dentro: l avviso c e', manca({ resta_kg: 20620 }));
  verifica('e senza quel dato si ripiega sulla fotografia, come prima',
    !manca({ non_dichiarato_kg: 0 }) && manca({ non_dichiarato_kg: 41980 }) && manca({}));
  verifica('cio che resta ha la precedenza sulla fotografia, che puo essere vecchia di settimane',
    !manca({ resta_kg: 0, non_dichiarato_kg: 41980 }));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
