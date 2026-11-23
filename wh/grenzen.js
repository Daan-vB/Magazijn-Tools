// Onmogelijke maten en gewichten (Daan 23-11): bij invullen een melding, en nooit opslaan zonder bevestiging.
// Eén plek voor alle invulschermen (Productdata 2.0, Doorloop, Te controleren, Te doen, Productdata, Containers "Na het lossen").
// Een waarde buiten de grens (bijv. hoogte 143100 cm) wordt pas bewaard als Daan bevestigt dat het toch klopt; anders blijft de oude waarde staan.
(function(){
  const G = {
    hoogte:{ t:'Hoogte incl. pallet', e:'cm', min:10, max:300 },
    kgst:{ t:'Gewicht per stuk', e:'kg', min:0.001, max:2000 },
    gewicht:{ t:'Gewicht volle pallet', e:'kg', min:1, max:3000 },
    rkg:{ t:'Gewicht volle rol', e:'kg', min:0.1, max:2000 },
    rb:{ t:'Breedte', e:'cm', min:1, max:600 },
    rd:{ t:'Dikte', e:'mm', min:0.1, max:300 },
    rl:{ t:'Lengte volle rol', e:'m', min:0.1, max:1000 },
    rdia:{ t:'Diameter volle rol', e:'cm', min:5, max:300 },
    maat:{ t:'Palletmaat', e:'cm', min:20, max:400 }   // per zijde
  };
  G.kg = G.kgst; G.gewpal = G.gewicht;
  const getal = v => {
    if(v === null || v === undefined) return null;
    if(typeof v === 'number') return isFinite(v) ? v : null;
    const s = String(v).trim().replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(s) ? +s : null;   // "onb", "nvt" en lege velden zijn geen maat
  };
  const nl = n => Number(n).toLocaleString('nl-NL', { maximumFractionDigits:3 });
  // de melding als de waarde onmogelijk is, anders null
  function onmogelijk(veld, waarde){
    const g = G[veld]; if(!g) return null;
    if(veld === 'maat'){
      const m = String(waarde || '').match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/i); if(!m) return null;
      const z = [getal(m[1]), getal(m[2])];
      return z.some(x => x < g.min || x > g.max) ? g.t + ' ' + m[1] + 'x' + m[2] + ' cm kan niet: elke zijde tussen ' + g.min + ' en ' + g.max + ' cm.' : null;
    }
    const n = getal(waarde); if(n === null) return null;
    if(n < g.min) return g.t + ' ' + nl(n) + ' ' + g.e + ' kan niet (minder dan ' + nl(g.min) + ' ' + g.e + ').';
    if(n > g.max) return g.t + ' ' + nl(n) + ' ' + g.e + ' kan niet (meer dan ' + nl(g.max) + ' ' + g.e + ').';
    return null;
  }
  // één vraag per melding; het antwoord geldt 15 s voor dezelfde melding (een groep met dezelfde waarde krijgt één vraag)
  const ANTW = new Map();
  function bevestig(meldingen){
    const l = [...new Set((meldingen || []).filter(Boolean))]; if(!l.length) return true;
    const k = l.join('|'), x = ANTW.get(k);
    if(x && Date.now() - x.t < 15000) return x.ja;
    let ja = false;
    try{ ja = window.confirm(l.join('\n') + '\n\nKlopt het toch? OK = toch opslaan · Annuleren = niet opslaan (aanpassen).'); }catch(e){ ja = false; }
    ANTW.set(k, { t:Date.now(), ja });
    return ja;
  }
  const mag = (veld, waarde) => { const m = onmogelijk(veld, waarde); return !m || bevestig([m]); };
  window.WHGRENS = { G, onmogelijk, bevestig, mag };
})();
