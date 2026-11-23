// Containers lezen productdata zelf (08-11): advies per soort, uitleg met bron, "(oude regel)" als reserve. Alleen lezen; schrijven onderschept.
// Daan 23-11: geen vaste container of vast product. De test bekijkt het advies van elk product in elke container en kiest zelf een voorbeeld om de kaart te openen.
const { start, naarContainers, openKaart, kaartTekst, CP_URL } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start({ echt:true }); const P = T.p;
  await naarContainers(P); await P.waitForTimeout(3000);
  const r = await P.evaluate(() => {
    const X = CP_TEST, g = s => +String(s).replace(/\./g, '').replace(',', '.'), uit = { n:0, pd:0, oud:0, zonderBron:[], deelPallet:[], palletTeVroeg:[], deelTeVeel:[], deelVb:null };
    X.cont().forEach(c => X.pools(c).order.forEach(code => {
      let a; try{ a = X.advies(c, code); }catch(e){ return; } if(!a) return; uit.n++;
      const t = a.uitleg || '', por = a.porties || [];
      if(/productdata/.test(t)) uit.pd++; else if(/oude regel/.test(t)) uit.oud++; else if(!/bij lossen bepalen|nog te bepalen|verdeel zelf/.test(t)) uit.zonderBron.push(c.id + ':' + code);
      const m = t.match(/productdata: (Deel|Pallet|Pick|Mix), max op pick ([\d.,]+)(?:, bij ([\d.,]+))?, pick nu ([\d.,]+)/);
      if(!m) return;
      const soort = m[1], max = g(m[2]), bij = m[3] !== undefined ? g(m[3]) : null, nu = g(m[4]);
      // Deel: nooit een hele pallet naar pick; "daarvan n naar Picklocatie" nooit meer dan max op pick − pick nu (geen specifieke locatie telt niet mee)
      if(soort === 'Deel' && por.some(x => x.soort === 'pallet' && x.dest === 'PICK')) uit.deelPallet.push(c.id + ':' + code);
      const d = por.find(x => x.pickU > 0);
      if(soort === 'Deel' && d){ if(d.pickU > Math.max(0, max - nu)) uit.deelTeVeel.push(c.id + ':' + code + ' ' + d.pickU + ' > ' + max + ' − ' + nu);
        const zonder = /op geen specifieke locatie telt niet mee/.test(t); if(!uit.deelVb || (zonder && !uit.deelVb.zonder)) uit.deelVb = { id:c.id, code, n:d.pickU, zonder }; }
      // Pallet: een hele pallet naar pick alleen als pick ≤ aanvullen bij
      if(soort === 'Pallet' && por.some(x => x.soort === 'pallet' && x.dest === 'PICK') && !(bij === null ? nu <= 0 : nu <= bij)) uit.palletTeVroeg.push(c.id + ':' + code + ' pick nu ' + nu + ', bij ' + bij);
    }));
    return uit;
  });
  console.log('adviezen', r.n, '· met productdata', r.pd, '· oude regel', r.oud);
  check('Deel: nooit een hele pallet naar pick (alle containers)', !r.deelPallet.length, r.deelPallet.join(', '));
  check('Deel: "daarvan n naar Picklocatie" nooit meer dan max op pick − pick nu (zonder plek telt niet mee)', !r.deelTeVeel.length, r.deelTeVeel.join(', '));
  check('Pallet: hele pallet naar pick alleen als pick ≤ aanvullen bij', !r.palletTeVroeg.length, r.palletTeVroeg.join(', '));
  check('elk advies noemt zijn bron (productdata of "(oude regel)")', !r.zonderBron.length, r.zonderBron.slice(0, 8).join(', '));
  if(r.deelVb){
    // voorbeeld dat de test zelf kiest: de kaart openen (ook als hij op akkoord staat) en de uitleg lezen
    await P.goto(CP_URL('#/c/' + r.deelVb.id + '/verdeling')); await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(3000);
    await openKaart(P, r.deelVb.code);
    const k = await kaartTekst(P, r.deelVb.code), n = r.deelVb.n.toLocaleString('nl-NL');
    check('kaart ' + r.deelVb.code + ' (container ' + r.deelVb.id + ', zelf gekozen): "daarvan ' + n + ' naar Picklocatie" en de uitleg met productdata', new RegExp('daarvan ' + n.replace(/\./g, '\\.') + ' naar Picklocatie').test(k) && /productdata: Deel/.test(k) && (!r.deelVb.zonder || /op geen specifieke locatie telt niet mee/.test(k)), k.slice(0, 400));
  } else console.log('   (geen Deel-product met een deel naar pick in de containers; kaartcontrole overgeslagen)');
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 3)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).slice(0, 4).join('\n')); console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
  process.exit(fout.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
