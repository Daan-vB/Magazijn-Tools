#!/bin/bash
# =====================================================================
#  IVOL Warehouse — Verplaatsingen ophalen uit Picqer (alleen lezen)
#
#  Dubbelklik dit bestand. Het haalt alle voorraadverplaatsingen tussen
#  locaties op sinds een tijdstip (Picqer API: location-stock-history),
#  met de namen van locaties, producten en gebruikers, en bewaart alles
#  als één bestand in Daan_System/00_Inbox (of Downloads):
#      Verplaatsingen 2026-10-03 0715.json
#  Sleep dat bestand in IVOL Warehouse → Containers → Controle.
#
#  Alleen GET-verzoeken: er wordt niets in Picqer veranderd.
#  De API-sleutel wordt één keer gevraagd en alleen op deze Mac bewaard:
#      ~/Library/Application Support/IVOL Warehouse/picqer.conf
#  Andere sleutel? Start het bestand en kies "s" bij de vraag.
#
#  Zuinig met Picqer (27-10-2026): Warehouse, Vandaag en Aanvullen gaan altijd voor.
#   - vaste rem: 2 seconden tussen twee vragen (IVOL_VP_REM)
#   - voorrang: Picqer meldt in elk antwoord hoeveel vragen er van de 500 per minuut over zijn;
#     zijn het er minder dan 250 (IVOL_VP_MIN_OVER), dan wacht dit bestand 45 seconden
#   - ophalen per dag, met voortgang op deze Mac: onderbroken of gestopt? Start opnieuw met dezelfde
#     "Vanaf" en het gaat verder waar het bleef (map "verplaatsingen-voortgang" naast picqer.conf)
#   - 429, 500, 502, 503, 504 of geen verbinding: stoppen en oplopend wachten (10, 20, 40, 80 minuten),
#     nooit direct opnieuw; daarna verder, of na 4 keer stoppen met de voortgang bewaard
#  Zonder vragen te draaien (voor een geplande taak): IVOL_VP_AUTO=1 IVOL_VP_VANAF="2026-10-14 22:00"
#  Optioneel IVOL_VP_UIT=<map> (waar het bestand komt) en IVOL_VP_INDEX=<wh-hist-index.json> (productnamen
#  uit de bestaande index; alleen onbekende producten worden bij Picqer opgevraagd).
# =====================================================================
set -u
AUTO="${IVOL_VP_AUTO:-0}"
REM="${IVOL_VP_REM:-2}"
MIN_OVER="${IVOL_VP_MIN_OVER:-250}"
WACHT_EERST="${IVOL_VP_WACHT:-600}"
CONF_DIR="$HOME/Library/Application Support/IVOL Warehouse"
CONF="$CONF_DIR/picqer.conf"
STATE_ROOT="$CONF_DIR/verplaatsingen-voortgang"
UA="IVOL Warehouse - verplaatsingen (Magazijn-Tools)"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/ivolvp.XXXXXX") || exit 1
trap 'rm -rf "$TMP"' EXIT
FOUTEN=0

klaar(){ echo; [ "$AUTO" = "1" ] || read -r -p "Druk op Enter om dit venster te sluiten. " _; exit "${1:-0}"; }
fout(){ echo; echo "FOUT: $*"; klaar 1; }
later(){ echo; echo "Gestopt, voortgang bewaard. Start dit bestand later opnieuw met dezelfde 'Vanaf': het gaat verder waar het bleef."; klaar 75; }

echo "IVOL Warehouse — verplaatsingen ophalen uit Picqer"
echo "--------------------------------------------------"

# ---------- instellingen (eenmalig) ----------
instellen(){
  [ "$AUTO" = "1" ] && fout "geen instellingen op deze Mac (picqer.conf); start dit bestand eerst eenmaal met een dubbelklik"
  echo "Eenmalig instellen (blijft op deze Mac bewaard)."
  read -r -p "Picqer-adres, bv. ivol.picqer.com: " DOMEIN
  read -r -s -p "Picqer API-sleutel (je ziet niets tijdens het typen): " SLEUTEL; echo
  mkdir -p "$CONF_DIR" || fout "kan $CONF_DIR niet maken"
  ( umask 077; printf 'DOMEIN=%q\nSLEUTEL=%q\n' "$DOMEIN" "$SLEUTEL" > "$CONF" )
  chmod 600 "$CONF"
}
if [ ! -f "$CONF" ]; then instellen; fi
# shellcheck disable=SC1090
. "$CONF"
DOMEIN=${DOMEIN:-}; SLEUTEL=${SLEUTEL:-}
DOMEIN=$(printf '%s' "$DOMEIN" | sed -E 's#^https?://##; s#/.*$##; s/[[:space:]]//g')
case "$DOMEIN" in *.*) ;; ?*) DOMEIN="$DOMEIN.picqer.com" ;; esac
[ -n "$DOMEIN" ] && [ -n "$SLEUTEL" ] || { rm -f "$CONF"; fout "adres of sleutel leeg; start opnieuw"; }
BASIS="${IVOL_PICQER_BASIS:-https://$DOMEIN/api/v1}"

