import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll, perPagina } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { giornoRoma } from "../../shared/giornoItaliano.ts";
import { eTerminato, periodoMovimento } from "../../shared/movimenti.ts";
import { MESI, operazioneDa, quadratura } from "../../shared/dichiarazioniImpianti.ts";
import { giornoFotografia, ordiniNotiAlPortale, dichiaratoDopoLaFotografia } from "../../shared/giacenzaPortale.ts";

// Dichiarazioni degli impianti, mese per mese, con la quadratura delle giacenze.
//
// Tre regole dell'utente, senza eccezioni (21/09/2026):
// 1. Ogni ragionamento si fa sulla FINE DEL TRASPORTO, mai sulla data di
//    chiusura dell'ordine a portale.
// 2. Ogni caricamento aggiorna tutto: la giacenza a portale non resta ferma al
//    giorno del file degli ordini non dichiarati, ma segue i movimenti caricati
//    dopo, in entrata e in uscita.
// 3. Rete, ACI ed extra raccolta non si mescolano mai: ne' nelle giacenze, ne'
//    nelle dichiarazioni, ne' nei totali.
//
// Chi dichiara e' l'IMPIANTO, perche' e' l'impianto che tratta. Uno stoccaggio
// non tratta: riceve i PFU e li rimanda in secondaria, e in quel viaggio e' il
// PRODUTTORE. La dichiarazione di quello che e' passato da uno stoccaggio si puo'
// chiedere solo dopo il secondo viaggio, e la fa l'impianto che lo ha ricevuto.
// Percio' alle righe da dichiarare di un impianto vanno le primarie arrivate
// all'impianto e le secondarie arrivate dagli stoccaggi, con scritto da quale;
// uno stoccaggio ha entrate, partenze e piazzale, canale per canale. Chi e'
// insieme impianto e stoccaggio (Irigom, T-Cycle) si tiene diviso sul tipo di
// destinazione di ogni movimento.
//
// Payload: { anno }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { anno } = await req.json().catch(() => ({}));
    if (!anno) return Response.json({ error: 'Anno obbligatorio' }, { status: 400 });
    const annoNum = Number(anno);

    const norm = normalizzaRagioneSociale;
    const td = (v) => String(v || '').toLowerCase().trim();
    const t3 = (v) => Math.round(v * 1000) / 1000;
    const peso = (r) => (Number(r.peso_effettivo) || 0);
    const somma = (mappa, chiave, valore) => mappa.set(chiave, (mappa.get(chiave) || 0) + valore);
    // Il mese e l'anno di un movimento sono quelli della fine del trasporto, sul
    // giorno italiano: la regola di tutto il gestionale (shared/movimenti.ts).
    const periodo = (r) => {
      if (!eTerminato(r)) return null;
      const p = periodoMovimento(r);
      return p && p.anno === annoNum ? p : null;
    };
    const CANALI_PORTALE = ['RETE', 'ACI'];

    const svc = base44.asServiceRole.entities;
    const [giacenzeSito, dichiarazioni, aci, extra, secondarie, terziarie, nonDichiarati, rilevazioni] = await Promise.all([
      fetchAll(svc.GiacenzaSito, { anno: annoNum }),
      fetchAll(svc.DichiarazioneSito, { anno: annoNum }),
      fetchAll(svc.PrimariaAci),
      fetchAll(svc.ExtraRaccolta),
      fetchAll(svc.Secondaria),
      fetchAll(svc.Terziaria),
      fetchAll(svc.OrdineNonDichiarato),
      fetchAll(svc.GiacenzaStoccaggio),
    ]);

    // --- La fotografia del portale ---
    // Il file degli ordini non dichiarati e' una fotografia, del giorno in cui e'
    // stato caricato. Che cosa il portale conosce lo dicono i NUMERI D'ORDINE che
    // compaiono lì o nel report delle dichiarazioni: un carico che il gestionale
    // ha e il portale no - arrivato dopo, o non ancora nel file - si aggiunge alla
    // fotografia, cosi' la giacenza a portale segue ogni caricamento.
    // La regola e' una sola per tutto il gestionale: shared/giacenzaPortale.ts.
    const fotoPortale = giornoFotografia(nonDichiarati);
    const portaleConosce = ordiniNotiAlPortale();
    for (const r of nonDichiarati) portaleConosce.segna(r);
    // Il report delle dichiarazioni: che cosa risulta dichiarato al portale per gli
    // ordini dell'anno (per fine trasporto), e quali ordini il portale conosce.
    // Una dichiarazione che il portale ha agganciato a ordini dell'anno prima non
    // compare qui, quindi una differenza non e' per forza un mese sfuggito. Solo
    // rete: se nel report comparisse una riga ACI, resta fuori.
    const dichiaratoPortale = new Map();
    await perPagina(svc.DichiarazioneTrattamento, null, (r) => {
      portaleConosce.segna(r);
      if (eAci({ prodotto: r.prodotto }) || !giornoRoma(r.fine_trasporto).startsWith(String(annoNum))) return;
      const ns = norm(String(r.destinazione_secondaria || '').trim() || r.destinazione);
      if (!ns) return;
      somma(dichiaratoPortale, ns, Number(r.peso_associato_kg) || 0);
    });
    const noto = (r, tipo) => portaleConosce.noto(r, tipo);
    const nonAncora = new Map(); // ns impianto -> [{...}] carichi che la fotografia non contiene
    const segnaNonAncora = (ns, r, tipo) => {
      if (!fotoPortale || noto(r, tipo)) return;
      if (!nonAncora.has(ns)) nonAncora.set(ns, []);
      nonAncora.get(ns).push({
        tipo, id_ordine: r.id_ordine || '', numero_fir: r.numero_fir || '',
        fine_trasporto: giornoRoma(r.trasporto_finito_il), kg: Math.round(peso(r)),
        da: tipo === 'secondaria' ? (r.stoccaggio || '') : (r.trasportatore || ''),
      });
    };
    let movimentiFinoAl = '';
    const segnaFine = (r) => { const g = giornoRoma(r.trasporto_finito_il); if (g > movimentiFinoAl) movimentiFinoAl = g; };

    // --- Chi riceve, per canale e mese: solo cio' che arriva a un impianto ---
    const conferito = new Map();   // ns|canale|provenienza|mese -> kg
    const daStoccaggi = new Map(); // ns|canale|provenienza|mese -> Map(nome stoccaggio -> kg)
    const aggiungi = (ns, canale, provenienza, mese, kg, stoccaggio = '') => {
      if (!ns || !mese) return;
      const k = `${ns}|${canale}|${provenienza}|${mese}`;
      somma(conferito, k, kg);
      if (stoccaggio) {
        if (!daStoccaggi.has(k)) daStoccaggi.set(k, new Map());
        somma(daStoccaggi.get(k), stoccaggio, kg);
      }
    };
    // Totali dell'anno, sempre per canale: `${ns}|${canale}` -> kg.
    const entrataImp = new Map();   // primarie arrivate all'impianto
    const entrataStoc = new Map();  // primarie arrivate allo stoccaggio
    const secIn = new Map();        // secondarie arrivate all'impianto
    const secOut = new Map();       // secondarie partite dallo stoccaggio
    const terz = new Map();         // terziarie in uscita (rete)
    let reteTutte = 0;

    // --- Gli stoccaggi: entrate, partenze in secondaria e verso chi ---
    const stoc = new Map(); // ns -> Map(canale -> { entrato: kg[12], uscito: kg[12], verso: Map(nsImpianto -> kg) })
    const canaleStoc = (ns, canale) => {
      if (!stoc.has(ns)) stoc.set(ns, new Map());
      const m = stoc.get(ns);
      if (!m.has(canale)) m.set(canale, { entrato: new Array(12).fill(0), uscito: new Array(12).fill(0), verso: new Map() });
      return m.get(canale);
    };

    // La rilevazione di uno stoccaggio a portale e' per classe: P, M, G1 e G2 sono
    // la rete, la classe 9 e' l'ACI. Si tiene divisa per canale, e da lì la
    // giacenza segue i movimenti con la fine del trasporto dopo la rilevazione.
    const rilevazione = new Map(); // ns -> { data, RETE: t, ACI: t }
    for (const r of rilevazioni) {
      const ns = norm(r.sito);
      if (!ns) continue;
      const data = r.data_rilevazione ? String(r.data_rilevazione).slice(0, 10) : '';
      const prima = rilevazione.get(ns);
      if (prima && data <= prima.data) continue;
      rilevazione.set(ns, {
        data,
        RETE: ['class1_kg', 'class2_kg', 'class3_kg', 'class4_kg'].reduce((s, c) => s + (Number(r[c]) || 0), 0) / 1000,
        ACI: (Number(r.class9_kg) || 0) / 1000,
      });
    }
    const dopoRilevazione = new Map(); // ns|canale -> t (entrate meno partenze finite dopo la rilevazione)
    const movimentoDopo = (ns, canale, r, valore) => {
      const ril = rilevazione.get(ns);
      const giorno = giornoRoma(r.trasporto_finito_il);
      if (!ril || !ril.data || !giorno || giorno <= ril.data) return;
      somma(dopoRilevazione, `${ns}|${canale}`, valore);
    };

    // Chi sono i siti e con che ruolo si scopre dai formulari, una volta sola.
    const nomi = new Map();    // ns -> nome leggibile
    const ruoliDi = new Map(); // ns -> Set di ruoli ('imp', 'stoc')
    const segnaRuolo = (ns, ruolo) => {
      if (!ruoliDi.has(ns)) ruoliDi.set(ns, new Set());
      ruoliDi.get(ns).add(ruolo);
    };
    const conosci = (ns, nome) => { if (ns && !nomi.has(ns)) nomi.set(ns, nome); };
    for (const g of giacenzeSito) { conosci(norm(g.sito), g.sito); segnaRuolo(norm(g.sito), td(g.tipo_destinazione) || 'imp'); }

    // Il portale scrive nel file degli ordini non dichiarati solo l'ID della
    // primaria: che fosse diretta a uno stoccaggio si sa da qui.
    const ordineTipo = new Map();

    // Una primaria (rete, ACI o extra raccolta): all'impianto o allo stoccaggio.
    const primaria = (r, canale) => {
      const ruolo = td(r.tipo_destinazione) || 'imp';
      const id = String(r.id_ordine || '').trim();
      if (id && td(r.tipo_destinazione)) ordineTipo.set(id, ruolo);
      if (!eTerminato(r) || !r.destinazione) return null;
      const ns = norm(r.destinazione);
      if (ruolo === 'stoc') movimentoDopo(ns, canale, r, peso(r) / 1000);
      const p = periodo(r);
      if (!p) return null;
      conosci(ns, r.destinazione);
      segnaRuolo(ns, ruolo);
      somma(ruolo === 'stoc' ? entrataStoc : entrataImp, `${ns}|${canale}`, peso(r));
      if (ruolo === 'stoc') canaleStoc(ns, canale).entrato[p.mese_idx] += peso(r);
      return { ns, ruolo, p };
    };

    await perPagina(svc.PrimariaRete, null, (r) => {
      const c = primaria(r, 'RETE');
      if (!c) return;
      segnaFine(r);
      reteTutte += peso(r);
      if (c.ruolo === 'stoc') return;
      aggiungi(c.ns, 'RETE', '', c.p.mese, peso(r));
      segnaNonAncora(c.ns, r, 'primaria');
    });
    for (const r of aci) {
      const c = primaria(r, 'ACI');
      if (!c || c.ruolo === 'stoc') continue;
      aggiungi(c.ns, 'ACI', 'primaria', c.p.mese, peso(r));
    }
    for (const r of extra) {
      if (td(r.tipo_movimento) === 'secondaria') continue; // piu' sotto, con le secondarie
      const c = primaria(r, 'EXTRA_RACCOLTA');
      if (!c || c.ruolo === 'stoc') continue;
      aggiungi(c.ns, 'EXTRA_RACCOLTA', '', c.p.mese, peso(r));
    }

    // Una secondaria: lo stoccaggio e' il produttore, l'impianto che la riceve la
    // dichiara. Le secondarie di rete e quelle ACI stanno nello stesso archivio e
    // restano su canali separati.
    const secondaria = (r, canale, provenienza) => {
      const dest = norm(r.destinazione);
      const daStoc = norm(r.stoccaggio);
      if (!dest || !eTerminato(r)) return null;
      movimentoDopo(daStoc, canale, r, -peso(r) / 1000);
      const p = periodo(r);
      if (!p) return null;
      conosci(dest, r.destinazione);
      segnaRuolo(dest, 'imp');
      somma(secIn, `${dest}|${canale}`, peso(r));
      if (daStoc) {
        conosci(daStoc, r.stoccaggio);
        segnaRuolo(daStoc, 'stoc');
        somma(secOut, `${daStoc}|${canale}`, peso(r));
        const c = canaleStoc(daStoc, canale);
        c.uscito[p.mese_idx] += peso(r);
        somma(c.verso, dest, peso(r));
      }
      aggiungi(dest, canale, provenienza, p.mese, peso(r), r.stoccaggio || 'stoccaggio non indicato');
      return { dest, daStoc, p };
    };
    for (const r of secondarie) {
      if (eAci(r)) { secondaria(r, 'ACI', 'secondaria'); continue; }
      const s = secondaria(r, 'RETE', '');
      if (s) segnaNonAncora(s.dest, r, 'secondaria');
    }
    for (const r of extra) {
      if (td(r.tipo_movimento) === 'secondaria') secondaria(r, 'EXTRA_RACCOLTA', '');
    }
    for (const r of terziarie) {
      if (!periodo(r)) continue;
      somma(terz, norm(r.unita_locale_origine || r.ragione_sociale), peso(r));
    }

    // Uno stoccaggio con una giacenza - rilevata a portale o di inizio anno - ha
    // il suo canale anche se quest'anno non si e' mosso niente: la giacenza c'e'.
    for (const [ns, ril] of rilevazione) {
      if (!(ruoliDi.get(ns) || new Set()).has('stoc')) continue;
      for (const canale of CANALI_PORTALE) if (ril[canale] > 0) canaleStoc(ns, canale);
    }
    for (const g of giacenzeSito) {
      if (td(g.tipo_destinazione) !== 'stoc') continue;
      if (Number(g.giacenza_riferimento_t) > 0) canaleStoc(norm(g.sito), 'RETE');
      if (Number(g.giacenza_riferimento_aci_t) > 0) canaleStoc(norm(g.sito), 'ACI');
    }

    // --- Giacenza del portale alla fotografia: conferito non ancora dichiarato ---
    const portale = new Map();      // ns impianto -> t
    const inAttesa = new Map();     // ns stoccaggio -> t gia' partite che il portale attribuisce ancora allo stoccaggio
    const attesaCoppia = new Map(); // nsStoccaggio|nsImpianto -> t partite e non ancora dichiarate
    const aPortale = new Set();     // chi compare nella fotografia del portale
    const daDichiarare = new Map(); // ns|mese -> kg ancora in attesa di dichiarazione
    const fineSecondaria = new Map(); // id della secondaria -> giorno in cui e' arrivata all'impianto
    for (const r of secondarie) {
      const id = String(r.id_ordine || '').trim();
      const g = giornoRoma(r.trasporto_finito_il);
      if (id && g) fineSecondaria.set(id, g);
    }
    const fotoPerGiorno = new Map(); // ns|giorno di fine trasporto -> kg ancora in attesa
    for (const r of nonDichiarati) {
      const sec = String(r.destinazione_secondaria || '').trim();
      const sito = sec || String(r.destinazione || '').trim();
      const ruolo = sec ? 'imp' : (ordineTipo.get(String(r.ordine_primaria || '').trim()) || 'imp');
      const ns = norm(sito);
      // Il file degli ordini non dichiarati e' della rete: una riga ACI, se mai ci
      // fosse, non entra in una giacenza di rete.
      if (!ns || eAci({ prodotto: r.prodotto })) continue;
      aPortale.add(ns);
      const t = (Number(r.peso_non_dichiarato_kg) || 0) / 1000;
      if (ruolo === 'stoc') { somma(inAttesa, ns, t); continue; }
      somma(portale, ns, t);
      if (sec && r.destinazione) somma(attesaCoppia, `${norm(r.destinazione)}|${ns}`, t);
      // In che mese il carico e' arrivato all'impianto: l'unico modo onesto di dire
      // "questo mese e' da dichiarare". Per una primaria passata da uno stoccaggio
      // conta la fine trasporto della SECONDARIA, cioe' quando e' arrivata qui: la
      // fine trasporto della riga e' quella della primaria allo stoccaggio.
      // Verificato su agosto 2026: cosi' la giacenza di Irigom a fine mese torna
      // al chilo col registro dell'impianto.
      const secId = String(r.ordine_secondaria || '').trim();
      const g = (sec && secId && fineSecondaria.get(secId)) || giornoRoma(r.fine_trasporto);
      if (g) somma(daDichiarare, `${ns}|${MESI[Number(g.slice(5, 7)) - 1]}`, t * 1000);
      // Per la giacenza a fine mese: fino a che giorno arriva il carico.
      if (g) somma(fotoPerGiorno, `${ns}|${g}`, t * 1000);
    }
    // La giacenza di rete a portale alla fine di ogni mese, per fine trasporto:
    // quello che il file del portale aspetta ancora, piu' i carichi che il file
    // non contiene. Serve a calcolare quanto dichiarare per un mese chiuso (la
    // pratica di Irigom). Le dichiarazioni caricate dopo la fotografia le toglie
    // chi la usa, perche' dipende da quale mese sta dichiarando.
    const fineMese = (ns) => MESI.map((mese, i) => {
      const fine = `${annoNum}-${String(i + 1).padStart(2, '0')}-31`;
      let foto = 0;
      for (const [k, kg] of fotoPerGiorno) {
        const [sito, giorno] = k.split('|');
        if (sito === ns && giorno <= fine) foto += kg;
      }
      const aggiunti = (nonAncora.get(ns) || []).filter(x => x.fine_trasporto && x.fine_trasporto <= fine).reduce((s, x) => s + x.kg, 0);
      return { mese, foto_kg: Math.round(foto), aggiunti_kg: Math.round(aggiunti) };
    });

    // --- Dichiarazioni per sito, canale, provenienza e mese ---
    const perDich = new Map();
    for (const d of dichiarazioni) {
      perDich.set(`${norm(d.sito)}|${d.canale || 'RETE'}|${d.provenienza || ''}|${d.mese}`, d);
      const ns = norm(d.sito);
      if (!nomi.has(ns)) { nomi.set(ns, d.sito); segnaRuolo(ns, 'imp'); }
    }
    const dichiarazioneDi = (d) => d && {
      id: d.id, quantita_kg: Number(d.quantita_kg) || 0, caricata_inviata: !!d.caricata_inviata, ricevuta_email: !!d.ricevuta_email,
      ricevuta_il: d.ricevuta_il || '', caricata_il: d.caricata_il || '', note: d.note || '', motivo_assenza: d.motivo_assenza || '',
      granulo_kg: Number(d.granulo_kg) || 0, fibre_kg: Number(d.fibre_kg) || 0, metalli_kg: Number(d.metalli_kg) || 0,
      ciabattato_kg: Number(d.ciabattato_kg) || 0, cippato_kg: Number(d.cippato_kg) || 0, cssc_kg: Number(d.cssc_kg) || 0, altro_kg: Number(d.altro_kg) || 0,
    };
    const flussiDi = (ns, operazione) => {
      const chiavi = new Set();
      for (const k of conferito.keys()) {
        const [sito, canale, provenienza] = k.split('|');
        if (sito === ns) chiavi.add(`${canale}|${provenienza}`);
      }
      for (const k of perDich.keys()) {
        const [sito, canale, provenienza] = k.split('|');
        if (sito === ns) chiavi.add(`${canale}|${provenienza}`);
      }
      if (!chiavi.size) chiavi.add('RETE|');
      return [...chiavi].sort().map(c => {
        const [canale, provenienza] = c.split('|');
        const mesi = MESI.map(mese => {
          const chiave = `${ns}|${canale}|${provenienza}|${mese}`;
          const da = daStoccaggi.get(chiave);
          const daStoc = da ? [...da.entries()].map(([stoccaggio, kg]) => ({ stoccaggio, kg: Math.round(kg) })).sort((a, b) => b.kg - a.kg) : [];
          const totale = Math.round(conferito.get(chiave) || 0);
          return {
            mese,
            conferito_kg: totale,
            // Quanto e' arrivato direttamente e quanto dagli stoccaggi, in secondaria.
            diretto_kg: totale - daStoc.reduce((s, x) => s + x.kg, 0),
            da_stoccaggi: daStoc,
            non_dichiarato_kg: canale === 'RETE' ? Math.round(daDichiarare.get(`${ns}|${mese}`) || 0) : 0,
            dichiarazione: dichiarazioneDi(perDich.get(chiave) || null),
          };
        });
        return {
          canale, provenienza, operazione,
          mesi,
          conferito_t: t3(mesi.reduce((s, m) => s + m.conferito_kg, 0) / 1000),
          da_stoccaggi_t: t3(mesi.reduce((s, m) => s + m.da_stoccaggi.reduce((x, y) => x + y.kg, 0), 0) / 1000),
          dichiarato_caricato_t: t3(mesi.reduce((s, m) => s + (m.dichiarazione && m.dichiarazione.caricata_inviata ? m.dichiarazione.quantita_kg : 0), 0) / 1000),
          dichiarato_totale_t: t3(mesi.reduce((s, m) => s + (m.dichiarazione ? m.dichiarazione.quantita_kg : 0), 0) / 1000),
        };
      });
    };

    const giacenzeDi = (ns, ruolo) => giacenzeSito.filter(x => norm(x.sito) === ns && (td(x.tipo_destinazione) || 'imp') === ruolo);
    // La giacenza al 31/12 dell'anno prima e' della rete; quella ACI, dove c'e',
    // sta nel suo campo. Non si sommano.
    const iniziale = (ns, ruolo, canale) => t3(giacenzeDi(ns, ruolo)
      .reduce((s, x) => s + (Number(canale === 'ACI' ? x.giacenza_riferimento_aci_t : x.giacenza_riferimento_t) || 0), 0));
    const kgInT = (mappa, chiave) => t3((mappa.get(chiave) || 0) / 1000);
    const dichiaratoPerCanale = (flussi, canale, soloCaricate = true) => t3(flussi.filter(f => f.canale === canale)
      .reduce((s, f) => s + (soloCaricate ? f.dichiarato_caricato_t : f.dichiarato_totale_t), 0));

    // --- Gli impianti ---
    const dichiaratoDopo = dichiaratoDopoLaFotografia(dichiarazioni, fotoPortale, norm);
    const impianti = [...nomi.entries()].filter(([ns]) => (ruoliDi.get(ns) || new Set(['imp'])).has('imp')).map(([ns, nome]) => {
      const ruoli = [...(ruoliDi.get(ns) || new Set(['imp']))].sort();
      const g = giacenzeDi(ns, 'imp')[0] || giacenzeSito.find(x => norm(x.sito) === ns) || null;
      const operazione = operazioneDa(g && g.tipologia_trattamento);
      const flussi = flussiDi(ns, operazione);
      const senzaPortale = !aPortale.has(ns);
      const aggiunti = (nonAncora.get(ns) || []).sort((a, b) => a.fine_trasporto.localeCompare(b.fine_trasporto));
      const aggiuntiT = t3(aggiunti.reduce((s, x) => s + x.kg, 0) / 1000);
      // Le dichiarazioni di rete caricate a portale dopo la fotografia: il file le
      // conta ancora come giacenza, il gestionale no.
      const dopoFoto = t3((dichiaratoDopo.get(ns) || 0) / 1000);
      const fotoT = senzaPortale ? null : t3(portale.get(ns) || 0);
      const sito = {
        sito: nome,
        chiave: ns,
        canale: 'RETE',
        ruoli,
        tipo_destinazione: 'imp',
        // Anche stoccaggio: la parte di stoccaggio sta nell'elenco degli stoccaggi.
        anche_stoccaggio: ruoli.includes('stoc'),
        tipologia_trattamento: (g && g.tipologia_trattamento) || '',
        // Chi non ci manda la dichiarazione di rete - perche' quel trattamento non
        // glielo paghiamo - non deve comparire come inadempiente: e' un accordo.
        dichiara_rete: !(g && g.dichiara_rete === false),
        operazione,
        giacenza_iniziale_t: iniziale(ns, 'imp', 'RETE'),
        target_primarie_t: t3(giacenzeSito.filter(x => norm(x.sito) === ns).reduce((s, x) => s + (Number(x.target_primarie_t) || 0), 0)),
        // Arrivato all'impianto, canale per canale: primarie dirette e secondarie.
        conferito_t: kgInT(entrataImp, `${ns}|RETE`),
        conferito_aci_t: kgInT(entrataImp, `${ns}|ACI`),
        conferito_extra_t: kgInT(entrataImp, `${ns}|EXTRA_RACCOLTA`),
        secondarie_in_t: kgInT(secIn, `${ns}|RETE`),
        secondarie_aci_in_t: kgInT(secIn, `${ns}|ACI`),
        secondarie_extra_in_t: kgInT(secIn, `${ns}|EXTRA_RACCOLTA`),
        terziarie_out_t: kgInT(terz, ns),
        // Dichiarato, canale per canale: non si sommano.
        dichiarato_caricato_rete_t: dichiaratoPerCanale(flussi, 'RETE'),
        dichiarato_caricato_aci_t: dichiaratoPerCanale(flussi, 'ACI'),
        dichiarato_caricato_extra_t: dichiaratoPerCanale(flussi, 'EXTRA_RACCOLTA'),
        dichiarato_totale_rete_t: dichiaratoPerCanale(flussi, 'RETE', false),
        dichiarato_portale_t: t3((dichiaratoPortale.get(ns) || 0) / 1000),
        // La quadratura e' della rete: entra quello che e' arrivato all'impianto,
        // in primaria e in secondaria, per fine trasporto; lo stoccaggio, se ne ha
        // uno, sta a parte.
        entrato_confronto_t: t3((kgInT(entrataImp, `${ns}|RETE`) + kgInT(secIn, `${ns}|RETE`))),
        uscito_confronto_t: 0,
        // La giacenza a portale: la fotografia, piu' i carichi che il file non
        // contiene ancora, meno le dichiarazioni caricate dopo.
        giacenza_portale_foto_t: fotoT,
        aggiunti_alla_foto: aggiunti,
        aggiunti_alla_foto_t: aggiuntiT,
        dichiarato_dopo_foto_t: dopoFoto,
        giacenza_portale_t: fotoT === null ? null : t3(fotoT + aggiuntiT - dopoFoto),
        portale_fine_mese: senzaPortale ? [] : fineMese(ns),
        // La rilevazione del suo stoccaggio sta a parte (scheda Stoccaggi).
        rilevazione_stoccaggio: ruoli.includes('stoc') && rilevazione.has(ns) ? { RETE: t3(rilevazione.get(ns).RETE), ACI: t3(rilevazione.get(ns).ACI), data: rilevazione.get(ns).data } : null,
        flussi,
      };
      return { ...sito, ...quadratura(sito) };
    }).filter(s => s.conferito_t || s.conferito_aci_t || s.conferito_extra_t || s.secondarie_in_t || s.secondarie_aci_in_t || s.secondarie_extra_in_t
      || s.dichiarato_totale_rete_t || s.flussi.some(f => f.dichiarato_totale_t) || s.giacenza_iniziale_t || s.giacenza_portale_t)
      .sort((a, b) => (b.conferito_t + b.secondarie_in_t) - (a.conferito_t + a.secondarie_in_t) || a.sito.localeCompare(b.sito));

    // --- Gli stoccaggi: canale per canale ---
    const impianto = new Map(impianti.map(s => [s.chiave, s]));
    const soloStoccaggio = (ns) => { const r = ruoliDi.get(ns); return !!r && r.size === 1 && r.has('stoc'); };
    const stoccaggi = [...stoc.entries()].map(([ns, canali]) => {
      const ril = rilevazione.get(ns);
      const righe = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].filter(c => canali.has(c)).map(canale => {
        const c = canali.get(canale);
        const entrato = c.entrato.reduce((s, x) => s + x, 0);
        const uscito = c.uscito.reduce((s, x) => s + x, 0);
        const inizio = canale === 'EXTRA_RACCOLTA' ? 0 : iniziale(ns, 'stoc', canale);
        // In piazzale: dalla rilevazione del portale piu' i movimenti finiti dopo,
        // quando c'e' (l'extra raccolta a portale non c'e'); se no dalla giacenza
        // di inizio anno piu' entrate meno partenze.
        const daRilevazione = ril && ril.data && CANALI_PORTALE.includes(canale);
        return {
          canale,
          giacenza_iniziale_t: inizio,
          entrato_t: t3(entrato / 1000),
          uscito_t: t3(uscito / 1000),
          saldo_t: t3((entrato - uscito) / 1000),
          in_piazzale_t: daRilevazione ? t3(ril[canale] + (dopoRilevazione.get(`${ns}|${canale}`) || 0)) : t3(inizio + (entrato - uscito) / 1000),
          in_piazzale_da: daRilevazione ? 'rilevazione' : 'movimenti',
          mesi: MESI.map((mese, i) => ({ mese, entrato_kg: Math.round(c.entrato[i]), uscito_kg: Math.round(c.uscito[i]) })),
          verso: [...c.verso.entries()].map(([nsImp, kg]) => {
            const imp = impianto.get(nsImp);
            return {
              impianto: (imp && imp.sito) || nomi.get(nsImp) || nsImp,
              chiave: nsImp,
              t: t3(kg / 1000),
              // Per la rete, quanto di quello partito verso questo impianto il portale
              // aspetta ancora che l'impianto dichiari.
              in_attesa_t: canale === 'RETE' ? t3(attesaCoppia.get(`${ns}|${nsImp}`) || 0) : null,
              dichiara: canale !== 'RETE' || !imp || imp.dichiara_rete !== false,
            };
          }).sort((a, b) => b.t - a.t),
        };
      });
      return {
        sito: nomi.get(ns) || ns,
        chiave: ns,
        anche_impianto: !soloStoccaggio(ns),
        canali: righe,
        rilevazione_il: ril ? ril.data : '',
        in_attesa_portale_t: t3(inAttesa.get(ns) || 0),
        // Dichiarazioni registrate sullo stoccaggio: non dovrebbero esserci. Non si
        // cancellano, si mostrano, perche' vanno spostate sull'impianto che ha
        // ricevuto le secondarie.
        dichiarazioni_registrate: soloStoccaggio(ns) ? dichiarazioni
          .filter(d => norm(d.sito) === ns && Number(d.quantita_kg) > 0)
          .map(d => ({ canale: d.canale || 'RETE', provenienza: d.provenienza || '', mese: d.mese, quantita_kg: Number(d.quantita_kg) || 0 })) : [],
      };
    }).filter(s => s.canali.some(c => c.entrato_t || c.uscito_t || c.giacenza_iniziale_t) || s.dichiarazioni_registrate.length)
      // In ordine di rete entrata, poi di ACI: i canali non si sommano nemmeno per ordinare.
      .sort((a, b) => {
        const di = (s, k) => (s.canali.find(c => c.canale === k) || { entrato_t: 0 }).entrato_t;
        return di(b, 'RETE') - di(a, 'RETE') || di(b, 'ACI') - di(a, 'ACI') || a.sito.localeCompare(b.sito);
      });

    // La quadratura degli stoccaggi puri, un canale per volta: la loro giacenza a
    // portale e' la rilevazione per classe, aggiornata con i movimenti dopo.
    const righeStoccaggio = stoccaggi.filter(s => !s.anche_impianto).flatMap(s => s.canali
      .filter(c => CANALI_PORTALE.includes(c.canale))
      .map(c => {
        const riga = {
          sito: s.sito,
          chiave: `${s.chiave}|${c.canale}`,
          canale: c.canale,
          tipo_destinazione: 'stoc',
          giacenza_iniziale_t: c.giacenza_iniziale_t,
          entrato_confronto_t: c.entrato_t,
          uscito_confronto_t: c.uscito_t,
          dichiarato_caricato_rete_t: 0,
          giacenza_portale_t: c.in_piazzale_da === 'rilevazione' ? c.in_piazzale_t : null,
          rilevazione_il: s.rilevazione_il,
          in_attesa_dichiarazione_t: c.canale === 'RETE' ? s.in_attesa_portale_t : 0,
          flussi: [],
        };
        return { ...riga, ...quadratura(riga) };
      }));

    const siti = [...impianti, ...righeStoccaggio];
    const confrontabili = siti.filter(x => x.giacenza_portale_t !== null && x.giacenza_portale_t !== undefined);
    const perCanale = (campo) => t3(impianti.reduce((s, x) => s + (x[campo] || 0), 0));
    const totali = {
      // Tutte le primarie di rete dell'anno, a impianti e stoccaggi: ogni carico una volta sola.
      conferito_t: t3(reteTutte / 1000),
      // Dichiarato, canale per canale: rete, ACI ed extra raccolta non si sommano.
      dichiarato_caricato_rete_t: perCanale('dichiarato_caricato_rete_t'),
      dichiarato_totale_rete_t: perCanale('dichiarato_totale_rete_t'),
      dichiarato_caricato_aci_t: perCanale('dichiarato_caricato_aci_t'),
      dichiarato_caricato_extra_t: perCanale('dichiarato_caricato_extra_t'),
      dichiarato_portale_t: perCanale('dichiarato_portale_t'),
      // La giacenza degli impianti e' della rete: solo quella si somma qui.
      giacenza_calcolata_t: t3(impianti.reduce((s, x) => s + x.giacenza_calcolata_t, 0)),
      // Solo gli impianti che a portale una giacenza ce l'hanno.
      giacenza_calcolata_confrontabile_t: t3(impianti.filter(x => x.giacenza_portale_t !== null).reduce((s, x) => s + x.giacenza_calcolata_t, 0)),
      giacenza_portale_t: t3(impianti.reduce((s, x) => s + (x.giacenza_portale_t || 0), 0)),
      aggiunti_alla_foto_t: perCanale('aggiunti_alla_foto_t'),
      // I conteggi della quadratura, un canale per volta.
      siti_che_quadrano: confrontabili.filter(x => x.canale === 'RETE' && x.quadra === true).length,
      siti_da_quadrare: confrontabili.filter(x => x.canale === 'RETE' && x.quadra === false).length,
      aci_che_quadrano: confrontabili.filter(x => x.canale === 'ACI' && x.quadra === true).length,
      aci_da_quadrare: confrontabili.filter(x => x.canale === 'ACI' && x.quadra === false).length,
    };

    return Response.json({
      anno: annoNum, mesi: MESI, siti, stoccaggi, totali,
      foto_portale_il: fotoPortale,
      // Fin dove arrivano i movimenti caricati (fine trasporto): se e' dopo la
      // fotografia, la giacenza a portale e' stata aggiornata con quello che manca.
      movimenti_fino_al: movimentiFinoAl,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
