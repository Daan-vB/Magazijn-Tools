// Containerplanning: losse pakken met Per > 1 worden als dozen getoond en geteld (Per 1 blijft los/pallets). Echte database alleen lezen; opslaan onderschept.
// Daan 23-11: geen vaste container, geen vaste producten of aantallen. De test kiest zelf een container met een doosproduct (vaste inhoud),
// liefst ook een doosproduct met wisselende inhoud en een Per-1-product met pallets en los, en rekent de teksten uit de pakbonregels.
const { start, naarContainers, kiesContainer, openKaart, nlGetal } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
(async () => {
  const T = await start(); const P = T.p, onderschept = [];
  await P.route(/supabase\.co\/rest\/v1\/containers\?/, r => { if(r.request().method() === 'GET') return r.continue(); onderschept.push(1); return r.fulfill({ status:200, contentType:'application/json', body:'[]' }); });
  await naarContainers(P);
  const kies = await kiesContainer(P, (c, X) => { const pl = X.pools(c), st = code => X.eenheid(code) === 'st.'; let vast = null, wissel = null, per1 = null;
    pl.order.forEach(code => { const d = X.doosVan(c, code), rg = (c.data.regels || []).filter(r => r.productcode === code);
      if(d && st(code) && d.per && !vast) vast = { code, n:d.n, per:d.per };
      if(d && st(code) && !d.per && !wissel) wissel = { code, n:d.n, gem:Math.round(d.gem) };
      // Per 1 (geen dozen): na het omrekenen naar opslagpallets blijven pallets en een losse rest over
      const pool = pl.map[code];
      if(!d && st(code) && rg.length && rg.every(r => (+r.per || 1) === 1 && (+r.factor || 1) === 1) && pool.pallets.length >= 2 && pool.losU > 0 && !per1) per1 = { code, per:pool.pallets[0], los:pool.losU }; });
    return vast ? { score:1 + (wissel ? 1 : 0) + (per1 ? 1 : 0), vast, wissel, per1 } : 0; });
  if(!kies){ console.log('OVERGESLAGEN: geen container met een doosproduct'); console.log('0 OK, 0 FOUT'); await T.b.close(); return; }
  const { vast, wissel, per1 } = kies.info, id = kies.id;
  console.log('container', id, '· vast', JSON.stringify(vast), '· wissel', JSON.stringify(wissel), '· per1', JSON.stringify(per1));
  await P.evaluate(id => { location.hash = '#/c/' + id + '/verdeling'; }, id); await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(3000);
  const kaart = async code => { await openKaart(P, code); return P.evaluate(c => { const k = document.getElementById('v-' + c); return k ? k.innerText.replace(/\s+/g, ' ') : ''; }, code); };
  let t = await kaart(vast.code);
  const vastTekst = nlGetal(vast.n) + ' dozen à ' + nlGetal(vast.per);
  check(vast.code + ': "Binnen: ' + vastTekst + '"', t.includes('Binnen: ' + vastTekst), t.slice(0, 260));
  if(wissel){ t = await kaart(wissel.code); const w = nlGetal(wissel.n) + ' dozen, inhoud wisselt (± ' + nlGetal(wissel.gem) + ')'; check(wissel.code + ': "' + w + '"', t.includes(w), t.slice(0, 260)); }
  else console.log('   (geen doosproduct met wisselende inhoud in deze container)');
  if(per1){ t = await kaart(per1.code); check(per1.code + ' (Per 1): blijft los en pallets, geen dozen', new RegExp('pallets à ' + esc(nlGetal(per1.per))).test(t) && new RegExp('(^|[^\\d.])' + esc(nlGetal(per1.los)) + ' los').test(t) && !/dozen/.test(t.slice(0, 400)), t.slice(0, 300)); }
  else console.log('   (geen Per-1-product met pallets en los in deze container)');
  // pakbon-tab
  await P.evaluate(id => { location.hash = '#/c/' + id + '/pakbon'; }, id); await P.waitForTimeout(3500);
  await P.evaluate(() => { const d = document.getElementById('voordaan'); if(d) d.open = true; const t = document.querySelector('details[data-det="pbtabel"]'); if(t) t.open = true; });   // ingeklapte delen eerst openen
  t = await P.evaluate(() => document.body.innerText);
  check('Pakbon-tab: "' + vastTekst + '" bij ' + vast.code, t.includes(vastTekst));
  // werkbon (Uitvoer)
  await P.evaluate(id => { location.hash = '#/c/' + id + '/uitvoer'; }, id); await P.waitForSelector('#wbprev', { timeout:60000 });
  t = await P.evaluate(() => document.getElementById('wbprev').innerText);
  const blok = code => { const i = t.indexOf(code); return i < 0 ? '' : t.slice(i, i + 220); };
  check('Werkbon telt in boxes/dozen voor de doosproducten' + (per1 ? ', niet voor ' + per1.code : ''), /\d+ (box|boxes|doos|dozen)/.test(blok(vast.code)) && (!wissel || /\d+ (box|boxes|doos|dozen)/.test(blok(wissel.code))) && (!per1 || !/box|doos|dozen/.test(blok(per1.code).slice(0, 120))), blok(vast.code).replace(/\s+/g, ' ').slice(0, 120));
  check('Niets stil gewijzigd: geen schrijfpogingen (onderschept ' + onderschept.length + ')', T.blocked.length === 0 && onderschept.length === 0);
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|jsPDF/.test(e)).join('\n')); console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
  process.exit(fout.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
