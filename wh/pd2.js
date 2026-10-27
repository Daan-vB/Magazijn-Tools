/* =====================================================================
   IVOL Warehouse 3.0 — Productdata 2.0, scherm (oefensimulatie, 27-10-2026)
   Ontwerp: docs/productdata-2.0-ontwerp.md. Rekenen en opslag: wh/pd2-reken.js (PD2R).
   Route #/pd2 (menu 3 · Producten, badge oefen). Oefenmodus: niets gaat naar de echte productdata;
   alles wat Daan doet staat in wh-pd2-oefen, opmerkingen en oefenantwoorden in wh-pd2-feedback.
   Opbouw (elke tab hetzelfde): filters · basisinfo · voortgang · tegels · tabs · oefening · lijst · actiebalk.
   ===================================================================== */
window.WHPD2 = (function(){
'use strict';
const { esc, nf, num, leeg, D } = WH;
const R = window.PD2R;
const ls = k => { try{ return localStorage.getItem('pd2-' + k); }catch(e){ return null; } };
const lsZet = (k, v) => { try{ localStorage.setItem('pd2-' + k, v); }catch(e){} };
const TABS = [['pallet', '1 Pallet'], ['deel', '2 Deel'], ['pick', '3 Pick'], ['mix', '4 Mix'], ['weg', '5 Weg'], ['rollen', 'Rollen'], ['afgerond', 'Afgerond'], ['weeglijst', 'Weeglijst']];
const TABT = Object.fromEntries(TABS);
const SCOPES = [['belangrijk', 'Belangrijk'], ['AB', 'A+B'], ['beweegt', 'Alles dat beweegt'], ['binnen', 'Komt binnen'], ['voorraad', 'Alles met voorraad']];
const UI = { weegKlaar:new Set(), el:null, tab:ls('tab') || 'pallet', scope:ls('scope') || 'belangrijk', zoek:'', lev:'', afd:'', hal:'', abc:'', fk:null, mk:null, aandacht:null, map:null,
  sel:new Set(), blijf:new Set(), famMeer:false, lastK:{}, undo:null, n:150, vol:new Set(), oefOpen:ls('oefopen') !== '0' };
const now = () => new Date().toISOString();
const dk = iso => { const s = String(iso || ''); return s.length >= 10 ? s.slice(8, 10) + '-' + s.slice(5, 7) : ''; };

/* ---------- stijl (één keer, zoals de lader in ivol.html: altijd de nieuwste) ---------- */
function stijl(){
  if(document.getElementById('pd2-stijl')) return;
  const s = document.createElement('style'); s.id = 'pd2-stijl'; document.head.appendChild(s);
  fetch('wh/pd2.css', { cache:'no-cache' }).then(r => r.ok ? r.text() : '').then(t => { s.textContent = t; }).catch(() => {});
}

/* ---------- selectie ---------- */
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
let BC = { key:null, v:null };
// alle filters behalve familie, maat en aandacht
function basisCodes(zonder){
  const key = [UI.scope, UI.zoek, zonder === 'lev' ? '' : UI.lev, UI.afd, UI.hal, UI.abc, R.S.dataVer, zonder || ''].join('|');
  if(BC.key === key) return BC.v;
  const q = UI.zoek.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let cs = Object.keys(D.P).filter(R.actief);
  if(q.length) cs = cs.filter(c => { const p = D.P[c], t = (c + ' ' + (p.naam || '') + ' ' + (p.locaties_hm || '') + ' ' + (p.leverancier || '')).toLowerCase(); return q.every(w => t.includes(w)); });
  else cs = cs.filter(c => inScope(c, UI.scope));
  if(UI.lev && zonder !== 'lev') cs = cs.filter(c => String((D.P[R.koppelVan(c) || c] || {}).leverancier || '') === UI.lev);
  if(UI.afd) cs = cs.filter(c => gangVan(c) === UI.afd);
  if(UI.hal) cs = cs.filter(c => gangVan(c).slice(0, 1) === UI.hal);
  if(UI.abc) cs = cs.filter(c => (R.abcVan(R.koppelVan(c) || c) || '–') === UI.abc);
  BC = { key, v:cs };
  return cs;
}
const famCodes = () => { let cs = basisCodes(); if(UI.fk) cs = cs.filter(c => R.famVan(c) === UI.fk); return cs; };
const maatCodes = () => { let cs = famCodes(); if(UI.mk !== null && UI.fk) cs = cs.filter(c => R.maatVan(c) === UI.mk); return cs; };
// aandachtspunten per product (vooraf voor alle families in de selectie; bewaard per familie-versie)
const AC = new Map();
function aandachtVan(c){
  const fv = R.S.famVer[R.famVan(c)] || 0, h = AC.get(c);
  if(h && h.fv === fv && h.dv === R.S.dataVer && Date.now() - h.op < 5 * 60e3) return h.v;
  const v = aandachtReken(c); AC.set(c, { fv, dv:R.S.dataVer, op:Date.now(), v });
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
const AAND = [['tewegen', 'gewicht te wegen'], ['gewicht', 'gewicht 0, leeg of afwijkend'], ['loper', 'loper zonder picklocatie'], ['zonderpick', 'zonder picklocatie'], ['geenloc', 'voorraad op geen specifieke locatie'],
  ['tegen', 'per pallet meer dan ooit besteld'], ['hoogte', 'hoogte past niet in de hal'], ['ligger', 'palletgewicht boven ligger-limiet'], ['doos', 'aanvullen met geen veelvoud van de doos'], ['twijfel', 'twijfel-soort']];
const selCodes = () => { let cs = maatCodes().filter(c => !R.isKoppel(c)); if(UI.aandacht) cs = cs.filter(c => aandachtVan(c).includes(UI.aandacht)); return cs; };
function weegCodes(){
  const s = new Set();
  Object.entries(R.S.o.p).forEach(([c, p]) => { if(p.gew && p.gew.st === 'tewegen' && D.P[c]) s.add(c); });
  Object.entries(WHPD.S.pd).forEach(([c, r]) => { if(D.P[c] && r.data && R.isOnb(r.data.kgst) && R.gewicht(c).st === 'tewegen') s.add(c); });
  return [...s];
}
// Weg-voorstel voor alle actieve producten, ook buiten de scope (berekend per gegevensversie)
let WC = { dv:-1, m:null };
function wegAlle(){
  if(WC.dv === R.S.dataVer && WC.m) return WC.m;
  const m = {}; Object.keys(D.P).forEach(c => { const w = R.wegLicht(c); if(w) m[c] = w.v; });
  WC = { dv:R.S.dataVer, m }; return m;
}
const wegAlleCodes = v => Object.entries(wegAlle()).filter(([c, w]) => w === v && !(R.po(c) && (R.po(c).weg || R.po(c).so))).map(([c]) => c).concat([...UI.blijf].filter(c => wegAlle()[c] === v && R.po(c) && R.po(c).weg));
function tabVan(c){ const st = R.status(c); return st.af ? 'afgerond' : st.so || 'pick'; }
function tabCodes(tab, cs){
  cs = cs || selCodes();
  if(tab === 'weeglijst') return weegCodes();
  if(tab === 'rollen') return cs.filter(c => R.isRol(c) && (!R.status(c).af || UI.blijf.has(c)));
  if(tab === 'afgerond') return cs.filter(c => R.status(c).af && !UI.blijf.has(c));
  if(tab === 'weg' && UI.wegAlle) return wegAlleCodes(UI.wegAlle);
  if(tab === 'weg' && UI.map) return cs.filter(c => { const st = R.status(c); return st.so === 'weg' && R.wegWaarde(c).v === UI.map && st.af; });
  return cs.filter(c => { const st = R.status(c); return (!st.af && (st.so || 'pick') === tab) || (UI.blijf.has(c) && st.so === tab); });
}
const sorteer = cs => cs.slice().sort((a, b) => String(R.maatVan(a)).localeCompare(String(R.maatVan(b)), 'nl', { numeric:true }) || (('ABC'.indexOf(R.abcVan(a)) + 4) % 4) - (('ABC'.indexOf(R.abcVan(b)) + 4) % 4) || a.localeCompare(b));

/* ---------- families en maatgroepen ---------- */
const FC = { key:null, v:null };
function families(){
  const cs = basisCodes(), key = BC.key + '|' + R.S.ver;
  if(FC.key === key) return FC.v;
  const per = {};
  cs.forEach(c => { if(R.isKoppel(c)) return; (per[R.famVan(c)] = per[R.famVan(c)] || []).push(c); });
  const I = WHPD.index();
  const uit = Object.entries(per).map(([fk, l]) => {
    const st = l.map(R.status), af = st.filter(s => s.af).length;
    const nA = l.filter(c => R.abcVan(c) === 'A').length, nB = l.filter(c => R.abcVan(c) === 'B').length, nIn = l.filter(c => I.binnen.has(c)).length;
    const aand = l.reduce((n, c) => n + aandachtVan(c).length, 0);
    return { fk, naam:R.famNaam(fk), n:l.length, maten:new Set(l.map(R.maatVan)).size, af, aand, score:nA * 3 + nB * 2 + nIn * 2 + aand };
  }).sort((a, b) => b.score - a.score || b.n - a.n || a.naam.localeCompare(b.naam));
  FC.key = key; FC.v = uit;
  return uit;
}
function maatgroepen(){
  const cs = famCodes().filter(c => !R.isKoppel(c)), per = new Map();
  cs.forEach(c => { const k = R.maatVan(c); if(!per.has(k)) per.set(k, []); per.get(k).push(c); });
  const delen = x => String(x || '').split('·').filter(y => y.trim()).length;
  return [...per.entries()].map(([k, l]) => {
    const nat = l.map(c => WHPD.maatSig(R.naamVan(c))).filter(x => x && (!k || x.startsWith(k)));
    const t = [k].concat(nat).filter(Boolean).sort((a, b) => delen(b) - delen(a) || b.length - a.length)[0] || 'zonder maat';
    const st = l.map(R.status), per2 = {};
    st.forEach(s => { if(!s.af && s.so) per2[s.so] = (per2[s.so] || 0) + 1; });
    return { k, cs:l, t, af:st.filter(s => s.af).length, open:st.filter(s => !s.af).length, per:per2 };
  }).sort((a, b) => { const d = x => { const m = String(x.k).match(/(\d+[.,]?\d*)x(\d+[.,]?\d*)/); return m ? num(m[1]) * num(m[2]) : 1e12; }; return d(a) - d(b) || String(a.k).localeCompare(String(b.k), 'nl', { numeric:true }); });
}

/* ---------- oefening: opdrachten per tab ---------- */
const VB = { mars:'schoonloopmat mars', spurt:'trapmaantje spurt', kokos:'kokos', fwb:'whiteboard zonder rand', ring:'ringmat op rol', henri:'wandrek', sam:'sam europe', waterhog:'waterhog' };
const OPDR = {
  pallet:[
    { id:'p1', t:'Kies bij de FWB-whiteboards een maat en druk op "Selectie klopt" (vinkje bij de rijen).', toon:{ zoek:VB.fwb }, ev:'selklopt', als:d => d.tab === 'pallet' },
    { id:'p2', t:'Pas bij één product Stuks per pallet aan en kijk hoe Gewicht volle pallet meerekent.', ev:'veld', als:d => d.tab === 'pallet' && d.k === 'spp' },
    { id:'p3', t:'Zet één product naar Deel (kolom Soort of de actiebalk).', ev:'soort', als:d => d.tab === 'pallet' && d.naar === 'deel' },
    { id:'p4', t:'Vul een Hoogte in die niet past (bijv. 190 bij een 20-locatie in hal A) en zie de waarschuwing.', ev:'veld', als:d => d.k === 'hoogte' && d.warn }
  ],
  deel:[
    { id:'d1', t:'Open Schoonloopmat Mars, maat 120x180: staat Antraciet als Deel?', toon:{ zoek:VB.mars, maat:'120x180' }, ev:'maat', als:d => /mars/i.test(d.naam || '') && /120x180/.test(d.mk || '') },
    { id:'d2', t:'Vul bij één product Aanvullen bij en Max op pick in en zie Aanvullen met (grijs) meerekenen.', ev:'veld', als:d => d.tab === 'deel' && (d.k === 'lvl' || d.k === 'maxpick') && d.beide },
    { id:'d3', t:'Vul bij Trapmaantje Spurt een Inkoopverpakking in (bijv. 15 doos) en zie de waarschuwing als Aanvullen met geen veelvoud is.', toon:{ zoek:VB.spurt }, ev:'veld', als:d => d.k === 'verp' },
    { id:'d4', t:'Kies bij één product Picklocatie: geen pick (alleen bulk, per order verplaatsen).', ev:'pickc', als:d => d.v === 'geenpick' }
  ],
  pick:[
    { id:'k1', t:'Controleer een picklocatie: kies "klopt".', ev:'pickc', als:d => d.v === 'klopt' },
    { id:'k2', t:'Kies bij een product zonder picklocatie "moet pick krijgen" (tik op Aandacht: zonder picklocatie).', ev:'pickc', als:d => d.v === 'moetpick' },
    { id:'k3', t:'Bevestig of pas Max op pick aan (voorstel = meest gebruikte inkoop per order). Bekijk Trapmaantje Spurt Rood 26x65.', toon:{ zoek:VB.spurt }, ev:'veld', als:d => d.tab === 'pick' && d.k === 'maxpick' }
  ],
  mix:[
    { id:'m1', t:'Geef 3 producten dezelfde mixgroep (bijv. Trapmaantje Spurt Rood en Blauw).', toon:{ zoek:VB.spurt }, staat:() => mixDrie() },
    { id:'m2', t:'Maak een nieuwe mixgroep (keuze "nieuw…" in de kolom Mixgroep).', ev:'mgnieuw' },
    { id:'m3', t:'Tik op een mixgroep-regel boven de lijst: leden en bulklocaties.', ev:'mgregel' }
  ],
  weg:[
    { id:'w1', t:'Zet een product op Backorder (bijv. Waterhog zonder voorraad).', toon:{ zoek:VB.waterhog }, ev:'weg', als:d => d.v === 'backorder' },
    { id:'w2', t:'Zet een product op Archief.', ev:'weg', als:d => d.v === 'archief' },
    { id:'w3', t:'Open een map (Uitlopend, Backorder of Archief) en zet er één terug.', ev:'wegterug' }
  ],
  rollen:[
    { id:'r1', t:'Markeer een product als rol (bijv. Kokos of ringmat op rol): chip "rol?" → is rol.', toon:{ zoek:VB.kokos }, ev:'rol', als:d => d.v === true },
    { id:'r2', t:'Vul de rolgegevens in: breedte, lengte volle rol en gewicht volle rol.', staat:() => Object.values(R.S.o.p).some(p => p.rol && p.rol.v && ['rb', 'rl', 'rkg'].every(k => p.f && p.f[k])) },
    { id:'r3', t:'Zie kg per meter (grijs) en kies Staand of liggend.', ev:'veld', als:d => d.k === 'rstand' }
  ],
  afgerond:[
    { id:'a1', t:'Rond een product af: alle velden van zijn soort groen en het gewicht goedgekeurd.', staat:() => Object.keys(R.S.o.p).some(c => D.P[c] && R.status(c).af) },
    { id:'a2', t:'Heropen een product in deze tab.', ev:'heropen' },
    { id:'a3', t:'Rond een product af met gewicht "te wegen": het krijgt een ⚖ en blijft op de Weeglijst.', staat:() => Object.keys(R.S.o.p).some(c => D.P[c] && R.status(c).af && R.gewicht(c).st === 'tewegen') }
  ],
  weeglijst:[
    { id:'g1', t:'Vink een paar producten aan en pas met "Gewichten aanpassen…" het gewicht aan.', ev:'gewpop' },
    { id:'g2', t:'Zet een product op "te wegen" (tik op de gewicht-chip).', ev:'gewst', als:d => d.st === 'tewegen' },
    { id:'g3', t:'Open de Weeglijst.', ev:'tab', als:d => d.tab === 'weeglijst' },
    { id:'g4', t:'Vul op de Weeglijst bij een product het gewogen kg in.', ev:'gewogen' }
  ]
};
function mixDrie(){ const t = {}; Object.values(R.S.o.p).forEach(p => { const m = p.f && p.f.mixgroep; if(m && m.v) t[m.v] = (t[m.v] || 0) + 1; }); return Object.values(t).some(n => n >= 3); }
function meld(ev, d){
  d = d || {};
  Object.entries(OPDR).forEach(([tab, l]) => l.forEach(o => {
    if(o.ev !== ev || (R.S.o.oef[tab] && R.S.o.oef[tab][o.id])) return;
    let ok = false; try{ ok = !o.als || o.als(d); }catch(e){}
    if(ok && R.oefDone(tab, o.id)) WH.toast('Opdracht gedaan ✓ ' + TABT[tab] + ': ' + o.t.split(/[.:(]/)[0], 3500);
  }));
}
function staatCheck(){
  Object.entries(OPDR).forEach(([tab, l]) => l.forEach(o => {
    if(!o.staat || (R.S.o.oef[tab] && R.S.o.oef[tab][o.id])) return;
    let ok = false; try{ ok = o.staat(); }catch(e){}
    if(ok && R.oefDone(tab, o.id)) WH.toast('Opdracht gedaan ✓ ' + TABT[tab], 3000);
  }));
}

/* ---------- kleine bouwstenen ---------- */
const aan = id => R.AANNAMES[id] ? `<button class="pd2-aan ${R.S.fb.aann[id] ? (R.S.fb.aann[id].v === 'nee' ? 'nee' : 'ja') : ''}" data-a="aanname" data-id="${id}" title="Aanname: tik voor uitleg">aanname</button>` : '';
const abcB = c => { const a = R.abcVan(c); return a ? `<span class="pd2-abc ${a}">${a}</span>` : '<span class="pd2-abc">–</span>'; };
const vkTxt = c => { const a = R.vk6(c), b = R.vk28(c); return nf(a) + '*6' + ' / ' + (b === null ? '–' : nf(b)) + '*28'; };
function vrTxt(I){
  const f = I.f, d = [];
  if(f.pick.length) d.push('<b>pick</b> ' + f.pick.slice(0, 2).map(x => `<span class="p">${esc(x.n)}</span> ${nf(x.v)}${x.tijd ? ' <span class="t">tijd.</span>' : ''}`).join(', ') + (f.pick.length > 2 ? ' +' + (f.pick.length - 2) : ''));
  else d.push('<span class="t">geen picklocatie</span>');
  if(f.bulk.length) d.push('<b>bulk</b> ' + f.bulk.slice(0, 3).map(x => `<span class="p">${esc(x.n)}</span> ${nf(x.v)}`).join(', ') + (f.bulk.length > 3 ? ' +' + (f.bulk.length - 3) : ''));
  if(f.vst) d.push('<b>VST</b> ' + nf(f.vst));
  if(f.geen) d.push('<span class="t">geen locatie ' + nf(f.geen) + '</span>');
  const bron = f.bron === 'live' ? `<span class="pd2-bron live" title="live uit Picqer${f.via === 'stand' ? ' (pickstand live advies)' : ''}">live ${uur(f.t)}</span>` : `<span class="pd2-bron exp" title="nog niet live opgehaald">voorraad van ${esc(dk(f.t) || '?')}</span>`;
  return `<div class="pd2-vr">${d.join(' · ')} ${bron}</div>`;
}
const inkTxt = I => I.ink ? 'meestal ' + nf(I.ink.meestal) : '<span class="m">–</span>';
const GEWKORT = { niet:'niet gecontr.', gewogen:'gewogen', vertrouwd:'vertrouwd', tewegen:'te wegen' };
function gewKnop(c){
  const g = R.gewicht(c), afw = g.st === 'niet' && !R.isSam(c) ? R.gewAfwijking(c) : '';
  return `<button class="pd2-gew ${g.st}${afw ? ' let' : ''}" data-a="gew" title="${esc(((R.GEWST.find(x => x[0] === g.st) || [])[1] || '') + (afw ? ' · ' + afw : ''))}"><b>${g.kg > 0 ? nf(g.kg, g.kg < 10 ? 3 : 1) + ' kg' : '? kg'}</b><i>${esc(GEWKORT[g.st] || '')}${g.vast ? ' · vast' : ''}</i></button>`;
}
const opmN = c => R.S.fb.opm.filter(x => x.code === c).length;
const cls = (w, nodig) => w.st === 'leeg' ? (nodig ? 'c-leeg' : 'c-nvt') : 'c-' + w.st;   // c-uitzoeken = rood met reden
function veldCel(c, k, I, nodig){
  const d = R.VELD[k];
  if(I.sam && !R.SAMVELD.has(k)) return `<td class="c-nvt"><i class="pd2-tag sam">SAM: minimaal</i></td>`;
  if(d.calc){
    const x = R.calc(c, k, I);
    return `<td class="${x.uitzoeken ? 'c-uitzoeken' : x.oranje ? 'c-twijfel' : 'c-calc'}${x.vs ? ' vs' : ''}" title="${esc(x.why || '')}">${esc(x.v || '–')}${x.warn ? `<span class="pd2-w">${esc(x.warn)}</span>` : ''}</td>`;
  }
  if(k === 'pickc') return pickCel(c, I, nodig);
  const w = R.waarde(c, k, I), v = w.v, tt = esc((w.why ? w.why : '') + (w.st === 'vastgelegd' ? '' : ''));
  let ctl = '';
  if(d.type === 'num' || d.type === 'tekst'){
    const cl = d.type === 'num' ? 'n' : k === 'vn' ? 'vn' : 'tx';
    ctl = `<input class="${cl}" data-k="${k}" value="${esc(v)}" placeholder="${w.st === 'leeg' ? (nodig ? '?' : '') : ''}" ${d.type === 'num' ? 'inputmode="decimal"' : ''} autocomplete="off" aria-label="${esc(d.t)}">`;
  }else if(d.type === 'maat'){
    const lijst = R.MATEN.concat(/whiteboard|^fwb/i.test(R.naamVan(c) + ' ' + c) ? R.MATEN_WB : []);
    const extra = v && !lijst.includes(v) ? [v] : [];
    ctl = `<select data-k="${k}" aria-label="Palletmaat"><option value=""></option>${extra.concat(lijst).map(m => `<option ${m === v ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>${extra.length ? aan('maat') : ''}`;
  }else if(d.type === 'keus'){
    ctl = `<select data-k="${k}" aria-label="${esc(d.t)}"><option value=""></option>${d.opt.map(([a, b]) => `<option value="${a}" ${a === v ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  }else if(d.type === 'verp'){
    const m = String(v || '').match(/^\s*(\d+(?:[.,]\d+)?)?\s*(.*)$/), n = m && m[1] ? m[1] : '', s = m ? m[2].trim() : '';
    ctl = `<input class="n" data-k="verp" data-d="n" value="${esc(n)}" inputmode="decimal" autocomplete="off" aria-label="Inkoopverpakking aantal" style="width:52px"> <select data-k="verp" data-d="s" aria-label="Inkoopverpakking soort"><option value=""></option>${R.VERP.map(x => `<option ${x === s ? 'selected' : ''}>${x}</option>`).join('')}</select>`;
  }else if(d.type === 'mix'){
    const al = [...new Set(R.S.o.mg.concat(Object.values(R.S.o.p).map(p => p.f && p.f.mixgroep && p.f.mixgroep.v).filter(Boolean)).concat(v ? [v] : []))].sort();
    ctl = `<select data-k="mixgroep" aria-label="Mixgroep" style="max-width:190px"><option value=""></option>${al.map(m => `<option ${m === v ? 'selected' : ''}>${esc(m)}</option>`).join('')}<option value="__nieuw">nieuw…</option></select>`;
  }
  let extra = '';
  if(k === 'hoogte'){ const hw = R.hoogteWaarsch(c, v, I); if(hw) extra = `<span class="pd2-w">${esc(hw)}</span>`; }
  if(w.st === 'twijfel') extra += `<span class="pd2-s">twijfel${w.alt ? ': ' + esc(w.alt.join(' / ')) : ''}${w.sc && w.sc.p < 0.6 ? ' · klopte ' + Math.round(w.sc.p * 100) + '%' : ''}</span>`;
  if(w.st === 'vastgelegd') extra += '<span class="pd2-s">vastgelegd</span>';
  if(w.st === 'leeg' && nodig && w.why) extra += `<span class="pd2-w" title="${esc(w.why)}">uitzoeken: ${esc(w.why.split(':')[0].slice(0, 60))}</span>`;
  if(w.st === 'uitzoeken') extra += `<span class="pd2-w">uitzoeken: ${esc(w.why.split(' (voorstel was')[0])}</span><span class="pd2-s">voorstel ${esc(w.afgewezen)} afgewezen</span>`;
  else if(w.ct && w.st === 'twijfel' && !w.alt) extra += `<span class="pd2-s">${esc(w.ct.why)}</span>`;
  return `<td class="${cls(w, nodig)}" title="${tt}" data-kc="${k}">${ctl}${extra}</td>`;
}
function pickCel(c, I, nodig){
  const w = R.waarde(c, 'pickc', I), f = I.f, heeft = f.pick.length > 0;
  const opt = heeft ? R.PICKC.filter(x => x[0] !== 'moetpick') : R.PICKC.filter(x => x[0] !== 'klopt');
  const loc = heeft ? f.pick.slice(0, 2).map(x => `${esc(x.n)} · ${nf(x.v)} · ${x.tijd ? 'tijdelijk' : 'vast'}`).join('<br>') : 'geen picklocatie';
  const e = R.eigen(c, 'pickc');
  return `<td class="${cls(w, nodig)}" data-kc="pickc"><span class="pd2-s" style="color:#22303d;font-family:ui-monospace,Consolas,monospace">${loc}</span><select data-k="pickc" aria-label="Picklocatie controle"><option value=""></option>${opt.map(([a, b]) => `<option value="${a}" ${a === w.v ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>${e && e.opm ? `<span class="pd2-s">${esc(e.opm)}</span>` : ''}${w.v === 'geenpick' ? aan('geenpick') : ''}</td>`;
}
function soortCel(c, I){
  const w = R.soortWaarde(c, I), extra = [];
  if(w.st === 'twijfel') extra.push(`<span class="pd2-tag tw">twijfel${w.alt ? ': ' + esc(w.alt.map(x => R.SOORTT[x]).join(' / ')) : ''}${w.sc && w.sc.p < 0.6 ? ' · klopte ' + Math.round(w.sc.p * 100) + '%' : ''}</span>`);
  if(w.st === 'vastgelegd') extra.push('<span class="pd2-s">vastgelegd</span>');
  if(I.sam) extra.push('<i class="pd2-tag sam">SAM: minimaal</i>');
  if(R.isRol(c) && !R.rolVoorstel(c)) extra.push('<i class="pd2-tag rol">rol</i>');
  else if(R.rolVoorstel(c)) extra.push(`<span class="pd2-s"><i class="pd2-tag rol">rol?</i> <button class="knop klein" data-a="rol" data-v="1">is rol</button> <button class="knop klein" data-a="rol" data-v="0">geen rol</button></span>`);
  return `<td class="c-${w.st === 'leeg' ? 'leeg' : w.st}" data-kc="soort" title="${esc(w.why || '')}"><select data-k="soort" aria-label="Soort"><option value=""></option>${R.SOORTEN.map(([a, b]) => `<option value="${a}" ${a === w.v ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>${extra.join('')}</td>`;
}
function wegCel(c, I){
  const w = R.wegWaarde(c, I);
  return `<td class="c-${w.st === 'leeg' ? 'leeg' : w.st}" data-kc="weg" title="${esc(w.why || '')}"><select data-k="weg" aria-label="Weg-keuze"><option value=""></option>${R.WEG.map(([a, b]) => `<option value="${a}" ${a === w.v ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>${w.why && w.st === 'voorstel' ? `<span class="pd2-s">${esc(w.why)}</span>` : ''}</td>`;
}

/* ---------- rijen ---------- */
function prodCel(c){
  const I = R.info(c), st = R.status(c), aanS = UI.sel.has(c);
  return `<td class="k0"><div class="pd2-prod"><input type="checkbox" data-a="sel" ${aanS ? 'checked' : ''} aria-label="Selecteer ${esc(c)}"><a class="code" href="./productkaart.html" target="_blank" rel="noopener" data-a="kaart">${esc(c)}</a><button class="pd2-naam${UI.vol.has(c) ? ' vol' : ''}" data-a="naam" title="${esc(R.naamVan(c))}">${esc(R.naamVan(c))}</button>${st.af ? '<span></span><span><i class="pd2-tag af">✓ afgerond' + (st.gew.st === 'tewegen' ? ' ⚖' : '') + '</i></span>' : ''}</div></td>`;
}
function vasteCellen(c, I){
  return `${prodCel(c)}<td>${abcB(c)}</td><td>${vrTxt(I)}</td><td class="ink">${inkTxt(I)}</td><td title="gemiddeld per maand, over 6 maanden / over 28 dagen">${vkTxt(c)}</td><td>${gewKnop(c)}</td>
    <td><button class="pd2-ic" data-a="info" aria-label="Redenen">ⓘ</button></td><td><button class="pd2-ic" data-a="opm" aria-label="Opmerking">💬${opmN(c) ? `<sup>${opmN(c)}</sup>` : ''}</button></td>`;
}
const VASTE_KOP = `<th class="k0">Product</th><th>ABC</th><th>Voorraad</th><th>Inkoop</th><th>Verkoop</th><th>Gewicht/st</th><th title="redenen">ⓘ</th><th title="opmerking">💬</th>`;
function rijHtml(c, tab){
  const I = R.info(c), st = R.status(c);
  const trc = (st.af ? 'af' : '') + (UI.sel.has(c) ? ' sel' : '');
  if(tab === 'weg') return `<tr data-c="${esc(c)}" class="${trc}">${vasteCellen(c, I)}${soortCel(c, I)}${wegCel(c, I)}<td>${I.ink ? dk(I.ink.laatste) + '-' + String(I.ink.laatste).slice(0, 4) : '–'}</td><td>${(() => { const b = R.backorders(c); return b ? nf(b.n) + ' (' + nf(b.stuks) + ' st)' : '–'; })()}</td>${UI.map ? `<td><button class="knop klein" data-a="wegterug">terugzetten</button></td>` : ''}</tr>`;
  if(tab === 'afgerond'){
    const so = R.soortWaarde(c, I), vel = R.nodigVan(c, so.v, I).map(k => (R.VELD[k].kort || R.VELD[k].t) + ' ' + (R.waarde(c, k, I).v || '–')).join(' · ');
    return `<tr data-c="${esc(c)}" class="${trc}">${vasteCellen(c, I)}<td class="c-bevestigd">${esc(R.SOORTT[so.v] || '')}${so.v === 'weg' ? ' · ' + esc(R.wegWaarde(c, I).v) : ''}${R.isRol(c) ? ' <i class="pd2-tag rol">rol</i>' : ''}</td><td style="white-space:normal;min-width:240px;font-size:12px">${esc(vel)}${st.gew.st === 'tewegen' ? ' · ⚖ te wegen' : ''}</td><td><button class="knop klein" data-a="heropen">heropenen</button></td></tr>`;
  }
  const kols = tab === 'rollen' ? R.KOLOMMEN.rollen : R.KOLOMMEN[tab] || [];
  const nodig = new Set(R.nodigVan(c, st.so, I));
  return `<tr data-c="${esc(c)}" class="${trc}">${vasteCellen(c, I)}${soortCel(c, I)}${kols.map(k => veldCel(c, k, I, nodig.has(k))).join('')}</tr>`;
}
function kopHtml(tab){
  if(tab === 'weg') return `<tr>${VASTE_KOP}<th>Soort ${aan('soortkol')}</th><th>Keuze</th><th>Laatste inkoop</th><th>Backorders</th>${UI.map ? '<th></th>' : ''}</tr>`;
  if(tab === 'afgerond') return `<tr>${VASTE_KOP}<th>Soort</th><th>Ingevuld</th><th></th></tr>`;
  const kols = tab === 'rollen' ? R.KOLOMMEN.rollen : R.KOLOMMEN[tab] || [];
  return `<tr>${VASTE_KOP}<th>Soort ${aan('soortkol')}</th>${kols.map(k => `<th title="${esc(R.VELD[k].t)}">${esc(R.VELD[k].kort || R.VELD[k].t)}${R.VELD[k].calc ? ' <span style="font-weight:400">(berekend)</span>' : ''}${k === 'maxlig' ? ' ' + aan('maxlig') : k === 'hoogte' ? ' ' + aan('hoogte') : ''}</th>`).join('')}</tr>`;
}

/* ---------- onderdelen van de pagina ---------- */
const uur = d => { d = d instanceof Date ? d : new Date(d); return isNaN(d) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const exportTxt = () => 'voorraad van ' + (dk(D.VRDATUM) || '?');
function liveTekst(){
  const L = R.liveStatus();
  if(!L.gekoppeld) return 'Picqer niet gekoppeld op dit apparaat: ' + exportTxt();
  if(L.wachtTot) return 'voorraad live: Picqer even niet bereikbaar, opnieuw om ' + uur(L.wachtTot) + ' (tot dan ' + exportTxt() + ')';
  if(L.bezig || L.rij) return 'voorraad live ophalen… nog ' + nf(L.rij);
  return 'voorraad live';
}
function oefenBalk(){
  const b = R.S.bewaar;
  const st = [R.S.uitSnap ? 'gegevens van ' + uur(R.S.uitSnap) + ', bijwerken…' : R.S.bijgewerkt ? 'bijgewerkt ' + uur(R.S.bijgewerkt) : '', b.bezig ? 'bewaren…' : b.fout ? 'bewaren mislukt, opnieuw over 5 s' : b.op ? 'bewaard ' + uur(b.op) : ''].filter(Boolean).join(' · ');
  return `<div class="pd2-oefenbalk" role="status"><span class="tb">Oefenmodus: niets gaat naar de echte productdata <span class="muted klein" style="font-weight:600">${esc(st)}${st ? ' · ' : ''}${esc(liveTekst())}</span>${R.S.uitSnap ? ' ' + aan('snap') : ''}</span>
    <button class="knop" data-a="wissen">Oefendata wissen</button> <button class="knop pri" data-a="kopieer">Kopieer alles voor Claude</button>${R.pd2Overzetten ? ' <button class="knop" data-a="overzet">Bevestigd naar echte productdata</button>' : ''}</div>`;
}
function filtersHtml(){
  const cs = basisCodes('lev'), levs = [...new Set(cs.map(c => String((D.P[R.koppelVan(c) || c] || {}).leverancier || '')).filter(Boolean))].sort();
  const all = basisCodes(), gangen = [...new Set(all.map(gangVan).filter(Boolean))].sort(), hallen = [...new Set(gangen.map(g => g.slice(0, 1)))].sort();
  return `<section class="pd2-blok"><div class="pd2-filters">
    <input type="search" id="pd2-zoek" placeholder="Zoek op code, naam of locatie" value="${esc(UI.zoek)}" aria-label="Zoeken">${UI.zoek ? aan('zoek') : ''}
    <select data-f="lev" aria-label="Leverancier"><option value="">Alle leveranciers</option>${levs.concat(UI.lev && !levs.includes(UI.lev) ? [UI.lev] : []).map(l => `<option ${l === UI.lev ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    <select data-f="afd" aria-label="Afdeling"><option value="">Alle afdelingen</option>${gangen.concat(UI.afd && !gangen.includes(UI.afd) ? [UI.afd] : []).map(g => `<option ${g === UI.afd ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
    <select data-f="hal" aria-label="Hal"><option value="">Alle hallen</option>${hallen.concat(UI.hal && !hallen.includes(UI.hal) ? [UI.hal] : []).map(h => `<option value="${esc(h)}" ${h === UI.hal ? 'selected' : ''}>Hal ${esc(h)}</option>`).join('')}</select>
    <select data-f="abc" aria-label="ABC"><option value="">ABC: alle</option>${['A', 'B', 'C', '–'].map(a => `<option ${a === UI.abc ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
    <div class="pd2-chips" role="group" aria-label="Scope">${SCOPES.map(([k, t]) => `<button data-a="scope" data-v="${k}" class="${UI.scope === k && !UI.zoek ? 'aan' : ''}">${esc(t)}</button>`).join('')}</div></section>`;
}
function basisHtml(){
  const cs = UI.fk ? (UI.mk !== null ? maatCodes() : famCodes()) : basisCodes(), echte = cs.filter(c => !R.isKoppel(c)), kop = cs.filter(c => R.isKoppel(c));
  if(!echte.length) return `<section class="pd2-blok pd2-basis"><b>Geen producten met deze filters.</b></section>`;
  const levs = [...new Set(echte.map(c => (D.P[c] || {}).leverancier).filter(Boolean))], gangen = [...new Set(echte.map(gangVan).filter(Boolean))].sort();
  const abc = { A:0, B:0, C:0, '–':0 }; echte.forEach(c => { abc[R.abcVan(c) || '–']++; });
  const v6 = echte.reduce((s, c) => s + R.vk6(c), 0), v28 = echte.reduce((s, c) => s + (R.vk28(c) || 0), 0);
  const inkm = {}; echte.forEach(c => R.inkomend(c).forEach(x => { const k = x.ref + '|' + x.eta; inkm[k] = inkm[k] || { ref:x.ref, eta:x.eta, n:0 }; inkm[k].n++; }));
  const ink = Object.values(inkm).sort((a, b) => String(a.eta).localeCompare(String(b.eta)));
  const zonderPick = echte.filter(c => !R.info(c).f.pick.length && R.som(R.info(c).f.bulk) + R.info(c).f.geen + R.info(c).f.vst > 0).length;
  const geen = echte.filter(c => R.info(c).f.geen > 0).length;
  const maten = new Set(echte.map(R.maatVan)).size;
  const titel = UI.fk ? esc(R.famNaam(UI.fk)) + (UI.mk !== null ? ' · ' + esc(UI.mk || 'zonder maat') : '') : 'Hele filterselectie';
  const bron = (() => { let l = 0, e = 0; echte.forEach(c => { if(R.info(c).f.bron === 'live') l++; else e++; }); return (l ? nf(l) + ' live' : '') + (l && e ? ' · ' : '') + (e ? nf(e) + ' ' + exportTxt() : ''); })();
  return `<section class="pd2-blok pd2-basis"><div class="rij" style="align-items:baseline"><h2>${titel}</h2><span class="muted klein">voorraad: ${esc(bron)} ${aan('live')}</span></div>
    <div class="rij"><span><span class="l">Leverancier</span> ${esc(levs.slice(0, 2).join(', ') + (levs.length > 2 ? ' +' + (levs.length - 2) : '') || '–')}</span>
    <span><span class="l">Afdeling en gangen</span> ${esc(gangen.slice(0, 8).join(', ') + (gangen.length > 8 ? ' …' : '') || '–')}</span>
    <span><span class="l">Producten</span> <b>${nf(echte.length)}</b> · ${nf(maten)} maten${UI.fk ? '' : ' · ' + nf(new Set(echte.map(R.famVan)).size) + ' families'}</span>
    <span><span class="l">ABC</span> A ${abc.A} · B ${abc.B} · C ${abc.C} · – ${abc['–']}</span>
    <span><span class="l">Verkoop</span> <button class="pd2-chip" data-a="uitleg" data-v="vk" style="min-height:30px;padding:2px 9px">${nf(v6)}*6 / ${nf(v28)}*28 ⓘ</button></span>
    <span><span class="l">Inkomend</span> ${ink.length ? ink.slice(0, 3).map(x => esc(x.ref) + (x.eta ? ' (ETA ' + dk(x.eta) + ')' : '')).join(', ') + (ink.length > 3 ? ' +' + (ink.length - 3) : '') : '–'}</span>
    <span><span class="l">Zonder picklocatie</span> ${nf(zonderPick)}</span><span><span class="l">Op geen specifieke locatie</span> ${nf(geen)}</span>
    ${kop.length ? `<span><span class="l">Gekoppeld, niet invullen</span> ${kop.slice(0, 4).map(c => esc(c) + (R.koppelVan(c) ? ' → ' + esc(R.koppelVan(c)) : ' (samengesteld)')).join(', ')}${kop.length > 4 ? ' +' + (kop.length - 4) : ''} ${aan('koppel')}</span>` : ''}</div></section>`;
}
function voortgangHtml(){
  const cs = maatCodes().filter(c => !R.isKoppel(c));
  const st = cs.map(c => [c, R.status(c)]), af = st.filter(x => x[1].af).length, pct = cs.length ? Math.round(af / cs.length * 100) : 0;
  const per = {}; st.forEach(([c, s]) => { const t = s.so || 'pick'; per[t] = per[t] || { af:0, open:0 }; per[t][s.af ? 'af' : 'open']++; });
  const doel = {}; st.forEach(([c, s]) => { if(!s.af) s.open.forEach(k => { doel[k] = (doel[k] || 0) + 1; }); });
  const naam = k => k === 'soort' ? 'soort bevestigen' : k === 'weg' ? 'weg-keuze' : k === 'gewicht' ? 'gewicht' : (R.VELD[k] ? (R.VELD[k].kort || R.VELD[k].t).toLowerCase() : k);
  const aandT = {}; cs.forEach(c => aandachtVan(c).forEach(a => { aandT[a] = (aandT[a] || 0) + 1; }));
  return `<section class="pd2-blok pd2-vg">
    <div class="r"><b>Status</b><span><b>${nf(af)}</b> van ${nf(cs.length)} afgerond</span><span class="balk"><i style="width:${pct}%"></i></span><span class="muted klein">${['pallet', 'deel', 'pick', 'mix', 'weg'].filter(t => per[t]).map(t => R.SOORTT[t] + ' ' + per[t].af + '/' + (per[t].af + per[t].open)).join(' · ')}</span></div>
    <div class="r"><b>Doel</b><span class="klein">${Object.keys(doel).length ? Object.entries(doel).sort((a, b) => b[1] - a[1]).map(([k, n]) => nf(n) + '× ' + esc(naam(k))).join(' · ') : 'alles in deze selectie is afgerond'}</span></div>
    <div class="r"><b>Aandacht</b>${AAND.filter(([k]) => aandT[k] || UI.aandacht === k).map(([k, t]) => `<button class="pd2-aand ${UI.aandacht === k ? 'aan' : ''}" data-a="aandacht" data-v="${k}">${esc(t)} ${nf(aandT[k] || 0)}</button>`).join('') || '<span class="muted klein">niets</span>'}${aandT.tegen ? aan('tegen') : ''}${aandT.gewicht ? aan('gewafw') : ''}${aandT.ligger ? aan('ligger') : ''}${aandT.hoogte ? aan('hoogte') : ''}</div></section>`;
}
function tegelsHtml(){
  if(!UI.fk){
    const L = families(), toon = UI.famMeer ? L : L.slice(0, 24);
    return `<section class="pd2-blok"><div class="rij tussen"><h2>Families <span class="muted klein">${nf(L.length)}</span> ${aan('famtop')}</h2><button class="knop klein" data-a="volgfam">Volgende familie →</button></div>
      <div class="pd2-tegels">${toon.map(f => `<button class="pd2-tegel ${f.af === f.n ? 'groen' : f.af ? 'oranje' : ''}" data-a="fam" data-v="${esc(f.fk)}"><b>${esc(f.naam)}</b><span>${nf(f.n)} producten · ${nf(f.maten)} maten</span><span>${nf(f.af)}/${nf(f.n)} afgerond${f.aand ? ` · <b style="color:var(--warn)">${nf(f.aand)} aandacht</b>` : ''}</span></button>`).join('')}</div>
      ${L.length > 24 ? `<button class="knop klein pd2-meer" data-a="fammeer">${UI.famMeer ? 'Minder' : 'Meer (' + nf(L.length - 24) + ')'}</button>` : ''}</section>`;
  }
  const M = maatgroepen();
  return `<section class="pd2-blok"><div class="rij tussen"><h2>${esc(R.famNaam(UI.fk))} <span class="muted klein">${nf(M.length)} maatgroepen</span></h2><div class="rij">
    <button class="knop klein" data-a="famweg">← Alle families</button>${UI.mk !== null ? '<button class="knop klein" data-a="maat" data-v="">Alle maten</button>' : ''}<button class="knop klein" data-a="volgmaat">Volgende maat →</button><button class="knop klein" data-a="volgfam">Volgende familie →</button></div></div>
    <div class="pd2-tegels">${M.map(m => `<button class="pd2-tegel ${m.open ? (m.af ? 'oranje' : '') : 'groen'} ${UI.mk === m.k ? 'aan' : ''}" data-a="maat" data-v="${esc(m.k)}"><b>${esc(m.t)} · ${nf(m.cs.length)}</b><span>${Object.entries(m.per).map(([s, n]) => n + ' ' + R.SOORTT[s]).join(' ') || '–'}</span><span>${m.open ? nf(m.open) + ' open' : 'alles afgerond'}</span></button>`).join('')}</div></section>`;
}
function tabsHtml(){
  const cs = selCodes(), n = {};
  cs.forEach(c => { const t = tabVan(c); n[t] = (n[t] || 0) + 1; if(R.isRol(c) && t !== 'afgerond') n.rollen = (n.rollen || 0) + 1; });
  n.weeglijst = weegCodes().length;
  return `<nav class="pd2-tabs" aria-label="Tabs">${TABS.map(([k, t]) => `<button data-a="tab" data-v="${k}" class="${UI.tab === k ? 'aan' : ''}">${esc(t)} <i>${nf(n[k] || 0)}</i></button>`).join('')}</nav>`;
}
function oefHtml(){
  const l = OPDR[UI.tab] || [], done = R.S.o.oef[UI.tab] || {}, fb = R.S.fb.tabs[UI.tab] || {}, nDone = l.filter(o => done[o.id]).length;
  return `<details class="pd2-oef" ${UI.oefOpen ? 'open' : ''} data-a="oefdet"><summary>Oefening ${esc(TABT[UI.tab])} <span class="muted klein">${nDone}/${l.length} gedaan</span></summary>
    <ol>${l.map(o => `<li class="${done[o.id] ? 'af' : ''}">${esc(o.t)}${o.toon && !done[o.id] ? ` <button class="knop klein" data-a="toon" data-id="${o.id}">Toon</button>` : ''}</li>`).join('')}</ol>
    <details class="pd2-vragen-d" ${UI.vragenOpen ? 'open' : ''}><summary style="cursor:pointer;font-weight:800;min-height:40px;display:flex;align-items:center">Vier vragen over deze tab <span class="muted klein" style="margin-left:6px">${['layout', 'mis', 'over', 'gevoel'].filter(k => fb[k]).length}/4 beantwoord</span></summary>
    <div class="pd2-vragen" data-tab="${UI.tab}">
      <div><label>Layout van deze tab</label><div class="pd2-chips">${['klopt', 'bijna', 'nee'].map(v => `<button data-a="fb" data-k="layout" data-v="${v}" class="${fb.layout === v ? 'aan' : ''}">${v}</button>`).join('')}</div></div>
      <div><label for="pd2-fb-mis">Wat mis je?</label><textarea id="pd2-fb-mis" data-fb="mis">${esc(fb.mis || '')}</textarea></div>
      <div><label for="pd2-fb-over">Wat is overbodig?</label><textarea id="pd2-fb-over" data-fb="over">${esc(fb.over || '')}</textarea></div>
      <div><label>Gevoel</label><div class="pd2-chips">${[1, 2, 3, 4, 5].map(v => `<button data-a="fb" data-k="gevoel" data-v="${v}" class="${+fb.gevoel === v ? 'aan' : ''}">${v}</button>`).join('')}</div></div>
    </div></details>
    <div class="rij" style="padding-bottom:10px"><button class="knop klein" data-a="opmtab">💬 Opmerking bij deze tab</button><span class="muted klein">${R.S.fb.opm.filter(x => x.tab === UI.tab && !x.code).length} opmerkingen bij deze tab</span></div></details>`;
}
function mixRegels(cs){
  const per = {};
  cs.forEach(c => { const v = R.waarde(c, 'mixgroep').v; if(v) (per[v] = per[v] || []).push(c); });
  const g = Object.entries(per); if(!g.length) return '';
  return `<div class="pd2-mg">${g.map(([m, l]) => { const bulk = [...new Set(l.flatMap(c => R.info(c).f.bulk.filter(x => x.v > 0).map(x => x.n)))]; return `<button data-a="mgregel" data-v="${esc(m)}"><b>${esc(m)}</b> · ${l.length} leden: ${esc(l.slice(0, 5).join(', '))}${l.length > 5 ? ' …' : ''} · bulk: ${esc(bulk.slice(0, 5).join(', ') || '–')}</button>`; }).join('')}</div>`;
}
function lijstHtml(){
  const tab = UI.tab;
  if(tab === 'weeglijst') return weegHtml();
  const cs = sorteer(tabCodes(tab)), toon = cs.slice(0, UI.n);
  let kop = '';
  if(tab === 'weg'){
    const sel = selCodes(), n = {}; sel.forEach(c => { const s = R.status(c); if(s.so === 'weg' && s.af){ const w = R.wegWaarde(c).v; n[w] = (n[w] || 0) + 1; } });
    const wa = {}; Object.keys(wegAlle()).forEach(c => { if(!(R.po(c) && (R.po(c).weg || R.po(c).so))) wa[wegAlle()[c]] = (wa[wegAlle()[c]] || 0) + 1; });
    kop = `${aan('wegalle')}<div class="pd2-chips">${R.WEG.map(([k, t]) => `<button data-a="map" data-v="${k}" class="${UI.map === k ? 'aan' : ''}">Map ${esc(t)} <b>${nf(n[k] || 0)}</b></button>`).join('')}${UI.map ? '<button data-a="map" data-v="">← voorstellen</button>' : ''}</div>
      <div class="pd2-chips"><button data-a="wegalle" data-v="archief" class="${UI.wegAlle === 'archief' ? 'aan' : ''}">Toon alle voorstellen Archief <b>${nf(wa.archief || 0)}</b></button><button data-a="wegalle" data-v="backorder" class="${UI.wegAlle === 'backorder' ? 'aan' : ''}">alle Backorder <b>${nf(wa.backorder || 0)}</b></button><button data-a="wegalle" data-v="uitlopend" class="${UI.wegAlle === 'uitlopend' ? 'aan' : ''}">alle Uitlopend <b>${nf(wa.uitlopend || 0)}</b></button>${UI.wegAlle ? '<button data-a="wegalle" data-v="">← terug naar de selectie</button>' : ''}</div>
      ${UI.wegAlle ? `<p class="muted klein">Alle actieve producten met voorstel ${esc(UI.wegAlle)}, ook buiten de filters. Vink alles aan en druk op "Selectie klopt", of zet er een terug met de kolom Soort.</p>` : ''}`;
  }
  if(tab === 'mix') kop = mixRegels(tabCodes('mix'));
  const alleKnop = !['afgerond'].includes(tab) && !(tab === 'weg' && UI.map) && cs.length ? `<button class="knop klein groen" data-a="alleklopt">Alle voorstellen kloppen (${nf(cs.length)})</button> ${aan('selgew')}` : '';
  return `${kop}<div class="pd2-lijstkop"><label class="klein" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-a="selalle" ${cs.length && cs.every(c => UI.sel.has(c)) ? 'checked' : ''} style="width:20px;height:20px;accent-color:#e8590c"> selecteer alles in deze groep</label>${alleKnop}<span class="muted klein">${nf(cs.length)} producten${UI.blijf.size ? ' · ' + aan('blijf') : ''}</span></div>
    ${cs.length ? `<div class="pd2-tw"><table class="pd2-t" data-tab="${tab}"><thead>${kopHtml(tab)}</thead><tbody>${toon.map(c => rijHtml(c, tab)).join('')}</tbody></table></div>
    ${cs.length > toon.length ? `<button class="knop pd2-meer" data-a="meer">Meer tonen (${nf(cs.length - toon.length)})</button>` : ''}` : `<div class="pd2-leeg">${tab === 'afgerond' ? 'Nog niets afgerond in deze selectie.' : 'Geen producten in deze tab voor deze selectie.'}</div>`}`;
}
// weeglijst: per hal, gang en locatie; op de telefoon per locatie af te werken, ook printbaar (A4)
const REACH = 'Volle pallets wegen met de reachtruck (palletgewicht − 15 kg pallet, gedeeld door stuks per pallet); losse producten op de weegschaal.';
function weegGroepen(){
  const cs = [...new Set(weegCodes().concat([...UI.weegKlaar]))].filter(c => D.P[c]);
  const loc = c => { const f = R.info(c).f; return (f.pick[0] || f.bulk[0] || { n:'' }).n; };
  const per = {};
  cs.forEach(c => { const l = loc(c) || '', hal = /^[A-Z]{2}/i.test(l) ? 'Hal ' + l[0].toUpperCase() : 'Zonder locatie', gang = /^[A-Z]{2}/i.test(l) ? l.slice(0, 2).toUpperCase() : '–'; (((per[hal] = per[hal] || {})[gang] = per[hal][gang] || {})[l || '–'] = per[hal][gang][l || '–'] || []).push(c); });
  return per;
}
// hoe wegen: een product dat per pallet ligt (soort pallet of deel, stuks per pallet bekend) kan met de reachtruck
function weegWijze(c){ const st = R.status(c), spp = R.nOf(R.waarde(c, 'spp').v); return ['pallet', 'deel'].includes(st.so) && spp > 0 ? { reach:true, spp } : { reach:false }; }
function weegHtml(){
  const per = weegGroepen(), hallen = Object.keys(per).sort();
  if(!hallen.length) return '<div class="pd2-leeg">Geen producten op "te wegen". Zet een product op te wegen met de gewicht-chip of "Gewichten aanpassen…".</div>';
  return `<div class="pd2-wl"><div class="rij tussen"><p class="klein" style="max-width:70ch"><b>Reachtruck-regel:</b> ${esc(REACH)} ${aan('reach')}</p><button class="knop" data-a="weegprint">Print weeglijst (A4)</button></div>
    ${hallen.map(h => `<h3>${esc(h)}</h3>${Object.keys(per[h]).sort().map(g => `<h4>Gang ${esc(g)}</h4><div class="pd2-tw"><table class="pd2-t"><thead><tr><th class="k0">Product</th><th>Gewogen kg per stuk</th><th>of palletgewicht</th><th>Wegen</th><th>Picqer</th></tr></thead><tbody>
    ${Object.keys(per[h][g]).sort().map(l => { const cs = per[h][g][l], klaar = cs.filter(c => R.gewicht(c).st !== 'tewegen').length; return `<tr class="pd2-weegloc"><td class="k0"><b class="code">${esc(l)}</b> · ${nf(cs.length)} product${cs.length > 1 ? 'en' : ''}</td><td colspan="4">${klaar === cs.length ? '<b style="color:var(--ok)">locatie klaar ✓</b>' : nf(klaar) + ' van ' + nf(cs.length) + ' klaar'}</td></tr>` + cs.map(c => {
      const gw = R.gewicht(c), w = weegWijze(c), af = gw.st !== 'tewegen';
      return `<tr data-c="${esc(c)}" class="${af ? 'af' : ''}"><td class="k0"><div class="pd2-prod"><span></span><a class="code" href="./productkaart.html" target="_blank" rel="noopener" data-a="kaart">${esc(c)}</a><button class="pd2-naam" data-a="naam">${esc(R.naamVan(c))}</button></div></td>
        <td class="${af ? 'c-bevestigd' : 'c-leeg'}">${af ? '✓ ' + nf(gw.kg, 3) + ' kg' : `<input class="n" data-a="gewogen" inputmode="decimal" placeholder="kg" aria-label="Gewogen kg per stuk ${esc(c)}">`}</td>
        <td class="${af ? 'c-bevestigd' : ''}">${!af && w.reach ? `<input class="n" data-a="palletkg" inputmode="decimal" placeholder="kg pallet" aria-label="Palletgewicht ${esc(c)}" style="width:80px">` : af && gw.via ? 'pallet ' + nf(gw.pallet) + ' kg' : ''}</td>
        <td class="klein" style="white-space:normal;max-width:150px">${w.reach ? 'volle pallet: reachtruck (÷ ' + nf(w.spp) + ')' : 'los: weegschaal'}</td><td>${gw.pq ? nf(gw.pq, 3) + ' kg' : '–'}</td></tr>`; }).join(''); }).join('')}</tbody></table></div>`).join('')}`).join('')}</div>`;
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
function actieHtml(){
  if(!UI.sel.size) return '';
  return `<div class="pd2-actie" role="toolbar" aria-label="Groepsacties"><b>${nf(UI.sel.size)} geselecteerd</b>
    <button class="knop pri" data-a="selklopt">Selectie klopt</button>
    ${R.SOORTEN.map(([k, t]) => `<button class="knop" data-a="allemaal" data-v="${k}">${esc(t.replace(/^\d /, ''))}</button>`).join('')}
    <button class="knop" data-a="gewklopt">Gewichten kloppen</button><button class="knop" data-a="gewpop">Gewichten aanpassen…</button>
    <button class="knop" data-a="isrol">Is rol</button><button class="knop" data-a="kolom">Zelfde waarde voor kolom…</button>
    <button class="knop" data-a="selweg" aria-label="Selectie wissen">×</button></div>`;
}
// score van het soort voorstel bij Daans eigen invoer (meting)
const scoreTxt = w => { if(!w || !['voorstel', 'twijfel'].includes(w.st)) return ''; const sc = w.sc || R.scoreVan(w.r); return sc ? ` <b style="color:${sc.p < 0.6 ? 'var(--warn)' : 'var(--ok)'}">· dit soort voorstel klopte ${Math.round(sc.p * 100)}% bij jouw eigen invoer (${nf(sc.n)}× getoetst)</b>` : (w.r ? ' <i class="muted">· nog te weinig getoetst</i>' : ''); };
const RNAAM = { genoot:'kleurgenoot (2.0 of productdata)', 'leer-fammaat':'geleerd: kleurgenoten', 'leer-fam':'geleerd: familie', 'leer-levmaat':'geleerd: leverancier + maat', 'leer-lev':'geleerd: leverancier', picqer:'huidige stand Picqer', aanvulbase:'aanvulbase', regel:'aanvulregel', wandrek:'regel wandrekken', inkoop:'meest voorkomende inkoop', vst:'verplaatst naar VST', vst2:'≥ 2 VST-pallets gelijk', bulk2:'≥ 2 bulkpallets gelijk', label:'palletlabel', code:'alleen de code', som:'stuks × kg + 15', afm:'afmetingen per stuk' };
const rNaam = r => { const [k, x] = String(r).split(':'); if(/^soort$/.test(k)) return 'soortregel ' + x; return RNAAM[x] || (x || '').replace(/^pd-[a-z]+:/, 'productdata.js: ').replace('+doos', ' + hele dozen'); };
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '–';
function scoresHtml(){
  const M = R.meting(), V = R.SCORE_VOOR, T = R.TOETSVELD;
  const perVeld = {}; Object.entries(M.regels || {}).forEach(([r, g]) => { const k = r.split(':')[0]; const kk = { soort:'opslag', max:'maxpick', kg:'kgst', gewpal:'gewicht' }[k] || k; (perVeld[kk] = perVeld[kk] || []).push([r, g]); });
  return `<details class="pd2-blok" id="pd2-scores"><summary style="cursor:pointer;font-weight:800;min-height:40px;display:flex;align-items:center">Hoe goed zijn de voorstellen</summary>
    <p class="muted klein">Getoetst tegen alle waarden die jij zelf in productdata vastlegde (${nf(M.n)} waarden): per waarde doet 2.0 alsof hij er niet is en vergelijkt het voorstel. Exact gelijk telt; hoogte binnen 10 cm, gewicht binnen 10%. Meting ${esc(M.op ? String(M.op).slice(0, 10) : '')}${M.op && M.op.length > 10 ? ' (op dit apparaat)' : ' (ingebouwd)'}. ${aan('score')} ${aan('leer')}</p>
    <div class="pd2-tw"><table class="pd2-t"><thead><tr><th class="k0">Veld</th><th>Klopt nu</th><th>Ronde 1</th><th>Getoetst</th><th>Voorstel bij</th><th>Klopt als er een voorstel is</th></tr></thead><tbody>
    ${Object.keys(T).map(k => { const v = M.velden[k] || { tot:0, met:0, goed:0 }, o = V.velden[k] || { tot:0, goed:0 }; return `<tr><td class="k0"><b>${esc(T[k])}</b></td><td><b>${pct(v.goed, v.tot)}</b></td><td>${pct(o.goed, o.tot)}</td><td>${nf(v.tot)}</td><td>${pct(v.met, v.tot)}</td><td>${pct(v.goed, v.met)}</td></tr>`; }).join('')}
    </tbody></table></div>
    <details><summary style="cursor:pointer;font-weight:700;min-height:36px;display:flex;align-items:center">Per regel</summary>
    <div class="pd2-tw"><table class="pd2-t"><thead><tr><th class="k0">Veld · regel</th><th>Getoetst</th><th>Klopt</th></tr></thead><tbody>
    ${Object.entries(perVeld).map(([k, l]) => l.sort((a, b) => b[1].tot - a[1].tot).map(([r, g]) => `<tr><td class="k0">${esc((T[k] || k) + ' · ' + rNaam(r))}</td><td>${nf(g.tot)}</td><td style="color:${g.tot >= 5 && g.goed / g.tot < 0.6 ? 'var(--warn)' : 'inherit'}"><b>${pct(g.goed, g.tot)}</b>${g.tot >= 5 && g.goed / g.tot < 0.6 ? ' (twijfel)' : ''}</td></tr>`).join('')).join('')}
    </tbody></table></div></details>
    <div class="rij"><button class="knop klein" data-a="meet">Meet opnieuw op dit apparaat</button><span class="muted klein" id="pd2-meetst"></span></div></details>`;
}
function aannamesHtml(){
  const ids = Object.keys(R.AANNAMES);
  return `<details class="pd2-blok"><summary style="cursor:pointer;font-weight:800;min-height:40px;display:flex;align-items:center">Aannames in deze ronde (${ids.length}) · ${ids.filter(i => R.S.fb.aann[i] && R.S.fb.aann[i].v === 'nee').length} afgekeurd</summary>
    <ul style="margin-left:18px;display:grid;gap:6px;font-size:13.5px">${ids.map(i => `<li>${aan(i)} ${esc(R.AANNAMES[i])}${R.S.fb.aann[i] && R.S.fb.aann[i].opm ? ` <i class="muted">— ${esc(R.S.fb.aann[i].opm)}</i>` : ''}</li>`).join('')}</ul></details>`;
}

/* ---------- tekenen ---------- */
function teken(){
  const el = UI.el; if(!el || !document.body.contains(el)) return;
  if(R.S.fout) { el.innerHTML = `<div class="pagina pd2">${oefenBalk()}<div class="melding">Laden lukte niet: ${esc(R.S.fout.message || String(R.S.fout))}</div><button class="knop" data-a="opnieuw">Opnieuw</button></div>`; return; }
  if(!R.S.klaar){ el.innerHTML = `<div class="pagina pd2">${oefenBalk()}<h1>Productdata 2.0 <i class="st warn">oefen</i></h1><div class="pd2-leeg">Producten, inkoop, verplaatsingen en voorraad laden…</div></div>`; return; }
  staatCheck();
  UI.dv = R.S.dataVer;
  const t0 = performance.now();
  el.innerHTML = `<div class="pagina pd2">
    <div id="pd2-balk">${oefenBalk()}</div>
    <h1>Productdata 2.0 <i class="st warn">oefen</i></h1>
    <div id="pd2-filters">${filtersHtml()}</div>
    <div id="pd2-basis">${basisHtml()}</div>
    <div id="pd2-vg">${voortgangHtml()}</div>
    <div id="pd2-tegels">${tegelsHtml()}</div>
    <div id="pd2-tabs">${tabsHtml()}</div>
    <div id="pd2-oef">${oefHtml()}</div>
    <section id="pd2-lijst" class="pd2-blok">${lijstHtml()}</section>
    <div id="pd2-actie">${actieHtml()}</div>
    ${scoresHtml()}
    ${aannamesHtml()}
  </div>`;
  UI.tekenMs = Math.round(performance.now() - t0);
  liveScherm();
}
const zet = (id, html) => { const x = document.getElementById(id); if(x) x.innerHTML = html; };
// na een wijziging: alles behalve de lijst opnieuw; de lijst alleen de geraakte rijen (focus blijft staan)
function verversKop(){ zet('pd2-balk', oefenBalk()); zet('pd2-basis', basisHtml()); zet('pd2-vg', voortgangHtml()); zet('pd2-tegels', tegelsHtml()); zet('pd2-tabs', tabsHtml()); zet('pd2-actie', actieHtml()); const o = document.querySelector('#pd2-oef ol'); if(o){ const tmp = document.createElement('div'); tmp.innerHTML = oefHtml(); const n = tmp.querySelector('ol'); if(n) o.replaceWith(n); const s = document.querySelector('#pd2-oef summary'), ns = tmp.querySelector('summary'); if(s && ns) s.innerHTML = ns.innerHTML; } }
function verversRijen(codes){
  const tab = UI.tab, act = document.activeElement, tr0 = act && act.closest && act.closest('tr[data-c]'), focus = tr0 && act.dataset ? { c:tr0.dataset.c, k:act.dataset.k, d:act.dataset.d, a:act.dataset.a } : null;
  codes.forEach(c => {
    const tr = document.querySelector(`#pd2-lijst tr[data-c="${CSS.escape(c)}"]`); if(!tr) return;
    const tmp = document.createElement('tbody'); tmp.innerHTML = rijHtml(c, tab); const n = tmp.firstElementChild; if(n) tr.replaceWith(n);
  });
  if(focus){ const tr = document.querySelector(`#pd2-lijst tr[data-c="${CSS.escape(focus.c)}"]`); const x = tr && tr.querySelector(focus.k ? `[data-k="${focus.k}"]${focus.d ? `[data-d="${focus.d}"]` : ''}` : `[data-a="${focus.a}"]`); if(x && x !== document.activeElement){ x.focus(); if(x.select && x.tagName === 'INPUT') try{ x.setSelectionRange(x.value.length, x.value.length); }catch(e){} } }
}
function verversLijst(){ zet('pd2-lijst', lijstHtml()); liveScherm(); }
function verversAlles(){ staatCheck(); verversKop(); verversLijst(); zet('pd2-oef', oefHtml()); }
function nieuweGroep(){ UI.blijf.clear(); UI.weegKlaar.clear(); UI.n = 150; }

/* ---------- live voorraad: wat op het scherm staat (en de geopende familie) live laten ophalen ---------- */
let liveT = null, liveKopT = null;
function liveScherm(){
  clearTimeout(liveT);
  liveT = setTimeout(() => {
    if(!UI.el || !document.getElementById('pd2-lijst')) return;
    const zicht = UI.tab === 'weeglijst' ? weegCodes() : sorteer(tabCodes(UI.tab)).slice(0, UI.n);
    const fam = UI.fk ? famCodes().filter(c => !R.isKoppel(c)).slice(0, 200) : [];
    R.vraagLive(zicht.concat(fam), binnen);
  }, 300);
}
// nieuwe live voorraad binnen: alleen de geraakte rijen opnieuw (niet de rij waarin getypt wordt), tellers even later
function binnen(codes){
  if(!UI.el || !document.getElementById('pd2-lijst')) return;
  const act = document.activeElement, bezig = act && act.closest && act.closest('#pd2-lijst tr[data-c]');
  verversRijen(codes.filter(c => !(bezig && bezig.dataset.c === c)));
  clearTimeout(liveKopT); liveKopT = setTimeout(() => { if(!(document.activeElement && document.activeElement.closest && document.activeElement.closest('#pd2-lijst'))) verversKop(); else zet('pd2-balk', oefenBalk()); }, 800);
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
function zetVeld(c, k, ruw, opm){
  const v = normVeld(k, ruw);
  if(v === null){ WH.toast(R.VELD[k].t + ': typ een getal, nvt of onb', 3500); verversRijen([c]); return; }
  const I = R.info(c), wasAf = R.status(c).af, vs = I.vs[k], vast = R.waarde(c, k, I);
  const voor = vs && !leeg(vs.v) ? String(vs.v) : vast.st === 'vastgelegd' ? vast.v : '';
  R.poZet(c, p => { if(!v) delete p.f[k]; else p.f[k] = Object.assign({ v, st:voor && gelijk(v, voor) ? 'bevestigd' : 'aangepast', voor, t:now() }, opm ? { opm } : {}); });
  if(k === 'hoogte' && num(ruw) !== null && String(num(ruw)) !== v) WH.toast('Hoogte naar boven afgerond op 10 cm: ' + v, 2500);
  const I2 = R.info(c);
  const ev = { c, k, v, tab:UI.tab, beide:R.waarde(c, 'lvl', I2).st !== 'leeg' && ['bevestigd', 'aangepast'].includes(R.waarde(c, 'lvl', I2).st) && ['bevestigd', 'aangepast'].includes(R.waarde(c, 'maxpick', I2).st), warn:k === 'hoogte' ? R.hoogteWaarsch(c, v, I2) : '' };
  if(k === 'pickc') meld('pickc', { c, v, tab:UI.tab }); else meld('veld', ev);
  na([c], wasAf);
}
function zetSoort(c, v){
  const I = R.info(c), wasAf = R.status(c).af, nu = R.soortWaarde(c, I), van = nu.v, voor = nu.st === 'vastgelegd' ? nu.v : I.vsSo ? I.vsSo.v : '';
  R.poZet(c, p => { if(!v) delete p.so; else p.so = { v, st:voor === v ? 'bevestigd' : 'aangepast', voor, t:now() }; });
  meld('soort', { c, van, naar:v, tab:UI.tab });
  na([c], wasAf, true);
}
function zetWeg(c, v){
  const I = R.info(c), wasAf = R.status(c).af, vs = I.vsWeg;
  R.poZet(c, p => { if(!v) delete p.weg; else { p.weg = { v, st:vs && vs.v === v ? 'bevestigd' : 'aangepast', voor:vs ? vs.v : '', t:now() }; if(!p.so || p.so.v !== 'weg') p.so = { v:'weg', st:I.vsSo && I.vsSo.v === 'weg' ? 'bevestigd' : 'aangepast', voor:I.vsSo ? I.vsSo.v : '', t:now() }; } });
  meld('weg', { c, v });
  na([c], wasAf, true);
}
// na een wijziging per rij: product dat compleet wordt blijft staan tot een groepswissel (aanname blijf)
let kopT = null;
function na(codes, wasAf, lijstOok){
  codes.forEach(c => { if(R.status(c).af && !wasAf) UI.blijf.add(c); });
  if(lijstOok){ staatCheck(); verversKop(); const zichtbaar = new Set(sorteer(tabCodes(UI.tab)).slice(0, UI.n)); if(codes.some(c => !zichtbaar.has(c))) verversLijst(); else verversRijen(codes); return; }
  verversRijen(codes);
  // tellers, voortgang en tegels even later: typen en tabben door de cellen blijft vlot
  clearTimeout(kopT); kopT = setTimeout(() => { staatCheck(); verversKop(); }, 250);
}

/* ---------- groepsacties (één keer ongedaan te maken, 10 s) ---------- */
function groep(codes, fn, label){
  const snap = codes.map(c => [c, R.po(c) ? JSON.parse(JSON.stringify(R.po(c))) : null]);
  codes.forEach(fn);
  UI.undo = { snap, label };
  codes.forEach(c => UI.blijf.delete(c));
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
// alle voorstellen in een rij bevestigen, ook de soort (het gewicht niet: aanname selgew)
function bevestig(c){
  const I = R.info(c), so = R.soortWaarde(c, I);
  R.poZet(c, p => {
    delete p.heropend;
    if(so.v && ['voorstel', 'twijfel'].includes(so.st)) p.so = { v:so.v, st:'bevestigd', voor:so.v, t:now() };
    const sv = p.so ? p.so.v : so.v;
    if(R.rolVoorstel(c) && sv !== 'weg') p.rol = { v:true, st:'bevestigd', t:now() };
    if(sv === 'weg'){ const w = R.wegWaarde(c, I); if(w.v && w.st === 'voorstel') p.weg = { v:w.v, st:'bevestigd', voor:w.v, t:now() }; return; }
    const kols = new Set(R.nodigVan(c, sv, I).concat(R.KOLOMMEN[sv] || []).concat(R.isRol(c) ? R.ROLNODIG : []));
    kols.forEach(k => { if(R.VELD[k] && R.VELD[k].calc) return; if(I.sam && !R.SAMVELD.has(k)) return; const w = R.waarde(c, k, I); if(['voorstel', 'twijfel'].includes(w.st) && !leeg(w.v)) p.f[k] = { v:w.v, st:'bevestigd', voor:w.v, t:now() }; });
  });
}
const selLijst = () => [...UI.sel].filter(c => D.P[c]);

/* ---------- pop-ups ---------- */
function modal(html, onOk, okTxt){
  const bg = document.createElement('div'); bg.className = 'pd2-modal-bg';
  bg.innerHTML = `<div class="pd2-modal" role="dialog" aria-modal="true">${html}<div class="knoppen"><button class="knop" data-m="nee">${onOk ? 'Annuleren' : 'Sluiten'}</button>${onOk ? `<button class="knop pri" data-m="ok">${esc(okTxt || 'Opslaan')}</button>` : ''}</div></div>`;
  document.body.appendChild(bg);
  const sluit = () => { bg.remove(); document.removeEventListener('keydown', esc2); };
  const esc2 = e => { if(e.key === 'Escape') sluit(); };
  document.addEventListener('keydown', esc2);
  bg.addEventListener('click', e => {
    if(e.target === bg || (e.target.closest('[data-m="nee"]'))) return sluit();
    if(e.target.closest('[data-m="ok"]')){ if(onOk(bg.querySelector('.pd2-modal')) !== false) sluit(); }
  });
  const f = bg.querySelector('textarea, input, select'); if(f) setTimeout(() => f.focus(), 30);
  return bg;
}
function infoModal(c){
  const I = R.info(c), st = R.status(c), so = R.soortWaarde(c, I), r = [];
  r.push(`<li><b>Soort ${esc(R.SOORTT[so.v] || '')}</b> (${esc(so.st)}): ${esc(so.why || (so.st === 'bevestigd' || so.st === 'aangepast' ? 'door jou gekozen' : ''))}${scoreTxt(so)}</li>`);
  if(so.v === 'weg'){ const w = R.wegWaarde(c, I); r.push(`<li><b>Weg: ${esc(w.v)}</b> — ${esc(w.why || '')}</li>`); }
  const kols = [...new Set((R.KOLOMMEN[so.v] || []).concat(R.isRol(c) ? R.KOLOMMEN.rollen : []))];
  kols.forEach(k => { const d = R.VELD[k]; if(d.calc){ const x = R.calc(c, k, I); r.push(`<li><b>${esc(d.t)}</b> (berekend): ${esc(x.v || '–')} — ${esc(x.why || '')}${x.warn ? ' · <b style="color:var(--rood)">' + esc(x.warn) + '</b>' : ''}</li>`); return; }
    const w = R.waarde(c, k, I); r.push(`<li><b>${esc(d.t)}</b>: ${esc(w.v || '–')} <i class="muted">(${esc(w.st)})</i>${w.why ? ' — ' + esc(w.why) : ''}${w.voor && w.st === 'aangepast' ? ' · voorstel was ' + esc(w.voor) : ''}${scoreTxt(w)}</li>`); });
  const g = R.gewicht(c), afw = R.gewAfwijking(c);
  r.push(`<li><b>Gewicht per stuk</b>: ${g.kg ? nf(g.kg, 3) + ' kg' : 'onbekend'} (${esc(g.st)}${g.pq ? ', Picqer ' + nf(g.pq, 3) + ' kg' : ''})${afw ? ' — ' + esc(afw) : ''}</li>`);
  const aanL = [...I.aan];
  modal(`<h3>${esc(c)} — waarom deze voorstellen</h3><p class="muted">${esc(R.naamVan(c))}</p><ul>${r.join('')}</ul>
    ${st.open.length ? `<p><b>Nog open:</b> ${esc(st.open.map(k => k === 'soort' ? 'soort bevestigen' : R.VELD[k] ? R.VELD[k].t : k).join(', '))}</p>` : '<p><b>Compleet.</b></p>'}
    ${aanL.length ? `<p>Aannames: ${aanL.map(aan).join(' ')}</p>` : ''}<p class="muted klein">Voorraad: ${esc(I.f.bron)}${I.f.t ? ' ' + esc(dk(I.f.t)) : ''}. Kleuren: geel = voorstel, groen = bevestigd of vastgelegd, oranje = twijfel, grijs = berekend, rood = ontbreekt.</p>`);
}
function opmModal(c, tab){
  const kols = c ? ['', 'soort'].concat(tab === 'weg' ? ['weg'] : (R.KOLOMMEN[tab === 'rollen' ? 'rollen' : tab] || [])).concat(['gewicht', 'voorraad', 'inkoop', 'verkoop']) : [''];
  const def = c ? (UI.lastK[c] || '') : '';
  const al = R.S.fb.opm.filter(x => (c ? x.code === c : !x.code && x.tab === tab));
  modal(`<h3>💬 Opmerking${c ? ' bij ' + esc(c) : ' bij tab ' + esc(TABT[tab])}</h3>
    ${c ? `<label>Kolom <select id="pd2-opm-k">${kols.map(k => `<option value="${k}" ${k === def ? 'selected' : ''}>${k ? esc(R.VELD[k] ? R.VELD[k].t : k) : '(hele rij)'}</option>`).join('')}</select></label>` : ''}
    <textarea id="pd2-opm-t" placeholder="Typ, of dicteer met de microfoon van je toetsenbord"></textarea>
    ${al.length ? `<ul>${al.map(x => `<li>${x.kolom ? '<b>' + esc(x.kolom) + '</b>: ' : ''}${esc(x.tekst)} <button class="knop klein" data-m="weg" data-id="${esc(x.id)}">×</button></li>`).join('')}</ul>` : ''}`, m => {
    const t = m.querySelector('#pd2-opm-t').value.trim(); if(!t) return;
    R.fbOpm({ tab, code:c || '', kolom:c ? (m.querySelector('#pd2-opm-k').value || '') : '', tekst:t });
    WH.toast('Opmerking bewaard', 2000);
    if(c) verversRijen([c]); else zet('pd2-oef', oefHtml());
  });
  document.querySelectorAll('.pd2-modal [data-m="weg"]').forEach(b => b.addEventListener('click', () => { R.fbOpmWeg(b.dataset.id); b.closest('li').remove(); if(c) verversRijen([c]); }));
}
function gewModal(c){
  const g = R.gewicht(c);
  modal(`<h3>Gewicht ${esc(c)}</h3><p class="muted">Picqer: ${g.pq ? nf(g.pq, 3) + ' kg ' + esc(WHPD.eenheid(c).t) : 'onbekend'}</p>
    <div class="pd2-chips">${R.GEWST.map(([k, t]) => `<button data-gst="${k}" class="${g.st === k ? 'aan' : ''}">${esc(t)}</button>`).join('')}</div>
    <label>Gewogen of juist gewicht (kg, mag leeg) <input id="pd2-gkg" inputmode="decimal" value="${g.gk ? esc(String(g.gk)) : ''}"></label>`, m => {
    const b = m.querySelector('[data-gst].aan'), st = b ? b.dataset.gst : g.st, kg = num(m.querySelector('#pd2-gkg').value);
    const wasAf = R.status(c).af;
    R.poZet(c, p => { if(st === 'niet' && !kg) delete p.gew; else p.gew = { st:kg && st === 'niet' ? 'gewogen' : st, kg:kg || null, t:now() }; });
    meld('gewst', { st }); na([c], wasAf);
  });
  document.querySelectorAll('.pd2-modal [data-gst]').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.pd2-modal [data-gst]').forEach(x => x.classList.toggle('aan', x === b)); }));
}
function aanModal(id){
  const a = R.S.fb.aann[id] || {};
  modal(`<h3>Aanname</h3><p>${esc(R.AANNAMES[id])}</p><div class="pd2-chips"><button data-av="ja" class="${a.v === 'ja' ? 'aan' : ''}">klopt</button><button data-av="nee" class="${a.v === 'nee' ? 'aan' : ''}">keur af</button></div><textarea id="pd2-aopm" placeholder="Waarom, of hoe het wel moet (mag leeg)">${esc(a.opm || '')}</textarea>`, m => {
    const b = m.querySelector('[data-av].aan'); R.fbAann(id, { v:b ? b.dataset.av : (a.v || ''), opm:m.querySelector('#pd2-aopm').value.trim() });
    document.querySelectorAll(`.pd2-aan[data-id="${id}"]`).forEach(x => { x.classList.remove('ja', 'nee'); if(R.S.fb.aann[id].v) x.classList.add(R.S.fb.aann[id].v === 'nee' ? 'nee' : 'ja'); });
  });
  document.querySelectorAll('.pd2-modal [data-av]').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.pd2-modal [data-av]').forEach(x => x.classList.toggle('aan', x === b)); }));
}
function kolomModal(){
  const tab = UI.tab, kols = (tab === 'weg' ? [] : (R.KOLOMMEN[tab] || [])).filter(k => !R.VELD[k].calc && k !== 'pickc');
  if(!kols.length){ WH.toast('Deze tab heeft geen invulkolommen', 2500); return; }
  modal(`<h3>Zelfde waarde voor ${nf(UI.sel.size)} producten</h3><label>Kolom <select id="pd2-kk">${kols.map(k => `<option value="${k}">${esc(R.VELD[k].t)}</option>`).join('')}</select></label><label>Waarde <input id="pd2-kv" placeholder="getal, tekst, nvt of onb"></label>`, m => {
    const k = m.querySelector('#pd2-kk').value, ruw = m.querySelector('#pd2-kv').value, v = normVeld(k, ruw);
    if(v === null){ WH.toast('Typ een getal, nvt of onb', 3000); return false; }
    groep(selLijst(), c => { const I = R.info(c), vs = I.vs[k], voor = vs && !leeg(vs.v) ? String(vs.v) : ''; R.poZet(c, p => { if(!v) delete p.f[k]; else p.f[k] = { v, st:voor && gelijk(v, voor) ? 'bevestigd' : 'aangepast', voor, t:now() }; }); }, R.VELD[k].t + ' = ' + (v || 'leeg') + ' voor ' + nf(UI.sel.size));
    meld('kolom', { k });
  }, 'Toepassen');
}
function gewPopModal(){
  modal(`<h3>Gewicht voor ${nf(UI.sel.size)} producten</h3><label>Gewicht per stuk (kg) <input id="pd2-gp" inputmode="decimal" placeholder="bijv. 1,2"></label><div class="pd2-chips"><button data-gst="gewogen" class="aan">gewogen</button><button data-gst="vertrouwd">vertrouwd</button></div>`, m => {
    const kg = num(m.querySelector('#pd2-gp').value), st = (m.querySelector('[data-gst].aan') || {}).dataset.gst || 'gewogen';
    if(!(kg > 0)){ WH.toast('Typ een gewicht in kg', 2500); return false; }
    groep(selLijst(), c => R.poZet(c, p => { p.gew = { st, kg, t:now() }; }), 'Gewicht ' + nf(kg, 3) + ' kg (' + st + ') voor ' + nf(UI.sel.size));
    meld('gewpop', {});
  }, 'Toepassen');
  document.querySelectorAll('.pd2-modal [data-gst]').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.pd2-modal [data-gst]').forEach(x => x.classList.toggle('aan', x === b)); }));
}
function uitlegVk(){ modal(`<h3>Verkoop "13*6 / 8*28"</h3><p>Gemiddeld aantal per maand. Het eerste getal is gemeten over de laatste 6 maanden (verkoopexport), het tweede over de laatste 28 dagen (Picqer-analyse).</p><p>${aan('vk28')} ${esc(R.AANNAMES.vk28)}</p>`); }

/* ---------- bevestigd naar echte productdata (vlag pd2Overzetten; nu uit, knop verborgen) ---------- */
async function overzetModal(){
  if(!R.pd2Overzetten) return;
  const rows = {}; Object.entries(WHPD.S.pd).forEach(([c, r]) => { rows[c] = { data:r.data, meta:r.meta }; });
  const plan = R.overzetPlan(rows), kies = plan.filter(x => x.actie === 'kies'), zet = plan.filter(x => x.actie === 'zet');
  modal(`<h3>Bevestigd naar echte productdata</h3><p>${nf(zet.length)} waarden gaan erin (bron pd2). ${nf(kies.length)} wijken af van jouw eigen invoer: kies per regel. Vooraf wordt een kopie bewaard; terugdraaien kan.</p>
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
    r.push('', '== Tab ' + t + ' ==');
    r.push('Opdrachten ' + l.filter(o => done[o.id]).length + '/' + l.length + ': ' + l.map(o => (done[o.id] ? '[x] ' : '[ ] ') + o.t).join(' | '));
    r.push('Layout: ' + (fb.layout || '–') + ' · Gevoel: ' + (fb.gevoel ? fb.gevoel + '/5' : '–'));
    if(fb.mis) r.push('Mis ik: ' + fb.mis);
    if(fb.over) r.push('Overbodig: ' + fb.over);
    if(opm.length){ r.push('Opmerkingen:'); opm.forEach(x => r.push('- ' + (x.code ? x.code + (x.kolom ? ' · ' + (R.VELD[x.kolom] ? R.VELD[x.kolom].t : x.kolom) : '') + ': ' : '(tab) ') + x.tekst)); }
  });
  const T = R.telling(), naam = k => k === 'soort' ? 'soort' : k === 'weg' ? 'weg-keuze' : R.VELD[k] ? R.VELD[k].t : k;
  r.push('', '== Voorstellen: hoe vaak klopt of aangepast ==');
  if(!Object.keys(T).length) r.push('(nog niets bevestigd of aangepast)');
  Object.entries(T).sort((a, b) => (b[1].klopt + b[1].aangepast) - (a[1].klopt + a[1].aangepast)).forEach(([k, x]) => r.push(naam(k) + ': ' + x.klopt + '× klopt, ' + x.aangepast + '× aangepast' + (x.vb.length ? ' (' + x.vb.join('; ') + ')' : '')));
  const gw = {}; Object.values(R.S.o.p).forEach(p => { if(p.gew && p.gew.st) gw[p.gew.st] = (gw[p.gew.st] || 0) + 1; });
  if(Object.keys(gw).length) r.push('gewicht: ' + Object.entries(gw).map(([k, n]) => n + '× ' + k).join(', '));
  r.push('', '== Aannames ==');
  Object.keys(R.AANNAMES).forEach(i => { const a = R.S.fb.aann[i]; r.push('- ' + i + ': ' + (a && a.v === 'nee' ? 'AFGEKEURD' : a && a.v === 'ja' ? 'klopt' : 'niet beoordeeld') + (a && a.opm ? ' — ' + a.opm : '') + ' · ' + R.AANNAMES[i]); });
  return r.join('\n');
}
function kopieer(){
  const t = claudeTekst();
  const klaar = ok => modal(`<h3>${ok ? 'Gekopieerd' : 'Kopieer deze tekst'}</h3><p class="muted">${ok ? 'Staat op het klembord: plak hem in de chat met Claude.' : 'Selecteer en kopieer, en plak hem in de chat met Claude.'}</p><pre>${esc(t)}</pre>`);
  const fallback = () => { try{ const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); klaar(ok); }catch(e){ klaar(false); } };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => klaar(true), fallback); else fallback();
}

/* ---------- toon (oefening): familie, maat en tab openzetten ---------- */
function toon(tab, id){
  const o = (OPDR[tab] || []).find(x => x.id === id); if(!o || !o.toon) return;
  UI.zoek = o.toon.zoek || ''; UI.lev = UI.afd = UI.hal = UI.abc = ''; UI.aandacht = null; UI.map = null;
  const cs = basisCodes().filter(c => !R.isKoppel(c));
  const fams = {}; cs.forEach(c => { const f = R.famVan(c); fams[f] = (fams[f] || 0) + 1; });
  const fk = Object.entries(fams).sort((a, b) => b[1] - a[1])[0];
  UI.fk = fk ? fk[0] : null; UI.mk = null;
  if(o.toon.maat && UI.fk){ const m = maatgroepen().find(x => String(x.k).replace(/\s/g, '').startsWith(o.toon.maat)); if(m){ UI.mk = m.k; meld('maat', { naam:R.famNaam(UI.fk), mk:m.k }); } }
  UI.tab = tab; nieuweGroep(); UI.sel.clear();
  // staan de producten (nog) niet in deze tab, dan naar de tab waar de meeste staan (bijv. "rol?" staat in de soort-tab)
  if(!tabCodes(tab).length){ const n = {}; selCodes().forEach(c => { const t = tabVan(c); n[t] = (n[t] || 0) + 1; }); const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0]; if(best) UI.tab = best[0]; }
  teken();
}

/* ---------- gebeurtenissen ---------- */
let zoekT = null;
function koppel(el){
  if(el.dataset.pd2) return; el.dataset.pd2 = '1';
  el.addEventListener('click', ev => {
    if(!ev.target.closest('.pd2')) return;
    const a = ev.target.closest('[data-a]'); if(!a) return;
    const tr = a.closest('tr[data-c]'), c = tr ? tr.dataset.c : null, A = a.dataset.a;
    switch(A){
      case 'opnieuw': R.laad(true).then(teken); teken(); return;
      case 'wissen':
        if(confirm('Alle oefendata wissen? Alles wat je in Productdata 2.0 hebt ingevuld (wh-pd2-oefen) verdwijnt. Je feedback en opmerkingen blijven staan.')){ R.wisAlles().then(() => { UI.blijf.clear(); UI.sel.clear(); WH.toast('Oefendata gewist', 2500); teken(); }); }
        return;
      case 'kopieer': kopieer(); return;
      case 'scope': UI.scope = a.dataset.v; UI.zoek = ''; lsZet('scope', UI.scope); UI.fk = null; UI.mk = null; nieuweGroep(); teken(); return;
      case 'fam': UI.fk = a.dataset.v; UI.mk = null; UI.aandacht = null; nieuweGroep(); meld('fam', { fk:UI.fk }); teken(); return;
      case 'famweg': UI.fk = null; UI.mk = null; nieuweGroep(); teken(); return;
      case 'fammeer': UI.famMeer = !UI.famMeer; zet('pd2-tegels', tegelsHtml()); return;
      case 'maat': UI.mk = !a.classList.contains('pd2-tegel') || UI.mk === a.dataset.v ? null : a.dataset.v; nieuweGroep(); if(UI.mk !== null) meld('maat', { naam:R.famNaam(UI.fk), mk:UI.mk }); verversAlles(); return;
      case 'volgmaat': { const M = maatgroepen(); if(!M.length) return; const i = M.findIndex(m => m.k === UI.mk), L = M.slice(i + 1).concat(M.slice(0, i + 1)), n = L.find(m => m.open) || L[0]; UI.mk = n.k; nieuweGroep(); meld('maat', { naam:R.famNaam(UI.fk), mk:UI.mk }); verversAlles(); return; }
      case 'volgfam': { const L = families(), i = L.findIndex(f => f.fk === UI.fk), rest = L.slice(i + 1).concat(L.slice(0, Math.max(0, i))), n = rest.find(f => f.af < f.n) || rest[0]; if(!n) return; UI.fk = n.fk; UI.mk = null; nieuweGroep(); meld('fam', { fk:UI.fk }); teken(); return; }
      case 'tab': UI.tab = a.dataset.v; lsZet('tab', UI.tab); UI.map = null; UI.wegAlle = null; nieuweGroep(); meld('tab', { tab:UI.tab }); verversKop(); zet('pd2-oef', oefHtml()); verversLijst(); return;
      case 'aandacht': UI.aandacht = UI.aandacht === a.dataset.v ? null : a.dataset.v; nieuweGroep();
        if(UI.aandacht && !tabCodes(UI.tab).length){ const n = {}; selCodes().forEach(x => { const t = tabVan(x); n[t] = (n[t] || 0) + 1; }); const best = Object.entries(n).sort((p, q) => q[1] - p[1])[0]; if(best) UI.tab = best[0]; }
        verversAlles(); return;
      case 'wegalle': UI.wegAlle = a.dataset.v || null; UI.map = null; nieuweGroep(); verversLijst(); return;
      case 'map': UI.wegAlle = null; UI.map = a.dataset.v || null; if(UI.map) meld('map', {}); nieuweGroep(); verversLijst(); return;
      case 'meer': UI.n += 150; verversLijst(); return;
      case 'toon': toon(UI.tab, a.dataset.id); return;
      case 'fb': R.fbTab(UI.tab, { [a.dataset.k]:a.dataset.v }); a.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('aan', b === a)); return;
      case 'opmtab': opmModal(null, UI.tab); return;
      case 'aanname': aanModal(a.dataset.id); return;
      case 'uitleg': uitlegVk(); return;
      case 'mgregel': meld('mgregel', {}); { const l = tabCodes('mix').filter(x => R.waarde(x, 'mixgroep').v === a.dataset.v); modal(`<h3>Mixgroep ${esc(a.dataset.v)}</h3><ul>${l.map(x => `<li><b>${esc(x)}</b> ${esc(R.naamVan(x))} · bulk ${esc(R.info(x).f.bulk.map(b => b.n + ' (' + nf(b.v) + ')').join(', ') || '–')}</li>`).join('')}</ul>`); } return;
      case 'sel': if(!c) return; if(a.checked) UI.sel.add(c); else UI.sel.delete(c); tr.classList.toggle('sel', a.checked); zet('pd2-actie', actieHtml()); return;
      case 'selalle': { const cs = tabCodes(UI.tab); if(a.checked) cs.forEach(x => UI.sel.add(x)); else cs.forEach(x => UI.sel.delete(x)); verversLijst(); zet('pd2-actie', actieHtml()); return; }
      case 'selweg': UI.sel.clear(); verversLijst(); zet('pd2-actie', actieHtml()); return;
      case 'naam': if(!c) return; if(UI.vol.has(c)) UI.vol.delete(c); else UI.vol.add(c); a.classList.toggle('vol'); return;
      case 'kaart': try{ navigator.clipboard && navigator.clipboard.writeText(c); }catch(e){} WH.toast('Code ' + c + ' gekopieerd: plak hem in het zoekveld van Productkaart', 3500); return;
      case 'info': infoModal(c); return;
      case 'opm': opmModal(c, UI.tab); return;
      case 'gew': gewModal(c); return;
      case 'rol': { const v = a.dataset.v === '1', wasAf = R.status(c).af; R.poZet(c, p => { p.rol = { v, t:now() }; }); meld('rol', { v }); na([c], wasAf, true); return; }
      case 'heropen': R.poZet(c, p => { p.heropend = now(); }); meld('heropen', {}); WH.toast(c + ' staat weer in zijn tab', 2500); verversAlles(); return;
      case 'wegterug': groep([c], x => R.poZet(x, p => { delete p.weg; delete p.so; }), c + ' teruggezet'); meld('wegterug', {}); return;
      case 'alleklopt': { const cs = sorteer(tabCodes(UI.tab)); groep(cs, bevestig, 'Alle voorstellen kloppen: ' + nf(cs.length) + ' producten'); meld('selklopt', { tab:UI.tab, n:cs.length }); return; }
      case 'selklopt': { const cs = selLijst(); groep(cs, bevestig, 'Selectie klopt: ' + nf(cs.length) + ' producten'); meld('selklopt', { tab:UI.tab, n:cs.length }); UI.sel.clear(); verversAlles(); return; }
      case 'allemaal': { const v = a.dataset.v, cs = selLijst(), van = UI.tab; groep(cs, x => { const nu = R.soortWaarde(x), voor = nu.st === 'vastgelegd' ? nu.v : (R.info(x).vsSo || {}).v || ''; R.poZet(x, p => { p.so = { v, st:voor === v ? 'bevestigd' : 'aangepast', voor, t:now() }; }); }, 'Allemaal ' + R.SOORTT[v] + ': ' + nf(cs.length) + ' producten'); cs.forEach(x => meld('soort', { c:x, van:van, naar:v, tab:van })); UI.sel.clear(); verversAlles(); return; }
      case 'gewklopt': { const cs = selLijst(); groep(cs, x => R.poZet(x, p => { p.gew = { st:'vertrouwd', kg:null, t:now() }; }), 'Gewichten kloppen: ' + nf(cs.length) + ' producten'); meld('gewklopt', {}); return; }
      case 'gewpop': gewPopModal(); return;
      case 'isrol': { const cs = selLijst(); groep(cs, x => R.poZet(x, p => { p.rol = { v:true, t:now() }; }), 'Is rol: ' + nf(cs.length) + ' producten'); meld('rol', { v:true }); return; }
      case 'kolom': kolomModal(); return;
      case 'weegprint': weegPrint(); return;
      case 'overzet': overzetModal(); return;
      case 'meet': { a.disabled = true; const st = document.getElementById('pd2-meetst'); R.meet((i, n) => { if(st) st.textContent = 'meten… ' + nf(i) + ' van ' + nf(n); }).then(m => { R.zetMeting(m); zet('pd2-scores-w', ''); const d = document.getElementById('pd2-scores'); if(d){ const tmp = document.createElement('div'); tmp.innerHTML = scoresHtml(); const n = tmp.firstElementChild; n.open = true; d.replaceWith(n); } WH.toast('Meting klaar: ' + nf(m.n) + ' waarden getoetst', 3000); verversKop(); verversLijst(); }); return; }
    }
  });
  document.addEventListener('click', ev => {
    if(ev.target.closest('#pd2-undo [data-a="ongedaan"]')) ongedaan();
    const an = ev.target.closest('.pd2-modal [data-a="aanname"]'); if(an){ const bg = an.closest('.pd2-modal-bg'); if(bg) bg.remove(); aanModal(an.dataset.id); }
  });
  el.addEventListener('toggle', ev => { if(!ev.target.matches) return; if(ev.target.matches('details.pd2-oef')){ UI.oefOpen = ev.target.open; lsZet('oefopen', UI.oefOpen ? '1' : '0'); } if(ev.target.matches('details.pd2-vragen-d')) UI.vragenOpen = ev.target.open; }, true);
  // een voorstel bevestigen door het over te typen (zelfde waarde = geen change) of met Enter
  const bewaarGetypt = t => { const tr = t.closest('tr[data-c]'), td = t.closest('td'); if(!tr || !td || !t.dataset.k) return; delete t.dataset.getypt;
    if(t.dataset.k === 'verp'){ const n = td.querySelector('[data-d="n"]').value.trim(), s2 = td.querySelector('[data-d="s"]').value; zetVeld(tr.dataset.c, 'verp', (n ? n + ' ' : '') + s2); } else zetVeld(tr.dataset.c, t.dataset.k, t.value); };
  el.addEventListener('focusout', ev => { const t = ev.target; if(t.dataset && t.dataset.getypt && t.closest('#pd2-lijst')) bewaarGetypt(t); });
  el.addEventListener('input', ev => {
    if(!ev.target.closest('.pd2')) return;
    if(ev.target.closest('#pd2-lijst') && ev.target.dataset.k) ev.target.dataset.getypt = '1';
    if(ev.target.id === 'pd2-zoek'){ clearTimeout(zoekT); zoekT = setTimeout(() => { UI.zoek = ev.target.value; UI.fk = null; UI.mk = null; nieuweGroep(); const pos = ev.target.selectionStart; teken(); const z = document.getElementById('pd2-zoek'); if(z){ z.focus(); try{ z.setSelectionRange(pos, pos); }catch(e){} } }, 350); return; }
  });
  el.addEventListener('focusin', ev => { const tr = ev.target.closest && ev.target.closest('#pd2-lijst tr[data-c]'), k = ev.target.dataset && ev.target.dataset.k; if(tr && k) UI.lastK[tr.dataset.c] = k === 'soort' || k === 'weg' ? k : k; });
  el.addEventListener('change', ev => {
    if(!ev.target.closest('.pd2')) return;
    const t = ev.target, f = t.dataset.f;
    delete t.dataset.getypt;
    if(f){ UI[f] = t.value; if(f === 'lev') UI.fk = null; UI.mk = null; nieuweGroep(); teken(); return; }
    if(t.dataset.fb){ R.fbTab(t.closest('[data-tab]').dataset.tab, { [t.dataset.fb]:t.value }); return; }
    const tr = t.closest('tr[data-c]'); if(!tr) return;
    const c = tr.dataset.c, k = t.dataset.k;
    if(t.dataset.a === 'gewogen' || t.dataset.a === 'palletkg'){
      let kg = num(t.value), extra = {};
      if(t.dataset.a === 'palletkg'){ const w = weegWijze(c); if(!(kg > 15) || !w.reach){ WH.toast('Typ het palletgewicht in kg (meer dan 15)', 2500); return; } extra = { via:'reachtruck', pallet:kg }; kg = Math.round((kg - 15) / w.spp * 1000) / 1000; }
      if(!(kg > 0)){ WH.toast('Typ het gewogen gewicht in kg', 2500); return; }
      R.poZet(c, p => { p.gew = Object.assign({ st:'gewogen', kg, t:now() }, extra); }); UI.weegKlaar.add(c); meld('gewogen', {});
      WH.toast(c + ': ' + nf(kg, 3) + ' kg per stuk gewogen' + (extra.via ? ' (pallet ' + nf(extra.pallet) + ' kg)' : ''), 2500); verversKop(); verversLijst(); return;
    }
    if(!k) return;
    if(k === 'soort') return zetSoort(c, t.value);
    if(k === 'weg') return zetWeg(c, t.value);
    if(k === 'pickc'){
      if(t.value === 'anders'){ modal(`<h3>Picklocatie moet anders — ${esc(c)}</h3><textarea id="pd2-pk" placeholder="Hoe moet het? (bijv. naar AD04B04, vaste plek)"></textarea>`, m => { zetVeld(c, 'pickc', 'anders', m.querySelector('#pd2-pk').value.trim()); }); return; }
      return zetVeld(c, 'pickc', t.value);
    }
    if(k === 'mixgroep' && t.value === '__nieuw'){
      modal('<h3>Nieuwe mixgroep</h3><input id="pd2-mgn" placeholder="Naam, bijv. Vica · trapmaantjes">', m => { const n = m.querySelector('#pd2-mgn').value.trim(); if(!n) return false; R.mgPlus(n); meld('mgnieuw', {}); zetVeld(c, 'mixgroep', n); });
      verversRijen([c]); return;
    }
    if(k === 'verp'){ const td = t.closest('td'), n = td.querySelector('[data-d="n"]').value.trim(), s = td.querySelector('[data-d="s"]').value; return zetVeld(c, 'verp', (n ? n + ' ' : '') + s); }
    zetVeld(c, k, t.value);
  });
  // invoer zoals Excel: Enter = zelfde kolom volgende rij (Shift: vorige), plakken over meerdere cellen
  el.addEventListener('keydown', ev => {
    const t = ev.target; if(!t.closest || !t.closest('#pd2-lijst') || !t.dataset.k || t.tagName !== 'INPUT') return;
    if(ev.key === 'Enter'){
      ev.preventDefault();
      const tr = t.closest('tr'), sib = ev.shiftKey ? tr.previousElementSibling : tr.nextElementSibling, td = t.closest('td');
      const sel = `[data-k="${t.dataset.k}"]${t.dataset.d ? `[data-d="${t.dataset.d}"]` : ''}`;
      if(!t.dataset.getypt && td && /c-(voorstel|twijfel)/.test(td.className) && t.value === t.defaultValue && t.value.trim()) t.dataset.getypt = '1';   // Enter op een voorstel = klopt
      t.blur();   // bewaart (change of focusout)
      setTimeout(() => { const ntr = sib && document.querySelector(`#pd2-lijst tr[data-c="${CSS.escape(sib.dataset.c)}"]`); const x = ntr && ntr.querySelector(sel); if(x){ x.focus(); if(x.select) x.select(); } }, 0);
    }
  });
  el.addEventListener('paste', ev => {
    const t = ev.target; if(!t.closest || !t.closest('#pd2-lijst') || !t.dataset.k || t.tagName !== 'INPUT') return;
    const txt = (ev.clipboardData || window.clipboardData).getData('text'); if(!/[\t\n]/.test(txt.trim())) return;
    ev.preventDefault();
    const grid = txt.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(r => r.split('\t'));
    const rows = [...document.querySelectorAll('#pd2-lijst tbody tr[data-c]')], r0 = rows.indexOf(t.closest('tr'));
    const cols = [...t.closest('tr').querySelectorAll('input[data-k]:not([data-d="n"]), select[data-k]')].filter(x => x.tagName === 'INPUT').map(x => x.dataset.k);
    const c0 = cols.indexOf(t.dataset.k); if(r0 < 0 || c0 < 0) return;
    const geraakt = [];
    grid.forEach((rij, i) => { const tr = rows[r0 + i]; if(!tr) return; rij.forEach((v, j) => { const k = cols[c0 + j]; if(!k) return; const c = tr.dataset.c, nv = normVeld(k, v); if(nv === null) return; const I = R.info(c), vs = I.vs[k], voor = vs && !leeg(vs.v) ? String(vs.v) : ''; R.poZet(c, p => { if(!nv) delete p.f[k]; else p.f[k] = { v:nv, st:voor && gelijk(nv, voor) ? 'bevestigd' : 'aangepast', voor, t:now() }; }); geraakt.push(c); }); });
    WH.toast('Geplakt in ' + nf(new Set(geraakt).size) + ' rijen', 2500);
    na([...new Set(geraakt)], false);
  });
}

/* ---------- ingang vanuit ivol.js ---------- */
function render(el){
  stijl();
  UI.el = el; koppel(el);
  if(!R.S.klaar && !R.S.fout) R.laad().then(() => { if(UI.el === el) teken(); });
  teken();
}
// nieuwe gegevens binnen (na de momentopname, of na verversen): opnieuw tekenen, maar niet midden in het typen
R.opNieuw(() => {
  if(!UI.el || !document.body.contains(UI.el)) return;
  if(R.S.klaar && UI.dv !== R.S.dataVer && (document.getElementById('pd2-lijst') || document.querySelector('.pd2 .pd2-leeg'))){
    const act = document.activeElement; if(act && act.closest && act.closest('.pd2') && /INPUT|SELECT|TEXTAREA/.test(act.tagName)){ UI.wachtTeken = true; zet('pd2-balk', oefenBalk()); return; }
    teken(); return;
  }
  if(document.getElementById('pd2-balk')) zet('pd2-balk', oefenBalk());
});
document.addEventListener('focusout', () => { if(UI.wachtTeken) setTimeout(() => { const act = document.activeElement; if(UI.wachtTeken && !(act && act.closest && act.closest('.pd2') && /INPUT|SELECT|TEXTAREA/.test(act.tagName))){ UI.wachtTeken = false; teken(); } }, 400); });
return { render, teken, UI, claudeTekst, selCodes, tabCodes, families, maatgroepen, OPDR, verversAlles };
})();
