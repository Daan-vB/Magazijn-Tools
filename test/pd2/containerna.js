// Containerplanning "Na het lossen": keuze per kaart (bij lossen bepalen · alles naar … · nu invullen), blok ingeklapt, en "per pallet" gaat vóór "Alles los naar".
// Echte database alleen lezen; alle schrijfacties onderschept.
// Daan 23-11: geen vaste container of vaste aantallen. De test kiest zelf de container met de meeste producten op "Na het lossen",
// kiest daarin zelf de producten (doosproduct, los product) en rekent elke verwachting uit de data van die container.
const { start, naarContainers, kiesContainer, CP_URL, nlGetal } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PDFNEP = `window.jspdf = { jsPDF:function(){ const t = window.__pdf = { tekst:[], paginas:1 }; const n = () => {}; return { setProperties:n, setFont:n, setFontSize:n, setTextColor:n, setDrawColor:n, setFillColor:n, rect:n, roundedRect:n, line:n, addImage:n, addPage(){ t.paginas++; }, text(x){ t.tekst.push([].concat(x).join(' ')); }, splitTextToSize(x){ return [String(x)]; }, output(){ return new ArrayBuffer(8); } }; } };`;
(async () => {
  const T = await start(); const P = T.p, onder = [];
  await P.route(/supabase\.co\/rest\/v1\/(containers|catalog)\?/, r => { const q = r.request(); if(q.method() === 'GET') return r.continue(); onder.push({ m:q.method(), u:q.url(), b:q.postData() || '' }); return r.fulfill({ status:200, contentType:'application/json', body:q.method() === 'PATCH' ? JSON.stringify([{ id:+((q.url().match(/id=eq\.(\d+)/) || [])[1] || 0), updated_at:new Date().toISOString() }]) : '[]' }); });
  await P.route(/jspdf/, r => r.fulfill({ status:200, contentType:'application/javascript', body:PDFNEP }));
  await naarContainers(P);
  const kies = await kiesContainer(P, (c, X) => X.invulCodes(c).filter(code => X.bijLossen(c, code)).length);
  let id = null, info = null;
  if(kies){
    id = kies.id;
    info = await P.evaluate(id => { const X = CP_TEST, c = X.cont().find(c => c.id === id), g = X.voortgang(c), pl = X.pools(c), codes = X.invulCodes(c);
      const stand = code => { const v = c.data.verdeling[code]; return v && v.bron === 'allesnaar' && v.porties && v.porties.length ? 'naar' : 'lossen'; };
      const kaart = codes.filter(code => X.bijLossen(c, code)).map(code => { const d = X.doosVan(c, code), pool = pl.map[code]; return { code, doos:d && d.n > 0 && d.per > 0 ? { n:d.n, per:d.per } : null, pallets:pool.pallets.length, losU:pool.losU, eenheid:X.eenheid(code) }; });
      return { naam:c.containernummer || c.pakbon_ref || String(c.id), codes, stand:codes.map(stand), lossen:g.lossen, kaart, verdeling:JSON.parse(JSON.stringify(c.data.verdeling)) }; }, id);
    const N = info.codes.length;
    // X = doosproduct zonder pallets (liefst), Y = los product zonder doos en zonder pallets, Z = een ander product voor "Nu invullen"
    const Xp = info.kaart.find(k => k.doos && !k.pallets) || info.kaart.find(k => !k.pallets) || info.kaart[0];
    const Yp = info.kaart.find(k => k !== Xp && !k.doos && !k.pallets && k.losU > 0) || info.kaart.find(k => k !== Xp) || null;
    console.log('container', id, info.naam, '·', N, 'op Na het lossen · X', Xp && Xp.code, '· Y', Yp && Yp.code);
    await P.evaluate(id => { location.hash = '#/c/' + id + '/verdeling'; }, id); await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(3000);
    const kop = await P.evaluate(() => (document.querySelector('#lossen h2') || {}).innerText || '');
    check('A2: blok heet "Na het lossen (' + N + ')" en staat ingeklapt', kop === 'Na het lossen (' + N + ')' && !(await P.evaluate(() => document.querySelectorAll('[data-ll-kaart]').length)), kop);
    await P.click('#lossen [data-act="lltoggle"]'); await P.waitForTimeout(400);
    const st = await P.evaluate(() => [...document.querySelectorAll('[data-ll-kaart]')].map(x => [x.dataset.llKaart, x.dataset.llStand]));
    const velden = await P.evaluate(() => document.querySelectorAll('#lossen [data-lk]').length);
    const zelfde = st.length === N && info.codes.every((c, i) => st.some(([k, s]) => k === c && s === info.stand[i]));
    check('A1: na openen ' + N + ' kaarten met de juiste stand (bij lossen bepalen of alles naar), 0 kaarten open (geen invulvelden)', zelfde && velden === 0, st.map(x => x.join(':')).join() + ' velden ' + velden);
    const rij = await P.evaluate(c => document.querySelector(`[data-ll-kaart="${c}"]`).innerText.replace(/\s+/g, ' '), Xp.code);
    check('A1: ingeklapte kaart = code · naam · pakbon · bij lossen bepalen (' + Xp.code + ')', rij.includes(Xp.code) && /pakbon /.test(rij) && (!Xp.doos || new RegExp('pakbon ' + esc(nlGetal(Xp.doos.n)) + ' dozen à ' + esc(nlGetal(Xp.doos.per))).test(rij)) && /bij lossen bepalen/.test(rij), rij);
    const som = () => P.evaluate(() => document.querySelector('.sumbar').innerText.replace(/\s+/g, ' '));
    let sum = await som();
    check('A: teller "akkoord · ' + info.lossen + ' bij lossen bepalen"', new RegExp('\\d+/\\d+ akkoord · ' + info.lossen + ' bij lossen bepalen', 'i').test(sum), sum);
    check('A: geen onderschepte schrijfactie door alleen kijken', onder.length === 0, onder.length);
    // Alles naar → Bulk (up) bij X
    await P.selectOption(`#lossen [data-llkeuze="${Xp.code}"]`, 'naar:UP'); await P.waitForTimeout(1500);
    const sx = await P.evaluate(c => document.querySelector(`[data-ll-kaart="${c}"]`).innerText.replace(/\s+/g, ' '), Xp.code);
    const tekstX = Xp.doos ? nlGetal(Xp.doos.n) + ' dozen → Bulk (up)' : nlGetal(Xp.losU) + ' ';
    check('A1: "Alles naar → Bulk (up)" bij ' + Xp.code + ' geeft "' + (Xp.doos ? tekstX : '… → Bulk (up)') + '" met Akkoord-knop', (Xp.doos ? sx.includes(tekstX) : /→ Bulk \(up\)/.test(sx)) && await P.evaluate(c => !!document.querySelector(`[data-ll-kaart="${c}"] [data-act="vakk"]:not([disabled])`), Xp.code), sx);
    sum = await som();
    check('A: teller daarna "· ' + (info.lossen - 1) + ' bij lossen bepalen"', info.lossen - 1 ? new RegExp('akkoord · ' + (info.lossen - 1) + ' bij lossen bepalen', 'i').test(sum) : !/bij lossen bepalen/i.test(sum), sum);
    const laatste = () => { const c = onder.filter(x => /containers/.test(x.u) && x.m === 'PATCH').map(x => JSON.parse(x.b)).pop(); return c && c.data && c.data.verdeling; };
    await P.waitForTimeout(1200);
    let ver = laatste();
    const verwachtX = (Xp.losU > 0 ? [{ soort:'los', n:Xp.losU, dest:'UP' }] : []);
    check('A1: opgeslagen (onderschept): ' + Xp.code + ' alles → UP, bron allesnaar, geen akkoord', ver && ver[Xp.code] && ver[Xp.code].bron === 'allesnaar' && !ver[Xp.code].bevestigd && (Xp.pallets || JSON.stringify(ver[Xp.code].porties) === JSON.stringify(verwachtX)), JSON.stringify(ver && ver[Xp.code]));
    if(Yp){
      // Y: Per = 1 → los naar pick
      await P.selectOption(`#lossen [data-llkeuze="${Yp.code}"]`, 'naar:PICK'); await P.waitForTimeout(1500);
      const sy = await P.evaluate(c => document.querySelector(`[data-ll-kaart="${c}"]`).innerText.replace(/\s+/g, ' '), Yp.code);
      check('A1: "Alles naar → Picklocatie" bij ' + Yp.code + ' geeft "' + nlGetal(Yp.losU) + ' … los → Picklocatie"', Yp.doos || Yp.pallets ? /→ Picklocatie/.test(sy) : new RegExp(esc(nlGetal(Yp.losU)) + ' \\S+ los → Picklocatie').test(sy), sy);
      await P.waitForTimeout(1200);
      // terugdraaien Y zonder akkoord
      await P.selectOption(`#lossen [data-llkeuze="${Yp.code}"]`, 'lossen'); await P.waitForTimeout(1800);
      ver = laatste();
      check('A1: terugdraaien zonder akkoord: ' + Yp.code + ' weer "bij lossen bepalen", oude verdeling terug', await P.evaluate(c => document.querySelector(`[data-ll-kaart="${c}"]`).dataset.llStand, Yp.code) === 'lossen' && JSON.stringify(ver[Yp.code]) === JSON.stringify(info.verdeling[Yp.code]), JSON.stringify(ver[Yp.code]));
    }
    // Uitvoer: X staat nog op de invullijst in de losdag-PDF (alle N producten)
    await P.evaluate(id => { location.hash = '#/c/' + id + '/uitvoer'; }, id); await P.waitForSelector('#wbprev', { timeout:60000 });
    check('A: Uitvoer opent', true);
    await P.evaluate(() => document.querySelector('[data-act="pdfall"]').click()); await P.waitForTimeout(4000);
    const pdf = await P.evaluate(() => (window.__pdf || { tekst:[] }).tekst);
    const i0 = pdf.findIndex(t => /^(Invullijst lossen|Unloading checklist)$/.test(t)), i1 = pdf.findIndex((t, i) => i > i0 && /^Stockmove/.test(t));
    const lijst = pdf.slice(i0, i1).filter(t => /^\S+ {3}/.test(t)).map(t => t.split(' ')[0]);
    check('A1: ' + Xp.code + ' staat nog op de invullijst in de losdag-PDF (' + N + ' producten)', lijst.includes(Xp.code) && lijst.length === N, lijst.join());
    // Nu invullen: blok open, velden zichtbaar, Opslaan-knop
    const Zp = Yp || Xp;
    await P.evaluate(id => { location.hash = '#/c/' + id + '/verdeling'; }, id); await P.waitForSelector('#lossen', { timeout:60000 }); await P.waitForTimeout(500);
    if(!(await P.evaluate(() => !!document.querySelector('[data-ll-kaart]')))) await P.click('#lossen [data-act="lltoggle"]');
    await P.selectOption(`#lossen [data-llkeuze="${Zp.code}"]`, 'nu'); await P.waitForTimeout(500);
    check('A1: "Nu invullen" opent de velden (blok open) bij ' + Zp.code, await P.evaluate(c => document.querySelectorAll(`[data-ll-kaart="${c}"] [data-lk]`).length >= 7 && !!document.querySelector(`[data-ll-kaart="${c}"] [data-act="llsave"]`), Zp.code));
    await P.click('#lossen [data-act="lltoggle"]'); await P.waitForTimeout(300);
    check('A2: blok klapt in op tikken', await P.evaluate(() => !document.querySelector('[data-ll-kaart]')));
    for(const w of [390, 1440]){ await P.setViewportSize({ width:w, height:900 }); await P.click('#lossen [data-act="lltoggle"]'); await P.waitForTimeout(400); check('Na het lossen open op ' + w + ' px zonder horizontale scroll', await P.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await P.click('#lossen [data-act="lltoggle"]'); await P.waitForTimeout(200); }
    const anders = (laatste() ? Object.keys(info.verdeling).filter(k => k !== Xp.code && JSON.stringify(laatste()[k]) !== JSON.stringify(info.verdeling[k])) : ['geen opslag']);
    check('Andere verdelingen en akkoorden ongewijzigd', anders.length === 0, anders.join());
  } else console.log('OVERGESLAGEN (A1/A2): geen container met producten op "bij lossen bepalen"');
  // A3: per pallet Q + "Alles los naar Picklocatie" (alleen in het geheugen): volle pallets à Q, alleen de rest naar pick.
  // De test kiest zelf een stuksproduct met stuks per pallet in het productgeheugen en zonder productdata (oude regel), en zet in het geheugen 2,5 pallet los op de pakbon.
  const kand = await P.evaluate(() => { const X = CP_TEST; let best = null;
    X.cont().forEach(c => X.pools(c).order.forEach(code => { if(best) return; const g = X.geheugen(code), q = g ? parseInt(String(g.qty || '').replace(/\D/g, ''), 10) : 0;
      const regels = (c.data.regels || []).filter(r => r.productcode === code); if(!(q >= 4 && q % 2 === 0 && /^\d+$/.test(String(g.qty).trim()) && regels.length === 1 && X.eenheid(code) === 'st.')) return;
      let a; try{ a = X.advies(c, code); }catch(e){ return; } if(a && /oude regel/.test(a.uitleg || '') && !/productdata/.test(a.uitleg || '')) best = { id:c.id, code, q }; }));
    return best; });
  if(kand){
    const totaal = 2 * kand.q + kand.q / 2, rest = kand.q / 2;
    console.log('A3 met', kand.code, '(container ' + kand.id + '), per pallet', kand.q, ', in het geheugen', totaal, 'los');
    const T2 = await start(); const Q = T2.p;
    await Q.route(/supabase\.co\/rest\/v1\/(containers|catalog)\?/, async r => {
      const q = r.request(), u = decodeURIComponent(q.url());
      if(q.method() !== 'GET'){ onder.push({ m:q.method(), u, b:'' }); return r.fulfill({ status:200, contentType:'application/json', body:'[]' }); }
      const res = await r.fetch(), rows = await res.json();
      if(/catalog/.test(u)) rows.forEach(x => { if(x.key === 'catalog-ean' && x.data) Object.values(x.data).forEach(g => { if(g && g.sub === kand.code) g.losdest = 'PICK'; }); });
      if(/containers/.test(u)) rows.forEach(c => { if(c.id === kand.id && c.data){ c.data.regels.forEach(x => { if(x.productcode === kand.code){ Object.assign(x, { soort:'los', per:1, aantal:totaal, totaal, factor:1 }); } }); delete c.data.verdeling[kand.code]; } });
      return r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(rows) });
    });
    await Q.route(/jspdf/, r => r.fulfill({ status:200, contentType:'application/javascript', body:PDFNEP }));
    await Q.goto(CP_URL('#/c/' + kand.id + '/verdeling')); await Q.waitForSelector('#tabbody', { timeout:90000 }); await Q.waitForTimeout(3000);
    const kaart = await Q.evaluate(c => { const k = document.getElementById('v-' + c); return k ? { adv:(k.querySelector('.adv') || {}).innerText || '', t:k.innerText } : null; }, kand.code);
    const adv = kaart ? kaart.adv.replace(/\s+/g, ' ') : '', all = kaart ? kaart.t.replace(/\s+/g, ' ') : '';
    // de 2 volle pallets mogen over Bulk en VST verdeeld zijn (dat hangt van de verkoop af); nooit een volle pallet naar pick en nooit alles los
    const palN = [...adv.matchAll(new RegExp('(\\d+)× ' + esc(nlGetal(kand.q)) + ' → ([^·(]+)', 'g'))].map(m => [+m[1], m[2].trim()]);
    check('A3: ' + kand.code + ' met per pallet ' + kand.q + ' en "Alles los naar Picklocatie": 2 volle pallets à ' + kand.q + ', alleen de rest (' + rest + ') naar pick', palN.reduce((a, x) => a + x[0], 0) === 2 && !palN.some(x => /Picklocatie/.test(x[1])) && new RegExp(esc(nlGetal(rest)) + ' los → Picklocatie').test(adv) && !new RegExp(esc(nlGetal(totaal)) + ' los').test(adv), adv);
    check('A3: Binnen = pakbon (' + totaal + ' los), Wegzetten: 2 pallets à ' + kand.q + ' + ' + rest + ' los', new RegExp('Binnen: ' + esc(nlGetal(totaal)) + ' los').test(all) && new RegExp('Wegzetten: 2 pallets à ' + esc(nlGetal(kand.q)) + ' \\+ ' + esc(nlGetal(rest)) + ' los').test(all), all.slice(0, 200));
    T.errors.push(...T2.errors); T.blocked.push(...T2.blocked);
    await T2.b.close();
  } else console.log('OVERGESLAGEN (A3): geen stuksproduct met stuks per pallet zonder productdata in de containers');
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|jsPDF/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT', '| onderschept', onder.length, '| geblokkeerd', T.blocked.length);
  await T.b.close();
  process.exit(fout.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
