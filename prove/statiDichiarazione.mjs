// Prova degli stati delle dichiarazioni degli impianti (base44/shared/dichiarazioniImpianti.ts):
// un mese senza dichiarazione puo' essere a posto lo stesso, se la dichiarazione
// non e' dovuta o se dall'impianto sono usciti solo metalli ferrosi.
// npm run prove
import { statoDichiarazione, controlliDichiarazione, STATI, MOTIVI_ASSENZA } from '../base44/shared/dichiarazioniImpianti.ts';

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

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
