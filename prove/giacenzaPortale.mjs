// Prova dei terminati con le date da sistemare nelle giacenze (base44/shared/giacenzaPortale.ts).
// Regola dell'utente del 22/09/2026: immissione, inizio e fine trasporto sono
// obbligatorie nei formulari e, dove mancano, si segnalano sempre. Senza fine
// trasporto un ordine non si colloca in nessun mese e non entra nella giacenza
// calcolata; se il portale lo conosce, nella sua giacenza c'e': la differenza si
// dice. Rete, ACI ed extra raccolta restano su gruppi e conteggi separati.
// npm run prove
import { formulariDaSistemare, avvisoSenzaFine, ordiniNotiAlPortale, formulariDelFile, collocaFotografia, fotoAFineMese } from '../base44/shared/giacenzaPortale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const completo = { stato: 'Terminato', ordine_immesso_il: '2026-08-01T08:00:00Z', trasporto_iniziato_il: '2026-08-03T08:00:00Z', trasporto_finito_il: '2026-08-03T12:00:00Z', peso_effettivo: 1000 };
const arrivo = (sito, canale = 'RETE') => ({ tipo: 'primaria', canale, ruolo: 'imp', verso: 'arrivo', sito, controparte: 'Raccoglitore' });

console.log('CHI SI SEGNALA');
const f = formulariDaSistemare({ anno: 2026 });
verifica('un formulario completo non si segnala', f.segna({ ...completo, id_ordine: 'P0' }, arrivo('Irigom')) === false);
verifica('un ordine non terminato non si giudica', f.segna({ ...completo, stato: 'assegnato', trasporto_finito_il: null, id_ordine: 'P00' }, arrivo('Irigom')) === false);
verifica('senza fine trasporto: si segnala', f.segna({ ...completo, id_ordine: 'P1', trasporto_finito_il: null, peso_effettivo: 8000 }, arrivo('Irigom')) === true);
f.segna({ ...completo, id_ordine: 'P2', trasporto_finito_il: null, peso_effettivo: 4340 }, arrivo('Irigom'));
verifica('senza inizio trasporto: si segnala, ma e\' nei conti', f.segna({ ...completo, id_ordine: 'P3', trasporto_iniziato_il: null }, arrivo('Irigom')) === true);
verifica('fine trasporto del 2025: e\' di un altro anno', f.segna({ ...completo, id_ordine: 'P4', trasporto_iniziato_il: null, trasporto_finito_il: '2025-12-10T10:00:00Z', ordine_immesso_il: '2025-12-01T10:00:00Z' }, arrivo('Irigom')) === false);
verifica('senza nessuna data: si segnala in ogni anno', f.segna({ stato: 'Terminato', id_ordine: 'P5', peso_effettivo: 500 }, arrivo('Irigom', 'ACI')) === true);
verifica('lo stesso ordine due volte vale uno', f.segna({ ...completo, id_ordine: 'P3', trasporto_iniziato_il: null }, arrivo('Irigom')) === true);
// Una secondaria senza fine trasporto: parte dallo stoccaggio e arriva all'impianto.
const sec = { ...completo, id_ordine: 'S1', trasporto_finito_il: null, peso_effettivo: 20000 };
f.segna(sec, { tipo: 'secondaria', canale: 'RETE', ruolo: 'imp', verso: 'arrivo', sito: 'Irigom', controparte: 'Nappi Sud' });
f.segna(sec, { tipo: 'secondaria', canale: 'RETE', ruolo: 'stoc', verso: 'partenza', sito: 'Nappi Sud', controparte: 'Irigom' });
f.segna({ ...completo, id_ordine: 'E1', trasporto_finito_il: null, peso_effettivo: 3000 }, arrivo('Irigom', 'EXTRA_RACCOLTA'));

const portale = ordiniNotiAlPortale();
portale.segna({ ordine_primaria: 'P1' });
const gruppi = f.gruppi(portale);
const g = (sito, ruolo, canale) => gruppi.find(x => x.sito === sito && x.ruolo === ruolo && x.canale === canale);

