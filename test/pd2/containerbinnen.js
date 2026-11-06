// Containerplanning: binnenkomst (pakbon) los van wegzetten (verdeling = opslagpallets). Container GW2026-BH013 (id 8) en HR26078 (id 13).
// Echte database alleen lezen; opslagpallet alleen in het paginageheugen gezet; alle schrijfpogingen onderschept en geteld.
const { start } = require('./opzet.js');
const ok = [], fout = [], onder = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + String(x).slice(0, 220) : '')); };
const url = h => (process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html' + h;
const T0 = [], mem = {};
async function open(hash, ops, vp){
  const T = await start({ vp }); T0.push(T);
  await T.p.route(/supabase\.co\/rest\/v1\/(containers|catalog)\?/, async r => {
    const q = r.request(), u = decodeURIComponent(q.url());
    if(q.method() !== 'GET'){
      onder.push({ m:q.method(), u, b:q.postData() || '' });
      const id = (u.match(/containers\?.*id=eq\.(\d+)/) || [])[1];
      if(id && q.method() === 'PATCH'){ try{ const b = JSON.parse(q.postData() || '{}'); if(b.data) mem[id] = b.data; }catch(e){} }   // in het geheugen: een verversing toont de eigen wijziging
      return r.fulfill({ status:200, contentType:'application/json', body:id && q.method() === 'PATCH' ? JSON.stringify([{ id:+id, updated_at:new Date().toISOString() }]) : '[]' }); }
    const res = await r.fetch(), rows = await res.json();
    // bestaande regel uit de oude werkwijze (1 pallet à 30), alleen in het paginageheugen gezet
    if(/containers/.test(u) && ops && ops.__vd) rows.forEach(c => { if(c.id === 8 && !mem[8] && c.data) c.data.verdeling.RP0100 = { porties:[{ soort:'pallet', n:1, per:30, dest:'UP' }], bevestigd:false }; });
    if(/containers/.test(u)) rows.forEach(c => { if(mem[c.id]) c.data = mem[c.id]; });
    if(/catalog/.test(u)) rows.forEach(x => { if(x.key === 'catalog-ean' && x.data) Object.values(x.data).forEach(g => { if(g && ops && ops[g.sub] !== undefined && g.sub !== "__vd") g.qty = String(ops[g.sub]); }); });
    return r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(rows) });
  });
  await T.p.goto(url(hash)); await T.p.waitForSelector('#tabbody', { timeout:90000 }); await T.p.waitForTimeout(3000);
  return T;
}
const kaart = (P, code) => P.evaluate(c => { const k = document.getElementById('v-' + c) || [...document.querySelectorAll('.vcard')].find(x => x.innerText.includes(c)); return k ? k.innerText.replace(/\s+/g, ' ') : ''; }, code);
const rest = (P, code) => P.evaluate(c => { const k = document.getElementById('v-' + c); const r = k && k.querySelector('.rest'); return r ? r.innerText.replace(/\s+/g, ' ') : ''; }, code);
(async () => {
  // 1. RP0100: opslagpallet 15
  let T = await open('#/c/8/pakbon', { RP0100:15, RPNBR0300:15, '01010300':150, __vd:1 }), P = T.p;
  await P.evaluate(() => { const d = document.getElementById('voordaan'); if(d) d.open = true; });   // productgegevens staan sinds 06-11 ingeklapt onder "voor Daan"
  let t = await P.evaluate(() => { const k = [...document.querySelectorAll('.vcard')].find(x => x.innerText.includes('RP0100') && /Binnen/.test(x.innerText)); return k ? k.innerText.replace(/\s+/g, ' ') : ''; });
  check('Pakbonstap RP0100: toont "30 … los", geen "zelf opgebouwd"', /Binnen: 30 .*30 .*los/.test(t) && !/zelf opgebouwd/.test(document_text(t)), t);
  check('Pakbonstap: geen "zelf opgebouwd" op de hele pagina', !(await P.evaluate(() => /zelf opgebouwd/.test(document.body.innerText))));
  await P.evaluate(() => { location.hash = '#/c/8/verdeling'; }); await P.waitForSelector('#v-RP0100', { timeout:60000 }); await P.waitForTimeout(800);
  t = await kaart(P, 'RP0100');
  check('Verdeling RP0100: "Binnen: … 30 …" en "Wegzetten: 2 pallets à 15 (productgeheugen)"', /Binnen: .*30/.test(t) && /Wegzetten: 2 pallets à 15 \(productgeheugen\)/.test(t), t);
  check('Verdeling RP0100: advies 2× 15', /Advies: .*2× 15/.test(t), t);
  check('Maat is een vrij getalveld (geen keuzelijst)', await P.evaluate(() => !!document.querySelector('#v-RP0100 input[data-p="per"]') && !document.querySelector('#v-RP0100 select[data-p="per"]')));
  // bestaande regel 1 à 30 → 2 à 15 door te typen
  check('Bestaande regel 1 à 30 (opgeslagen) telt nog als verdeeld', /Alles verdeeld/.test(await rest(P, 'RP0100')), await rest(P, 'RP0100'));
  await P.fill('#v-RP0100 input[data-p="n"]', '2'); await P.dispatchEvent('#v-RP0100 input[data-p="n"]', 'change'); await P.waitForTimeout(900);
  check('Alleen n=2 getypt (2 à 30): "30 rollen te veel"/"te veel"', /te veel/.test(await rest(P, 'RP0100')), await rest(P, 'RP0100'));
  await P.fill('#v-RP0100 input[data-p="per"]', '15'); await P.dispatchEvent('#v-RP0100 input[data-p="per"]', 'change'); await P.waitForTimeout(900);
  check('Getypt 2 à 15: "Alles verdeeld"', /Alles verdeeld/.test(await rest(P, 'RP0100')), await rest(P, 'RP0100'));
  await P.fill('#v-RP0100 input[data-p="n"]', '1'); await P.dispatchEvent('#v-RP0100 input[data-p="n"]', 'change'); await P.waitForTimeout(900);
  check('1 à 15: "nog 15 … niet verdeeld"', /nog 15 .*niet verdeeld/.test(await rest(P, 'RP0100')), await rest(P, 'RP0100'));
  await P.click('#v-RP0100 [data-act="padd"][data-soort="pallet"]'); await P.waitForTimeout(900);
  check('"+ pallets" stelt het opslagpallet voor met wat over is: 1 à 15 + 1 à 15 = verdeeld', /Alles verdeeld/.test(await rest(P, 'RP0100')), await rest(P, 'RP0100'));
  t = await kaart(P, 'RPNBR0300');
  check('RPNBR0300 20 rollen, opslagpallet 15: Wegzetten 1 pallet à 15 + 5 los', /Wegzetten: 1 pallet à 15 .*\+ 5 .*los/.test(t) && /Advies: .*1× 15/.test(t), t);
  t = await kaart(P, '01010300');
  check('01010300 300 m, opslagpallet 150: 2 pallets à 150 m', /Wegzetten: 2 pallets à 150/.test(t), t);
  for(const w of [390, 1440]){ await P.setViewportSize({ width:w, height:900 }); await P.waitForTimeout(400); check('Verdeling op ' + w + ' px zonder horizontale scroll', await P.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await P.evaluate(() => document.documentElement.scrollWidth)); }
  await T.b.close();
  // 2. opslagpallet 30 → 1 à 30 zoals nu
  T = await open('#/c/8/verdeling', { RP0100:30 }); P = T.p;
  t = await kaart(P, 'RP0100');
  check('Opslagpallet 30: 1 pallet à 30, advies 1× 30', /Wegzetten: 1 pallet à 30/.test(t) && /Advies: .*1× 30/.test(t), t);
  await T.b.close();
  // 3. container 13: krat en dozen, akkoorden onaangetast
  const KEY = 'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA';
  const v0 = (await (await fetch('https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1/containers?id=eq.13&select=data', { headers:{ apikey:KEY } })).json())[0].data.verdeling;
  const voor = onder.length;
  T = await open('#/c/13/verdeling', { 'E4005-10KG':50, 'NW-002-BLA':250 }); P = T.p;
  t = await kaart(P, 'E4005-10KG');
  check('Krat E4005-10KG blijft pallet(s) volgens pakbon, geen opslagpallet-omzetting', t && !/Wegzetten/.test(t), t);
  await P.click('#v-NW-002-BLA [data-act="vopen"]'); await P.waitForTimeout(600);
  t = await kaart(P, 'NW-002-BLA');
  check('Doosproduct NW-002-BLA (5 dozen à 100), opslagpallet 250: alleen hele dozen → 2 pallets à 200 + 1 doos', /Wegzetten: 2 pallets à 200/.test(t) && /1 doos/.test(t), t);
  const bev = Object.keys(v0).filter(k => v0[k].bevestigd);
  const akkOk = await P.evaluate(b => b.filter(c => { const k = document.getElementById('v-' + c); return k && /akkoord/.test(k.innerText); }).length, bev);
  check('Opgeslagen akkoorden blijven akkoord (' + bev.length + ')', akkOk === bev.length, akkOk);
  check('Container 13: niets opgeslagen door alleen kijken', onder.length === voor, onder.length - voor);
  await T.b.close();
  const blok = T0.reduce((a, x) => a + x.blocked.length, 0);
  console.log('ERRORS', T0.flatMap(x => x.errors).filter(e => !/Failed to load resource|jsPDF/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT', '| onderschept', onder.length, '| geblokkeerd', blok);
  process.exit(fout.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
function document_text(t){ return t; }
