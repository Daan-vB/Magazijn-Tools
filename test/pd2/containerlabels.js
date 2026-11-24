// Palletlabels (containers): lange naam past (≥ 60 tekens, 2 regels waar nodig), barcode altijd (terugval CODE128), nooit "Barcode kon niet worden gemaakt",
// labels van container 22 en 3 afgeronde containers compleet (aantal = pallets uit de verdeling, aantallen kloppen, niets buiten de marge).
// Nodig: NODE_PATH met jsbarcode, jspdf (2.5.1) en canvas (alleen voor het voorbeeld-PDF); de CDN van de pagina is in de testomgeving soms geblokkeerd, daarom komen de libs lokaal.
// Alleen lezen: niets wordt bewaard, elke schrijfpoging onderschept. Env: LABEL_PDF = pad voor het voorbeeld-PDF (buiten de repo).
const fs = require('fs'), path = require('path');
const { start, naarContainers } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + String(x).slice(0, 300) : '')); };
const lib = m => { try{ return fs.readFileSync(require.resolve(m)); }catch(e){ return null; } };
// Daan vroeg expliciet om container 22 (HR26090) mee te nemen: via een variabele (env LABEL_CONTAINER), de rest kiest de test zelf
const EXTRA = +(process.env.LABEL_CONTAINER || 22);
const JSB = lib('jsbarcode/dist/JsBarcode.all.min.js'), JSP = lib('jspdf/dist/jspdf.umd.min.js');
(async () => {
  if(!JSB || !JSP){ console.log('LIBS ontbreken (jsbarcode, jspdf): test overgeslagen. Zet NODE_PATH.'); process.exit(0); }
  const T = await start({ vp:{ width:1440, height:900 } }), P = T.p;
  await P.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/jsbarcode\//, r => r.fulfill({ status:200, contentType:'application/javascript', body:JSB }));
  await P.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\//, r => r.fulfill({ status:200, contentType:'application/javascript', body:JSP }));
  await naarContainers(P, '#/');
  await P.waitForFunction(() => window.JsBarcode && window.jspdf, null, { timeout:30000 });
  await P.evaluate(() => { CP_TEST.testStil(); window.__pdfs = []; CP_TEST.zetBestandKlaar((blob, naam) => { window.__pdfs.push({ blob, naam }); }); });

  // 1. tekst: lange naam past (breedte binnen marge), code volledig; 2. barcode: oude mislukker + terugval
  const t = await P.evaluate(() => {
    const { jsPDF } = window.jspdf, W = 297, uit = {};
    const probeer = (naam, code) => { const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' }); const r = LABELKERN.tekenNaam(doc, naam, code, W); doc.setFont('helvetica', 'bold'); doc.setFontSize(r.naam.pt);
      return { pt:r.naam.pt, n:r.naam.regels.length, max:Math.max(...r.naam.regels.map(x => doc.getTextWidth(x))), codePt:r.code ? r.code.pt : 0, codeRegels:r.code ? r.code.regels.length : 0 }; };
    uit.kort = probeer('4560WM', '4560WM');
    uit.lang = probeer('DT140-1664 - Bureaublad Donker Eiken - 140x80 cm', 'DT140-1664');
    uit.zeerLang = probeer('DT140-1664 - Bureaublad Donker Eiken met extra brede tafelpoot en ladeblok links - 140x80 cm - uitvoering zwart gepoedercoat', 'DT140-1664');
    const cv = document.createElement('canvas'), o = { height:130, width:4, displayValue:true, fontSize:34, font:'Arial', fontOptions:'bold', margin:6 };
    uit.ean1664 = LABELKERN.barcodeMaak(JsBarcode, cv, '8720704620428', 'DT140-1664', o);
    uit.ean19015 = LABELKERN.barcodeMaak(JsBarcode, cv, '8720704620398', 'DT140-19015', o);
    uit.nummer = LABELKERN.barcodeMaak(JsBarcode, cv, 8720704620428, 'DT140-1664', o);
    uit.spatie = LABELKERN.barcodeMaak(JsBarcode, cv, ' 8720704620428​', 'DT140-1664', o);
    uit.fout13 = LABELKERN.barcodeMaak(JsBarcode, cv, '8720704620429', 'DT140-1664', o);
    uit.twee = LABELKERN.barcodeMaak(JsBarcode, cv, '8720704600864, 5708950203100', 'X-1', o);
    uit.geen = LABELKERN.barcodeMaak(JsBarcode, cv, '', 'DT140-1664', o);
    uit.niets = LABELKERN.barcodeMaak(JsBarcode, cv, '', '', o);
    uit.tv = LABELKERN.terugvalTekst([{ code:'DT140-1664', ean:'8720704620429' }, { code:'DT140-19015', ean:'8720704620398' }]);
    uit.geenTv = LABELKERN.terugvalTekst([{ code:'DT140-19015', ean:'8720704620398' }]);
    return uit;
  });
  check('1a Korte naam blijft groot (110 pt, 1 regel)', t.kort.pt === 110 && t.kort.n === 1, JSON.stringify(t.kort));
  check('1b Naam van 49 tekens past binnen de marge op 1 regel (≥ 24 pt)', t.lang.max <= 269 && t.lang.n === 1 && t.lang.pt >= 24, JSON.stringify(t.lang));
  check('1c Naam ≥ 60 tekens past: 2 regels, binnen de marge, ≥ 20 pt', t.zeerLang.max <= 269 && t.zeerLang.n <= 2 && t.zeerLang.pt >= 20, JSON.stringify(t.zeerLang));
  check('1d Productcode altijd volledig (1 regel) en ≥ 18 pt', t.lang.codePt >= 18 && t.lang.codeRegels === 1, JSON.stringify(t.lang));
  check('2a EAN van DT140-1664 (vroeger mislukt) geeft een EAN13-barcode', t.ean1664.ok && t.ean1664.formaat === 'EAN13' && !t.ean1664.terugval, JSON.stringify(t.ean1664));
  check('2b EAN van DT140-19015 blijft werken', t.ean19015.ok && t.ean19015.formaat === 'EAN13');
  check('2c EAN als getal, met spatie of nul-breedte teken: toch EAN13', t.nummer.formaat === 'EAN13' && t.spatie.formaat === 'EAN13' && t.nummer.ok && t.spatie.ok);
  check('2d EAN met verkeerd controlegetal: CODE128 met de EAN (terugval)', t.fout13.ok && t.fout13.formaat === 'CODE128' && t.fout13.terugval && t.fout13.waarde === '8720704620429', JSON.stringify(t.fout13));
  check('2e Twee EAN\'s in één veld: de eerste geldige', t.twee.ok && t.twee.formaat === 'EAN13' && t.twee.waarde === '8720704600864', JSON.stringify(t.twee));
  check('2f Geen EAN: CODE128 met de productcode (terugval), nooit zonder barcode', t.geen.ok && t.geen.waarde === 'DT140-1664' && t.geen.terugval, JSON.stringify(t.geen));
  check('2g Echt niets: geen fout, ok=false (label krijgt tekst "GEEN BARCODE")', t.niets.ok === false);
  check('2h Gele regel noemt het product met terugval, niet het andere', /DT140-1664/.test(t.tv) && !/DT140-19015/.test(t.tv) && t.geenTv === '', t.tv);

  // 3. labels van container 22 en 3 andere afgeronde containers
  const keuze = await P.evaluate(extra => {
    const X = CP_TEST, cs = X.cont(), pallets = c => Object.values(c.data.verdeling || {}).reduce((a, v) => a + ((v && v.porties) || []).filter(p => p.soort === 'pallet').reduce((b, p) => b + (+p.n || 0), 0), 0);
    const c22 = cs.find(c => +c.id === extra);
    const andere = cs.filter(c => c.status === 'afgerond' && +c.id !== extra && pallets(c) > 0).sort((a, b) => pallets(b) - pallets(a)).slice(0, 3).map(c => c.id);
    return { c22:c22 ? extra : null, andere };
  }, EXTRA);
  check('3a Extra container (' + EXTRA + ') en 3 afgeronde containers gevonden', keuze.c22 === EXTRA && keuze.andere.length === 3, JSON.stringify(keuze));
  const afwijkingen = [];
  for(const id of [keuze.c22, ...keuze.andere].filter(Boolean)){
    const r = await P.evaluate(async id => {
      const X = CP_TEST, c = X.cont().find(x => +x.id === id), W = 297, { jsPDF } = window.jspdf;
      const lijst = X.labelLijst(c).filter(l => !l.aanvul);
      const verwacht = Object.values(c.data.verdeling || {}).reduce((a, v) => a + ((v && v.porties) || []).filter(p => p.soort === 'pallet' && ['VST', 'UP', 'PICK', 'GROUND'].includes(p.dest)).reduce((b, p) => b + (+p.n || 0), 0), 0);
      const stuksVerd = Object.values(c.data.verdeling || {}).reduce((a, v) => a + ((v && v.porties) || []).filter(p => p.soort === 'pallet' && ['VST', 'UP', 'PICK', 'GROUND'].includes(p.dest)).reduce((b, p) => b + (+p.n || 0) * (+p.per || 0), 0), 0);
      const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' }), cv = document.createElement('canvas');
      const slecht = [];
      const gezien = {};
      lijst.forEach(l => {
        if(gezien[l.code]) return; gezien[l.code] = 1;
        const p = LABELKERN.tekenNaam(doc, l.name, l.code, W); doc.setFont('helvetica', 'bold'); doc.setFontSize(p.naam.pt);
        const max = Math.max(...p.naam.regels.map(x => doc.getTextWidth(x)));
        if(max > 269 || p.naam.regels.length > 2 || p.naam.pt < 20) slecht.push([l.code, 'tekst ' + Math.round(max) + ' mm, ' + p.naam.regels.length + ' regels, ' + p.naam.pt + ' pt']);
        const b = LABELKERN.barcodeMaak(JsBarcode, cv, l.ean, l.code, { height:130, width:4, displayValue:true, fontSize:34, font:'Arial', fontOptions:'bold', margin:6 });
        if(!b.ok) slecht.push([l.code, 'geen barcode']); else if(b.terugval) slecht.push([l.code, 'barcode via terugval: ' + b.reden]);
      });
      window.__pdfs = [];
      await X.maakLabels(c, lijst);
      const buf = await window.__pdfs[0].blob.arrayBuffer(), tekst = new TextDecoder('latin1').decode(buf), paginas = (tekst.match(/\/Type\s*\/Page[^s]/g) || []).length;
      const fouttekst = /kon niet worden gemaakt/.test(tekst);
      return { id, n:lijst.length, verwacht, stuksLabels:lijst.reduce((a, l) => a + (+l.stuks || 0), 0), stuksVerd, paginas, fouttekst, slecht };
    }, id);
    check('3 Container ' + r.id + ': ' + r.n + ' labels = ' + r.verwacht + ' pallets uit de verdeling', r.n === r.verwacht && r.n > 0, JSON.stringify({ n:r.n, v:r.verwacht }));
    check('3 Container ' + r.id + ': stuks op de labels = stuks in de verdeling', r.stuksLabels === r.stuksVerd, r.stuksLabels + ' vs ' + r.stuksVerd);
    check('3 Container ' + r.id + ': PDF heeft ' + r.n + ' pagina\'s en geen foutmelding', r.paginas === r.n && !r.fouttekst, 'pagina\'s ' + r.paginas);
    r.slecht.forEach(s => afwijkingen.push('container ' + r.id + ' · ' + s[0] + ' · ' + s[1]));
    check('3 Container ' + r.id + ': alle tekst binnen de marge en elke barcode aanwezig (terugval telt als afwijking, niet als fout)', r.slecht.every(s => /terugval/.test(s[1])), r.slecht.map(s => s.join(': ')).join(' | '));
  }
  console.log('AFWIJKINGEN (terugval/tekst): ' + (afwijkingen.length ? '\n  ' + afwijkingen.join('\n  ') : 'geen'));

  // 4. voorbeeld-PDF: lange naam, kort, terugval-barcode
  if(process.env.LABEL_PDF){
    const b64 = await P.evaluate(async () => {
      window.__pdfs = [];
      const c = CP_TEST.cont()[0];
      await CP_TEST.maakLabels(c, [
        { code:'DT140-1664', name:'DT140-1664 - Bureaublad Donker Eiken - 140x80 cm', ean:'8720704620428', stuks:30, dest:'UP' },
        { code:'4560WM', name:'4560WM - Whiteboard magnetisch 45x60', ean:'8720704620398', stuks:100, dest:'PICK' },
        { code:'DT140-19015', name:'DT140-19015 - Bureaublad Licht Eiken extra brede tafelpoot met ladeblok links - 140x80 cm - zwart gepoedercoat', ean:'8720704620397', stuks:30, dest:'UP' }]);
      const buf = new Uint8Array(await window.__pdfs[0].blob.arrayBuffer()); let s = ''; for(let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192)); return btoa(s);
    });
    fs.mkdirSync(path.dirname(process.env.LABEL_PDF), { recursive:true }); fs.writeFileSync(process.env.LABEL_PDF, Buffer.from(b64, 'base64'));
    check('4 Voorbeeld-PDF met 3 labels geschreven', fs.statSync(process.env.LABEL_PDF).size > 5000, process.env.LABEL_PDF);
  }
  check('5 0 geblokkeerde schrijfpogingen, 0 schrijfacties naar Picqer', T.blocked.length === 0, T.blocked.join(' | '));
  check('6 Geen pagina-fouten', !T.errors.some(e => /PAGEERROR/.test(e)), T.errors.filter(e => /PAGEERROR/.test(e)).join(' | '));
  await T.b.close();
  console.log('\n' + (fout.length ? 'FOUT: ' + fout.length + ' — ' + fout.join(' | ') : 'ALLES OK (' + ok.length + ')'));
  process.exit(fout.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
