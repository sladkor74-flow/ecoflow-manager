// LE DICHIARAZIONI CHE NON SONO DICHIARAZIONI
// (base44/shared/dichiarazioniSeminate.ts).
//
// Regola dell'utente, 02/10/2026: «cio' che non e' veramente dichiarato a
// portale puoi toglierlo, non confondiamoci con cose che non esistono».
//
// Questa prova e' la guardia di una CANCELLAZIONE, e una cancellazione non si
// annulla: qui si controlla soprattutto cio' che NON si tocca.
//
// Il riscontro sui file veri del 02/10/2026 (ReportDichiarazioniDiTrattamento
// delle 22:43, filtrato sul nostro partner operativo, per mese di fine
// trasporto) dice che tre delle nove righe del seme nel frattempo sono diventate
// vere, e con il numero IDENTICO a quello seminato:
//   Green Tyre luglio    256.140 kg dichiarati a portale  (seme 256.140)
//   Green Tyre agosto     94.700 kg dichiarati a portale  (seme  94.700)
//   T.R.S. agosto          9.500 kg dichiarati a portale  (seme   9.500)
// ed e' la conferma che quei numeri erano il «da dichiarare» di allora, poi
// dichiarato per intero. Le altre restano senza riscontro:
//   Gatim giugno, Gatim settembre, T.R.S. settembre, Green Tyre settembre: zero
//   righe con una data di dichiarazione.
// Le tre diventate vere le salva la prima guardia, caricata_inviata, senza che
// l'elenco debba cambiare. npm run prove
import { SEME_NON_DICHIARATO, daTenere, eDelSeme, eVuoto, daTogliere } from '../base44/shared/dichiarazioniSeminate.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const riga = (extra) => ({ id: 'x', sito: 'GREEN TYRE PROJECT SRL', canale: 'RETE', provenienza: '', mese: 'Settembre', quantita_kg: 105740, ...extra });

console.log('CIO\' CHE NON SI TOCCA, MAI');
verifica('una dichiarazione caricata a portale resta', daTenere(riga({ caricata_inviata: true })));
verifica('una ricevuta via email resta', daTenere(riga({ ricevuta_email: true })));
verifica('un mese con un motivo scritto resta', daTenere(riga({ quantita_kg: 0, motivo_assenza: 'solo_metalli' })));
verifica('e anche non dovuta', daTenere(riga({ quantita_kg: 0, motivo_assenza: 'non_dovuta' })));
verifica('un mese coi materiali scritti resta', daTenere(riga({ quantita_kg: 0, cippato_kg: 1200 })));
verifica('e con il ferro', daTenere(riga({ quantita_kg: 0, metalli_kg: 800 })));
{
  // Le tre righe del seme diventate vere: a portale ci sono, e l'allineamento le
  // ha segnate caricate. Nessuna regola in piu' serve a salvarle.
  const vere = [
    { sito: 'GREEN TYRE PROJECT SRL', canale: 'RETE', provenienza: '', mese: 'Luglio', quantita_kg: 256140, caricata_inviata: true },
    { sito: 'GREEN TYRE PROJECT SRL', canale: 'RETE', provenienza: '', mese: 'Agosto', quantita_kg: 94700, caricata_inviata: true },
    { sito: 'T.R.S.  SRL', canale: 'RETE', provenienza: '', mese: 'Agosto', quantita_kg: 9500, caricata_inviata: true },
  ];
  verifica('le righe del seme che il portale ha poi dichiarato non si toccano', daTogliere(vere).length === 0,
    JSON.stringify(daTogliere(vere)));
}

console.log('CIO\' CHE SI TOGLIE');
verifica('la riga del seme, con tutte e cinque le chiavi uguali', eDelSeme(riga({})));
verifica('ma non se la quantita e stata corretta a mano', !eDelSeme(riga({ quantita_kg: 255780 })));
verifica('ne se e di un altro mese', !eDelSeme(riga({ mese: 'Ottobre' })));
verifica('ne se e di un altro canale', !eDelSeme(riga({ canale: 'ACI' })));
verifica('il record vuoto si riconosce', eVuoto({ quantita_kg: 0 }) && !eVuoto({ quantita_kg: 10 }));
{
  const dentro = [
    riga({ id: 'a' }),
    { id: 'b', sito: 'Gatim', canale: 'RETE', provenienza: '', mese: 'Settembre', quantita_kg: 0 },
    { id: 'c', sito: 'Gatim', canale: 'RETE', provenienza: '', mese: 'Giugno', quantita_kg: 112240 },
    { id: 'd', sito: 'Irigom S.r.l.', canale: 'RETE', provenienza: '', mese: 'Marzo', quantita_kg: 262720, caricata_inviata: true },
    { id: 'e', sito: 'Irigom S.r.l.', canale: 'RETE', provenienza: '', mese: 'Aprile', quantita_kg: 0, motivo_assenza: 'solo_metalli' },
  ];
  const fuori = daTogliere(dentro);
  verifica('si tolgono le tre che non esistono, e nessun altra', fuori.length === 3, JSON.stringify(fuori.map(f => f.id)));
  verifica('la dichiarazione caricata di Irigom non e fra quelle', !fuori.some(f => f.id === 'd'));
  verifica('e nemmeno il mese di soli metalli', !fuori.some(f => f.id === 'e'));
  verifica('ogni riga dice perche', fuori.every(f => f.perche && f.perche.length > 20));
  verifica('il vuoto si distingue dal seme',
    fuori.find(f => f.id === 'b').perche.includes('vuoto') && fuori.find(f => f.id === 'c').perche.includes('seme'));
}
{
  // Un elenco vuoto non fa danni, e nemmeno dei record senza niente dentro.
  verifica('senza dichiarazioni non si toglie niente', daTogliere([]).length === 0 && daTogliere(null).length === 0);
  verifica('un record nullo non rompe il conto', daTogliere([null, undefined]).length === 0);
}

console.log('L\'ELENCO DEL SEME');
verifica('sono le nove righe con caricata_inviata false', SEME_NON_DICHIARATO.length === 9, String(SEME_NON_DICHIARATO.length));
verifica('ognuna dice sito, canale, mese e quantita',
  SEME_NON_DICHIARATO.every(s => s.sito && s.canale && s.mese && s.quantita_kg > 0));

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
