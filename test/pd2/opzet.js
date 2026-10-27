// gedeelde testopzet: echte database (alleen lezen), schrijven naar wh-pd2-* gaat naar een kopie in het geheugen, al het andere schrijven wordt geblokkeerd en geteld
const { chromium } = require('playwright');
async function start(opt = {}){
  const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy:{ server:process.env.HTTPS_PROXY, bypass:'localhost,127.0.0.1' } } : {});
  const ctx = await b.newContext({ viewport:opt.vp || { width:1440, height:900 }, deviceScaleFactor:1, isMobile:!!opt.mobiel, hasTouch:!!opt.mobiel });
  const p = await ctx.newPage();
  const mock = opt.mock || {}, writes = [], blocked = [], errors = [];
  await p.route(/supabase\.co\/(rest|functions)\//, async r => {
    const q = r.request(), m = q.method(), u = decodeURIComponent(q.url());
    if(/\/functions\//.test(u)){ blocked.push('FUNC ' + u.slice(0, 120)); return r.fulfill({ status:503, body:'{"fout":"test: geen Picqer"}' }); }
    if(m === 'GET' && /catalog\?key=/.test(u) && /wh-pd2-/.test(u)){
      const rows = Object.entries(mock).filter(([k]) => u.includes(k)).map(([key, data]) => ({ key, data, updated_at:new Date().toISOString() }));
      return r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(rows) });
    }
    if(m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return r.continue();
    const body = q.postData() || '';
    let rows = null; try{ rows = JSON.parse(body); }catch(e){}
    if(/rest\/v1\/catalog/.test(u) && Array.isArray(rows) && rows.length && rows.every(x => /^wh-pd2-(oefen|feedback)$/.test(x.key))){ rows.forEach(x => { mock[x.key] = x.data; writes.push(x.key); }); return r.fulfill({ status:201, body:'' }); }
    blocked.push(m + ' ' + u.slice(0, 160) + ' ' + body.slice(0, 80));
    return r.fulfill({ status:201, body:'' });
  });
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  p.on('console', m => { if(m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 300)); });
  return { b, ctx, p, mock, writes, blocked, errors };
}
async function open(T, hash){
  await T.p.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'ivol.html' + (hash || '#/pd2'));
  await T.p.waitForFunction(() => window.PD2R && PD2R.S.klaar && document.querySelector('.pd2[data-scherm]:not([data-scherm="laden"])'), null, { timeout:120000 });
}
module.exports = { start, open };
