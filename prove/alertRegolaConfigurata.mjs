// IL GIORNO DELLA CONFIGURAZIONE DI UNA REGOLA ALERT (decisioni dell'utente del
// 13/10/2026).
//
// Le regole di tratta valgono sull'anno prima solo se scritte prima del 01/01
// (runAlertEngine, scrittaPrimaDellAnno). «Scritta» voleva dire created_date e
// updated_date, e la pagina Alert Engine, per attivare o disattivare una regola,
// la aggiorna: una regola del 2026 disattivata e riattivata a gennaio 2027
// diventava del 2027 e il 2026 non lo misurava piu'. Ora la regola porta il
// giorno della configurazione (configurata_il) con la sua impronta
// (impronta_configurazione), e il motore si fida del giorno solo se l'impronta
// torna. Qui:
//   1. la regola (base44/shared/configurazioneRegolaAlert.ts) e il suo specchio
//      per le pagine (src/lib/configurazioneRegolaAlert.js) sono identici, salvo
//      intestazione e import, come vuole prove/specchi.mjs;
//   2. l'impronta: modulo, tipo e config, con le chiavi in qualunque ordine; nome,
//      severita', messaggio e attiva non ne fanno parte;
//   3. il giorno di cui fidarsi, e quando non ci si fida;
//   4. che cosa scrivono «Salva regola» e «Attiva/Disattiva»: la regola nuova e'
//      configurata oggi (giorno italiano); attivare scrive solo attiva, e una
//      regola di prima prende il giorno della sua ultima scrittura, mai oggi;
//   5. la pagina usa queste funzioni, e mostra il giorno;
//   6. l'archivio RegolaAlert dichiara i due campi: un campo non dichiarato la
//      piattaforma non lo salva.
// Il motore con questi campi, sul banco: prove/alertCambioAnno.mjs, sezione 13.
//
// node prove/alertRegolaConfigurata.mjs
import { readFileSync } from 'node:fs';
import { caricaLibPagine } from './dati/libPagine.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;
const leggi = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');

// La data di oggi finta: new Date() e Date.now() danno quell'istante, il resto e' vero.
const VeraData = Date;
const conOggi = (iso, fn) => {
  const fisso = VeraData.parse(iso);
  class Finto extends VeraData { constructor(...a) { if (a.length === 0) super(fisso); else super(...a); } static now() { return fisso; } }
  globalThis.Date = Finto;
  try { return fn(); } finally { globalThis.Date = VeraData; }
};

let lib = {};
let shared = {};
try { lib = await caricaLibPagine('lib/configurazioneRegolaAlert'); } catch (e) { verifica('src/lib/configurazioneRegolaAlert.js si carica', false, e.message); }
try { shared = await import('../base44/shared/configurazioneRegolaAlert.ts'); } catch (e) { verifica('base44/shared/configurazioneRegolaAlert.ts si carica', false, e.message); }
const FUNZIONI = ['giornoDellIstante', 'improntaConfigurazione', 'giornoDellaConfigurazione', 'configurataOggi', 'cambioAttivazione'];
verifica('le funzioni ci sono, nella regola e nello specchio', FUNZIONI.every(f => typeof lib[f] === 'function' && typeof shared[f] === 'function'), J([Object.keys(lib), Object.keys(shared)]));
const { improntaConfigurazione = () => '', giornoDellaConfigurazione = () => null, configurataOggi = () => ({}), cambioAttivazione = () => ({}), giornoDellIstante = () => '' } = lib;

console.log('1. LA REGOLA E IL SUO SPECCHIO');
{
  // come prove/specchi.mjs: via il commento di testa e le righe di import
  const corpo = (p) => {
    const righe = leggi(p).split('\n');
    let i = 0;
    while (i < righe.length && (righe[i].startsWith('//') || righe[i].trim() === '')) i++;
    return righe.slice(i).filter(r => !/^import .* from /.test(r)).join('\n').trim();
  };
  let a = '', b = '';
  try { a = corpo('base44/shared/configurazioneRegolaAlert.ts'); b = corpo('src/lib/configurazioneRegolaAlert.js'); } catch (e) { verifica('i due file ci sono', false, e.message); }
  const dove = a.split('\n').findIndex((r, i) => r !== b.split('\n')[i]);
  verifica('identici, salvo intestazione e import', !!a && a === b, `dalla riga ${dove + 1} del corpo`);
}

