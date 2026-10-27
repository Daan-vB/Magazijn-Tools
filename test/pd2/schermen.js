// Schermafdrukken op 390 en 1440 px van: start, familie Whiteboard Magnetisch, maat 30x45, Schoonloopmat Mars maat 40x60, een rol, Weg.
// Per scherm: geen horizontale scroll, geen gestippelde/gestreepte randen, geen oranje vlakken; op het startscherm ≤ 7 blokken boven de vouw.
const { start, open } = require('./opzet.js');
const UIT = process.env.UIT_MAP || '.';
const res = [], fout = [];
(async () => {
  for(const [naam, vp, mob] of [['1440', { width:1440, height:900 }, false], ['390', { width:390, height:844 }, true]]){
    const T = await start({ vp, mobiel:mob }); const P = T.p;
    await open(T);
    const meet = () => P.evaluate(() => {
      const nat = document.getElementById('native'), W = innerWidth;
      const els = [...document.querySelectorAll('.pd2, .pd2 *, #pd2-actie *, #pd2-oefw *')];
      const oranje = el => { const m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g); if(!m) return false; const [r, g, b, a = 1] = m.map(Number); if(a < .2) return false; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255)); let h = 0; if(mx !== mn){ if(mx === r) h = ((g - b) / (mx - mn)) % 6; else if(mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4; h *= 60; if(h < 0) h += 360; } return h >= 15 && h <= 50 && s > .45 && l > .35 && l < .92; };
      const zicht = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const pagina = document.querySelector('.pd2');
      const boven = pagina ? [...pagina.children].filter(e => zicht(e) && e.getBoundingClientRect().top < innerHeight).length : -1;
      const knoppenBoven = pagina ? [...pagina.querySelectorAll('button, input, select, a')].filter(e => zicht(e) && e.getBoundingClientRect().top < innerHeight && !e.closest('.pd2-famlijst')).length : -1;
      return {
        scherm:pagina && pagina.dataset.scherm,
        hscroll:Math.max(document.documentElement.scrollWidth - W, nat ? nat.scrollWidth - nat.clientWidth : 0),
        buiten:els.filter(e => { if(!zicht(e)) return false; const r = e.getBoundingClientRect(); return r.right > W + 1 || r.left < -1; }).length,
        stippel:els.filter(e => zicht(e) && /dashed|dotted/.test(getComputedStyle(e).borderTopStyle + getComputedStyle(e).borderLeftStyle + getComputedStyle(e).borderBottomStyle + getComputedStyle(e).textDecorationStyle)).length,
        oranje:els.filter(e => zicht(e) && oranje(e)).length,
        tabellen:document.querySelectorAll('.pd2 table').length,
        chips:document.querySelectorAll('.pd2 .pd2-aan, .pd2 .pd2-tag, .pd2 .pd2-chip').length,
        boven, knoppenBoven
      };
    });
    const schiet = async (id, voorbereid, scrollNaar) => {
      await P.evaluate(voorbereid); await P.waitForTimeout(400);
      await P.evaluate(s => { const nat = document.getElementById('native'); nat.scrollTop = 0; if(s){ const e = document.querySelector(s); if(e){ e.scrollIntoView(); nat.scrollTop -= 8; } } }, scrollNaar || null);
      await P.waitForTimeout(150);
      await P.screenshot({ path:`${UIT}/rust-${id}-${naam}.png` });
      const m = await meet(); res.push([naam, id, m]);
      const goed = m.hscroll <= 0 && m.buiten === 0 && m.stippel === 0 && m.oranje === 0 && m.tabellen === 0 && m.chips === 0 && (id !== 'start' || m.boven <= 7);
      if(!goed) fout.push(naam + ' ' + id);
      console.log((goed ? 'OK   ' : 'FOUT ') + naam.padEnd(5) + id.padEnd(10) + JSON.stringify(m));
    };
    await schiet('start', () => { WHPD2.UI.fk = null; WHPD2.UI.view = null; WHPD2.teken(); });
    const wm = 'SMIT Visual B.V.|whiteboard magnetisch';
    await P.evaluate(fk => WHPD2.openFam(fk), wm);
    await schiet('familie', () => {});
    await P.evaluate(() => { WHPD2.UI.mk = '30x45'; WHPD2.verversAlles(); });
    await schiet('maat30x45', () => {}, '#pd2-maat');
    await P.evaluate(() => WHPD2.openFam('Hamat|schoonloopmat mars', '40x60'));
    await schiet('mars40x60', () => {}, '#pd2-maat');
    // een rol: Kokos, één kaart als rol bevestigd (oefendata, alleen in de testkopie)
    await P.evaluate(() => { const c = Object.keys(WH.D.P).find(c => /^kokos\b/i.test(WH.D.P[c].naam || '') && PD2R.rolKand(c) && PD2R.actief(c)); PD2R.poZet(c, p => { p.rol = { v:true }; }); WHPD2.openFam(PD2R.famVan(c), PD2R.maatVan(c)); window.__rol = c; });
    await schiet('rol', () => {}, 'details.pd2-rol');
    await P.evaluate(() => { const c = Object.keys(WH.D.P).find(c => /waterhog/i.test(WH.D.P[c].naam || '') && PD2R.actief(c) && WHPD2.segVan(c) === 'weg'); WHPD2.openFam(PD2R.famVan(c), PD2R.maatVan(c)); WHPD2.UI.seg = 'weg'; WHPD2.verversAlles(); });
    await schiet('weg', () => {}, '#pd2-maat');
    // groepsbalk en oefenkaartje passen ook
    await P.evaluate(() => { WHPD2.kaartCodes().slice(0, 2).forEach(c => WHPD2.UI.sel.add(c)); WHPD2.verversAlles(); WHPD2.UI.oefenen = true; WHPD2.verversAlles(); });
    await schiet('groepsbalk', () => {}, '#pd2-maat');
    await P.evaluate(() => { WHPD2.UI.sel.clear(); WHPD2.UI.oefenen = false; try{ localStorage.setItem('pd2-oefenen', '0'); }catch(e){} });
    console.log('errors', T.errors.join('\n') || '–', 'blocked', T.blocked.length);
    await T.b.close();
  }
  require('fs').writeFileSync(UIT + '/rust.json', JSON.stringify(res, null, 1));
  console.log(fout.length ? 'FOUT: ' + fout.join(', ') : 'alle schermen OK');
})().catch(e => { console.error('CRASH', e); process.exit(1); });
