/* =====================================================================
   IVOL Warehouse — Vandaag: live uit Picqer (alleen lezen, 7-10-2026)
   Leest via het tussenstation (Supabase Edge Function "picqer"):
     picklijsten  → open (nieuw), urgent, ouder dan 24 / 12 / 4 uur; gepauzeerd en gesnoozed apart
     backorders   → orders die alleen nog verplaatst hoeven te worden
     producten    → per product voorraad op pick, bulk, retourkar en VST
   Elke tegel is aan te klikken voor de lijst erachter. De app verandert niets in Picqer.
   Junior gebruikt dezelfde gegevens voor "Nu verplaatsen" (WHLIVE.nuLijst).
   ===================================================================== */
window.WHLIVE = (function(){
'use strict';
const { $, esc, nf, plural, fdate, toast, D, isoDag } = WH;
const FN_STD = WH.URL_ + '/functions/v1/picqer';
const fnUrl = () => { try{ return localStorage.getItem('ivol-fn') || FN_STD; }catch(e){ return FN_STD; } };
const S = { data:null, laden:false, fout:null, prod:{}, prodLaden:false, prodFout:null, prodKlaar:false, code:'', open:'', pl:{}, plOpen:null };
const LUISTER = [];
const app = () => $('app');
const PICQER = 'https://ivol.picqer.com';

/* ---------- koppelcode (alleen op dit apparaat) ---------- */
function code(){ try{ return localStorage.getItem('ivol-koppelcode') || S.code; }catch(e){ return S.code; } }
function zetCode(c){ S.code = c; try{ if(c) localStorage.setItem('ivol-koppelcode', c); else localStorage.removeItem('ivol-koppelcode'); }catch(e){} }

/* ---------- tussenstation ---------- */
async function vraag(actie, params){
  const qs = new URLSearchParams(Object.assign({ actie }, params || {})).toString();
  let r;
  try{ r = await fetch(fnUrl() + '?' + qs, { headers:{ apikey:WH.KEY, 'x-ivol-code':code() }, cache:'no-store' }); }
  catch(e){ throw Object.assign(new Error('Geen antwoord van het tussenstation. Staat de functie "picqer" in Supabase en is "Verify JWT" uitgezet?'), { soort:'net' }); }
  const t = await r.text(); let j = null; try{ j = JSON.parse(t); }catch(e){}
  if(!r.ok){
    if(j && j.code === 'koppelcode'){ zetCode(''); throw Object.assign(new Error('Koppelcode klopt niet. Vul hem opnieuw in.'), { soort:'code' }); }
    if(r.status === 401) throw Object.assign(new Error('Supabase weigert het verzoek (401). Zet bij de functie "picqer" Verify JWT uit.'), { soort:'jwt' });
    if(r.status === 404) throw Object.assign(new Error('Functie "picqer" niet gevonden in Supabase.'), { soort:'net' });
    throw new Error((j && j.fout) || ('Tussenstation gaf status ' + r.status));
  }
  return j;
}

/* ---------- rekenen (los van het scherm, ook te testen) ---------- */
function uren(created, nu){
  const d = new Date(String(created || '').replace(' ', 'T'));       // Picqer-tijd = tijd in Nederland
  return isNaN(d) ? null : ((nu || Date.now()) - d.getTime()) / 36e5;
}
const isKar = l => l.t === 'container' || /^container\s*\d+$/i.test(String(l.n || '').trim());
// picklijsten per groep (open = nieuw; gepauzeerd en gesnoozed tellen niet mee bij open)
function picklijstGroepen(lijsten, nu){
  const alle = lijsten || [];
  const open = alle.filter(p => p.s === 'new');
  const ouder = h => open.filter(p => (uren(p.c, nu) ?? 0) >= h);
  return { open, urgent:open.filter(p => p.u), o24:ouder(24), o12:ouder(12), o4:ouder(4),
    pauze:alle.filter(p => p.s === 'paused'), snooze:alle.filter(p => p.s === 'snoozed') };
}
function picklijstCijfers(lijsten, nu){
  const G = picklijstGroepen(lijsten, nu);
  const oudste = G.open.reduce((m, p) => p.c && (!m || p.c < m) ? p.c : m, null);
  return { open:G.open.length, gepauzeerd:G.pauze.length, gesnoozed:G.snooze.length, urgent:G.urgent.length,
    o24:G.o24.length, o12:G.o12.length, o4:G.o4.length, oudste, oudsteUur:oudste ? uren(oudste, nu) : null };
}
function backorderCijfers(bos){
  const perOrder = new Map();
  (bos || []).forEach(b => { if(!perOrder.has(b.o)) perOrder.set(b.o, []); perOrder.get(b.o).push(b); });
  const prods = new Map(), orders = [];
  let vol = 0;
  perOrder.forEach((regels, o) => {
    const ok = regels.every(r => r.v >= r.a);
    const oudste = regels.reduce((m, r) => r.c && (!m || r.c < m) ? r.c : m, null);
    orders.push({ o, regels, vol:ok, oudste, opVoorraad:regels.filter(r => r.v >= r.a).length });
    if(!ok) return;
    vol++;
    regels.forEach(r => {
      if(r.hp) return;                                   // set: de onderdelen staan er zelf ook in
      const p = prods.get(r.p) || { id:r.p, nodig:0, orders:new Set(), oudste:null };
      p.nodig += r.a; p.orders.add(o);
      if(r.c && (!p.oudste || r.c < p.oudste)) p.oudste = r.c;
      prods.set(r.p, p);
    });
  });
  const lijst = [...prods.values()].map(p => Object.assign(p, { orderIds:[...p.orders], orders:p.orders.size }))
    .sort((a, b) => String(a.oudste || '9').localeCompare(String(b.oudste || '9')) || b.orders - a.orders);
  orders.sort((a, b) => String(a.oudste || '9').localeCompare(String(b.oudste || '9')));
  return { orders:perOrder.size, regels:(bos || []).length, vol, wacht:perOrder.size - vol, producten:lijst, orderLijst:orders };
}
// waar staat het product en wat moet er gebeuren (retourkarren zijn nooit een bron)
function productStand(p, nodig, magazijn){
  const hm = (p.loc || []).filter(l => l.w == null || Number(l.w) === Number(magazijn));
  const kar = hm.filter(isKar);
  const echt = hm.filter(l => !isKar(l));
  const pick = echt.filter(l => !l.b), bulk = echt.filter(l => l.b && l.v > 0).sort((a, b) => b.v - a.v);
  const vst = (p.loc || []).filter(l => l.w != null && Number(l.w) !== Number(magazijn) && l.v > 0);
  const pickVrij = pick.reduce((s, l) => s + Math.max(0, l.v - l.r), 0);
  const bulkV = bulk.reduce((s, l) => s + l.v, 0);
  const karV = kar.reduce((s, l) => s + l.v, 0);
  const set = /compos/i.test(p.type || '') && !hm.length;
  let soort, tekst;
  if(set){ soort = 'set'; tekst = 'Set: de losse producten staan in de lijst'; }
  else if(pickVrij >= nodig){ soort = 'pick'; tekst = 'Staat al op pick: Verwerk backorders in Picqer'; }
  else if(bulkV > 0){ soort = 'bulk'; tekst = pick.length ? 'Van bulk naar pick' : 'Geen picklocatie: van bulk naar geen specifieke locatie'; }
  else if(karV > 0){ soort = 'kar'; tekst = 'Alleen op retourkar: eerst de retour inruimen'; }
  else { soort = 'los'; tekst = 'Niet op een locatie (geen specifieke locatie?)'; }
  return { soort, tekst, pick, bulk, kar:kar.filter(l => l.v > 0), vst, pickVrij, bulkV, karV };
}
// rijen voor "Direct nodig voor orders" (zonder sets)
function rijen(){
  if(!S.data) return [];
  const B = backorderCijfers(S.data.backorders);
  return B.producten.map(b => {
    const p = S.prod[b.id];
    return { b, p:p || null, st:p ? productStand(p, b.nodig, S.data.magazijn) : null };
  }).filter(r => !r.st || r.st.soort !== 'set');
}
// Junior: zelfde vorm als de export-lijst (code, van, naar, verpl …); alleen echte verplaatsingen van bulk
function nuLijst(){
  return rijen().filter(r => r.st && r.st.soort === 'bulk').map(({ b, p, st }) => {
    const van = st.bulk.map(l => l.n);
    const naar = st.pick.map(l => l.n);
    return { live:true, code:p.code, naam:p.naam, ean:p.ean, van, naar, verpl:Math.max(1, b.nodig - st.pickVrij), stuks:b.nodig,
      orders:b.orderIds, datum:String(b.oudste || '').replace(' ', 'T'), gang:String(van[0] || '').slice(0, 2), soort:'bulk', pickst:st.pickVrij };
  });
}

/* ---------- ophalen ---------- */
function meld(){ LUISTER.forEach(f => { try{ f(); }catch(e){ console.error(e); } }); }
async function laad(vers){
  if(S.laden || !code()) return;
  S.laden = true; S.fout = null; teken();
  try{
    S.data = await vraag('vandaag', vers ? { vers:'1' } : {});
    S.data.binnen = Date.now();
    S.laden = false; teken(); meld();
    await haalProducten();
  }catch(e){ S.fout = e; S.laden = false; teken(); meld(); }
}
async function haalProducten(){
  if(!S.data) return;
  const B = backorderCijfers(S.data.backorders);
  const ids = B.producten.map(p => p.id).filter(id => !S.prod[id] || Date.now() - S.prod[id].binnen > 120000).slice(0, 150);
  if(!ids.length){ S.prodKlaar = true; teken(); meld(); return; }
  S.prodLaden = true; S.prodFout = null; teken();
  try{
    for(let i = 0; i < ids.length; i += 50){
      const r = await vraag('producten', { ids:ids.slice(i, i + 50).join(',') });
      (r.producten || []).forEach(p => { p.binnen = Date.now(); S.prod[p.id] = p; });
      teken();
    }
  }catch(e){ S.prodFout = e; }
  S.prodLaden = false; S.prodKlaar = true; teken(); meld();
}
async function haalPicklijst(id){
  S.pl[id] = { laden:true }; teken(); meld();
  try{ S.pl[id] = await vraag('picklijst', { id }); }
  catch(e){ S.pl[id] = { fout:e.message }; }
  teken(); meld();
}

/* ---------- teksten (Junior geeft zijn eigen taal mee via WHLIVE.taal) ---------- */
const NL = {
  picklijsten:'Picklijsten', tikTegel:'tik een tegel voor de lijst', oudsteOpen:'oudste open {x}',
  open:'Open', urgent:'Urgent', o24:'Ouder dan 24 uur', o12:'Ouder dan 12 uur', o4:'Ouder dan 4 uur',
  pauze:'Gepauzeerd', pauzeSub:'met reden', snooze:'Gesnoozed', snoozeSub:'tot een datum',
  backorders:'Backorders', boAlle:'Orders in backorder', regels:'{n} regel|{n} regels', boVol:'Alles op voorraad', boVolSub:'alleen verplaatsen of verwerken',
  boProd:'Producten', boProdSub:'voor die orders', boWacht:'Wacht op voorraad', boWachtSub:'niet alles op voorraad',
  'tl.open':'Open picklijsten', 'tl.urgent':'Urgente picklijsten', 'tl.o24':'Open, ouder dan 24 uur', 'tl.o12':'Open, ouder dan 12 uur', 'tl.o4':'Open, ouder dan 4 uur',
  'tl.pauze':'Gepauzeerde picklijsten', 'tl.snooze':'Gesnoozede picklijsten', 'tl.bo-alle':'Orders in backorder', 'tl.bo-vol':'Orders met alles op voorraad', 'tl.bo-wacht':'Orders die wachten op voorraad',
  kPicklijst:'Picklijst', kAangemaakt:'Aangemaakt', kProducten:'Producten', kReden:'Reden pauze', kTot:'Gesnoozed tot', kToegewezen:'Toegewezen', kRef:'Referentie',
  kOrder:'Order', kSinds:'In backorder sinds', kRegels:'Regels', kOpVoorraad:'Op voorraad',
  opm:'opmerkingen', verberg:'verberg', sluiten:'sluiten', ophalen:'Opmerkingen ophalen…', geenOpm:'Geen opmerkingen.', klant:'Opmerking klant', opmerking:'Opmerking',
  gepickt:'{n} gepickt', voorkeur:'voorkeur {x}', alles:'alles', vanTot:'{a} van {b}', opVrd:'({n} op voorraad)', geenPl:'Geen picklijsten.', geenOrders:'Geen orders.',
  codeNoot:'Productcodes staan erbij voor de orders met alles op voorraad; bij de andere alleen het Picqer-nummer.', ja:'ja', order:'order {x}',
  min:'{n} min', uur:'{n} uur', dagen:'{n} dagen'
};
let TAAL = null, LOCALE = () => 'nl-NL';
function T(k, v){
  let s = TAAL ? TAAL(k) : undefined;
  if(s === undefined || s === null) s = NL[k] !== undefined ? NL[k] : k;
  if(s.includes('|')){ const [een, meer] = s.split('|'); s = v && Number(v.n) === 1 ? een : meer; }
  return s.replace(/\{(\w+)\}/g, (m, x) => v && v[x] !== undefined ? v[x] : m);
}

/* ---------- scherm ---------- */
const uurTxt = h => h == null ? '' : h < 1 ? T('min', { n:Math.round(h * 60) }) : h < 48 ? T('uur', { n:Math.floor(h) }) : T('dagen', { n:Math.floor(h / 24) });
const tijd = ms => new Date(ms).toLocaleTimeString(LOCALE(), { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
const pqTijd = s => { if(!s) return ''; const d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? String(s) : d.toLocaleString(LOCALE(), { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }); };
const dagKort = s => { if(!s) return ''; const d = new Date(String(s).length <= 10 ? s + 'T12:00:00' : s); return isNaN(d) ? String(s) : d.toLocaleDateString(LOCALE(), { weekday:'short', day:'numeric', month:'short' }); };
const tegel = (k, lbl, n, sub, cls, href) => `<a class="tile ${cls || ''} ${S.open === k ? 'aan' : ''}" href="${href || 'javascript:void 0'}" ${href ? '' : `data-lv="open" data-k="${k}"`}><div class="lbl">${esc(lbl)}</div><div class="big">${nf(n)}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</a>`;
const locLijst = (ls, metR) => ls.map(l => `<span class="loc">${esc(l.n)}</span> <span class="small">${nf(metR ? Math.max(0, l.v - l.r) : l.v)}</span>`).join('<br>');
const pqLink = (pad, tekst) => `<a href="${PICQER}/${pad}" target="_blank" rel="noopener">${esc(tekst)}</a>`;

function koppelKaart(){
  return `<div class="card" style="border-left:5px solid var(--blue)"><h3>Picqer koppelen</h3>
    <div class="small muted mt4">Vul één keer de koppelcode in (staat in Supabase bij de Secrets als IVOL_CODE). Hij blijft alleen op dit apparaat bewaard. De app leest alleen; er wordt niets in Picqer veranderd.</div>
    <div class="row wrap mt8"><input id="lv-code" type="password" autocomplete="off" placeholder="koppelcode" style="max-width:240px"><button class="btn pri" data-lv="code">Koppelen</button></div></div>`;
}
function containersKaart(){
  if(D.fout || !Array.isArray(D.CONT)) return '';
  const vd = isoDag(), tot = isoDag(Date.now() + 7 * 864e5);
  const cs = D.CONT.filter(c => c.status !== 'afgerond' && c.losdatum && c.losdatum >= vd && c.losdatum <= tot)
    .sort((a, b) => a.losdatum.localeCompare(b.losdatum) || String(a.lostijd || '').localeCompare(String(b.lostijd || '')));
  const dag = d => d === vd ? 'Vandaag' : d === isoDag(Date.now() + 864e5) ? 'Morgen' : fdate(d);
  return `<div class="card"><div class="row wrap between"><h3>Containers komende 7 dagen</h3><a class="small" href="./containerplanning.html#/">alle containers →</a></div>
    ${cs.length ? `<div class="mt8">${cs.map(c => `<div class="task"><div class="grow"><div class="tt">${esc(dag(c.losdatum))}${c.lostijd ? ' ' + esc(c.lostijd) : ''} · ${esc((c.leverancier || '').split(' ')[0])} ${esc(c.pakbon_ref || '')}</div>
      <div class="td">${esc(c.containernummer || '')}</div></div><a class="btn sm" href="./containerplanning.html#/c/${c.id}/uitvoer">Open</a></div>`).join('')}</div>` : '<div class="small muted mt8">Geen containers ingepland.</div>'}</div>`;
}

// lijst achter een picklijst-tegel
const PL_KEYS = ['open', 'urgent', 'o24', 'o12', 'o4', 'pauze', 'snooze'];
function picklijstDetail(G){
  const k = S.open, lijst = (G[k] || []).slice().sort((a, b) => k === 'snooze' ? String(a.tot || '').localeCompare(String(b.tot || '')) : String(a.c || '').localeCompare(String(b.c || '')));
  const extraKop = k === 'pauze' ? `<th>${esc(T('kReden'))}</th>` : k === 'snooze' ? `<th>${esc(T('kTot'))}</th>` : `<th>${esc(T('kToegewezen'))}</th>`;
  const extra = p => k === 'pauze' ? `<td>${esc(p.pauze || '–')}</td>` : k === 'snooze' ? `<td><b>${esc(pqTijd(p.tot) || '–')}</b></td>` : `<td>${esc(p.wie || (p.toegewezen ? T('ja') : '–'))}</td>`;
  const det = p => {
    if(S.plOpen !== p.id) return '';
    const d = S.pl[p.id];
    let h;
    if(!d || d.laden) h = `<span class="small muted">${esc(T('ophalen'))}</span>`;
    else if(d.fout) h = `<span class="small" style="color:var(--bad)">${esc(d.fout)}</span>`;
    else {
      const regels = [];
      if(d.pauze) regels.push(`<div><b>${esc(T('kReden'))}:</b> ${esc(d.pauze)}</div>`);
      if(d.tot) regels.push(`<div><b>${esc(T('kTot'))}:</b> ${esc(pqTijd(d.tot))}</div>`);
      if(d.order && d.order.klant) regels.push(`<div><b>${esc(T('klant'))}:</b> ${esc(d.order.klant)}</div>`);
      (d.opmerkingen || []).forEach(o => regels.push(`<div><b>${esc(o.door || T('opmerking'))}</b> <span class="desc">${esc(pqTijd(o.op))}</span><br>${esc(o.tekst)}</div>`));
      h = regels.length ? regels.join('<div class="mt4"></div>') : `<span class="small muted">${esc(T('geenOpm'))}</span>`;
      if(d.order) h += `<div class="small mt8">${esc(T('kOrder'))} ${pqLink('orders/' + d.order.id, d.order.nr || d.order.id)}${d.order.ref ? ' · ' + esc(d.order.ref) : ''}</div>`;
    }
    return `<tr><td colspan="6" style="background:var(--soft)">${h}</td></tr>`;
  };
  return `<div class="card livedetail"><div class="row wrap between"><h3>${esc(T('tl.' + k))} (${nf(lijst.length)})</h3><button class="btn sm ghost" data-lv="open" data-k="${k}">${esc(T('sluiten'))}</button></div>
    ${lijst.length ? `<div class="scroll mt8"><table><tr><th>${esc(T('kPicklijst'))}</th><th>${esc(T('kAangemaakt'))}</th><th class="n">${esc(T('kProducten'))}</th>${extraKop}<th>${esc(T('kRef'))}</th><th></th></tr>
      ${lijst.map(p => `<tr><td>${pqLink('picklists/' + p.id, p.nr || p.id)}${p.u ? ` <span class="badge b-bad">${esc(T('urgent').toLowerCase())}</span>` : ''}</td>
        <td>${esc(pqTijd(p.c))}<div class="desc">${esc(uurTxt(uren(p.c)))}${p.d ? ' · ' + esc(T('voorkeur', { x:dagKort(p.d) })) : ''}</div></td>
        <td class="n">${p.n != null ? nf(p.n) : ''}${p.gp ? `<div class="desc">${esc(T('gepickt', { n:nf(p.gp) }))}</div>` : ''}</td>
        ${extra(p)}<td>${esc(p.ref || '')}</td>
        <td><button class="btn sm" data-lv="pl" data-id="${p.id}">${esc(S.plOpen === p.id ? T('verberg') : T('opm'))}</button></td></tr>${det(p)}`).join('')}</table></div>`
      : `<div class="empty">${esc(T('geenPl'))}</div>`}</div>`;
}
// lijst achter een backorder-tegel
function orderDetail(B){
  const k = S.open;
  const lijst = B.orderLijst.filter(o => k === 'bo-vol' ? o.vol : k === 'bo-wacht' ? !o.vol : true);
  const codeVan = id => S.prod[id] ? S.prod[id].code : null;
  return `<div class="card livedetail"><div class="row wrap between"><h3>${esc(T('tl.' + k))} (${nf(lijst.length)})</h3><button class="btn sm ghost" data-lv="open" data-k="${k}">${esc(T('sluiten'))}</button></div>
    ${lijst.length ? `<div class="scroll mt8"><table><tr><th>${esc(T('kOrder'))}</th><th>${esc(T('kSinds'))}</th><th class="n">${esc(T('kRegels'))}</th><th>${esc(T('kOpVoorraad'))}</th><th>${esc(T('kProducten'))}</th></tr>
      ${lijst.map(o => `<tr><td>${pqLink('orders/' + o.o, T('order', { x:o.o }))}</td><td>${esc(pqTijd(o.oudste))}<div class="desc">${esc(uurTxt(uren(o.oudste)))}</div></td>
        <td class="n">${nf(o.regels.length)}</td><td>${o.vol ? `<span class="badge b-ok">${esc(T('alles'))}</span>` : `<span class="badge b-warn">${esc(T('vanTot', { a:nf(o.opVoorraad), b:nf(o.regels.length) }))}</span>`}</td>
        <td class="small">${o.regels.filter(r => !r.hp).map(r => `<span class="code">${esc(codeVan(r.p) || '#' + r.p)}</span> ${nf(r.a)}${r.v < r.a ? ` <span class="desc">${esc(T('opVrd', { n:nf(r.v) }))}</span>` : ''}`).join('<br>')}</td></tr>`).join('')}</table></div>
      <div class="small muted mt8">${esc(T('codeNoot'))}</div>`
      : `<div class="empty">${esc(T('geenOrders'))}</div>`}</div>`;
}
// picklijsten + backorders (tegels met de lijst eronder); prodHref = waar de tegel Producten heen gaat (Junior: Nu verplaatsen)
function overzicht(opts){
  opts = opts || {};
  if(!S.data) return '';
  const G = picklijstGroepen(S.data.picklijsten);
  const P = picklijstCijfers(S.data.picklijsten);
  const B = backorderCijfers(S.data.backorders);
  const nSnooze = S.data.picklijsten.some(p => p.s === 'snoozed') ? P.gesnoozed : (S.data.gesnoozed || 0);
  const nProd = opts.nProd != null ? opts.nProd : rijen().length;
  return `<div class="card"><div class="row wrap between"><h3>${esc(T('picklijsten'))}</h3><span class="small muted">${P.oudste ? esc(T('oudsteOpen', { x:uurTxt(P.oudsteUur) })) + ' · ' : ''}${esc(T('tikTegel'))}</span></div>
      <div class="tiles mt8">${tegel('open', T('open'), P.open, '', 't-info')}
        ${tegel('urgent', T('urgent'), P.urgent, '', P.urgent ? 't-bad' : 't-ok')}
        ${tegel('o24', T('o24'), P.o24, '', P.o24 ? 't-bad' : 't-ok')}
        ${tegel('o12', T('o12'), P.o12, '', P.o12 ? 't-warn' : 't-ok')}
        ${tegel('o4', T('o4'), P.o4, '', P.o4 ? 't-warn' : 't-ok')}
        ${tegel('pauze', T('pauze'), P.gepauzeerd, esc(T('pauzeSub')), 't-grey')}
        ${tegel('snooze', T('snooze'), nSnooze, esc(T('snoozeSub')), 't-grey')}</div></div>
    ${PL_KEYS.includes(S.open) ? picklijstDetail(G) : ''}
    <div class="card"><h3>${esc(T('backorders'))}</h3>
      <div class="tiles mt8">${tegel('bo-alle', T('boAlle'), B.orders, esc(T('regels', { n:nf(B.regels) })), 't-info')}
        ${tegel('bo-vol', T('boVol'), B.vol, esc(T('boVolSub')), B.vol ? 't-bad' : 't-ok')}
        ${tegel('bo-prod', T('boProd'), nProd, esc(T('boProdSub')), B.vol ? 't-warn' : 't-ok', opts.prodHref)}
        ${tegel('bo-wacht', T('boWacht'), B.wacht, esc(T('boWachtSub')), 't-vst')}</div></div>
    ${/^bo-(alle|vol|wacht)$/.test(S.open) ? orderDetail(B) : ''}`;
}
function lijstKaart(){
  const R = rijen();
  const telSoort = k => R.filter(r => r.st && r.st.soort === k).length;
  const volgorde = { bulk:0, kar:1, los:2, pick:3 };
  R.sort((x, y) => (x.st ? volgorde[x.st.soort] : 9) - (y.st ? volgorde[y.st.soort] : 9) || String(x.b.oudste || '').localeCompare(String(y.b.oudste || '')));
  const cls = { bulk:'b-bulk', pick:'b-ok', kar:'b-warn', los:'b-warn' };
  const status = S.prodLaden ? '<span class="small muted">locaties ophalen…</span>' : S.prodFout ? `<span class="small" style="color:var(--bad)">${esc(S.prodFout.message)}</span>` : '';
  return `<div class="card livelijst" id="lv-lijst"><div class="row wrap between"><div><h3>Direct nodig voor orders</h3>
      <div class="small muted">Orders waarvan alles op voorraad is. ${telSoort('bulk')} van bulk verplaatsen · ${telSoort('pick')} staan al op pick (alleen Verwerk backorders) · ${telSoort('kar') + telSoort('los')} nakijken</div></div>
      <div class="row">${status}<button class="btn sm noprint" data-lv="print">Print lijst</button></div></div>
    <div class="printonly pkop"><b>Direct nodig voor orders</b><span>Picqer ${esc(new Date(S.data.binnen).toLocaleString('nl-NL', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }))}</span></div>
    ${R.length ? `<div class="scroll mt8"><table><tr><th>Product</th><th class="n">Nodig</th><th>Pick (vrij)</th><th>Bulk</th><th>Wat</th></tr>
      ${R.map(({ b, p, st }) => `<tr><td><span class="code">${esc(p ? p.code : '#' + b.id)}</span><div class="desc">${esc(p ? p.naam : '')}</div></td>
        <td class="n"><b>${nf(b.nodig)}</b><div class="desc">${plural(b.orders, 'order', 'orders')}${b.oudste ? ' · ' + esc(uurTxt(uren(b.oudste))) : ''}</div></td>
        <td>${st ? locLijst(st.pick, true) || '<span class="desc">geen</span>' : ''}</td>
        <td>${st ? locLijst(st.bulk) + (st.kar.length ? `<div class="desc">retourkar: ${st.kar.map(l => esc(l.n) + ' ' + nf(l.v)).join(', ')}</div>` : '') + (st.vst.length ? `<div class="desc">VST ${nf(st.vst.reduce((s, l) => s + l.v, 0))}</div>` : '') : ''}</td>
        <td>${st ? `<span class="badge ${cls[st.soort]}">${esc(st.tekst)}</span>` : '<span class="desc">…</span>'}</td></tr>`).join('')}</table></div>`
      : '<div class="empty">Geen orders die alleen op een verplaatsing wachten.</div>'}
    ${B_meer()}</div>`;
}
function B_meer(){ const n = backorderCijfers(S.data.backorders).producten.length; return n > 150 ? `<div class="small muted mt8">Eerste 150 producten getoond (van ${nf(n)}).</div>` : ''; }

// staat dit scherm nu open? (alleen in Warehouse/Test; Junior tekent zelf)
function opScherm(){
  if(!window.WHM) return false;
  const h = (location.hash || '#/').split('?')[0];
  if(h === '#/live') return true;
  return !WHM.TEST && (h === '#/' || h === '#' || h === '#/vandaag' || h === '#/overzicht');
}
// niet opnieuw tekenen terwijl iemand typt (taak, koppelcode); na het typen alsnog
function bezigMetTypen(){ const e = document.activeElement; return !!(e && /INPUT|TEXTAREA|SELECT/.test(e.tagName) && e.closest && e.closest('#app')); }
document.addEventListener('focusout', () => setTimeout(() => { if(S.uitgesteld && !bezigMetTypen()){ S.uitgesteld = false; teken(); } }, 200));
function teken(forceer){
  if(!opScherm()) return;
  const a = app(); if(!a) return;
  if(!forceer && bezigMetTypen()){ S.uitgesteld = true; return; }
  S.uitgesteld = false;
  const y = window.scrollY;
  const dagNaam = new Date().toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'long' }).replace(/^./, c => c.toUpperCase());
  const kopStatus = S.laden ? 'ophalen…' : S.data ? 'bijgewerkt ' + tijd(S.data.binnen) : '';
  let h = `<div class="card"><div class="row wrap between"><div><h2 style="font-size:19px">${esc(dagNaam)}</h2>
      <div class="small muted">Picqer live · alleen lezen${kopStatus ? ' · ' + esc(kopStatus) : ''}</div></div>
      ${code() ? `<div class="row"><button class="btn sm" data-lv="ververs" ${S.laden ? 'disabled' : ''}>Ververs</button><button class="btn sm ghost" data-lv="afkoppelen" title="Koppelcode van dit apparaat wissen">code wissen</button></div>` : ''}</div>
      ${S.fout ? `<div class="status err">${esc(S.fout.message)}</div>` : ''}</div>`;
  if(window.WHTAAK) h += WHTAAK.kaart();
  if(!code()) h += koppelKaart();
  else if(!S.data) h += `<div class="card empty">${S.laden ? 'Ophalen uit Picqer…' : 'Nog niets opgehaald.'}</div>`;
  else {
    h += overzicht() + `
      ${lijstKaart()}`;
  }
  h += containersKaart();
  a.innerHTML = h;
  window.scrollTo(0, y);
}

function view(){
  teken();
  if(code() && !S.laden && (!S.data || Date.now() - S.data.binnen > 120000)) laad();
}

document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-lv]'); if(!b) return;
  const k = b.dataset.lv;
  if(k === 'code'){ const v = ($('lv-code').value || '').trim(); if(!v) return toast('Vul de koppelcode in'); zetCode(v); S.fout = null; laad(true); meld(); }
  if(k === 'ververs'){ S.prod = {}; S.pl = {}; laad(true); }
  if(k === 'afkoppelen'){ zetCode(''); S.data = null; S.fout = null; teken(); meld(); }
  if(k === 'open'){
    ev.preventDefault();
    if(b.dataset.k === 'bo-prod'){ const l = $('lv-lijst'); if(l) l.scrollIntoView({ behavior:'smooth' }); return; }
    S.open = S.open === b.dataset.k ? '' : b.dataset.k; S.plOpen = null; teken(); meld();
    const d = document.querySelector('.livedetail'); if(d && S.open) d.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }
  if(k === 'pl'){
    const id = +b.dataset.id;
    S.plOpen = S.plOpen === id ? null : id;
    if(S.plOpen && !S.pl[id]) haalPicklijst(id); else { teken(); meld(); }
  }
  if(k === 'print'){
    const oud = document.title, n = new Date(), dd = x => String(x).padStart(2, '0');
    document.title = 'Direct nodig voor orders ' + isoDag(n) + ' ' + dd(n.getHours()) + dd(n.getMinutes());
    document.body.classList.add('printlive');
    window.print();
    setTimeout(() => { document.body.classList.remove('printlive'); document.title = oud; }, 500);
  }
});
document.addEventListener('keydown', ev => { if(ev.key === 'Enter' && ev.target && ev.target.id === 'lv-code'){ ev.preventDefault(); const k = document.querySelector('[data-lv="code"]'); if(k) k.click(); } });
// elke 2 minuten vers zolang het scherm open staat
setInterval(() => {
  if(document.visibilityState !== 'visible' || !code() || S.laden || !opScherm()) return;
  if(S.data && Date.now() - S.data.binnen > 120000) laad();
}, 30000);
if(window.WHTAAK) WHTAAK.opHerteken(() => teken(true));
const st = document.createElement('style');
st.textContent = '.livedetail .scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}.livedetail table{width:100%;border-collapse:collapse;font-size:13px}.livedetail th{text-align:left;font-size:11.5px;font-weight:700;color:var(--muted);padding:7px 8px;border-bottom:1px solid var(--line,#cdd5df);background:var(--soft);white-space:nowrap}.livedetail td{padding:6px 8px;border-bottom:1px solid #e6ebf1;vertical-align:top}.livedetail td.n,.livedetail th.n{text-align:right}.badge.b-ok{background:#dff3e8;color:#1c7a4a}'
  + '.tile[data-lv]{cursor:pointer}.tile.aan{outline:2px solid var(--blue);outline-offset:1px}.tile.t-grey{border-left-color:#9aa7b8}'
  + '@media print{body.printlive #app>*:not(.livelijst){display:none !important} body.printlive .livelijst .noprint{display:none !important} body.printlive .livelijst table{font-size:11px}}';
document.head.appendChild(st);

return { view, laad, vraag, rijen, nuLijst, overzicht, taal:(f, l) => { TAAL = f; if(l) LOCALE = l; }, opNieuw:f => LUISTER.push(f), status:() => ({ code:!!code(), data:S.data, laden:S.laden, fout:S.fout, prodLaden:S.prodLaden, klaar:!!S.data && S.prodKlaar }),
  zetCode, picklijstCijfers, picklijstGroepen, backorderCijfers, productStand, uren };
})();