console.log("2. L'IMPRONTA DELLA CONFIGURAZIONE");
{
  const regola = { id: 'rt', nome: 'Tratta Nappi Sud', modulo: 'secondarie', tipo_regola: 'tratta_autorizzata', severita: 'warning', attiva: true, messaggio_alert: 'x',
    config: { campo_origine: 'stoccaggio', valore_origine: 'NAPPI SUD SRL', destinazioni_ammesse: ['IRIGOM SRL', 'TECNOGUM SRL'] } };
  const base = improntaConfigurazione(regola);
  verifica('e\' un testo', typeof base === 'string' && base.length > 10, J(base));
  verifica('le chiavi in un altro ordine, a ogni livello, non la cambiano', improntaConfigurazione({ config: { destinazioni_ammesse: ['IRIGOM SRL', 'TECNOGUM SRL'], valore_origine: 'NAPPI SUD SRL', campo_origine: 'stoccaggio' }, tipo_regola: 'tratta_autorizzata', modulo: 'secondarie' }) === base);
  const combinazioni = (c) => improntaConfigurazione({ modulo: 'primarie_rete', tipo_regola: 'tratte_autorizzate_classe', config: { classi: ['A'], combinazioni_ammesse: c } });
  verifica('anche dentro gli elenchi di oggetti', combinazioni([{ origine: 'A', destinazione: 'B' }]) === combinazioni([{ destinazione: 'B', origine: 'A' }]));
  verifica('nome, severita\', messaggio e attiva non ne fanno parte', improntaConfigurazione({ ...regola, nome: 'altro', severita: 'critico', attiva: false, messaggio_alert: 'y' }) === base);
  verifica('una destinazione tolta la cambia', improntaConfigurazione({ ...regola, config: { ...regola.config, destinazioni_ammesse: ['IRIGOM SRL'] } }) !== base);
  verifica('anche l\'ordine delle destinazioni, come e\' scritto', improntaConfigurazione({ ...regola, config: { ...regola.config, destinazioni_ammesse: ['TECNOGUM SRL', 'IRIGOM SRL'] } }) !== base);
  verifica('il modulo e il tipo la cambiano', improntaConfigurazione({ ...regola, modulo: 'primarie_rete' }) !== base && improntaConfigurazione({ ...regola, tipo_regola: 'tratta_combinazione' }) !== base);
  verifica('la regola e lo specchio danno la stessa', typeof shared.improntaConfigurazione === 'function' && shared.improntaConfigurazione(regola) === base);
}

console.log('3. IL GIORNO DI CUI FIDARSI');
{
  const regola = { modulo: 'secondarie', tipo_regola: 'tratta_autorizzata', config: { destinazioni_ammesse: ['IRIGOM SRL'] } };
  const firmata = { ...regola, configurata_il: '2026-03-01', impronta_configurazione: improntaConfigurazione(regola) };
  verifica('configurata_il con l\'impronta che torna', giornoDellaConfigurazione(firmata) === '2026-03-01', J(giornoDellaConfigurazione(firmata)));
  verifica('anche se la piattaforma lo restituisce con l\'ora', giornoDellaConfigurazione({ ...firmata, configurata_il: '2026-03-01T00:00:00' }) === '2026-03-01');
  verifica('senza configurata_il: null (il motore ripiega sulle date di sistema)', giornoDellaConfigurazione(regola) === null);
  verifica('configurata_il senza impronta: null', giornoDellaConfigurazione({ ...regola, configurata_il: '2026-03-01' }) === null);
  verifica('configurazione cambiata dopo (fuori dalla pagina): null', giornoDellaConfigurazione({ ...firmata, config: { destinazioni_ammesse: ['GATIM SRL'] } }) === null);
  verifica('un giorno che non e\' un giorno: null', giornoDellaConfigurazione({ ...firmata, configurata_il: 'marzo' }) === null && giornoDellaConfigurazione(null) === null);
}

