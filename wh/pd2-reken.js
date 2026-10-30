/* =====================================================================
   IVOL Warehouse 3.0 — Productdata 2.0, rekenlaag (oefensimulatie, 27-10-2026)
   Ontwerp: docs/productdata-2.0-ontwerp.md (de enige bron voor 2.0).
   Leest productdata, wh-pd-fam, inkoop, verplaatsingen, verkoop en voorraad per locatie (alleen lezen) en rekent
   per product: soort, voorstellen met reden, berekende velden, wat nog open is en of het product afgerond is.
   Schrijft alleen naar catalog-rij wh-pd2-oefen (alles wat Daan in 2.0 doet) en wh-pd2-feedback (opmerkingen
   en oefenantwoorden); een andere rij weigert schrijf() zelf. Picqer: alleen lezen, nooit schrijven.
   Hergebruikt wh/productdata.js en wh/pdfamilie.js (pas geladen als 2.0 opent) zonder hun gedrag te veranderen.
   ===================================================================== */
window.PD2R = (function(){
'use strict';
const { nf, num, leeg, D, isoDag } = WH;
const P = () => window.WHPD, X = () => WHPD.intern, F = () => window.WHPDF;
const KEY_OEFEN = 'wh-pd2-oefen', KEY_FB = 'wh-pd2-feedback';
const wacht = ms => new Promise(r => setTimeout(r, ms));

/* ---------- aannames: keuzes die niet in het ontwerp staan (chip "aanname" in de pagina) ---------- */
const AANNAMES = {
  zoek:     'Zoeken kijkt in alle actieve producten, ook buiten de gekozen scope (anders vind je bijv. Waterhog zonder voorraad niet).',
  soortkol: 'Elke productkaart heeft "Hoe komt dit binnen?": daar zet je een product op een andere soort; de soortkeuze boven de kaarten (Open · Pallet · …) filtert alleen.',
  selgew:   '"Selectie klopt", "Alle voorstellen … kloppen" laten het gewicht staan: gewicht keur je apart goed (knopjes bij Gewicht, of Gewicht… → kloppen).',
  blijf:    'Een product dat compleet wordt (alle velden van zijn soort en het gewicht), klapt meteen in tot één regel en staat dan onder "Afgerond (n)" onderaan de maat. Weg-producten zet je daar terug met "terugzetten".',
  geenpick: 'Bij picklocatie "geen pick" (alleen bulk, per order verplaatsen) zijn Aanvullen bij en Max op pick niet nodig.',
  uitl:     'Uitlopend wordt voorgesteld als er nog voorraad is en geen inkoop in 12 maanden, ook als het nog verkoopt (verkoop is geen voorwaarde). Komt het binnen (open pakbon/container), dan niet.',
  backord:  'Backorder wordt voorgesteld bij geen voorraad en wel inkoop, backorders of verkoop in de laatste 12 maanden.',
  mix:      'Mix wordt voorgesteld als alle bulkplekken van het product ook voorraad van andere producten hebben (gedeelde plek of mixpallet), er geen pallet-aantal bekend is en er geen volle pallet wordt ingekocht. Gedeelde plek mét pallet-aantal, of eigen én gedeelde plekken = twijfel Deel/Mix. Let op: een 20-locatie kan meerdere pallets van verschillende producten hebben.',
  pallet85: 'Pallet: meest voorkomende inkoop ≥ 85% van stuks per pallet én de verplaatsingen laten zien dat de hele bulkvoorraad in één keer naar pick gaat. Alleen per volle pallet verplaatst = twijfel Pallet/Deel; alleen een volle pallet ingekocht maar in delen verplaatst = Deel.',
  score:    'Een voorstel waarvan de regel bij jouw eigen invoer minder dan 60% klopte (minstens 5 keer getoetst), staat als twijfel: in het blauwe vak staat "twijfel" en hoe vaak hij klopte.',
  leer:     'Leren van jouw invoer: een waarde telt als patroon als minstens 2 producten (kleurgenoot: 1) in die groep hem hebben en hij ≥ 60% van die groep is. Groepen: kleurgenoten, familie, leverancier + maat, leverancier.',
  reach:    'Weeglijst: hoe wegen volgt uit de soort. Pallet of Deel met stuks per pallet = volle pallet met de reachtruck (palletgewicht − 15 kg, gedeeld door stuks per pallet); de rest los op de weegschaal.',
  liggerkg: 'Palletgewicht boven ligger-limiet: een pallet van meer dan 2.000 kg, of zo zwaar dat door het gewicht minder pallets op een ligger passen dan door de plaatsen (3 plaatsen per ligger).',
  wegalle:  'Weg-voorstel voor alle producten: dezelfde regels als in tab 5. Heeft Daan in de familie al een soort gekozen, dan telt "geen voorraad" als tijdelijk op en komt er geen Weg-voorstel.',
  snap:     'Snel openen: 2.0 bewaart na het laden een kopie op dit apparaat (IndexedDB, max 7 dagen oud) en tekent daar eerst mee ("gegevens van hh:mm, bijwerken…"); daarna ververst het op de achtergrond. Typ je net, dan wacht het verversen tot je klaar bent.',
  overzet:  'Overzetten naar de echte productdata is gebouwd maar staat uit (pd2Overzetten = false, knop verborgen). Overgezet wordt alleen wat jij bevestigde of aanpaste; Uitlopend gaat als datum mee, Backorder en Archief hebben nog geen veld in productdata.',
  bronnen:  'Stuks per pallet alleen uit palletlabel, verplaatsingen, ≥ 2 gelijke pallets, pakbon of kleurgenoot (daarna Daans patroon bij dezelfde leverancier en maat). Nooit uit inkoop en nooit van een andere leverancier. Zonder bron: leeg, "uitzoeken".',
  fysiek:   'Past fysiek: de Picqer-afmetingen per stuk in alle richtingen op de palletmaat, 7 cm overstek, tot 250 cm hoog incl. 15 cm pallet. Meer dan 15% boven wat past = twijfel. Kloppen de afmetingen in Picqer niet (bijv. doosdikte), dan zie je dat hier.',
  labelqty: 'Een palletlabel met een aantal dat geen getal is (bijv. "6090WM") telt niet als stuks per pallet.',
  grootwb:  'Grote whiteboards (200 cm en langer) krijgen een palletmaat met ruimte in de lengte (120x200 → 120x210, 120x240 → 130x250), zoals in jouw eigen invoer.',
  ringmat:  'Ringmatten met een maat in de naam liggen plat op de kleinste opslagmaat waar ze op passen (100x100, 80x120, 100x200); ringmat op rol → 100x150.',
  lvlnaam:  'Bureaustoelen bij 0 en whiteboards bij 3 gelden ook voor producten zonder picklocatie (de aanvulregel zelf geldt alleen met picklocatie).',
  vnregel:  'Vloernaam = code + " - " + korte omschrijving (code langer dan 14 tekens: alleen de omschrijving). Je oude vloernamen waren vaak alleen de code, dus de gemeten score (1%) zegt hier niets en maakt geen twijfel.',
  maxverk:  'Max op pick: "controleer" (grijze melding onder Max op pick) als het meer is dan 3 maanden verkoop, gemeten als het hoogste van 6-maanden- en 28-dagengemiddelde per maand; zonder verkoop ook "controleer".',
  tegen:    'Per pallet meer dan ooit besteld: stuks per pallet groter dan de grootste inkooporder van 12 maanden, of twee bronnen noemen een ander aantal.',
  vk28:     'Verkoop over 28 dagen = Picqer-analyse "stuks per dag" × 30 (zoals in Per familie).',
  gewafw:   'Gewicht "sterk anders": meer dan 30% afwijking van het midden (mediaan) van de familie, per m² als de maat in de naam staat, anders per stuk binnen dezelfde maat.',
  maxlig:   'Max per ligger: 3 plaatsen per ligger (bestaande regel van Daan) en 2.000 kg per ligger; de kleinste van de twee telt.',
  hoogte:   'Hoogte-waarschuwing kijkt naar de bulklocaties van het product: niveau 00 → max 200 cm, niveau 10 → max 190 cm, niveau 20 in hal A → ± 140 cm. Hal = eerste letter, niveau = laatste twee cijfers van de locatie.',
  maat:     'Een palletmaat die al vastligt of wordt voorgesteld maar niet in de nieuwe keuzelijst staat (bijv. 90x150), staat bovenaan de keuzelijst erbij.',
  koppel:   'Koppelproduct = code met BOL- ervoor of -BOL / -set erachter waarvan het hoofdproduct bestaat (staat bij de familie van het hoofdproduct), of een samengesteld product dat in Picqer virtueel is (sets, pakketten). Niet invullen, niet in de tabs, telt niet als open.',
  vastpd:   'Vastgelegd in productdata = ingevuld door Daan (invoer, familie, samen, kleurgenoot, spraak, aanvulregel). Schattingen van Claude en automatische waarden tellen als voorstel.',
  wissen:   '"Oefendata wissen" wist alleen wh-pd2-oefen; je feedback en opmerkingen (wh-pd2-feedback) blijven staan.',
  famtop:   'Families staan op belang: 3 per A-product + 2 per B-product + 2 per inkomend product + 1 per aandachtspunt. Eerst 30, "Meer families" toont de rest. "Volgende familie" = de belangrijkste die nog niet klaar is. "n open" = aantal open velden (zoals Per familie).',
  live:     'Voorraad per locatie: live uit Picqer (de rijen die op het scherm staan, 20 per vraag, 3 s ertussen; ook de pickstand van het live advies telt als live). Live geldt 30 minuten en wordt na 10 minuten ververst. Wacht als de live-ronde van 3.0 bezig is of Picqer net "te veel" zei; bij een fout 2, 4, 8 … max 30 min pauze. Niet gekoppeld of nog niet opgehaald: de export, met de datum erbij.',
  wandrek:  'Wandrekken: aanvullen bij 2 (met hele omdozen) geldt voor producten met "wandrek" in de naam.',
  vn:       'Vloernaam: een naam op het palletlabel gaat voor, tenzij die alleen de code is (of bijna). Verschillen de labels, dan twijfel met de opties.',
  rolkand:  'Rol (vraag "Is dit een rol? ja / nee" op de kaart) alleen bij Picqer-eenheid meter, cm of rol, of als de naam "op rol", "rol van", "per rol", "volle rol", "rollen", "per meter" of "per cm" zegt, of "rol" samen met een breedte of dikte (niet bij rolstoel, roller, rolluik). Het telt als open tot je kiest.',
  famheel:  'In een familie zie je altijd alle actieve producten van die familie (zoals Per familie), ook als de scope of de filters op het startscherm een deel ervan weglaten. Koppelproducten staan alleen als aantal in de kop.',
  maatauto: 'Bij het openen van een familie staat de eerste maat met iets open gekozen, en de soortkeuze op "Open" (alles wat nog niet af is). Rollen hebben geen eigen tab meer: rolgegevens staan op de kaart.',
  invoer:   'Een voorstel staat als korte regel "voorstel 3 · Klopt" onder het vak (reden bij hover of ⓘ). Invulvakken blijven leeg (voorstel grijs als hint); keuzelijsten staan op het voorstel in blauwe tekst. Opgeslagen wordt pas bij Klopt, typen, een andere keuze of Enter in een leeg vak. Groen = door jou bevestigd of vastgelegd.',
  aand3:    'Bovenaan een familie staan hooguit de 3 aandachtspunten die het vaakst voorkomen; tikken toont alleen die producten (uit alle maten).',
  gewknop:  'Gewicht: getal typen = gewogen. "vertrouwd" = het Picqer-gewicht klopt. "gewogen" zonder getal vraagt eerst het gewicht. Nog een keer op de gekozen knop = terug naar niet gecontroleerd.',
  plat:     'Heeft elke maat in de familie maar 1 product, dan is er geen maatstap: alle kaarten onder elkaar op maat, de maten zijn een inhoudsopgave.',
  maxdeel:  'Max op pick bij Deel: Picqer-instelling, anders de grootste aanvulling van bulk naar pick in de verplaatsingen (één verplaatsing), anders kleurgenoot; geen aanvulregel of leren (die gaven bij + pallet).',
  vnoud:    'Overzetten: een vloernaam in productdata die alleen de productcode is, telt niet als eigen afwijkende invoer; die wordt overschreven door de vloernaam die je in 2.0 bevestigde (jouw regel code + omschrijving).',
  overzet1: 'Week 1: overgezet is alles wat je in 2.0 bevestigde of aanpaste (niet met het oefenkaartje aan). Gewicht vertrouwd = de Picqer-kg van dat moment. Daarna schrijft 2.0 direct naar productdata (bron pd2), met per schrijfactie een kopie van de rij in wh-pd2-kopie-<datum>.',
  ligger:   'Max per ligger: liggertype uit de bulklocatie (letters per gang+sectie+niveau in wh-locaties: A–B = 2-ligger, A–C = 3, A–D = 4). Plaatsen 1 → 2/3/4 per ligger, 2 → 1/1/2, 3 → 1. Zonder bulklocatie: "3-ligger x · 4-ligger y". Daarnaast 2.000 kg per ligger.',
  nacontrole: 'Controle na invoer (oranje onder het veld): VST-pallets (≥ 2 gelijk), verplaatsingen naar VST of naar pick, of palletlabels zeggen een ander stuks per pallet dan wat je invulde; bij Deel ook de grootste aanvulling naar pick tegenover max op pick. Nooit automatisch gewijzigd.',
  binnenkomst: 'Binnenkomst (Pallet en Deel): pallet van leverancier of los, zelf pallets bouwen. Voorstel uit inkoop tegenover stuks per pallet (≥ 85% = pallet van leverancier). Bij zelf bouwen komt stuks per pallet alleen uit palletlabels, VST/bulk-pallets en verplaatsingen; bij pallet van leverancier mag inkoop meestal als laatste bron.',
  labelfout: 'Een palletlabel waarvan de hele naam (zonder spaties/streepjes) een andere productcode is, telt niet voor stuks per pallet of vloernaam en staat op "Palletlabels om te verbeteren".',
  oefentel: 'Wat je invult terwijl het oefenkaartje aan staat, krijgt een oefen-merk: het geldt voor dat product, maar telt niet mee voor kleurgenoten, leren, de telling in "Kopieer alles voor Claude" en het overzetten. Alleen invoer met oefenen uit telt.',
  oefen:    'Oefenen staat standaard uit (Oefenmodus ⋯ → Oefenen); dan één kaartje rechtsonder met de opdrachten per soort en na de laatste de vier vragen. Je bewerkt de oefenkopie ook als oefenen uit staat.',
  rolcheck: 'Rollen controleren: per rol kg per m² per mm dikte (kg per meter ÷ breedte in m ÷ dikte in mm). Wijkt dat > 20% af van de mediaan van de familie (≥ 3 rollen), of ligt het buiten 0,3–2,5, dan staat de rol bovenaan als afwijkend. Zonder breedte, dikte of gewicht is hij niet te toetsen (Onvolledig); "rest klopt" per familie geldt alleen voor getoetste rollen zonder afwijking. Klopt = gewicht vertrouwd (de Picqer-kg vastgelegd), Moet gewogen = te wegen (komt op de Weeglijst).',
  rolcalc:  'Rol (Daan 30-10): elke rol zit op een koker van 10 cm. Diameter = √(10² + 4 · lengte · dikte / π), kg per rol = kg per meter × lengte (eenheid rol: het Picqer-gewicht per rol). Beide berekend, niet in te vullen. Lengte volle rol uit de naam (rol van 10 m, of m² ÷ breedte), Picqer (rol 1000 cm) of de pakbon (1 rol = 10 m); anders de lengte die in de familie (of bij de leverancier) het meest voorkomt, zodra ≥ 3 rollen bekend zijn. Max rollen per pallet volgt uit staand/liggend, diameter en palletmaat.',
  rolregel: 'Rolregels ronde 2: kokos rol = 600 cm lang (6 m); kokos 200 cm 17 mm = 12 rollen per pallet, 24 mm = 6 (vaste aantallen); voor 100 cm kokos geen aantal bekend. Ringmat op rol heavy duty: staand, 6 per pallet, palletmaat 100x150. Gewicht volle rol = gewicht per meter of cm × lengte.'
};

/* ---------- toestand ---------- */
const leegO = () => ({ v:1, p:{}, mg:[], oef:{}, t:null });
const leegFb = () => ({ v:1, tabs:{}, opm:[], aann:{} });
const S = { klaar:false, laden:null, fout:null, o:leegO(), fb:leegFb(), vuil:new Set(), metaVuil:false, fbVuil:false, alles:false,
  famVer:{}, ver:0, cache:new Map(), sel:null, luister:[], bewaar:{ bezig:false, t:null, fout:null, op:null }, live:{ prod:{}, bezig:{}, fout:{}, foutOp:{}, foutN:{} }, idx:null };
const meld = () => S.luister.forEach(f => { try{ f(); }catch(e){ console.error(e); } });

/* ---------- laden ---------- */
function laadJs(f){
  return fetch(f, { cache:'no-cache' }).then(r => { if(!r.ok) throw new Error('status ' + r.status); return r.text(); })
    .then(t => { const s = document.createElement('script'); s.textContent = t + '\n//# sourceURL=' + f; document.body.appendChild(s); })
    .catch(() => new Promise((ok, nee) => { const s = document.createElement('script'); s.src = f; s.onload = ok; s.onerror = () => nee(new Error(f + ' laden lukte niet')); document.body.appendChild(s); }));
}
/* ---------- snel openen: momentopname in IndexedDB (alleen op dit apparaat) ----------
   Na elke volledige keer laden bewaart 2.0 een kopie van wat het nodig heeft (producten, voorraad, productdata, inkoop,
   verplaatsingen, oefendata). De volgende keer tekent 2.0 meteen uit die kopie ("gegevens van hh:mm, bijwerken…") en
   ververst daarna op de achtergrond. Niets hiervan gaat naar de database. */
const SNAPDB = 'ivol-pd2', SNAPV = 1, SNAPMAX = 7 * 864e5;
let snapDbP = null;
function snapDb(){
  if(snapDbP) return snapDbP;
  snapDbP = new Promise((ok, nee) => { try{ const r = indexedDB.open(SNAPDB, 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error); r.onblocked = () => nee(new Error('blocked')); }catch(e){ nee(e); } }).catch(() => null);
  return snapDbP;
}
async function snapLees(key){
  const db = await snapDb(); if(!db) return null;
  return new Promise(ok => { try{ const r = db.transaction('kv', 'readonly').objectStore('kv').get(key || 'snap'); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); }catch(e){ ok(null); } });
}
// de oefendata apart en na elke keer bewaren (klein), zodat snel openen altijd de laatste stand toont
async function snapOefen(){
  const db = await snapDb(); if(!db) return;
  try{ db.transaction('kv', 'readwrite').objectStore('kv').put({ t:Date.now(), o:S.o, fb:S.fb }, 'oefen'); }catch(e){}
}
async function snapSchrijf(){
  const db = await snapDb(); if(!db || !P() || !P().S.klaar) return;
  const PS = P().S, AL = window.WHAL ? WHAL.S : {};
  const sn = { v:SNAPV, t:Date.now(),
    D:{ P:D.P, VK:D.VK, BO:D.BO, CONT:D.CONT, LOC:D.LOC, LOCDATUM:D.LOCDATUM, PQ:D.PQ, PQDATUM:D.PQDATUM, VR:D.VR, VRDATUM:D.VRDATUM, VSTVR:D.VSTVR, AANVUL:D.AANVUL, GEH:D.GEH },
    PD:{ pd:PS.pd, extra:PS.extra, cat:PS.cat, mv:PS.mv, ink:PS.ink, fcor:PS.fcor, laterMee:PS.laterMee }, AL:{ cat:AL.cat || null, st:AL.st || null }, o:S.o, fb:S.fb };
  return new Promise(ok => { try{ const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(sn, 'snap'); t.oncomplete = () => ok(true); t.onerror = () => ok(false); t.onabort = () => ok(false); }catch(e){ ok(false); } });
}
function vulUitSnap(sn){
  Object.assign(D, sn.D); D.PLOW = {}; Object.keys(D.P).forEach(c => { D.PLOW[c.toLowerCase()] = c; });
  Object.assign(P().S, sn.PD); P().S.idx = null; P().S.klaar = true; P().S.fout = null;
  if(window.WHAL){ if(!WHAL.S.cat && sn.AL) WHAL.S.cat = sn.AL.cat; if(!WHAL.S.st && sn.AL) WHAL.S.st = sn.AL.st; }
  S.o = normO(sn.o); S.fb = normFb(sn.fb);
}
function laad(vers){
  if(S.laden && !vers) return S.laden;
  S.laden = (async () => {
    try{
      while(!window.IVOL) await wacht(50);
      const scripts = (async () => { if(!window.WHPD) await laadJs('wh/productdata.js'); if(!window.WHPDF) await laadJs('wh/pdfamilie.js').catch(e => console.error(e)); })();
      if(!vers && !S.klaar){
        const sn = await snapLees().catch(() => null), so = await snapLees('oefen').catch(() => null);
        if(sn && so && so.t > sn.t){ sn.o = so.o; sn.fb = so.fb; }
        await scripts;
        if(sn && sn.v === SNAPV && window.WHPD && !D.geladen && !P().S.klaar && Date.now() - sn.t < SNAPMAX){ vulUitSnap(sn); dataVers(); S.ver++; S.klaar = true; S.uitSnap = sn.t; meld(); }
      }
      await IVOL.geladen();
      await scripts;
      if(!window.WHPD) throw new Error('Productdata niet beschikbaar');
      if(S.uitSnap || !P().S.klaar || vers) await P().laad(true);
      P().S.idx = null;
      if(P().S.fout) throw P().S.fout;
      if(window.WHAL && !WHAL.S.geladen) await WHAL.laadOpslag().catch(() => {});
      await haalEigen();
      S.idx = null; dataVers(); S.ver++; S.klaar = true; S.uitSnap = null; S.bijgewerkt = Date.now(); S.fout = null; S.achterFout = null;
      try{ herstel(); }catch(e){ console.error(e); }
      setTimeout(() => snapSchrijf().catch(() => {}), 2000);
    }catch(e){ if(S.klaar) S.achterFout = e; else S.fout = e; console.error(e); }
    meld();
  })();
  return S.laden;
}
async function haalEigen(){
  const r = await WH.api('GET', 'catalog?key=in.(%22' + KEY_OEFEN + '%22,%22' + KEY_FB + '%22)&select=key,data,updated_at');
  // wat hier al veranderd is (en nog niet bewaard) blijft staan
  const eigenP = {}; S.vuil.forEach(c => { eigenP[c] = S.o.p[c]; });
  (r || []).forEach(x => {
    if(x.key === KEY_OEFEN){ S.o = normO(x.data); Object.entries(eigenP).forEach(([c, v]) => { if(v) S.o.p[c] = v; else delete S.o.p[c]; }); }
    if(x.key === KEY_FB && !S.fbVuil) S.fb = normFb(x.data);
  });
}
const normO = d => { d = d && typeof d === 'object' ? d : {}; const o = leegO(); return Object.assign(o, d, { p:d.p && typeof d.p === 'object' ? d.p : {}, mg:Array.isArray(d.mg) ? d.mg : [], oef:d.oef && typeof d.oef === 'object' ? d.oef : {} }); };
const normFb = d => { d = d && typeof d === 'object' ? d : {}; const o = leegFb(); return Object.assign(o, d, { tabs:d.tabs && typeof d.tabs === 'object' ? d.tabs : {}, opm:Array.isArray(d.opm) ? d.opm : [], aann:d.aann && typeof d.aann === 'object' ? d.aann : {} }); };

/* ---------- opslaan: alleen wh-pd2-oefen en wh-pd2-feedback ---------- */
function schrijf(key, data){
  if(key !== KEY_OEFEN && key !== KEY_FB) return Promise.reject(new Error('Productdata 2.0 schrijft alleen naar ' + KEY_OEFEN + ' en ' + KEY_FB + ', niet naar ' + key));
  return WH.catZet(key, data);
}
let bewaarT = null;
function plan(){ clearTimeout(bewaarT); bewaarT = setTimeout(flush, 600); }
// eerst de nieuwste versie ophalen, dan alleen wat hier veranderd is erin zetten (iPhone en Mac overschrijven elkaar niet)
let flushP = Promise.resolve();
function flush(){
  clearTimeout(bewaarT);
  flushP = flushP.catch(() => {}).then(async () => {
    if(!S.vuil.size && !S.metaVuil && !S.fbVuil && !S.alles) return;
    const vuil = new Set(S.vuil), meta = S.metaVuil, fbV = S.fbVuil, alles = S.alles;
    S.vuil.clear(); S.metaVuil = false; S.fbVuil = false; S.alles = false;
    S.bewaar.bezig = true; meld();
    try{
      if(vuil.size || meta || alles){
        let d;
        if(alles) d = JSON.parse(JSON.stringify(S.o));
        else {
          const r = await WH.catHaal(KEY_OEFEN); d = normO(r && r.data);
          if(d.gewist && S.o.gewist && d.gewist > S.o.gewist){ /* op een ander apparaat gewist: dat gaat voor */ }
          vuil.forEach(c => { if(S.o.p[c]) d.p[c] = S.o.p[c]; else delete d.p[c]; });
          if(meta){ d.mg = [...new Set((d.mg || []).concat(S.o.mg || []))].filter(m => (S.o.mgWeg || []).indexOf(m) < 0); Object.keys(S.o.oef).forEach(t => { d.oef[t] = Object.assign({}, d.oef[t] || {}, S.o.oef[t]); }); }
          // wat op een ander apparaat bewaard is komt hier ook binnen
          Object.keys(d.p).forEach(c => { if(!vuil.has(c) && !S.vuil.has(c) && JSON.stringify(S.o.p[c]) !== JSON.stringify(d.p[c])){ S.o.p[c] = d.p[c]; ongeldig(c); } });
          S.o.mg = d.mg.slice(); S.o.oef = d.oef;
        }
        d.t = new Date().toISOString(); delete d.mgWeg;
        await schrijf(KEY_OEFEN, d);
      }
      if(fbV){
        const r = await WH.catHaal(KEY_FB), d = normFb(r && r.data);
        Object.assign(d.tabs, S.fb.tabs); Object.assign(d.aann, S.fb.aann);
        const ids = new Set(d.opm.map(x => x.id)); S.fb.opm.forEach(x => { if(!ids.has(x.id)) d.opm.push(x); });
        const weg = new Set(S.fb.opmWeg || []); d.opm = d.opm.filter(x => !weg.has(x.id));
        d.t = new Date().toISOString();
        await schrijf(KEY_FB, d);
        S.fb.opm = d.opm.slice();
      }
      S.bewaar.op = new Date(); S.bewaar.fout = null; snapOefen();
    }catch(e){
      vuil.forEach(c => S.vuil.add(c)); if(meta) S.metaVuil = true; if(fbV) S.fbVuil = true; if(alles) S.alles = true;
      S.bewaar.fout = e; console.error(e);
      setTimeout(plan, 5000);
    }
    S.bewaar.bezig = false; meld();
  });
  return flushP;
}
// bij wegklikken of tabwissel: meteen bewaren
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') flush(); });
window.addEventListener('pagehide', () => flush());

/* ---------- product-opslag (oefen) ---------- */
const po = c => S.o.p[c] || null;
// invoer terwijl het oefenkaartje aan staat krijgt oef:1 en telt niet mee voor kleurgenoten, leren, telling en overzetten
const zelfde = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
function poZet(c, fn){
  const p = S.o.p[c] ? JSON.parse(JSON.stringify(S.o.p[c])) : { f:{} };
  if(!p.f) p.f = {};
  const oud = JSON.parse(JSON.stringify(p));
  fn(p);
  const merk = x => { if(!x || typeof x !== 'object') return; if(S.oefenen) x.oef = 1; else delete x.oef; };
  const veranderd = Object.keys(Object.assign({}, p.f, oud.f)).filter(k => !zelfde(p.f[k], oud.f[k])).map(k => 'f.' + k).concat(['so', 'weg', 'gew', 'rol'].filter(k => !zelfde(p[k], oud[k])));
  Object.keys(p.f).forEach(k => { if(!zelfde(p.f[k], oud.f[k])) merk(p.f[k]); });
  ['so', 'weg', 'gew', 'rol'].forEach(k => { if(!zelfde(p[k], oud[k])) merk(p[k]); });
  if(!S.oefenen && S.echt !== false && pd2Overzetten && veranderd.length) pdPlan(c, p, veranderd);
  p.t = new Date().toISOString();
  S.o.p[c] = p; S.vuil.add(c); ongeldig(c); plan();
}
function poHerstel(c, oud){
  const nu = S.o.p[c] || { f:{} };
  if(oud) S.o.p[c] = oud; else delete S.o.p[c]; S.vuil.add(c); ongeldig(c); plan();
  // ongedaan maken: ook in productdata terug (alleen velden die 2.0 zelf zette)
  if(!S.oefenen && S.echt !== false && pd2Overzetten){ const o = oud || { f:{} }, ks = Object.keys(Object.assign({}, nu.f, o.f)).filter(k => !zelfde((nu.f || {})[k], (o.f || {})[k])).map(k => 'f.' + k).concat(['so', 'weg', 'gew'].filter(k => !zelfde(nu[k], o[k]))); if(ks.length) pdPlan(c, o, ks); }
}

/* ---------- direct naar productdata (week 1): wat Daan bevestigt of aanpast gaat meteen naar productdata, bron pd2 ----------
   Alleen velden die productdata kent. Vooraf een kopie van de rij in catalog wh-pd2-kopie-<datum> (per schrijfactie).
   Met het oefenkaartje aan gaat niets naar productdata (alleen wh-pd2-oefen). */
const PD_RIJ = { lvl:'lvl', maxpick:'maxpick', spp:'spp', maat:'maat', hoogte:'hoogte', vn:'vn', mixgroep:'mixgroep', binnen:'binnenkomst' };
const echtOk = x => x && ['bevestigd', 'aangepast'].includes(x.st) && !leeg(x.v) && !x.oef;
function pdWijz(c, p, keys){
  const w = {}, r = (P().S.pd[c] || {}), pdBron = k => (((r.meta || {})[k] || {}).bron || '');
  const leegOfEigen = k => pdBron(k) === 'pd2' ? '' : undefined;   // weghalen alleen als 2.0 het zelf zette
  keys.forEach(key => {
    if(key.startsWith('f.')){
      const k = key.slice(2), x = (p.f || {})[k];
      const doel = PD_RIJ[k] || (k === 'verp' ? 'spd' : k === 'pickc' ? 'pick' : null); if(!doel) return;
      if(!echtOk(x)){ const l = leegOfEigen(doel); if(l !== undefined) w[doel] = l; if(k === 'pickc' && pdBron('pickkeuze') === 'pd2') w.pickkeuze = ''; return; }
      if(PD_RIJ[k]) w[doel] = String(x.v);
      else if(k === 'verp'){ const n = num((String(x.v).match(/^\s*(\d+(?:[.,]\d+)?)/) || [])[1]); if(n > 0) w.spd = String(n); }
      else if(k === 'pickc'){ if(x.v === 'klopt') w.pick = 'ja'; else if(x.v === 'geenpick') w.pick = 'nee'; else if(x.v === 'moetpick') w.pickkeuze = 'moet pick krijgen'; }
    } else if(key === 'so' || key === 'weg'){
      const so = p.so;
      if(echtOk(so) && so.v !== 'weg') w.opslag = so.v;
      else if(echtOk(so) && so.v === 'weg' && echtOk(p.weg) && p.weg.v === 'uitlopend') w.uitlopend = (p.weg.t || new Date().toISOString()).slice(0, 10);
      else if(!echtOk(so) && pdBron('opslag') === 'pd2') w.opslag = '';
    } else if(key === 'gew'){
      const g = p.gew;
      if(g && !g.oef && g.st === 'tewegen') w.kgst = 'onb';
      else if(g && !g.oef && ['gewogen', 'vertrouwd'].includes(g.st) && num(g.kg) > 0) w.kgst = g.st === 'gewogen' ? { v:String(num(g.kg)), gew:1 } : String(num(g.kg));
      else if(!g && pdBron('kgst') === 'pd2') w.kgst = '';
    }
  });
  // al gelijk in productdata: niet opnieuw schrijven
  Object.keys(w).forEach(k => { const v = w[k] && typeof w[k] === 'object' ? w[k].v : w[k], oud = (r.data || {})[k]; if(String(oud ?? '').trim().toLowerCase() === String(v ?? '').trim().toLowerCase()) delete w[k]; });
  return w;
}
const PDQ = { w:{}, t:null, p:Promise.resolve(), n:0, fout:null };
function pdPlan(c, p, keys){
  const w = pdWijz(c, p, keys); if(!Object.keys(w).length) return;
  PDQ.w[c] = Object.assign(PDQ.w[c] || {}, w);
  clearTimeout(PDQ.t); PDQ.t = setTimeout(pdFlush, 800);
}
function pdFlush(){
  clearTimeout(PDQ.t);
  PDQ.p = PDQ.p.catch(() => {}).then(async () => {
    const wijz = PDQ.w; PDQ.w = {}; const codes = Object.keys(wijz); if(!codes.length) return;
    try{
      // eerst de kopie van de huidige rijen (vóór elke schrijfactie)
      const oud = {};
      for(let i = 0; i < codes.length; i += 80){ const r = await WH.api('GET', 'productdata?productcode=in.(' + encodeURIComponent(codes.slice(i, i + 80).map(c => '"' + String(c).replace(/"/g, '\\"') + '"').join(',')) + ')&select=productcode,data,meta'); (r || []).forEach(x => { oud[x.productcode] = { data:x.data || {}, meta:x.meta || {} }; }); }
      const dag = new Date().toISOString().slice(0, 10), key = 'wh-pd2-kopie-' + dag, k0 = await WH.catHaal(key).catch(() => null), kd = (k0 && k0.data && Array.isArray(k0.data.rijen)) ? k0.data : { dag, rijen:[] };
      codes.forEach(c => kd.rijen.push({ c, t:new Date().toISOString(), rij:oud[c] || null, wijz:Object.keys(wijz[c]) }));
      await WH.catZet(key, kd);
      const pdw = {}; codes.forEach(c => { pdw[c] = {}; Object.entries(wijz[c]).forEach(([k, v]) => { pdw[c][k] = v && typeof v === 'object' ? Object.assign({ bron:'pd2', uit:'Productdata 2.0' }, v) : { v, bron:'pd2', uit:'Productdata 2.0' }; }); });
      await P().opslaan(pdw, 'pd2');
      PDQ.n += codes.length; PDQ.fout = null; PDQ.op = new Date();
      codes.forEach(ongeldig);
    }catch(e){ Object.entries(wijz).forEach(([c, w]) => { PDQ.w[c] = Object.assign({}, w, PDQ.w[c] || {}); }); PDQ.fout = e; console.error(e); setTimeout(pdFlush, 8000); }
    meld();
  });
  return PDQ.p;
}
// verschil: Daans eigen invoer in productdata wijkt af van wat in 2.0 staat (niet overschreven bij het overzetten)
function verschil(c, k){
  const doel = PD_RIJ[k] || (k === 'soort' ? 'opslag' : null); if(!doel) return null;
  const p = po(c), x = k === 'soort' ? p && p.so : p && p.f && p.f[k]; if(!echtOk(x)) return null;
  const r = P().S.pd[c], v = r && r.data ? r.data[doel] : null, m = (r && r.meta && r.meta[doel]) || {};
  if(leeg(v) || isOnb(v) || m.tw || !TOETSBRON.has(m.bron || '') || (k === 'vn' && alleenCode(c, v))) return null;
  const a = k === 'soort' ? (X().soortVan ? X().soortVan(c) : String(v)) : String(v);
  return String(a).trim().toLowerCase() === String(x.v).trim().toLowerCase() ? null : { pd:String(v), bron:m.bron, twee:String(x.v) };
}
function verschilKies(c, k, welk){
  const d = verschil(c, k); if(!d) return;
  if(welk === 'pd2'){ const doel = PD_RIJ[k] || 'opslag'; PDQ.w[c] = Object.assign(PDQ.w[c] || {}, { [doel]:d.twee }); return pdFlush(); }
  // productdata houdt gelijk: 2.0 neemt die waarde over (zonder te schrijven)
  const was = S.echt; S.echt = false;
  try{ poZet(c, q => { if(k === 'soort') q.so = { v:(X().soortVan && X().soortVan(c)) || d.pd, st:'aangepast', voor:d.twee, t:new Date().toISOString() }; else q.f[k] = { v:d.pd, st:'aangepast', voor:d.twee, t:new Date().toISOString() }; }); }
  finally{ S.echt = was; }
}
/* ---------- herstel (week 1): afgerond zonder opgeslagen soort → de soort die het scherm toonde; gewicht vertrouwd zonder kg → Picqer-kg ---------- */
function herstel(){
  let n = 0;
  Object.entries(S.o.p).forEach(([c, p]) => {
    if(!D.P[c] || !p) return;
    let raak = false;
    const st = status(c);
    if(st.af && !(p.so && p.so.v) && st.so){ p.so = { v:st.so, st:'bevestigd', voor:st.so, bron:'herstel', t:new Date().toISOString() }; raak = true; }
    if(p.gew && ['vertrouwd', 'gewogen'].includes(p.gew.st) && !(num(p.gew.kg) > 0)){ const kg = kgPq(c); if(kg > 0){ p.gew.kg = kg; p.gew.bron = 'herstel'; raak = true; } }
    if(raak){ S.vuil.add(c); ongeldig(c); n++; }
  });
  if(n){ S.herstelN = n; plan(); }
  return n;
}
function ongeldig(c){ const fk = famVan(c); S.famVer[fk] = (S.famVer[fk] || 0) + 1; S.ver++; S.sel = null; }
// "Oefendata wissen" (week 1): alleen wat met het oefenkaartje aan is ingevuld; echte invoer blijft
function wisAlles(){
  Object.entries(S.o.p).forEach(([c, p]) => {
    let raak = false;
    Object.keys(p.f || {}).forEach(k => { if(p.f[k] && p.f[k].oef){ delete p.f[k]; raak = true; } });
    ['so', 'weg', 'gew', 'rol'].forEach(k => { if(p[k] && p[k].oef){ delete p[k]; raak = true; } });
    if(raak){ if(!Object.keys(p.f || {}).length && !p.so && !p.weg && !p.gew && !p.rol) delete S.o.p[c]; S.vuil.add(c); ongeldig(c); }
  });
  S.cache.clear(); S.famVer = {}; S.ver++; S.sel = null;
  return flush();
}
function oefDone(tab, id){ if(!S.o.oef[tab]) S.o.oef[tab] = {}; if(S.o.oef[tab][id]) return false; S.o.oef[tab][id] = new Date().toISOString(); S.metaVuil = true; plan(); return true; }
function fbTab(tab, patch){ S.fb.tabs[tab] = Object.assign({}, S.fb.tabs[tab] || {}, patch, { t:new Date().toISOString() }); S.fbVuil = true; plan(); }
function fbOpm(o){ S.fb.opm.push(Object.assign({ id:Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t:new Date().toISOString() }, o)); S.fbVuil = true; plan(); }
function fbOpmWeg(id){ S.fb.opm = S.fb.opm.filter(x => x.id !== id); (S.fb.opmWeg = S.fb.opmWeg || []).push(id); S.fbVuil = true; plan(); }
function fbAann(id, patch){ S.fb.aann[id] = Object.assign({}, S.fb.aann[id] || {}, patch, { t:new Date().toISOString() }); S.fbVuil = true; plan(); }
function mgPlus(n){ n = String(n || '').trim(); if(!n || S.o.mg.includes(n)) return; S.o.mg.push(n); S.metaVuil = true; plan(); }

/* ---------- indeling: familie, maatgroep, koppelproducten ---------- */
const KOP = {};
function koppelVan(c){
  if(c in KOP) return KOP[c];
  const m = String(c).match(/^BOL-(.+)$/i) || String(c).match(/^(.+)-(BOL|set)$/i);
  let h = null; if(m){ const b = D.PLOW[m[1].toLowerCase()]; if(b && b !== c) h = b; }
  return (KOP[c] = h);
}
// samengesteld product (virtueel in Picqer: sets, pakketten, BOL-pakken): heeft zelf geen voorraad of palletgegevens
const virt = c => !!(D.PQ[c] && +D.PQ[c][2] === 1);
const isKoppel = c => !!koppelVan(c) || virt(c);
const koppelTekst = c => koppelVan(c) ? 'gekoppeld aan ' + koppelVan(c) + ', niet invullen' : 'samengesteld product (virtueel in Picqer), niet invullen';
const famVan = c => { const h = koppelVan(c) || c; return P().index().famVan[h] || '?|' + c; };
const maatVan = c => { const h = koppelVan(c) || c, vk = P().index().varVan[h] || '', fk = P().index().famVan[h] || ''; return vk.slice(fk.length + 1); };
const famNaam = fk => { try{ return F() ? F().famNaam(fk) : String(fk).split('|')[1]; }catch(e){ return String(fk).split('|')[1] || fk; } };
const isSam = c => X().isSam(c);
const naamVan = c => String((D.P[c] || {}).naam || '');
const abcVan = c => X().abcVan(c) || '';
const actief = c => { const p = D.P[c]; return !!p && p.actief !== false; };

/* ---------- feiten (alleen lezen) ---------- */
const kgPq = c => P().kgPicqer(c);
const vk6 = c => Math.round(num(D.VK[c] && D.VK[c].per_maand) || 0);
const vk28 = c => { const pd = num(P().S.cat && P().S.cat.pd && P().S.cat.pd[c]); return pd === null ? null : Math.round(pd * 30); };
function inkoop(c){
  const r = ((P().S.ink && P().S.ink.p && P().S.ink.p[c]) || []).map(x => ({ d:String(x[0] || ''), b:num(x[1]) || 0 })).filter(x => x.b > 0);
  if(!r.length) return null;
  const t = {}; r.forEach(x => { const e = t[x.b] = t[x.b] || { v:x.b, n:0, d:'' }; e.n++; if(x.d > e.d) e.d = x.d; });
  const h = Object.values(t).sort((a, b) => b.n - a.n || b.d.localeCompare(a.d));
  return { meestal:h[0].v, meestalN:h[0].n, n:r.length, max:Math.max(...r.map(x => x.b)), laatste:r.map(x => x.d).sort().pop(), h };
}
const inkData = () => !!(P().S.ink && P().S.ink.p);
const idVan = c => { const ids = (P().S.cat && P().S.cat.ids) || {}; return ids[c] ? +ids[c] : 0; };
let BOX = { ref:null, m:null };
function backorders(c){
  const L = window.WHLIVE, d = L && L.status().data, id = idVan(c);
  if(d && d.backorders && id){ const r = d.backorders.filter(b => +b.p === id && !b.hp); return r.length ? { n:new Set(r.map(b => b.o)).size, stuks:r.reduce((s, b) => s + (b.a || 0), 0), bron:'live' } : null; }
  if(BOX.ref !== D.BO){ const m = {}; (D.BO || []).forEach(b => { const k = D.PLOW[String(b.productcode || '').toLowerCase()] || b.productcode; (m[k] = m[k] || []).push(b); }); BOX = { ref:D.BO, m }; }
  const r = BOX.m[c]; return r && r.length ? { n:new Set(r.map(b => b.bestelling)).size, stuks:r.reduce((s, b) => s + (num(b.aantal) || 0), 0), bron:'export' } : null;
}
let BIN = { ref:null, m:null };
function inkomend(c){
  if(BIN.ref !== D.CONT){
    const m = {};
    (D.CONT || []).filter(x => x.status !== 'afgerond').forEach(x => ((x.regels || (x.data && x.data.regels)) || []).forEach(r => {
      if(!r || !r.productcode) return; const k = D.PLOW[String(r.productcode).toLowerCase()] || r.productcode;
      (m[k] = m[k] || []).push({ ref:x.pakbon_ref || x.containernummer || x.leverancier || 'container', eta:x.losdatum || '', n:num(r.aantal) || 0 });
    }));
    BIN = { ref:D.CONT, m };
  }
  return BIN.m[c] || [];
}
const isTijd = n => !!(D.LOC[n] && D.LOC[n].tijd);
const isBulk = n => !!(D.LOC[n] && D.LOC[n].bulk);
// voorraad per locatie, live uit Picqer (alleen lezen): eigen live-vraag of de pickstand van het live advies, de nieuwste telt.
// Is er (nog) niets live, dan de export met de datum erbij ("voorraad van 15-10") en vraagt 2.0 hem live op (wachtrij met rem).
const LIVE_VERS = 10 * 60e3, LIVE_GELDIG = 30 * 60e3;
function standFeit(c, st, vst){
  const f = { pick:[], bulk:[], vst, geen:0, kar:0, bron:'live', via:'stand', t:st.t };
  st.l.forEach(l => { if(+l[1] && +l[1] !== 3857) return; if(l[3] === 1 || /^container\s*\d+$/i.test(String(l[0] || ''))){ f.kar += num(l[4]) || 0; return; } if(!String(l[0] || '').trim()){ f.geen += num(l[4]) || 0; return; } (l[2] ? f.bulk : f.pick).push({ n:l[0], v:num(l[4]) || 0, tijd:isTijd(l[0]) }); });
  return f;
}
function liveVan(c){
  const own = S.live.prod[c], st = window.WHAL && WHAL.S.st && WHAL.S.st.p && WHAL.S.st.p[c];
  const tOwn = own ? own.t : 0, tSt = st && st.t && st.l ? Date.parse(st.t) || 0 : 0;
  if(!tOwn && !tSt) return null;
  if(tOwn >= tSt) return { t:tOwn, f:own.f };
  const p = D.P[c] || {}, catVst = window.WHAL && WHAL.S.cat && WHAL.S.cat.vst ? WHAL.S.cat.vst[c] : null;
  return { t:tSt, f:standFeit(c, st, num(catVst !== null && catVst !== undefined ? catVst : p.voorraad_vst) || 0) };
}
function locInfo(c){
  const h = koppelVan(c); if(h) c = h;
  const p = D.P[c] || {}, lv = liveVan(c);
  let f;
  if(lv && Date.now() - lv.t < LIVE_GELDIG) f = Object.assign({}, lv.f, { pick:lv.f.pick.slice(), bulk:lv.f.bulk.slice(), t:new Date(lv.t).toISOString() });
  else {
    const catVst = window.WHAL && WHAL.S.cat && WHAL.S.cat.vst ? WHAL.S.cat.vst[c] : null;
    f = { pick:[], bulk:[], vst:num(catVst !== null && catVst !== undefined ? catVst : p.voorraad_vst) || 0, geen:0, kar:0, bron:'export', t:D.VRDATUM };
    const l = P().locaties(c);
    l.pick.forEach(([n, v]) => f.pick.push({ n, v:num(v) || 0, tijd:isTijd(n) }));
    l.bulk.forEach(([n, v]) => f.bulk.push({ n, v:num(v) || 0 }));
    f.geen = l.geen || 0;
  }
  String(p.locaties_hm || '').split(/[,|]/).map(s => s.trim()).filter(l => l && !/^container/i.test(l)).forEach(l => {
    if(!f.pick.some(x => x.n === l) && !f.bulk.some(x => x.n === l)) (isBulk(l) ? f.bulk : f.pick).push({ n:l, v:0, tijd:isTijd(l) });
  });
  return f;
}
const som = a => a.reduce((s, x) => s + (x.v || 0), 0);
// bulkplek → producten met voorraad (voor Mix: gedeelde plek of mixpallet)
function bulkBezet(){
  if(S.idx && S.idx.vr === D.VR && S.idx.st === (window.WHAL && WHAL.S.st)) return S.idx.bz;
  const bz = {};
  Object.entries(D.VR || {}).forEach(([c, v]) => Object.entries(v.locs || {}).forEach(([l, n]) => { if(n > 0 && isBulk(l)) (bz[l] = bz[l] || new Set()).add(c); }));
  const st = window.WHAL && WHAL.S.st;
  if(st && st.p) Object.entries(st.p).forEach(([c, x]) => (x.l || []).forEach(l => { if(l[2] && num(l[4]) > 0) (bz[l[0]] = bz[l[0]] || new Set()).add(c); }));
  S.idx = { vr:D.VR, st, bz };
  return bz;
}
const anderOpPlek = (c, l) => [...(bulkBezet()[l] || [])].filter(x => x !== c && koppelVan(x) !== c);

/* ---------- vastgelegd in productdata door Daan ---------- */
const DAANBRON = new Set(['daan', 'invul', 'familie', 'samen', 'kleuren', 'klein', 'spraak', 'basisregel', 'regel', 'pd2', 'herstel']);
function vastPd(c, k){
  if(S.verberg && S.verberg.c === c && S.verberg.k === k) return null;   // meting: doen alsof Daans waarde er niet is
  const r = P().S.pd[c]; if(!r || !r.data) return null;
  const v = r.data[k]; if(leeg(v) || String(v).trim().toLowerCase() === 'onb') return null;
  const m = (r.meta || {})[k] || {}; if(m.tw || !DAANBRON.has(m.bron || '')) return null;
  return String(v).trim();
}

/* ---------- velden ---------- */
const MATEN = ['80x120', '90x120', '100x100', '100x150', '110x110', '120x150', '120x180', '100x200', '120x200', '120x240'];
const MATEN_WB = ['120x210', '130x210', '130x250'];
const VERP = ['doos', 'omdoos', 'bundel', 'pak', 'rol', 'los', 'wisselend', 'nvt'];
const PICKC = [['klopt', 'klopt'], ['anders', 'moet anders'], ['moetpick', 'moet pick krijgen'], ['geenpick', 'geen pick']];
const VELD = {
  pickc:{ t:'Picklocatie', type:'pick' },
  lvl:{ t:'Aanvullen bij', type:'num' },
  maxpick:{ t:'Max op pick', type:'num' },
  spp:{ t:'Stuks per pallet', type:'num' },
  maat:{ t:'Palletmaat', type:'maat' },
  hoogte:{ t:'Hoogte incl. pallet (cm)', kort:'Hoogte (cm)', type:'num' },
  vn:{ t:'Vloernaam', type:'tekst' },
  verp:{ t:'Inkoopverpakking', type:'verp' },
  mixgroep:{ t:'Mixgroep', type:'mix' },
  binnen:{ t:'Binnenkomst', type:'keus', opt:[['pallet', 'pallet van leverancier'], ['los', 'los, zelf pallets bouwen']] },
  maxcalc:{ t:'Max op pick', calc:1 },
  aanvmet:{ t:'Aanvullen met', calc:1 },
  gewpal:{ t:'Gewicht volle pallet (kg)', kort:'Gewicht pallet', calc:1 },
  plaatsen:{ t:'Plaatsen op ligger', kort:'Plaatsen', calc:1 },
  maxlig:{ t:'Max per ligger', calc:1 },
  rb:{ t:'Breedte (cm)', type:'num' },
  rd:{ t:'Dikte (mm)', type:'num' },
  rl:{ t:'Lengte volle rol (m)', kort:'Lengte (m)', type:'num' },
  rdia:{ t:'Diameter volle rol (cm)', kort:'Diameter', calc:1 },
  rkg:{ t:'Gewicht volle rol (kg)', kort:'kg per rol', calc:1 },
  rstand:{ t:'Staand of liggend', kort:'Staand/liggend', type:'keus', opt:[['staand', 'staand'], ['liggend', 'liggend']] },
  rmax:{ t:'Max rollen per pallet', kort:'Max rollen', type:'num' },
  rvast:{ t:'Vaste palletaantallen', kort:'Vast aantal', type:'keus', opt:[['ja', 'ja'], ['nee', 'nee']] },
  kgm:{ t:'kg per meter', calc:1 },
  kgcm:{ t:'kg per cm', calc:1 }
};
const SOORTEN = [['pallet', '1 Pallet'], ['deel', '2 Deel'], ['pick', '3 Pick'], ['mix', '4 Mix'], ['weg', '5 Weg']];
const SOORTT = { pallet:'Pallet', deel:'Deel', pick:'Pick', mix:'Mix', weg:'Weg' };
const WEG = [['uitlopend', 'Uitlopend'], ['backorder', 'Backorder'], ['archief', 'Archief']];
const KOLOMMEN = {
  pallet:['pickc', 'lvl', 'binnen', 'spp', 'maat', 'hoogte', 'vn', 'maxcalc', 'gewpal', 'plaatsen', 'maxlig'],
  deel:['pickc', 'lvl', 'maxpick', 'aanvmet', 'verp', 'binnen', 'spp', 'maat', 'hoogte', 'vn', 'gewpal', 'plaatsen', 'maxlig'],
  pick:['pickc', 'maxpick'],
  mix:['pickc', 'lvl', 'maxpick', 'aanvmet', 'verp', 'mixgroep'],
  rollen:['rb', 'rd', 'rl', 'rdia', 'rkg', 'rstand', 'rmax', 'rvast', 'kgm', 'kgcm']
};
// stap 3 (Hoeveelheid): alleen deze velden bepalen of een product klaar is; picklocatie, aanvullen bij, verpakking, vloernaam enz. blijven opgeslagen maar tellen niet meer mee
const NODIG = { pallet:['spp', 'maat', 'hoogte'], deel:['spp', 'maat', 'hoogte'], pick:['maxpick'], mix:['maxpick'], sam:['maxpick'] };
const ROLNODIG = ['rl', 'rmax'];   // bij rol op pallet/deel: lengte volle rol en max rollen per pallet
const ROLVS = ['rb', 'rd', 'rl', 'rstand', 'rmax', 'rvast'];   // voorstellen voor alle rolvelden (diameter en kg per rol worden daaruit berekend)
const SAMVELD = new Set(['pickc', 'lvl', 'maxpick']);
const isNvt = v => String(v ?? '').trim().toLowerCase() === 'nvt';
const isOnb = v => String(v ?? '').trim().toLowerCase() === 'onb';
const ingevuld = x => !!x && ['bevestigd', 'aangepast', 'vastgelegd'].includes(x.st) && !leeg(x.v) && !isOnb(x.v);
const nOf = v => isNvt(v) || isOnb(v) ? null : num(v);
const rond10 = v => Math.ceil(v / 10) * 10;

/* ---------- rol ---------- */
const eenheid = c => P().eenheid(koppelVan(c) || c);
// rol: alleen waar de data het echt aangeeft (Picqer-eenheid meter, cm of rol, of de naam zegt per meter / op rol / volle rol …)
const ROLNAAM = /\b(op rol|rol van|per rol|volle rol|full roll|rollen|per (strekkende )?meter|per cm)\b/i, GEENROL = /rolstoel|roller|rolluik|rolcontainer|rolbord/i;
const rolKand = c => { if(isKoppel(c) || isSam(c) || GEENROL.test(naamVan(c))) return false; const e = eenheid(c).e; const n = naamVan(c); return e === 'm' || e === 'cm' || e === 'rol' || ROLNAAM.test(n) || (/\brol\b/i.test(n) && /breed|dikte|\d\s*mm\b/i.test(n)); };
const rolBeslV = c => { const p = po(c); return p && p.rol && typeof p.rol.v === 'boolean' ? p.rol.v : null; };
// rol = door Daan gemarkeerd, of (nog niet besloten) een duidelijke rol volgens de data: dat is een voorstel
function isRol(c){ const b = rolBeslV(c); return b !== null ? b : rolKand(c); }
const rolVoorstel = c => rolBeslV(c) === null && rolKand(c);
const rolBesl = c => { const p = po(c); return !!(p && p.rol && typeof p.rol.v === 'boolean'); };
function breedteNaam(c){ const n = naamVan(c); const m = n.match(/breedte\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\b/i) || n.match(/(\d{2,3})\s*cm\s*(?:breed|br\b)/i) || n.match(/\b(\d{2,3})\s*cm\b/i); if(!m) return null; let v = num(m[1]); const u = (m[2] || 'cm').toLowerCase(); return u === 'm' ? v * 100 : u === 'mm' ? v / 10 : v; }
function dikteNaam(c){ const m = naamVan(c).match(/dikte\s*(\d+(?:[.,]\d+)?)\s*mm/i) || naamVan(c).match(/(\d+(?:[.,]\d+)?)\s*mm\b/i); return m ? num(m[1]) : null; }
function lengteNaam(c){
  const n = naamVan(c).toLowerCase(), m = n.match(/(?:rol van|lengte|volle rol|rol)\s*(\d+(?:[.,]\d+)?)\s*(?:m|meter)\b/) || n.match(/x\s*(\d+(?:[.,]\d+)?)\s*m\b/) || n.match(/\b(\d+(?:[.,]\d+)?)\s*m\s*(?:rol|lang)\b/);
  if(m) return { v:num(m[1]), why:'uit de naam' };
  const m2 = n.match(/rol van\s*(\d+(?:[.,]\d+)?)\s*m2\b/), br = breedteNaam(c);
  if(m2 && br > 0) return { v:Math.round(num(m2[1]) / (br / 100) * 10) / 10, why:'uit de naam: ' + nf(num(m2[1])) + ' m² / ' + nf(br) + ' cm breed' };
  const e = eenheid(c).e;
  if(e === 'rol'){ const x = P().S.extra[c] || {}, l = num(x.lengte_product_cm); if(l >= 200) return { v:l / 100, why:'Picqer: een rol is ' + nf(l) + ' cm lang' }; }
  const r = X().pbRegels(c).find(r => num(r.factor) >= 100); if(r) return { v:num(r.factor) / 100, why:'pakbon: ' + nf(num(r.factor)) + ' cm per rol' };
  if(e === 'm'){ const r2 = X().pbRegels(c).find(r => num(r.factor) > 1 && num(r.factor) < 100); if(r2) return { v:num(r2.factor), why:'pakbon: 1 rol = ' + nf(num(r2.factor)) + ' m' }; }
  return null;
}

/* ---------- gewicht ---------- */
const GEWST = [['niet', 'niet gecontroleerd'], ['gewogen', 'gewogen'], ['vertrouwd', 'vertrouwd'], ['tewegen', 'te wegen']];
function gewicht(c){
  const p = po(c), pq = kgPq(c);
  if(p && p.gew && p.gew.st) return { st:p.gew.st, kg:p.gew.st === 'gewogen' && num(p.gew.kg) > 0 ? num(p.gew.kg) : (num(p.gew.kg) > 0 ? num(p.gew.kg) : pq), pq, eigen:true, gk:num(p.gew.kg) || null, via:p.gew.via || '', pallet:num(p.gew.pallet) || null };
  const r = P().S.pd[c], m = r && r.meta && r.meta.kgst, v = r && r.data && r.data.kgst;
  if(m && DAANBRON.has(m.bron || '') && !m.tw && !leeg(v)){
    if(isOnb(v)) return { st:'tewegen', kg:pq, pq, vast:true };
    return { st:m.gew ? 'gewogen' : 'vertrouwd', kg:num(v) || pq, pq, vast:true };
  }
  return { st:'niet', kg:pq, pq };
}
// gewicht per stuk: wat Daan bij kleurgenoten of dezelfde leverancier en maat woog of goedkeurde, anders Picqer
function vsKg(c){
  const l = leerOf(c, 'kgst', [['fammaat', 1], ['levmaat', 2]]); if(l) return l;
  const pq = kgPq(c); return pq ? { v:String(pq), r:'kg:picqer', why:'Picqer-gewicht' } : null;
}
const gewKlaar = g => ['gewogen', 'vertrouwd', 'tewegen'].includes(g.st);
// sterk anders dan de familie: per m² als de maat in de naam staat, anders per stuk binnen dezelfde maat (aanname gewafw)
const maatDims = c => { const m = String(P().maatSig(naamVan(c)) || '').match(/(\d+[.,]?\d*)x(\d+[.,]?\d*)/); return m ? [num(m[1]), num(m[2])] : null; };
const mediaan = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : null; };
function gewAfwijking(c){
  const g = gewicht(c); if(!(g.kg > 0)) return 'gewicht onbekend in Picqer (0 of leeg)';
  const fk = famVan(c), leden = (P().index().fam[fk] || []).filter(x => x !== c && actief(x) && !isKoppel(x));
  const d = maatDims(c);
  if(d && d[0] > 0 && d[1] > 0){
    const per = x => { const dx = maatDims(x), gx = gewicht(x).kg; return dx && gx > 0 ? gx / (dx[0] * dx[1] / 1e4) : null; };
    const rest = leden.map(per).filter(v => v > 0); if(rest.length < 2) return '';
    const med = mediaan(rest), v = g.kg / (d[0] * d[1] / 1e4);
    return Math.abs(v - med) / med > 0.3 ? 'wijkt ' + Math.round(Math.abs(v - med) / med * 100) + '% af per m² van de familie (' + nf(v, 2) + ' tegen ' + nf(med, 2) + ' kg/m²)' : '';
  }
  const mk = maatVan(c), rest = leden.filter(x => maatVan(x) === mk).map(x => gewicht(x).kg).filter(v => v > 0);
  if(rest.length < 2) return '';
  const med = mediaan(rest);
  return Math.abs(g.kg - med) / med > 0.3 ? 'wijkt ' + Math.round(Math.abs(g.kg - med) / med * 100) + '% af van de andere producten in deze maat (' + nf(med, 3) + ' kg)' : '';
}

/* ---------- waarde van een veld: oefen → vastgelegd → voorstel ---------- */
const PDK = { lvl:'lvl', maxpick:'maxpick', spp:'spp', maat:'maat', hoogte:'hoogte', vn:'vn', mixgroep:'mixgroep', binnen:'binnenkomst' };
function eigen(c, k){ const p = po(c); return p && p.f && p.f[k] && !leeg(p.f[k].v) ? p.f[k] : null; }
// echte invoer (niet tijdens oefenen): alleen die telt voor kleurgenoten en andere producten
const echtEigen = (c, k) => { const e = eigen(c, k); return e && !e.oef ? e : null; };
function waarde(c, k, I){
  const e = eigen(c, k); if(e) return { v:String(e.v), st:e.st || 'aangepast', voor:e.voor };
  if(k === 'pickc'){ const pk = vastPick(c); if(pk) return { v:pk, st:'vastgelegd', why:'vastgelegd in productdata' }; }
  if(PDK[k]){ const v = vastPd(c, PDK[k]); if(v !== null) return { v, st:'vastgelegd', why:'vastgelegd in productdata' }; }
  const vs = (I || info(c)).vs[k];
  if(vs && !leeg(vs.v)){
    const ct = controle(c, k, vs.v, I || info(c));
    if(ct && ct.st === 'uitzoeken') return { v:'', st:'uitzoeken', why:ct.why + ' (voorstel was ' + vs.v + ': ' + vs.why + ')', afgewezen:String(vs.v), r:vs.r };
    const sc = scoreVan(vs.r);
    return { v:String(vs.v), st:vs.tw || (sc && sc.p < 0.6) || (ct && ct.st === 'twijfel') ? 'twijfel' : 'voorstel', why:vs.why + (ct ? ' · ' + ct.why : ''), alt:vs.alt, sc, r:vs.r, ct };
  }
  return { v:'', st:'leeg', why:vs && vs.mis ? vs.mis : '' };
}
function vastPick(c){
  const kz = vastPd(c, 'pickkeuze'); if(kz) return /geen/i.test(kz) ? 'geenpick' : /moet/i.test(kz) ? 'moetpick' : null;
  const v = vastPd(c, 'pick'); if(v === 'nee') return 'geenpick';
  return null;
}
// effectieve getalwaarde (ook uit een voorstel) voor de berekende velden
const effN = (c, k, I) => nOf(waarde(c, k, I).v);

/* ---------- controle vóór tonen: kan dit voorstel kloppen? ----------
   uitzoeken (rood, geen voorstel) of twijfel (oranje) met de reden; vastgelegde waarden en jouw invoer worden niet gecontroleerd. */
const vkMaand = c => Math.max(vk6(c), vk28(c) || 0);
function controle(c, k, v, I){
  const n = nOf(v);
  if(k === 'hoogte' && n !== null && (n < 30 || n > MAXH)) return { st:'uitzoeken', why:'hoogte ' + nf(n) + ' cm kan niet (moet tussen 30 en ' + MAXH + ' cm)' };
  if(k === 'spp' && n > 0){
    const maat = waarde(c, 'maat', I).v || (I.vs.maat || {}).v, cap = capaciteit(c, maat), kg = gewicht(c).kg;
    if(kg > 0 && n * kg + PALH > 1500) return { st:'twijfel', why:'pallet zou ' + nf(Math.ceil(n * kg + PALH)) + ' kg wegen (max 1.500 kg)' };
    if(cap && n > cap * 1.15) return { st:'twijfel', why:'past fysiek niet: op ' + (maat || '80x120') + ' passen volgens de Picqer-afmetingen per stuk hooguit ± ' + nf(cap) + ' stuks (tot ' + MAXH + ' cm hoog)' };
  }
  if(k === 'maat'){ const vs = I.vs.maat || {}, m = maatUitNaam(c); if(vs.r === 'maat:regel-rest' && m && (m[0] > 127 || m[1] > 87) && m[1] >= 40) return { st:'twijfel', why:'productmaat ' + m[0] + 'x' + m[1] + ' past op geen opslagmaat uit de lijst; nu de regel "al het andere → 80x120" (opgerold of gevouwen?)' }; }
  if(k === 'maxpick' && n > 0){ const vk = vkMaand(c); if(!vk) return { st:'twijfel', why:'controleer: geen verkoop gemeten' }; if(n > 3 * vk) return { st:'twijfel', why:'controleer: meer dan 3 maanden verkoop (' + nf(vk) + ' per maand)' }; }
  return null;
}

/* ---------- soort ---------- */
function soortWaarde(c, I){
  const p = po(c);
  if(p && p.so && p.so.v) return { v:p.so.v, st:p.so.st || 'aangepast', voor:p.so.voor };
  if(X().pdWaarde(c, 'uitlopend')) return { v:'weg', st:'vastgelegd', why:'staat in productdata op uitlopend' };
  const o = vastPd(c, 'opslag'); const on = o && X().soortVan ? X().soortVan(c) : '';
  if(on && SOORTT[on]) return { v:on, st:'vastgelegd', why:'vastgelegd in productdata (' + SOORTT[on] + ')' };
  const vs = (I || info(c)).vsSo, sc = vs ? scoreVan(vs.r) : null;
  return vs ? { v:vs.v, st:vs.tw || (sc && sc.p < 0.6) ? 'twijfel' : 'voorstel', why:vs.why, alt:vs.alt, sc, r:vs.r } : { v:'', st:'leeg' };
}
function wegWaarde(c, I){
  const p = po(c);
  if(p && p.weg && p.weg.v) return { v:p.weg.v, st:p.weg.st || 'aangepast', voor:p.weg.voor };
  if(X().pdWaarde(c, 'uitlopend')) return { v:'uitlopend', st:'vastgelegd', why:'staat in productdata op uitlopend' };
  const vs = (I || info(c)).vsWeg;
  return vs ? { v:vs.v, st:'voorstel', why:vs.why } : { v:'', st:'leeg' };
}

/* ---------- voorstellen per product, uit zijn eigen data, altijd met reden ---------- */
function capPick(c){ const pq = D.PQ[c] || [], a = num(pq[0]), b = num(pq[1]); return b > 1 && !(a === 1 && b === 11) ? b : null; }
const kleurgenoten = c => { const fk = famVan(c), mk = maatVan(c); return (P().index().fam[fk] || []).filter(x => x !== c && maatVan(x) === mk && actief(x) && !isKoppel(x) && !isSam(x)); };
// waarde die Daan al bij een kleurgenoot invulde (2.0) of vastlegde (productdata)
function vanGenoot(c, k){
  if(isSam(c)) return null;
  const t = {};
  kleurgenoten(c).forEach(x => { const e = echtEigen(x, k), v = e ? String(e.v) : PDK[k] ? vastPd(x, PDK[k]) : null; if(v && !isNvt(v) && !isOnb(v)) (t[v] = t[v] || []).push(x); });
  const b = Object.entries(t).sort((a, z) => z[1].length - a[1].length)[0];
  return b ? { v:b[0], why:'kleurgenoot met dezelfde maat: ' + b[1].slice(0, 2).join(', ') + (b[1].length > 2 ? ' +' + (b[1].length - 2) : '') + ' heeft ' + b[0] } : null;
}
function wFn(c){
  const pw = P().waardeFn(c);
  return k => { if(k === 'kgst'){ const g = gewicht(c); return g.st === 'gewogen' && g.kg ? String(g.kg) : pw(k); } if(PDK[k]){ const e = eigen(c, k); if(e) return String(e.v); } return pw(k); };
}
function pdVs(c, k, ok){
  let r = null; try{ r = P().voorstel(c, k, wFn(c)); }catch(e){ return null; }
  if(!r || leeg(r.v) || r.r === 'conflict') return null;
  return ok(r) ? r : null;
}
/* ---------- leren van Daans eigen invoer (ronde 2) ----------
   Per veld: wat Daan vastlegde bij kleurgenoten (zelfde familie en maat), in de familie, bij dezelfde leverancier met dezelfde
   maat (Spurt-achtige patronen bij Cortona, Paris rib …) en bij de leverancier. Het product zelf telt nooit mee.
   Meerderheid nodig: minstens 2 (kleurgenoot 1) en ≥ 60% van de waarden in die groep. */
const LEERVELD = ['opslag', 'spp', 'maat', 'hoogte', 'lvl', 'maxpick', 'vn', 'kgst', 'spd'];
const levVan = c => String((D.P[c] || {}).leverancier || '').trim();
const maatKeyC = c => { const d = maatDims(c); return d ? d.slice().sort((a, b) => a - b).join('x') : ''; };
let LEER = null;
function leerIndex(){
  if(LEER && LEER.pd === P().S.pd && LEER.ver === S.dataVer) return LEER;
  const ix = {}, voeg = (k, n, key, v, c) => { if(!key) return; const a = ((ix[k] = ix[k] || {})[n] = ix[k][n] || {}); const b = (a[key] = a[key] || {}); (b[v] = b[v] || []).push(c); };
  Object.entries(P().S.pd).forEach(([c, r]) => {
    if(!r || !r.data || !actief(c) || isKoppel(c) || isSam(c)) return;
    const lev = levVan(c), mk = maatKeyC(c), fk = famVan(c);
    LEERVELD.forEach(k => {
      const v = r.data[k], m = (r.meta || {})[k] || {};
      if(leeg(v) || isOnb(v) || isNvt(v) || m.tw || !TOETSBRON.has(m.bron || '')) return;
      const val = k === 'opslag' ? soortNormKort(v) : k === 'maat' ? maatNorm(v) : k === 'vn' ? vnStijl(c, String(v)) : String(num(v) !== null && k !== 'vn' ? num(v) : String(v).trim());
      if(k === 'opslag' && !SOORTT[val]) return;
      if(k === 'vn' && !val) return;
      voeg(k, 'fam', fk, val, c); voeg(k, 'lev', lev, val, c);
      if(mk){ voeg(k, 'fammaat', fk + '|' + mk, val, c); voeg(k, 'levmaat', lev + '|' + mk, val, c); }
    });
  });
  LEER = { pd:P().S.pd, ver:S.dataVer, ix };
  return LEER;
}
const NIVT = { fammaat:'kleurgenoten (zelfde familie en maat)', fam:'de familie', levmaat:'zelfde leverancier en maat', lev:'de leverancier' };
function leer(c, k, niv, min){
  const lev = levVan(c), mk = maatKeyC(c), fk = famVan(c);
  const key = niv === 'fam' ? fk : niv === 'lev' ? lev : niv === 'fammaat' ? (mk ? fk + '|' + mk : '') : (mk ? lev + '|' + mk : '');
  const t = key && (((leerIndex().ix[k] || {})[niv] || {})[key]);
  if(!t) return null;
  const tel = Object.entries(t).map(([v, cs]) => [v, cs.filter(x => x !== c)]).filter(x => x[1].length).sort((a, b) => b[1].length - a[1].length);
  const tot = tel.reduce((n, x) => n + x[1].length, 0); if(!tot) return null;
  const [v, cs] = tel[0];
  if(cs.length < (min || 2) || cs.length / tot < 0.6) return null;
  return { v, n:cs.length, tot, why:'Daans keuze bij ' + NIVT[niv] + ': ' + cs.length + ' van ' + tot + ' (' + cs.slice(0, 2).join(', ') + (cs.length > 2 ? ' …' : '') + ')', r:k + ':leer-' + niv };
}
// vloernaam: welke vorm Daan gebruikt (alleen de code, code + naam, naam, eerste deel van de naam, naam - code …)
const vnN = s => String(s || '').toLowerCase().replace(/[^a-z0-9à-ÿ]/g, '');
const naamDelen = c => naamVan(c).split(/\s+[-–]\s+/).map(x => x.trim()).filter(Boolean);
const VNVORM = {
  code:c => c,
  naam:c => naamVan(c).replace(/\s*\*[^*]*\*\s*$/, '').trim(),
  naam1:c => naamDelen(c)[0] || '',
  naam2:c => naamDelen(c).slice(0, 2).join(' - '),
  naamzm:c => naamDelen(c).filter(x => !/^\d+([.,]\d+)?\s*m2$|€|per\s+(strekkende\s+)?(meter|cm|m2|rol)|^(outdoor|indoor)\b/i.test(x)).join(' - '),
  codenaam:c => c + ' ' + naamVan(c),
  codenaam1:c => c + ' ' + (naamDelen(c)[0] || ''),
  naamcode:c => (naamDelen(c)[0] || '') + ' - ' + c
};
function vnStijl(c, v){ const n = vnN(v); for(const [k, f] of Object.entries(VNVORM)){ const x = f(c); if(x && vnN(x) === n) return k; } return ''; }
function leerOf(c, k, nivs){ for(const [niv, min] of nivs){ const x = leer(c, k, niv, min); if(x) return x; } return null; }
/* ---------- bronnen per product (correctie ronde 2b) ----------
   a. Daans eigen invoer in productdata (waarde(): "vastgelegd")   b. palletlabel-generator (catalog-ean: qty, naam)
   c. verplaatsingen (naar VST, van bulk naar pick bij volle pallets)   d. ≥ 2 VST- of bulkpallets met hetzelfde aantal
   e. pakbonnen/containers (per pallet, bruto per pallet, m³)   f. kleurgenoot (zelfde familie en maat) met een waarde uit a–e
   g. inkoop: alleen bewijs voor de soort, nooit stuks per pallet. Daarna pas Daans patronen bij dezelfde leverancier en maat.
   Elk voorstel gaat door controle() voordat het in beeld komt (hoogte 30–250 cm, past fysiek, gewicht, max t.o.v. verkoop). */
// palletlabels (catalog-ean): alleen een echt getal telt (een qty als "6090WM" is een tikfout, geen 6090 per pallet); laatst gebruikt eerst
// palletlabel waarvan de naam een andere productcode is (label van 100150WM heet "100200WM"): niet gebruiken, op de lijst om te verbeteren
// alleen als de hele labelnaam (zonder spaties, streepjes, punten) een andere productcode is
const codeNorm = x => String(x || '').toLowerCase().replace(/[\s\-_.\/]+/g, '');
let CN = { n:-1, m:null };
function codeIndex(){ const n = Object.keys(D.P || {}).length; if(CN.n === n && CN.m) return CN.m; const m = {}; Object.keys(D.P || {}).forEach(c => { const k = codeNorm(c); if(k && !m[k]) m[k] = c; }); CN = { n, m }; return m; }
const labelCode = g => { const t = codeNorm(g && g.name); return t ? codeIndex()[t] || null : null; };
const labelFout = (c, g) => { const k = labelCode(g); return !!k && codeNorm(k) !== codeNorm(c); };
const labelsGoed = c => (D.GEH[String(c).toLowerCase()] || []).filter(g => !labelFout(c, g));
function labelsVerbeteren(){
  const uit = [];
  Object.entries(D.GEH || {}).forEach(([k, l]) => { const c = (D.PLOW || {})[k] || k; if(!D.P[c] || !actief(c)) return; (l || []).forEach(g => { if(labelFout(c, g)) uit.push({ c, naam:String(g.name || '').trim(), qty:String(g.qty ?? ''), ander:labelCode(g) }); }); });
  return uit.sort((a, b) => a.c.localeCompare(b.c));
}
const labelSppLijst = c => { if(S.verberg && S.verberg.c === c && S.verberg.k === 'spp') return []; const l = labelsGoed(c).slice().sort((a, b) => (b.used || 0) - (a.used || 0)).map(g => String(g.qty ?? '').trim()).filter(q => /^\d+([.,]\d+)?$/.test(q)).map(num).filter(v => v > 0); return [...new Set(l)]; };
function sppUitBronnen(c, metGenoot){
  const uit = [];
  const lab = labelSppLijst(c);
  if(lab.length) uit.push({ v:lab[0], alt:lab.length > 1 ? lab : null, why:'palletlabel' + (lab.length > 1 ? 's verschillen: ' + lab.map(x => nf(x)).join(' / ') : ': ' + nf(lab[0]) + ' per pallet'), id:'spp:label' });
  let b = {}; try{ b = X().sppBronnen(c) || {}; }catch(e){}
  if(b.mvvst) uit.push({ v:num(b.mvvst.v), why:b.mvvst.t, id:'spp:verplaatst' });
  if(b.mvpick) uit.push({ v:num(b.mvpick.v), why:b.mvpick.t, id:'spp:verplaatst' });
  if(b.vst2) uit.push({ v:num(b.vst2.v), why:b.vst2.t, id:'spp:pallets' });
  if(b.bulk2) uit.push({ v:num(b.bulk2.v), why:b.bulk2.t, id:'spp:pallets' });
  if(b.pakbon) uit.push({ v:num(b.pakbon.v), why:b.pakbon.t, id:'spp:pakbon' });
  if(metGenoot){
    const t = {};
    kleurgenoten(c).forEach(x => { const e = echtEigen(x, 'spp'), v = e ? nOf(e.v) : nOf(vastPd(x, 'spp')); const w = v > 0 ? v : (sppUitBronnen(x, false)[0] || {}).v; if(w > 0) (t[w] = t[w] || []).push(x); });
    const best = Object.entries(t).sort((p, q) => q[1].length - p[1].length)[0];
    if(best) uit.push({ v:+best[0], why:'kleurgenoot met dezelfde maat: ' + best[1].slice(0, 2).join(', ') + (best[1].length > 2 ? ' +' + (best[1].length - 2) : '') + ' heeft ' + nf(+best[0]), id:'spp:genoot' });
  }
  return uit.filter(x => x.v > 0);
}
// binnenkomst bij Pallet en Deel: pallet van de leverancier, of los binnen en zelf pallets bouwen
const BRON_ZELF = new Set(['spp:label', 'spp:verplaatst', 'spp:pallets']);
function vsBinnen(c, ink){
  if(isSam(c)) return null;
  const br = sppUitBronnen(c, false).filter(x => BRON_ZELF.has(x.id)), s = br.length ? br[0].v : null;
  if(ink && s && ink.meestal >= 0.85 * s) return { v:'pallet', why:'inkoop meestal ' + nf(ink.meestal) + ' ≈ een volle pallet van ' + nf(s), r:'binnen:inkoop' };
  if(ink && s) return { v:'los', why:'inkoop meestal ' + nf(ink.meestal) + ', minder dan een pallet van ' + nf(s) + ': zelf pallets bouwen', r:'binnen:inkoop' };
  return null;
}
function vsSpp(c, I){
  if(isSam(c)) return null;
  const bk = I ? waarde(c, 'binnen', I).v : '';
  if(bk === 'los'){
    // zelf pallets bouwen: alleen palletlabels, VST/bulk-pallets en verplaatsingen, nooit inkoop
    const z = sppUitBronnen(c, false).filter(x => BRON_ZELF.has(x.id));
    if(!z.length) return { mis:'zelf pallets bouwen: geen palletlabel, VST-pallets of verplaatsingen: uitzoeken (nooit uit inkoop)' };
    const t = z[0], a = z.filter(x => x.v !== t.v);
    return Object.assign({ v:String(t.v), why:t.why + ' (zelf pallets bouwen)', r:t.id }, t.alt || a.length ? { tw:true, alt:[...new Set((t.alt || [t.v]).concat(a.map(x => x.v)).map(String))] } : {});
  }
  const br = sppUitBronnen(c, true);
  if(!br.length && bk === 'pallet' && I && I.ink) return { v:String(I.ink.meestal), why:'pallet van de leverancier: inkoop meestal ' + nf(I.ink.meestal) + ' per order', r:'spp:inkoop' };
  if(!br.length){ const l = leerOf(c, 'spp', [['levmaat', 2]]); return l ? Object.assign(l, { why:l.why + ' (zelfde leverancier en maat)' }) : { mis:'geen palletlabel, verplaatsingen, pallets, pakbon of kleurgenoot: uitzoeken (inkoop zegt niets over stuks per pallet)' }; }
  const top = br[0], ander = br.filter(x => x !== top && x.v !== top.v);
  const uit = { v:String(top.v), why:top.why, r:top.id, bron:br.map(x => x.why) };
  if(top.alt || ander.length){ uit.tw = true; uit.alt = [...new Set((top.alt || [top.v]).concat(ander.map(x => x.v)).map(String))]; if(ander.length) uit.why += ' · andere bron: ' + ander.map(x => x.why).join(' · '); }
  return uit;
}
// past fysiek: afmetingen per stuk (Picqer) in alle richtingen op de palletmaat, tot 250 cm incl. 15 cm pallet, 7 cm overstek
const MAXH = 250, PALH = 15;
function stukDims(c){ const e = P().S.extra[c] || {}, d = [num(e.lengte_product_cm), num(e.breedte_product_cm), num(e.hoogte_product_cm)]; return d.every(x => x > 0) ? d : null; }
const palDims = maat => { const m = String(maat || '').match(/(\d+)\s*x\s*(\d+)/); return m ? [+m[1], +m[2]] : [80, 120]; };
function stapel(c, maat){
  const d = stukDims(c); if(!d) return null;
  const [PL, PB] = palDims(maat), perms = [[0, 1, 2], [1, 0, 2], [0, 2, 1], [2, 0, 1], [1, 2, 0], [2, 1, 0]];
  return perms.map(([i, j, k]) => { const per = Math.floor((PL + 7) / d[i]) * Math.floor((PB + 7) / d[j]); return { per, h:d[k], lagen:Math.floor((MAXH - PALH) / d[k]), pl:d[i] + 'x' + d[j] }; }).filter(x => x.per > 0);
}
const capaciteit = (c, maat) => { const s = stapel(c, maat); return s && s.length ? Math.max(...s.map(x => x.per * x.lagen)) : null; };
function lagenHoogte(c, spp, maat){
  const s = stapel(c, maat); if(!s || !s.length || !(spp > 0)) return null;
  const opties = s.map(x => ({ x, lagen:Math.ceil(spp / x.per), hoog:Math.ceil(spp / x.per) * x.h + PALH })).sort((p, q) => p.hoog - q.hoog);
  return opties[0];
}
// palletmaat-regels van Daan (eigen versie, met de keuzelijst van 2.0): altijd een maat; whiteboards de kleinste opslagmaat waar het bord in past
function maatUitNaam(c){ const m = naamVan(c).match(/(\d{2,3})(?:[.,]\d)?\s*[x×]\s*(\d{2,3})(?:[.,]\d)?(?!\s*mm)/i); if(!m) return null; const a = +m[1], b = +m[2]; return a >= 20 && b >= 20 ? [Math.max(a, b), Math.min(a, b)] : null; }
function kleinsteMaat(L, B, lijst){ const a = Math.max(L, B), b = Math.min(L, B); const k = lijst.map(m => m.split('x').map(Number)).map(([x, y]) => [Math.max(x, y), Math.min(x, y)]).filter(([x, y]) => x >= a - 7 && y >= b - 7).sort((p, q) => p[0] * p[1] - q[0] * q[1]); return k.length ? k[0][1] + 'x' + k[0][0] : null; }
const isWB = c => /whiteboard/i.test(naamVan(c)) && !/marker|wisser|houder|magne(et|ten)|onderstel|accessoire|reiniger|spray|stift/i.test(naamVan(c));
const wbHoogte = () => { const v = window.WHAAN ? parseFloat(String(WHAAN.waarde('p-wbh') || '').replace(',', '.')) : NaN; return isNaN(v) ? 140 : v; };
function maatRegel(c){
  const n = naamVan(c).toLowerCase(), R = (maat, h, why) => ({ maat, h, why, r:'maat:regel' });
  const doos = String(vastPd(c, 'doos') || '').match(/(\d+)\s*x\s*(\d+)/); if(doos && Math.min(+doos[1], +doos[2]) > 80) return R('90x120', 180, 'regel Daan: omdoos breder dan 80 cm → 90x120x180');
  if(/huishoudtrap/.test(n)){ const t = n.match(/(\d)\s*treden/); if(t) return +t[1] <= 2 ? R('80x120', 180, 'regel Daan: huishoudtrap 2 treden → 80x120x180') : R('100x150', 180, 'regel Daan: huishoudtrap ' + t[1] + ' treden → 100x150x180'); }
  if(/bureaustoel/.test(n)) return R('80x120', 180, 'regel Daan: bureaustoel 80x120x180');
  if(isWB(c)){
    const m = maatUitNaam(c);
    if(m && m[0] <= 127 && m[1] <= 87) return R('80x120', 180, 'regel Daan: whiteboard t/m 80x120 → 80x120x180');
    // grote borden (200 cm en langer) krijgen ruimte in de lengte: zo kiest Daan 120x210 voor 120x200 en 130x250 voor 120x240
    if(m && m[0] >= 200){ const pm = kleinsteMaat(m[0] + 12, m[1] + 7, MATEN.concat(MATEN_WB)); if(pm) return R(pm, wbHoogte(), 'regel Daan: groot whiteboard ' + m[0] + 'x' + m[1] + ' → kleinste opslagmaat met ruimte in de lengte: ' + pm); }
    if(m){ const pm = kleinsteMaat(m[0], m[1], MATEN) || kleinsteMaat(m[0], m[1], MATEN.concat(MATEN_WB)); if(pm) return R(pm, wbHoogte(), 'regel Daan: whiteboard ' + m[0] + 'x' + m[1] + ' → kleinste opslagmaat waar het bord in past: ' + pm); }
    return R('100x150', wbHoogte(), 'regel Daan: whiteboard, maat onbekend → 100x150');
  }
  if((/sportvloer/.test(n) && /tegel/.test(n)) || (/rubber/.test(n) && /tegel/.test(n) && /(^|[,|]\s*)CE/i.test(String((D.P[c] || {}).locaties_hm || '')))) return R('110x110', 160, 'regel Daan: sportvloer tegel / rubber tegel afdeling CE → 110x110x160');
  if(isRingHD(c)) return R('100x150', 120, 'regel Daan: ringmat op rol heavy duty, 6 rollen rechtop op 100x150');
  if((/ringmat/.test(n) || (/rubber/.test(n) && /\bmet rand\b/.test(n))) && !/batch midden/i.test(String((D.P[c] || {}).tags || ''))){
    if(/\brol\b|\broll\b/.test(n)) return R('100x150', 120, 'regel Daan: ringmat op rol → 100x150x120');
    // ringmatten met een maat in de naam: de opslagmaat waar de mat plat op past (Daan: 100x100 op 100x100, 80x120 op 80x120, 100x200 op 100x200)
    const m = maatUitNaam(c), pm = m && kleinsteMaat(m[0], m[1], MATEN);
    if(pm) return R(pm, 120, 'regel Daan: rubber ringmat ' + m[0] + 'x' + m[1] + ' → plat op ' + pm + ', hoogte 120');
    return R('100x150', 120, 'regel Daan: rubber ringmat met rand → 100x150x120');
  }
  if(/(rubber|sportvloer)/.test(n) && /\brol\b|rollen|per meter/.test(n)){ const b = breedteNaam(c); if(b) return b <= 120 ? R('80x120', 140, 'regel Daan: rubber rol ' + b + ' breed (≤ 120) → 80x120x140') : b <= 160 ? R('100x150', 100, 'regel Daan: rubber rol ' + b + ' breed (120–160) → 100x150x100') : R('120x180', 100, 'regel Daan: rubber rol ' + b + ' breed (> 160) → 120x180x100'); }
  const m = maatUitNaam(c);
  if(m && m[0] >= 60 && m[1] >= 60 && !(m[0] <= 127 && m[1] <= 87)){ const pm = kleinsteMaat(m[0], m[1], MATEN); if(pm) return Object.assign(R(pm, 180, 'regel Daan: productmaat ' + m[0] + 'x' + m[1] + ' uit de naam → opslagmaat ' + pm), { r:'maat:regel-naam' }); }
  return Object.assign(R('80x120', 180, 'regel Daan: al het andere → 80x120x180'), { r:'maat:regel-rest' });
}
const opLijst = (c, m) => { const lijst = MATEN.concat(isWB(c) ? MATEN_WB : []), k = maatNorm(m); if(lijst.some(x => maatNorm(x) === k)) return lijst.find(x => maatNorm(x) === k); const d = palDims(m); return kleinsteMaat(d[0], d[1], lijst); };
function vsMaat(c){
  if(isSam(c)) return null;
  const pb = X().pbRegels(c).find(r => r.palletmaat || r.maat); if(pb){ const v = opLijst(c, pb.palletmaat || pb.maat); if(v) return { v, why:'pakbon: palletmaat ' + (pb.palletmaat || pb.maat), r:'maat:pakbon' }; }
  const g = vanGenoot(c, 'maat'); if(g){ const v = opLijst(c, g.v); if(v) return Object.assign(g, { v, r:'maat:genoot' }); }
  { const l = leerOf(c, 'maat', [['levmaat', 2], ['fam', 3]]); if(l){ const v = opLijst(c, l.v); if(v) return Object.assign(l, { v }); } }
  const R = maatRegel(c); return { v:R.maat, why:R.why, r:R.r };
}
function vsHoogte(c, spp, maat){
  if(isSam(c)) return null;
  const g = vanGenoot(c, 'hoogte'); if(g) return Object.assign(g, { v:String(rond10(num(g.v))), r:'hoogte:genoot' });
  const pm = palDims(maat), pbr = X().pbRegels(c).find(r => r.soort === 'pallet' && num(r.cbm) && num(r.aantal));
  if(pbr){ const h = num(pbr.cbm) / num(pbr.aantal) / (pm[0] * pm[1] / 1e4) * 100; if(h > 20 && h < 260) return { v:String(rond10(h)), why:'pakbon: ' + nf(num(pbr.cbm) / num(pbr.aantal), 2) + ' m³ per pallet op ' + pm.join('x') + ', naar boven op 10 cm', r:'hoogte:pakbon' }; }
  { const l = leerOf(c, 'hoogte', [['levmaat', 2], ['fam', 3]]); if(l) return Object.assign(l, { v:String(rond10(num(l.v))) }); }
  const R = maatRegel(c);
  if(R.r === 'maat:regel') return { v:String(R.h), why:R.why + ' (hoogte incl. pallet)', r:'hoogte:regel' };
  const L = lagenHoogte(c, spp, maat);
  if(L && L.hoog >= 30 && L.hoog <= MAXH) return { v:String(rond10(L.hoog)), why:'lagen op ' + pm.join('x') + ': ' + nf(L.x.per) + ' per laag (' + L.x.pl + ' cm), ' + nf(L.lagen) + ' lagen × ' + nf(L.x.h) + ' cm + 15 cm pallet, naar boven op 10 cm', r:'hoogte:lagen' };
  if(L) return { v:String(rond10(L.hoog)), why:'lagen op ' + pm.join('x') + ' geven ' + nf(L.hoog) + ' cm', r:'hoogte:lagen' };
  if(!stukDims(c) && R) return { v:String(R.h), why:R.why + ' (hoogte incl. pallet)', r:'hoogte:' + R.r.split(':')[1] };
  return { mis:spp > 0 ? 'afmetingen per stuk ontbreken in Picqer' : 'eerst stuks per pallet' };
}
function vsLvl(c){
  const R = X().regelVan(c); if(R){ try{ const d = R.doel(c); if(d && d.lvl !== undefined && d.lvl !== null) return { v:String(d.lvl), why:'aanvulregel: ' + R.t, r:'lvl:regel' }; }catch(e){} }
  // dezelfde regels van Daan ook zonder picklocatie (de aanvulregel zelf geldt alleen met picklocatie)
  if(/bureaustoel/i.test(naamVan(c)) && !isSam(c)) return { v:'0', why:'regel Daan: bureaustoelen aanvullen als de picklocatie leeg is (bij 0), met een volle pallet', r:'lvl:regel' };
  if(isWB(c) && !isSam(c)) return { v:'3', why:'regel Daan: whiteboards aanvullen bij 3', r:'lvl:regel' };
  if(/wandrek/i.test(naamVan(c)) && !isSam(c)) return { v:'2', why:'regel Daan: wandrekken aanvullen bij 2, met hele omdozen', aan:'wandrek', r:'lvl:wandrek' };
  { const g = vanGenoot(c, 'lvl'); if(g) return Object.assign(g, { r:'lvl:genoot' }); }
  { const l = leerOf(c, 'lvl', [['fammaat', 1], ['fam', 2]]); if(l) return l; }
  const pq = D.PQ[c], a = D.AANVUL[c];
  if(pq && num(pq[0]) > 1) return { v:String(num(pq[0])), why:'huidige stand in Picqer: aanvullen bij ' + nf(num(pq[0])), r:'lvl:picqer' };
  if(a && a.ok && num(a.lvl) > 1) return { v:String(num(a.lvl)), why:'huidige stand in de aanvulbase: ' + nf(num(a.lvl)), r:'lvl:aanvulbase' };
  return leerOf(c, 'lvl', [['levmaat', 2], ['lev', 3]]);
}
// doosveelvoud: Daan zet max op pick vaak op hele dozen (bijv. 15): naar boven op een veelvoud van de inkoopverpakking
function doosVan(c){ const sp = vastPd(c, 'spd'); if(sp && num(sp) > 1) return num(sp); const r = X().pbRegels(c).find(r => r.soort !== 'pallet' && num(r.per) > 1); return r ? num(r.per) * (num(r.factor) || 1) : null; }
function opDoos(c, x){
  if(!x || leeg(x.v)) return x;
  const d = doosVan(c), v = num(x.v); if(!(d > 1) || !(v > 0) || v % d === 0) return x;
  return Object.assign({}, x, { v:String(Math.ceil(v / d) * d), why:x.why + ' · naar boven op hele dozen van ' + nf(d), r:x.r + '+doos' });
}
// Deel: max op pick = wat op de picklocatie past (niet bij + pallet): Picqer-instelling, grootste aanvulling naar pick in de
// verplaatsingen, of kleurgenoot; anders leeg
function grootstePick(c){
  const isBulk = n => !!(D.LOC[n] && D.LOC[n].bulk);
  const l = ((P().S.mv || {})[c] || []).filter(m => !m.vst && m.n > 0 && m.naar && !isBulk(m.naar) && isBulk(m.van)).map(m => m.n);
  return l.length ? Math.max(...l) : null;
}
function vsMax(c, so, ink){
  if(so === 'deel'){
    const cap = capPick(c); if(cap !== null) return { v:String(cap), why:'huidige stand in Picqer: vul aan tot ' + nf(cap), r:'max:picqer' };
    const g = grootstePick(c); if(g) return { v:String(g), why:'grootste aanvulling naar pick in de verplaatsingen: ' + nf(g), r:'max:mvpick' };
    const k = vanGenoot(c, 'maxpick'); if(k) return Object.assign(k, { r:'max:genoot' });
    return { mis:'geen Picqer-instelling, geen aanvulling naar pick in de verplaatsingen en geen kleurgenoot: uitzoeken (bij Deel is max wat op de picklocatie past)' };
  }
  const R = X().regelVan(c); if(R && so !== 'pick'){ try{ const d = R.doel(c); if(d && d.max !== null && d.max !== undefined) return { v:String(d.max), why:'aanvulregel: ' + R.t + (d.uitleg ? ' (' + d.uitleg + ')' : ''), r:'max:regel' }; }catch(e){} }
  { const g = vanGenoot(c, 'maxpick'); if(g) return Object.assign(g, { r:'max:genoot' }); }
  { const l = leerOf(c, 'maxpick', [['fammaat', 1], ['levmaat', 2]]); if(l) return l; }
  const cap = capPick(c); if(cap !== null) return { v:String(cap), why:'huidige stand in Picqer: vul aan tot ' + nf(cap), r:'max:picqer' };
  const a = D.AANVUL[c]; if(a && a.ok && num(a.max ?? a.tot) > 1) return { v:String(num(a.max ?? a.tot)), why:'huidige stand in de aanvulbase: max ' + nf(num(a.max ?? a.tot)), r:'max:aanvulbase' };
  if(so === 'pick' && ink) return opDoos(c, { v:String(ink.meestal), why:'meest gebruikte inkoop per order: ' + nf(ink.meestal) + (ink.meestalN > 1 ? ' (' + ink.meestalN + '×)' : ''), r:'max:inkoop' });
  return null;
}
/* vloernaam (correctie): productcode (tenzij langer dan 14 tekens) + " - " + korte omschrijving met de onderscheidende kenmerken,
   bijv. "4560WM - Whiteboard magnetisch 45x60". Lopers en matten met dikte. Een palletlabel-naam gaat voor, tenzij die alleen de code is. */
const VN_WEGDEEL = /^(per\s+(stuk|cm|meter|strekkende meter|rol|m2)|full roll|volle rol \/ full roll|\d+([.,]\d+)?\s*m2|€.*|\d+\s*stuks?|.*\*per\s+meter\*.*|outdoor.*|indoor.*|paardenbak|paardenstal)$/i;
function korteOmschrijving(c){
  let n = naamVan(c).replace(/\s*=\s*[A-Z0-9][A-Z0-9 ]*$/, '').replace(/\*[^*]*\*/g, ' ');
  const delen = n.split(/\s+[-–|]\s+/).map(x => x.trim()).filter(Boolean).filter(x => !VN_WEGDEEL.test(x));
  let maat = '';
  const tekst = delen.map(d => d.replace(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×]\s*\d+(?:[.,]\d+)?)?\s*(cm)?/gi, (m0, a, b) => { if(!maat) maat = a + 'x' + b; return ' '; }).replace(/\b(\d+(?:[.,]\d+)?)\s+(mm|cm)\b/gi, '$1$2').replace(/\b(dikte|breedte)\s*/gi, '').replace(/\s{2,}/g, ' ').trim()).filter(Boolean);
  let s = tekst.join(' ').replace(/\s{2,}/g, ' ').trim();
  if(maat && !/\d+x\d+/.test(s)) s += ' ' + maat;
  s = s.toLowerCase().replace(/^./, m => m.toUpperCase());
  const w = s.split(' '); while(w.join(' ').length > 48 && w.length > 3) w.splice(w.length - 2, 1);   // te lang: middenwoorden eruit, maat/kleur aan het eind blijft
  return w.join(' ');
}
const alleenCode = (c, v) => vnN(v) === vnN(c) || vnN(v).replace(vnN(c), '').length < 3;
function vnRegel(c){ const k = korteOmschrijving(c); if(!k) return c; return String(c).length > 14 ? k : c + ' - ' + k; }
function vsVn(c){
  try{ const o = X().oudeWaarde(c, 'vn'); const fout = v => labelFout(c, { name:v }); if(o && o.conflict) o.conflict = o.conflict.filter(x => !fout(x.v)); if(o && !o.conflict && o.v && !alleenCode(c, o.v) && !fout(o.v)) return { v:o.v, why:'staat al op het palletlabel', r:'vn:label' };
    if(o && o.conflict){ const l = o.conflict.map(x => x.v).filter(v => v && !alleenCode(c, v)); if(l.length) return { v:l[0], why:'palletlabels verschillen: ' + l.join(' / '), alt:l, tw:l.length > 1, r:'vn:label' }; } }catch(e){}
  return { v:vnRegel(c), why:String(c).length > 14 ? 'code is lang (> 14 tekens): alleen de korte omschrijving' : 'productcode + korte omschrijving met de onderscheidende kenmerken', r:'vn:regel' };
}
function vsVerp(c){
  const r = X().pbRegels(c).find(r => r.soort !== 'pallet' && num(r.per) > 1);
  if(r) return { v:nf(num(r.per) * (num(r.factor) || 1)) + ' doos', why:'pakbon: ' + nf(num(r.per)) + ' per doos' };
  const sp = vastPd(c, 'spd'); if(sp && num(sp) > 0) return { v:nf(num(sp)) + ' doos', why:'stuks per doos in productdata: ' + sp };
  const g = vanGenoot(c, 'verp'); if(g) return g;
  return null;
}
function vsMix(c){
  const g = vanGenoot(c, 'mixgroep'); if(g) return g;
  const r = pdVs(c, 'mixgroep', () => true); return r ? { v:r.v, why:r.bron } : null;
}
function vsPickc(c, f){
  if(f.pick.length) return { v:'klopt', why:'Picqer: ' + f.pick.slice(0, 3).map(x => x.n + ' (' + nf(x.v) + ', ' + (x.tijd ? 'tijdelijk' : 'vast') + ')').join(', ') };
  return { mis:'geen picklocatie in Picqer: kies moet pick krijgen of geen pick' };
}
// bekende rolregels van Daan (ronde 2): kokos rollen 600 cm lang, 100 of 200 cm breed, 17 of 24 mm; 200 cm 17 mm 12 rollen per pallet,
// 24 mm 6; ringmat op rol heavy duty 6 rollen rechtop op 100x150
const isKokos = c => /^kokos\b/i.test(naamVan(c)) && !/deurmat/i.test(naamVan(c)) && rolKand(c);
const isRingHD = c => /ringmat/i.test(naamVan(c)) && /heavy\s*duty|\bHD\b/i.test(naamVan(c) + ' ' + c) && rolKand(c);
// rol op een koker van 10 cm: diameter = √(10² + 4 · lengte · dikte / π) (Daan 30-10)
const KOKER = 10;
function rolDiameter(c, I){
  const L = nOf(waarde(c, 'rl', I).v), d = nOf(waarde(c, 'rd', I).v); if(!(L > 0 && d > 0)) return null;
  return Math.ceil(Math.sqrt(KOKER * KOKER + 4 * (L * 100) * (d / 10) / Math.PI));
}
function rolKg(c, I){
  const e = eenheid(c).e, L = nOf(waarde(c, 'rl', I).v), g = gewicht(c), kv = vsKg(c), kg = g.st !== 'niet' ? g.kg : kv ? num(kv.v) : g.pq, bron = g.st !== 'niet' ? 'jouw gewicht' : kv ? kv.why : 'Picqer';
  if(e === 'rol' && kg > 0) return { v:Math.round(kg * 10) / 10, why:bron + ': ' + nf(kg, 1) + ' kg per rol' };
  if((e === 'm' || e === 'cm') && kg > 0 && L > 0) return { v:Math.round(kg * L * (e === 'cm' ? 100 : 1) * 10) / 10, why:nf(kg, 3) + ' kg per ' + e + ' (' + bron + ') × ' + nf(L) + ' m' };
  return null;
}
// rollen per pallet uit staand/liggend, diameter en palletmaat (7 cm overstek, tot 250 cm hoog incl. 15 cm pallet)
function rolPallet(c, I){
  const st = waarde(c, 'rstand', I).v, D = rolDiameter(c, I), B = nOf(waarde(c, 'rb', I).v); if(!st || !D || !(B > 0)) return null;
  const [PL, PB] = palDims(waarde(c, 'maat', I).v || '80x120').sort((a, b) => b - a), maat = PL + 'x' + PB;
  if(st === 'staand'){ if(B + PALH > MAXH) return null; const n = Math.floor((PL + 7) / D) * Math.floor((PB + 7) / D); return n > 0 ? { n, why:'staand op ' + maat + ': ' + Math.floor((PL + 7) / D) + ' × ' + Math.floor((PB + 7) / D) + ' rollen van ⌀ ' + D + ' cm' } : null; }
  if(B > PL + 14) return null;   // liggend: de rol ligt in de lengte van de pallet
  const laag = Math.floor((PB + 7) / D), lagen = Math.floor((MAXH - PALH) / D), n = laag * lagen;
  return n > 0 ? { n, why:'liggend op ' + maat + ': ' + laag + ' per laag × ' + lagen + ' lagen (⌀ ' + D + ' cm, tot ' + MAXH + ' cm)' } : null;
}
// lengte volle rol zonder eigen bron: de lengte (ingevuld of uit de naam) die bij deze familie, anders bij deze leverancier het meest voorkomt (≥ 3 rollen, ≥ 60%)
let RLL = { dv:-1, m:null };
function rolLengteLev(c){
  if(RLL.dv !== S.ver || !RLL.m){ const m = {}; Object.keys(D.P).forEach(x => { if(!actief(x) || !rolKand(x) || isKokos(x)) return; const e = eigen(x, 'rl'), L = e && nOf(e.v) > 0 ? { v:nOf(e.v) } : lengteNaam(x); if(!L) return; [['fam', famVan(x)], ['lev', levVan(x)]].forEach(([n, k]) => { const t = (m[n + '|' + k] = m[n + '|' + k] || {}); t[L.v] = (t[L.v] || 0) + 1; }); }); RLL = { dv:S.ver, m }; }
  for(const [n, k, t] of [['fam', famVan(c), 'de familie'], ['lev', levVan(c), 'deze leverancier']]){
    const x = RLL.m[n + '|' + k]; if(!x) continue;
    const tot = Object.values(x).reduce((a, b) => a + b, 0), best = Object.entries(x).sort((a, b) => b[1] - a[1])[0];
    if(tot >= 3 && best[1] / tot >= 0.6) return { v:+best[0], why:'bij ' + t + ' zijn ' + best[1] + ' van ' + tot + ' rollen ' + nf(+best[0]) + ' m lang' };
  }
  return null;
}
function vsRol(c, k, I){
  const kok = isKokos(c), hd = isRingHD(c), br = breedteNaam(c), dk = dikteNaam(c) || (kok ? num((String(c).match(/-(17|24)$/) || [])[1]) : null);
  if(k === 'rb'){ if(kok && [100, 200].includes(br)) return { v:String(br), why:'kokos rol ' + br + ' cm breed (uit de naam)', r:'rol:kokos' }; return br ? { v:String(br), why:'uit de naam', r:'rol:naam' } : null; }
  if(k === 'rd'){ return dk ? { v:String(dk), why:(dikteNaam(c) ? 'uit de naam' : 'uit de code') + (kok ? ' (kokos 17 of 24 mm)' : ''), r:'rol:naam' } : null; }
  if(k === 'rl'){ if(kok) return { v:'6', why:'regel Daan: kokos rollen zijn 600 cm lang', r:'rol:kokos' }; const L = lengteNaam(c); if(L) return { v:String(L.v), why:L.why, r:'rol:naam' }; const g = rolLengteLev(c); return g ? { v:String(g.v), why:g.why, r:'rol:lev' } : null; }
  if(k === 'rstand' && hd) return { v:'staand', why:'regel Daan: ringmat op rol heavy duty staat rechtop', r:'rol:hd' };
  if(k === 'rmax'){
    if(kok && br === 200 && dk === 17) return { v:'12', why:'regel Daan: kokos 200 cm 17 mm, 12 rollen per pallet', r:'rol:kokos' };
    if(kok && br === 200 && dk === 24) return { v:'6', why:'regel Daan: kokos 200 cm 24 mm, 6 rollen per pallet', r:'rol:kokos' };
    if(hd) return { v:'6', why:'regel Daan: ringmat op rol heavy duty, 6 rollen rechtop op 100x150', r:'rol:hd' };
    const p = rolPallet(c, I); return p ? { v:String(p.n), why:p.why, r:'rol:pallet' } : null;
  }
  if(k === 'rvast' && ((kok && br === 200 && (dk === 17 || dk === 24)) || hd)) return { v:'ja', why:'vaste aantallen volgens de regel van Daan', r:'rol:regel' };
  return null;
}
// soort uit eigen data, met reden; tegenstrijdig = twijfel met beide opties
// weg-deel van het soortvoorstel (ook los te gebruiken voor alle producten: wegLicht)
function wegDeel(c, f, ink){
  const naam = naamVan(c), pp = D.P[c] || {}, bo = backorders(c), v6 = vk6(c), v28 = vk28(c) || 0;
  const stock = Math.max(som(f.pick) + som(f.bulk) + f.vst + f.geen, (num(pp.voorraad_hm) || 0) + (num(pp.voorraad_vst) || 0));
  const t = (v, why, extra) => Object.assign({ v, why }, extra || {});
  const ls = isSam(c) ? null : leerOf(c, 'opslag', [['fammaat', 1], ['fam', 2], ['levmaat', 2], ['lev', 4]]);
  const binnen = P().index().binnen.has(c);
  // nu geen voorraad, maar Daan koos in de familie al een soort: tijdelijk op, niet weg
  if(stock <= 0 && ls) return { ls, stock, r:ls.r, so:t(ls.v, ls.why + ' · nu geen voorraad' + (binnen ? ', komt binnen' : '')) };
  if(stock <= 0 && !binnen){
    if(!ink && !bo && !v6 && !v28) return { ls, stock, r:'soort:1', weg:t('archief', 'geen voorraad, geen verkoop, geen inkoop in 12 maanden, geen backorders'), so:t('weg', 'geen voorraad, geen verkoop, geen inkoop in 12 maanden, geen backorders') };
    const w = 'geen voorraad' + (ink ? ', wel inkoop (' + ink.n + '×, meestal ' + nf(ink.meestal) + ')' : ', geen inkoop in 12 maanden') + (bo ? ', ' + bo.n + ' backorder' + (bo.n > 1 ? 's' : '') : '') + (v6 ? ', verkoop ' + nf(v6) + ' per maand' : '');
    return { ls, stock, r:'soort:2', weg:t('backorder', w, { aan:'backord' }), so:t('weg', w, { aan:'backord' }) };
  }
  const geenInk = inkData() && !ink;
  if(geenInk && !binnen){ const w = 'nog ' + nf(stock) + ' op voorraad, geen inkoop in 12 maanden' + (/uitlopend/i.test(naam) ? ', "uitlopend" in de naam' : '') + (v6 || v28 ? ' (verkoopt nog ' + nf(Math.max(v6, v28)) + ' per maand)' : ''); return { ls, stock, r:'soort:3', weg:t('uitlopend', w, { aan:'uitl' }), so:t('weg', w, { aan:'uitl' }) }; }
  return { ls, stock };
}
// Weg-voorstel voor elk product (ook buiten de scope): { v:'archief'|'backorder'|'uitlopend', why } of null
function wegLicht(c){ if(!actief(c) || isKoppel(c)) return null; const w = wegDeel(c, locInfo(c), inkoop(c)); return w.weg || null; }
function vsSoort(c, f, ink){
  const naam = naamVan(c), t = (v, why, extra) => Object.assign({ v, why }, extra || {});
  const wd = wegDeel(c, f, ink); if(wd.so) return wd;
  const ls = wd.ls, stock = wd.stock;
  const bulkN = som(f.bulk), pickN = som(f.pick), cap = capPick(c);
  let ms = null; try{ ms = X().mvSoort(c); }catch(e){}
  const sppV = (() => { const e = eigen(c, 'spp'); if(e) return nOf(e.v); const v = vastPd(c, 'spp'); if(v) return nOf(v); let b = {}; try{ b = X().sppBronnen(c) || {}; }catch(e){} const x = b.mvvst || b.vst2 || b.bulk2 || (ms && ms.soort === 'pallet' ? { v:ms.v } : null); return x ? num(x.v) : null; })();
  const inkT = ink ? 'inkoop meestal ' + nf(ink.meestal) + ' per order' : 'geen inkoop in 12 maanden';
  // mix: alle bulkplekken hebben ook voorraad van andere producten
  const bulkMet = f.bulk.filter(x => x.v > 0), gedeeld = bulkMet.filter(x => anderOpPlek(c, x.n).length), eigenB = bulkMet.filter(x => !anderOpPlek(c, x.n).length);
  const plekT = gedeeld.length ? gedeeld.slice(0, 2).map(x => x.n + ' met ' + anderOpPlek(c, x.n).length + ' ander' + (anderOpPlek(c, x.n).length > 1 ? 'e' : '') + ' product' + (anderOpPlek(c, x.n).length > 1 ? 'en' : '')).join(', ') : '';
  // pallet: inkoop ≥ 85% van een volle pallet én per volle pallet verplaatst
  const vol = ink && sppV ? ink.meestal >= 0.85 * sppV : false, perPallet = !!(ms && ms.soort === 'pallet');
  if(!(vol && perPallet) && ls) return { r:ls.r, so:t(ls.v, ls.why) };
  if(vol && perPallet) return { r:'soort:4', so:t('pallet', inkT + ' (≥ 85% van ' + nf(sppV) + ' per pallet) en ' + ms.t, { aan:'pallet85' }) };
  // per volle pallet verplaatst, maar de inkoop is minder dan een pallet (of onbekend): twijfel
  if(perPallet) return { r:'soort:5', so:t('pallet', ms.t + ', maar inkoop ' + (ink && sppV ? 'meestal ' + nf(ink.meestal) + ' (< 85% van ' + nf(sppV) + ' per pallet)' : 'per pallet onbekend'), { tw:true, alt:['pallet', 'deel'], aan:'pallet85' }) };
  const volT = vol ? ' · inkoop ≈ volle pallet (≥ 85% van ' + nf(sppV) + '), maar niet per volle pallet verplaatst' : '';
  // mix: kleine aantallen (geen pallet-aantal bekend, geen volle pallet ingekocht) en de bulk staat bij andere producten
  if(!vol && bulkMet.length && gedeeld.length){
    if(gedeeld.length === bulkMet.length && !sppV) return { r:'soort:6', so:t('mix', 'bulk staat op een gedeelde plek: ' + plekT + ' · ' + inkT + ', geen pallet-aantal bekend', { aan:'mix' }) };
    return { r:'soort:7', so:t('deel', 'bulk ' + nf(bulkN) + (eigenB.length ? ' op eigen én gedeelde plekken (' : ' op een gedeelde plek (') + plekT + ')' + (sppV ? ', wel ' + nf(sppV) + ' per pallet bekend' : '') + ' · ' + inkT, { tw:true, alt:['deel', 'mix'], aan:'mix' }) };
  }
  if(bulkN > 0) return { r:vol ? 'soort:8v' : 'soort:8', so:t('deel', 'bulk ' + nf(bulkN) + ' (' + bulkMet.slice(0, 2).map(x => x.n).join(', ') + '), pick ' + nf(pickN) + ' · ' + inkT + (ms && ms.soort === 'deel' ? ' · ' + ms.t : '') + volT, vol ? { alt:['deel', 'pallet'] } : null) };
  if(ink && cap !== null && ink.meestal > cap && ms && ms.soort === 'deel') return { r:'soort:9', so:t('deel', inkT + ', meer dan op pick past (vul aan tot ' + nf(cap) + ') · ' + ms.t) };
  if(ink && cap !== null && ink.meestal > cap) return { r:'soort:10', so:t('pick', inkT + ', meer dan op pick past (vul aan tot ' + nf(cap) + '), maar geen bulk', { tw:true, alt:['pick', 'deel'] }) };
  if(ink) return { r:'soort:11', so:t('pick', 'geen bulk, ' + inkT + (cap !== null ? ', past op pick (vul aan tot ' + nf(cap) + ')' : '')) };
  return { r:'soort:12', so:t('pick', 'geen bulk, voorraad ' + nf(stock) + ', ' + inkT) };
}

/* ---------- alles over één product (gecachet per familie-versie) ---------- */
function info(c){
  const fk = famVan(c), fv = S.famVer[fk] || 0, hit = S.cache.get(c);
  if(hit && hit.fv === fv && hit.ver0 === S.dataVer && Date.now() - hit.op < 5 * 60e3) return hit.I;   // na 5 min opnieuw: live voorraad kan veranderd zijn
  const I = bereken(c);
  S.cache.set(c, { fv, ver0:S.dataVer, I, op:Date.now() });
  return I;
}
S.dataVer = 0;
function dataVers(){ S.dataVer++; S.cache.clear(); S.sel = null; S.idx = null; }
function bereken(c){
  const p = D.P[c] || {}, kop = koppelVan(c), sam = isSam(c), f = locInfo(c), ink = inkoop(c);
  const I = { c, kop:kop || (virt(c) ? 'samengesteld' : null), sam, f, ink, fk:famVan(c), mk:maatVan(c), vs:{}, vsSo:null, vsWeg:null, aan:new Set() };
  if(I.kop) return I;
  const s = vsSoort(c, f, ink);
  I.vsSo = s.so ? Object.assign({ r:s.r }, s.so) : null; I.vsWeg = s.weg || null;
  if(I.vsSo && I.vsSo.aan) I.aan.add(I.vsSo.aan);
  if(sam && I.vsSo && I.vsSo.v === 'mix') I.vsSo = { v:som(f.bulk) > 0 ? 'deel' : 'pick', why:'SAM Europe: ' + I.vsSo.why };
  const so = soortWaarde(c, I).v;
  I.vs.pickc = vsPickc(c, f);
  I.vs.lvl = vsLvl(c); if(I.vs.lvl && I.vs.lvl.aan) I.aan.add(I.vs.lvl.aan);
  I.vs.maxpick = vsMax(c, so, ink);
  I.vs.binnen = vsBinnen(c, ink);
  I.vs.spp = vsSpp(c, I);
  I.vs.maat = vsMaat(c);
  I.vs.vn = sam ? null : vsVn(c); if(I.vs.vn && I.vs.vn.aan) I.aan.add(I.vs.vn.aan);
  I.vs.verp = sam ? null : vsVerp(c);
  I.vs.mixgroep = sam ? null : vsMix(c);
  const sppE = effN(c, 'spp', I), maatE = waarde(c, 'maat', I).v;
  I.vs.hoogte = vsHoogte(c, sppE, maatE);
  ROLVS.forEach(k => { I.vs[k] = vsRol(c, k, I); });
  return I;
}

/* ---------- liggertype per gang+sectie+niveau (aantal posities A–D op die ligger in wh-locaties) ---------- */
const LIG = { dv:-1, m:null }, LIGRE = /^([A-Z]{2}\d{2})([A-F])(\d{2})$/;
function liggerIndex(){
  if(LIG.dv === S.dataVer && LIG.m) return LIG.m;
  const m = {}; Object.keys(D.LOC || {}).forEach(n => { const x = String(n).toUpperCase().match(LIGRE); if(x) (m[x[1] + '|' + x[3]] = m[x[1] + '|' + x[3]] || new Set()).add(x[2]); });
  LIG.dv = S.dataVer; LIG.m = m; return m;
}
function liggerVan(loc){ const x = String(loc || '').toUpperCase().match(LIGRE); if(!x) return null; const s = liggerIndex()[x[1] + '|' + x[3]]; return s && s.size >= 2 ? s.size : null; }
/* ---------- controle na invoer: zeggen VST-pallets, verplaatsingen of palletlabels iets anders dan wat Daan invulde? Nooit wijzigen. ---------- */
function naControle(c, k, I){
  I = I || info(c);
  const w = waarde(c, k, I); if(!['bevestigd', 'aangepast', 'vastgelegd'].includes(w.st)) return '';
  const v = nOf(w.v); if(!(v > 0)) return '';
  const uit = [];
  if(k === 'spp'){
    let b = {}; try{ b = X().sppBronnen(c) || {}; }catch(e){}
    if(b.vst2 && num(b.vst2.v) !== v) uit.push(b.vst2.t);
    if(b.mvvst && num(b.mvvst.v) !== v) uit.push(b.mvvst.t);
    if(b.mvpick && num(b.mvpick.v) !== v) uit.push('naar pick: ' + b.mvpick.t);
    const lab = labelSppLijst(c); if(lab.length && !lab.includes(v)) uit.push('palletlabel: ' + lab.map(x => nf(x)).join(' / ') + ' per pallet');
  }
  if(k === 'maxpick' && soortWaarde(c, I).v === 'deel'){ const g = grootstePick(c); if(g && g !== v) uit.push('verplaatsingen naar pick: grootste aanvulling ' + nf(g)); }
  return uit.join(' · ');
}

/* ---------- berekende velden ---------- */
function calc(c, k, I){
  I = I || info(c);
  const w = x => waarde(c, x, I), uitVs = (...ks) => ks.some(x => ['voorstel', 'twijfel'].includes(w(x).st));
  const g = gewicht(c);
  switch(k){
    case 'maxcalc': { const a = nOf(w('lvl').v), b = nOf(w('spp').v); if(a === null || b === null) return { v:'', why:'eerst aanvullen bij en stuks per pallet' }; const vk = vkMaand(c), m = a + b; return { v:String(m), why:'aanvullen bij ' + nf(a) + ' + stuks per pallet ' + nf(b), vs:uitVs('lvl', 'spp'), oranje:!vk || m > 3 * vk, warn:!vk ? 'controleer: geen verkoop gemeten' : m > 3 * vk ? 'controleer: meer dan 3 maanden verkoop (' + nf(vk) + ' per maand)' : '' }; }
    case 'aanvmet': {
      const a = nOf(w('maxpick').v), b = nOf(w('lvl').v); if(a === null || b === null) return { v:'', why:'eerst max op pick en aanvullen bij' };
      const v = a - b, vp = String(w('verp').v || ''), n = num((vp.match(/^\s*(\d+(?:[.,]\d+)?)/) || [])[1]);
      const warn = v < 0 ? 'max op pick is kleiner dan aanvullen bij' : n > 1 && v % n ? nf(v) + ' is geen veelvoud van de inkoopverpakking (' + vp.trim() + ')' : '';
      return { v:String(v), why:'max ' + nf(a) + ' − bij ' + nf(b), warn, vs:uitVs('maxpick', 'lvl') };
    }
    case 'gewpal': { const s = nOf(w('spp').v); if(s === null) return { v:'', why:'eerst stuks per pallet' }; if(!(g.kg > 0)) return { v:'', why:'gewicht per stuk onbekend' }; const v = Math.ceil(s * g.kg + 15); return { v:String(v), why:nf(s) + ' × ' + nf(g.kg, 3) + ' kg + 15 kg pallet', vs:uitVs('spp') || g.st === 'niet', uitzoeken:v > 1500, oranje:v > 1000 && v <= 1500, warn:v > 1500 ? 'boven 1.500 kg: klopt stuks per pallet of het gewicht? uitzoeken' : v > 1000 ? 'controleer: boven 1.000 kg' : '' }; }
    case 'plaatsen': { const m = w('maat').v; const v = m ? X().plaatsenUitMaat(m) : null; return v ? { v:String(v), why:'uit palletmaat ' + m + ' (plaats = 90 cm)', vs:uitVs('maat') } : { v:'', why:'eerst palletmaat' }; }
    case 'maxlig': {
      // liggertype uit de bulklocatie (letters per gang+sectie+niveau in wh-locaties: A–B = 2, A–C = 3, A–D = 4) en de 2.000 kg-grens
      const pl = num(calc(c, 'plaatsen', I).v), gw = num(calc(c, 'gewpal', I).v); if(!pl) return { v:'', why:'eerst palletmaat' };
      const per = n => Math.max(1, Math.floor(n / pl)), kg = gw ? Math.max(1, Math.floor(2000 / gw)) : null, met = n => kg !== null ? Math.min(per(n), kg) : per(n);
      const bulk = (I.f.bulk || []).map(x => [x.n, liggerVan(x.n)]).filter(x => x[1]), typen = [...new Set(bulk.map(x => x[1]))].sort();
      const kgT = kg !== null ? ' · 2.000 kg / ' + nf(gw) + ' kg = ' + kg : '';
      if(typen.length === 1){ const n = typen[0]; return { v:String(met(n)), why:n + '-ligger (' + bulk.filter(x => x[1] === n).map(x => x[0]).slice(0, 2).join(', ') + '): ' + n + ' / ' + nf(pl, 1) + ' plaatsen = ' + per(n) + kgT, vs:uitVs('maat', 'spp') }; }
      const l = typen.length ? typen : [3, 4];
      return { v:l.map(n => n + '-ligger ' + met(n)).join(' · '), why:(typen.length ? 'bulk op verschillende liggers: ' + bulk.map(x => x[0] + ' (' + x[1] + ')').join(', ') : 'geen bulklocatie: per liggertype') + kgT, vs:uitVs('maat', 'spp') };
    }
    case 'rdia': { const D = rolDiameter(c, I); return D ? { v:String(D), why:'koker ' + KOKER + ' cm + ' + nf(nOf(w('rl').v)) + ' m × ' + nf(nOf(w('rd').v)) + ' mm opgerold: √(' + KOKER + '² + 4 · lengte · dikte / π)', vs:uitVs('rl', 'rd') } : { v:'', why:'eerst lengte en dikte' }; }
    case 'rkg': { const x = rolKg(c, I); return x ? { v:String(x.v), why:x.why, vs:uitVs('rl') } : { v:'', why:'eerst gewicht en lengte volle rol' }; }
    case 'kgm': case 'kgcm': { const kg = num(calc(c, 'rkg', I).v), L = nOf(w('rl').v); if(!(kg > 0 && L > 0)) return { v:'', why:'eerst gewicht en lengte volle rol' }; const v = kg / L / (k === 'kgcm' ? 100 : 1); return { v:nf(v, k === 'kgcm' ? 4 : 3), why:nf(kg) + ' kg / ' + nf(L) + ' m' + (k === 'kgcm' ? ' / 100' : ''), vs:uitVs('rkg', 'rl') }; }
  }
  return { v:'' };
}
// hoogte past niet op de bulklocaties (aanname hoogte)
function hoogteWaarsch(c, h, I){
  h = num(h); if(!(h > 0)) return '';
  const f = (I || info(c)).f, uit = [];
  f.bulk.forEach(x => {
    const m = String(x.n).match(/^([A-Z])[A-Z]\d{2}[A-D](\d{2})$/i); if(!m) return;
    const hal = m[1].toUpperCase(), niv = m[2];
    const max = niv === '20' && hal === 'A' ? 140 : niv === '00' ? 200 : niv === '10' ? 190 : null;
    if(max && h > max) uit.push(x.n + ' (' + (niv === '20' ? '20-locatie hal A ± 140' : niv === '00' ? 'tussen 00 en 10 meestal 180–200' : 'tussen 10 en 20 meestal 180–190') + ' cm)');
  });
  return uit.length ? 'past mogelijk niet op ' + uit.slice(0, 2).join(', ') : '';
}

/* ---------- open en afgerond ---------- */
function nodigVan(c, so, I){
  if(isKoppel(c)) return [];
  if(so === 'weg') return [];
  let n = isSam(c) ? NODIG.sam.slice() : (NODIG[so] || []).slice();
  if(waarde(c, 'pickc', I).v === 'geenpick') n = n.filter(k => k !== 'lvl' && k !== 'maxpick');
  if(isRol(c) && !isSam(c) && (so === 'pallet' || so === 'deel')) n = ROLNODIG.slice();
  return n;
}
function status(c){
  const I = info(c);
  if(I.kop) return { kop:I.kop, af:false, open:[], so:'', tab:'' };
  const so = soortWaarde(c, I), soOk = ['bevestigd', 'aangepast', 'vastgelegd'].includes(so.st);
  const open = [];
  if(!soOk) open.push('soort');
  if(so.v === 'weg'){ const w = wegWaarde(c, I); if(!['bevestigd', 'aangepast', 'vastgelegd'].includes(w.st)) open.push('weg'); }
  nodigVan(c, so.v, I).forEach(k => { if(!ingevuld(waarde(c, k, I))) open.push(k); });
  const g = gewicht(c);
  if(so.v !== 'weg' && rolVoorstel(c)) open.push('rol');
  if(so.v !== 'weg' && !isSam(c) && !gewKlaar(g)) open.push('gewicht');
  const af = !!so.v && !open.length && !(po(c) && po(c).heropend);
  // drie stappen: 1 Soort · 2 Gewicht · 3 Hoeveelheid; afgerond = alle drie klaar
  const stap = { soort:soOk && !open.includes('weg'), gewicht:!open.includes('gewicht'), hoev:!open.some(k => !['soort', 'weg', 'gewicht'].includes(k)) };
  return { so:so.v, soSt:so.st, open, af, stap, gew:g, tab:af ? 'afgerond' : so.v || 'pick' };
}

/* ---------- live voorraad per locatie: wachtrij voor wat op het scherm staat (alleen lezen, met rem) ----------
   20 producten per vraag, 3 s ertussen. Warehouse, Vandaag en Aanvullen gaan voor: is de live-ronde van 3.0 bezig, of zei
   Picqer net "te veel", dan wacht 2.0. Bij een fout (429, 504, …) stopt de rij en probeert hij het na 2, 4, 8 … max 30 minuten. */
const LQ = { q:[], bezig:false, wachtTot:0, foutN:0, fout:null, klaar:null, gedaan:0, ids:null, idsP:null, t:null };
try{ const o = JSON.parse(localStorage.getItem('pd2-live') || '{}'); Object.entries(o).forEach(([c, x]) => { if(x && x.t && Date.now() - x.t < LIVE_GELDIG) S.live.prod[c] = x; }); }catch(e){}
function bewaarLive(){ try{ const o = {}; Object.entries(S.live.prod).filter(([, x]) => Date.now() - x.t < LIVE_GELDIG).sort((a, b) => b[1].t - a[1].t).slice(0, 800).forEach(([c, x]) => { o[c] = x; }); localStorage.setItem('pd2-live', JSON.stringify(o)); }catch(e){} }
const gekoppeld = () => !!(window.WHLIVE && WHLIVE.status().code);
function idLive(c){ const a = idVan(c); if(a) return a; const m = LQ.ids && LQ.ids[String(c).toLowerCase()]; return m ? +m : 0; }
function laadIds(){
  if(LQ.ids) return Promise.resolve();
  if(!LQ.idsP) LQ.idsP = WH.catHaal('wh-hist-index').then(r => { const p = (r && r.data && r.data.p) || {}, m = {}; Object.keys(p).forEach(id => { m[String(p[id]).toLowerCase()] = +id; }); LQ.ids = m; }).catch(() => { LQ.ids = {}; });
  return LQ.idsP;
}
// codes die op het scherm staan: vooraan in de rij (wat niet vers is)
function vraagLive(codes, klaar){
  if(klaar) LQ.klaar = klaar;
  if(!gekoppeld()) return;
  const nodig = [...new Set(codes.map(c => koppelVan(c) || c))].filter(c => { if(isKoppel(c)) return false; const lv = liveVan(c); return !lv || Date.now() - lv.t > LIVE_VERS; });
  const set = new Set(nodig);
  LQ.q = nodig.concat(LQ.q.filter(c => !set.has(c))).slice(0, 400);
  pomp();
}
async function pomp(){
  if(LQ.bezig || !LQ.q.length || !gekoppeld()) return;
  if(Date.now() < LQ.wachtTot){ clearTimeout(LQ.t); LQ.t = setTimeout(pomp, LQ.wachtTot - Date.now() + 500); return; }
  LQ.bezig = true; meld();
  try{
    if(!LQ.ids && LQ.q.some(c => !idVan(c))) await laadIds();
    while(LQ.q.length){
      // voorrang: de live-ronde van 3.0 (Vandaag, Aanvullen, Warehouse) en een recente "te veel" van Picqer
      let n = 0; while((window.IVL && IVL.S && IVL.S.bezig) && n++ < 60) await wacht(2000);
      if(window.PDVERS && PDVERS.S && PDVERS.S.limietGezien && Date.now() - PDVERS.S.limietGezien < 10 * 60e3){ LQ.wachtTot = PDVERS.S.limietGezien + 10 * 60e3; break; }
      const deel = [], perId = {};
      while(LQ.q.length && deel.length < 20){ const c = LQ.q.shift(), id = idLive(c); if(id && !perId[id]){ deel.push(c); perId[id] = c; } }
      if(!deel.length) break;
      const r = await WHLIVE.vraag('producten', { ids:Object.keys(perId).join(',') });
      const t = Date.now();
      (r.producten || []).forEach(q => { const c = perId[q.id]; if(c) S.live.prod[c] = { t, f:liveFeit(c, q, +r.magazijn || 3857, r.vst || 3991) }; });
      LQ.gedaan += deel.length; LQ.foutN = 0; LQ.fout = null;
      deel.forEach(ongeldig); bewaarLive();
      if(LQ.klaar) try{ LQ.klaar(deel); }catch(e){ console.error(e); }
      if(LQ.q.length) await wacht(3000);
    }
  }catch(e){
    LQ.fout = e; LQ.foutN++;
    LQ.wachtTot = Date.now() + Math.min(30 * 60e3, 2 * 60e3 * Math.pow(2, LQ.foutN - 1));
    console.error(e);
  }
  LQ.bezig = false; meld();
  if(LQ.q.length){ clearTimeout(LQ.t); LQ.t = setTimeout(pomp, Math.max(1000, LQ.wachtTot - Date.now() + 500)); }
}
function liveFeit(c, q, mag, vstId){
  const f = { pick:[], bulk:[], vst:0, geen:0, kar:0, bron:'live', t:new Date().toISOString() };
  (q.loc || []).forEach(l => {
    if(l.w !== null && l.w !== undefined && +l.w !== mag) return;
    if(l.t === 'container' || /^container\s*\d+$/i.test(String(l.n || '').trim())){ f.kar += l.v || 0; return; }
    (l.b ? f.bulk : f.pick).push({ n:l.n, v:l.v || 0, tijd:isTijd(l.n) });
  });
  const w = id => ((q.vw || []).find(x => +x[0] === +id) || [0, null])[1];
  const hm = w(mag); f.vst = w(vstId) || 0;
  f.geen = hm === null ? 0 : Math.max(0, hm - som(f.pick) - som(f.bulk) - f.kar);
  return f;
}
const liveStatus = () => ({ gekoppeld:gekoppeld(), bezig:LQ.bezig, rij:LQ.q.length, fout:LQ.fout, wachtTot:LQ.wachtTot > Date.now() ? LQ.wachtTot : 0, gedaan:LQ.gedaan, exportDatum:D.VRDATUM });

/* ---------- meting: hoe goed zijn de voorstellen (toets tegen Daans eigen invoer in productdata) ----------
   Per veld en per waarde die Daan zelf vastlegde: doen alsof die waarde er niet is, het pd2-voorstel uitrekenen en vergelijken.
   Exact gelijk telt als goed; hoogte binnen 10 cm, gewicht binnen 10%. Alleen percentages komen in beeld, nooit productdata. */
const TOETSBRON = new Set(['daan', 'invul', 'samen', 'overgezet', 'familie', 'kleuren', 'klein', 'spraak']);
const TOETSVELD = { opslag:'Soort', spp:'Stuks per pallet', maat:'Palletmaat', hoogte:'Hoogte incl. pallet', lvl:'Aanvullen bij', maxpick:'Max op pick', vn:'Vloernaam', kgst:'Gewicht per stuk', gewicht:'Gewicht volle pallet' };
const maatNorm = v => { const m = String(v || '').match(/(\d+)\D+(\d+)/); return m ? [+m[1], +m[2]].sort((a, b) => a - b).join('x') : String(v || '').trim().toLowerCase(); };
function toetsGelijk(k, a, b){
  if(leeg(a) || leeg(b)) return false;
  if(k === 'maat') return maatNorm(a) === maatNorm(b);
  if(k === 'vn' || k === 'opslag') return String(a).trim().toLowerCase().replace(/\s+/g, ' ') === String(b).trim().toLowerCase().replace(/\s+/g, ' ');
  const x = num(a), y = num(b); if(x === null || y === null) return false;
  if(k === 'hoogte') return Math.abs(x - y) <= 10;
  if(k === 'kgst' || k === 'gewicht') return y ? Math.abs(x - y) / Math.abs(y) <= 0.10 : x === y;
  return Math.abs(x - y) < 1e-9;
}
function toetsItems(){
  const uit = [];
  Object.entries(P().S.pd).forEach(([c, r]) => {
    if(!actief(c) || isKoppel(c) || !r || !r.data) return;
    Object.keys(TOETSVELD).forEach(k => {
      const v = r.data[k], m = (r.meta || {})[k] || {};
      if(leeg(v) || isOnb(v) || isNvt(v) || m.tw || !TOETSBRON.has(m.bron || '')) return;
      if(k === 'opslag' && !SOORTT[soortNormKort(v)]) return;
      uit.push({ c, k, v:k === 'opslag' ? soortNormKort(v) : String(v).trim() });
    });
  });
  return uit;
}
const soortNormKort = v => { const l = String(v || '').trim().toLowerCase(); return /^(1|pal)/.test(l) ? 'pallet' : /^(2|de)/.test(l) ? 'deel' : /^(3|mi|do)/.test(l) ? 'mix' : /^(4|pi|al)/.test(l) ? 'pick' : l; };
// voorstel voor één veld, met het veld zelf verborgen (zowel in pd2 als in productdata.js)
function toetsVoorstel(c, k){
  const f = locInfo(c), ink = inkoop(c);
  switch(k){
    case 'opslag': { const s = vsSoort(c, f, ink); return s.so ? { v:s.so.v, r:s.r, tw:s.so.tw } : null; }
    case 'spp': return vsSpp(c, f, ink);
    case 'maat': return vsMaat(c);
    case 'hoogte': { const spp = nOf(vastPd(c, 'spp')) || nOf((vsSpp(c, f, ink) || {}).v), m = vastPd(c, 'maat') || (vsMaat(c) || {}).v; return vsHoogte(c, spp, m); }
    case 'lvl': return vsLvl(c);
    case 'maxpick': { const so = soortNormKort(vastPd(c, 'opslag') || '') || ((vsSoort(c, f, ink).so) || {}).v; return vsMax(c, so, ink); }
    case 'vn': return vsVn(c);
    case 'kgst': return vsKg(c);
    case 'gewicht': { const spp = nOf(vastPd(c, 'spp')) || nOf((vsSpp(c, f, ink) || {}).v), kg = num(vastPd(c, 'kgst')) || kgPq(c); return spp > 0 && kg > 0 ? { v:String(Math.ceil(spp * kg + 15)), r:'gewpal:som' } : null; }
  }
  return null;
}
async function meet(voortgang){
  const items = toetsItems(), velden = {}, regels = {}, oudO = S.o, fouten = {};
  S.o = leegO();
  try{
    for(let i = 0; i < items.length; i++){
      const { c, k, v } = items[i];
      S.verberg = { c, k }; P().S.toets = { code:c, k };
      let vs = null; try{ vs = toetsVoorstel(c, k); }catch(e){}
      if(vs && k === 'hoogte' && !leeg(vs.v) && (num(vs.v) < 30 || num(vs.v) > MAXH)) vs = null;   // controle: wordt "uitzoeken", geen voorstel
      S.verberg = null; P().S.toets = null;
      const heeft = !!(vs && !leeg(vs.v)), goed = heeft && toetsGelijk(k, vs.v, v);
      const F = velden[k] = velden[k] || { tot:0, met:0, goed:0 }; F.tot++; if(heeft) F.met++; if(goed) F.goed++;
      if(heeft){ const id = vs.r || k + ':?'; const G = regels[id] = regels[id] || { tot:0, goed:0, k }; G.tot++; if(goed) G.goed++; if(!goed && (fouten[id] = fouten[id] || []).length < 8) fouten[id].push([c, vs.v, v]); }
      if(voortgang && i % 250 === 0){ voortgang(i, items.length); await wacht(0); }
    }
  }finally{ S.o = oudO; S.verberg = null; P().S.toets = null; S.cache.clear(); }
  const uit = { op:new Date().toISOString(), n:items.length, velden, regels };
  Object.defineProperty(uit, 'fouten', { value:fouten, enumerable:false });   // alleen voor de ontwikkelaar, niet bewaard of getoond
  return uit;
}
// gemeten scores per regel: eerst een eigen meting op dit apparaat (Meet opnieuw), anders de ingebouwde meting
const MEETKEY = 'pd2-meting';
let METING = null;
function meting(){ if(METING) return METING; try{ const m = JSON.parse(localStorage.getItem(MEETKEY) || 'null'); if(m && m.regels) return (METING = m); }catch(e){} return (METING = SCORE0); }
function zetMeting(m){ METING = { op:m.op, n:m.n, velden:m.velden, regels:m.regels }; try{ localStorage.setItem(MEETKEY, JSON.stringify(METING)); }catch(e){} S.cache.clear(); }
// score van een regel: { p, n } of null als er te weinig getoetst is
// vn:regel is Daans nieuwe vorm (code - omschrijving): zijn oude vloernamen zijn anders, dus die score zegt niets en maakt geen twijfel
function scoreVan(r){ const g = r && r !== 'vn:regel' && meting().regels[r]; return g && g.tot >= 5 ? { p:g.goed / g.tot, n:g.tot } : null; }
// ingebouwde meting (27-10-2026, ronde 2), alleen aantallen per veld en per regel; VOOR = de regels van ronde 1
const SCORE0 = {"op":"2026-10-27","n":2742,"velden":{"opslag":{"tot":465,"met":465,"goed":334},"spp":{"tot":745,"met":584,"goed":483},"maat":{"tot":173,"met":173,"goed":148},"hoogte":{"tot":143,"met":139,"goed":89},"lvl":{"tot":121,"met":86,"goed":71},"maxpick":{"tot":97,"met":82,"goed":61},"vn":{"tot":796,"met":796,"goed":8},"gewicht":{"tot":127,"met":124,"goed":102},"kgst":{"tot":75,"met":75,"goed":56}},"regels":{"soort:8v":{"tot":21,"goed":10},"spp:genoot":{"tot":238,"goed":199},"maat:genoot":{"tot":36,"goed":33},"hoogte:genoot":{"tot":21,"goed":21},"max:picqer":{"tot":35,"goed":28},"vn:regel":{"tot":796,"goed":8},"gewpal:som":{"tot":124,"goed":102},"soort:12":{"tot":5,"goed":3},"soort:2":{"tot":3,"goed":0},"spp:pallets":{"tot":205,"goed":169},"opslag:leer-levmaat":{"tot":19,"goed":15},"soort:8":{"tot":25,"goed":16},"soort:4":{"tot":43,"goed":40},"spp:verplaatst":{"tot":63,"goed":55},"opslag:leer-fam":{"tot":116,"goed":99},"maat:regel":{"tot":38,"goed":31},"hoogte:regel":{"tot":21,"goed":9},"soort:7":{"tot":9,"goed":3},"opslag:leer-fammaat":{"tot":58,"goed":56},"soort:11":{"tot":49,"goed":19},"maat:leer-fam":{"tot":9,"goed":7},"hoogte:regel-rest":{"tot":37,"goed":10},"lvl:genoot":{"tot":34,"goed":30},"kg:picqer":{"tot":48,"goed":31},"soort:10":{"tot":14,"goed":1},"spp:leer-levmaat":{"tot":62,"goed":49},"maat:leer-levmaat":{"tot":38,"goed":38},"hoogte:leer-levmaat":{"tot":34,"goed":33},"kgst:leer-levmaat":{"tot":14,"goed":14},"opslag:leer-lev":{"tot":78,"goed":56},"maat:regel-rest":{"tot":43,"goed":33},"lvl:picqer":{"tot":19,"goed":17},"max:genoot":{"tot":36,"goed":26},"maat:regel-naam":{"tot":9,"goed":6},"hoogte:lagen":{"tot":6,"goed":2},"lvl:leer-fammaat":{"tot":2,"goed":2},"maxpick:leer-fammaat":{"tot":2,"goed":0},"soort:6":{"tot":24,"goed":16},"spp:pakbon":{"tot":16,"goed":11},"hoogte:pakbon":{"tot":13,"goed":8},"lvl:leer-lev":{"tot":4,"goed":1},"lvl:regel":{"tot":20,"goed":14},"max:regel":{"tot":8,"goed":6},"soort:3":{"tot":1,"goed":0},"kgst:leer-fammaat":{"tot":13,"goed":11},"hoogte:leer-fam":{"tot":6,"goed":6},"hoogte:regel-naam":{"tot":1,"goed":0},"lvl:wandrek":{"tot":6,"goed":6},"lvl:leer-fam":{"tot":1,"goed":1},"max:inkoop":{"tot":1,"goed":1}}};
// ronde 2 (vóór de correctie) staat in docs; SCORE_VOOR = ronde 1
const SCORE_VOOR = {"op":"2026-10-27","n":2742,"velden":{"opslag":{"tot":465,"met":465,"goed":185},"spp":{"tot":745,"met":598,"goed":373},"maat":{"tot":173,"met":110,"goed":91},"hoogte":{"tot":143,"met":101,"goed":71},"lvl":{"tot":121,"met":44,"goed":36},"maxpick":{"tot":97,"met":56,"goed":37},"vn":{"tot":796,"met":796,"goed":172},"gewicht":{"tot":127,"met":124,"goed":74},"kgst":{"tot":75,"met":75,"goed":33}}};

/* ---------- overzetten naar de echte productdata (ronde 2: gebouwd, maar UIT) ----------
   Zet alles wat Daan in wh-pd2-oefen bevestigde of aanpaste over naar productdata, met meta-bron 'pd2'. Eigen invoer van Daan
   (bron daan, invul, samen, familie …) wordt nooit stil overschreven: verschil tonen en laten kiezen. Vooraf een kopie van de
   geraakte rijen (catalog-rij wh-pd2-kopie-<tijd>), terugdraaien kan met die kopie. Vlag pd2Overzetten staat op false:
   de knop is verborgen en overzetEcht() weigert. Getest alleen tegen een kopie van de data (overzetToepassen is zuiver). */
const pd2Overzetten = true;   // week 1 (28-10): aan; daarna schrijft 2.0 direct naar productdata (bron pd2)
const OVERZETVELD = { lvl:'lvl', maxpick:'maxpick', spp:'spp', maat:'maat', hoogte:'hoogte', vn:'vn', mixgroep:'mixgroep' };
// zonder oefenantwoorden
function echtDeel(p){ const q = JSON.parse(JSON.stringify(p)); Object.keys(q.f || {}).forEach(k => { if(q.f[k] && q.f[k].oef) delete q.f[k]; }); ['so', 'weg', 'gew', 'rol'].forEach(k => { if(q[k] && q[k].oef) delete q[k]; }); return q; }
function overzetPlan(rows){
  const plan = [], ok = x => x && ['bevestigd', 'aangepast'].includes(x.st) && !leeg(x.v);
  Object.entries(S.o.p).forEach(([c, p]) => {
    if(!D.P[c] || isKoppel(c)) return;
    p = echtDeel(p);
    const zet = (k, v, extra) => {
      const r = rows[c] || {}, oud = r.data ? r.data[k] : undefined, m = (r.meta || {})[k] || {};
      const x = { c, k, nieuw:String(v), oud:leeg(oud) ? '' : String(oud), oudBron:m.bron || '', extra:extra || null };
      if(x.oud && x.oud.trim().toLowerCase() === x.nieuw.trim().toLowerCase()) x.actie = 'gelijk';
      else if(k === 'vn' && x.oud && alleenCode(c, x.oud)) x.actie = 'zet';   // oude vloernaam = alleen de code: geen eigen keuze, Daans vloernaam-regel gaat voor (aanname vnoud)
      else if(x.oud && !isOnb(x.oud) && TOETSBRON.has(m.bron || '') && !m.tw) x.actie = 'kies';   // Daans eigen invoer: nooit zonder keuze
      else x.actie = 'zet';
      plan.push(x);
    };
    if(ok(p.so)){
      if(p.so.v !== 'weg') zet('opslag', p.so.v);
      else if(ok(p.weg) && p.weg.v === 'uitlopend') zet('uitlopend', (p.weg.t || new Date().toISOString()).slice(0, 10));
    }
    Object.entries(p.f || {}).forEach(([k, x]) => {
      if(!ok(x)) return;
      if(OVERZETVELD[k]) zet(OVERZETVELD[k], x.v);
      else if(k === 'binnen') zet('binnenkomst', x.v);
      else if(k === 'pickc'){ if(x.v === 'klopt') zet('pick', 'ja'); else if(x.v === 'geenpick') zet('pick', 'nee'); else if(x.v === 'moetpick') zet('pickkeuze', 'moet pick krijgen'); }
      else if(k === 'verp'){ const n = num((String(x.v).match(/^\s*(\d+(?:[.,]\d+)?)/) || [])[1]); if(n > 0) zet('spd', String(n)); }
    });
    if(p.gew && p.gew.st === 'tewegen') zet('kgst', 'onb');
    else if(p.gew && ['gewogen', 'vertrouwd'].includes(p.gew.st) && num(p.gew.kg) > 0) zet('kgst', String(num(p.gew.kg)), p.gew.st === 'gewogen' ? { gew:1 } : null);
  });
  return plan;
}
// zuiver: rows = { code:{ data, meta } } (een kopie); keuzes = { 'code|veld':'nieuw' } voor de regels met actie 'kies'
function overzetToepassen(rows, plan, keuzes){
  const uit = JSON.parse(JSON.stringify(rows || {})), codes = [...new Set(plan.map(x => x.c))], kopie = {}, nu = new Date().toISOString();
  codes.forEach(c => { kopie[c] = rows[c] ? JSON.parse(JSON.stringify(rows[c])) : null; });
  let n = 0;
  plan.forEach(x => {
    if(x.actie === 'gelijk') return;
    if(x.actie === 'kies' && (keuzes || {})[x.c + '|' + x.k] !== 'nieuw') return;
    const r = uit[x.c] = uit[x.c] || { data:{}, meta:{} }; r.data = r.data || {}; r.meta = r.meta || {};
    r.data[x.k] = x.nieuw; r.meta[x.k] = Object.assign({ op:nu, bron:'pd2', uit:'Productdata 2.0' + (x.oud ? ' (was ' + x.oud + ')' : '') }, x.extra || {});
    n++;
  });
  return { rows:uit, kopie, n };
}
function overzetTerug(rows, kopie){
  const uit = JSON.parse(JSON.stringify(rows || {}));
  Object.entries(kopie || {}).forEach(([c, r]) => { if(r) uit[c] = JSON.parse(JSON.stringify(r)); else delete uit[c]; });
  return uit;
}
async function overzetEcht(keuzes){
  if(!pd2Overzetten) throw new Error('Overzetten naar de echte productdata staat uit (pd2Overzetten = false).');
  const codes = [...new Set(Object.keys(S.o.p))], rows = {};
  for(let i = 0; i < codes.length; i += 80){
    const r = await WH.api('GET', 'productdata?productcode=in.(' + encodeURIComponent(codes.slice(i, i + 80).map(c => '"' + String(c).replace(/"/g, '\\"') + '"').join(',')) + ')&select=productcode,data,meta');
    (r || []).forEach(x => { rows[x.productcode] = { data:x.data || {}, meta:x.meta || {} }; });
  }
  const plan = overzetPlan(rows), t = overzetToepassen(rows, plan, keuzes), key = 'wh-pd2-kopie-' + new Date().toISOString().replace(/[:.]/g, '-');
  await WH.catZet(key, { t:new Date().toISOString(), kopie:t.kopie });   // eerst de kopie
  const nu = new Date().toISOString(), upd = Object.keys(t.kopie).filter(c => JSON.stringify(t.rows[c]) !== JSON.stringify(t.kopie[c])).map(c => ({ productcode:c, data:t.rows[c].data, meta:t.rows[c].meta, updated_at:nu }));   // alleen rijen die echt veranderen
  if(upd.length) await WH.upsert('productdata', upd, 'productcode');
  upd.forEach(r => { P().S.pd[r.productcode] = { data:r.data, meta:r.meta, t:nu }; ongeldig(r.productcode); });
  const kies = plan.filter(x => x.actie === 'kies' && (keuzes || {})[x.c + '|' + x.k] !== 'nieuw');
  return { key, n:t.n, rijen:upd.length, verschil:kies.length };
}

/* ---------- rollen controleren: alle rollen met de berekende gegevens en een gewichtscheck ---------- */
// kg per m² per mm dikte = kg per meter ÷ (breedte in m × dikte in mm); binnen een familie hoort dat gelijk te zijn (zelfde materiaal)
function rolCheck(){
  const l = Object.keys(D.P).filter(c => actief(c) && isRol(c)).map(c => {
    const I = info(c), e = eenheid(c).e, g = gewicht(c), kg = g.kg > 0 ? g.kg : null;
    const B = nOf(waarde(c, 'rb', I).v), d = nOf(waarde(c, 'rd', I).v), L = nOf(waarde(c, 'rl', I).v);
    const kgm = !kg ? null : e === 'm' ? kg : e === 'cm' ? kg * 100 : L > 0 ? kg / L : null;
    const dicht = kgm && B > 0 && d > 0 ? kgm / (B / 100 * d) : null;
    return { c, fam:famVan(c), lev:levVan(c), e, g, B, d, L, kgm, dicht, dia:calc(c, 'rdia', I).v, kgrol:calc(c, 'rkg', I).v };
  });
  const per = {}; l.forEach(x => { if(x.dicht) (per[x.fam] = per[x.fam] || []).push(x.dicht); });
  const med = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  l.forEach(x => {
    const f = per[x.fam] || [], m = f.length >= 3 ? med(f) : null; x.famDicht = m;
    x.mist = !x.kgm ? (x.g.pq > 0 ? 'breedte, dikte of lengte ontbreekt: niet te toetsen' : 'geen gewicht in Picqer') : !x.dicht ? 'breedte of dikte ontbreekt: niet te toetsen' : '';
    x.afw = !x.dicht ? ''
      : m && Math.abs(x.dicht / m - 1) > 0.2 ? nf(x.dicht, 2) + ' kg per m² per mm, de familie ' + nf(m, 2) + ' (' + (x.dicht > m ? '+' : '−') + Math.round(Math.abs(x.dicht / m - 1) * 100) + '%)'
      : x.dicht < 0.3 || x.dicht > 2.5 ? nf(x.dicht, 2) + ' kg per m² per mm is ongewoon (rubber ± 1,0–1,6)' : '';
  });
  return l;
}

/* ---------- tellen: hoe vaak een voorstel bevestigd of aangepast is ---------- */
function telling(){
  const t = {};
  const tel = (k, x, c) => { if(!x || !x.st || x.oef) return; const e = t[k] = t[k] || { klopt:0, aangepast:0, vb:[] }; if(x.st === 'bevestigd') e.klopt++; else if(x.st === 'aangepast'){ e.aangepast++; if(e.vb.length < 6) e.vb.push((leeg(x.voor) ? 'leeg' : x.voor) + ' → ' + x.v + ' (' + c + ')'); } };
  Object.entries(S.o.p).forEach(([c, p]) => {
    if(p.so) tel('soort', p.so, c);
    if(p.weg) tel('weg', p.weg, c);
    Object.entries(p.f || {}).forEach(([k, x]) => tel(k, x, c));
  });
  return t;
}

return { S, AANNAMES, KEY_OEFEN, KEY_FB, laad, flush, plan, schrijf, po, poZet, poHerstel, wisAlles, oefDone, fbTab, fbOpm, fbOpmWeg, fbAann, mgPlus,
  koppelVan, isKoppel, koppelTekst, wegLicht, controle, maatRegel, vnRegel, sppUitBronnen, famVan, maatVan, famNaam, isSam, naamVan, abcVan, actief, kgPq, vk6, vk28, inkoop, backorders, inkomend, locInfo, som, anderOpPlek,
  VELD, SOORTEN, SOORTT, WEG, KOLOMMEN, NODIG, ROLNODIG, ROLVS, SAMVELD, MATEN, MATEN_WB, VERP, PICKC, GEWST, isNvt, isOnb, ingevuld, nOf,
  eenheid, rolKand, isRol, rolBesl, rolVoorstel, gewicht, gewKlaar, gewAfwijking, eigen, waarde, soortWaarde, wegWaarde, info, calc, hoogteWaarsch, nodigVan, status,
  naControle, liggerVan, labelsVerbeteren, rolCheck, labelsGoed, verschil, verschilKies, herstel, pdFlush, PDQ,
  vraagLive, liveStatus, meet, meting, zetMeting, scoreVan, pd2Overzetten, overzetPlan, overzetToepassen, overzetTerug, overzetEcht, toetsItems, TOETSVELD, SCORE_VOOR, telling, dataVers, ongeldig, capPick, meld, opNieuw:f => S.luister.push(f) };
})();
