// Schermafdrukken: startscherm op 390 en 1440 px, en het familiescherm op 1440, 1920 en 390 px voor Whiteboard Magnetisch,
// Schoonloopmat Mars en Kokos op rol (plus een rol en Weg). Per scherm: geen horizontale scroll, niets buiten beeld, geen
// gestippelde randen, geen oranje vlakken, geen tabellen of chips; startscherm ≤ 7 blokken boven de vouw; familiescherm op
// desktop: inhoud ≥ 85% van de breedte en (1440 px) ≥ 3 kaarten helemaal in beeld.
const { start, open } = require('./opzet.js');
const UIT = process.env.UIT_MAP || '.';
const res = [], fout = [];
const FAM = [['whiteboard', 'SMIT Visual B.V.|whiteboard magnetisch'], ['mars', 'Hamat|schoonloopmat mars'], ['kokos', null]];
(async () => {
  for(const [naam, vp, mob] of [['1440', { width:1440, height:900 }, false], ['1920', { width:1920, height:1080 }, false], ['390', { width:390, height:844 }, true]]){
    const T = await start({ vp, mobiel:mob }); const P = T.p;
    await open(T);
    const meet = () => P.evaluate(() => {
      const nat = document.getElementById('native'), W = innerWidth;
      const els = [...document.querySelectorAll('.pd2, .pd2 *, #pd2-actie *, #pd2-oefw *')];
      const oranje = el => { const m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g); if(!m) return false; const [r, g, b, a = 1] = m.map(Number); if(a < .2) return false; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255)); let h = 0; if(mx !== mn){ if(mx === r) h = ((g - b) / (mx - mn)) % 6; else if(mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4; h *= 60; if(h < 0) h += 360; } return h >= 15 && h <= 50 && s > .45 && l > .35 && l < .92; };
      const zicht = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const pagina = document.querySelector('.pd2');
      const kaarten = [...document.querySelectorAll('article.pd2-kaart')];
      return {
        scherm:pagina && pagina.dataset.scherm,
        hscroll:Math.max(document.documentElement.scrollWidth - W, nat ? nat.scrollWidth - nat.clientWidth : 0),
        buiten:els.filter(e => { if(!zicht(e)) return false; const r = e.getBoundingClientRect(); return r.right > W + 1 || r.left < -1; }).length,
        stippel:els.filter(e => zicht(e) && /dashed|dotted/.test(getComputedStyle(e).borderTopStyle + getComputedStyle(e).borderLeftStyle + getComputedStyle(e).borderBottomStyle + getComputedStyle(e).textDecorationStyle)).length,
        oranje:els.filter(e => zicht(e) && oranje(e)).length,
        tabellen:document.querySelectorAll('.pd2 table').length,
        chips:document.querySelectorAll('.pd2 .pd2-aan, .pd2 .pd2-tag, .pd2 .pd2-chip').length,
        boven:pagina ? [...pagina.children].filter(e => zicht(e) && e.getBoundingClientRect().top < innerHeight).length : -1,
        breedte:pagina && nat ? Math.round(pagina.getBoundingClientRect().width / nat.clientWidth * 100) : 0,
        inhoud:pagina && nat ? Math.round((Math.max(...[...pagina.querySelectorAll('.pd2-zij, .pd2-maatblok')].map(e => e.getBoundingClientRect().right)) - Math.min(...[...pagina.querySelectorAll('.pd2-zij, .pd2-maatblok')].map(e => e.getBoundingClientRect().left))) / nat.clientWidth * 100) || 0 : 0,
        kaartenInBeeld:kaarten.filter(k => { const r = k.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; }).length,
        kaartHoogte:kaarten.slice(0, 4).map(k => Math.round(k.getBoundingClientRect().height)),
        tweeKolommen:!!(pagina && pagina.querySelector('.pd2-zij') && getComputedStyle(pagina.querySelector('.pd2-famgrid')).gridTemplateColumns.split(' ').length === 2),
        plat:!!document.querySelector('.pd2-maten.toc')
      };
    });
    const schiet = async (id, scrollNaar, eis) => {
      await P.waitForTimeout(350);
      await P.evaluate(s => { const nat = document.getElementById('native'); nat.scrollTop = 0; if(s){ const e = document.querySelector(s); if(e){ e.scrollIntoView(); nat.scrollTop -= 8; } } }, scrollNaar || null);
      await P.waitForTimeout(150);
      await P.screenshot({ path:`${UIT}/fam-${id}-${naam}.png` });
      const m = await meet(); res.push([naam, id, m]);
      let goed = m.hscroll <= 0 && m.buiten === 0 && m.stippel === 0 && m.oranje === 0 && m.tabellen === 0 && m.chips === 0;
      if(id === 'start') goed = goed && m.boven <= 7;
      if(eis) goed = goed && eis(m);
      if(!goed) fout.push(naam + ' ' + id);
      console.log((goed ? 'OK   ' : 'FOUT ') + naam.padEnd(5) + id.padEnd(16) + JSON.stringify(m));
    };
    const desk = naam !== '390';
    if(naam !== '1920') await schiet('start', null);
    for(const [id, fk0] of FAM){
      await P.evaluate(fk => { if(!fk){ const c = Object.keys(WH.D.P).find(c => PD2R.actief(c) && /^kokos op rol$/i.test(PD2R.famNaam(PD2R.famVan(c)))); fk = PD2R.famVan(c); } WHPD2.openFam(fk); }, fk0);
      await schiet(id + '-kop', null, m => !desk || (m.tweeKolommen && m.inhoud >= 85));
      await schiet(id + '-kaarten', '#pd2-kaarten', m => !desk || (m.inhoud >= 85 && (naam !== '1440' || m.kaartenInBeeld >= 3)));
    }
    // een rol en Weg
    await P.evaluate(() => { const c = Object.keys(WH.D.P).find(c => /^kokos\b/i.test(WH.D.P[c].naam || '') && PD2R.rolKand(c) && PD2R.actief(c)); PD2R.poZet(c, p => { p.rol = { v:true }; }); WHPD2.openFam(PD2R.famVan(c), PD2R.maatVan(c)); WHPD2.UI.stap = 'hoev'; WHPD2.verversAlles(); });
    await schiet('rol', '#pd2-kaarten');
    await P.evaluate(() => { const c = Object.keys(WH.D.P).find(c => /waterhog/i.test(WH.D.P[c].naam || '') && PD2R.actief(c) && WHPD2.segVan(c) === 'weg'); WHPD2.openFam(PD2R.famVan(c), PD2R.maatVan(c)); WHPD2.UI.stap = 'soort'; WHPD2.verversAlles(); });
    await schiet('weg', '#pd2-kaarten');
    await P.evaluate(() => { WHPD2.kaartCodes().slice(0, 2).forEach(c => WHPD2.UI.sel.add(c)); WHPD2.UI.oefenen = true; WHPD2.verversAlles(); });
    await schiet('groepsbalk', '#pd2-kaarten');
    await P.evaluate(() => { WHPD2.UI.sel.clear(); WHPD2.UI.oefenen = false; try{ localStorage.setItem('pd2-oefenen', '0'); }catch(e){} });
    console.log('errors', T.errors.join('\n') || '–', 'blocked', T.blocked.length);
    await T.b.close();
  }
  require('fs').writeFileSync(UIT + '/schermen.json', JSON.stringify(res, null, 1));
  console.log(fout.length ? 'FOUT: ' + fout.join(', ') : 'alle schermen OK');
})().catch(e => { console.error('CRASH', e); process.exit(1); });
