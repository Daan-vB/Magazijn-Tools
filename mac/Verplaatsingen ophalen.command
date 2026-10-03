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
# =====================================================================
set -u
CONF_DIR="$HOME/Library/Application Support/IVOL Warehouse"
CONF="$CONF_DIR/picqer.conf"
UA="IVOL Warehouse - verplaatsingen (Magazijn-Tools)"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/ivolvp.XXXXXX") || exit 1
trap 'rm -rf "$TMP"' EXIT

klaar(){ echo; read -r -p "Druk op Enter om dit venster te sluiten. " _; exit "${1:-0}"; }
fout(){ echo; echo "FOUT: $*"; klaar 1; }

echo "IVOL Warehouse — verplaatsingen ophalen uit Picqer"
echo "--------------------------------------------------"

# ---------- instellingen (eenmalig) ----------
instellen(){
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
haal(){
  local code poging
  for poging in 1 2 3 4; do
    code=$(printf 'user = "%s:"\n' "$SLEUTEL" | curl -sS -K - -o "$2" -w '%{http_code}' \
      -H "User-Agent: $UA" -H "Accept: application/json" "$BASIS/$1" 2>"$TMP/curl.err") || code="000"
    if [ "$code" = "429" ]; then sleep 20; continue; fi
    if [ "$code" = "000" ] && [ "$poging" -lt 4 ]; then sleep 3; continue; fi
    break
  done
  printf '%s' "$code"
}

# ---------- verbinding testen ----------
echo "Verbinden met $DOMEIN …"
code=$(haal "warehouses" "$TMP/magazijnen.json")
if [ "$code" = "401" ] || [ "$code" = "403" ]; then
  echo "Picqer weigert de sleutel (status $code)."
  read -r -p "Sleutel opnieuw invoeren? (j/n): " jn
  if [ "$jn" = "j" ] || [ "$jn" = "J" ]; then rm -f "$CONF"; echo "Start het bestand opnieuw."; fi
  klaar 1
fi
[ "$code" = "200" ] || fout "geen verbinding met https://$DOMEIN (status $code). $(cat "$TMP/curl.err" 2>/dev/null)"
echo "Verbonden."

# ---------- vanaf wanneer ----------
echo
read -r -p "Andere sleutel of ander adres instellen? Enter = nee, s = ja: " s
if [ "$s" = "s" ] || [ "$s" = "S" ]; then rm -f "$CONF"; echo "Start het bestand opnieuw."; klaar 0; fi
VANDAAG=$(date +%Y-%m-%d)
echo
echo "Vanaf wanneer? Enter = vandaag vanaf 00:00."
echo "Of typ een datum en tijd, bv. $VANDAAG 07:00 (of alleen een datum: $VANDAAG)."
read -r -p "Vanaf: " VANAF
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
SINDS_URL=$(printf '%s' "$SINDS" | sed 's/ /%20/g; s/:/%3A/g')
echo "Ophalen vanaf $SINDS …"

# ---------- verplaatsingen (100 per keer) ----------
o=0; totaal=0
: > "$TMP/bewegingen.txt"
while :; do
  code=$(haal "location-stock-history?sincedate=$SINDS_URL&offset=$o" "$TMP/h.json")
  [ "$code" = "200" ] || fout "location-stock-history gaf status $code. $(head -c 300 "$TMP/h.json" 2>/dev/null)"
  c=$(grep -o '"idproduct_location_stock_history"' "$TMP/h.json" | wc -l | tr -d ' ')
  totaal=$((totaal + c))
  # één regel per regel uit de geschiedenis; alleen verplaatsingen tussen locaties (geen picks/correcties)
  tr '}' '\n' < "$TMP/h.json" | grep -E '"change_type"[[:space:]]*:[[:space:]]*"movement"' | sed -E 's/^[^{]*//; s/$/}/' >> "$TMP/bewegingen.txt"
  printf '\r  gelezen: %s regels' "$totaal"
  [ "$c" -lt 100 ] && break
  o=$((o + 100))
  [ "$o" -ge 100000 ] && break
done
n=$(wc -l < "$TMP/bewegingen.txt" | tr -d ' ')
echo
echo "  waarvan verplaatsingen: $n"

# ---------- namen erbij: locaties, producten, gebruikers ----------
ids(){ grep -oE "\"$1\"[[:space:]]*:[[:space:]]*[0-9]+" "$TMP/bewegingen.txt" | sed -E 's/[^0-9]//g' | sort -un; }
{ ids idlocation; ids contra_idlocation; } | sort -un > "$TMP/locs.txt"
ids idproduct > "$TMP/prods.txt"
ids iduser > "$TMP/users.txt"
verzamel(){ # $1 = pad (locations/products/users), $2 = id-lijst, $3 = uitvoer, $4 = label
  local id i=0 tot ok=0
  tot=$(wc -l < "$2" | tr -d ' ')
  : > "$3"
  while read -r id; do
    [ -z "$id" ] && continue
    i=$((i + 1))
    printf '\r  %s: %s / %s' "$4" "$i" "$tot"
    if [ "$(haal "$1/$id" "$TMP/obj.json")" = "200" ]; then
      [ "$ok" -gt 0 ] && printf ',' >> "$3"
      tr -d '\n\r' < "$TMP/obj.json" >> "$3"; ok=$((ok + 1))
    fi
    sleep 0.12
  done < "$2"
  echo
}
verzamel locations "$TMP/locs.txt" "$TMP/locaties.txt" "locaties"
verzamel products "$TMP/prods.txt" "$TMP/producten.txt" "producten"
verzamel users "$TMP/users.txt" "$TMP/gebruikers.txt" "gebruikers"

# ---------- één bestand voor de app ----------
UIT="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Daan_System/00_Inbox"
[ -d "$UIT" ] || UIT="$HOME/Downloads"
NAAM="Verplaatsingen $(date +%Y-%m-%d) $(date +%H%M).json"
{
  printf '{"bron":"picqer-location-stock-history","versie":1,"sinds":"%s","opgehaald":"%s","domein":"%s","regels_gelezen":%s,' "$SINDS" "$(date '+%Y-%m-%d %H:%M:%S')" "$DOMEIN" "$totaal"
  printf '"magazijnen":'; tr -d '\n\r' < "$TMP/magazijnen.json"; printf ','
  printf '"historie":['; paste -sd, "$TMP/bewegingen.txt" | tr -d '\n'; printf '],'
  printf '"locaties":['; cat "$TMP/locaties.txt"; printf '],'
  printf '"producten":['; cat "$TMP/producten.txt"; printf '],'
  printf '"gebruikers":['; cat "$TMP/gebruikers.txt"; printf ']}'
} > "$UIT/$NAAM" || fout "kan niet schrijven naar $UIT"

echo
echo "Klaar: $n verplaatsingen sinds $SINDS."
echo "Bestand: $UIT/$NAAM"
echo "Sleep het in IVOL Warehouse → Containers → Controle (of Gegevens)."
command -v open >/dev/null 2>&1 && open -R "$UIT/$NAAM"
klaar 0
