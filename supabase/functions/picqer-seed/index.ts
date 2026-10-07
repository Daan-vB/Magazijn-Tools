// =====================================================================
//  IVOL Warehouse — TESTDATA aanmaken in de Picqer-TESTOMGEVING (ivol-dev)
//  Supabase Edge Function "picqer-seed". Dit is de ENIGE functie die naar Picqer
//  mag SCHRIJVEN, en alleen naar de testomgeving. De echte functie "picqer",
//  de echte Picqer (ivol.picqer.com) en de gewone app blijven ongemoeid.
//  Zet bij deze functie "Verify JWT" UIT (net als bij "picqer-test").
//
//  Geheimen (Edge Functions → Secrets), dezelfde als bij "picqer-test":
//    PICQER_TEST_DOMAIN     bv. ivol-dev.picqer.com
//    PICQER_TEST_KEY        API-sleutel van de TESTomgeving
//    IVOL_CODE              koppelcode (header x-ivol-code)
//    PICQER_TEST_WAREHOUSE  (optioneel) idwarehouse Hoofdmagazijn in test
//
//  Veiligheid:
//   - weigert te draaien als PICQER_TEST_DOMAIN de echte Picqer (ivol) is;
//   - weigert ook als het adres niet "dev" of "test" bevat;
//   - schrijft alleen via vaste acties (geen vrije opdrachten), alleen met POST;
//   - alles wat aangemaakt wordt krijgt het voorvoegsel DEMO-;
//   - elk antwoord bevat "omgeving":"test".
//
//  Acties:
//   GET  ?actie=status    → welke magazijnen, welk adres (schrijft niets)
//   POST ?actie=controle  → stap 1: maakt locatie DEMO-CONTROLE aan en verwijdert
//                           hem meteen weer. Laat zien of de sleutel mag schrijven.
//  Volgende blokken (locaties, leveranciers, producten, voorraad, inkooporders,
//  orders, ontvangsten) komen er één voor één bij, pas als het vorige gecontroleerd is.
//  Wordt automatisch live gezet door GitHub (workflow supabase-functies).
// =====================================================================