console.log('PER SOGGETTO E PER CANALE');
const rete = g('Irigom', 'imp', 'RETE');
verifica('Irigom rete: quattro formulari (P1, P2, P3, S1)', rete && rete.n === 4, JSON.stringify(rete && rete.ordini.map(o => o.id_ordine)));
verifica('tre senza fine trasporto, 32.340 kg', rete.senza_fine.n === 3 && rete.senza_fine.arrivi_kg === 32340);
verifica('il portale conosce P1 (8.000 kg)', rete.senza_fine.noti_al_portale_n === 1 && rete.senza_fine.noti_al_portale_kg === 8000);
verifica('P2 e S1 il portale non li conosce', rete.senza_fine.ignoti_al_portale_n === 2);
verifica('prima i senza fine trasporto', rete.ordini[0].senza_fine && !rete.ordini[rete.ordini.length - 1].senza_fine);
verifica('P3 dice che manca l\'inizio trasporto', rete.ordini.find(o => o.id_ordine === 'P3').testo === 'manca la data di inizio trasporto');
verifica('l\'ACI sta nel suo gruppo', g('Irigom', 'imp', 'ACI') && g('Irigom', 'imp', 'ACI').n === 1);
verifica('l\'extra raccolta nel suo, e il portale non si interroga', g('Irigom', 'imp', 'EXTRA_RACCOLTA').ordini[0].noto_al_portale === null);
verifica('la secondaria compare anche sullo stoccaggio, come partenza', g('Nappi Sud', 'stoc', 'RETE') && g('Nappi Sud', 'stoc', 'RETE').senza_fine.partenze_n === 1);
const conti = f.perCanale();
verifica('per canale: rete 4 formulari, la secondaria una volta sola', conti.RETE.n === 4 && conti.RETE.senza_fine === 3, JSON.stringify(conti.RETE));
verifica('per canale: ACI 1, extra 1, mai sommati', conti.ACI.n === 1 && conti.EXTRA_RACCOLTA.n === 1 && !('totale' in conti));

console.log('A PAROLE');
const q = avvisoSenzaFine(rete, 'quadratura');
verifica('quadratura: nessun mese', q.includes('in nessun mese'), q);
verifica('quadratura: la calcolata esce piu\' bassa del peso che il portale conosce', q.includes("la giacenza calcolata esce piu' bassa di 8.000 kg"), q);
verifica('quadratura: quelli che il portale non conosce non sono in nessuna delle due', q.includes('non li conosce ancora') && q.includes('nessuna delle due giacenze'), q);
const gz = avvisoSenzaFine(rete, 'giacenze');
verifica('giacenze: fuori dai carichi aggiunti alla fotografia', gz.includes('carichi aggiunti alla fotografia'), gz);
verifica('stoccaggio: fuori dai movimenti dopo la rilevazione', avvisoSenzaFine(g('Nappi Sud', 'stoc', 'RETE')).includes('dopo la rilevazione'));
verifica('extra raccolta: a portale non c\'e\'', avvisoSenzaFine(g('Irigom', 'imp', 'EXTRA_RACCOLTA')).includes("a portale non c'e'"));
const soloInizio = formulariDaSistemare({ anno: 2026 });
soloInizio.segna({ ...completo, id_ordine: 'X', trasporto_iniziato_il: null }, arrivo('Gatim'));
verifica('senza la sola data di inizio: nessun avviso sui conti', avvisoSenzaFine(soloInizio.gruppi()[0]) === '');
verifica('mai la chiusura al posto della fine', formulariDaSistemare().segna({ ...completo, id_ordine: 'C', trasporto_finito_il: null, ordine_chiuso_il: '2026-08-05T08:00:00Z' }, arrivo('Gatim')) === true);