# één GET-verzoek; schrijft naar $2, geeft de HTTP-status terug. Sleutel via stdin (niet zichtbaar in de proceslijst).
# Vaste rem vooraf, en na het antwoord voorrang voor de andere onderdelen als Picqer weinig ruimte meldt. Geen herhaling hier.
haal(){
  local code rest
  sleep "$REM"
  code=$(printf 'user = "%s:"\n' "$SLEUTEL" | curl -sS -K - -D "$TMP/hdr.txt" -o "$2" -w '%{http_code}' --max-time 120 \
    -H "User-Agent: $UA" -H "Accept: application/json" "$BASIS/$1" 2>"$TMP/curl.err") || code="000"
  rest=$(grep -i '^x-ratelimit-remaining:' "$TMP/hdr.txt" 2>/dev/null | tr -d '\r' | awk '{print $2}')
  if [ -n "$rest" ] && [ "$rest" -lt "$MIN_OVER" ] 2>/dev/null; then
    echo "  [Picqer: nog $rest vragen over; 45 s wachten, Warehouse, Vandaag en Aanvullen gaan voor]" >&2
    sleep 45
  fi
  printf '%s' "$code"
}
# met oplopend wachten: 0 = gelukt (200); 1 = andere fout (niet herhalen); 75 = Picqer blijft weigeren, voortgang bewaard
vraag(){
  local code wacht
  while :; do
    code=$(haal "$1" "$2")
    case "$code" in
      200) FOUTEN=0; return 0 ;;
      429|500|502|503|504|000)
        FOUTEN=$((FOUTEN + 1))
        if [ "$FOUTEN" -gt 4 ]; then echo; echo "Picqer meldde steeds $code ($1)."; return 75; fi
        wacht=$((WACHT_EERST * (1 << (FOUTEN - 1))))
        echo; echo "  Picqer meldde $code: stoppen en $((wacht / 60)) minuten wachten (poging $FOUTEN van 4); voortgang is bewaard."
        sleep "$wacht" ;;
      *) LAATSTE_CODE="$code"; return 1 ;;
    esac
  done
}
LAATSTE_CODE=""

# ---------- verbinding testen ----------
echo "Verbinden met $DOMEIN …"
vraag "warehouses" "$TMP/magazijnen.json"; r=$?
code="${LAATSTE_CODE:-200}"; [ "$r" = "0" ] && code=200
if [ "$r" = "1" ] && { [ "$code" = "401" ] || [ "$code" = "403" ]; }; then
  echo "Picqer weigert de sleutel (status $code)."
  if [ "$AUTO" != "1" ]; then
    read -r -p "Sleutel opnieuw invoeren? (j/n): " jn
    if [ "$jn" = "j" ] || [ "$jn" = "J" ]; then rm -f "$CONF"; echo "Start het bestand opnieuw."; fi
  fi
  klaar 1
fi
[ "$r" = "75" ] && later
[ "$r" = "0" ] || fout "geen verbinding met https://$DOMEIN (status $code). $(cat "$TMP/curl.err" 2>/dev/null)"
echo "Verbonden."

# ---------- vanaf wanneer ----------
VANDAAG=$(date +%Y-%m-%d)
if [ "$AUTO" = "1" ]; then
  VANAF="${IVOL_VP_VANAF:-$VANDAAG}"
else
  echo
  read -r -p "Andere sleutel of ander adres instellen? Enter = nee, s = ja: " s
  if [ "$s" = "s" ] || [ "$s" = "S" ]; then rm -f "$CONF"; echo "Start het bestand opnieuw."; klaar 0; fi
  echo
  echo "Vanaf wanneer? Enter = vandaag vanaf 00:00."
  echo "Of typ een datum en tijd, bv. $VANDAAG 07:00 (of alleen een datum: $VANDAAG)."
  read -r -p "Vanaf: " VANAF
