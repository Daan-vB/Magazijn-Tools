// Regressie: elke oude pagina op main (poort 8812) en op deze tak (8811) laden en de zichtbare tekst + DOM-structuur vergelijken.
const { chromium } = require('playwright');
const crypto = require('crypto');
const ALLE = [
  ['Warehouse · Vandaag', 'warehouse.html#/'], ['Warehouse · Aanvullen', 'warehouse.html#/aanvullen'], ['Warehouse · Productdata', 'warehouse.html#/productdata'],
  ['Test · A/B-check', 'test.html#/abcheck'], ['Test · Niveaus', 'test.html#/base'], ['Test · Invullen', 'test.html#/invul'],
  ['Test · Productdata', 'test.html#/productdata'], ['Test · Per familie', 'test.html#/productdata/familie'], ['Test · Gelijkzetten', 'test.html#/productdata/gelijk'], ['Test · Soorten', 'test.html#/productdata/soort'],
  ['Productkaart', 'productkaart.html'], ['Producten per leverancier', 'containerplanning.html?test#/producten'], ['Vloernamen', 'containerplanning.html?test#/vloernamen'],
  ['Containers', 'containerplanning.html#/'], ['Junior', 'junior.html#/'], ['Palletlabels', 'index.html'], ['Container-labels', 'container-labels.html'],
  ['3.0 · Te doen', 'ivol.html#/todo'], ['3.0 · Productdata (iframe)', 'ivol.html#/productdata'], ['3.0 · Per familie (iframe)', 'ivol.html#/pdfamilie'], ['3.0 · A/B-check (iframe)', 'ivol.html#/abcheck'], ['3.0 · Kennisbank', 'ivol.html#/kennisbank'], ['3.0 · Fundament', 'ivol.html#/fundament']
];
const WACHT = +(process.env.WACHT || 9000);
const PAGINAS = process.env.ALLEEN ? ALLE.filter(x => new RegExp(process.env.ALLEEN).test(x[1])) : ALLE;
const norm = t => String(t || '').replace(/\d/g, '#').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
async function snap(b, base, pad){
  const ctx = await b.newContext({ viewport:{ width:1280, height:900 } });
  const p = await ctx.newPage(); const blocked = [];
  await p.route(/supabase\.co\/(rest|functions)\//, r => { const m = r.request().method(); if(/\/functions\//.test(r.request().url())) return r.fulfill({ status:503, body:'{}' }); if(m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS'){ blocked.push(m); return r.fulfill({ status:201, body:'' }); } return r.continue(); });
  await p.goto(base + pad, { waitUntil:'load' }).catch(() => {});
  await p.waitForTimeout(WACHT);
  const r = await p.evaluate(() => {
    const doc = d => { const skel = [...d.querySelectorAll('body *')].filter(e => !['SCRIPT', 'STYLE'].includes(e.tagName)).map(e => e.tagName + '#' + e.id + '.' + (typeof e.className === 'string' ? e.className : '')).join('|'); return { tekst:d.body ? d.body.innerText : '', skel }; };
    const menu = [...document.querySelectorAll('#menulijst a')].map(a => a.textContent.trim());
    const ml = document.getElementById('menulijst'); if(ml) ml.remove();
    const kr = document.getElementById('kruimel'); if(kr) kr.textContent = '';
    const o = doc(document); o.menu = menu; let fr = null;
    try{ const f = document.getElementById('frame'); if(f && !f.hidden && f.contentDocument) fr = doc(f.contentDocument); }catch(e){}
    return { o, fr };
  }).catch(e => ({ o:{ tekst:'FOUT ' + e.message, skel:'' } }));
  await ctx.close();
  return { tekst:norm(r.o.tekst) + (r.fr ? '\n[iframe]\n' + norm(r.fr.tekst) : ''), skel:r.o.skel + (r.fr ? '[iframe]' + r.fr.skel : ''), blocked, menu:r.o.menu || [] };
}
const h = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
(async () => {
  const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy:{ server:process.env.HTTPS_PROXY, bypass:'localhost,127.0.0.1' } } : {});
  const uit = [];
  for(const [naam, pad] of PAGINAS){
    const [a, z] = await Promise.all([snap(b, (process.env.MAIN_URL || 'http://localhost:8812/'), pad), snap(b, (process.env.PD2_URL || 'http://localhost:8811/'), pad)]);
    let gelijk = a.tekst === z.tekst && a.skel === z.skel, verschil = '';
    if(!gelijk){
      const la = a.tekst.split('\n'), lz = z.tekst.split('\n');
      const alleenZ = lz.filter(x => !la.includes(x)), alleenA = la.filter(x => !lz.includes(x));
      verschil = 'alleen main: ' + JSON.stringify(alleenA.slice(0, 4)) + ' · alleen tak: ' + JSON.stringify(alleenZ.slice(0, 4)) + ' · skelet ' + (a.skel === z.skel ? 'gelijk' : 'anders');
    }
    const extra = z.menu.filter(x => !a.menu.includes(x)), weg = a.menu.filter(x => !z.menu.includes(x));
    if(a.menu.length || z.menu.length) verschil += ' · menu: ' + a.menu.length + ' → ' + z.menu.length + ' regels, erbij ' + JSON.stringify(extra) + ', weg ' + JSON.stringify(weg);
    uit.push({ naam, pad, gelijk, menuErbij:extra, menuWeg:weg, tekst:h(a.tekst) + '/' + h(z.tekst), lengte:a.tekst.length, verschil });
    console.log((gelijk ? 'GELIJK  ' : 'ANDERS  ') + naam.padEnd(30) + ' ' + a.tekst.length + ' tekens ' + verschil);
  }
  require('fs').writeFileSync((process.env.UIT_MAP || '.') + '/' + (process.env.UIT || 'regressie.json'), JSON.stringify(uit, null, 1));
  await b.close();
})();