console.log('FRA I NON DICHIARATI O GIA\' DICHIARATO');
// Il portale conosce un ordine dal file dei non dichiarati (lo conta nella sua
// giacenza) o dal report delle dichiarazioni (l'ha gia' dichiarato): la
// differenza col gestionale si dice in un modo o nell'altro.
const due = formulariDaSistemare({ anno: 2026 });
due.segna({ ...completo, id_ordine: 'F1', trasporto_finito_il: null, peso_effettivo: 5000 }, arrivo('Gatim'));
due.segna({ ...completo, id_ordine: 'D1', trasporto_finito_il: null, peso_effettivo: 2000 }, arrivo('Gatim'));
due.segna({ ...completo, id_ordine: 'A1', trasporto_finito_il: null, peso_effettivo: 900 }, arrivo('Gatim', 'ACI'));
const portale2 = ordiniNotiAlPortale();
portale2.segna({ ordine_primaria: 'F1', fine_trasporto: '2026-08-04T10:00:00Z' });
portale2.segna({ ordine_primaria: 'D1' }, 'dichiarazioni');
portale2.segna({ ordine_primaria: 'A1' });
verifica('nel file: nella giacenza del portale', portale2.nelFile({ id_ordine: 'F1' }) === true && portale2.noto({ id_ordine: 'F1' }) === true);
verifica('solo nel report delle dichiarazioni: noto, ma non nella giacenza', portale2.nelFile({ id_ordine: 'D1' }) === false && portale2.noto({ id_ordine: 'D1' }) === true);
verifica('la fine trasporto scritta dal portale', portale2.fineAPortale({ id_ordine: 'F1' }) === '2026-08-04' && portale2.fineAPortale({ id_ordine: 'D1' }) === '');
const gatim = due.gruppi(portale2).find(x => x.sito === 'Gatim' && x.canale === 'RETE');
verifica('uno nel file (5.000 kg), uno gia\' dichiarato (2.000 kg)', gatim.senza_fine.nel_file_n === 1 && gatim.senza_fine.nel_file_kg === 5000 && gatim.senza_fine.gia_dichiarati_n === 1 && gatim.senza_fine.gia_dichiarati_kg === 2000, JSON.stringify(gatim.senza_fine));
verifica('l\'ordine porta la data del portale', gatim.ordini.find(o => o.id_ordine === 'F1').fine_a_portale === '2026-08-04' && gatim.senza_fine.fine_a_portale_n === 1);
const q2 = avvisoSenzaFine(gatim, 'quadratura');
// Fra i non dichiarati e' certo che la calcolata esce piu' bassa; gia' dichiarato
// solo se quella dichiarazione e' registrata anche qui come caricata.
verifica('quadratura: fra i non dichiarati la calcolata esce piu\' bassa, di certo', q2.includes('fra gli ordini non dichiarati') && q2.includes("piu' bassa di 5.000 kg") && !q2.includes("piu' bassa di 7.000"), q2);
verifica('quadratura: gia\' dichiarato, solo se registrato anche qui', q2.includes("gia' dichiarato") && q2.includes('se la dichiarazione e\' registrata anche qui come caricata') && q2.includes('anche di quei 2.000 kg'), q2);
verifica('la data del portale va riportata', q2.includes('va riportata nel formulario'), q2);
const gz2 = avvisoSenzaFine(gatim, 'giacenze');
verifica('giacenze: quello nel file e\' nella giacenza a portale', gz2.includes('nella giacenza a portale: il gestionale non lo colloca'), gz2);
verifica('giacenze: quello gia\' dichiarato nella giacenza non c\'e\' piu\'', gz2.includes("nella giacenza non c'e' piu'"), gz2);
const aci = due.gruppi(portale2).find(x => x.sito === 'Gatim' && x.canale === 'ACI');
verifica('ACI: i file del portale sono della rete, non si chiede', aci.ordini[0].noto_al_portale === null && aci.ordini[0].nel_file === null && aci.ordini[0].fine_a_portale === '');

