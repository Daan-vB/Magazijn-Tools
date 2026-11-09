// Doorloop (07-11): Te doen invullen met zo min mogelijk klikken. Alle paden uit CLAUDE.md §5: elke soort, Weg met en zonder keuze, Mix,
// per product een andere soort, gewogen met en zonder kg, nieuwe maat bewaren en na herladen terug, geen voorstel, decimalen, Later, terug.
// Echte database alleen lezen (zonder Daans oefenantwoorden, zodat er nog soortvragen zijn); schrijven gaat naar een kopie in het geheugen.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p, B = process.env.PD2_URL || 'http://localhost:8811/';
  const ev = (f, a) => P.evaluate(f, a);
  const wacht = ms => P.waitForTimeout(ms);
  // 1. Te doen / Taak 0.4: Invullen opent de Doorloop
  await P.goto(B + 'ivol.html#/taak/0.4');
  await P.waitForFunction(() => /Soort: \d+ open/.test(document.body.innerText), null, { timeout:280000 });
  const links = await ev(() => [...document.querySelectorAll('a.knop')].filter(a => /Invullen/.test(a.innerText)).map(a => a.getAttribute('href')));
  check('Taak 0.4: elke "Invullen →" bij Soort / Gewicht / Hoeveelheid opent de Doorloop', ['soort', 'gewicht', 'hoev'].every(s => links.includes('#/doorloop/' + s)), links.join(' '));
  const soortOpen0 = await ev(() => +document.body.innerText.match(/Soort: (\d+) open/)[1]);
  // 2. Doorloop Soort: alleen open producten, geen klaar-families, kop "Familie x van y · nog n vragen"
  await P.goto(B + 'ivol.html#/doorloop/soort');
  await P.waitForSelector('.dl .vraag', { timeout:280000 });
  const s0 = await ev(() => { const S = WHDL.S, alle = S.fams.flatMap(f => f.cs); return { n:alle.length, nietOpen:alle.filter(c => PD2R.status(c).stap.soort).length, famsZonder:S.fams.filter(f => !f.cs.length).length, abc:S.fams.map(f => f.kl).join(''), grp:(() => { const g = []; S.fams.forEach(f => { const l = g[g.length - 1]; if(l && l.k === f.gk) l.kl.push(f.kl); else g.push({ k:f.gk, kl:[f.kl] }); }); return { best:g.map(x => x.kl.slice().sort()[0]).join(''), binnen:g.every(x => x.kl.join('') === x.kl.slice().sort((a, b) => (a === '–' ? 'D' : a).localeCompare(b === '–' ? 'D' : b)).join('')), aaneen:new Set(g.map(x => x.k)).size === g.length }; })(), waar:document.getElementById('dl-waar').innerText, rijen:WHDL.S.pad[WHDL.S.i].rows.length, opDisk:PD2R.belangrijk().filter(c => !PD2R.status(c).stap.soort && !PD2R.isKoppel(c)).length }; });
  check('Doorloop Soort: alleen belangrijke producten met soort open, geen klaar-families', s0.n > 0 && s0.nietOpen === 0 && s0.famsZonder === 0 && s0.n === s0.opDisk, JSON.stringify(s0));
  // 09-11 (VASTE REGEL samenvoegen): "Volgende familie" volgt de groep (leverancier + hoofdwoord); A-groepen vóór B-groepen, binnen de groep A vóór B
  check('volgorde per groep: A-groepen vóór B, een groep aaneen, binnen de groep A vóór B; kop "Familie 1 van y · nog n vragen"', /^A*B*[C–]*$/.test(s0.grp.best) && s0.grp.binnen && s0.grp.aaneen && /^Familie 1 van \d+ · nog \d+ vragen$/.test(s0.waar), s0.waar + ' · ' + s0.abc.slice(0, 20) + ' ' + JSON.stringify(s0.grp).slice(0, 120));
  // helpers: naar een vraag van een familie springen (positie), en klikken via het scherm
  const naar = (t, fk) => ev(([t, fk]) => { const S = WHDL.S, j = S.pad.findIndex(v => v.t === t && (!fk || v.f.fk === fk)); if(j < 0) return false; S.i = j; S.sel = null; S.melding = ''; S.klaar = false; WHDL.teken(); return true; }, [t, fk]);
  const nu = () => ev(() => { const v = WHDL.S.pad[WHDL.S.i]; return { t:v.t, fk:v.f.fk, rows:(v.rows || []).slice(), melding:(document.querySelector('.dl .melding') || {}).innerText || '', tekst:document.querySelector('.dl main').innerText }; });
  const klopt = async () => { await ev(() => document.getElementById('dl-klopt').click()); await wacht(400); };
  // familie met minstens 3 producten en soort open
  const fam = await ev(() => { const goed = n => WHDL.S.fams.find(f => f.cs.length >= n && f.cs.slice(0, 3).every(c => !PD2R.isSam(c) && !PD2R.status(c).stap.gewicht)); const f = goed(3) || goed(2) || WHDL.S.fams[0]; return { fk:f.fk, cs:f.cs.slice(0, 3) }; });
  await naar('soort', fam.fk);
  // per product een andere soort: tik op de waarde van product 2 → Pick, product 3 → Mix; de rest volgt "Selectie is: Pallet"
  await ev(() => document.querySelector('.dl [data-keus="pallet"]').click());
  for(const [c, k] of [[fam.cs[1], 'pick'], [fam.cs[2], 'mix']].filter(x => x[0])){
    await ev(c => document.querySelector(`.dl [data-kies="${CSS.escape(c)}"]`).click(), c);
    await ev(([c, k]) => document.querySelector(`.dl [data-rijkeus="${CSS.escape(c)}|${k}"]`).click(), [c, k]);
  }
  const vk = await ev(cs => cs.map(c => document.querySelector(`.dl [data-kies="${CSS.escape(c)}"]`).innerText), fam.cs);
  console.log('familie', fam.fk, fam.cs.join(','));
  check('per product een andere soort (tik op de waarde): Pallet · Pick · Mix', /Pallet/.test(vk[0]) && /Pick/.test(vk[1]) && (!fam.cs[2] || /Mix/.test(vk[2])), vk.join(' / '));
  await klopt();
  const na1 = await ev(cs => cs.map(c => { const p = PD2R.po(c); return p && p.so ? p.so.v + ':' + p.so.st : '-'; }), fam.cs);
  check('Klopt schrijft de soort direct (bevestigd of aangepast)', na1[0].startsWith('pallet') && na1[1].startsWith('pick') && (!fam.cs[2] || na1[2].startsWith('mix')), na1.join(' '));
  let v = await nu();
  check('na Soort volgt meteen de volgende open vraag van deze familie (gewicht al vast → hoeveelheid)', v.fk === fam.fk && ['gewicht', 'spp', 'maat', 'hoogte', 'maxpick', 'rl', 'rmax'].includes(v.t), v.t + ' ' + v.rows.join(','));
  // 4. hoeveelheid volgt de soort per product: pick/mix nooit palletvragen, pallet zonder bewijs ook niet
  const vragen = await ev(fk => { const S = WHDL.S;
    // rijen uit de status, zoals de Doorloop ze bepaalt
    const st = c => PD2R.status(c);
    return S.pad.filter(v => v.f.fk === fk && ['spp', 'maat', 'hoogte', 'maxpick'].includes(v.t)).map(v => ({ t:v.t, rows:v.f.cs.filter(c => { const s = st(c); return s.stap.soort && s.so !== 'weg' && s.open.includes(v.t); }).map(c => ({ c, so:st(c).so, bewijs:!!PD2R.info(c).bewijs })) })); }, fam.fk);
  const fouteRij = vragen.flatMap(q => q.rows.filter(r => (['spp', 'maat', 'hoogte'].includes(q.t) && (!['pallet', 'deel', 'bulk'].includes(r.so) || !r.bewijs)) || (q.t === 'maxpick' && r.so === 'bulk')).map(r => q.t + ':' + r.c + ':' + r.so));
  check('vragen volgen de soort: palletvragen alleen bij Pallet/Deel/Bulk met palletbewijs, max op pick niet bij Bulk', !fouteRij.length, JSON.stringify(vragen.map(q => q.t + '=' + q.rows.map(r => r.so).join('/'))));
  const mpRows = (vragen.find(q => q.t === 'maxpick') || { rows:[] }).rows.map(r => r.c);
  check('Pick en Mix krijgen "max op pick"', mpRows.includes(fam.cs[1]) || mpRows.includes(fam.cs[2]) || vragen.every(q => q.t !== 'maxpick'), mpRows.join(','));
  // 5. decimalen en geen voorstel bij een getalvraag
  await naar('maxpick', fam.fk); v = await nu();
  if(v.t === 'maxpick' && v.rows.length){
    const c = v.rows[0];
    const leeg = await ev(c => !!document.querySelector(`.dl [data-num="${CSS.escape(c)}"]`), c);
    if(leeg){ await klopt(); const m = await nu(); check('geen voorstel: Klopt zonder waarde geeft een melding met het product', /Typ een getal bij/.test(m.melding) && m.melding.includes(c), m.melding); await P.fill(`.dl [data-num="${c}"]`, '12,5'); await P.keyboard.press('Tab'); }
    else { await ev(c => document.querySelector(`.dl [data-tik="${CSS.escape(c)}"]`).click(), c); await P.keyboard.type('12,5'); await P.keyboard.press('Tab'); }
    await wacht(300); const m2 = await nu();
    check('decimalen in een aantal: melding, niets opgeslagen', /Geen decimalen in aantallen/.test(m2.melding), m2.melding);
  } else check('geen max op pick-vraag in deze familie (overgeslagen)', true);
  // geen voorstel: een getalvraag waar de data niets voorstelt → leeg vak, Klopt zonder waarde geeft een melding
  const gv = await ev(() => { const S = WHDL.S; for(let j = 0; j < S.pad.length; j++){ const v = S.pad[j]; if(!['spp', 'hoogte', 'maxpick'].includes(v.t)) continue; const c = v.f.cs.find(c => { const s = PD2R.status(c); return s.stap.soort && s.so !== 'weg' && s.open.includes(v.t) && !PD2R.waarde(c, v.t).v; }); if(c){ S.i = j; S.sel = null; S.melding = ''; delete v.rows; WHDL.teken(); return { j, c, t:v.t }; } } return null; });
  if(gv){
    const leegVak = await ev(c => !!document.querySelector(`.dl [data-num="${CSS.escape(c)}"]`), gv.c);
    await klopt(); const m = await nu();
    check('geen voorstel (' + gv.t + ' ' + gv.c + '): leeg vak "typ", Klopt geeft een melding met het product', leegVak && /Typ een getal bij/.test(m.melding) && m.melding.includes(gv.c), m.melding);
  } else {
    // in de echte data heeft elk product een voorstel: het pad zonder voorstel nabootsen voor één product (alleen in deze test, PD2R.waarde geeft leeg)
    const nb = await ev(() => { const S = WHDL.S; for(let j = 0; j < S.pad.length; j++){ const v = S.pad[j]; if(!['spp', 'hoogte', 'maxpick'].includes(v.t)) continue; const c = v.f.cs.find(c => { const s = PD2R.status(c); return s.stap.soort && s.so !== 'weg' && s.open.includes(v.t); }); if(c){ const oud = PD2R.waarde; window.__oudWaarde = oud; PD2R.waarde = (x, k, I) => x === c && k === v.t ? { v:'', st:'leeg', why:'' } : oud(x, k, I); S.i = j; S.sel = null; S.melding = ''; delete v.rows; if(S.A[c] && S.A[c].f) delete S.A[c].f[v.t]; WHDL.teken(); return { c, t:v.t }; } } return null; });
    if(nb){
      const leegVak = await ev(c => !!document.querySelector(`.dl [data-num="${CSS.escape(c)}"]`), nb.c);
      await klopt(); const m = await nu();
      check('geen voorstel (nagebootst, ' + nb.t + ' ' + nb.c + '): leeg vak "typ", Klopt geeft een melding met het product', leegVak && /Typ een getal bij/.test(m.melding) && m.melding.includes(nb.c), m.melding);
      await ev(() => { PD2R.waarde = window.__oudWaarde; WHDL.S.melding = ''; WHDL.teken(); });
    } else check('geen getalvraag gevonden (pad zonder voorstel overgeslagen)', true);
  }
  // 6. nieuwe maat: bewaren, meteen in de lijst, kopie vooraf, na herladen terug (ook in Productdata 2.0)
  const maatFam = await ev(() => { const S = WHDL.S; for(const v of S.pad.filter(v => v.t === 'maat')){ const r = v.f.cs.filter(c => { const s = PD2R.status(c); return s.stap.soort && s.so !== 'weg' && s.open.includes('maat'); }); if(r.length) return v.f.fk; } return null; });
  if(maatFam){
    await naar('maat', maatFam);
    const alle = await ev(() => [...document.querySelectorAll('.dl [data-keus]')].map(b => b.dataset.keus));
    check('palletmaat: de hele lijst vaste opslagmaten', ['80x120', '90x120', '100x100', '100x120', '90x150', '100x150', '110x110', '120x150', '120x180', '100x200', '120x200', '120x240'].every(m => alle.includes(m)), alle.join(' '));
    await ev(() => document.getElementById('dl-maatnieuw').click());
    await P.fill('#dl-nieuwemaat', '120 x 215'); await ev(() => document.getElementById('dl-maatok').click());
    await P.waitForFunction(() => [...document.querySelectorAll('.dl [data-keus]')].some(b => b.dataset.keus === '120x215'), null, { timeout:20000 }).catch(() => {});
    const m = await ev(() => ({ chip:[...document.querySelectorAll('.dl [data-keus]')].some(b => b.dataset.keus === '120x215'), gekozen:[...WHDL.S.sel.on].every(c => (WHDL.S.A[c].f || {}).maat === '120x215') }));
    check('"+ Nieuwe maat" 120 x 215 → 120x215 meteen in de lijst en gekozen; bewaard met kopie', m.chip && m.gekozen && T.mock['wh-palletmaten'] && T.mock['wh-palletmaten'].maten.includes('120x215') && Object.keys(T.mock).some(k => /^wh-palletmaten-kopie-/.test(k)), JSON.stringify(T.mock['wh-palletmaten']));
  } else check('geen palletmaat-vraag open in deze data (nieuwe maat overgeslagen)', true);
  // 7. hoogte: naar boven op 10 cm, boven 140 cm melding hal A
  const hFam = await ev(() => { for(const v of WHDL.S.pad.filter(v => v.t === 'hoogte')){ const r = v.f.cs.filter(c => { const s = PD2R.status(c); return s.stap.soort && s.so !== 'weg' && s.open.includes('hoogte'); }); if(r.length) return v.f.fk; } return null; });
  if(hFam){
    await naar('hoogte', hFam); v = await nu(); const c = v.rows[0];
    const leeg = await ev(c => !!document.querySelector(`.dl [data-num="${CSS.escape(c)}"]`), c);
    if(leeg) await P.fill(`.dl [data-num="${c}"]`, '143'); else { await ev(c => document.querySelector(`.dl [data-tik="${CSS.escape(c)}"]`).click(), c); await P.keyboard.press('Control+A'); await P.keyboard.type('143'); }
    await P.keyboard.press('Tab'); await wacht(300);
    const h = await ev(c => ({ w:(WHDL.S.A[c].f || {}).hoogte, feit:document.querySelector(`.dl [data-sel="${CSS.escape(c)}"]`).closest('.rij').innerText }), c);
    check('hoogte 143 → 150 (naar boven op 10 cm) en melding "te hoog voor 20-locatie hal A"', h.w === '150' && /te hoog voor 20-locatie hal A/.test(h.feit), JSON.stringify(h));
  } else check('geen hoogtevraag open in deze data (overgeslagen)', true);
  // 8. Weg zonder keuze → melding; met keuze → opgeslagen, verder geen vragen; Later; terug
  const fam2 = await ev(fk => { const f = WHDL.S.fams.find(f => f.fk !== fk && f.cs.length >= 2 && f.cs.every(c => !PD2R.status(c).stap.soort)); return f ? { fk:f.fk, cs:f.cs.slice() } : null; }, fam.fk);
  if(fam2){
    await naar('soort', fam2.fk);
    await ev(() => document.querySelector('.dl [data-keus="weg"]').click());
    await klopt(); v = await nu();
    check('Weg zonder keuze: melding "Kies bij Weg", niet door', v.t === 'soort' && /Kies bij Weg: Uitlopend of Archief/.test(v.melding), v.melding);
    // één product uitvinken: blijft open (Later), de rest Weg → Archief
    await ev(c => document.querySelector(`.dl [data-sel="${CSS.escape(c)}"]`).click(), fam2.cs[0]);
    await ev(() => document.querySelector('.dl [data-weg="archief"]').click());
    await klopt();
    const w = await ev(cs => cs.map(c => { const p = PD2R.po(c); return p && p.so ? p.so.v + '/' + (p.weg && p.weg.v) : 'open'; }), fam2.cs);
    check('Weg met keuze opgeslagen (Weg → Archief); uitgevinkt product blijft open', w[0] === 'open' && w.slice(1).every(x => x === 'weg/archief'), w.join(' '));
    const rest = await ev(fk => WHDL.S.pad.filter(v => v.f.fk === fk && v.t !== 'soort' && v.t !== 'klaar').map(v => v.f.cs.filter(c => { const s = PD2R.status(c); return s.stap.soort && s.so !== 'weg' && (v.t === 'gewicht' ? !s.stap.gewicht : s.open.includes(v.t)); })).flat(), fam2.fk);
    check('Weg: verder geen vragen voor die producten', rest.length === 0, rest.join(','));
    // Later en terug
    await naar('soort', fam2.fk); const voorLater = await ev(c => PD2R.status(c).stap.soort, fam2.cs[0]);
    await ev(() => document.getElementById('dl-later').click()); await wacht(300);
    const naLater = await ev(c => PD2R.status(c).stap.soort, fam2.cs[0]);
    const j = await ev(() => WHDL.S.i);
    await ev(() => document.getElementById('dl-terug').click()); await wacht(300);
    const terug = await nu();
    check('Later: niets opgeslagen, blijft open; ← gaat terug naar de vorige vraag', voorLater === false && naLater === false && terug.t === 'soort' && terug.fk === fam2.fk, 'na Later i=' + j);
  } else check('geen tweede familie met soort open (Weg-paden overgeslagen)', true);
  // 9. klaar-overzicht na de familie
  await naar('klaar', fam.fk);
  const kl = await ev(() => ({ t:document.querySelector('.dl .klaar') ? document.querySelector('.dl .klaar').innerText : '', knop:document.getElementById('dl-klopt').innerText }));
  check('na de familie: overzicht (vast, nog open) en knop "Volgende familie →"', kl.t.length > 0 && /Volgende familie →|Klaar/.test(kl.knop), kl.knop);
  // gewicht: gewogen zonder kg → melding; met kg → opgeslagen (route Gewicht)
  await P.goto(B + 'ivol.html#/doorloop/gewicht'); await P.reload();
  await P.waitForSelector('.dl .vraag, .dl .klaar', { timeout:280000 });
  const gj = await ev(() => { const S = WHDL.S, j = S.pad.findIndex(v => v.t === 'gewicht' && v.f.cs.some(c => { const s = PD2R.status(c); return s.stap.soort && s.so !== 'weg' && !PD2R.isSam(c) && !s.stap.gewicht; })); if(j < 0) return -1; S.i = j; S.sel = null; S.melding = ''; delete S.pad[j].rows; WHDL.teken(); return j; });
  if(gj >= 0){
    v = await nu();
    check('Gewicht: vraag "Klopt het gewicht per stuk uit Picqer?" met Picqer-kg bij de feiten', v.t === 'gewicht' && /Klopt het gewicht per stuk uit Picqer/.test(v.tekst) && /Picqer .* kg|Picqer heeft geen gewicht/.test(v.tekst));
    const gc = v.rows[0];
    await ev(c => document.querySelector(`.dl [data-kies="${CSS.escape(c)}"]`).click(), gc);
    await ev(c => document.querySelector(`.dl [data-rijkeus="${CSS.escape(c)}|gewogen"]`).click(), gc);
    const kgVak = await ev(c => !!document.querySelector(`.dl [data-kg="${CSS.escape(c)}"]`), gc);
    await klopt(); v = await nu();
    check('Gewogen: kg-vakje direct zichtbaar; zonder kg geen Klopt (melding met het product)', kgVak && v.t === 'gewicht' && /Gewogen: typ de kg bij/.test(v.melding) && v.melding.includes(gc), v.melding);
    await P.fill(`.dl [data-kg="${gc}"]`, '19,5'); await P.keyboard.press('Tab'); await wacht(300);
    await klopt();
    const g1 = await ev(c => { const p = PD2R.po(c); return p && p.gew; }, gc);
    check('Gewogen met kg: opgeslagen als gewogen 19,5 kg', g1 && g1.st === 'gewogen' && g1.kg === 19.5, JSON.stringify(g1));
    const te = await ev(() => { const v = WHDL.S.pad[WHDL.S.i]; return v.t === 'gewicht' ? v.rows : null; });
    if(te && te.length){ await ev(() => document.querySelector('.dl [data-keus="tewegen"]').click()); await klopt(); const t2 = await ev(cs => cs.map(c => (PD2R.po(c) || {}).gew), te); check('Te wegen zonder kg: door, op de Weeglijst', t2.every(g => g && g.st === 'tewegen'), JSON.stringify(t2.slice(0, 2))); }
  } else check('geen gewichtvraag open in deze data (gewicht-paden overgeslagen)', true);
  // 10. telling in Te doen loopt af
  await wacht(1500);
  await P.goto(B + 'ivol.html#/taak/0.4');
  await P.waitForFunction(() => /Soort: \d+ open/.test(document.body.innerText), null, { timeout:120000 });
  const soortOpen1 = await ev(() => +document.body.innerText.match(/Soort: (\d+) open/)[1]);
  check('telling in Taak 0.4 loopt af na Klopt (Soort ' + soortOpen0 + ' → ' + soortOpen1 + ')', soortOpen1 < soortOpen0);
  // 11. 390 en 1440 px zonder horizontaal scrollen
  for(const vp of [{ width:1440, height:900 }, { width:390, height:844 }]){
    await P.setViewportSize(vp); await P.goto(B + 'ivol.html#/doorloop/gewicht'); await P.reload();
    await P.waitForSelector('.dl .vraag, .dl .klaar', { timeout:280000 });
    const hs = await ev(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('.dl *')].some(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > innerWidth + 1; }));
    check('Doorloop ' + vp.width + ' px: geen horizontaal scrollen', !hs);
  }
  // 12. nieuwe maat na herladen terug, ook in Productdata 2.0
  if(maatFam){ const m = await ev(() => ({ eigen:PD2R.EIGEN_MATEN.slice(), pd2:PD2R.MATEN.includes('120x215') })); check('na herladen: 120x215 staat in de lijst (ook Productdata 2.0)', m.eigen.includes('120x215') && m.pd2, JSON.stringify(m)); }
  await wacht(2000);
  check('schrijft naar productdata (bron pd2) met kopie vooraf (wh-pd2-kopie)', T.pdWrites.length > 0 && T.pdWrites.every(r => Object.values(r.meta || {}).some(m => m && m.bron === 'pd2')) && Object.keys(T.mock).some(k => /^wh-pd2-kopie-/.test(k)), T.pdWrites.length + ' rijen · ' + Object.keys(T.mock).join(','));
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 3)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|locaties\.js/.test(e)).slice(0, 5).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
