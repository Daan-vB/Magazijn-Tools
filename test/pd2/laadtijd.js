// laadtijd #/pd2: koud (lege cache) en warm (tweede keer, zelfde profiel)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const dir = './profiel-' + Date.now(); const uit = [];
  const ctx = await chromium.launchPersistentContext(dir, { ...(process.env.HTTPS_PROXY ? { proxy:{ server:process.env.HTTPS_PROXY, bypass:'localhost,127.0.0.1' } } : {}), viewport:{ width:1440, height:900 } });
  const p = ctx.pages()[0] || await ctx.newPage();
  await p.route(/supabase\.co\/(rest|functions)\//, r => { const m = r.request().method(); if(/\/functions\//.test(r.request().url())) return r.fulfill({ status:503, body:'{}' }); if(m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') return r.fulfill({ status:201, body:'' }); return r.continue(); });
  for(const keer of ['koud', 'warm', 'warm2']){
    const t0 = Date.now();
    if(keer === 'koud') await p.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'ivol.html#/pd2'); else await p.reload();
    await p.waitForFunction(() => document.querySelector('#pd2-lijst tbody tr'), null, { timeout:120000 });
    const t1 = Date.now() - t0;
    const info = await p.evaluate(() => ({ bron:(document.querySelector('.pd2-oefenbalk') || {}).textContent?.replace(/\s+/g, ' ').slice(0, 160) }));
    uit.push([keer, t1, info.bron]); console.log(keer, t1 + ' ms', info.bron);
    await p.waitForTimeout(25000);   // achtergrond verversen laten afmaken
  }
  await ctx.close(); fs.rmSync(dir, { recursive:true, force:true });
})();
