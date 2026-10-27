const { start, open } = require('./opzet.js');
const res = [];
(async () => {
  for(const [naam, vp, mob] of [['desktop', { width:1440, height:900 }, false], ['iphone', { width:390, height:844 }, true]]){
    const T = await start({ vp, mobiel:mob }); const P = T.p;
    await open(T);
    // wat oefendata zodat Rollen, Afgerond en Weeglijst iets tonen
    await P.evaluate(() => {
      const ks = Object.keys(WH.D.P).filter(c => /^kokos\s+\d+/i.test(WH.D.P[c].naam || '')).slice(0, 3);
      ks.forEach(c => PD2R.poZet(c, p => { p.rol = { v:true }; p.f.rb = { v:'100', st:'bevestigd', voor:'100' }; p.f.rl = { v:'25', st:'aangepast', voor:'' }; p.f.rkg = { v:'60', st:'aangepast', voor:'' }; }));
      const pk = WHPD2.tabCodes('pick').slice(0, 4);
      pk.forEach((c, i) => { WHPD2.UI.sel = new Set([c]); });
      pk.slice(0, 2).forEach(c => PD2R.poZet(c, p => { p.so = { v:'pick', st:'bevestigd', voor:'pick' }; p.f.pickc = { v:'klopt', st:'bevestigd', voor:'klopt' }; p.f.maxpick = { v:'20', st:'aangepast', voor:'' }; p.gew = { st:i => 'vertrouwd' }; p.gew = { st:'vertrouwd' }; }));
      pk.slice(2, 4).forEach(c => PD2R.poZet(c, p => { p.gew = { st:'tewegen' }; }));
      WHPD2.UI.sel = new Set();
    });
    const tabs = [['pallet', 'whiteboard zonder rand'], ['deel', 'schoonloopmat mars'], ['pick', '26x65'], ['mix', ''], ['weg', 'waterhog'], ['rollen', 'kokos'], ['afgerond', ''], ['weeglijst', '']];
    for(const [tab, zoek] of tabs){
      await P.evaluate(([t, z]) => { const U = WHPD2.UI; U.zoek = z; U.fk = null; U.mk = null; U.aandacht = null; U.map = null; U.tab = t; WHPD2.teken();
        if(z){ const f = WHPD2.families()[0]; if(f) U.fk = f.fk; WHPD2.teken(); } }, [tab, zoek]);
      await P.waitForTimeout(200);
      // eerst bovenkant, dan de lijst
      await P.evaluate(() => { document.getElementById('native').scrollTop = 0; });
      await P.screenshot({ path:(process.env.UIT_MAP || '.') + `/sh-${naam}-${tab}-1.png` });
      await P.evaluate(() => { const l = document.getElementById('pd2-lijst'); l.scrollIntoView(); document.getElementById('native').scrollTop -= 10; });
      await P.screenshot({ path:(process.env.UIT_MAP || '.') + `/sh-${naam}-${tab}-2.png` });
      const m = await P.evaluate(() => {
        const nat = document.getElementById('native'), w = document.querySelector('#pd2-lijst .pd2-tw');
        const uit = { over:nat.scrollWidth - nat.clientWidth, body:document.documentElement.scrollWidth - innerWidth, rijen:document.querySelectorAll('#pd2-lijst tbody tr[data-c]').length };
        if(w){ const k = w.querySelector('tbody .k0'); const voor = k ? k.getBoundingClientRect().left : null; w.scrollLeft = 400; const na = k ? k.getBoundingClientRect().left : null; uit.sticky = voor !== null && Math.abs(voor - na) < 1; uit.scrollbaar = w.scrollWidth > w.clientWidth; uit.k0 = getComputedStyle(k || w).position; w.scrollLeft = 0; }
        // knoppen en tegels niet buiten beeld
        uit.buiten = [...document.querySelectorAll('.pd2 button, .pd2 select, .pd2 input')].filter(e => { if(e.closest('.pd2-tw') || e.closest('.pd2-tabs')) return false; const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).length;
        return uit;
      });
      res.push([naam, tab, m]);
      console.log(naam, tab, JSON.stringify(m));
    }
    console.log('errors', T.errors.join('\n'), 'blocked', T.blocked.length);
    await T.b.close();
  }
  require('fs').writeFileSync((process.env.UIT_MAP || '.') + '/schermen.json', JSON.stringify(res, null, 1));
})();
