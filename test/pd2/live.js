// live voorraad: Picqer-functie nagebootst (alleen 'producten'), daarna een 429 om terugval en pauze te zien
const { chromium } = require('playwright');
// Picqer nagebootst: node test/pd2/live.js ok | 429 (repo op poort 8811, PD2_URL om te wijzigen)
const modus = process.argv[2] || 'ok';
(async () => {
  const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy:{ server:process.env.HTTPS_PROXY, bypass:'localhost,127.0.0.1' } } : {});
  const ctx = await b.newContext({ viewport:{ width:1440, height:900 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try{ localStorage.setItem('ivol-koppelcode', 'test'); localStorage.removeItem('pd2-live'); }catch(e){} });
  const calls = [], blocked = [], errors = [];
  await p.route(/supabase\.co\/(rest|functions)\//, async r => {
    const q = r.request(), u = decodeURIComponent(q.url()), m = q.method();
    if(/\/functions\//.test(u)){
      const a = (u.match(/actie=([a-z]+)/) || [])[1];
      if(a === 'producten'){
        const ids = (u.match(/ids=([\d,]+)/) || [])[1].split(',');
        calls.push({ t:Date.now(), n:ids.length });
        if(modus === '429') return r.fulfill({ status:429, contentType:'application/json', body:JSON.stringify({ fout:'Picqer: te veel verzoeken (429)' }) });
        return r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ opgehaald:new Date().toISOString(), magazijn:3857, vst:3991, producten:ids.map(id => ({ id:+id, loc:[{ n:'ZZ01A00', w:3857, b:false, v:7 }, { n:'ZZ02A20', w:3857, b:true, v:33 }], vw:[[3857, 40], [3991, 0]] })) }) });
      }
      return r.fulfill({ status:503, contentType:'application/json', body:'{"fout":"test"}' });
    }
    if(m === 'GET' && /wh-pd2-/.test(u)) return r.fulfill({ status:200, contentType:'application/json', body:'[]' });
    if(m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS'){ blocked.push(m + ' ' + u.slice(0, 100)); return r.fulfill({ status:201, body:'' }); }
    return r.continue();
  });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if(m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
  await p.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'ivol.html#/pd2');
  await p.waitForFunction(() => window.PD2R && PD2R.S.klaar && document.querySelector('.pd2[data-scherm="start"]'), null, { timeout:60000 }).catch(async e => { console.log('VAST', await p.evaluate(() => JSON.stringify({ klaar:window.PD2R && PD2R.S.klaar, fout:window.PD2R && String(PD2R.S.fout), ivol:!!window.IVOL, hash:location.hash, html:(document.getElementById('native')||{}).innerHTML?.slice(0,300) }))); throw e; });
  await p.evaluate(() => WHPD2.openFam('Hamat|schoonloopmat mars', '120x180'));
  await p.waitForTimeout(modus === '429' ? 4000 : 9000);
  const r = await p.evaluate(() => ({ regel:document.getElementById('pd2-live').textContent.replace(/\s+/g, ' '), rood:!!document.querySelector('#pd2-live .rood'), voorraad:[...document.querySelectorAll('article.pd2-kaart .pd2-feiten > div:first-child')].map(x => x.textContent.replace(/\s+/g, ' ')), st:PD2R.liveStatus() }));
  console.log(modus, JSON.stringify(r, null, 1));
  console.log('calls', calls.length, 'ids per call', calls.map(c => c.n).join(','), 'tussenpozen ms', calls.slice(1).map((c, i) => c.t - calls[i].t).join(','));
  console.log('blocked', blocked, 'errors', errors);
  await b.close();
})();