console.log('STOCCAGGIO: PRIMA O DOPO LA RILEVAZIONE');
const st = formulariDaSistemare({ anno: 2026 });
st.segna({ ...completo, id_ordine: 'PS', trasporto_finito_il: null, peso_effettivo: 3000 }, { tipo: 'primaria', canale: 'RETE', ruolo: 'stoc', verso: 'arrivo', sito: 'Nappi Sud', controparte: 'Raccoglitore' });
const avvStoc = avvisoSenzaFine(st.gruppi()[0], 'quadratura');
verifica('non si sa se e\' prima o dopo la rilevazione', avvStoc.includes('prima o dopo la rilevazione') && avvStoc.includes('non lo conta'), avvStoc);
verifica('e nella calcolata non entra', avvStoc.includes('Nella giacenza calcolata non entra'), avvStoc);

console.log('LE RIGHE DEL FILE DEI NON DICHIARATI');
const file = formulariDelFile();
verifica('un formulario completo non si tiene', file.segna({ ...completo, id_ordine: 'OK' }) === false);
file.segna({ ...completo, id_ordine: 'PF', trasporto_finito_il: null }, 'primaria');
file.segna({ ...completo, id_ordine: 'PI', trasporto_iniziato_il: null }, 'primaria');
file.segna({ ...completo, id_ordine: 'SF', trasporto_finito_il: null }, 'secondaria');
const rigaSenzaFine = file.diRiga({ ordine_primaria: 'PF', fine_trasporto: '2026-08-02T09:00:00Z' });
verifica('primaria senza fine: fuori dai mesi, con la data del portale', rigaSenzaFine.fuori === true && rigaSenzaFine.fine_a_portale === '2026-08-02' && rigaSenzaFine.formulari[0].testo === 'manca la data di fine trasporto', JSON.stringify(rigaSenzaFine));
const rigaInizio = file.diRiga({ ordine_primaria: 'PI' });
verifica('senza la sola data di inizio: si segnala ma e\' nei mesi', rigaInizio.formulari.length === 1 && rigaInizio.fuori === false && rigaInizio.fine_a_portale === '');
const rigaDaStoc = file.diRiga({ ordine_primaria: 'PF', ordine_secondaria: 'S-OK', destinazione_secondaria: 'Irigom', fine_trasporto: '2026-08-02T09:00:00Z' });
verifica('passata da uno stoccaggio con la secondaria a posto: all\'impianto e\' arrivata con la sua data', rigaDaStoc.fuori === false && rigaDaStoc.formulari.length === 1);
const rigaSecSenzaFine = file.diRiga({ ordine_primaria: 'OK', ordine_secondaria: 'SF', destinazione_secondaria: 'Irigom', fine_trasporto: '2026-08-02T09:00:00Z' });
verifica('secondaria senza fine: fuori dai mesi, e la data del file (della primaria) non vale per lei', rigaSecSenzaFine.fuori === true && rigaSecSenzaFine.fine_a_portale === '' && rigaSecSenzaFine.formulari[0].tipo === 'secondaria');
verifica('una riga a posto: niente', file.diRiga({ ordine_primaria: 'OK' }).formulari.length === 0 && file.diRiga({ ordine_primaria: 'OK' }).fuori === false);
// Il rovescio: il file non scrive la fine trasporto, il gestionale si'. Vale quella.
file.segna({ ...completo, id_ordine: 'G1', trasporto_finito_il: '2026-08-03T21:30:00Z' }, 'primaria');
// le 21:30 UTC del 3 agosto sono le 23:30 in Italia: ancora il 3
verifica('riga senza fine nel file: la fine trasporto del gestionale, sul giorno italiano', file.diRiga({ ordine_primaria: 'G1' }).fine_dal_gestionale === '2026-08-03', file.diRiga({ ordine_primaria: 'G1' }).fine_dal_gestionale);
verifica('se il file la scrive, vale quella del file', file.diRiga({ ordine_primaria: 'G1', fine_trasporto: '2026-08-02T08:00:00Z' }).fine_dal_gestionale === '');
verifica('un ordine non terminato non da\' la data', (() => { const f2 = formulariDelFile(); f2.segna({ ...completo, stato: 'assegnato', id_ordine: 'N1' }); return f2.diRiga({ ordine_primaria: 'N1' }).fine_dal_gestionale === ''; })());