fi
VANAF=$(printf '%s' "$VANAF" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
[ -z "$VANAF" ] && VANAF="$VANDAAG"
# 03-10-2026 → 2026-10-03
VANAF=$(printf '%s' "$VANAF" | sed -E 's#^([0-9]{2})[-/]([0-9]{2})[-/]([0-9]{4})#\3-\2-\1#')
case "$VANAF" in
  [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) SINDS="$VANAF 00:00:00" ;;
  [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]\ [0-9]:[0-9][0-9]) SINDS="${VANAF%% *} 0${VANAF#* }:00" ;;
  [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]\ [0-9][0-9]:[0-9][0-9]) SINDS="$VANAF:00" ;;
  [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]\ [0-9][0-9]:[0-9][0-9]:[0-9][0-9]) SINDS="$VANAF" ;;
  *) fout "onbekende datum: $VANAF (gebruik bv. $VANDAAG 07:00)" ;;
esac
urlcode(){ printf '%s' "$1" | sed 's/ /%20/g; s/:/%3A/g'; }
echo "Ophalen vanaf $SINDS …"

# ---------- voortgang op deze Mac (hervatten) ----------
STATE="$STATE_ROOT/$(printf '%s' "$SINDS" | tr -c '0-9' '_')"
mkdir -p "$STATE" || fout "kan $STATE niet maken"
if [ -f "$STATE/nu.txt" ]; then
  NU_EP=$(cat "$STATE/nu.txt"); echo "Verder met de bewaarde voortgang (tot $(date -r "$NU_EP" '+%Y-%m-%d %H:%M'))."
else
  NU_EP=$(date +%s); echo "$NU_EP" > "$STATE/nu.txt"
fi
VAN_EP=$(date -j -f "%Y-%m-%d %H:%M:%S" "$SINDS" +%s 2>/dev/null) || fout "kan $SINDS niet lezen"

# ---------- verplaatsingen: per dag, 100 per keer ----------
totaal=0; i=0
while [ "$VAN_EP" -lt "$NU_EP" ]; do
  i=$((i + 1))
  DAG=$(date -r "$VAN_EP" '+%Y-%m-%d')
  VOLGENDE=$(date -j -v+1d -f "%Y-%m-%d %H:%M:%S" "$DAG 00:00:00" +%s)
  TOT_EP=$VOLGENDE; [ "$TOT_EP" -gt "$NU_EP" ] && TOT_EP=$NU_EP
  VAN_TXT=$(date -r "$VAN_EP" '+%Y-%m-%d %H:%M:%S'); TOT_TXT=$(date -r "$TOT_EP" '+%Y-%m-%d %H:%M:%S')
  F="$STATE/dag-$i.txt"
  if [ -f "$F.klaar" ]; then
    totaal=$((totaal + $(cat "$F.klaar")))
  else
    : > "$F.tmp"; o=0; gel=0
    while :; do
      vraag "location-stock-history?sincedate=$(urlcode "$VAN_TXT")&untildate=$(urlcode "$TOT_TXT")&offset=$o" "$TMP/h.json"; r=$?
      [ "$r" = "75" ] && later
      [ "$r" = "0" ] || fout "location-stock-history gaf status $LAATSTE_CODE. $(head -c 300 "$TMP/h.json" 2>/dev/null)"
      c=$(grep -o '"idproduct_location_stock_history"' "$TMP/h.json" | wc -l | tr -d ' ')
      gel=$((gel + c))
      # één regel per regel uit de geschiedenis; alleen verplaatsingen tussen locaties (geen picks/correcties)
      tr '}' '\n' < "$TMP/h.json" | grep -E '"change_type"[[:space:]]*:[[:space:]]*"movement"' | sed -E 's/^[^{]*//; s/$/}/' >> "$F.tmp"
      printf '\r  %s: %s regels' "$DAG" "$gel"
      [ "$c" -lt 100 ] && break
      o=$((o + 100))
      [ "$o" -ge 20000 ] && break
    done
    mv "$F.tmp" "$F"; echo "$gel" > "$F.klaar"; totaal=$((totaal + gel))
    echo
  fi
  VAN_EP=$TOT_EP
