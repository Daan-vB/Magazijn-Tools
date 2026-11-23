// Containerplanning: binnenkomst (pakbon) los van wegzetten (verdeling = opslagpallets).
// Echte database alleen lezen; opslagpallet alleen in het paginageheugen gezet; alle schrijfpogingen onderschept en geteld.
// Daan 23-11: geen vaste container, geen vast product en geen vaste aantallen. De test kiest zelf pakbonregels (los per stuk, per meter,
// pallet/krat, dozen), zet het opslagpallet in het geheugen op een maat die uit het eigen aantal van die regel volgt en rekent de verwachting daaruit.
const { start, naarContainers, openKaart, kaartTekst, CP_URL, nlGetal } = require('./opzet.js');
const ok = [], fout = [], onder = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + String(x).slice(0, 220) : '')); };
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const G = n => esc(nlGetal(n));
const T0 = [], mem = {};
async function open(hash, ops, vd, vp){
  const T = await start({ vp }); T0.push(T);
  await T.p.route(/supabase\.co\/rest\/v1\/(containers|catalog)\?/, async r => {
    const q = r.request(), u = decodeURIComponent(q.url());
    if(q.method() !== 'GET'){
      onder.push({ m:q.method(), u, b:q.postData() || '' });
      const id = (u.match(/containers\?.*id=eq\.(\d+)/) || [])[1];
      if(id && q.method() === 'PATCH'){ try{ const b = JSON.parse(q.postData() || '{}'); if(b.data) mem[id] = b.data; }catch(e){} }   // in het geheugen: een verversing toont de eigen wijziging
      return r.fulfill({ status:200, contentType:'application/json', body:id && q.method() === 'PATCH' ? JSON.stringify([{ id:+id, updated_at:new Date().toISOString() }]) : '[]' }); }
    const res = await r.fetch(), rows = await res.json();
    // bestaande verdeling uit de oude werkwijze (1 pallet à alles), alleen in het paginageheugen gezet
    if(/containers/.test(u) && vd) rows.forEach(c => { if(c.id === vd.id && !mem[c.id] && c.data) c.data.verdeling[vd.code] = { porties:[{ soort:'pallet', n:1, per:vd.T, dest:'UP' }], bevestigd:false }; });
    if(/containers/.test(u)) rows.forEach(c => { if(mem[c.id]) c.data = mem[c.id]; });
    if(/catalog/.test(u)) rows.forEach(x => { if(x.key === 'catalog-ean' && x.data){ const gezien = new Set(); Object.values(x.data).forEach(g => { if(g && ops && ops[g.sub] !== undefined){ g.qty = String(ops[g.sub]); gezien.add(g.sub); } });
      Object.keys(ops || {}).filter(c => !gezien.has(c)).forEach(c => { x.data['zz-test-' + c] = { sub:c, name:c, ean:'', qty:String(ops[c]) }; }); } });
    return r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(rows) });
  });
  await T.p.goto(CP_URL(hash)); await T.p.waitForSelector('#tabbody', { timeout:90000 }); await T.p.waitForTimeout(3000);
  return T;
}
const rest = (P, code) => P.evaluate(c => { const k = document.getElementById('v-' + c); const r = k && k.querySelector('.rest'); return r ? r.innerText.replace(/\s+/g, ' ') : ''; }, code);
// aantal pallets à p in het advies (de adviesregel kan "VST (opslag)" bevatten; daarom de hele regel, de uitleg erachter noemt geen "n× p")
const telPallets = (t, p) => [...t.matchAll(new RegExp('(\\d+)× ' + G(p) + '\\b', 'g'))].reduce((a, m) => a + +m[1], 0);
(async () => {
  // 0. de test kiest zelf de regels (alleen lezen)
  const K = await start(); await naarContainers(K.p);
  const kies = await K.p.evaluate(() => { const X = CP_TEST, uit = { los:[], meter:[], pallet:null, doos:null };
    X.cont().slice().sort((a, b) => b.id - a.id).forEach(c => { const pl = X.pools(c);
      pl.order.forEach(code => { const rg = (c.data.regels || []).filter(r => r.productcode === code); if(rg.length !== 1) return; const r = rg[0];
        let a; try{ a = X.advies(c, code); }catch(e){ return; } const t = (a && a.uitleg) || ''; if(/Twijfel|Weg|te bepalen|Backorder/.test(t)) return;
        const T = +r.totaal || 0, f = +r.factor || 1, per = +r.per || 1, st = X.eenheid(code) === 'st.';
        if(r.soort === 'los' && f === 1 && per === 1 && st && T >= 3) uit.los.push({ id:c.id, code, T });
        if(r.soort === 'los' && f > 1 && per === 1 && T * f >= 4 && (T * f) % 2 === 0) uit.meter.push({ id:c.id, code, U:T * f, e:X.eenheid(code) });
        if(r.soort === 'pallet' && st && !uit.pallet) uit.pallet = { id:c.id, code, n:+r.aantal || 0, per };
        const d = X.doosVan(c, code); if(r.soort === 'los' && f === 1 && per > 1 && st && d && d.n >= 2 && !uit.doos) uit.doos = { id:c.id, code, D:d.n, N:d.per }; }); });
    return uit; });
  await K.b.close();
  const L1 = kies.los.find(x => x.T >= 4 && x.T % 2 === 0), L2 = kies.los.find(x => x !== L1 && x.id === (L1 || {}).id) || kies.los.find(x => x !== L1), L3 = kies.meter[0];
  console.log('gekozen: L1', JSON.stringify(L1), '· L2', JSON.stringify(L2), '· L3', JSON.stringify(L3), '· pallet', JSON.stringify(kies.pallet), '· doos', JSON.stringify(kies.doos));
  // 1. L1: opslagpallet T/2 → 2 pallets; L2: opslagpallet T − r → 1 pallet + r los; L3 (per meter): opslagpallet U/2 → 2 pallets
  if(L1){
    const p = L1.T / 2, ops = { [L1.code]:p };
    const r2 = L2 ? Math.max(1, Math.floor(L2.T / 4)) : 0, p2 = L2 ? L2.T - r2 : 0; if(L2 && L2.id === L1.id) ops[L2.code] = p2;
    const p3 = L3 ? L3.U / 2 : 0; if(L3 && L3.id === L1.id) ops[L3.code] = p3;
    let T = await open('#/c/' + L1.id + '/pakbon', ops, { id:L1.id, code:L1.code, T:L1.T }), P = T.p;
    await P.evaluate(() => { const d = document.getElementById('voordaan'); if(d) d.open = true; });   // productgegevens staan ingeklapt onder "voor Daan"
    let t = await P.evaluate(c => { const k = [...document.querySelectorAll('.vcard')].find(x => x.innerText.includes(c) && /Binnen/.test(x.innerText)); return k ? k.innerText.replace(/\s+/g, ' ') : ''; }, L1.code);
    check('Pakbonstap ' + L1.code + ': toont "' + L1.T + ' … los", geen "zelf opgebouwd"', (!t || new RegExp('Binnen: ' + G(L1.T) + '\\b.*los').test(t)) && !/zelf opgebouwd/.test(t), t || '(geen productkaart op de pakbonstap)');
    check('Pakbonstap: geen "zelf opgebouwd" op de hele pagina', !(await P.evaluate(() => /zelf opgebouwd/.test(document.body.innerText))));
    await P.evaluate(id => { location.hash = '#/c/' + id + '/verdeling'; }, L1.id); await P.waitForSelector(`[id="v-${L1.code}"]`, { timeout:60000 }); await P.waitForTimeout(800);
    await openKaart(P, L1.code); t = await kaartTekst(P, L1.code);
    check('Verdeling ' + L1.code + ': "Binnen: … ' + L1.T + '" en "Wegzetten: 2 pallets à ' + p + ' (productgeheugen)"', new RegExp('Binnen: .*' + G(L1.T)).test(t) && new RegExp('Wegzetten: 2 pallets à ' + G(p) + ' \\(productgeheugen\\)').test(t), t);
    check('Verdeling ' + L1.code + ': advies 2 pallets à ' + p, telPallets((t.match(/Advies: .*/) || [''])[0], p) === 2, t);
    check('Maat is een vrij getalveld (geen keuzelijst)', await P.evaluate(c => !!document.querySelector(`[id="v-${c}"] input[data-p="per"]`) && !document.querySelector(`[id="v-${c}"] select[data-p="per"]`), L1.code));
    const v = s => `[id="v-${L1.code}"] ${s}`;
    check('Bestaande regel 1 à ' + L1.T + ' (opgeslagen) telt nog als verdeeld', /Alles verdeeld/.test(await rest(P, L1.code)), await rest(P, L1.code));
    await P.fill(v('input[data-p="n"]'), '2'); await P.dispatchEvent(v('input[data-p="n"]'), 'change'); await P.waitForTimeout(900);
    check('Alleen n=2 getypt (2 à ' + L1.T + '): "te veel"', /te veel/.test(await rest(P, L1.code)), await rest(P, L1.code));
    await P.fill(v('input[data-p="per"]'), String(p)); await P.dispatchEvent(v('input[data-p="per"]'), 'change'); await P.waitForTimeout(900);
    check('Getypt 2 à ' + p + ': "Alles verdeeld"', /Alles verdeeld/.test(await rest(P, L1.code)), await rest(P, L1.code));
    await P.fill(v('input[data-p="n"]'), '1'); await P.dispatchEvent(v('input[data-p="n"]'), 'change'); await P.waitForTimeout(900);
    check('1 à ' + p + ': "nog ' + p + ' … niet verdeeld"', new RegExp('nog ' + G(p) + ' .*niet verdeeld').test(await rest(P, L1.code)), await rest(P, L1.code));
    await P.click(v('[data-act="padd"][data-soort="pallet"]')); await P.waitForTimeout(900);
    check('"+ pallets" stelt het opslagpallet voor met wat over is: 1 à ' + p + ' + 1 à ' + p + ' = verdeeld', /Alles verdeeld/.test(await rest(P, L1.code)), await rest(P, L1.code));
    if(L2 && L2.id === L1.id){
      await openKaart(P, L2.code); t = await kaartTekst(P, L2.code);
      check(L2.code + ' ' + L2.T + ' st., opslagpallet ' + p2 + ': Wegzetten 1 pallet à ' + p2 + ' + ' + r2 + ' los', new RegExp('Wegzetten: 1 pallet à ' + G(p2) + ' .*\\+ ' + G(r2) + ' .*los').test(t) && telPallets((t.match(/Advies: .*/) || [''])[0], p2) === 1, (t.match(/Advies: .*/) || [t])[0]);
    }
    if(L3 && L3.id === L1.id){
      await openKaart(P, L3.code); t = await kaartTekst(P, L3.code);
      check(L3.code + ' ' + L3.U + ' ' + L3.e + ', opslagpallet ' + p3 + ': 2 pallets à ' + p3, new RegExp('Wegzetten: 2 pallets à ' + G(p3)).test(t), t);
    }
    for(const w of [390, 1440]){ await P.setViewportSize({ width:w, height:900 }); await P.waitForTimeout(400); check('Verdeling op ' + w + ' px zonder horizontale scroll', await P.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await P.evaluate(() => document.documentElement.scrollWidth)); }
    await T.b.close();
    // L2 en L3 uit een andere container: elk een eigen pagina
    for(const [L, o, tst] of [[L2 && L2.id !== L1.id ? L2 : null, L2 && { [L2.code]:p2 }, t => new RegExp('Wegzetten: 1 pallet à ' + G(p2) + ' .*\\+ ' + G(r2) + ' .*los').test(t) && telPallets((t.match(/Advies: .*/) || [''])[0], p2) === 1],
                              [L3 && L3.id !== L1.id ? L3 : null, L3 && { [L3.code]:p3 }, t => new RegExp('Wegzetten: 2 pallets à ' + G(p3)).test(t)]]){
      if(!L) continue;
      T = await open('#/c/' + L.id + '/verdeling', o); P = T.p; await openKaart(P, L.code); t = await kaartTekst(P, L.code);
      check(L.code + ' (container ' + L.id + '), opslagpallet ' + Object.values(o)[0] + ': wegzetten volgens het opslagpallet', tst(t), t); await T.b.close();
    }
    // 2. opslagpallet = alles → 1 pallet
    T = await open('#/c/' + L1.id + '/verdeling', { [L1.code]:L1.T }); P = T.p;
    await openKaart(P, L1.code); t = await kaartTekst(P, L1.code);
    check('Opslagpallet ' + L1.T + ': 1 pallet à ' + L1.T + ', advies 1 pallet', new RegExp('Wegzetten: 1 pallet à ' + G(L1.T)).test(t) && telPallets((t.match(/Advies: .*/) || [''])[0], L1.T) === 1, t);
    await T.b.close();
  } else console.log('OVERGESLAGEN (1, 2): geen losse stuksregel met een even aantal in de containers');
  // 3. pallet/krat volgens pakbon en doosproduct: akkoorden onaangetast
  for(const [W, o, naam, tst] of [[kies.pallet, kies.pallet && { [kies.pallet.code]:Math.max(2, kies.pallet.per * 2) }, 'Pallet/krat ' + (kies.pallet || {}).code + ' blijft pallet(s) volgens pakbon, geen opslagpallet-omzetting', t => t && !/Wegzetten/.test(t)],
                                  [kies.doos, kies.doos && { [kies.doos.code]:kies.doos.N * 2.5 }, kies.doos ? 'Doosproduct ' + kies.doos.code + ' (' + kies.doos.D + ' dozen à ' + kies.doos.N + '), opslagpallet ' + kies.doos.N * 2.5 + ': alleen hele dozen → ' + Math.floor(kies.doos.D / 2) + ' × 2 dozen' + (kies.doos.D % 2 ? ' + 1 doos' : '') : '',
                                   t => { const k = Math.floor(kies.doos.D / 2); return new RegExp('Wegzetten: ' + k + ' pallets? à ' + G(kies.doos.N * 2)).test(t) && (kies.doos.D % 2 ? /\b1 doos/.test(t) : true); }]]){
    if(!W) continue;
    const v0 = (await (await fetch('https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1/containers?id=eq.' + W.id + '&select=data', { headers:{ apikey:'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA' } })).json())[0].data.verdeling;
    const voor = onder.length;
    const T = await open('#/c/' + W.id + '/verdeling', o), P = T.p;
    await openKaart(P, W.code); const t = await kaartTekst(P, W.code);
    check(naam, tst(t), t);
    const bev = Object.keys(v0).filter(k => v0[k].bevestigd && k !== W.code);
    const akkOk = await P.evaluate(b => b.filter(c => { const k = document.getElementById('v-' + c); return k && /akkoord/.test(k.innerText); }).length, bev);
    check('Container ' + W.id + ': opgeslagen akkoorden blijven akkoord (' + bev.length + ')', akkOk === bev.length, akkOk);
    check('Container ' + W.id + ': niets opgeslagen door alleen kijken', onder.length === voor, onder.length - voor);
    await T.b.close();
  }
  const blok = T0.reduce((a, x) => a + x.blocked.length, 0);
  console.log('ERRORS', T0.flatMap(x => x.errors).filter(e => !/Failed to load resource|jsPDF/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT', '| onderschept', onder.length, '| geblokkeerd', blok);
  process.exit(fout.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
