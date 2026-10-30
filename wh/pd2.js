/* =====================================================================
   IVOL Warehouse 3.0 — Productdata 2.0, scherm (oefensimulatie)
   Ontwerp: docs/productdata-2.0-ontwerp.md. Rekenen en opslag: wh/pd2-reken.js (PD2R).
   Route #/pd2 (menu 3 · Producten, badge oefen). Oefenmodus: niets gaat naar de echte productdata;
   alles wat Daan doet staat in wh-pd2-oefen, opmerkingen en oefenantwoorden in wh-pd2-feedback.
   Herbouw in de stijl van Per familie: één ding tegelijk.
     start   = families (zoeken, filter ingeklapt, volgende familie)
     familie = maten (tegels) en binnen de gekozen maat de productkaarten onder elkaar
     kaart   = feiten in grijze regels, gewicht, "Hoe vul je pick aan?" en alleen de velden van die soort
   Geen tabellen, geen chips: voorstel = blauw vak met Klopt, groen = vast, rood = ontbreekt of kan niet.
   ===================================================================== */
window.WHPD2 = (function(){
'use strict';
const { esc, nf, num, leeg, D } = WH;
const R = window.PD2R;
const ls = k => { try{ return localStorage.getItem('pd2-' + k); }catch(e){ return null; } };
const lsZet = (k, v) => { try{ localStorage.setItem('pd2-' + k, v); }catch(e){} };
// oefensets (feedback per set, zelfde sleutels als ronde 1)
const TABS = [['pallet', 'Pallet'], ['deel', 'Deel'], ['pick', 'Pick'], ['mix', 'Mix'], ['weg', 'Weg'], ['rollen', 'Rollen'], ['afgerond', 'Afgerond'], ['weeglijst', 'Weeglijst']];
const TABT = Object.fromEntries(TABS);
const SEGS = [['open', 'Open'], ['pallet', 'Pallet'], ['deel', 'Deel'], ['pick', 'Pick'], ['mix', 'Mix'], ['weg', 'Weg']];
const SCOPES = [['belangrijk', 'Belangrijk'], ['AB', 'A+B'], ['beweegt', 'Alles dat beweegt'], ['binnen', 'Komt binnen'], ['voorraad', 'Alles met voorraad']];
const UI = { el:null, scope:ls('scope') || 'belangrijk', zoek:'', lev:'', afd:'', hal:'', abc:'', filterOpen:false,
  fk:null, mk:null, seg:'open', aandacht:null, view:null, wegAlle:null, sel:new Set(), undo:null, n:40, famN:30, lastK:{},
  weegKlaar:new Set(), rolOpen:{}, oefenen:ls('oefenen') === '1', oef:(() => { try{ return JSON.parse(ls('oef') || '') || { set:'pallet', i:0 }; }catch(e){ return { set:'pallet', i:0 }; } })() };
const now = () => new Date().toISOString();
const dk = iso => { const s = String(iso || ''); return s.length >= 10 ? s.slice(8, 10) + '-' + s.slice(5, 7) : ''; };
const uur = d => { d = d instanceof Date ? d : new Date(d); return isNaN(d) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const mv = (n, een, meer) => nf(n) + ' ' + (n === 1 ? een : meer);

/* ---------- stijl (één keer, zoals de lader in ivol.html: altijd de nieuwste) ---------- */
function stijl(){
  if(document.getElementById('pd2-stijl')) return;
  const s = document.createElement('style'); s.id = 'pd2-stijl'; document.head.appendChild(s);
  fetch('wh/pd2.css', { cache:'no-cache' }).then(r => r.ok ? r.text() : '').then(t => { s.textContent = t; }).catch(() => {});
}

/* ---------- selectie: welke families staan op het startscherm ---------- */
const gangVan = c => { const h = R.koppelVan(c) || c; return (String((D.P[h] || {}).locaties_hm || '').split(/[,|]/)[0] || '').trim().slice(0, 2).toUpperCase(); };
function inScope(c, sc){
  const h = R.koppelVan(c) || c, p = D.P[h] || {}, abc = R.abcVan(h), I = WHPD.index();
  switch(sc){
    case 'belangrijk': return abc === 'A' || abc === 'B' || I.binnen.has(h);
    case 'AB': return abc === 'A' || abc === 'B';
    case 'beweegt': return !!(abc || num(WHPD.S.cat && WHPD.S.cat.pd && WHPD.S.cat.pd[h]) > 0 || R.vk6(h) > 0 || I.bo[h]);
    case 'binnen': return I.binnen.has(h);
    case 'voorraad': return (num(p.voorraad_hm) || 0) > 0 || (num(p.voorraad_vst) || 0) > 0;
  }
  return true;
}
const zoekTreft = (c, q) => { const p = D.P[c] || {}, t = (c + ' ' + (p.naam || '') + ' ' + (p.locaties_hm || '') + ' ' + (p.leverancier || '')).toLowerCase(); return q.every(w => t.includes(w)); };
let BC = { key:null, v:null };
// producten die de familielijst bepalen (scope of zoeken, plus de filters)
function basisCodes(zonder){
  const key = [UI.scope, UI.zoek, zonder === 'lev' ? '' : UI.lev, UI.afd, UI.hal, UI.abc, R.S.dataVer, zonder || ''].join('|');
  if(BC.key === key) return BC.v;
  const q = UI.zoek.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let cs = Object.keys(D.P).filter(R.actief);
  cs = q.length ? cs.filter(c => zoekTreft(c, q)) : cs.filter(c => inScope(c, UI.scope));
  if(UI.lev && zonder !== 'lev') cs = cs.filter(c => String((D.P[R.koppelVan(c) || c] || {}).leverancier || '') === UI.lev);
  if(UI.afd) cs = cs.filter(c => gangVan(c) === UI.afd);
  if(UI.hal) cs = cs.filter(c => gangVan(c).slice(0, 1) === UI.hal);
  if(UI.abc) cs = cs.filter(c => (R.abcVan(R.koppelVan(c) || c) || '–') === UI.abc);
  BC = { key, v:cs };
  return cs;
}
// alle actieve producten per familie (in een familie zie je altijd de hele familie, zoals Per familie)
let FI = { dv:-1, m:null };
function famIndex(){
  if(FI.dv === R.S.dataVer && FI.m) return FI.m;
  const m = {}; Object.keys(D.P).forEach(c => { if(!R.actief(c)) return; const f = R.famVan(c); (m[f] = m[f] || []).push(c); });
  FI = { dv:R.S.dataVer, m }; return m;
}
const famAlle = fk => famIndex()[fk] || [];
const famEcht = fk => famAlle(fk).filter(c => !R.isKoppel(c));
const famCodes = () => UI.fk ? famEcht(UI.fk) : [];

/* ---------- aandachtspunten per product ---------- */
const AC = new Map();
function aandachtVan(c){
  const fv = R.S.famVer[R.famVan(c)] || 0, h = AC.get(c);
  if(h && h.fv === fv && h.dv === R.S.dataVer && h.ver === R.S.ver && Date.now() - h.op < 5 * 60e3) return h.v;
  const v = aandachtReken(c); AC.set(c, { fv, dv:R.S.dataVer, ver:R.S.ver, op:Date.now(), v });
  return v;
}
function aandachtReken(c){
  const I = R.info(c), st = R.status(c), uit = [];
  if(I.kop || st.so === 'weg' || st.af) return uit;
  if(st.gew.st === 'tewegen') uit.push('tewegen');
  else if(st.gew.st === 'niet' && !R.isSam(c) && R.gewAfwijking(c)) uit.push('gewicht');
  if(I.f.geen > 0) uit.push('geenloc');
  const stock = R.som(I.f.pick) + R.som(I.f.bulk) + I.f.geen;
  if(!I.f.pick.length && stock > 0 && !R.ingevuld(R.waarde(c, 'pickc', I))) uit.push(/^[AB]$/.test(R.abcVan(c)) ? 'loper' : 'zonderpick');
  const sp = R.waarde(c, 'spp', I), spN = R.nOf(sp.v), palSoort = ['pallet', 'deel'].includes(st.so);
  if(palSoort && (sp.st === 'twijfel' || (I.ink && spN > 0 && I.ink.max < spN))) uit.push('tegen');
  if(palSoort && R.hoogteWaarsch(c, R.waarde(c, 'hoogte', I).v, I)) uit.push('hoogte');
  if(palSoort){ const gw = num(R.calc(c, 'gewpal', I).v), pl = num(R.calc(c, 'plaatsen', I).v); if(gw > 2000 || (gw > 0 && pl > 0 && Math.floor(2000 / gw) < Math.max(1, Math.floor(3 / pl)))) uit.push('ligger'); }
  if(['deel', 'mix'].includes(st.so) && /veelvoud/.test(R.calc(c, 'aanvmet', I).warn || '')) uit.push('doos');
  if(st.soSt === 'twijfel') uit.push('twijfel');
  return uit;
}
const AAND = [['tewegen', 'gewicht te wegen', 'gewichten te wegen'], ['gewicht', 'gewicht afwijkend', 'gewichten afwijkend'], ['loper', 'loper zonder picklocatie', 'lopers zonder picklocatie'],
  ['zonderpick', 'zonder picklocatie', 'zonder picklocatie'], ['geenloc', 'op geen specifieke locatie', 'op geen specifieke locatie'], ['tegen', 'per pallet meer dan ooit besteld', 'per pallet meer dan ooit besteld'],
  ['hoogte', 'hoogte past niet in de hal', 'hoogtes passen niet in de hal'], ['ligger', 'te zwaar voor de ligger', 'te zwaar voor de ligger'], ['doos', 'aanvullen geen veelvoud van de doos', 'aanvullen geen veelvoud van de doos'], ['twijfel', 'soort twijfel', 'soorten twijfel']];
const AANDT = Object.fromEntries(AAND.map(([k, a, b]) => [k, [a, b]]));
const aandTekst = (k, n) => nf(n) + ' ' + (AANDT[k] ? AANDT[k][n === 1 ? 0 : 1] : k);
function weegCodes(){
  const s = new Set();
  Object.entries(R.S.o.p).forEach(([c, p]) => { if(p.gew && p.gew.st === 'tewegen' && D.P[c]) s.add(c); });
  Object.entries(WHPD.S.pd).forEach(([c, r]) => { if(D.P[c] && r.data && R.isOnb(r.data.kgst) && R.gewicht(c).st === 'tewegen') s.add(c); });
  return [...s];
}
// Weg-voorstel voor alle actieve producten, ook buiten de familie (berekend per gegevensversie)
let WC = { dv:-1, m:null };
function wegAlle(){
  if(WC.dv === R.S.dataVer && WC.m) return WC.m;
  const m = {}; Object.keys(D.P).forEach(c => { const w = R.wegLicht(c); if(w) m[c] = w.v; });
  WC = { dv:R.S.dataVer, m }; return m;
}
const wegAlleCodes = v => Object.entries(wegAlle()).filter(([c, w]) => w === v && !(R.po(c) && (R.po(c).weg || R.po(c).so))).map(([c]) => c);
const segVan = c => { const st = R.status(c); return st.af ? 'afgerond' : st.so || 'pick'; };
const sorteer = cs => cs.slice().sort((a, b) => (('ABC'.indexOf(R.abcVan(a)) + 4) % 4) - (('ABC'.indexOf(R.abcVan(b)) + 4) % 4) || R.naamVan(a).localeCompare(R.naamVan(b), 'nl', { numeric:true }) || a.localeCompare(b));

/* ---------- families en maten ---------- */
const FC = { key:null, v:null };
function families(){
  const cs = basisCodes(), key = BC.key + '|' + R.S.ver;
  if(FC.key === key) return FC.v;
  const fams = new Set(); cs.forEach(c => { if(!R.isKoppel(c)) fams.add(R.famVan(c)); });
  const I = WHPD.index();
  const uit = [...fams].map(fk => {
    const l = famEcht(fk), st = l.map(R.status), af = st.filter(s => s.af).length;
    const nA = l.filter(c => R.abcVan(c) === 'A').length, nB = l.filter(c => R.abcVan(c) === 'B').length, nIn = l.filter(c => I.binnen.has(c)).length;
    const aand = l.reduce((n, c) => n + aandachtVan(c).length, 0);
    const lev = String((D.P[l[0]] || {}).leverancier || fk.split('|')[0] || '');
    return { fk, naam:R.famNaam(fk), lev, n:l.length, maten:new Set(l.map(R.maatVan)).size, af, open:st.reduce((n, s) => n + (s.af ? 0 : s.open.length), 0), aand, score:nA * 3 + nB * 2 + nIn * 2 + aand };
  }).filter(f => f.n).sort((a, b) => b.score - a.score || b.n - a.n || a.naam.localeCompare(b.naam));
  FC.key = key; FC.v = uit;
  return uit;
}
function rolTitel(cs){
  if(!cs.length || !cs.every(R.isRol)) return '';
  const w = k => { for(const c of cs){ const v = R.waarde(c, k).v; if(v) return v; } return ''; };
  const b = w('rb'), d = w('rd');
  return b || d ? [b ? nf(num(b)) + ' cm' : '', d ? nf(num(d)) + ' mm' : ''].filter(Boolean).join(' · ') : '';
}
const MC = { key:null, v:null };
function maatgroepen(fk){
  fk = fk || UI.fk;
  const key = fk + '|' + R.S.ver + '|' + R.S.dataVer;
  if(MC.key === key) return MC.v;
  MC.key = key; MC.v = maatgroepenReken(fk);
  return MC.v;
}
function maatgroepenReken(fk){
  const cs = famEcht(fk), per = new Map();
  cs.forEach(c => { const k = R.maatVan(c); if(!per.has(k)) per.set(k, []); per.get(k).push(c); });
  const delen = x => String(x || '').split('·').filter(y => y.trim()).length;
  return [...per.entries()].map(([k, l]) => {
    const nat = l.map(c => WHPD.maatSig(R.naamVan(c))).filter(x => x && (!k || x.startsWith(k)));
    const t = rolTitel(l) || [k].concat(nat).filter(Boolean).sort((a, b) => delen(b) - delen(a) || b.length - a.length)[0] || 'zonder maat';
    const st = l.map(R.status), per2 = {};
    st.forEach(s => { if(!s.af) per2[s.so || 'pick'] = (per2[s.so || 'pick'] || 0) + 1; });
    return { k, cs:l, t, af:st.filter(s => s.af).length, open:st.filter(s => !s.af).length, velden:st.reduce((n, s) => n + (s.af ? 0 : s.open.length), 0), per:per2 };
  }).sort((a, b) => { const d = x => { const m = String(x.k).match(/(\d+[.,]?\d*)x(\d+[.,]?\d*)/); return m ? num(m[1]) * num(m[2]) : 1e12; }; return d(a) - d(b) || String(a.k).localeCompare(String(b.k), 'nl', { numeric:true }); });
}
// producten van het blok onder de maattegels: de gekozen maat, of (bij een aandachtspunt) die producten in de hele familie
function blokCodes(){
  if(UI.view === 'wegalle') return UI.wegAlle ? wegAlleCodes(UI.wegAlle) : [];
  if(!UI.fk) return [];
  if(UI.aandacht) return famEcht(UI.fk).filter(c => aandachtVan(c).includes(UI.aandacht) || UI.sel.has(c));
  if(plat()) return famEcht(UI.fk);
  return famEcht(UI.fk).filter(c => R.maatVan(c) === UI.mk);
}
const openCodes = () => blokCodes().filter(c => !R.status(c).af);
function kaartCodes(){
  const cs = openCodes();
  return opVolgorde(UI.seg === 'open' || UI.view === 'wegalle' ? cs : cs.filter(c => segVan(c) === UI.seg));
}
// zonder maatstap: op maat (volgorde van de maten), anders ABC en naam
function opVolgorde(cs){ if(!plat()) return sorteer(cs); const i = {}; maatgroepen().forEach((m, n) => m.cs.forEach(c => { i[c] = n; })); return cs.slice().sort((a, b) => (i[a] ?? 1e9) - (i[b] ?? 1e9) || a.localeCompare(b)); }
const afCodes = () => opVolgorde(blokCodes().filter(c => R.status(c).af));
function kiesMaat(){
  const M = maatgroepen();
  if(UI.mk !== null && M.some(m => m.k === UI.mk)) return;
  const m = M.find(x => x.open) || M[0]; UI.mk = m ? m.k : null;
}

/* ---------- oefening: opdrachten per set ---------- */
const VB = { mars:'schoonloopmat mars', spurt:'trapmaantje spurt', kokos:'kokos', fwb:'whiteboard zonder rand', ring:'ringmat op rol', waterhog:'waterhog' };
const OPDR = {
  pallet:[
    { id:'p1', t:'Open Whiteboard zonder rand (FWB), vink in een maat de Pallet-kaarten aan en druk onderaan op "Selectie klopt".', toon:{ zoek:VB.fwb, seg:'pallet' }, ev:'selklopt', als:d => d.tab === 'pallet' },
    { id:'p2', t:'Pas bij een Pallet-product Stuks per pallet aan en kijk hoe Gewicht volle pallet (grijs) meerekent.', ev:'veld', als:d => d.tab === 'pallet' && d.k === 'spp' },
    { id:'p3', t:'Zet één Pallet-product op Deel bij "Hoe vul je pick aan?".', ev:'soort', als:d => d.van === 'pallet' && d.naar === 'deel' },
    { id:'p4', t:'Vul een Hoogte in die niet past (bijv. 190 bij een 20-locatie in hal A) en zie de melding eronder.', ev:'veld', als:d => d.k === 'hoogte' && d.warn }
  ],
  deel:[
    { id:'d1', t:'Open Schoonloopmat Mars, maat 120x180: staat Antraciet op Deel?', toon:{ zoek:VB.mars, maat:'120x180' }, ev:'maat', als:d => /mars/i.test(d.naam || '') && /120x180/.test(d.mk || '') },
    { id:'d2', t:'Vul bij één Deel-product Aanvullen bij en Max op pick in en zie Aanvullen met (grijs) meerekenen.', ev:'veld', als:d => d.tab === 'deel' && (d.k === 'lvl' || d.k === 'maxpick') && d.beide },
    { id:'d3', t:'Vul bij Trapmaantje Spurt een Inkoopverpakking in (bijv. 15 doos) en zie de melding als Aanvullen met geen veelvoud is.', toon:{ zoek:VB.spurt }, ev:'veld', als:d => d.k === 'verp' },
    { id:'d4', t:'Kies bij één product Picklocatie: geen pick (alleen bulk, per order verplaatsen).', ev:'pickc', als:d => d.v === 'geenpick' }
  ],
  pick:[
    { id:'k1', t:'Controleer een picklocatie: kies "klopt".', ev:'pickc', als:d => d.v === 'klopt' },
    { id:'k2', t:'Kies bij een product zonder picklocatie "moet pick krijgen" (tik in een familie op "… zonder picklocatie").', ev:'pickc', als:d => d.v === 'moetpick' },
    { id:'k3', t:'Bevestig of pas Max op pick aan bij een Pick-product. Bekijk Trapmaantje Spurt.', toon:{ zoek:VB.spurt, seg:'pick' }, ev:'veld', als:d => d.tab === 'pick' && d.k === 'maxpick' }
  ],
  mix:[
    { id:'m1', t:'Geef 3 producten dezelfde mixgroep: vink ze aan en kies onderaan "Zelfde waarde… → Mixgroep".', toon:{ zoek:VB.spurt }, staat:() => mixDrie() },
    { id:'m2', t:'Maak een nieuwe mixgroep (keuze "nieuw…" bij Mixgroep).', ev:'mgnieuw' },
    { id:'m3', t:'Tik bij Mix op een mixgroep-regel: leden en bulklocaties.', ev:'mgregel' }
  ],
  weg:[
    { id:'w1', t:'Zet een product op Backorder (bijv. Waterhog zonder voorraad).', toon:{ zoek:VB.waterhog, seg:'weg' }, ev:'weg', als:d => d.v === 'backorder' },
    { id:'w2', t:'Zet een product op Archief.', ev:'weg', als:d => d.v === 'archief' },
    { id:'w3', t:'Open "Afgerond" onderaan de maat en zet een Weg-product terug.', ev:'wegterug' }
  ],
  rollen:[
    { id:'r1', t:'Zeg bij een Kokos-rol "Is dit een rol? ja".', toon:{ zoek:VB.kokos }, ev:'rol', als:d => d.v === true },
    { id:'r2', t:'Bevestig bij Rolgegevens breedte, dikte en lengte volle rol en zie diameter en kg per rol (grijs) meerekenen.', staat:() => Object.values(R.S.o.p).some(p => p.rol && p.rol.v && ['rb', 'rd', 'rl'].every(k => p.f && p.f[k])) },
    { id:'r3', t:'Kies Staand of liggend en zie max rollen per pallet als voorstel.', ev:'veld', als:d => d.k === 'rstand' }
  ],
  afgerond:[
    { id:'a1', t:'Rond een product af: alle velden groen en het gewicht goedgekeurd (vertrouwd of gewogen).', staat:() => Object.keys(R.S.o.p).some(c => D.P[c] && R.status(c).af) },
    { id:'a2', t:'Heropen een product onder "Afgerond" van een maat.', ev:'heropen' },
    { id:'a3', t:'Rond een product af met gewicht "te wegen": het krijgt ⚖ en staat op de Weeglijst.', staat:() => Object.keys(R.S.o.p).some(c => D.P[c] && R.status(c).af && R.gewicht(c).st === 'tewegen') }
  ],
  weeglijst:[
    { id:'g1', t:'Vink een paar kaarten aan en kies onderaan "Gewicht… → aanpassen…".', ev:'gewpop' },
    { id:'g2', t:'Zet een product op "te wegen" (knopje bij Gewicht).', ev:'gewst', als:d => d.st === 'tewegen' },
    { id:'g3', t:'Open de Weeglijst (onderaan het startscherm).', ev:'tab', als:d => d.tab === 'weeglijst' },
    { id:'g4', t:'Vul op de Weeglijst bij een product het gewogen kg in.', ev:'gewogen' }
  ]
};
function mixDrie(){ const t = {}; Object.values(R.S.o.p).forEach(p => { const m = p.f && p.f.mixgroep; if(m && m.v) t[m.v] = (t[m.v] || 0) + 1; }); return Object.values(t).some(n => n >= 3); }
function meld(ev, d){
  d = d || {};
  Object.entries(OPDR).forEach(([tab, l]) => l.forEach(o => {
    if(o.ev !== ev || (R.S.o.oef[tab] && R.S.o.oef[tab][o.id])) return;
    let ok = false; try{ ok = !o.als || o.als(d); }catch(e){}
    if(ok && R.oefDone(tab, o.id) && UI.oefenen) WH.toast('Opdracht gedaan ✓ ' + TABT[tab] + ': ' + o.t.split(/[.:(]/)[0], 3500);
  }));
}
function staatCheck(){
  Object.entries(OPDR).forEach(([tab, l]) => l.forEach(o => {
    if(!o.staat || (R.S.o.oef[tab] && R.S.o.oef[tab][o.id])) return;
    let ok = false; try{ ok = o.staat(); }catch(e){}
    if(ok && R.oefDone(tab, o.id) && UI.oefenen) WH.toast('Opdracht gedaan ✓ ' + TABT[tab], 3000);
  }));
}

/* ---------- kleine bouwstenen ---------- */
const abcB = c => { const a = R.abcVan(c); return a ? `<span class="pd2-abc ${a}">${a}</span>` : ''; };
const vkTxt = c => { const a = R.vk6(c), b = R.vk28(c); return nf(a) + '*6 / ' + (b === null ? '–' : nf(b)) + '*28'; };
const opmN = c => R.S.fb.opm.filter(x => x.code === c).length;
const exportTxt = () => 'voorraad van ' + (dk(D.VRDATUM) || '?');
function vrRegel(I){
  const f = I.f, d = [];
  d.push(f.pick.length ? 'Pick ' + f.pick.slice(0, 2).map(x => `<span class="m">${esc(x.n)}</span> ${nf(x.v)}${x.tijd ? ' (tijdelijk)' : ''}`).join(', ') + (f.pick.length > 2 ? ' +' + (f.pick.length - 2) : '') : 'geen picklocatie');
  if(f.bulk.length) d.push('Bulk ' + f.bulk.slice(0, 3).map(x => `<span class="m">${esc(x.n)}</span> ${nf(x.v)}`).join(', ') + (f.bulk.length > 3 ? ' +' + (f.bulk.length - 3) : ''));
  if(f.vst) d.push('VST ' + nf(f.vst));
  if(f.geen) d.push('geen locatie ' + nf(f.geen));
  return d.join(' · ') + (f.bron === 'live' ? '' : ` <span class="u" title="${esc(exportTxt())}">(${esc(dk(D.VRDATUM) || '?')})</span>`);
}
function inkRegel(c, I){
  const i = I.ink, d = [];
  if(i){ const tot = i.h.reduce((s, x) => s + x.v * x.n, 0), n = i.h.reduce((s, x) => s + x.n, 0); d.push('meestal ' + nf(i.meestal) + (i.meestalN > 1 ? ' (' + i.meestalN + '×)' : '') + ' · ø ' + nf(Math.round(tot / n)) + ' · laatst ' + esc(dk(i.laatste)) + '-' + esc(String(i.laatste).slice(2, 4))); }
  else d.push('geen inkoop in 12 maanden');
  const inn = R.inkomend(c); if(inn.length) d.push('komt binnen ' + inn.slice(0, 2).map(x => nf(x.n) + (x.eta ? ' (ETA ' + dk(x.eta) + ')' : '')).join(', '));
  return d.join(' · ');
}
const vkRegel = c => `<span title="gemiddeld per maand, gemeten over 6 maanden / over 28 dagen">${vkTxt(c)}</span>`;
const kgTxt = kg => kg > 0 ? nf(kg, kg < 10 ? 3 : 1) + ' kg' : '';
function liveRegel(cs){
  const L = R.liveStatus(), b = R.S.bewaar, opslag = b.fout ? ' · <b class="rood">bewaren mislukt, opnieuw over 5 s</b>' : '';
  if(!L.gekoppeld) return `<span class="rood">${esc(exportTxt())} · Picqer niet gekoppeld op dit apparaat</span>${opslag}`;
  if(L.wachtTot) return `<span class="rood">${esc(exportTxt())} · Picqer even niet bereikbaar, opnieuw om ${uur(L.wachtTot)}</span>${opslag}`;
  const live = (cs || []).map(c => R.info(c).f).filter(f => f.bron === 'live');
  if(L.bezig || L.rij || (cs && cs.length && !live.length)) return 'voorraad live ophalen…' + opslag;
  const t = live.map(f => new Date(f.t).getTime()).filter(x => x > 0);
  return 'voorraad live' + (t.length ? ' · ' + uur(Math.max(...t)) : '') + opslag;
}
const snapTxt = () => R.S.uitSnap ? 'gegevens van ' + uur(R.S.uitSnap) + ', bijwerken…' : '';

/* ---------- velden op de kaart (compact: label, vak, één korte regel "voorstel 3 · Klopt"; reden bij ⓘ of hover) ---------- */
const VAST = ['bevestigd', 'aangepast', 'vastgelegd'];
const klasse = w => VAST.includes(w.st) ? ' ok' : ['voorstel', 'twijfel'].includes(w.st) && !leeg(w.v) ? ' vsel' : '';
function toonWaarde(k, v){
  const d = R.VELD[k]; if(leeg(v)) return '';
  if(k === 'pickc') return (R.PICKC.find(x => x[0] === v) || [, v])[1];
  if(d && d.type === 'keus') return (d.opt.find(x => x[0] === v) || [, v])[1];
  return String(v);
}
const isVs = w => ['voorstel', 'twijfel'].includes(w.st) && !leeg(w.v);
const reden = w => [w.why ? String(w.why) : '', w.st === 'twijfel' ? 'twijfel' + (w.alt && w.alt.length ? ': ook ' + w.alt.join(' / ') : '') + (w.sc && w.sc.p < 0.6 ? ', klopte ' + Math.round(w.sc.p * 100) + '% bij jouw invoer' : '') : ''].filter(Boolean).join(' · ');
// één korte regel onder het vak
function vsRegel(k, w, toon){
  if(!isVs(w)) return '';
  return `<div class="pd2-vr" title="${esc('voorstel ' + (toon || toonWaarde(k, w.v)) + ': ' + reden(w))}"><span class="vw">voorstel${w.st === 'twijfel' ? ' (twijfel)' : ''}</span><b>${esc(toon || toonWaarde(k, w.v))}</b><button data-a="klopt" data-k="${k}">Klopt</button></div>`;
}
// keuzelijsten staan standaard op het voorstel (blauwe tekst); pas Klopt of een andere keuze slaat iets op
function ctlHtml(c, k, w){
  const d = R.VELD[k], v = VAST.includes(w.st) ? w.v : '', vs = isVs(w) ? w.v : '', kies = v || vs, ph = vs ? toonWaarde(k, vs) : '';
  const cl = 'pd2-in' + klasse(w);
  if(d.type === 'num' || d.type === 'tekst') return `<input class="pd2-in${VAST.includes(w.st) ? ' ok' : ''}" data-k="${k}" value="${esc(v)}" placeholder="${esc(ph)}" ${d.type === 'num' ? 'inputmode="decimal"' : ''} autocomplete="off" aria-label="${esc(d.t)}">`;
  if(d.type === 'maat'){
    const lijst = R.MATEN.concat(/whiteboard|^fwb/i.test(R.naamVan(c) + ' ' + c) ? R.MATEN_WB : []);
    const extra = [v, w.v].filter(x => x && !lijst.includes(x));
    return `<select class="${cl}" data-k="maat" aria-label="Palletmaat"><option value=""></option>${[...new Set(extra)].concat(lijst).map(m => `<option ${m === kies ? 'selected' : ''}>${esc(m)}</option>`).join('')}<option value="__anders">anders…</option></select>`;
  }
  if(d.type === 'keus') return `<select class="${cl}" data-k="${k}" aria-label="${esc(d.t)}"><option value=""></option>${d.opt.map(([a, b]) => `<option value="${a}" ${a === kies ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  if(d.type === 'verp'){
    const m = String(v || '').match(/^\s*(\d+(?:[.,]\d+)?)?\s*(.*)$/), n = m && m[1] ? m[1] : '', s = m ? m[2].trim() : '';
    const pm = String(ph).match(/^\s*(\d+(?:[.,]\d+)?)?\s*(.*)$/);
    return `<div class="pd2-verp"><input class="pd2-in${v ? ' ok' : ''}" data-k="verp" data-d="n" value="${esc(n)}" placeholder="${esc(pm && pm[1] || '')}" inputmode="decimal" autocomplete="off" aria-label="Inkoopverpakking aantal"><select class="pd2-in${v ? ' ok' : vs ? ' vsel' : ''}" data-k="verp" data-d="s" aria-label="Inkoopverpakking soort"><option value=""></option>${R.VERP.map(x => `<option ${x === (s || (pm && pm[2] || '').trim()) ? 'selected' : ''}>${x}</option>`).join('')}</select></div>`;
  }
  if(d.type === 'mix'){
    const al = [...new Set(R.S.o.mg.concat(Object.values(R.S.o.p).map(p => p.f && p.f.mixgroep && p.f.mixgroep.v).filter(Boolean)).concat(kies ? [kies] : []))].sort();
    return `<select class="${cl}" data-k="mixgroep" aria-label="Mixgroep"><option value=""></option>${al.map(m => `<option ${m === kies ? 'selected' : ''}>${esc(m)}</option>`).join('')}<option value="__nieuw">nieuw…</option></select>`;
  }
  if(d.type === 'pick'){
    const heeft = R.info(c).f.pick.length > 0, opt = heeft ? R.PICKC.filter(x => x[0] !== 'moetpick') : R.PICKC.filter(x => x[0] !== 'klopt');
    return `<select class="${cl}" data-k="pickc" aria-label="Picklocatie controle"><option value=""></option>${opt.map(([a, b]) => `<option value="${a}" ${a === kies ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  }
  return '';
}
const BREED = new Set(['pickc', 'vn', 'verp']);
// verschil met Daans eigen invoer in productdata (niet overschreven bij het overzetten): kies welke klopt
function verschilHtml(c, k){
  const d = R.verschil(c, k); if(!d) return '';
  const t = x => k === 'soort' ? (R.SOORTT[x] || x) : x;
  return `<div class="pd2-verschil">verschil: productdata <b>${esc(t(d.pd))}</b> · 2.0 <b>${esc(t(d.twee))}</b> <button class="pd2-mini" data-a="verschil" data-k="${k}" data-v="pd2">neem 2.0</button><button class="pd2-mini" data-a="verschil" data-k="${k}" data-v="pd">neem productdata</button></div>`;
}
const KORT = { spp:'Per pallet', hoogte:'Hoogte (cm)', maxpick:'Max op pick', lvl:'Aanvullen bij', rl:'Lengte (m)', rkg:'kg per rol', rmax:'Max rollen', rvast:'Vast aantal', rstand:'Staand/liggend', rdia:'Diameter', rb:'Breedte (cm)', rd:'Dikte (mm)' };
function veldHtml(c, k, I, nodig){
  const d = R.VELD[k], w = R.waarde(c, k, I);
  let onder = '', ctl = ctlHtml(c, k, w);
  if(k === 'pickc'){
    const f = I.f, e = R.eigen(c, 'pickc');
    ctl = `<div class="pd2-pick"><div class="locs">${f.pick.length ? f.pick.map(x => `<span class="m">${esc(x.n)} · ${nf(x.v)} · ${x.tijd ? 'tijdelijk' : 'vast'}</span>`).join('') : '<span class="m">geen picklocatie</span>'}</div>${ctl}</div>`;
    if(e && e.opm) onder += `<div class="u kort" title="${esc(e.opm)}">${esc(e.opm)}</div>`;
  }
  if(k === 'hoogte'){ const hw = R.hoogteWaarsch(c, w.v, I); if(hw) onder += `<div class="u kort" title="${esc(hw)}">${esc(hw)}</div>`; }
  { const nc = R.naControle(c, k, I); if(nc) onder += `<div class="pd2-oranje">${esc(nc)}</div>`; }
  onder += verschilHtml(c, k);
  if(w.st === 'uitzoeken') onder += `<div class="rood kort" title="${esc(w.why)}">uitzoeken: ${esc(w.why.split(' (voorstel was')[0])}</div>`;
  else if(w.st === 'leeg' && nodig) onder += `<div class="rood kort" title="${esc(w.why || '')}">ontbreekt${w.why ? ': ' + esc(w.why.split(':')[0]) : ''}</div>`;
  return `<div class="pd2-f${BREED.has(k) ? ' breed' : ''}${k === 'vn' ? ' vnveld' : ''}" data-kc="${k}"><label title="${esc(d.t)}">${esc(KORT[k] || d.kort || d.t)}</label>${ctl}${onder}${vsRegel(k, w)}</div>`;
}
// berekende velden: één grijze regel, geen vakken
function calcRegel(c, ks, I){
  const l = ks.filter(k => R.VELD[k] && R.VELD[k].calc); if(!l.length) return '';
  return `<div class="pd2-calc">${l.map(k => { const d = R.VELD[k], x = R.calc(c, k, I); return `<span data-kc="${k}" title="${esc((x.why || '') + (x.warn ? ' · ' + x.warn : ''))}"><span class="l">${esc(d.kort || d.t)}</span> <b class="cv">${esc(x.v || '–')}</b>${x.uitzoeken ? ' <span class="rood">' + esc(x.warn || 'kan niet') + '</span>' : x.warn ? ' <span class="u">(controleer)</span>' : ''}</span>`; }).join('')}</div>`;
}
const isWegSt = so => so === 'weg';
function veldenVan(c, so, I){
  if(!so || isWegSt(so)) return [];
  let ks = I.sam ? [...R.SAMVELD] : (R.KOLOMMEN[so] || []).slice();
  if(R.waarde(c, 'pickc', I).v === 'geenpick') ks = ks.filter(k => !['lvl', 'maxpick', 'maxcalc', 'aanvmet'].includes(k));
  return ks;
}
function nVoorstellen(c, I){
  const so = R.soortWaarde(c, I); let n = ['voorstel', 'twijfel'].includes(so.st) ? 1 : 0;
  if(so.v === 'weg'){ const w = R.wegWaarde(c, I); return n + (w.st === 'voorstel' ? 1 : 0); }
  if(R.rolVoorstel(c)) n++;
  const ks = new Set(R.nodigVan(c, so.v, I).concat(R.KOLOMMEN[so.v] || []).concat(R.isRol(c) ? R.ROLNODIG : []));
  ks.forEach(k => { if(R.VELD[k] && !R.VELD[k].calc && !(I.sam && !R.SAMVELD.has(k))){ const w = R.waarde(c, k, I); if(isVs(w)) n++; } });
  return n;
}

/* ---------- productkaart (compact: ± 200 px op desktop) ---------- */
function gewHtml(c){
  const g = R.gewicht(c), afw = g.st === 'niet' && !R.isSam(c) ? R.gewAfwijking(c) : '';
  const kn = (v, t) => `<button class="pd2-mini${g.st === v ? ' aan' : ''}" data-a="gewst" data-v="${v}" aria-pressed="${g.st === v}">${t}</button>`;
  const geen = !(g.pq > 0) && !(g.gk > 0);
  return `<div class="pd2-gw"><label class="l" for="pd2-kg-${esc(c)}">Gewicht</label><span class="kg"><input id="pd2-kg-${esc(c)}" class="pd2-in${g.st === 'gewogen' || g.st === 'vertrouwd' ? ' ok' : ''}" data-a="gewkg" value="${g.gk ? esc(String(g.gk)) : ''}" placeholder="${g.pq ? esc(nf(g.pq, 3)) + ' kg' : 'kg'}" inputmode="decimal" autocomplete="off" aria-label="Gewicht per stuk in kg" title="kg per stuk${g.pq ? ', Picqer ' + esc(nf(g.pq, 3)) + ' kg' : ''}"></span>
    <span class="knopjes">${kn('gewogen', 'gewogen')}${kn('vertrouwd', 'vertrouwd')}${kn('tewegen', 'te wegen')}</span>${geen ? '<span class="rood">ontbreekt in Picqer</span>' : afw ? `<span class="u kort" title="${esc(afw)}">afwijkend</span>` : ''}</div>`;
}
function soortHtml(c, I){
  const w = R.soortWaarde(c, I), gekozen = VAST.includes(w.st) ? w.v : '', kies = gekozen || (isVs(w) ? w.v : '');
  let onder = '';
  if(isVs(w)) onder = `<div class="pd2-vr" title="${esc(reden(Object.assign({}, w, { alt:w.alt ? w.alt.map(a => R.SOORTT[a]) : null })))}"><span>voorstel <b>${esc(R.SOORTT[w.v])}</b>${w.st === 'twijfel' ? ' (twijfel)' : ''}</span><button data-a="klopt" data-k="soort">Klopt</button></div>`;
  else if(gekozen && I.vsSo && I.vsSo.v && I.vsSo.v !== gekozen && w.st !== 'vastgelegd') onder = `<div class="pd2-vr grijs" title="${esc(I.vsSo.why || '')}"><span>de data wijst op <b>${esc(R.SOORTT[I.vsSo.v])}</b></span><button class="pd2-mini" data-a="zetsoort" data-v="${I.vsSo.v}">Zet op ${esc(R.SOORTT[I.vsSo.v])}</button></div>`;
  else if(!w.v) onder = '<div class="u">geen voorstel: kies</div>';
  onder += verschilHtml(c, 'soort');
  return `<div class="pd2-soort"><label class="l" for="pd2-so-${esc(c)}">Hoe vul je pick aan?</label><select id="pd2-so-${esc(c)}" class="pd2-in${klasse(w)}" data-k="soort"><option value=""></option>${R.SOORTEN.map(([a]) => `<option value="${a}" ${a === kies ? 'selected' : ''}>${esc(R.SOORTT[a])}</option>`).join('')}</select>${onder}</div>`;
}
function rolHtml(c, I, so){
  if(isWegSt(so) || R.isSam(c)) return '';
  if(R.rolVoorstel(c)) return `<div class="pd2-rolvraag"><span>Is dit een rol?</span><button class="pd2-mini" data-a="rol" data-v="1">ja</button><button class="pd2-mini" data-a="rol" data-v="0">nee</button></div>`;
  if(!R.isRol(c)) return '';
  const nodig = new Set(R.nodigVan(c, so, I)), open = R.ROLNODIG.some(k => nodig.has(k) && !R.ingevuld(R.waarde(c, k, I)));
  const isOpen = UI.rolOpen[c] !== undefined ? UI.rolOpen[c] : open;
  return `<details class="pd2-rol" data-rol="${esc(c)}" ${isOpen ? 'open' : ''}><summary>Rolgegevens${open ? '' : ' ✓'}</summary><div class="pd2-velden">${R.KOLOMMEN.rollen.filter(k => !R.VELD[k].calc).map(k => veldHtml(c, k, I, nodig.has(k))).join('')}</div>${calcRegel(c, R.KOLOMMEN.rollen, I)}</details>`;
}
function wegHtml(c, I){
  const w = R.wegWaarde(c, I), gekozen = VAST.includes(w.st) ? w.v : '', b = R.backorders(c);
  return `<div class="pd2-weg"><span class="knopjes">${R.WEG.map(([k, t]) => `<button class="pd2-mini${gekozen === k ? ' aan' : ''}" data-a="wegkies" data-v="${k}" aria-pressed="${gekozen === k}">${esc(t)}</button>`).join('')}</span>
    ${w.st === 'voorstel' && w.v ? `<div class="pd2-vr" title="${esc(w.why || '')}"><span>voorstel <b>${esc((R.WEG.find(x => x[0] === w.v) || [, w.v])[1])}</b></span><button data-a="klopt" data-k="weg">Klopt</button></div>` : ''}<span class="u">backorders: ${b ? nf(b.n) + ' (' + nf(b.stuks) + ' st)' : 'geen'}</span></div>`;
}
function kaartHtml(c){
  const I = R.info(c), st = R.status(c), so = st.so, sel = UI.sel.has(c), nv = nVoorstellen(c, I);
  const nodig = new Set(R.nodigVan(c, so, I)), ks = veldenVan(c, so, I), invul = ks.filter(k => !R.VELD[k].calc);
  return `<article class="pd2-kaart${sel ? ' sel' : ''}" data-c="${esc(c)}">
    <div class="pd2-kk"><input type="checkbox" data-a="sel" ${sel ? 'checked' : ''} aria-label="Selecteer ${esc(c)}"><div class="kn"><b title="${esc(R.naamVan(c))}">${esc(R.naamVan(c))}</b> <span class="u"><span class="m">${esc(c)}</span> ${abcB(c)}${I.sam ? ' · SAM: alleen pick' : ''}</span></div>
      <div class="ic">${R.rolVoorstel(c) ? rolHtml(c, I, so) : ''}${nv ? `<button class="pd2-mini" data-a="rijklopt" title="Alle voorstellen van dit product kloppen">Alles klopt (${nv})</button>` : ''}<button class="pd2-ic" data-a="info" aria-label="Waarom deze voorstellen" title="Waarom deze voorstellen">ⓘ</button><button class="pd2-ic" data-a="opm" aria-label="Opmerking" title="Opmerking">💬${opmN(c) ? `<sup>${opmN(c)}</sup>` : ''}</button></div></div>
    <div class="pd2-feiten"><span><span class="l">Voorraad</span> ${vrRegel(I)}</span><span><span class="l">Inkoop</span> ${inkRegel(c, I)}</span><span><span class="l">Verkoop</span> ${vkRegel(c)}</span></div>
    <div class="pd2-rij2">${soortHtml(c, I)}${I.sam ? '' : gewHtml(c)}</div>
    ${isWegSt(so) ? wegHtml(c, I) : ''}
    ${R.rolVoorstel(c) ? '' : rolHtml(c, I, so)}
    ${invul.length ? `<div class="pd2-velden">${invul.map(k => veldHtml(c, k, I, nodig.has(k))).join('')}</div>` : ''}
    ${calcRegel(c, ks, I)}
  </article>`;
}
function afRij(c){
  const st = R.status(c), w = st.so === 'weg' ? R.wegWaarde(c).v : '';
  return `<div class="pd2-afrij" data-c="${esc(c)}"><span class="v">✓</span><div class="kn"><b>${esc(R.naamVan(c))}</b> <span class="u"><span class="m">${esc(c)}</span> · ${esc(R.SOORTT[st.so] || '')}${w ? ' · ' + esc(w) : ''}${R.isRol(c) ? ' · rol' : ''}${st.gew.st === 'tewegen' ? ' · ⚖ te wegen' : ''}</span></div>
    <button class="pd2-mini" data-a="${st.so === 'weg' ? 'wegterug' : 'heropen'}">${st.so === 'weg' ? 'terugzetten' : 'heropenen'}</button></div>`;
}

/* ---------- scherm 1: start ---------- */
function filterN(){ return [UI.lev, UI.afd, UI.hal, UI.abc].filter(Boolean).length + (UI.scope !== 'belangrijk' ? 1 : 0); }
function filtersHtml(){
  const cs = basisCodes('lev'), levs = [...new Set(cs.map(c => String((D.P[R.koppelVan(c) || c] || {}).leverancier || '')).filter(Boolean))].sort();
  const all = basisCodes(), gangen = [...new Set(all.map(gangVan).filter(Boolean))].sort(), hallen = [...new Set(gangen.map(g => g.slice(0, 1)))].sort();
  return `<div class="pd2-filters"><div class="pd2-seg klein" role="group" aria-label="Welke producten">${SCOPES.map(([k, t]) => `<button data-a="scope" data-v="${k}" class="${UI.scope === k && !UI.zoek ? 'aan' : ''}">${esc(t)}</button>`).join('')}</div>
    <div class="pd2-selrij"><select class="pd2-in" data-f="lev" aria-label="Leverancier"><option value="">Alle leveranciers</option>${levs.concat(UI.lev && !levs.includes(UI.lev) ? [UI.lev] : []).map(l => `<option ${l === UI.lev ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    <select class="pd2-in" data-f="afd" aria-label="Afdeling"><option value="">Alle afdelingen</option>${gangen.concat(UI.afd && !gangen.includes(UI.afd) ? [UI.afd] : []).map(g => `<option ${g === UI.afd ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
    <select class="pd2-in" data-f="hal" aria-label="Hal"><option value="">Alle hallen</option>${hallen.concat(UI.hal && !hallen.includes(UI.hal) ? [UI.hal] : []).map(h => `<option value="${esc(h)}" ${h === UI.hal ? 'selected' : ''}>Hal ${esc(h)}</option>`).join('')}</select>
    <select class="pd2-in" data-f="abc" aria-label="ABC"><option value="">ABC: alle</option>${['A', 'B', 'C', '–'].map(a => `<option ${a === UI.abc ? 'selected' : ''}>${a}</option>`).join('')}</select></div></div>`;
}
function famRijen(){
  const L = families(), toon = L.slice(0, UI.famN);
  if(!L.length) return '<div class="pd2-leeg">Geen families met deze zoekopdracht of filters.</div>';
  return toon.map(f => `<button class="pd2-fam${f.af === f.n ? ' klaar' : ''}" data-a="fam" data-v="${esc(f.fk)}"><span class="kn"><b>${esc(f.naam)}</b><span class="u">${esc(f.lev)} · ${mv(f.n, 'product', 'producten')} · ${mv(f.maten, 'maat', 'maten')}</span></span><span class="n">${f.af === f.n ? '<span class="v">✓ klaar</span>' : nf(f.open) + ' open'}</span></button>`).join('')
    + (L.length > toon.length ? `<button class="knop pd2-meer" data-a="fammeer">Meer families (${nf(L.length - toon.length)})</button>` : '');
}
function startHtml(){
  const L = families(), klaar = L.filter(f => f.af === f.n).length, fn = filterN(), sn = snapTxt();
  return `<header class="pd2-kop"><h1>Productdata 2.0${UI.oefenen ? ' <i class="st grijs">oefenen</i>' : ''}</h1><p class="u" id="pd2-klaar">${nf(klaar)} van ${nf(L.length)} families klaar${sn ? ' · ' + esc(sn) : ''}${R.S.bewaar.fout ? ' · <b class="rood">bewaren mislukt</b>' : ''}${R.PDQ.fout ? ' · <b class="rood">naar productdata schrijven mislukt, opnieuw over 8 s</b>' : ''}</p></header>
    <button class="knop pd2-hoofd" data-a="volgfam">Volgende familie →</button>
    <div class="pd2-zoekrij"><input type="search" id="pd2-zoek" class="pd2-in" placeholder="Zoek familie, code, naam of locatie" value="${esc(UI.zoek)}" aria-label="Zoeken" autocomplete="off"><button class="knop${UI.filterOpen ? ' aan' : ''}" data-a="filter" aria-expanded="${UI.filterOpen}">Filter${fn ? ' (' + fn + ')' : ''}</button></div>
    ${UI.filterOpen ? filtersHtml() : ''}
    <div class="pd2-famlijst" id="pd2-fams">${famRijen()}</div>
    <nav class="pd2-voet" aria-label="Meer"><button class="pd2-link" data-a="view" data-v="weeg">Weeglijst (${nf(weegCodes().length)})</button><span>·</span><button class="pd2-link" data-a="view" data-v="aann">Aannames (${nf(Object.keys(R.AANNAMES).length)})</button><span>·</span><button class="pd2-link" data-a="view" data-v="rolcheck">Rollen controleren (${nf(R.rolCheck().filter(x => x.g.st === 'niet').length)})</button><span>·</span><button class="pd2-link" data-a="view" data-v="labels">Palletlabels om te verbeteren (${nf(R.labelsVerbeteren().length)})</button><span>·</span><button class="pd2-link" data-a="oefmenu">Oefenmodus ⋯</button></nav>`;
}

/* ---------- scherm 2: familie (desktop: links kop en maten, rechts de kaarten; telefoon: onder elkaar) ---------- */
// elke maat maar 1 product: geen maatstap, alle kaarten onder elkaar (maten = inhoudsopgave)
const plat = () => !!UI.fk && !UI.view && maatgroepen().length > 1 && maatgroepen().every(m => m.cs.length === 1);
function famKop(){
  const cs = famEcht(UI.fk), st = cs.map(R.status), af = st.filter(s => s.af).length, pct = cs.length ? Math.round(af / cs.length * 100) : 0;
  const abc = { A:0, B:0, C:0 }; cs.forEach(c => { const a = R.abcVan(c); if(abc[a] !== undefined) abc[a]++; });
  const v6 = cs.reduce((s, c) => s + R.vk6(c), 0), v28 = cs.reduce((s, c) => s + (R.vk28(c) || 0), 0);
  const inkm = {}; cs.forEach(c => R.inkomend(c).forEach(x => { const k = x.ref + '|' + x.eta; inkm[k] = inkm[k] || { ref:x.ref, eta:x.eta }; }));
  const ink = Object.values(inkm).sort((a, b) => String(a.eta).localeCompare(String(b.eta)));
  const at = {}; cs.forEach(c => aandachtVan(c).forEach(a => { at[a] = (at[a] || 0) + 1; }));
  const top = AAND.map(([k]) => k).filter(k => at[k]).sort((a, b) => at[b] - at[a]).slice(0, 3);
  if(UI.aandacht && !top.includes(UI.aandacht)) top.push(UI.aandacht);
  const lev = String((D.P[cs[0]] || {}).leverancier || UI.fk.split('|')[0]), maten = new Set(cs.map(R.maatVan)).size, kop = famAlle(UI.fk).length - cs.length;
  return `<div class="kn"><h2>${esc(R.famNaam(UI.fk))}</h2><div class="u">${esc(lev)} · ${mv(cs.length, 'product', 'producten')} · ${mv(maten, 'maat', 'maten')}${kop ? ' · ' + mv(kop, 'gekoppeld product', 'gekoppelde producten') + ' (niet invullen)' : ''}</div>
      <div class="u">Verkoop ${nf(v6)}*6 / ${nf(v28)}*28 · ABC A ${abc.A} · B ${abc.B} · C ${abc.C}${ink.length ? ' · inkomend ' + esc(ink.slice(0, 2).map(x => x.ref + (x.eta ? ' (ETA ' + dk(x.eta) + ')' : '')).join(', ')) + (ink.length > 2 ? ' +' + (ink.length - 2) : '') : ''}</div></div>
    <div class="pd2-vg"><span class="balk"><i style="width:${pct}%"></i></span><span>${nf(af)} van ${nf(cs.length)} afgerond</span></div>
    ${top.length ? `<div class="pd2-aand">${top.map(k => `<button class="pd2-link${UI.aandacht === k ? ' aan' : ''}" data-a="aandacht" data-v="${k}">${esc(aandTekst(k, at[k] || 0))}</button>`).join('')}${UI.aandacht ? '<button class="pd2-link" data-a="aandacht" data-v="">× alles tonen</button>' : ''}</div>` : ''}
    <div class="u" id="pd2-live">${liveRegel(blokCodes())}</div>`;
}
function matenHtml(){
  const M = maatgroepen(), p = plat();
  return M.map(m => p
    ? `<button class="pd2-maat${m.open ? '' : ' af'}" data-a="naar" data-c="${esc(m.cs[0])}">${esc(m.t)}<span class="n">${m.open ? nf(m.velden) + ' open' : '✓'}</span></button>`
    : `<button class="pd2-maat${!UI.aandacht && m.k === UI.mk ? ' aan' : ''}${m.open ? '' : ' af'}" data-a="maat" data-v="${esc(m.k)}" aria-pressed="${!UI.aandacht && m.k === UI.mk}">${esc(m.t)}<span class="n">${m.cs.length > 1 ? mv(m.cs.length, 'kleur', 'kleuren') + ' · ' : ''}${m.open ? nf(m.velden) + ' open' : '✓'}</span></button>`).join('');
}
const volgHtml = () => `${!plat() && !UI.aandacht && maatgroepen().length > 1 ? '<button class="knop pd2-hoofd" data-a="volgmaat">Volgende maat →</button>' : ''}<button class="knop" data-a="volgfam">Volgende familie →</button>`;
function segHtml(){
  const cs = openCodes(), n = { open:cs.length }; cs.forEach(c => { const s = segVan(c); n[s] = (n[s] || 0) + 1; });
  const kaarten = kaartCodes(), alle = kaarten.length && kaarten.every(c => UI.sel.has(c));
  return `<div class="pd2-segrij"><div class="pd2-seg" role="tablist" aria-label="Soort">${SEGS.filter(([k]) => k === 'open' || n[k] || UI.seg === k).map(([k, t]) => `<button role="tab" data-a="seg" data-v="${k}" class="${UI.seg === k ? 'aan' : ''}" aria-selected="${UI.seg === k}">${esc(t)} <span class="n">${nf(n[k] || 0)}</span></button>`).join('')}</div>
    ${kaarten.length ? `<label class="pd2-alle"><input type="checkbox" data-a="selalle" ${alle ? 'checked' : ''}> alles aanvinken</label>` : ''}</div>`;
}
function mixRegels(cs){
  const per = {}; cs.forEach(c => { const v = R.waarde(c, 'mixgroep').v; if(v) (per[v] = per[v] || []).push(c); });
  const g = Object.entries(per); if(!g.length) return '';
  return `<div class="pd2-mg">${g.map(([m, l]) => `<button class="pd2-link" data-a="mgregel" data-v="${esc(m)}">Mixgroep ${esc(m)} · ${mv(l.length, 'lid', 'leden')}</button>`).join('')}</div>`;
}
function wegAlleRegel(){
  const wa = {}; Object.keys(wegAlle()).forEach(c => { if(!(R.po(c) && (R.po(c).weg || R.po(c).so))) wa[wegAlle()[c]] = (wa[wegAlle()[c]] || 0) + 1; });
  return `<div class="pd2-wegalle"><span class="u">Ook buiten deze familie:</span>${R.WEG.map(([k, t]) => `<button class="pd2-link" data-a="wegalle" data-v="${k}">alle voorstellen ${esc(t)} (${nf(wa[k] || 0)})</button>`).join('')}</div>`;
}
const UITLEG = [['Pallet', 'komt per volle pallet binnen en wordt per volle pallet aangevuld.'], ['Deel', 'komt op een pallet of in grotere hoeveelheid binnen dan op pick past; een deel gaat naar pick, de rest naar bulk.'], ['Pick', 'komt in kleine aantallen binnen en past helemaal op de pickplek, geen bulk.'], ['Mix', 'een pallet met meerdere producten erop; aanvullen met een deel van de mixpallet.'], ['Weg', 'uitlopend, alleen backorder of archief: geen velden, alleen de keuze.']];
function maatBlok(){
  const M = maatgroepen(), g = M.find(m => m.k === UI.mk), cs = kaartCodes(), af = afCodes(), toon = cs.slice(0, UI.n), p = plat();
  const titel = UI.view === 'wegalle' ? 'Alle voorstellen ' + ((R.WEG.find(x => x[0] === UI.wegAlle) || [, ''])[1]) : UI.aandacht ? aandTekst(UI.aandacht, blokCodes().length) : p ? 'Alle producten' : g ? g.t : 'zonder maat';
  const wat = UI.aandacht || UI.view ? 'lijst' : p ? 'familie' : 'maat';
  const kg = (() => { const v = blokCodes().map(c => R.gewicht(c).pq).filter(x => x > 0).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; })();
  return `<div class="pd2-mkop"><h3>${esc(titel)} <span class="u">${UI.view === 'wegalle' ? mv(blokCodes().length, 'product', 'producten') + ', ook buiten de familie' : p ? 'op maat, ' + mv(blokCodes().length, 'product', 'producten') : mv(blokCodes().length, 'kleur', 'kleuren')}</span></h3>
      <div class="rij">${openCodes().length ? `<button class="knop" data-a="maatklopt">Alle voorstellen in deze ${wat} kloppen</button>` : ''}</div></div>
    ${UI.view === 'wegalle' ? '' : `<div class="pd2-segbalk">${segHtml()}<div class="pd2-inklap"><details class="pd2-uitleg"><summary>uitleg per soort</summary><ul>${UITLEG.map(([a, b]) => `<li><b>${a}</b>: ${esc(b)}</li>`).join('')}</ul></details>
    ${p ? '' : `<details class="pd2-zelfdekg"><summary>Gewicht voor de hele maat</summary><div class="pd2-zk"><input id="pd2-kgmaat" class="pd2-in" inputmode="decimal" placeholder="${kg ? esc(nf(kg, 3)) + ' (Picqer, midden)' : 'kg per stuk'}" autocomplete="off" aria-label="Gewicht per stuk voor de hele maat"><label class="pd2-vink"><input type="checkbox" id="pd2-kgmaat-gew"> gewogen</label><button class="knop" data-a="zelfdekg">Zelfde gewicht voor alle kleuren in deze maat</button></div><div class="u">Alleen producten zonder gecontroleerd gewicht krijgen het.</div></details>`}</div></div>`}
    ${UI.seg === 'mix' ? mixRegels(blokCodes()) : ''}${UI.seg === 'weg' && !UI.view ? wegAlleRegel() : ''}
    <div class="pd2-kaarten" id="pd2-kaarten">${toon.map(kaartHtml).join('') || `<div class="pd2-leeg">${cs.length || openCodes().length ? 'Niets open in deze soort.' : 'Alles in deze ' + wat + ' is afgerond.'}</div>`}</div>
    ${cs.length > toon.length ? `<button class="knop pd2-meer" data-a="meer">Meer tonen (${nf(cs.length - toon.length)})</button>` : ''}
    ${af.length ? `<details class="pd2-af" ${UI.afOpen ? 'open' : ''}><summary>Afgerond (${nf(af.length)})</summary>${af.map(afRij).join('')}</details>` : ''}
    ${!p && !UI.aandacht && !UI.view && M.length > 1 ? '<div class="pd2-onder"><button class="knop pd2-hoofd" data-a="volgmaat">Volgende maat →</button></div>' : ''}`;
}
function famHtml(){
  kiesMaat();
  return `<button class="pd2-link pd2-terug" data-a="famweg">← Alle families</button>
    <div class="pd2-famgrid"><aside class="pd2-zij"><section class="pd2-blok pd2-fkop" id="pd2-fkop">${famKop()}</section>
      <nav class="pd2-maten${plat() ? ' toc' : ''}" id="pd2-maten" aria-label="${plat() ? 'Inhoud' : 'Maat'}">${matenHtml()}</nav>
      <div class="pd2-volg" id="pd2-volg">${volgHtml()}</div></aside>
    <section class="pd2-blok pd2-maatblok" id="pd2-maat">${maatBlok()}</section></div>`;
}
function wegAlleHtml(){
  return `<button class="pd2-link pd2-terug" data-a="viewweg">← Terug</button><section class="pd2-blok pd2-maatblok" id="pd2-maat">${maatBlok()}</section>`;
}

/* ---------- weeglijst (eigen scherm, per hal, gang en locatie; printbaar) ---------- */
const REACH = 'Volle pallets wegen met de reachtruck (palletgewicht − 15 kg pallet, gedeeld door stuks per pallet); losse producten op de weegschaal.';
function weegGroepen(){
  const cs = [...new Set(weegCodes().concat([...UI.weegKlaar]))].filter(c => D.P[c]);
  const loc = c => { const f = R.info(c).f; return (f.pick[0] || f.bulk[0] || { n:'' }).n; };
  const per = {};
  cs.forEach(c => { const l = loc(c) || '', hal = /^[A-Z]{2}/i.test(l) ? 'Hal ' + l[0].toUpperCase() : 'Zonder locatie', gang = /^[A-Z]{2}/i.test(l) ? l.slice(0, 2).toUpperCase() : '–'; (((per[hal] = per[hal] || {})[gang] = per[hal][gang] || {})[l || '–'] = per[hal][gang][l || '–'] || []).push(c); });
  return per;
}
function weegWijze(c){ const st = R.status(c), spp = R.nOf(R.waarde(c, 'spp').v); return ['pallet', 'deel'].includes(st.so) && spp > 0 ? { reach:true, spp } : { reach:false }; }
function weegHtml(){
  const per = weegGroepen(), hallen = Object.keys(per).sort();
  return `<button class="pd2-link pd2-terug" data-a="viewweg">← Alle families</button>
    <section class="pd2-blok pd2-wl"><div class="pd2-mkop"><h2>Weeglijst</h2>${hallen.length ? '<button class="knop" data-a="weegprint">Print weeglijst (A4)</button>' : ''}</div>
    <details class="pd2-uitleg"><summary>hoe wegen</summary><p>${esc(REACH)}</p></details>
    ${!hallen.length ? '<div class="pd2-leeg">Geen producten op "te wegen". Zet een product op te wegen met het knopje bij Gewicht.</div>' : hallen.map(h => `<h3>${esc(h)}</h3>${Object.keys(per[h]).sort().map(g => `<h4>Gang ${esc(g)}</h4>${Object.keys(per[h][g]).sort().map(l => {
      const cs = per[h][g][l], klaar = cs.filter(c => R.gewicht(c).st !== 'tewegen').length;
      return `<div class="pd2-wloc"><b class="m">${esc(l)}</b> <span class="u">${mv(cs.length, 'product', 'producten')} · ${klaar === cs.length ? '<span class="v">locatie klaar ✓</span>' : nf(klaar) + ' van ' + nf(cs.length) + ' klaar'}</span></div>` + cs.map(c => {
        const gw = R.gewicht(c), w = weegWijze(c), af = gw.st !== 'tewegen';
        return `<div class="pd2-wrij${af ? ' af' : ''}" data-c="${esc(c)}"><div class="kn"><b>${esc(R.naamVan(c))}</b><div class="u"><span class="m">${esc(c)}</span> · ${w.reach ? 'reachtruck ÷ ' + nf(w.spp) : 'weegschaal'}${gw.pq ? ' · Picqer ' + esc(kgTxt(gw.pq)) : ''}</div></div>
          <div class="in">${af ? `<span class="v">✓ ${esc(nf(gw.kg, 3))} kg${gw.via ? ' (pallet ' + nf(gw.pallet) + ' kg)' : ''}</span>` : `<input class="pd2-in" data-a="gewogen" inputmode="decimal" placeholder="kg per stuk" aria-label="Gewogen kg per stuk ${esc(c)}">${w.reach ? `<input class="pd2-in" data-a="palletkg" inputmode="decimal" placeholder="kg pallet" aria-label="Palletgewicht ${esc(c)}">` : ''}`}</div></div>`; }).join(''); }).join('')}`).join('')}`).join('')}</section>`;
}
function weegPrint(){
  const per = weegGroepen(), d = new Date();
  let vak = document.getElementById('pd2-printvak'); if(!vak){ vak = document.createElement('div'); vak.id = 'pd2-printvak'; document.body.appendChild(vak); }
  vak.innerHTML = `<h1>Weeglijst · ${esc(d.toLocaleDateString('nl-NL'))}</h1><p><b>Reachtruck-regel:</b> ${esc(REACH)}</p>
    ${Object.keys(per).sort().map(h => `<h2>${esc(h)}</h2>${Object.keys(per[h]).sort().map(g => `<h3>Gang ${esc(g)}</h3><table><thead><tr><th>Locatie</th><th>Code</th><th>Product</th><th>Wegen</th><th>Picqer kg</th><th>Gewogen kg</th><th>Pallet kg</th></tr></thead><tbody>
      ${Object.keys(per[h][g]).sort().map(l => per[h][g][l].filter(c => R.gewicht(c).st === 'tewegen').map(c => { const w = weegWijze(c), gw = R.gewicht(c); return `<tr><td>${esc(l)}</td><td>${esc(c)}</td><td>${esc(R.naamVan(c).slice(0, 60))}</td><td>${w.reach ? 'reachtruck ÷ ' + nf(w.spp) : 'weegschaal'}</td><td>${gw.pq ? nf(gw.pq, 3) : ''}</td><td class="vak"></td><td class="vak">${w.reach ? '' : '—'}</td></tr>`; }).join('')).join('')}
    </tbody></table>`).join('')}`).join('')}`;
  document.documentElement.classList.add('pd2-print');
  const klaar = () => { document.documentElement.classList.remove('pd2-print'); window.removeEventListener('afterprint', klaar); };
  window.addEventListener('afterprint', klaar);
  setTimeout(() => { try{ window.print(); }catch(e){} setTimeout(klaar, 1500); }, 50);
}

/* ---------- rollen controleren: alle rollen met berekende gegevens, per rol gewicht klopt of moet gewogen ---------- */
const RCF = [['open', 'Nog te checken'], ['afw', 'Afwijkend'], ['mist', 'Onvolledig'], ['alle', 'Alle']];
const rcGoed = x => x.g.st === 'niet' && x.dicht && !x.afw && x.g.pq > 0;
const rcOpen = x => x.g.st === 'niet';
function rcRij(x){
  const st = x.g.st, kn = (v, t) => `<button class="pd2-mini${st === v ? ' aan' : ''}" data-a="gewst" data-v="${v}" aria-pressed="${st === v}">${t}</button>`;
  const maat = [x.B ? nf(x.B) + ' cm breed' : 'breedte ?', x.d ? nf(x.d, 1) + ' mm' : 'dikte ?', x.L ? nf(x.L, 1) + ' m' : 'lengte ?'].join(' · ');
  const kg = x.kgm ? nf(x.kgm, x.kgm < 10 ? 2 : 1) + ' kg/m' : '', rol = [x.dia ? 'Ø ' + x.dia + ' cm' : '', x.kgrol ? nf(+x.kgrol, 1) + ' kg per rol' : ''].filter(Boolean).join(' · ');
  return `<div class="pd2-rc${x.afw ? ' afw' : ''}${rcOpen(x) ? '' : ' af'}" data-c="${esc(x.c)}"><div class="kn"><b>${esc(R.naamVan(x.c))}</b><div class="u"><span class="m">${esc(x.c)}</span> · ${esc(maat)}${rol ? ' · ' + esc(rol) : ''}</div>
    <div class="u">${x.g.pq > 0 ? 'Picqer ' + esc(kgTxt(x.g.pq)) + ' per ' + esc(x.e === 'm' ? 'meter' : x.e === 'cm' ? 'cm' : 'rol') : ''}${kg ? ' · ' + esc(kg) : ''}${x.dicht ? ' · ' + esc(nf(x.dicht, 2)) + ' kg per m² per mm' : ''}${x.afw ? ` · <span class="pd2-oranje">${esc(x.afw)}</span>` : x.mist ? ` · <i>${esc(x.mist)}</i>` : ''}</div></div>
    <div class="knopjes">${kn('vertrouwd', 'klopt')}${kn('tewegen', 'moet gewogen')}${st === 'gewogen' ? `<span class="v">gewogen ${esc(kgTxt(x.g.kg))}</span>` : ''}</div></div>`;
}
function rolCheckHtml(){
  const l = R.rolCheck(), f = UI.rcFilter || 'open', tel = { open:l.filter(rcOpen).length, afw:l.filter(x => x.afw && rcOpen(x)).length, mist:l.filter(x => x.mist && rcOpen(x)).length, alle:l.length };
  const zicht = l.filter(x => f === 'alle' || rcOpen(x) && (f === 'open' || x[f])), per = {};
  zicht.forEach(x => { ((per[x.lev || 'zonder leverancier'] = per[x.lev || 'zonder leverancier'] || {})[x.fam] = per[x.lev || 'zonder leverancier'][x.fam] || []).push(x); });
  return `<button class="pd2-link pd2-terug" data-a="viewweg">← Alle families</button>
    <section class="pd2-blok pd2-rcl"><h2>Rollen controleren (${nf(l.length)})</h2>
    <p class="u">Alle rollen met breedte, dikte, lengte, diameter (koker 10 cm) en kg per rol. Per rol: klopt het gewicht (Picqer-kg vastgelegd) of moet hij gewogen worden (komt op de Weeglijst). Afwijkend = kg per m² per mm wijkt > 20% af van de familie (of is ongewoon); Onvolledig = zonder breedte, dikte of gewicht niet te toetsen.</p>
    <div class="pd2-rcf" role="tablist">${RCF.map(([k, t]) => `<button class="pd2-mini${f === k ? ' aan' : ''}" data-a="rcfilter" data-v="${k}" role="tab" aria-selected="${f === k}">${esc(t)} (${nf(tel[k])})</button>`).join('')}</div>
    ${!zicht.length ? '<div class="pd2-leeg">Niets meer te checken.</div>' : Object.keys(per).sort().map(lv => `<h3>${esc(lv)}</h3>${Object.keys(per[lv]).sort().map(fk => { const xs = per[lv][fk].sort((a, b) => !!b.afw - !!a.afw || !!b.mist - !!a.mist || R.naamVan(a.c).localeCompare(R.naamVan(b.c))), rest = xs.filter(rcGoed).length;
      return `<div class="pd2-rcfam"><h4>${esc(R.famNaam(fk))} <span class="u">${mv(xs.length, 'rol', 'rollen')}${xs[0].famDicht ? ' · familie ' + nf(xs[0].famDicht, 2) + ' kg per m² per mm' : ''}</span>${rest ? ` <button class="pd2-mini" data-a="rcfam" data-f="${esc(fk)}">${rest === xs.length ? 'Alle' : 'Getoetst zonder afwijking'} klopt (${nf(rest)})</button>` : ''}</h4>${xs.map(rcRij).join('')}</div>`; }).join('')}`).join('')}</section>`;
}

/* ---------- aannames (één lijst) en scores ---------- */
// palletlabels waarvan de naam een andere productcode is: niet gebruikt als voorstel, hier om te verbeteren (in Palletlabels)
function labelsHtml(){
  const l = R.labelsVerbeteren();
  return `<button class="pd2-link pd2-terug" data-a="viewweg">← Alle families</button>
    <section class="pd2-blok"><h2>Palletlabels om te verbeteren (${nf(l.length)})</h2><p class="u">Het label staat bij het ene product maar heeft de naam van een andere productcode (bijv. label van 100150WM heet "100200WM"). 2.0 gebruikt zo'n label niet voor stuks per pallet of vloernaam. Verbeteren doe je in Palletlabels.</p>
    <div class="pd2-aannlijst">${l.map(x => `<div class="pd2-aannrij"><p><b class="m">${esc(x.c)}</b> ${esc(R.naamVan(x.c))}</p><p class="u">label heet "${esc(x.naam)}" (= ${esc(x.ander)})${x.qty ? ' · aantal ' + esc(x.qty) : ''}</p></div>`).join('') || '<div class="pd2-leeg">Geen verkeerde labels gevonden.</div>'}</div></section>`;
}
function aannHtml(){
  const ids = Object.keys(R.AANNAMES), af = ids.filter(i => R.S.fb.aann[i] && R.S.fb.aann[i].v === 'nee').length;
  return `<button class="pd2-link pd2-terug" data-a="viewweg">← Alle families</button>
    <section class="pd2-blok"><h2>Aannames (${ids.length})</h2><p class="u">Keuzes die 2.0 zelf maakt en die niet in het ontwerp stonden. ${nf(af)} afgekeurd.</p>
    <div class="pd2-aannlijst">${ids.map(i => { const a = R.S.fb.aann[i] || {}; return `<div class="pd2-aannrij" data-id="${i}"><p>${esc(R.AANNAMES[i])}${a.opm ? ` <span class="u">— ${esc(a.opm)}</span>` : ''}</p>
      <div class="knopjes"><button class="pd2-mini${a.v === 'ja' ? ' aan ok' : ''}" data-a="aannv" data-v="ja">klopt</button><button class="pd2-mini${a.v === 'nee' ? ' aan nee' : ''}" data-a="aannv" data-v="nee">keur af</button><button class="pd2-link" data-a="aanname" data-id="${i}">opmerking</button></div></div>`; }).join('')}</div></section>`;
}
const RNAAM = { genoot:'kleurgenoot (2.0 of productdata)', 'leer-fammaat':'geleerd: kleurgenoten', 'leer-fam':'geleerd: familie', 'leer-levmaat':'geleerd: leverancier + maat', 'leer-lev':'geleerd: leverancier', picqer:'huidige stand Picqer', aanvulbase:'aanvulbase', regel:'aanvulregel', wandrek:'regel wandrekken', inkoop:'meest voorkomende inkoop', vst:'verplaatst naar VST', vst2:'≥ 2 VST-pallets gelijk', bulk2:'≥ 2 bulkpallets gelijk', label:'palletlabel', code:'alleen de code', som:'stuks × kg + 15', afm:'afmetingen per stuk' };
const rNaam = r => { const [k, x] = String(r).split(':'); if(/^soort$/.test(k)) return 'soortregel ' + x; return RNAAM[x] || (x || '').replace(/^pd-[a-z]+:/, 'productdata.js: ').replace('+doos', ' + hele dozen'); };
const pctS = (a, b) => b ? Math.round(a / b * 100) + '%' : '–';
const scoreTxt = w => { if(!w || !['voorstel', 'twijfel'].includes(w.st)) return ''; const sc = w.sc || R.scoreVan(w.r); return sc ? ` · dit soort voorstel klopte ${Math.round(sc.p * 100)}% bij jouw eigen invoer (${nf(sc.n)}× getoetst)` : (w.r ? ' · nog te weinig getoetst' : ''); };
function scoresHtml(){
  const M = R.meting(), V = R.SCORE_VOOR, T = R.TOETSVELD;
  const perVeld = {}; Object.entries(M.regels || {}).forEach(([r, g]) => { const k = r.split(':')[0]; const kk = { soort:'opslag', max:'maxpick', kg:'kgst', gewpal:'gewicht' }[k] || k; (perVeld[kk] = perVeld[kk] || []).push([r, g]); });
  return `<button class="pd2-link pd2-terug" data-a="viewweg">← Alle families</button>
    <section class="pd2-blok" id="pd2-scores"><h2>Hoe goed zijn de voorstellen</h2>
    <p class="u">Getoetst tegen alle waarden die jij zelf in productdata vastlegde (${nf(M.n)} waarden): per waarde doet 2.0 alsof hij er niet is en vergelijkt het voorstel. Exact gelijk telt; hoogte binnen 10 cm, gewicht binnen 10%. Meting ${esc(M.op ? String(M.op).slice(0, 10) : '')}.</p>
    <div class="pd2-scorelijst">${Object.keys(T).map(k => { const v = M.velden[k] || { tot:0, met:0, goed:0 }, o = V.velden[k] || { tot:0, goed:0 }; return `<div class="pd2-scorerij"><b>${esc(T[k])}</b><span><b>${pctS(v.goed, v.tot)}</b> <span class="u">(ronde 1 ${pctS(o.goed, o.tot)}) · ${nf(v.tot)} getoetst · voorstel bij ${pctS(v.met, v.tot)} · klopt als er een voorstel is ${pctS(v.goed, v.met)}</span></span></div>`; }).join('')}</div>
    <details class="pd2-uitleg"><summary>per regel</summary><div class="pd2-scorelijst">${Object.entries(perVeld).map(([k, l]) => l.sort((a, b) => b[1].tot - a[1].tot).map(([r, g]) => `<div class="pd2-scorerij"><span>${esc((T[k] || k) + ' · ' + rNaam(r))}</span><span>${pctS(g.goed, g.tot)} <span class="u">van ${nf(g.tot)}${g.tot >= 5 && g.goed / g.tot < 0.6 ? ' · twijfel' : ''}</span></span></div>`).join('')).join('')}</div></details>
    <div class="rij"><button class="knop" data-a="meet">Meet opnieuw op dit apparaat</button><span class="u" id="pd2-meetst"></span></div></section>`;
}

/* ---------- groepsacties (alleen als er iets is aangevinkt) ---------- */
function actieHtml(){
  if(!UI.sel.size) return '';
  const cs = selLijst(), ks = [...new Set(cs.flatMap(c => { const so = R.status(c).so; return (R.NODIG[so] || []).concat(R.isRol(c) ? R.ROLNODIG : []); }))].filter(k => R.VELD[k] && !R.VELD[k].calc && k !== 'pickc');
  return `<div class="pd2-actie" role="toolbar" aria-label="Groepsacties"><b>${nf(UI.sel.size)} aangevinkt</b><button class="knop pd2-x" data-a="selweg" aria-label="Niets meer aanvinken">×</button>
    <button class="knop pd2-hoofd" data-a="selklopt">Selectie klopt</button>
    <select class="knop" data-a2="allemaal" aria-label="Zijn allemaal"><option value="">Zijn allemaal…</option>${R.SOORTEN.map(([k]) => `<option value="${k}">${esc(R.SOORTT[k])}</option>`).join('')}</select>
    <select class="knop" data-a2="gewicht" aria-label="Gewicht"><option value="">Gewicht…</option><option value="klopt">kloppen</option><option value="pop">aanpassen…</option></select>
    <button class="knop" data-a="isrol">Is rol</button>
    <select class="knop" data-a2="zelfde" aria-label="Zelfde waarde"><option value="">Zelfde waarde…</option>${ks.map(k => `<option value="${k}">${esc(R.VELD[k].t)}</option>`).join('')}</select>
</div>`;
}

/* ---------- oefenen: één zwevend kaartje ---------- */
function oefKaart(){
  if(!UI.oefenen) return '';
  const s = UI.oef.set in OPDR ? UI.oef.set : 'pallet', l = OPDR[s], done = R.S.o.oef[s] || {};
  const kies = `<select class="pd2-mini" data-a2="oefset" aria-label="Oefenset">${TABS.map(([k, t]) => `<option value="${k}" ${k === s ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  if(UI.oef.i >= l.length){
    const fb = R.S.fb.tabs[s] || {};
    return `<div class="pd2-oefkaart" role="dialog" aria-label="Oefenen"><div class="pd2-okop"><b>Vragen over ${esc(TABT[s])}</b>${kies}<button class="pd2-ic" data-a="oefuit" aria-label="Oefenen uit">×</button></div>
      <div class="pd2-vragen" data-tab="${s}"><div><span class="l">Layout</span> ${['klopt', 'bijna', 'nee'].map(v => `<button class="pd2-mini${fb.layout === v ? ' aan' : ''}" data-a="fb" data-k="layout" data-v="${v}">${v}</button>`).join('')}</div>
      <label>Wat mis je?<textarea id="pd2-fb-mis" data-fb="mis">${esc(fb.mis || '')}</textarea></label><label>Wat is overbodig?<textarea id="pd2-fb-over" data-fb="over">${esc(fb.over || '')}</textarea></label>
      <div><span class="l">Gevoel</span> ${[1, 2, 3, 4, 5].map(v => `<button class="pd2-mini${+fb.gevoel === v ? ' aan' : ''}" data-a="fb" data-k="gevoel" data-v="${v}">${v}</button>`).join('')}</div></div>
      <div class="rij"><button class="knop" data-a="oefvolgset">Volgende soort →</button></div></div>`;
  }
  const o = l[UI.oef.i];
  return `<div class="pd2-oefkaart" role="dialog" aria-label="Oefenen"><div class="pd2-okop"><b>Oefenen</b>${kies}<button class="pd2-ic" data-a="oefuit" aria-label="Oefenen uit">×</button></div>
    <p>${done[o.id] ? '<span class="v">✓</span> ' : ''}Opdracht ${UI.oef.i + 1} van ${l.length}: ${esc(o.t)}</p>
    <div class="rij">${o.toon ? `<button class="knop" data-a="toon" data-id="${o.id}">Toon</button>` : ''}<button class="knop" data-a="oefvolg">Volgende</button></div></div>`;
}
const oefBewaar = () => lsZet('oef', JSON.stringify(UI.oef));

/* ---------- tekenen ---------- */
function schermHtml(){
  if(UI.view === 'weeg') return ['weeg', weegHtml()];
  if(UI.view === 'aann') return ['aann', aannHtml()];
  if(UI.view === 'labels') return ['labels', labelsHtml()];
  if(UI.view === 'rolcheck') return ['rolcheck', rolCheckHtml()];
  if(UI.view === 'scores') return ['scores', scoresHtml()];
  if(UI.view === 'wegalle') return ['wegalle', wegAlleHtml()];
  if(UI.fk && famEcht(UI.fk).length) return ['fam', famHtml()];
  UI.fk = null;
  return ['start', startHtml()];
}
function teken(){
  const el = UI.el; if(!el || !document.body.contains(el)) return;
  if(R.S.fout){ el.innerHTML = `<div class="pagina pd2" data-scherm="fout"><h1>Productdata 2.0</h1><div class="melding">Laden lukte niet: ${esc(R.S.fout.message || String(R.S.fout))}</div><button class="knop" data-a="opnieuw">Opnieuw</button></div>`; return; }
  if(!R.S.klaar){ el.innerHTML = `<div class="pagina pd2" data-scherm="laden"><h1>Productdata 2.0</h1><div class="pd2-leeg">Producten, inkoop, verplaatsingen en voorraad laden…</div></div>`; return; }
  staatCheck();
  UI.dv = R.S.dataVer;
  const t0 = performance.now(), [naam, html] = schermHtml();
  el.innerHTML = `<div class="pagina pd2" data-scherm="${naam}">${html}</div><div id="pd2-actie">${actieHtml()}</div><div id="pd2-oefw">${oefKaart()}</div>`;
  UI.tekenMs = Math.round(performance.now() - t0);
  liveScherm();
}
const zet = (id, html) => { const x = document.getElementById(id); if(x) x.innerHTML = html; };
const scherm = () => { const p = UI.el && UI.el.querySelector('.pd2'); return p ? p.dataset.scherm : ''; };
// na een wijziging: kop, tegels en balken opnieuw; de kaarten alleen waar nodig (focus blijft staan)
function verversKop(){
  const s = scherm();
  if(s === 'fam'){ zet('pd2-fkop', famKop()); zet('pd2-maten', matenHtml()); zet('pd2-volg', volgHtml()); const sr = document.querySelector('#pd2-maat .pd2-segrij'); if(sr){ const t = document.createElement('div'); t.innerHTML = segHtml(); sr.replaceWith(t.firstElementChild); } }
  if(s === 'start'){ const k = document.getElementById('pd2-klaar'); if(k){ const t = document.createElement('div'); t.innerHTML = startHtml(); k.innerHTML = t.querySelector('#pd2-klaar').innerHTML; } }
  zet('pd2-actie', actieHtml()); zet('pd2-oefw', oefKaart());
}
function focusVan(){ const a = document.activeElement, k = a && a.closest && a.closest('[data-c]'); return k && a.dataset ? { c:k.dataset.c, k:a.dataset.k, d:a.dataset.d, a:a.dataset.a, pos:a.selectionStart } : null; }
function focusTerug(f){
  if(!f) return; const k = document.querySelector(`.pd2 [data-c="${CSS.escape(f.c)}"]`); if(!k) return;
  const x = k.querySelector(f.k ? `[data-k="${f.k}"]${f.d ? `[data-d="${f.d}"]` : ''}` : f.a ? `[data-a="${f.a}"]` : 'x'); if(!x || x === document.activeElement) return;
  x.focus(); if(x.tagName === 'INPUT' && x.type !== 'checkbox') try{ x.setSelectionRange(x.value.length, x.value.length); }catch(e){}
}
function verversKaarten(codes){
  const f = focusVan();
  codes.forEach(c => { const k = document.querySelector(`.pd2 article.pd2-kaart[data-c="${CSS.escape(c)}"]`); if(!k) return; const t = document.createElement('div'); t.innerHTML = kaartHtml(c); k.replaceWith(t.firstElementChild); });
  focusTerug(f);
}
function verversMaat(){ const f = focusVan(); zet('pd2-maat', maatBlok()); focusTerug(f); liveScherm(); }
function verversAlles(){ staatCheck(); if(['fam', 'wegalle'].includes(scherm())){ verversMaat(); verversKop(); } else teken(); }
// na een maatwissel: begin van de kaarten in beeld (alleen als je eronder zat)
function naarBoven(){ const b = document.getElementById('pd2-maat'); if(b && b.getBoundingClientRect().top < 0){ b.scrollIntoView({ block:'start' }); if(UI.el) UI.el.scrollTop -= 8; } }
function nieuweGroep(){ UI.weegKlaar.clear(); UI.n = 40; UI.afOpen = false; }

/* ---------- live voorraad: wat op het scherm staat (en de geopende familie) live laten ophalen ---------- */
let liveT = null, liveKopT = null;
function liveScherm(){
  clearTimeout(liveT);
  liveT = setTimeout(() => {
    if(!UI.el || !UI.el.querySelector('.pd2')) return;
    const zicht = UI.view === 'weeg' ? weegCodes() : kaartCodes().slice(0, UI.n);
    const fam = UI.fk ? famEcht(UI.fk).slice(0, 200) : [];
    if(zicht.length || fam.length) R.vraagLive(zicht.concat(fam), binnen);
  }, 300);
}
// nieuwe live voorraad binnen: alleen de geraakte kaarten opnieuw (niet de kaart waarin getypt wordt), kop even later
function binnen(codes){
  if(!UI.el || !UI.el.querySelector('.pd2')) return;
  const act = document.activeElement, bezig = act && act.closest && act.closest('.pd2 [data-c]');
  verversKaarten(codes.filter(c => !(bezig && bezig.dataset.c === c)));
  clearTimeout(liveKopT); liveKopT = setTimeout(() => { const l = document.getElementById('pd2-live'); if(l) l.innerHTML = liveRegel(blokCodes()); }, 800);
}

/* ---------- opslaan van invoer ---------- */
function normVeld(k, v){
  v = String(v ?? '').trim();
  if(!v) return '';
  if(R.isNvt(v)) return 'nvt'; if(R.isOnb(v)) return 'onb';
  const d = R.VELD[k];
  if(d && d.type === 'num'){ const n = num(v); if(n === null) return null; return k === 'hoogte' ? String(Math.ceil(n / 10) * 10) : String(n); }
  if(k === 'maat'){ const m = v.match(/(\d{2,3})\D+(\d{2,3})/); return m ? m[1] + 'x' + m[2] : v; }
  return v.replace(/\s+/g, ' ');
}
const gelijk = (a, b) => { const x = num(a), y = num(b); return x !== null && y !== null && !/[a-z]/i.test(String(a) + String(b)) ? Math.abs(x - y) < 1e-9 : String(a).trim().toLowerCase() === String(b).trim().toLowerCase(); };
const soortVan = c => R.status(c).so || '';
function zetVeld(c, k, ruw, opm){
  const v = normVeld(k, ruw);
  if(v === null){ WH.toast(R.VELD[k].t + ': typ een getal, nvt of onb', 3500); verversKaarten([c]); return; }
  const I = R.info(c), wasAf = R.status(c).af, vs = I.vs[k], vast = R.waarde(c, k, I);
  const voor = vs && !leeg(vs.v) ? String(vs.v) : vast.st === 'vastgelegd' ? vast.v : '';
  R.poZet(c, p => { if(!v) delete p.f[k]; else p.f[k] = Object.assign({ v, st:voor && gelijk(v, voor) ? 'bevestigd' : 'aangepast', voor, t:now() }, opm ? { opm } : {}); });
  if(k === 'hoogte' && num(ruw) !== null && String(num(ruw)) !== v) WH.toast('Hoogte naar boven afgerond op 10 cm: ' + v, 2500);
  const I2 = R.info(c), ok = x => ['bevestigd', 'aangepast'].includes(R.waarde(c, x, I2).st);
  const ev = { c, k, v, tab:soortVan(c), beide:ok('lvl') && ok('maxpick'), warn:k === 'hoogte' ? R.hoogteWaarsch(c, v, I2) : '' };
  if(k === 'pickc') meld('pickc', { c, v, tab:soortVan(c) }); else meld('veld', ev);
  na([c], wasAf);
}
function zetSoort(c, v){
  const I = R.info(c), wasAf = R.status(c).af, nu = R.soortWaarde(c, I), van = nu.v, voor = nu.st === 'vastgelegd' ? nu.v : I.vsSo ? I.vsSo.v : '';
  R.poZet(c, p => { if(!v) delete p.so; else p.so = { v, st:voor === v ? 'bevestigd' : 'aangepast', voor, t:now() }; });
  meld('soort', { c, van, naar:v, tab:van });
  na([c], wasAf, true);
}
function zetWeg(c, v){
  const I = R.info(c), wasAf = R.status(c).af, vs = I.vsWeg;
  R.poZet(c, p => { if(!v) delete p.weg; else { p.weg = { v, st:vs && vs.v === v ? 'bevestigd' : 'aangepast', voor:vs ? vs.v : '', t:now() }; if(!p.so || p.so.v !== 'weg') p.so = { v:'weg', st:I.vsSo && I.vsSo.v === 'weg' ? 'bevestigd' : 'aangepast', voor:I.vsSo ? I.vsSo.v : '', t:now() }; } });
  meld('weg', { c, v });
  na([c], wasAf, true);
}
function zetGew(c, gew){
  const wasAf = R.status(c).af;
  R.poZet(c, p => { if(!gew) delete p.gew; else p.gew = Object.assign({ t:now() }, gew); });
  na([c], wasAf);
}
// na een wijziging: de kaart opnieuw; wordt hij afgerond of past hij niet meer in de soort, dan het hele maatblok (hij schuift naar Afgerond)
let kopT = null;
function na(codes, wasAf, soortOok){
  setTimeout(() => {
    staatCheck();
    const zicht = new Set(kaartCodes()), blok = codes.some(c => R.status(c).af !== !!wasAf || !zicht.has(c)) || soortOok;
    if(blok && document.getElementById('pd2-maat')) verversMaat(); else verversKaarten(codes);
    clearTimeout(kopT); kopT = setTimeout(verversKop, blok ? 0 : 250);
  }, 0);
}

/* ---------- groepsacties (één keer ongedaan te maken, 10 s) ---------- */
function groep(codes, fn, label){
  const snap = codes.map(c => [c, R.po(c) ? JSON.parse(JSON.stringify(R.po(c))) : null]);
  codes.forEach(fn);
  UI.undo = { snap, label };
  toonUndo(label);
  verversAlles();
}
let undoT = null;
function toonUndo(label){
  let x = document.getElementById('pd2-undo');
  if(!x){ x = document.createElement('div'); x.id = 'pd2-undo'; x.className = 'pd2-undo'; document.body.appendChild(x); }
  x.innerHTML = `<span>${esc(label)}</span><button data-a="ongedaan">Ongedaan</button>`; x.hidden = false;
  clearTimeout(undoT); undoT = setTimeout(() => { x.hidden = true; UI.undo = null; }, 10000);
}
function ongedaan(){
  const u = UI.undo; if(!u) return;
  u.snap.forEach(([c, o]) => R.poHerstel(c, o));
  UI.undo = null; const x = document.getElementById('pd2-undo'); if(x) x.hidden = true;
  WH.toast('Ongedaan gemaakt: ' + u.label, 2500);
  meld('undo', {});
  verversAlles();
}
// alle voorstellen van een product bevestigen, ook de soort (het gewicht niet: aanname selgew)
function bevestig(c){
  const I = R.info(c), so = R.soortWaarde(c, I);
  R.poZet(c, p => {
    delete p.heropend;
    if(so.v && (['voorstel', 'twijfel'].includes(so.st) || !(p.so && p.so.v))) p.so = { v:so.v, st:'bevestigd', voor:so.v, t:now() };   // ook een vastgelegde soort expliciet opslaan
    const sv = p.so ? p.so.v : so.v;
    if(R.rolVoorstel(c) && sv !== 'weg') p.rol = { v:true, st:'bevestigd', t:now() };
    if(sv === 'weg'){ const w = R.wegWaarde(c, I); if(w.v && (w.st === 'voorstel' || !(p.weg && p.weg.v))) p.weg = { v:w.v, st:'bevestigd', voor:w.v, t:now() }; return; }
    const kols = new Set(R.nodigVan(c, sv, I).concat(R.KOLOMMEN[sv] || []).concat(R.isRol(c) ? R.ROLNODIG : []));
    kols.forEach(k => { if(R.VELD[k] && R.VELD[k].calc) return; if(I.sam && !R.SAMVELD.has(k)) return; const w = R.waarde(c, k, I); if(['voorstel', 'twijfel'].includes(w.st) && !leeg(w.v)) p.f[k] = { v:w.v, st:'bevestigd', voor:w.v, t:now() }; });
  });
}
const selLijst = () => [...UI.sel].filter(c => D.P[c]);
const meerSoort = cs => { const t = {}; cs.forEach(c => { const s = soortVan(c) || 'pick'; t[s] = (t[s] || 0) + 1; }); return (Object.entries(t).sort((a, b) => b[1] - a[1])[0] || [''])[0]; };

/* ---------- pop-ups ---------- */
function modal(html, onOk, okTxt){
  const bg = document.createElement('div'); bg.className = 'pd2-modal-bg';
  bg.innerHTML = `<div class="pd2-modal" role="dialog" aria-modal="true">${html}<div class="knoppen"><button class="knop" data-m="nee">${onOk ? 'Annuleren' : 'Sluiten'}</button>${onOk ? `<button class="knop pd2-hoofd" data-m="ok">${esc(okTxt || 'Opslaan')}</button>` : ''}</div></div>`;
  document.body.appendChild(bg);
  const sluit = () => { bg.remove(); document.removeEventListener('keydown', esc2); };
  const esc2 = e => { if(e.key === 'Escape') sluit(); };
  document.addEventListener('keydown', esc2);
  bg.addEventListener('click', e => {
    if(e.target === bg || e.target.closest('[data-m="nee"]')) return sluit();
    if(e.target.closest('[data-m="ok"]')){ if(onOk(bg.querySelector('.pd2-modal')) !== false) sluit(); return; }
    if(e.target.closest('[data-a]')) sluit();   // knoppen in het oefenmenu: actie loopt via de gewone klik-afhandeling
  });
  const f = bg.querySelector('textarea, input, select'); if(f) setTimeout(() => f.focus(), 30);
  return bg;
}
function infoModal(c){
  const I = R.info(c), st = R.status(c), so = R.soortWaarde(c, I), r = [];
  r.push(`<li><b>Soort ${esc(R.SOORTT[so.v] || '')}</b> (${esc(so.st)}): ${esc(so.why || (so.st === 'bevestigd' || so.st === 'aangepast' ? 'door jou gekozen' : ''))}${esc(scoreTxt(so))}</li>`);
  if(so.v === 'weg'){ const w = R.wegWaarde(c, I); r.push(`<li><b>Weg: ${esc(w.v)}</b> — ${esc(w.why || '')}</li>`); }
  const kols = [...new Set((R.KOLOMMEN[so.v] || []).concat(R.isRol(c) ? R.KOLOMMEN.rollen : []))];
  kols.forEach(k => { const d = R.VELD[k]; if(d.calc){ const x = R.calc(c, k, I); r.push(`<li><b>${esc(d.t)}</b> (berekend): ${esc(x.v || '–')} — ${esc(x.why || '')}${x.warn ? ' · ' + esc(x.warn) : ''}</li>`); return; }
    const w = R.waarde(c, k, I); r.push(`<li><b>${esc(d.t)}</b>: ${esc(w.v || '–')} <span class="u">(${esc(w.st)})</span>${w.why ? ' — ' + esc(w.why) : ''}${w.voor && w.st === 'aangepast' ? ' · voorstel was ' + esc(w.voor) : ''}${esc(scoreTxt(w))}</li>`); });
  const g = R.gewicht(c), afw = R.gewAfwijking(c);
  r.push(`<li><b>Gewicht per stuk</b>: ${g.kg ? nf(g.kg, 3) + ' kg' : 'onbekend'} (${esc(g.st)}${g.pq ? ', Picqer ' + nf(g.pq, 3) + ' kg' : ''})${afw ? ' — ' + esc(afw) : ''}</li>`);
  modal(`<h3>${esc(c)} — waarom deze voorstellen</h3><p class="u">${esc(R.naamVan(c))}</p><ul>${r.join('')}</ul>
    ${st.open.length ? `<p><b>Nog open:</b> ${esc(st.open.map(k => k === 'soort' ? 'soort bevestigen' : k === 'rol' ? 'rol ja/nee' : R.VELD[k] ? R.VELD[k].t : k).join(', '))}</p>` : '<p><b>Compleet.</b></p>'}
    <p class="u">Voorraad: ${esc(I.f.bron)}${I.f.t ? ' ' + esc(dk(I.f.t)) : ''}. Blauw vak = voorstel, groen = vastgelegd of door jou bevestigd, rood = ontbreekt of kan niet, grijs = berekend.</p>`);
}
function opmModal(c){
  const tab = c ? (soortVan(c) || 'pick') : (UI.oefenen ? UI.oef.set : 'algemeen');
  const kols = c ? ['', 'soort'].concat(soortVan(c) === 'weg' ? ['weg'] : (R.KOLOMMEN[soortVan(c)] || [])).concat(R.isRol(c) ? R.KOLOMMEN.rollen : []).concat(['gewicht', 'voorraad', 'inkoop', 'verkoop']) : [''];
  const def = c ? (UI.lastK[c] || '') : '';
  const al = R.S.fb.opm.filter(x => (c ? x.code === c : !x.code && x.tab === tab));
  modal(`<h3>💬 Opmerking${c ? ' bij ' + esc(c) : ' bij ' + esc(TABT[tab] || 'Productdata 2.0')}</h3>
    ${c ? `<label>Over <select id="pd2-opm-k">${[...new Set(kols)].map(k => `<option value="${k}" ${k === def ? 'selected' : ''}>${k ? esc(R.VELD[k] ? R.VELD[k].t : k) : '(hele product)'}</option>`).join('')}</select></label>` : ''}
    <textarea id="pd2-opm-t" placeholder="Typ, of dicteer met de microfoon van je toetsenbord"></textarea>
    ${al.length ? `<ul>${al.map(x => `<li>${x.kolom ? '<b>' + esc(x.kolom) + '</b>: ' : ''}${esc(x.tekst)} <button class="pd2-mini" data-m="weg" data-id="${esc(x.id)}">×</button></li>`).join('')}</ul>` : ''}`, m => {
    const t = m.querySelector('#pd2-opm-t').value.trim(); if(!t) return;
    R.fbOpm({ tab, code:c || '', kolom:c ? (m.querySelector('#pd2-opm-k').value || '') : '', tekst:t });
    WH.toast('Opmerking bewaard', 2000);
    if(c) verversKaarten([c]);
  });
  document.querySelectorAll('.pd2-modal [data-m="weg"]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); R.fbOpmWeg(b.dataset.id); b.closest('li').remove(); if(c) verversKaarten([c]); }));
}
function aanModal(id){
  const a = R.S.fb.aann[id] || {};
  modal(`<h3>Aanname</h3><p>${esc(R.AANNAMES[id])}</p><div class="knopjes"><button class="pd2-mini${a.v === 'ja' ? ' aan' : ''}" data-av="ja">klopt</button><button class="pd2-mini${a.v === 'nee' ? ' aan' : ''}" data-av="nee">keur af</button></div><textarea id="pd2-aopm" placeholder="Waarom, of hoe het wel moet (mag leeg)">${esc(a.opm || '')}</textarea>`, m => {
    const b = m.querySelector('[data-av].aan'); R.fbAann(id, { v:b ? b.dataset.av : (a.v || ''), opm:m.querySelector('#pd2-aopm').value.trim() });
    if(UI.view === 'aann') teken();
  });
  document.querySelectorAll('.pd2-modal [data-av]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); document.querySelectorAll('.pd2-modal [data-av]').forEach(x => x.classList.toggle('aan', x === b)); }));
}
function kolomModal(k0){
  const cs = selLijst(), ks = [...new Set(cs.flatMap(c => (R.NODIG[soortVan(c)] || []).concat(R.isRol(c) ? R.ROLNODIG : [])))].filter(k => R.VELD[k] && !R.VELD[k].calc && k !== 'pickc');
  if(!ks.length){ WH.toast('Deze producten hebben geen invulvelden (kies eerst de soort)', 3000); return; }
  if(!ks.includes(k0)) k0 = ks[0];
  modal(`<h3>Zelfde waarde voor ${nf(cs.length)} producten</h3><label>Veld <select id="pd2-kk">${ks.map(k => `<option value="${k}" ${k === k0 ? 'selected' : ''}>${esc(R.VELD[k].t)}</option>`).join('')}</select></label><label>Waarde <input id="pd2-kv" placeholder="getal, tekst, nvt of onb"></label>`, m => {
    const k = m.querySelector('#pd2-kk').value, ruw = m.querySelector('#pd2-kv').value, v = normVeld(k, ruw);
    if(v === null){ WH.toast('Typ een getal, nvt of onb', 3000); return false; }
    if(k === 'mixgroep' && v) R.mgPlus(v);
    groep(cs, c => { const I = R.info(c), vs = I.vs[k], voor = vs && !leeg(vs.v) ? String(vs.v) : ''; R.poZet(c, p => { if(!v) delete p.f[k]; else p.f[k] = { v, st:voor && gelijk(v, voor) ? 'bevestigd' : 'aangepast', voor, t:now() }; }); }, R.VELD[k].t + ' = ' + (v || 'leeg') + ' voor ' + nf(cs.length));
    meld('kolom', { k });
  }, 'Toepassen');
}
function gewPopModal(){
  modal(`<h3>Gewicht voor ${nf(UI.sel.size)} producten</h3><label>Gewicht per stuk (kg) <input id="pd2-gp" inputmode="decimal" placeholder="bijv. 1,2"></label><div class="knopjes"><button class="pd2-mini aan" data-gst="gewogen">gewogen</button><button class="pd2-mini" data-gst="vertrouwd">vertrouwd</button></div>`, m => {
    const kg = num(m.querySelector('#pd2-gp').value), st = (m.querySelector('[data-gst].aan') || {}).dataset.gst || 'gewogen';
    if(!(kg > 0)){ WH.toast('Typ een gewicht in kg', 2500); return false; }
    groep(selLijst(), c => R.poZet(c, p => { p.gew = { st, kg, t:now() }; }), 'Gewicht ' + nf(kg, 3) + ' kg (' + st + ') voor ' + nf(UI.sel.size));
    meld('gewpop', {});
  }, 'Toepassen');
  document.querySelectorAll('.pd2-modal [data-gst]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); document.querySelectorAll('.pd2-modal [data-gst]').forEach(x => x.classList.toggle('aan', x === b)); }));
}
function oefMenu(){
  const b = R.S.bewaar, st = [snapTxt() || (R.S.bijgewerkt ? 'gegevens bijgewerkt ' + uur(R.S.bijgewerkt) : ''), b.bezig ? 'bewaren…' : b.fout ? 'bewaren mislukt, opnieuw over 5 s' : b.op ? 'bewaard ' + uur(b.op) : ''].filter(Boolean).join(' · ');
  const pq = R.PDQ, pst = pq.fout ? 'naar productdata schrijven mislukt (opnieuw over 8 s)' : pq.op ? 'productdata bijgewerkt ' + uur(pq.op) : '';
  modal(`<h3>Oefenmodus</h3><p class="u">Wat je bevestigt of aanpast gaat direct naar productdata (bron pd2; vooraf een kopie van de rij). Met het oefenkaartje aan gaat niets naar productdata: dan alleen naar een oefenkopie (wh-pd2-oefen). ${esc([st, pst].filter(Boolean).join(' · '))}</p>
    <div class="pd2-menu"><button class="knop" data-a="oefaan">${UI.oefenen ? 'Oefenen uitzetten' : 'Oefenen'}</button>
    <button class="knop" data-a="view" data-v="scores">Hoe goed zijn de voorstellen</button>
    <button class="knop" data-a="opmalg">💬 Opmerking</button>
    <button class="knop" data-a="kopieer">Kopieer alles voor Claude</button>
    <button class="knop" data-a="wissen">Oefenantwoorden wissen</button>${R.pd2Overzetten ? '<button class="knop" data-a="overzet">Bevestigd naar echte productdata</button>' : ''}</div>`);
}

/* ---------- bevestigd naar echte productdata (vlag pd2Overzetten; nu uit, knop verborgen) ---------- */
async function overzetModal(){
  if(!R.pd2Overzetten) return;
  const rows = {}; Object.entries(WHPD.S.pd).forEach(([c, r]) => { rows[c] = { data:r.data, meta:r.meta }; });
  const plan = R.overzetPlan(rows), kies = plan.filter(x => x.actie === 'kies'), zt = plan.filter(x => x.actie === 'zet');
  modal(`<h3>Bevestigd naar echte productdata</h3><p>${nf(zt.length)} waarden gaan erin (bron pd2). ${nf(kies.length)} wijken af van jouw eigen invoer: kies per regel. Vooraf wordt een kopie bewaard; terugdraaien kan.</p>
    ${kies.length ? `<ul>${kies.map(x => `<li><b>${esc(x.c)} · ${esc(x.k)}</b>: nu ${esc(x.oud)} (${esc(x.oudBron)}), 2.0 zegt ${esc(x.nieuw)} <label><input type="checkbox" data-kies="${esc(x.c + '|' + x.k)}"> neem 2.0</label></li>`).join('')}</ul>` : ''}`, m => {
    const keuzes = {}; m.querySelectorAll('[data-kies]:checked').forEach(x => { keuzes[x.dataset.kies] = 'nieuw'; });
    R.overzetEcht(keuzes).then(r => WH.toast('Overgezet: ' + nf(r.n) + ' waarden, kopie in ' + r.key, 5000), e => WH.toast(e.message, 5000));
  }, 'Overzetten');
}

/* ---------- kopieer alles voor Claude ---------- */
function claudeTekst(){
  const d = new Date(), r = [];
  r.push('Productdata 2.0 — oefenfeedback van Daan (' + d.toLocaleDateString('nl-NL') + ' ' + d.toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' }) + ')');
  r.push('Ontwerp: docs/productdata-2.0-ontwerp.md · opslag: ' + R.KEY_OEFEN + ' (' + Object.keys(R.S.o.p).length + ' producten aangeraakt), ' + R.KEY_FB);
  TABS.forEach(([tab, t]) => {
    const l = OPDR[tab] || [], done = R.S.o.oef[tab] || {}, fb = R.S.fb.tabs[tab] || {}, opm = R.S.fb.opm.filter(x => x.tab === tab);
    r.push('', '== ' + t + ' ==');
    r.push('Opdrachten ' + l.filter(o => done[o.id]).length + '/' + l.length + ': ' + l.map(o => (done[o.id] ? '[x] ' : '[ ] ') + o.t).join(' | '));
    r.push('Layout: ' + (fb.layout || '–') + ' · Gevoel: ' + (fb.gevoel ? fb.gevoel + '/5' : '–'));
    if(fb.mis) r.push('Mis ik: ' + fb.mis);
    if(fb.over) r.push('Overbodig: ' + fb.over);
    if(opm.length){ r.push('Opmerkingen:'); opm.forEach(x => r.push('- ' + (x.code ? x.code + (x.kolom ? ' · ' + (R.VELD[x.kolom] ? R.VELD[x.kolom].t : x.kolom) : '') + ': ' : '(algemeen) ') + x.tekst)); }
  });
  const los = R.S.fb.opm.filter(x => !TABT[x.tab]);
  if(los.length){ r.push('', '== Overige opmerkingen =='); los.forEach(x => r.push('- ' + (x.code ? x.code + ': ' : '') + x.tekst)); }
  const T = R.telling(), naam = k => k === 'soort' ? 'soort' : k === 'weg' ? 'weg-keuze' : R.VELD[k] ? R.VELD[k].t : k;
  r.push('', '== Voorstellen: hoe vaak klopt of aangepast ==');
  if(!Object.keys(T).length) r.push('(nog niets bevestigd of aangepast)');
  Object.entries(T).sort((a, b) => (b[1].klopt + b[1].aangepast) - (a[1].klopt + a[1].aangepast)).forEach(([k, x]) => r.push(naam(k) + ': ' + x.klopt + '× klopt, ' + x.aangepast + '× aangepast' + (x.vb.length ? ' (' + x.vb.join('; ') + ')' : '')));
  const nOef = Object.values(R.S.o.p).reduce((n, p) => n + Object.values(p.f || {}).filter(x => x && x.oef).length + ['so', 'weg'].filter(k => p[k] && p[k].oef).length, 0);
  if(nOef) r.push('(' + nOef + ' oefenantwoorden met het oefenkaartje aan: niet meegeteld)');
  const gw = {}; Object.values(R.S.o.p).forEach(p => { if(p.gew && p.gew.st) gw[p.gew.st] = (gw[p.gew.st] || 0) + 1; });
  if(Object.keys(gw).length) r.push('gewicht: ' + Object.entries(gw).map(([k, n]) => n + '× ' + k).join(', '));
  r.push('', '== Aannames ==');
  Object.keys(R.AANNAMES).forEach(i => { const a = R.S.fb.aann[i]; r.push('- ' + i + ': ' + (a && a.v === 'nee' ? 'AFGEKEURD' : a && a.v === 'ja' ? 'klopt' : 'niet beoordeeld') + (a && a.opm ? ' — ' + a.opm : '') + ' · ' + R.AANNAMES[i]); });
  return r.join('\n');
}
function kopieer(){
  const t = claudeTekst();
  const klaar = ok => modal(`<h3>${ok ? 'Gekopieerd' : 'Kopieer deze tekst'}</h3><p class="u">${ok ? 'Staat op het klembord: plak hem in de chat met Claude.' : 'Selecteer en kopieer, en plak hem in de chat met Claude.'}</p><pre>${esc(t)}</pre>`);
  const fallback = () => { try{ const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); klaar(ok); }catch(e){ klaar(false); } };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => klaar(true), fallback); else fallback();
}

/* ---------- naar een familie, maat of soort ---------- */
function openFam(fk, mk){
  UI.fk = fk; UI.mk = mk === undefined ? null : mk; UI.aandacht = null; UI.view = null; UI.seg = 'open'; UI.sel.clear(); nieuweGroep();
  meld('fam', { fk });
  teken(); if(UI.el) UI.el.scrollTop = 0;
}
// oefening "Toon": de familie met de meeste treffers, de maat en de soort openzetten
function toon(set, id){
  const o = (OPDR[set] || []).find(x => x.id === id); if(!o || !o.toon) return;
  const q = String(o.toon.zoek || '').toLowerCase().split(/\s+/).filter(Boolean), fams = {};
  Object.keys(D.P).filter(c => R.actief(c) && !R.isKoppel(c) && zoekTreft(c, q)).forEach(c => { const f = R.famVan(c); fams[f] = (fams[f] || 0) + 1; });
  const fk = Object.entries(fams).sort((a, b) => b[1] - a[1])[0]; if(!fk) return;
  UI.fk = fk[0]; UI.aandacht = null; UI.view = null; UI.sel.clear(); nieuweGroep(); UI.mk = null;
  const M = maatgroepen(), seg = o.toon.seg;
  let m = o.toon.maat ? M.find(x => String(x.k).replace(/\s/g, '').startsWith(o.toon.maat)) : null;
  if(!m && seg) m = M.find(x => x.per[seg]);
  if(m) UI.mk = m.k;
  kiesMaat();
  UI.seg = seg && openCodes().some(c => segVan(c) === seg) ? seg : 'open';
  if(UI.mk !== null) meld('maat', { naam:R.famNaam(UI.fk), mk:UI.mk });
  teken(); if(UI.el) UI.el.scrollTop = 0;
}

/* ---------- gebeurtenissen ---------- */
let zoekT = null, gekoppeld = false;
const BINNEN = '.pd2, #pd2-actie, #pd2-oefw, .pd2-modal-bg';
function klik(ev){
  const ui = ev.target.closest && ev.target.closest(BINNEN); if(!ui || !UI.el) return;
  if(ev.target.closest('#pd2-undo')) return;
  const a = ev.target.closest('[data-a]'); if(!a || a.tagName === 'SELECT') return;
  const kaart = a.closest('[data-c]'), c = kaart ? kaart.dataset.c : null, A = a.dataset.a;
  switch(A){
    case 'opnieuw': R.laad(true).then(teken); teken(); return;
    case 'wissen':
      if(confirm('Oefenantwoorden wissen? Alleen wat je met het oefenkaartje aan hebt ingevuld verdwijnt. Echte invoer, feedback en opmerkingen blijven staan.')){ R.wisAlles().then(() => { UI.sel.clear(); WH.toast('Oefenantwoorden gewist', 2500); teken(); }); }
      return;
    case 'kopieer': kopieer(); return;
    case 'oefmenu': oefMenu(); return;
    case 'oefaan': UI.oefenen = R.S.oefenen = !UI.oefenen; lsZet('oefenen', UI.oefenen ? '1' : '0'); zet('pd2-oefw', oefKaart()); return;
    case 'oefuit': UI.oefenen = R.S.oefenen = false; lsZet('oefenen', '0'); zet('pd2-oefw', ''); return;
    case 'oefvolg': UI.oef.i++; oefBewaar(); zet('pd2-oefw', oefKaart()); return;
    case 'oefvolgset': { const i = TABS.findIndex(t => t[0] === UI.oef.set); UI.oef = { set:TABS[(i + 1) % TABS.length][0], i:0 }; oefBewaar(); zet('pd2-oefw', oefKaart()); return; }
    case 'opmalg': opmModal(null); return;
    case 'filter': UI.filterOpen = !UI.filterOpen; teken(); return;
    case 'scope': UI.scope = a.dataset.v; UI.zoek = ''; lsZet('scope', UI.scope); UI.famN = 30; teken(); return;
    case 'fam': openFam(a.dataset.v); return;
    case 'famweg': UI.fk = null; UI.mk = null; UI.aandacht = null; UI.sel.clear(); teken(); if(UI.el) UI.el.scrollTop = 0; return;
    case 'fammeer': UI.famN += 30; zet('pd2-fams', famRijen()); return;
    case 'view': UI.view = a.dataset.v; UI.sel.clear(); if(UI.view === 'weeg') meld('tab', { tab:'weeglijst' }); teken(); if(UI.el) UI.el.scrollTop = 0; return;
    case 'viewweg': UI.view = null; UI.wegAlle = null; UI.sel.clear(); teken(); if(UI.el) UI.el.scrollTop = 0; return;
    case 'maat': { const was = UI.aandacht; UI.mk = a.dataset.v; UI.aandacht = null; UI.seg = 'open'; nieuweGroep(); meld('maat', { naam:R.famNaam(UI.fk), mk:UI.mk }); if(was){ teken(); return; } zet('pd2-maten', matenHtml()); verversMaat(); verversKop(); naarBoven(); return; }
    case 'naar': { const x = a.dataset.c; let k = document.querySelector(`.pd2 article.pd2-kaart[data-c="${CSS.escape(x)}"]`);
      if(!k){ if(R.status(x).af) UI.afOpen = true; else { UI.seg = 'open'; const i = kaartCodes().indexOf(x); if(i >= UI.n) UI.n = i + 1; } verversMaat(); verversKop(); k = document.querySelector(`.pd2 [data-c="${CSS.escape(x)}"]`); }
      if(k){ k.scrollIntoView({ block:'start' }); if(UI.el) UI.el.scrollTop -= 8; } return; }
    case 'volgmaat': { const M = maatgroepen(); if(!M.length) return; const i = M.findIndex(m => m.k === UI.mk), L = M.slice(i + 1).concat(M.slice(0, i + 1)), n = L.find(m => m.open) || L[0]; UI.mk = n.k; UI.seg = 'open'; nieuweGroep(); meld('maat', { naam:R.famNaam(UI.fk), mk:UI.mk }); zet('pd2-maten', matenHtml()); verversMaat(); verversKop(); naarBoven(); return; }
    case 'volgfam': { const L = families(), i = L.findIndex(f => f.fk === UI.fk), rest = L.slice(i + 1).concat(L.slice(0, Math.max(0, i))), n = rest.find(f => f.af < f.n) || rest[0]; if(!n) return; openFam(n.fk); return; }
    case 'seg': UI.seg = a.dataset.v; nieuweGroep(); meld('tab', { tab:UI.seg }); verversMaat(); return;
    case 'aandacht': { UI.aandacht = a.dataset.v || null; UI.seg = 'open'; nieuweGroep(); teken(); return; }
    case 'rcfilter': UI.rcFilter = a.dataset.v; teken(); return;
    case 'rcfam': { const fk = a.dataset.f, cs = R.rolCheck().filter(x => x.fam === fk && rcGoed(x)).map(x => x.c); if(!cs.length) return;
      groep(cs, x => R.poZet(x, p => { p.gew = { st:'vertrouwd', kg:R.gewicht(x).pq, t:now() }; }), 'Gewicht klopt: ' + nf(cs.length) + ' rollen'); meld('gewst', { st:'vertrouwd' }); setTimeout(teken, 0); return; }
    case 'wegalle': UI.view = 'wegalle'; UI.wegAlle = a.dataset.v; UI.seg = 'weg'; UI.sel.clear(); nieuweGroep(); teken(); if(UI.el) UI.el.scrollTop = 0; return;
    case 'meer': UI.n += 40; verversMaat(); return;
    case 'toon': toon(UI.oef.set, a.dataset.id); return;
    case 'fb': R.fbTab(UI.oef.set, { [a.dataset.k]:a.dataset.v }); a.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('aan', b === a)); return;
    case 'aanname': aanModal(a.dataset.id); return;
    case 'aannv': { const id = a.closest('[data-id]').dataset.id, cur = R.S.fb.aann[id] || {}; R.fbAann(id, { v:cur.v === a.dataset.v ? '' : a.dataset.v }); teken(); return; }
    case 'mgregel': meld('mgregel', {}); { const l = famEcht(UI.fk).filter(x => R.waarde(x, 'mixgroep').v === a.dataset.v); modal(`<h3>Mixgroep ${esc(a.dataset.v)}</h3><ul>${l.map(x => `<li><b>${esc(x)}</b> ${esc(R.naamVan(x))} · bulk ${esc(R.info(x).f.bulk.map(b => b.n + ' (' + nf(b.v) + ')').join(', ') || '–')}</li>`).join('')}</ul>`); } return;
    case 'sel': if(!c) return; if(a.checked) UI.sel.add(c); else UI.sel.delete(c); kaart.classList.toggle('sel', a.checked); zet('pd2-actie', actieHtml()); return;
    case 'selalle': { const cs = kaartCodes().slice(0, UI.n); if(a.checked) cs.forEach(x => UI.sel.add(x)); else cs.forEach(x => UI.sel.delete(x)); verversMaat(); zet('pd2-actie', actieHtml()); return; }
    case 'selweg': UI.sel.clear(); verversMaat(); zet('pd2-actie', actieHtml()); return;
    case 'info': infoModal(c); return;
    case 'opm': opmModal(c); return;
    case 'klopt': {
      const k = a.dataset.k;
      if(k === 'soort') return zetSoort(c, R.soortWaarde(c).v);
      if(k === 'weg') return zetWeg(c, R.wegWaarde(c).v);
      return zetVeld(c, k, R.waarde(c, k).v);
    }
    case 'zetsoort': return zetSoort(c, a.dataset.v);
    case 'verschil': { const wasAf = R.status(c).af; Promise.resolve(R.verschilKies(c, a.dataset.k, a.dataset.v)).then(() => na([c], wasAf, true)); return; }
    case 'wegkies': return zetWeg(c, a.dataset.v);
    case 'gewst': {
      const v = a.dataset.v, g = R.gewicht(c), inp = kaart.querySelector('[data-a="gewkg"]'), kg = num(inp && inp.value);
      if(v === 'gewogen'){ if(kg > 0) zetGew(c, { st:'gewogen', kg }); else if(g.gk) zetGew(c, { st:'gewogen', kg:g.gk }); else { WH.toast('Typ eerst het gewogen gewicht in kg', 2500); if(inp) inp.focus(); return; } }
      else if(g.st === v) zetGew(c, null);
      else zetGew(c, { st:v, kg:v === 'tewegen' ? null : (kg > 0 ? kg : (g.pq > 0 ? g.pq : null)) });   // vertrouwd: de Picqer-kg van nu vastleggen
      meld('gewst', { st:v }); if(UI.view === 'rolcheck') setTimeout(teken, 0); return;
    }
    case 'rijklopt': groep([c], bevestig, 'Alle voorstellen kloppen: ' + c); meld('selklopt', { tab:soortVan(c), n:1 }); return;
    case 'rol': { const v = a.dataset.v === '1', wasAf = R.status(c).af; R.poZet(c, p => { p.rol = { v, t:now() }; }); if(v) UI.rolOpen[c] = true; meld('rol', { v }); na([c], wasAf, true); return; }
    case 'heropen': R.poZet(c, p => { p.heropend = now(); }); meld('heropen', {}); WH.toast(R.naamVan(c) + ' staat weer open', 2500); UI.afOpen = true; verversAlles(); return;
    case 'wegterug': UI.afOpen = true; groep([c], x => R.poZet(x, p => { delete p.weg; delete p.so; delete p.heropend; }), c + ' teruggezet'); meld('wegterug', {}); return;
    case 'maatklopt': { const cs = openCodes(); groep(cs, bevestig, 'Alle voorstellen kloppen: ' + mv(cs.length, 'product', 'producten')); meld('selklopt', { tab:meerSoort(cs), n:cs.length }); return; }
    case 'zelfdekg': {
      const kg = num((document.getElementById('pd2-kgmaat') || {}).value), gw = (document.getElementById('pd2-kgmaat-gew') || {}).checked;
      if(!(kg > 0)){ WH.toast('Typ een gewicht in kg', 2500); return; }
      const cs = blokCodes().filter(x => { const g = R.gewicht(x); return !R.isSam(x) && (g.st === 'niet' || g.st === 'tewegen'); });
      groep(cs, x => R.poZet(x, p => { p.gew = { st:gw ? 'gewogen' : 'vertrouwd', kg, t:now() }; }), 'Gewicht ' + nf(kg, 3) + ' kg voor ' + mv(cs.length, 'product', 'producten'));
      return;
    }
    case 'selklopt': { const cs = selLijst(); groep(cs, bevestig, 'Selectie klopt: ' + mv(cs.length, 'product', 'producten')); meld('selklopt', { tab:meerSoort(cs), n:cs.length }); UI.sel.clear(); verversAlles(); return; }
    case 'isrol': { const cs = selLijst(); groep(cs, x => R.poZet(x, p => { p.rol = { v:true, t:now() }; }), 'Is rol: ' + mv(cs.length, 'product', 'producten')); meld('rol', { v:true }); return; }
    case 'weegprint': weegPrint(); return;
    case 'overzet': overzetModal(); return;
    case 'meet': { a.disabled = true; const st = document.getElementById('pd2-meetst'); R.meet((i, n) => { if(st) st.textContent = 'meten… ' + nf(i) + ' van ' + nf(n); }).then(m => { R.zetMeting(m); WH.toast('Meting klaar: ' + nf(m.n) + ' waarden getoetst', 3000); if(UI.view === 'scores') teken(); }); return; }
  }
}
function koppel(){
  if(gekoppeld) return; gekoppeld = true;
  document.addEventListener('click', klik);
  document.addEventListener('click', ev => { if(ev.target.closest('#pd2-undo [data-a="ongedaan"]')) ongedaan(); });
  document.addEventListener('toggle', ev => { const d = ev.target; if(!d.matches) return; if(d.matches('details.pd2-rol')) UI.rolOpen[d.dataset.rol] = d.open; if(d.matches('details.pd2-af')) UI.afOpen = d.open; }, true);
  document.addEventListener('focusin', ev => { const k = ev.target.closest && ev.target.closest('.pd2 [data-c]'), x = ev.target.dataset && (ev.target.dataset.k || (ev.target.dataset.a === 'gewkg' ? 'gewicht' : '')); if(k && x) UI.lastK[k.dataset.c] = x; });
  document.addEventListener('input', ev => {
    if(ev.target.id !== 'pd2-zoek') return;
    clearTimeout(zoekT); zoekT = setTimeout(() => { UI.zoek = ev.target.value; UI.famN = 30; zet('pd2-fams', famRijen()); const k = document.getElementById('pd2-klaar'); if(k){ const L = families(); k.textContent = nf(L.filter(f => f.af === f.n).length) + ' van ' + nf(L.length) + ' families klaar'; } }, 300);
  });
  document.addEventListener('change', ev => {
    const t = ev.target; if(!t.closest || !t.closest(BINNEN)) return;
    if(t.dataset.f){ UI[t.dataset.f] = t.value; UI.famN = 30; teken(); return; }
    if(t.dataset.fb){ R.fbTab(t.closest('[data-tab]').dataset.tab, { [t.dataset.fb]:t.value }); return; }
    const a2 = t.dataset.a2;
    if(a2){
      const v = t.value; t.value = '';
      if(a2 === 'oefset'){ UI.oef = { set:v, i:0 }; oefBewaar(); zet('pd2-oefw', oefKaart()); return; }
      if(!v) return;
      const cs = selLijst();
      if(a2 === 'allemaal'){ groep(cs, x => { const nu = R.soortWaarde(x), voor = nu.st === 'vastgelegd' ? nu.v : (R.info(x).vsSo || {}).v || ''; R.poZet(x, p => { p.so = { v, st:voor === v ? 'bevestigd' : 'aangepast', voor, t:now() }; }); }, 'Allemaal ' + R.SOORTT[v] + ': ' + mv(cs.length, 'product', 'producten')); cs.forEach(x => meld('soort', { c:x, van:'', naar:v })); UI.sel.clear(); verversAlles(); return; }
      if(a2 === 'gewicht'){ if(v === 'klopt'){ groep(cs, x => R.poZet(x, p => { p.gew = { st:'vertrouwd', kg:R.kgPq(x) > 0 ? R.kgPq(x) : null, t:now() }; }), 'Gewichten kloppen: ' + mv(cs.length, 'product', 'producten')); meld('gewklopt', {}); } else gewPopModal(); return; }
      if(a2 === 'zelfde'){ kolomModal(v); return; }
      return;
    }
    const kaart = t.closest('[data-c]'); if(!kaart) return;
    const c = kaart.dataset.c, k = t.dataset.k;
    if(t.dataset.a === 'gewkg'){ const kg = num(t.value); if(!t.value.trim()){ const g = R.gewicht(c); if(g.st === 'gewogen') zetGew(c, null); return; } if(!(kg > 0)){ WH.toast('Typ het gewicht in kg', 2500); return; } zetGew(c, { st:'gewogen', kg }); meld('gewst', { st:'gewogen' }); return; }
    if(t.dataset.a === 'gewogen' || t.dataset.a === 'palletkg'){
      let kg = num(t.value), extra = {};
      if(t.dataset.a === 'palletkg'){ const w = weegWijze(c); if(!(kg > 15) || !w.reach){ WH.toast('Typ het palletgewicht in kg (meer dan 15)', 2500); return; } extra = { via:'reachtruck', pallet:kg }; kg = Math.round((kg - 15) / w.spp * 1000) / 1000; }
      if(!(kg > 0)){ WH.toast('Typ het gewogen gewicht in kg', 2500); return; }
      R.poZet(c, p => { p.gew = Object.assign({ st:'gewogen', kg, t:now() }, extra); }); UI.weegKlaar.add(c); meld('gewogen', {});
      WH.toast(c + ': ' + nf(kg, 3) + ' kg per stuk gewogen' + (extra.via ? ' (pallet ' + nf(extra.pallet) + ' kg)' : ''), 2500); teken(); return;
    }
    if(!k) return;
    if(k === 'soort') return zetSoort(c, t.value);
    if(k === 'pickc'){
      if(t.value === 'anders'){ modal(`<h3>Picklocatie moet anders — ${esc(c)}</h3><textarea id="pd2-pk" placeholder="Hoe moet het? (bijv. naar AD04B04, vaste plek)"></textarea>`, m => { zetVeld(c, 'pickc', 'anders', m.querySelector('#pd2-pk').value.trim()); }); return; }
      return zetVeld(c, 'pickc', t.value);
    }
    if(k === 'mixgroep' && t.value === '__nieuw'){
      modal('<h3>Nieuwe mixgroep</h3><input id="pd2-mgn" placeholder="Naam, bijv. Vica · trapmaantjes">', m => { const n = m.querySelector('#pd2-mgn').value.trim(); if(!n) return false; R.mgPlus(n); meld('mgnieuw', {}); zetVeld(c, 'mixgroep', n); });
      verversKaarten([c]); return;
    }
    if(k === 'maat' && t.value === '__anders'){
      modal('<h3>Andere palletmaat</h3><input id="pd2-maatin" placeholder="bijv. 100x130" inputmode="decimal">', m => { const v = normVeld('maat', m.querySelector('#pd2-maatin').value); if(!v || !/^\d{2,3}x\d{2,3}$/.test(v)){ WH.toast('Typ de maat als breedte x lengte, bijv. 100x130', 3000); return false; } zetVeld(c, 'maat', v); });
      verversKaarten([c]); return;
    }
    if(k === 'verp'){ const f = t.closest('.pd2-verp'), n = f.querySelector('[data-d="n"]').value.trim(), s = f.querySelector('[data-d="s"]').value; return zetVeld(c, 'verp', (n ? n + ' ' : '') + s); }
    zetVeld(c, k, t.value);
  });
  // Enter in een leeg veld met een voorstel = Klopt; daarna naar het volgende veld van de kaart
  document.addEventListener('keydown', ev => {
    const t = ev.target; if(ev.key !== 'Enter' || !t.closest || t.tagName !== 'INPUT' || !t.closest('.pd2 article.pd2-kaart') || !t.dataset.k) return;
    ev.preventDefault();
    const kaart = t.closest('[data-c]'), c = kaart.dataset.c, alle = [...kaart.querySelectorAll('input.pd2-in[data-k]')], volg = alle[alle.indexOf(t) + 1], vk = volg ? volg.dataset.k : null;
    if(!t.value.trim() && t.placeholder && t.dataset.k !== 'verp'){ zetVeld(c, t.dataset.k, R.waarde(c, t.dataset.k).v); }
    else t.blur();
    if(vk) setTimeout(() => { const k2 = document.querySelector(`.pd2 article.pd2-kaart[data-c="${CSS.escape(c)}"] input[data-k="${vk}"]`); if(k2) k2.focus(); }, 30);
  });
}

/* ---------- ingang vanuit ivol.js ---------- */
function render(el){
  stijl(); R.S.oefenen = UI.oefenen;
  UI.el = el; koppel();
  if(!R.S.klaar && !R.S.fout) R.laad().then(() => { if(UI.el === el) teken(); });
  teken();
}
// nieuwe gegevens binnen (na de momentopname, of na verversen): opnieuw tekenen, maar niet midden in het typen
const typt = () => { const act = document.activeElement; return act && act.closest && act.closest('.pd2, #pd2-oefw') && /INPUT|SELECT|TEXTAREA/.test(act.tagName); };
R.opNieuw(() => {
  if(!UI.el || !document.body.contains(UI.el)) return;
  const s = scherm();
  if(R.S.klaar && UI.dv !== R.S.dataVer && s){
    if(typt()){ UI.wachtTeken = true; return; }
    const top = UI.el.scrollTop; teken(); UI.el.scrollTop = top; return;
  }
  if(s === 'start'){ const k = document.getElementById('pd2-klaar'); if(k && !typt()){ const L = families(), sn = snapTxt(); k.innerHTML = nf(L.filter(f => f.af === f.n).length) + ' van ' + nf(L.length) + ' families klaar' + (sn ? ' · ' + esc(sn) : '') + (R.S.bewaar.fout ? ' · <b class="rood">bewaren mislukt</b>' : ''); } }
  if(s === 'fam'){ const l = document.getElementById('pd2-live'); if(l) l.innerHTML = liveRegel(blokCodes()); }
});
document.addEventListener('focusout', () => { if(UI.wachtTeken) setTimeout(() => { if(UI.wachtTeken && !typt()){ UI.wachtTeken = false; const top = UI.el ? UI.el.scrollTop : 0; teken(); if(UI.el) UI.el.scrollTop = top; } }, 400); });
return { render, teken, UI, claudeTekst, families, maatgroepen, aandachtVan, AAND, kaartCodes, openCodes, afCodes, blokCodes, famEcht, segVan, weegCodes, wegAlleCodes, openFam, OPDR, verversAlles };
})();