console.log('4. CHE COSA SCRIVONO «SALVA REGOLA» E «ATTIVA/DISATTIVA»');
{
  const regola = { modulo: 'secondarie', tipo_regola: 'tratta_autorizzata', config: { destinazioni_ammesse: ['IRIGOM SRL'] } };
  const nuova = conOggi('2026-10-13T15:00:00Z', () => configurataOggi(regola));
  verifica('la regola nuova e\' configurata oggi', J(nuova) === J({ configurata_il: '2026-10-13', impronta_configurazione: improntaConfigurazione(regola) }), J(nuova));
  const capodanno = conOggi('2026-12-31T23:30:00Z', () => configurataOggi(regola));
  verifica('oggi e\' il giorno italiano: alle 23:30 UTC del 31/12/2026 e\' gia\' il 01/01/2027', capodanno.configurata_il === '2027-01-01', J(capodanno));

  const firmata = { ...regola, id: 'r', attiva: true, configurata_il: '2026-03-01', impronta_configurazione: improntaConfigurazione(regola), updated_date: '2026-11-02T09:00:00.000000' };
  verifica('una regola firmata: disattivare scrive solo attiva', J(cambioAttivazione(firmata)) === J({ attiva: false }), J(cambioAttivazione(firmata)));
  verifica('e riattivare anche', J(cambioAttivazione({ ...firmata, attiva: false })) === J({ attiva: true }));

  const vecchia = { ...regola, id: 'v', attiva: true, created_date: '2026-03-01T09:00:00.000000', updated_date: '2026-10-05T09:00:00.000000' };
  const primo = conOggi('2027-01-02T10:00:00Z', () => cambioAttivazione(vecchia));
  verifica('una regola di prima prende il giorno della sua ultima scrittura, non oggi', J(primo) === J({ attiva: false, configurata_il: '2026-10-05', impronta_configurazione: improntaConfigurazione(vecchia) }), J(primo));
  verifica('una data di sistema senza fuso e\' UTC: 23:30 del 31/12/2026 e\' il 01/01/2027 in Italia', giornoDellIstante('2026-12-31T23:30:00.000000') === '2027-01-01'
    && giornoDellIstante('2026-12-31T22:30:00.000000') === '2026-12-31' && giornoDellIstante('2026-12-31T22:30:00Z') === '2026-12-31', J(giornoDellIstante('2026-12-31T23:30:00.000000')));
  verifica('senza updated_date vale created_date', cambioAttivazione({ ...vecchia, updated_date: undefined }).configurata_il === '2026-03-01');
  verifica('senza nessuna data, solo attiva', J(cambioAttivazione({ ...regola, attiva: true })) === J({ attiva: false }));
  const aMano = { ...firmata, config: { destinazioni_ammesse: ['GATIM SRL'] }, updated_date: '2027-01-03T09:00:00.000000' };
  verifica('cambiata fuori dalla pagina: si firma col giorno di quella scrittura', J(cambioAttivazione(aMano)) === J({ attiva: false, configurata_il: '2027-01-03', impronta_configurazione: improntaConfigurazione(aMano) }), J(cambioAttivazione(aMano)));
}

console.log('5. LA PAGINA');
{
  const pagina = leggi('src/pages/AlertEngine.jsx');
  const salva = (pagina.match(/const handleSave = async[\s\S]*?\n {2}\};\n/) || [''])[0];
  const attiva = (pagina.match(/const handleToggle = async[\s\S]*?\n {2}\};\n/) || [''])[0];
  verifica('importa le funzioni dallo specchio', /import \{[^}]*configurataOggi[^}]*cambioAttivazione[^}]*\} from '@\/lib\/configurazioneRegolaAlert';/.test(pagina));
  verifica('«Salva regola» scrive il giorno della configurazione', /RegolaAlert\.create\(\{ \.\.\.form, config, \.\.\.configurataOggi\(\{ \.\.\.form, config \}\) \}\)/.test(salva), salva.slice(0, 300));
  verifica('«Attiva/Disattiva» scrive quello che dice cambioAttivazione', /RegolaAlert\.update\(regola\.id, cambioAttivazione\(regola\)\)/.test(attiva), attiva.slice(0, 300));
  verifica('e non scrive piu\' attiva da se\'', !/\{ attiva: !regola\.attiva \}/.test(attiva), attiva.slice(0, 300));
  verifica('la regola dice da quando e\' configurata', /configurata il \{dataConfigurazione\(r\)\}/.test(pagina));
}

console.log("6. L'ARCHIVIO DICHIARA I DUE CAMPI");
{
  const entita = JSON.parse(leggi('base44/entities/RegolaAlert.jsonc'));
  const p = entita.properties || {};
  verifica('configurata_il, un giorno', p.configurata_il && p.configurata_il.type === 'string' && p.configurata_il.format === 'date', J(p.configurata_il));
  verifica('impronta_configurazione, un testo', p.impronta_configurazione && p.impronta_configurazione.type === 'string', J(p.impronta_configurazione));
  verifica('e non sono obbligatori: le regole di prima non li hanno', !(entita.required || []).some(c => ['configurata_il', 'impronta_configurazione'].includes(c)), J(entita.required));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
