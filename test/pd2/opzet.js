// gedeelde testopzet: echte database (alleen lezen), schrijven naar wh-pd2-* gaat naar een kopie in het geheugen, al het andere schrijven wordt geblokkeerd en geteld
const { chromium } = require('playwright');
async function start(opt = {}){
  const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy:{ server:process.env.HTTPS_PROXY, bypass:'localhost,127.0.0.1' } } : {});
  const ctx = await b.newContext({ viewport:opt.vp || { width:1440, height:900 }, deviceScaleFactor:1, isMobile:!!opt.mobiel, hasTouch:!!opt.mobiel });
  const p = await ctx.newPage();
  const mock = opt.mock || {}, writes = [], blocked = [], errors = [], pdWrites = [];
  await p.route(/supabase\.co\/(rest|functions)\//, async r => {
    const q = r.request(), m = q.method(), u = decodeURIComponent(q.url());
    if(/\/functions\//.test(u)){ blocked.push('FUNC ' + u.slice(0, 120)); return r.fulfill({ status:503, body:'{"fout":"test: geen Picqer"}' }); }
    if(opt.echt && m === 'GET' && /catalog\?key=/.test(u) && /wh-pd2-oefen/.test(u) && !mock['wh-pd2-oefen']) return r.continue();   // echte antwoorden van Daan lezen (alleen lezen); schrijven gaat naar het geheugen
    if(m === 'GET' && /catalog\?key=/.test(u) && (/wh-pd2-/.test(u) || Object.keys(mock).some(k => /^wh-(palletmaten|doorloop-later|bouwplan|controle-)/.test(k) && u.includes(k)))){
      const exact = k => new RegExp('key=eq\\.' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(&|$)').test(u);
      const rows = Object.entries(mock).filter(([k]) => /^wh-(palletmaten|doorloop-later|bouwplan|controle-)/.test(k) ? exact(k) : u.includes(k)).map(([key, data]) => ({ key, data, updated_at:new Date().toISOString() }));
      return r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(rows) });
    }
    if(m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return r.continue();
    const body = q.postData() || '';
    let rows = null; try{ rows = JSON.parse(body); }catch(e){}
    if(/rest\/v1\/catalog/.test(u) && Array.isArray(rows) && rows.length && rows.every(x => /^(wh-pd2-(oefen|feedback|kopie-.+)|wh-kopie-productdata-.+|wh-taken|wh-palletmaten(-kopie-.+)?|wh-doorloop-later(-kopie-.+)?|wh-bouwplan(-kopie-.+)?|wh-controle-(klopt|reacties|steekproef)(-kopie-.+)?)$/.test(x.key))){ rows.forEach(x => { mock[x.key] = x.data; writes.push(x.key); }); return r.fulfill({ status:201, body:'' }); }
    // week 1: 2.0 schrijft direct naar productdata (bron pd2); in de test alleen vastgelegd, nooit naar de database
    if(/rest\/v1\/productdata/.test(u) && Array.isArray(rows) && rows.length){ rows.forEach(x => { pdWrites.push(x); writes.push('productdata'); }); return r.fulfill({ status:201, body:'' }); }
    blocked.push(m + ' ' + u.slice(0, 160) + ' ' + body.slice(0, 80));
    return r.fulfill({ status:201, body:'' });
  });
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  p.on('console', m => { if(m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 300)); });
  return { b, ctx, p, mock, writes, blocked, errors, pdWrites };
}
async function open(T, hash){
  await T.p.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'ivol.html' + (hash || '#/pd2'));
  await T.p.waitForFunction(() => window.PD2R && PD2R.S.klaar && document.querySelector('.pd2[data-scherm]:not([data-scherm="laden"])'), null, { timeout:120000 });
}
// Daan werkt live verder in de echte database: tests die "voorstellen die op Daans tik wachten" nodig hebben, zetten de situatie vóór zijn besluit
// alleen in het geheugen terug (bevestigde soort en vertrouwd gewicht weer als voorstel). Er wordt niets geschreven.
async function voorBesluit(p, n){
  // eerst wachten tot de echte data er is (2.0 begint met een snelle tussenkopie en laadt daarna opnieuw)
  await p.waitForFunction(() => window.PD2R && PD2R.S.klaar && !PD2R.S.uitSnap, null, { timeout:280000 });
  await p.evaluate(() => PD2R.S.laden).catch(() => {});
  return p.evaluate(n => {
    const R = PD2R, bel = R.belangrijk(), uit = { soort:0, gewicht:0, hoogte:0 };
    const pdZonder = (c, ks) => { const r = WHPD.S.pd[c]; if(!r || !r.data) return; const d = Object.assign({}, r.data); ks.forEach(k => { delete d[k]; }); WHPD.S.pd[c] = Object.assign({}, r, { data:d }); };
    // steeds dezelfde producten (volgorde van de lijst), ook na herladen: wat nu vastligt en waar de data hetzelfde voorstelt
    bel.forEach(c => {
      let st; try{ st = R.status(c); }catch(e){ return; } if(st.kop) return;
      const x = R.S.o.p[c] ? JSON.parse(JSON.stringify(R.S.o.p[c])) : { f:{} }, so = R.soortWaarde(c), I = R.info(c);
      if(uit.soort < n && st.stap.soort && ['bevestigd', 'vastgelegd'].includes(so.st) && !['weg', 'backorder', 'twijfel'].includes(so.v) && I.vsSo && I.vsSo.v === so.v){ delete x.so; delete x.weg; pdZonder(c, ['opslag', 'uitlopend']); uit.soort++; }
      const g = R.gewicht(c);
      if(uit.gewicht < n && g.st === 'vertrouwd' && g.pq > 0 && Math.abs((g.kg || 0) - g.pq) < 1e-9){ delete x.gew; pdZonder(c, ['kgst']); uit.gewicht++; }
      const h = R.waarde(c, 'hoogte', I);
      if(uit.hoogte < n && ['bevestigd', 'vastgelegd'].includes(h.st) && I.vs && I.vs.hoogte && String(I.vs.hoogte.v) === String(h.v)){ if(x.f) delete x.f.hoogte; pdZonder(c, ['hoogte']); uit.hoogte++; }
      R.S.o.p[c] = x; R.ongeldig(c);
    });
    try{ R.dataVers(); }catch(e){}
    // de nagebootste stand ook in de onderschepte opslag (anders haalt het eerste bewaren de echte stand terug); gaat alleen naar het geheugen van de test
    try{ R.S.alles = true; R.flush(); }catch(e){}
    try{ R.meld(); }catch(e){}
    return uit;
  }, n || 60);
}
// containers: de stand van vóór Daans verdeling (alleen bij het lezen nagebootst): verdeling van deze producten weg, status terug naar ingepland
async function containerVoorBesluit(p, id, codes){
  await p.route(/supabase\.co\/rest\/v1\/containers\?/, async r => {
    const q = r.request(); if(q.method() !== 'GET') return r.fallback();
    const res = await r.fetch(); let body = await res.text();
    try{ const j = JSON.parse(body); (Array.isArray(j) ? j : [j]).forEach(c => { if(c && +c.id === +id){ c.status = 'ingepland'; if(c.data){ delete c.data.afgerond_op; codes.forEach(k => { if(c.data.verdeling) delete c.data.verdeling[k]; }); } } }); body = JSON.stringify(j); }catch(e){}
    return r.fulfill({ status:res.status(), headers:res.headers(), body });
  });
}
module.exports = { start, open, voorBesluit, containerVoorBesluit };