console.log('IMMESSO IN UN ALTRO ANNO: LA FOTOGRAFIA NON HA ANNO');
// Revisione del 22/09/2026: immesso il 29/12/2025, arrivato senza fine trasporto
// e fra i non dichiarati. Nella vista 2026 veniva scartato per l'anno
// dell'immissione, e i suoi 9.000 kg - nella giacenza a portale - non comparivano
// da nessuna parte. Se il portale lo conosce resta, in ogni anno.
const dicembre = { stato: 'Terminato', id_ordine: 'DIC1', ordine_immesso_il: '2025-12-29T09:00:00Z', trasporto_iniziato_il: '2026-01-07T07:00:00Z', trasporto_finito_il: null, peso_effettivo: 9000 };
const ignotoDic = { ...dicembre, id_ordine: 'DIC2', peso_effettivo: 1500 };
const conFine2025 = { ...completo, id_ordine: 'DIC3', ordine_immesso_il: '2025-12-01T09:00:00Z', trasporto_iniziato_il: null, trasporto_finito_il: '2025-12-10T10:00:00Z' };
const portaleDic = ordiniNotiAlPortale();
portaleDic.segna({ ordine_primaria: 'DIC1', fine_trasporto: '2026-01-07T12:00:00Z' });
const v26 = formulariDaSistemare({ anno: 2026 });
verifica('immesso nel 2025 senza fine: si tiene in sospeso', v26.segna(dicembre, arrivo('Gatim')) === true);
v26.segna(ignotoDic, arrivo('Gatim'));
verifica('con la fine trasporto nel 2025: e\' di quell\'anno, non si tiene', v26.segna(conFine2025, arrivo('Gatim')) === false);
const gDic = v26.gruppi(portaleDic).find(x => x.sito === 'Gatim' && x.canale === 'RETE');
verifica('vista 2026: il portale lo conosce e resta, con i suoi 9.000 kg fra i non dichiarati', gDic && gDic.n === 1 && gDic.ordini[0].id_ordine === 'DIC1' && gDic.ordini[0].fuori_anno === true && gDic.senza_fine.nel_file_kg === 9000, JSON.stringify(gDic));
verifica('quello che il portale non conosce resta nel suo anno', !gDic.ordini.some(o => o.id_ordine === 'DIC2'));
verifica('lo dice l\'avviso', avvisoSenzaFine(gDic, 'quadratura').includes('immesso in un altro anno') && avvisoSenzaFine(gDic, 'quadratura').includes("piu' bassa di 9.000 kg"), avvisoSenzaFine(gDic, 'quadratura'));
verifica('e il conteggio per canale lo conta, con lo stesso portale', v26.perCanale(portaleDic).RETE.n === 1 && v26.perCanale(portaleDic).RETE.arrivi_senza_fine_kg === 9000);
verifica('senza il portale non si puo\' chiedere: resta nel suo anno', v26.gruppi().length === 0 && v26.perCanale().RETE.n === 0);
const v25 = formulariDaSistemare({ anno: 2025 });
v25.segna(ignotoDic, arrivo('Gatim'));
verifica('nella vista 2025 quello sconosciuto c\'e\'', v25.gruppi(portaleDic).length === 1 && v25.gruppi(portaleDic)[0].ordini[0].fuori_anno === false);
const aciDic = formulariDaSistemare({ anno: 2026 });
aciDic.segna({ ...dicembre, id_ordine: 'DIC1' }, arrivo('Gatim', 'ACI'));
verifica('ACI di un altro anno: il portale non si interroga, resta nel suo anno', aciDic.gruppi(portaleDic).length === 0);

