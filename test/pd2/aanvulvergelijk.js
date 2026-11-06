// Vergelijk met PDF (06-11): één regel per product, elk verschil in één zin met rekensom. Echte database alleen lezen; geen Picqer.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p, B = process.env.PD2_URL || 'http://localhost:8811/';
  const ev = (f, a) => P.evaluate(f, a);
  const open = async (tab, vp) => { await P.setViewportSize(vp || { width:1440, height:900 }); await P.goto(B + 'test.html#/aanvullive/' + tab); await P.reload(); };
  await open('vergelijk');
  await P.waitForSelector('#vg', { timeout:240000 });
  const d = await ev(() => {
    const rij = [...document.querySelectorAll('.vg-rij')].map(r => ({ code:r.querySelector('.code').innerText, tekst:r.innerText, onv:!!r.querySelector('.b-bad'), groep:(r.closest('details') ? 'gelijk' : (() => { let e = r.previousElementSibling; while(e && e.tagName !== 'H4') e = e.previousElementSibling; return e ? e.innerText : ''; })()) }));
    return { rij, kop:[...document.querySelectorAll('.vg-kop')].map(k => k.innerText.replace(/\s+/g, ' ')).filter(Boolean), tekst:document.querySelector('#vg').innerText, sum:(document.querySelector('#vg details summary') || {}).innerText, tel:(document.querySelector('#vg .mt12 b') || {}).innerText };
  });
  console.log(d.tel);
  const rij = c => d.rij.find(r => r.code === c);
  check('kolommen Product · Plek · PDF zei · App zegt · Waarom', d.kop.length > 0 && d.kop.every(k => k === 'Product Plek PDF zei App zegt Waarom'), JSON.stringify(d.kop));
  check('geen "0 → 0", geen Pick PDF → nu, geen Stand-kolom', !/→ \d/.test(d.rij.map(r => r.tekst.split('\n')[0]).join(' ')) && !/Pick PDF → nu|Pickvrd PDF|Stand\b.*Reden/.test(d.tekst));
  check('gelijke regels ingeklapt achter "n gelijk"', /^\d+ gelijk$/.test(d.sum || ''), d.sum);
  const a = rij('5511901052'), b = rij('555B4-60'), c = rij('KJCRB711');
  check('5511901052: PDF 9, app 8, verklaard met rekensom (1 gereserveerd op bulk, toen)', a && !a.onv && /\n9\n/.test(a.tekst) && /aanvullen tot 8/.test(a.tekst) && /bulk heeft 47/.test(a.tekst) && /PDF telde 1 meer dan de som/.test(a.tekst) && /gereserveerd stond/.test(a.tekst), a && a.tekst.replace(/\n/g, ' | ').slice(0, 400));
  check('555B4-60: verklaard, retourkar Container 2 telt Picqer als pick', b && !b.onv && /retourkar Container 2/.test(b.tekst) && /adviseert 4/.test(b.tekst) && /adviseert 5/.test(b.tekst), b && b.tekst.replace(/\n/g, ' | ').slice(0, 400));
  check('KJCRB711: verklaard, order erbij na de PDF (vrij 2 = niveau 2), rekensom aanvullen 10', c && !c.onv && /na de PDF 1 op de pick gereserveerd/.test(c.tekst) && /aanvullen 10/.test(c.tekst), c && c.tekst.replace(/\n/g, ' | ').slice(0, 400));
  const onv = d.rij.filter(r => r.onv);
  check('elke onverklaarde regel heeft reden + rekensom of vraagt alleen om verversen', onv.every(r => /eerst verversen/.test(r.tekst) || r.tekst.split('\n').filter(Boolean).length >= 5), onv.map(r => r.code).join(','));
  check('geen vakjargon "volgens export" / "Reden"', !/volgens export|Onverklaard: zelfde pick, ander aantal/.test(d.tekst), (d.tekst.match(/.{30}(volgens export|ander aantal).{30}/) || [''])[0]);
  for(const vp of [{ width:1440, height:900 }, { width:390, height:844 }]){
    await open('vergelijk', vp); await P.waitForSelector('#vg', { timeout:240000 });
    const hs = await ev(() => document.documentElement.scrollWidth > innerWidth + 1 || document.querySelector('#vg').scrollWidth > innerWidth + 1);
    check('geen horizontaal scrollen (' + vp.width + ')', !hs);
  }
  for(const tab of ['orders', 'ronde', 'vst']){
    await open(tab); await P.waitForTimeout(6000);
    const t = await ev(() => document.body.innerText);
    check('tab ' + tab + ' werkt nog', /Voor orders/.test(t) && /Aanvulronde/.test(t) && /Van VST/.test(t) && !/CRASH|undefined/.test(t));
  }
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|locaties\.js/.test(e)).slice(0, 4).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
