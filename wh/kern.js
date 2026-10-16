/* =====================================================================
   IVOL Warehouse 3.0 — kern: de vier vragen van de warehouse manager + de vloer
     #/kern-nu     Wat moet nu         aanvullen voor orders, aanvulronde, picklijsten, eigen werk
     #/kern-klopt  Wat klopt niet      afwijkingen, datakwaliteit, twijfel, verschil met Picqer
     #/kern-komt   Wat komt eraan      containers en Europese leveringen, ruimte, vraag > voorraad
     #/kern-vast   Waar loopt het vast wachtende orders, oude picklijsten, structurele backorders, per uur
     #/kern-vloer  Vloer (telefoon)    aanvullen per gang, NL/EN/ES/EL
   Leest uit de kern (Edge Function wh-api, koppelcode zoals Picqer live). Elk advies heeft uitleg;
   een mens beslist. Niets gaat naar Picqer: de verplaatsing zelf doe je in de Picqer-app.
   Staat de kern nog niet live, dan zegt het scherm dat (geen nep-gegevens).
   ===================================================================== */
window.WHK = (function(){
'use strict';
const { esc } = WH;
const M = window.WHKM, TK = window.WHKT;
const nf = M.nf;
const ls = (k, v) => { try{ if(v === undefined) return localStorage.getItem(k); if(v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){ return null; } };
const ss = (k, v) => { try{ if(v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); }catch(e){ return null; } };
const FN = () => ls('ivol-kern-fn') || (WH.URL_ + '/functions/v1/wh-api');
const code = () => ls('ivol-koppelcode') || '';
const S = { naam:'', el:null, rest:'', data:{}, etag:{}, fout:{}, laden:{}, gang:'', gedaan:new Set(), open:{} };
const TITEL = { nu:'Wat moet nu', klopt:'Wat klopt niet', komt:'Wat komt eraan', vast:'Waar loopt het vast', vloer:'Aanvullen', product:'Product' };

/* ---------- kern-API ---------- */
async function haal(scherm, extra){
  const k = scherm + (extra || '');
  S.laden[k] = true;
  try{
    const kop = { apikey:WH.KEY, 'x-ivol-code':code() };
    if(S.etag[k] && S.data[k]) kop['If-None-Match'] = S.etag[k];
    let r;
    try{ r = await fetch(FN() + '?scherm=' + encodeURIComponent(scherm) + (extra || ''), { headers:kop, cache:'no-store' }); }
    catch(e){ throw Object.assign(new Error('wh-api niet bereikbaar'), { soort:'niet-live' }); }
    if(r.status === 304){ S.fout[k] = null; return S.data[k]; }
    const j = await r.json().catch(() => null);
    if(r.status === 401 && j && j.code === 'koppelcode') throw Object.assign(new Error('koppelcode'), { soort:'code' });
    if(r.status === 404) throw Object.assign(new Error('wh-api niet gevonden'), { soort:'niet-live' });
    if(!r.ok) throw new Error((j && j.fout) || ('status ' + r.status));
    S.data[k] = j; S.etag[k] = r.headers.get('ETag') || ''; S.fout[k] = null;
    return j;
  }catch(e){ S.fout[k] = e; throw e; }
  finally{ S.laden[k] = false; }
}
async function actie(naam, body){
  const kop = { apikey:WH.KEY, 'x-ivol-code':code(), 'Content-Type':'application/json' };
  if(String(body.door || '').toLowerCase() === 'daan'){
    let pin = ss('ivol-kern-pin');
    if(!pin){ pin = (window.prompt('Pincode van Daan (alleen voor bevestigen namens Daan):') || '').trim(); if(!pin) throw new Error('geen pincode'); ss('ivol-kern-pin', pin); }
    kop['x-ivol-pin'] = pin;
  }
  const r = await fetch(FN() + '?actie=' + encodeURIComponent(naam), { method:'POST', headers:kop, body:JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if(r.status === 403) ss('ivol-kern-pin', '');
  if(!r.ok) throw new Error(j.fout || ('status ' + r.status));
  return j;
}

/* ---------- stijl (alleen voor deze schermen) ---------- */
function stijl(){
  if(document.getElementById('k-stijl')) return;
  const s = document.createElement('style'); s.id = 'k-stijl';
  s.textContent = `
  .k-status{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--muted)}
  .k-status i{font-style:normal;font-weight:800;padding:2px 8px;border-radius:9px}
  .k-ok{background:#dff3e8;color:#1c7a4a}.k-let{background:#fff1dc;color:#b86e00}.k-oud,.k-rood{background:#fde4e2;color:#b3261e}.k-geen{background:#e9ecf0;color:#5b6673}
  .fblok.k-rood{border-top-color:#b3261e}.fblok.k-let{border-top-color:#e0a100}.fblok.k-ok{border-top-color:#1c7a4a}
  .k-advies{display:grid;gap:4px;padding:10px 0;border-bottom:1px solid #eef1f5}.k-advies:last-child{border-bottom:0}
  .k-advies b{font-size:15px}.k-advies .uitleg{color:var(--muted);font-size:13.5px;max-width:80ch}
  .k-rij{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}.k-rij .knop{min-height:40px;padding:6px 12px;font-size:13px}
  .k-pijl{font-weight:800;color:var(--muted);padding:0 4px}
  .k-staaf{display:grid;grid-template-columns:34px 1fr 64px;gap:8px;align-items:center;font-size:13px}
  .k-staaf .bar{position:relative;height:16px;background:#eef1f5;border-radius:4px;overflow:hidden}
  .k-staaf .bar i{position:absolute;left:0;top:0;bottom:0;background:#1d4ea0}.k-staaf .bar u{position:absolute;top:0;bottom:0;width:2px;background:#e8590c}
  .k-vloer{max-width:640px;margin:0 auto;padding:12px 12px 90px;display:grid;gap:12px}
  .k-vloer h1{font-size:22px}
  .k-chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}
  .k-chips button{flex:none;min-height:44px;padding:6px 14px;border-radius:22px;border:1px solid var(--lijn);background:#fff;font:inherit;font-weight:700;cursor:pointer}
  .k-chips button.aan{background:#10151c;color:#fff;border-color:#10151c}.k-chips button .o{color:#e8590c}
  .k-kaart{background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(15,23,32,.1);padding:14px;display:grid;gap:8px;border-left:8px solid #1d4ea0}
  .k-kaart.orders{border-left-color:#e8590c}
  .k-kaart .code{font-family:ui-monospace,Consolas,monospace;font-size:20px;font-weight:800;overflow-wrap:anywhere}
  .k-kaart .naam{color:var(--muted);font-size:14px}
  .k-route{display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;font-size:18px;font-weight:800}
  .k-route small{display:block;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
  .k-aantal{font-size:30px;font-weight:900;font-variant-numeric:tabular-nums}
  .k-gedaan{min-height:56px;font-size:18px;font-weight:800;border-radius:12px;border:0;background:#1c7a4a;color:#fff;cursor:pointer}
  .k-gedaan[disabled]{opacity:.5}
  @media (max-width:520px){.k-route{font-size:16px}.k-aantal{font-size:26px}}`;
  document.head.appendChild(s);
}

/* ---------- algemene stukken ---------- */
const tl = () => TK.taal();
const t = (k, v) => TK.t(tl(), k, v);
function statusRegel(d){
  const v = M.versheid(d && d.versheid);
  const tekst = v.status === 'geen' ? 'nog geen Picqer-stand' : 'Picqer ' + M.leeftijd(v.min, 'nl', TK.t) + ' geleden';
  return `<div class="k-status"><i class="k-${v.status}">${esc(tekst)}</i>${v.fouten.length ? `<span>${v.fouten.length} koppeling(en) met een fout: ${esc(v.fouten.map(f => f.endpoint).join(', '))}</span>` : ''}
    <button class="knop" data-k="ververs">Vernieuwen</button></div>`;
}
function foutBlok(e){
  if(!e) return '';
  if(e.soort === 'code') return `<div class="blok let"><b>Koppelcode nodig.</b> Vul hem in bij <a href="#/bronnen">Koppeling Picqer</a>; dezelfde code geldt voor de kern.</div>`;
  if(e.soort === 'niet-live') return `<div class="blok let"><b>De kern is nog niet live.</b> Dit scherm leest uit de nieuwe masterdatabase (functie wh-api). Zolang Daan die niet live heeft gezet, blijft het leeg. De bestaande schermen werken gewoon.</div>`;
  return `<div class="melding">Lukt niet: ${esc(e.message)}</div>`;
}
function advies(a, knoppen){
  const v = a.voorstel || {};
  const van0 = (v.van || [])[0] || '';
  const route = (Array.isArray(v.van) || Array.isArray(v.naar)) && !(van0 && String(a.onderwerp).includes(van0))
    ? `<span class="code">${esc((v.van || [])[0] || '–')}</span><span class="k-pijl">→</span><span class="code">${esc((v.naar || [])[0] || 'geen specifieke locatie')}</span> · <b>${nf(v.aantal)}</b>` : '';
  return `<div class="k-advies"><b>${esc(a.onderwerp)}</b>${route ? `<div>${route}</div>` : ''}<div class="uitleg">${esc(a.uitleg)}</div>
    ${knoppen ? `<div class="k-rij">${knoppen.map(([b, label]) => `<button class="knop" data-k="beslis" data-id="${a.id}" data-b="${b}">${esc(label)}</button>`).join('')}</div>` : ''}</div>`;
}
const tabel = (kop, rijen, leeg) => rijen.length
  ? `<div class="tabel"><table><thead><tr>${kop.map(k => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rijen.join('')}</tbody></table></div>`
  : `<div class="leeg">${esc(leeg || 'Niets.')}</div>`;
const datum = iso => iso ? new Date(iso).toLocaleString('nl-NL', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '–';
const dag = iso => iso ? new Date(String(iso).length <= 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('nl-NL', { weekday:'short', day:'numeric', month:'short' }) : '–';
const pagina = (titel, lede, d, inhoud) => `<div class="pagina"><h1>${esc(titel)}</h1><p class="lede">${esc(lede)}</p>${statusRegel(d)}${inhoud}</div>`;
const ikNaam = () => ls('ivol-ik') || '';
const rol = () => ls('ivol-rol') || 'daan';

/* ---------- 1. Wat moet nu ---------- */
function viewNu(d){
  const tegels = M.tegelsNu(d).map(x => `<div class="fblok k-${x.klasse}"><div class="kern"><b>${nf(x.waarde)}</b> ${esc(x.label)}</div><div class="klein muted">${esc(x.sub)}</div></div>`).join('');
  const perGang = {};
  (d.ronde || []).forEach(a => { const g = ((a.voorstel.naar || [])[0] || '').slice(0, 2) || 'Overig'; (perGang[g] = perGang[g] || []).push(a); });
  const daan = rol() === 'daan';
  return pagina('Wat moet nu', 'Eerst wat een klant vrijmaakt, dan de ronde per gang. Elk advies zegt waarom. De verplaatsing zelf doe je in de Picqer-app.', d, `
    <div class="fund">${tegels}</div>
    <section class="blok"><h2>Eerst: orders wachten (${nf((d.voor_orders || []).length)})</h2>${(d.voor_orders || []).map(a => advies(a)).join('') || '<div class="leeg">Geen order wacht op een verplaatsing.</div>'}</section>
    <section class="blok"><h2>Aanvulronde (${nf((d.ronde || []).length)})</h2>${Object.keys(perGang).sort().map(g => `<details class="pgroep"${S.open['g' + g] ? ' open' : ''} data-open="g${esc(g)}"><summary><b>Gang ${esc(g)}</b> <i class="tel">${perGang[g].length}</i></summary>${perGang[g].map(a => advies(a)).join('')}</details>`).join('') || '<div class="leeg">Alles boven het niveau.</div>'}</section>
    ${(d.bulk_leeg || []).length ? `<section class="blok"><h2>Pick én bulk leeg (${nf(d.bulk_leeg.length)})</h2>${d.bulk_leeg.map(a => advies(a)).join('')}</section>` : ''}
    ${daan ? `<section class="blok"><h2>Jouw werklijst</h2><p class="klein muted">Wat nog vastgelegd moet worden, op impact. Volledige lijst bij Wat klopt niet.</p>${(d.werk || []).map(a => advies(a, [['later', 'Later'], ['afgewezen', 'Niet nodig']])).join('') || '<div class="leeg">Niets.</div>'}</section>` : ''}`);
}

/* ---------- 2. Wat klopt niet ---------- */
function viewKlopt(d){
  const tel = M.afwijkingTellers(d.afwijkingen);
  return pagina('Wat klopt niet', 'Afwijkingen die de kern vond, met de cijfers erachter. Opgelost of klopt niet: tik het aan, dan weet de kern het.', d, `
    <div class="fund">${tel.map(x => `<div class="fblok k-let"><div class="kern"><b>${nf(x.n)}</b> ${esc(x.label)}</div></div>`).join('') || '<div class="fblok k-ok"><div class="kern"><b>0</b> afwijkingen</div></div>'}
      <div class="fblok"><div class="kern"><b>${nf(d.twijfel)}</b> twijfel over productcode</div><div class="klein muted">Productcode is heilig: eerst uitzoeken.</div></div>
      <div class="fblok"><div class="kern"><b>${nf(d.naar_picqer)}</b> keer Picqer bijwerken</div><div class="klein muted">Eigen besluit wijkt af van Picqer (importlijst).</div></div></div>
    <section class="blok"><h2>Afwijkingen</h2>${(d.lijst || []).map(a => `<div class="klein muted">${esc(M.watNaam(a.bewijs && a.bewijs.wat))}</div>` + advies(a, [['bevestigd', 'Opgelost'], ['later', 'Later'], ['afgewezen', 'Klopt niet']])).join('') || '<div class="leeg">Geen afwijkingen.</div>'}</section>
    <section class="blok"><h2>Productgegevens (laag 1 en 2)</h2>${tabel(['Veld', 'Compleet', 'Bevestigd', 'Afgeleid', 'Voorstellen', 'Gem. leeftijd'],
      (d.datakwaliteit || []).map(r => `<tr><td>${esc(r.label)}</td><td class="${Number(r.compleet) < 80 ? 'let' : ''}">${nf(r.compleet, 1)}%</td><td>${nf(r.bevestigd)}</td><td>${nf(r.afgeleid)}</td><td>${nf(r.voorstellen)}</td><td>${r.leeftijd === null ? '–' : nf(r.leeftijd) + ' d'}</td></tr>`), 'Nog geen productgegevens in de kern.')}</section>
    ${d.reconstructie ? `<section class="blok"><h2>Voorraadhistorie per locatie</h2><p class="klein">Klopt: ${nf(d.reconstructie.klopt)} · begin onbekend: ${nf(d.reconstructie.begin_onbekend)} · boekingen kloppen niet: <b>${nf(d.reconstructie.negatief)}</b> · van ${nf(d.reconstructie.paren)} product-locaties.</p></section>` : ''}`);
}

/* ---------- 3. Wat komt eraan ---------- */
function viewKomt(d){
  return pagina('Wat komt eraan', 'Containers en Europese leveringen, of er ruimte is, en waar de verwachte vraag de voorraad overtreft.', d, `
    <section class="blok"><h2>Inkomend</h2>${tabel(['Datum', 'Soort', 'Naam', 'Leverancier', 'Regels', 'Pallets', 'Zonder stuks/pallet'],
      (d.inkomend || []).map(x => `<tr><td>${esc(dag(x.datum))}</td><td>${esc(x.soort)}</td><td class="code">${esc(x.naam)}</td><td>${esc(x.leverancier || '')}</td><td>${nf(x.regels)}</td><td>${x.pallets === undefined ? '–' : nf(x.pallets)}</td><td class="${x.zonder_spp ? 'let' : ''}">${x.zonder_spp === undefined ? '–' : nf(x.zonder_spp)}</td></tr>`), 'Niets gepland.')}</section>
    <section class="blok"><h2>Ruimte</h2>${(d.ruimte || []).map(a => advies(a)).join('') || '<div class="leeg">Geen knelpunten.</div>'}</section>
    <section class="blok"><h2>Vraag groter dan voorraad (komende 4 weken)</h2>${tabel(['Product', 'Verwacht', '80%-band', 'Voorraad', 'Komt', 'Tekort'],
      (d.tekort || []).map(x => `<tr title="${esc(x.uitleg || '')}"><td><span class="code">${esc(x.code)}</span> <span class="klein muted">${esc(x.naam || '')}</span></td><td>${nf(x.vraag_4w)}</td><td>${nf(x.band[0])}–${nf(x.band[1])}</td><td>${nf(x.voorraad)}</td><td>${nf(x.komt)}</td><td class="let">${nf(x.tekort)}</td></tr>`), 'Geen tekort verwacht.')}</section>`);
}

/* ---------- 4. Waar loopt het vast ---------- */
function viewVast(d){
  const st = M.staafjes(d.vandaag_per_uur);
  return pagina('Waar loopt het vast', 'Wat staat te wachten en waarom: orders, picklijsten, backorders. En het tempo van vandaag naast een gewone dag.', d, `
    <section class="blok"><h2>Orders die wachten op een verplaatsing</h2>${tabel(['Product', 'Orders', 'Nodig', 'Wacht sinds'],
      (d.orders_wachten || []).map(x => `<tr><td class="code">${esc(x.code)}</td><td>${nf(x.orders)}${x.ordernummers ? ` <span class="klein muted">${esc(x.ordernummers.slice(0, 3).join(', '))}${x.ordernummers.length > 3 ? '…' : ''}</span>` : ''}</td><td>${nf(x.nodig)}</td><td class="${M.minutenOud(x.oudste) > 240 ? 'let' : ''}">${esc(datum(x.oudste))}</td></tr>`), 'Geen order wacht.')}</section>
    <section class="blok"><h2>Picklijsten ouder dan 24 uur</h2>${tabel(['Picklijst', 'Status', 'Aangemaakt'],
      (d.picklijsten_oud || []).map(x => `<tr><td class="code">${esc(x.nummer)}${x.urgent ? ' <i class="st warn">urgent</i>' : ''}</td><td>${esc(x.status)}</td><td>${esc(datum(x.aangemaakt))}</td></tr>`), 'Geen.')}
      ${(d.gepauzeerd_sinds || []).length ? `<p class="klein">Gepauzeerd: ${d.gepauzeerd_sinds.map(x => esc(x.nummer) + ' sinds ' + esc(datum(x.sinds))).join(' · ')}. De reden staat in Picqer (niet in de kern: vrije tekst).</p>` : ''}</section>
    <section class="blok"><h2>Structureel in backorder</h2>${(d.structureel || []).map(a => advies(a)).join('') || '<div class="leeg">Geen.</div>'}</section>
    <section class="blok"><h2>Pickregels per uur</h2><p class="klein muted">Blauw = vandaag, oranje streep = gemiddelde van de laatste 20 werkdagen.</p>
      ${st.map(x => `<div class="k-staaf"><span>${x.uur}:00</span><span class="bar"><i style="width:${x.pv}%"></i><u style="left:${x.pg}%"></u></span><span>${nf(x.vandaag)} / ${nf(x.gem, 1)}</span></div>`).join('')}</section>
    ${d.achterstand_meldingen ? `<section class="blok let"><b>${nf(d.achterstand_meldingen)} meldingen</b> van de vloer nog niet afgehandeld.</section>` : ''}`);
}

/* ---------- 5. Vloer (telefoon) ---------- */
function viewVloer(d){
  const L = M.vloerLijst(d, { gedaan:S.gedaan, gang:S.gang });
  const v = M.versheid(d && d.versheid);
  const taal = tl();
  const wie = ikNaam();
  return `<div class="k-vloer">
    <div class="k-chips" role="group" aria-label="${esc(t('taal'))}">${TK.TALEN.map(x => `<button data-k="taal" data-t="${x}" class="${x === taal ? 'aan' : ''}" lang="${x}">${esc(TK.NAAM[x])}</button>`).join('')}</div>
    <h1>${esc(t('titel'))}</h1>
    <p class="klein muted">${esc(t('uitleg'))}</p>
    ${v.status === 'oud' ? `<div class="melding">${esc(t('oud', { x:M.leeftijd(v.min, taal, TK.t) }))}</div>` : `<div class="klein muted">${esc(t('bijgewerkt', { x:M.leeftijd(v.min, taal, TK.t) }))}</div>`}
    ${!wie ? `<div class="blok"><b>${esc(t('wie'))}</b><span class="klein muted">${esc(t('wieUitleg'))}</span><div class="veldrij"><input id="k-wie" autocomplete="name"><button class="knop pri" data-k="wie">${esc(t('opslaan'))}</button></div></div>` : ''}
    <div class="k-chips"><button data-k="gang" data-g="" class="${!S.gang ? 'aan' : ''}">${esc(t('alleGangen'))} · ${L.totaal}</button>${L.alle.map(x => `<button data-k="gang" data-g="${esc(x.gang)}" class="${S.gang === x.gang ? 'aan' : ''}">${esc(x.gang)} · ${x.n}${x.orders ? ' <span class="o">●</span>' : ''}</button>`).join('')}</div>
    ${L.gangen.map(g => `<h2 class="bt">${esc(t('gang'))} ${esc(g.gang)}</h2>` + g.regels.map(r => `<div class="k-kaart${r.orders ? ' orders' : ''}">
        ${r.orders ? `<div class="klein" style="color:#e8590c;font-weight:800">● ${esc(t('voorOrders'))}</div>` : ''}
        <div class="code">${esc(r.code)}</div><div class="naam">${esc(r.naam || '')}</div>
        <div class="k-route"><span><small>${esc(t('van'))}</small>${esc(r.van || '–')}</span><span class="k-pijl">→</span><span><small>${esc(t('naar'))}</small>${esc(r.naar || t('geenLocatie'))}</span></div>
        <div class="k-aantal">${nf(r.aantal)} <span class="klein muted">${esc(t('stuks', { n:Number(r.aantal) }))}</span></div>
        <button class="k-gedaan" data-k="gedaan" data-id="${r.id}" ${wie ? '' : 'disabled'}>✓ ${esc(t('gedaan'))}</button></div>`).join('')).join('') || `<div class="leeg">${esc(t('leeg'))}</div>`}
  </div>`;
}

/* ---------- productkaart (vanuit adviezen) ---------- */
function viewProduct(d, codeTxt){
  if(!d || !d.product) return `<div class="pagina"><h1>${esc(codeTxt)}</h1><div class="leeg">Onbekend in de kern.</div></div>`;
  const p = d.product;
  return pagina(p.productcode, p.naam || '', d, `
    ${(d.twijfel || []).length ? `<div class="melding">Twijfel: ${esc(d.twijfel.join(', '))}</div>` : ''}
    <section class="blok"><h2>Wat we weten</h2>${tabel(['Veld', 'Waarde', 'Zekerheid', 'Bron', 'Wanneer'],
      (d.eigen || []).map(e => `<tr><td>${esc(e.label)}</td><td><b>${esc(e.waarde)}</b></td><td>${esc(e.zekerheid)}</td><td class="klein">${esc(e.bron)}${e.door ? ' · ' + esc(e.door) : ''}</td><td class="klein">${esc(dag(e.op))}</td></tr>`), 'Nog niets vastgelegd.')}</section>
    ${(d.voorstellen || []).length ? `<section class="blok"><h2>Voorstellen (nog niet bevestigd)</h2>${tabel(['Veld', 'Voorstel', 'Nu', 'Waarom'], d.voorstellen.map(v => `<tr><td>${esc(v.veld)}</td><td><b>${esc(v.waarde)}</b></td><td>${esc(v.geldend || '–')}</td><td class="klein">${esc(v.uitleg || '')}</td></tr>`))}</section>` : ''}
    <section class="blok"><h2>Verpakking</h2>${tabel(['Niveau', 'Stuks', 'Maat', 'Gewicht (kg)'], (d.verpakking || []).map(v => `<tr><td>${esc(v.niveau)}</td><td>${nf(v.stuks)}</td><td>${esc(v.maat || '–')}</td><td>${nf(v.gewicht_kg, 1)}</td></tr>`), 'Onbekend.')}</section>
    <section class="blok"><h2>Voorraad</h2>${tabel(['Plek', 'Soort', 'Voorraad', 'Vrij'], (d.voorraad || []).map(v => `<tr><td class="code">${esc(v.plek || 'geen specifieke locatie')}</td><td>${esc(v.soort)}</td><td>${nf(v.voorraad)}</td><td>${nf(v.vrij)}</td></tr>`), 'Geen voorraad.')}
      ${d.vraag ? `<p class="klein">${esc(d.vraag.uitleg)}</p>` : ''}</section>`);
}

/* ---------- tekenen ---------- */
function teken(){
  const el = S.el; if(!el) return;
  stijl();
  const sleutel = S.naam === 'product' ? 'product&code=' + encodeURIComponent(S.rest) : S.naam;
  const d = S.data[sleutel], e = S.fout[sleutel];
  if(!d){
    el.innerHTML = `<div class="${S.naam === 'vloer' ? 'k-vloer' : 'pagina'}"><h1>${esc(S.naam === 'vloer' ? t('titel') : TITEL[S.naam] || '')}</h1>${e ? foutBlok(e) : `<div class="leeg">${esc(S.naam === 'vloer' ? t('laden') : 'Laden…')}</div>`}</div>`;
    return;
  }
  const html = S.naam === 'nu' ? viewNu(d) : S.naam === 'klopt' ? viewKlopt(d) : S.naam === 'komt' ? viewKomt(d) : S.naam === 'vast' ? viewVast(d)
    : S.naam === 'vloer' ? viewVloer(d) : viewProduct(d, S.rest);
  el.innerHTML = (e ? foutBlok(e) : '') + html;
}
async function laad(){
  const naam = S.naam;
  try{ await haal(naam === 'product' ? 'product' : naam, naam === 'product' ? '&code=' + encodeURIComponent(S.rest) : ''); }catch(e){ /* foutBlok toont het */ }
  if(S.naam === naam) teken();
}
function render(naam, el, rest){
  S.naam = naam; S.el = el; S.rest = decodeURIComponent(rest || '');
  teken(); laad();
}
// zolang een kernscherm open staat: elke minuut kijken (ETag: kost niets als er niets veranderde)
setInterval(() => { if(document.visibilityState === 'visible' && S.el && !S.el.hidden && S.naam && /^#\/kern-/.test(location.hash)) laad(); }, 60000);

document.addEventListener('toggle', ev => { const d = ev.target; if(d && d.dataset && d.dataset.open) S.open[d.dataset.open] = d.open; }, true);
document.addEventListener('click', async ev => {
  const b = ev.target.closest && ev.target.closest('[data-k]'); if(!b || !S.el || !S.el.contains(b)) return;
  const k = b.dataset.k;
  if(k === 'ververs'){ S.etag = {}; laad(); return; }
  if(k === 'taal'){ ls('junior-taal', b.dataset.t); teken(); return; }
  if(k === 'gang'){ S.gang = b.dataset.g || ''; teken(); return; }
  if(k === 'wie'){ const v = ((document.getElementById('k-wie') || {}).value || '').trim(); if(v){ ls('ivol-ik', v); teken(); } return; }
  if(k === 'gedaan'){
    b.disabled = true;
    try{ await actie('gedaan', { advies:Number(b.dataset.id), persoon:ikNaam() }); S.gedaan.add(Number(b.dataset.id)); WH.toast(t('gedaanDoor', { x:ikNaam() })); teken(); }
    catch(e){ b.disabled = false; WH.toast(t('fout', { x:e.message }), 6000); }
    return;
  }
  if(k === 'beslis'){
    const door = rol() === 'daan' ? 'Daan' : (ikNaam() || rol());
    b.disabled = true;
    try{ await actie('beslis', { advies:Number(b.dataset.id), besluit:b.dataset.b, door }); WH.toast('Vastgelegd'); S.etag = {}; laad(); }
    catch(e){ b.disabled = false; WH.toast('Lukt niet: ' + e.message, 6000); }
  }
});
return { render, haal, S };
})();