console.log('ARRIVI E PARTENZE: MAI UN PESO CHE LI SOMMA');
// Revisione del 22/09/2026: un arrivo da 10.000 kg e una terziaria da 25.000 kg
// davano "2 senza fine trasporto (35.000 kg)" nella quadratura.
const versi = formulariDaSistemare({ anno: 2026 });
versi.segna({ ...completo, id_ordine: 'AR1', trasporto_finito_il: null, peso_effettivo: 10000 }, arrivo('Gatim'));
versi.segna({ ...completo, id_ordine: 'TER1', trasporto_finito_il: null, peso_effettivo: 25000 }, { tipo: 'terziaria', canale: 'RETE', ruolo: 'imp', verso: 'partenza', sito: 'Gatim', controparte: 'Cementeria' });
const secSF = { ...completo, id_ordine: 'SSF', trasporto_finito_il: null, peso_effettivo: 22000 };
versi.segna(secSF, { tipo: 'secondaria', canale: 'RETE', ruolo: 'imp', verso: 'arrivo', sito: 'Irigom', controparte: 'Nappi Sud' });
versi.segna(secSF, { tipo: 'secondaria', canale: 'RETE', ruolo: 'stoc', verso: 'partenza', sito: 'Nappi Sud', controparte: 'Irigom' });
const gv = versi.gruppi().find(x => x.sito === 'Gatim');
verifica('arrivi e partenze divisi, ciascuno col suo peso', gv.senza_fine.arrivi_n === 1 && gv.senza_fine.arrivi_kg === 10000 && gv.senza_fine.partenze_n === 1 && gv.senza_fine.partenze_kg === 25000, JSON.stringify(gv.senza_fine));
verifica('nessun peso che somma arrivi e partenze', !('kg' in gv.senza_fine) && !('kg' in gv) && !JSON.stringify(gv).includes('35000'), JSON.stringify(gv));
verifica('il conteggio dei formulari resta: 2 da sistemare', gv.senza_fine.n === 2 && gv.n === 2);
const cv = versi.perCanale().RETE;
verifica('per canale: la secondaria e\' un arrivo, una volta sola; la terziaria una partenza', cv.n === 3 && cv.arrivi_senza_fine === 2 && cv.arrivi_senza_fine_kg === 32000 && cv.partenze_senza_fine === 1 && cv.partenze_senza_fine_kg === 25000, JSON.stringify(cv));
verifica('per canale: nessun peso che li somma', !('senza_fine_kg' in cv) && !JSON.stringify(cv).includes('57000'), JSON.stringify(cv));
const avvV = avvisoSenzaFine(gv, 'quadratura');
verifica('l\'avviso li scrive separati', avvV.includes('1 ordine arrivato (10.000 kg)') && avvV.includes('1 terziaria partita (25.000 kg)') && !avvV.includes('35.000'), avvV);

