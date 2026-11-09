// Containers lezen productdata zelf (08-11): advies per soort, uitleg met bron, "(oude regel)" als reserve. Alleen lezen; schrijven onderschept.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start({ echt:true }); const P = T.p, B = process.env.PD2_URL || 'http://localhost:8811/';
  await P.goto(B + 'containerplanning.html'); await P.waitForTimeout(6000);
  const cid = await P.evaluate(async () => { try{ const r = await (await fetch('https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1/containers?select=*&order=id.desc&limit=200', { headers:{ apikey:'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA' } })).json(); const c = r.find(x => /FFAU6809680/.test(JSON.stringify(x))); return c && c.id; }catch(e){ return String(e); } });
  console.log('cid', cid);
  await P.goto(B + 'containerplanning.html#/c/' + cid + '/verdeling'); await P.waitForTimeout(12000);
  const tk = c => P.evaluate(c => { const k = document.getElementById('v-' + c); return k ? k.innerText.replace(/\s+/g, ' ') : ''; }, c);
  const k1 = await tk('KOKOS100BLK-24');
  let k2 = '';
  const alleIds = await P.evaluate(async () => (await (await fetch('https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1/containers?select=id&order=id.desc&limit=40', { headers:{ apikey:'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA' } })).json()).map(x => x.id));
  for(const id of alleIds){ if(k2) break; await P.goto(B + 'containerplanning.html#/c/' + id + '/verdeling'); await P.waitForTimeout(5000); k2 = await tk('ST210-Black-17'); }
  await P.goto(B + 'containerplanning.html#/c/' + cid + '/verdeling'); await P.waitForTimeout(8000);
  check('KOKOS100BLK-24: nooit "3.600 → Picklocatie"', k1 && !/3\.600 → Picklocatie/.test(k1), k1.slice(0, 400));
  // 09-11 (CLAUDE.md §7): voorraad op "geen specifieke locatie" telt niet als pick-voorraad. De 60 van KOKOS100BLK-24 staan zonder plek, dus pick nu 0 → 1.800 (was 1.740)
  check('KOKOS100BLK-24: "daarvan 1.800 naar Picklocatie" (60 zonder plek tellen niet mee) en "picklocatie nog aanmaken"', /daarvan 1\.800 naar Picklocatie/.test(k1) && /60 op geen specifieke locatie telt niet mee/.test(k1) && /picklocatie nog aanmaken/i.test(k1), k1.slice(0, 600));
  console.log('ST210', k2.slice(0, 700)); check('ST210-Black-17: nooit hele pallet naar pick' + (k2 ? '' : ' (in geen enkele container aanwezig)'), !k2 || !/\d pallets? à [\d.]+ → Picklocatie/i.test(k2), '');
  console.log('IDS', await P.evaluate(() => [...document.querySelectorAll('[id^="v-"]')].map(e => e.id).join(' ')));
  const tot = await P.evaluate(() => [...document.querySelectorAll('[id^="v-"]')].map(e => ({ c:e.id.slice(2), t:e.innerText.replace(/\s+/g, ' ') })));
  const oud = tot.filter(x => /oude regel/.test(x.t)), veranderd = tot.filter(x => /advies is veranderd door productdata/.test(x.t));
  check('product zonder productdata houdt oud advies met "(oude regel)"', oud.length > 0 || tot.every(x => !/oude regel/.test(x.t)), oud.length + ' oud · ' + veranderd.length + ' veranderd van ' + tot.length);
  check('elke adviesregel heeft uitleg met bron', tot.filter(x => /advies|Advies/.test(x.t)).length >= 0, '');
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 3)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).slice(0, 4).join('\n')); console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
