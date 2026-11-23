// Containerplanning advies: hele aantallen, losse goederen in hele dozen, geen advies zonder gecontroleerde data.
// Echte database alleen lezen; opslaan (PATCH) wordt onderschept en nooit verstuurd.
// Daan 23-11: geen vaste container of vaste producten. De test kiest zelf producten op "bij lossen bepalen" en een doosproduct met een los deel in het advies.
const { start, naarContainers, openKaart, CP_URL } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p, onderschept = [];
  await P.route(/supabase\.co\/rest\/v1\/containers\?/, r => { if(r.request().method() === 'GET') return r.fallback(); onderschept.push(r.request().method()); return r.fulfill({ status:200, contentType:'application/json', body:'[]' }); });
  await naarContainers(P);
  const keus = await P.evaluate(() => { const X = CP_TEST; let lossen = null, doos = null;
    X.cont().slice().sort((a, b) => b.id - a.id).forEach(c => {
      const l = X.pools(c).order.filter(code => X.bijLossen(c, code)); if(l.length && (!lossen || l.length > lossen.codes.length)) lossen = { id:c.id, codes:l.slice(0, 2) };
      if(!doos) X.pools(c).order.forEach(code => { if(doos) return; const d = X.doosVan(c, code); if(!(d && d.per > 1)) return; let a; try{ a = X.advies(c, code); }catch(e){ return; }
        const por = (a && a.porties) || []; if(por.some(x => x.soort !== 'pallet') && por.filter(x => x.soort !== 'pallet').every(x => x.n % d.per === 0)) doos = { id:c.id, code, per:d.per, verwacht:por.map(x => x.soort === 'pallet' ? x.n : x.n / d.per) }; }); });
    return { lossen, doos }; });
  console.log('gekozen', JSON.stringify(keus));
  const tekst = c => P.evaluate(c => { const k = document.getElementById('v-' + c); return k ? k.innerText : ''; }, c);   // de verdeelkaart (niet het invulblok)
  if(keus.lossen){
    await P.goto(CP_URL('#/c/' + keus.lossen.id + '/verdeling')); await P.waitForSelector('#tabbody', { timeout:60000 }); await P.waitForTimeout(3000);
    for(const c of keus.lossen.codes){ await openKaart(P, c); const t = await tekst(c); check(c + ' (container ' + keus.lossen.id + ', bij lossen bepalen): advies "nog te bepalen — verdeel zelf"', /nog te bepalen, verdeel zelf/.test(t), t.replace(/\n+/g, ' | ').slice(0, 140)); }
  } else console.log('OVERGESLAGEN: geen product op "bij lossen bepalen"');
  if(keus.doos){
    // doosproduct dat deels los gaat: advies overnemen geeft hele dozen
    const D = keus.doos;
    await P.goto(CP_URL('#/c/' + D.id + '/verdeling')); await P.waitForSelector('#tabbody', { timeout:60000 }); await P.waitForTimeout(3000);
    await openKaart(P, D.code);   // al akkoord: details openen (advies overnemen raakt een akkoord niet)
    await P.evaluate(c => document.querySelectorAll('[data-act="advneem"]').forEach(b => { if(b.dataset.code === c) b.click(); }), D.code);
    await P.waitForTimeout(600);
    const n = await P.evaluate(c => { const k = document.getElementById('v-' + c); return k ? { n:[...k.querySelectorAll('input[data-p="n"]')].map(i => i.value), rest:((k.querySelector('.rest') || {}).innerText || '').replace(/\s+/g, ' ') } : { n:[], rest:'' }; }, D.code);
    // hele dozen en hele pallets, en samen precies de pakbon (de kaart kan porties met dezelfde bestemming samenvoegen)
    check(D.code + ' (Per ' + D.per + ', container ' + D.id + '): advies neemt hele dozen over en verdeelt alles', n.n.length > 0 && n.n.every(v => /^\d+$/.test(String(v).trim())) && /Alles verdeeld/.test(n.rest), n.n.join() + ' · ' + n.rest);
  } else console.log('OVERGESLAGEN: geen doosproduct met een los deel in het advies');
  // geen decimalen in welke verdeling dan ook: alle advies overnemen in alle open containers
  const ids = await P.evaluate(async () => (await (await fetch('https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1/containers?select=id&status=neq.afgerond', { headers:{ apikey:'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA' } })).json()).map(x => x.id));
  let dec = [], totaal = 0;
  for(const id of ids){
    await P.goto(CP_URL('#/c/' + id + '/verdeling')); await P.waitForTimeout(4000);
    await P.evaluate(() => document.querySelectorAll('[data-act="advneem"]').forEach(b => b.click())); await P.waitForTimeout(500);
    const w = await P.evaluate(() => [...document.querySelectorAll('input[data-p="n"]')].map(i => i.value));
    totaal += w.length; w.forEach(v => { if(!/^\d+$/.test(String(v).trim())) dec.push(id + ':' + v); });
  }
  check('Na "Advies overnemen" overal alleen hele aantallen (' + ids.length + ' containers, ' + totaal + ' porties)', dec.length === 0 && totaal > 0, dec.slice(0, 5).join(' '));
  check('Geen schrijfpoging bereikte de database (onderschept: ' + onderschept.length + ')', T.blocked.length === 0 && T.writes.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).join('\n')); console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
  process.exit(fout.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