done
cat "$STATE"/dag-*.txt > "$TMP/bewegingen.txt" 2>/dev/null || : > "$TMP/bewegingen.txt"
n=$(wc -l < "$TMP/bewegingen.txt" | tr -d ' ')
echo "  gelezen: $totaal regels, waarvan verplaatsingen: $n"

# ---------- namen erbij: locaties, producten, gebruikers (bewaard per id, dus hervatbaar) ----------
ids(){ grep -oE "\"$1\"[[:space:]]*:[[:space:]]*[0-9]+" "$TMP/bewegingen.txt" | sed -E 's/[^0-9]//g' | sort -un; }
{ ids idlocation; ids contra_idlocation; } | sort -un > "$TMP/locs.txt"
ids idproduct > "$TMP/prods.txt"
ids iduser > "$TMP/users.txt"
# bekende productnamen uit de index van de geschiedenis (wh-hist-index): scheelt duizenden vragen aan Picqer
if [ -n "${IVOL_VP_INDEX:-}" ] && [ -f "${IVOL_VP_INDEX}" ] && command -v python3 >/dev/null 2>&1; then
  python3 - "$IVOL_VP_INDEX" "$TMP/prods.txt" "$STATE" <<'PY'
import json, os, sys
idx = json.load(open(sys.argv[1])); p = idx.get('p', {})
n = 0
for line in open(sys.argv[2]):
    i = line.strip()
    f = os.path.join(sys.argv[3], 'prod-%s.json' % i)
    if i and i in p and not os.path.exists(f):
        open(f, 'w').write(json.dumps({'idproduct': int(i), 'productcode': p[i]}, ensure_ascii=False)); n += 1
print('  producten uit de index: %d' % n)
PY
fi
verzamel(){ # $1 = pad (locations/products/users), $2 = id-lijst, $3 = voorvoegsel, $4 = label
  local id i=0 tot r
  tot=$(wc -l < "$2" | tr -d ' ')
  while read -r id; do
    [ -z "$id" ] && continue
    i=$((i + 1))
    printf '\r  %s: %s / %s' "$4" "$i" "$tot"
    [ -f "$STATE/$3-$id.json" ] && continue
    vraag "$1/$id" "$TMP/obj.json"; r=$?
    [ "$r" = "75" ] && later
    if [ "$r" = "0" ]; then tr -d '\n\r' < "$TMP/obj.json" > "$STATE/$3-$id.json"; fi
  done < "$2"
  echo
}
verzamel locations "$TMP/locs.txt" loc "locaties"
verzamel products "$TMP/prods.txt" prod "producten"
verzamel users "$TMP/users.txt" user "gebruikers"
lijst(){ # alle bewaarde objecten van één soort, door komma's gescheiden
  local f eerste=1
  for f in "$STATE/$1"-*.json; do [ -f "$f" ] || continue; [ "$eerste" = "1" ] || printf ','; eerste=0; cat "$f"; done
}

# ---------- één bestand voor de app ----------
UIT="${IVOL_VP_UIT:-$HOME/Library/Mobile Documents/com~apple~CloudDocs/Daan_System/00_Inbox}"
[ -d "$UIT" ] || UIT="$HOME/Downloads"
NAAM="Verplaatsingen $(date +%Y-%m-%d) $(date +%H%M).json"
{
  printf '{"bron":"picqer-location-stock-history","versie":1,"sinds":"%s","opgehaald":"%s","domein":"%s","regels_gelezen":%s,' "$SINDS" "$(date '+%Y-%m-%d %H:%M:%S')" "$DOMEIN" "$totaal"
  printf '"magazijnen":'; tr -d '\n\r' < "$TMP/magazijnen.json"; printf ','
  printf '"historie":['; paste -sd, "$TMP/bewegingen.txt" | tr -d '\n'; printf '],'
  printf '"locaties":['; lijst loc; printf '],'
  printf '"producten":['; lijst prod; printf '],'
  printf '"gebruikers":['; lijst user; printf ']}'
} > "$UIT/$NAAM" || fout "kan niet schrijven naar $UIT"
rm -rf "$STATE"

echo
echo "Klaar: $n verplaatsingen sinds $SINDS."
echo "Bestand: $UIT/$NAAM"
echo "Sleep het in IVOL Warehouse → Containers → Controle (of Gegevens)."
[ "$AUTO" = "1" ] || { command -v open >/dev/null 2>&1 && open -R "$UIT/$NAAM"; }
klaar 0