const DOMEIN = (Deno.env.get("PICQER_TEST_DOMAIN") || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const SLEUTEL = (Deno.env.get("PICQER_TEST_KEY") || "").trim();
const CODE = (Deno.env.get("IVOL_CODE") || "").trim();
const MAGAZIJN = Number(Deno.env.get("PICQER_TEST_WAREHOUSE") || "3857");
const HOST = DOMEIN ? (DOMEIN.includes(".") ? DOMEIN : DOMEIN + ".picqer.com") : "";
const BASIS = HOST ? "https://" + HOST + "/api/v1" : "";
// de echte Picqer van IVOL: deze functie weigert daarmee te praten
const IS_ECHT = /^ivol(\.picqer\.com)?$/i.test(DOMEIN);
// extra slot: het adres moet er als testomgeving uitzien
const IS_TEST = /(dev|test)/i.test(HOST);
const HERKOMST = ["https://daan-vb.github.io"];
const UA = "IVOL Warehouse TEST-SEED (github.com/Daan-vB/Magazijn-Tools)";
const DEMO = "DEMO-";

function cors(origin: string | null): Record<string, string> {
  const ok = origin && (HERKOMST.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : HERKOMST[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "apikey, authorization, x-client-info, content-type, x-ivol-code",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function antwoord(data: unknown, status: number, origin: string | null): Response {
  const uit = data && typeof data === "object" && !Array.isArray(data) ? { ...(data as Record<string, unknown>), omgeving: "test" } : data;
  return new Response(JSON.stringify(uit), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Ivol-Omgeving": "test" },
  });
}
class Fout extends Error {
  status: number;
  constructor(bericht: string, status = 502) { super(bericht); this.status = status; }
}
const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Picqer: enige netwerkfunctie ----------
// Schrijven mag alleen naar deze onderdelen, en nooit buiten het geweigerde echte adres.
const SCHRIJFBAAR = /^(locations|suppliers|products|purchaseorders|receipts|orders)(\/|$|\?)/;

async function pq(methode: "GET" | "POST" | "PUT" | "DELETE", pad: string, body?: unknown): Promise<any> {
  if (IS_ECHT || !IS_TEST) throw new Fout("Geweigerd: dit is niet de testomgeving.", 500);
  if (methode !== "GET" && !SCHRIJFBAAR.test(pad)) throw new Fout("Geweigerd: schrijven naar " + pad.split("?")[0] + " staat niet toe.", 500);
  for (let poging = 1; ; poging++) {
    let r: Response;
    try {
      r = await fetch(BASIS + "/" + pad, {
        method: methode,
        headers: {
          "Authorization": "Basic " + btoa(SLEUTEL + ":"),
          "Accept": "application/json",
          "User-Agent": UA,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (_e) {
      // bij schrijven nooit opnieuw proberen: kan dubbel aanmaken
      if (methode === "GET" && poging < 3) { await wacht(1000 * poging); continue; }
      throw new Fout("Picqer niet bereikbaar (" + pad.split("?")[0] + ")");
    }
    if (r.status === 429 && poging < 4) { await wacht(1000 * Math.min(20, Number(r.headers.get("Retry-After")) || 5)); continue; }
    if (r.status >= 500 && methode === "GET" && poging < 3) { await wacht(1500 * poging); continue; }
    const t = await r.text();
    if (r.status === 401) throw new Fout("Picqer weigert de API-sleutel (status 401)", 502);
    if (r.status === 403) throw new Fout("Picqer weigert deze handeling voor de sleutel (status 403) op " + methode + " " + pad.split("?")[0], 403);
    if (!r.ok) {
      let m = ""; try { m = JSON.parse(t).error_message || ""; } catch (_e) { /* geen json */ }
      throw new Fout("Picqer gaf status " + r.status + " op " + methode + " " + pad.split("?")[0] + (m ? ": " + m : ""));
    }
    if (!t.trim()) return null;           // 204 zonder inhoud
    try { return JSON.parse(t); } catch (_e) { throw new Fout("Picqer gaf geen geldige gegevens (" + pad.split("?")[0] + ")"); }
  }
}

// ---------- acties ----------
async function status() {
  const w = await pq("GET", "warehouses");
  return {
    domein: DOMEIN,
    magazijn: MAGAZIJN,
    magazijnen: (Array.isArray(w) ? w : []).map((x: any) => ({ id: x.idwarehouse, naam: x.name, actief: x.active !== false })),
  };
}

// Stap 1: mag de sleutel schrijven? Maak één locatie aan en verwijder hem meteen.
async function controle() {
  const w = await pq("GET", "warehouses");
  const lijst = (Array.isArray(w) ? w : []).map((x: any) => ({ id: x.idwarehouse, naam: x.name }));
  const mag = lijst.find((x) => x.id === MAGAZIJN);
  if (!mag) {
    throw new Fout("Magazijn " + MAGAZIJN + " staat niet in de testomgeving. Beschikbaar: " +
      (lijst.map((x) => x.naam + " (id " + x.id + ")").join(", ") || "geen") +
      ". Pas het geheim PICQER_TEST_WAREHOUSE in Supabase aan.", 400);
  }
  const naam = DEMO + "CONTROLE";
  const uit: Record<string, unknown> = { domein: DOMEIN, magazijn: { id: mag.id, naam: mag.naam }, locatie: naam };

  // bestaat hij al van een vorige keer? dan hergebruiken we hem voor de verwijdertest
  const bestaand = await pq("GET", "locations?search=" + encodeURIComponent(naam)).catch(() => []);
  const eerder = (Array.isArray(bestaand) ? bestaand : []).find((l: any) => l.name === naam && l.idwarehouse === MAGAZIJN);

  let id: number;
  if (eerder) {
    id = eerder.idlocation;
    uit.aanmaken = "overgeslagen (bestond al)";
  } else {
    const nieuw = await pq("POST", "locations", { name: naam, idwarehouse: MAGAZIJN });
    id = nieuw && nieuw.idlocation;
    if (!id) throw new Fout("Picqer gaf geen locatie terug na het aanmaken.");
    uit.aanmaken = "gelukt";
  }
  uit.idlocation = id;

  try {
    await pq("DELETE", "locations/" + id);
    uit.verwijderen = "gelukt";
  } catch (e) {
    uit.verwijderen = "mislukt: " + String((e as Error).message || e) + " — verwijder locatie " + naam + " handmatig in Picqer";
  }
  uit.schrijven = uit.aanmaken !== undefined && uit.verwijderen === "gelukt";
  return uit;
}

// ---------- ingang ----------
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "GET" && req.method !== "POST") return antwoord({ fout: "Alleen GET of POST." }, 405, origin);
  if (IS_ECHT) return antwoord({ fout: "PICQER_TEST_DOMAIN wijst naar de echte Picqer (ivol). Deze functie weigert dat." }, 500, origin);
  if (!BASIS || !SLEUTEL) return antwoord({ fout: "PICQER_TEST_DOMAIN of PICQER_TEST_KEY ontbreekt bij de Secrets in Supabase." }, 500, origin);
  if (!IS_TEST) return antwoord({ fout: "Het adres " + HOST + " ziet er niet uit als een testomgeving (geen 'dev' of 'test' in de naam). Deze functie weigert dat." }, 500, origin);
  if (!CODE) return antwoord({ fout: "IVOL_CODE ontbreekt bij de Secrets in Supabase." }, 500, origin);
  if ((req.headers.get("x-ivol-code") || "").trim() !== CODE) return antwoord({ fout: "Koppelcode klopt niet.", code: "koppelcode" }, 401, origin);
  const url = new URL(req.url);
  const actie = url.searchParams.get("actie") || "status";
  try {
    if (actie === "status") return antwoord(await status(), 200, origin);
    if (actie === "controle") {
      if (req.method !== "POST") return antwoord({ fout: "Deze actie schrijft en werkt alleen met POST (gebruik de knop op testdata.html)." }, 405, origin);
      return antwoord(await controle(), 200, origin);
    }
    return antwoord({ fout: "Onbekende actie: " + actie }, 400, origin);
  } catch (e) {
    const f = e instanceof Fout ? e : new Fout(String((e as Error)?.message || e));
    return antwoord({ fout: f.message }, f.status, origin);
  }
});
