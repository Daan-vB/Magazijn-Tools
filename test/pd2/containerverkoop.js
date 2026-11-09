// Containerplanning: verkoop = bestelde aantallen uit de Picqer-orders (ook backorders), niet alleen verzonden (Daan 09-11, CLAUDE.md §7).
// Situatie in het geheugen: het tussenstation is nagebootst (actie "bestellingen"); de echte database alleen lezen, schrijven onderschept.
// Container NL-300 (Wallace): KOKOS100BLK-24 en KOKOS100NAT-24 tonen "Verkoop: x/mnd (6 mnd) · y laatste 28 dgn" en nooit "geen verkoophistorie".
// Zonder koppelcode: terugval op de import (verzonden) met die uitleg. `VP=390` voor telefoonbreedte.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + String(x).slice(0, 400) : '')); };
// per dag besteld (situatie zoals Daan beschrijft: NAT-24 ruim 1.000 per maand, BLK-24 400–950 per maand)
const PER_DAG = { 'KOKOS100NAT-24':35, 'KOKOS100BLK-24':22 };
function bestellingen(sinds, tot){
  const rijen = [], d = new Date(sinds.slice(0, 10) + 'T12:00:00'), eind = (tot || '9999').slice(0, 10);
  for(; d.toISOString().slice(0, 10) <= eind; d.setDate(d.getDate() + 1)){
    const dag = d.toISOString().slice(0, 10);
    Object.entries(PER_DAG).forEach(([c, a]) => rijen.push([dag, c, a]));
  }
  return rijen;
}
async function mockPicqer(P, vragen){
  await P.route(/supabase\.co\/functions\/v1\/picqer/, r => {
    const u = new URL(r.request().url()), a = u.searchParams.get('actie'), cors = { 'access-control-allow-origin':'*', 'access-control-allow-headers':'*' };
    if(r.request().method() === 'OPTIONS') return r.fulfill({ status:204, headers:cors });
    vragen.push(a);
    const j = o => r.fulfill({ status:200, contentType:'application/json', headers:cors, body:JSON.stringify(o) });
    if(a === 'bestellingen'){
      if(r.request().method() !== 'GET') return r.fulfill({ status:405, headers:cors, body:'{}' });
      return j({ bron:'picqer-bestellingen', versie:1, rijen:bestellingen(u.searchParams.get('sinds'), u.searchParams.get('tot')), volgende:null });
    }
    return r.fulfill({ status:404, headers:cors, body:'{"fout":"test"}' });
  });
}
(async () => {
  const vp = +(process.env.VP || 1440);
  const T = await start({ vp:{ width:vp, height:900 } }); const P = T.p, vragen = [];
  await mockPicqer(P, vragen);
  const B = (process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html';
  // container NL-300 opzoeken (alleen lezen)
  await P.goto(B); await P.waitForTimeout(4000);
  const id = await P.evaluate(async () => { const r = await (await fetch('https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1/containers?select=id,pakbon_ref&pakbon_ref=eq.NL-300', { headers:{ apikey:'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA' } })).json(); return r && r[0] && r[0].id; });
  check('Container NL-300 gevonden', !!id, id);
  // 1. zonder koppelcode: terugval op de import, met uitleg; nooit "geen verkoophistorie" bij een product met bestellingen die we niet kennen
  await P.goto(B + '#/c/' + id + '/verdeling'); await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(5000);
  let t = await P.evaluate(() => document.body.innerText);
  check('Zonder koppelcode: "Verkoop niet live" en uitleg dat het advies met verzonden verkoop rekent', /Verkoop niet live: geen koppelcode/.test(t) && /alleen verzonden, import/.test(t));
  check('Zonder koppelcode: geen "geen verkoophistorie" (niet bewezen zonder bestellingen)', !/geen verkoophistorie/.test(t));
  // 2. met koppelcode: bestellingen live
  await P.evaluate(() => { localStorage.setItem('ivol-koppelcode', 'testcode'); localStorage.removeItem('cp-verkoop-live'); });
  await P.reload(); await P.waitForSelector('#tabbody', { timeout:90000 });
  await P.waitForFunction(() => /Verkoop live · bestellingen/.test(document.body.innerText), null, { timeout:60000 }).catch(() => {});
  await P.waitForTimeout(1500);
  t = await P.evaluate(() => document.body.innerText);
  check('Met koppelcode: "Verkoop live · bestellingen uit Picqer (ook backorders) · hh:mm"', /Verkoop live · bestellingen uit Picqer \(ook backorders\) · \d\d:\d\d/.test(t), vragen.join());
  const kaart = code => P.evaluate(c => { const e = document.getElementById('v-' + c); return e ? e.innerText.replace(/\s+/g, ' ') : ''; }, code);
  const getal = s => +String(s).replace(/\./g, '').replace(',', '.');
  const res = {};
  for(const code of ['KOKOS100BLK-24', 'KOKOS100NAT-24']){
    const k = await kaart(code); res[code] = k;
    const m = k.match(/Verkoop: ([\d.]+)\/mnd \(6 mnd\) · ([\d.]+) laatste 28 dgn/);
    console.log(code + ': ' + k.slice(0, 600));
    check(code + ': "Verkoop: x/mnd (6 mnd) · y laatste 28 dgn" met x > 0', m && getal(m[1]) > 0 && getal(m[2]) > 0, m ? m[0] : k.slice(0, 200));
    if(m) check(code + ': 6 mnd ≈ ' + PER_DAG[code] + '/dag × 183 ÷ 6, 28 dgn = ' + PER_DAG[code] * 28, Math.abs(getal(m[1]) - PER_DAG[code] * 183 / 6) <= PER_DAG[code] * 2 && getal(m[2]) === PER_DAG[code] * 28, m[0]);
    check(code + ': advies zegt niet "geen verkoophistorie"', k && !/geen verkoophistorie/.test(k), k.slice(0, 200));
    check(code + ': advies rekent met de bestellingen ("mnd × … /mnd bestellingen") of ligt al vast', /\/mnd bestellingen|akkoord/.test(k), (k.match(/\(([^)]*doel[^)]*)\)/) || [])[1]);
  }
  // alle 7 producten tonen de verkoopregel
  const alle = await P.evaluate(() => [...document.querySelectorAll('[id^="v-"]')].map(e => ({ c:e.id.slice(2), vk:/Verkoop: [\d.]+\/mnd \(6 mnd\) · [\d.]+ laatste 28 dgn/.test(e.innerText) })));
  console.log(JSON.stringify(alle));
  check('Elk product in de verdeling toont "Verkoop: x/mnd (6 mnd) · y laatste 28 dgn"', alle.length >= 7 && alle.every(x => x.vk), alle.filter(x => !x.vk).map(x => x.c).join(','));
  // product zonder bestellingen in 6 maanden: 0/mnd (dan pas "geen verkoophistorie")
  const nul = await kaart('KOKOS200NAT');
  check('Product zonder bestellingen in 6 mnd (in de nabootsing KOKOS200NAT): "Verkoop: 0/mnd", pas dan "geen verkoophistorie"', /Verkoop: 0\/mnd \(6 mnd\) · 0 laatste 28 dgn/.test(nul) && (/geen verkoophistorie \(6 mnd geen bestelling\)/.test(nul) || /akkoord/.test(nul)), nul.slice(0, 300));
  // alleen lezen: alleen GET naar het tussenstation, niets geschreven
  check('Tussenstation alleen met actie bestellingen/vandaag/idindex gelezen', vragen.includes('bestellingen') && vragen.every(a => !a || ['bestellingen', 'vandaag', 'idindex', 'status'].includes(a)), [...new Set(vragen)].join());
  const h = await P.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  check('Geen horizontaal scrollen op ' + vp + ' px', !h);
  if(process.env.UIT_MAP) await P.screenshot({ path:require('path').join(process.env.UIT_MAP, 'containerverkoop-' + vp + '.png'), fullPage:false });
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0 && T.writes.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|jsPDF/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
  if(fout.length) process.exit(1);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