console.log('LA FOTOGRAFIA SUL GIORNO DI ARRIVO (collocaFotografia)');
// Il blocco dei non dichiarati di riepilogoDichiarazioni, estratto per provarlo.
// Da qui escono portale_fine_mese (la pratica di Irigom) e le caselle del Riepilogo.
const righeFoto = [
  // diretta all'impianto
  { ordine_primaria: 'D1', destinazione: 'Irigom', prodotto: 'P', peso_non_dichiarato_kg: 5000, fine_trasporto: '2026-08-10T09:00:00Z' },
  // passata da Nappi Sud: allo stoccaggio a luglio, all'impianto a settembre con la secondaria
  { ordine_primaria: 'N1', ordine_secondaria: 'S-OK', destinazione: 'Nappi Sud', destinazione_secondaria: 'Irigom', prodotto: 'P', peso_non_dichiarato_kg: 8000, fine_trasporto: '2026-07-20T09:00:00Z' },
  // passata da Nappi Sud, ma la secondaria nel gestionale e' terminata senza fine trasporto
  { ordine_primaria: 'N2', ordine_secondaria: 'S-SF', destinazione: 'Nappi Sud', destinazione_secondaria: 'Irigom', prodotto: 'P', peso_non_dichiarato_kg: 20000, fine_trasporto: '2026-07-21T09:00:00Z' },
  // il file non scrive la fine trasporto: vale quella della primaria nel gestionale
  { ordine_primaria: 'G1', destinazione: 'Irigom', prodotto: 'P', peso_non_dichiarato_kg: 3000, fine_trasporto: null },
  // nessuna fine trasporto, ne' nel file ne' nel gestionale
  { ordine_primaria: 'X1', numero_fir: 'FIRX', destinazione: 'Irigom', prodotto: 'P', peso_non_dichiarato_kg: 1000, fine_trasporto: null },
  // arrivato a dicembre dell'anno prima
  { ordine_primaria: 'V1', destinazione: 'Irigom', prodotto: 'P', peso_non_dichiarato_kg: 700, fine_trasporto: '2025-12-20T09:00:00Z' },
  // diretta a uno stoccaggio: la attribuisce allo stoccaggio, non e' giacenza d'impianto
  { ordine_primaria: 'ST1', destinazione: 'Nappi Sud', prodotto: 'P', peso_non_dichiarato_kg: 4000, fine_trasporto: '2026-08-01T09:00:00Z' },
  // una riga ACI, se mai ci fosse, non entra
  { ordine_primaria: 'A1', destinazione: 'Irigom', prodotto: 'PFU Autodemolizione classe 9', peso_non_dichiarato_kg: 600, fine_trasporto: '2026-08-02T09:00:00Z' },
];
const secFoto = [
  { id_ordine: 'S-OK', stato: 'Terminato', trasporto_finito_il: '2026-09-02T08:00:00Z' },
  { id_ordine: 'S-SF', stato: 'Terminato', trasporto_finito_il: null },
];
const foto = collocaFotografia(righeFoto, {
  chiaveDi: (s) => String(s || '').trim().toLowerCase(),
  ruoloPrimaria: (id) => (id === 'ST1' ? 'stoc' : 'imp'),
  secondarie: secFoto,
  finePrimaria: (id) => (id === 'G1' ? '2026-08-15' : ''),
});
verifica('giacenza a portale di Irigom: tutto il file, anche i carichi senza giorno', Math.round(foto.portale.get('irigom') * 1000) === 37700, foto.portale.get('irigom'));
verifica('la riga ACI resta fuori', !foto.portale.has('pfu') && Math.round(foto.portale.get('irigom') * 1000) === 37700);
verifica('la primaria allo stoccaggio: in attesa, allo stoccaggio', Math.round(foto.inAttesa.get('nappi sud') * 1000) === 4000);
verifica('passata da uno stoccaggio: il mese e\' quello della secondaria (settembre), non della riga (luglio)', foto.perMese.get('irigom|2026-09') === 8000 && !foto.perMese.has('irigom|2026-07'), JSON.stringify([...foto.perMese]));
verifica('la riga senza fine trasporto prende quella del gestionale (agosto)', foto.perMese.get('irigom|2026-08') === 8000, JSON.stringify([...foto.perMese]));
verifica('dicembre dell\'anno prima non e\' il dicembre di quest\'anno', foto.perMese.get('irigom|2025-12') === 700 && !foto.perMese.has('irigom|2026-12'));
const sg = foto.senzaGiorno.get('irigom');
verifica('senza giorno: la secondaria senza fine e la riga senza nessuna fine, col perche\'', sg && sg.n === 2 && sg.kg === 21000
  && sg.ordini.some(o => o.ordine_secondaria === 'S-SF' && o.perche.includes('la secondaria')) && sg.ordini.some(o => o.ordine_primaria === 'X1' && o.numero_fir === 'FIRX'), JSON.stringify(sg));
const fm = fotoAFineMese(foto, 'irigom', 2026);
// Luglio: solo dicembre 2025 (la riga N1 arriva a settembre, N2 non ha giorno).
verifica('fine luglio: 700 kg, la secondaria senza fine non entra col giorno della primaria', fm[6] === 700, JSON.stringify(fm));
verifica('fine agosto: 700 + 5.000 + 3.000', fm[7] === 8700, JSON.stringify(fm));
verifica('fine settembre: piu\' gli 8.000 arrivati con la secondaria', fm[8] === 16700 && fm[11] === 16700, JSON.stringify(fm));
verifica('i 21.000 kg senza giorno sono a portale ma in nessuna fine mese', Math.round(foto.portale.get('irigom') * 1000) - fm[11] === 21000);
verifica('dodici numeri interi', fm.length === 12 && fm.every(Number.isInteger));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
