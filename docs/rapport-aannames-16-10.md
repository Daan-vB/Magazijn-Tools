# Rapport: aannames van Daan verwerkt (16-10-2026)

## Per taak

**Taak 1 — `wh/aannames.js`: klaar.**
- Alle besluiten uit de chat staan erin met `bevestigd: Daan (chat) 2026-10-16`. Ze tellen als ✓. Een eigen keuze in de app gaat altijd voor.
- "Opnieuw" bij een chat-besluit zet hem weer open. De keuzes die Daan al in de app maakte zijn niet aangepast.
- `k-bo` is vervangen door "Backorders die wij oplossen". `d-02`, `d-04` en `d-07` zijn samengevoegd tot één rijderstaak, plus een regel extra rijderstaken.
- `d-08` is gesplitst in twee regels (ochtend en 16:30). `d-09` is weg. De containerdag is opgesplitst in 7 stappen.
- Grenzen: `6.10`, `6/10`, `6 · 10`, `6-10`, `6,10` en `6 10` lezen allemaal als 6 en 10. Onder elk kerncijfer staat live in gewone taal "0–5 goed · 6–9 let op · 10+ probleem".

**Taak 2 — schermen: klaar.**
- **Dagstart en Hoe staat het ervoor:**
  - Orders ouder dan 12 uur zijn vóór 12:00 neutraal ("telt vanaf 12:00").
  - De nieuwe tegel heet "Backorders die wij oplossen": voorraad hier, of een container die binnenkomt.
  - "Geen specifieke locatie" telt opgeboekte containervoorraad niet mee.
  - In het ritme staan de containerstappen op de juiste dag (vooraf, dag ervoor, losdag). Bij de Stockmove staat "wacht op opboeken door Jim" zolang de container niet is opgeboekt.
- **Locaties:**
  - Map = tussenniveau (AD, AD13, AD13C) of een bovenliggende locatie. Zelfgemaakte vloerplekken worden niet meer gemeld.
  - Hoog maar pick stelt bulk + tijdelijk voor. Alleen in AE/AF wordt "Blijft pick" voorgesteld, als het product daar gepickt wordt en geen andere picklocatie heeft.
  - Voorraad hier komt alleen uit de export.
  - Geteld, maar de nieuwe export toont nog voorraad: de regel gaat weer open en Kate krijgt een taak in `wh-todo`.
  - Nieuw blok "Wacht op lossen/Stockmove".
  - Verwerkte besluiten staan niet meer onder "Gaat niet mee".
- **Aanvullen (alleen in 3.0):**
  - Onder "bij": 1 volle pallet.
  - Orders vragen meer dan max: zoveel pallets als de orders vragen.
  - Pallet groter dan max: dozen plus de losse stuks (de test geeft 4 dozen + 3 los = 46).
  - Eerst het restje.

**Taak 3 — schattingen: deels.**
1. Klaar: de schattingsregels staan in de app (`wh/productdata.js`, `wh/pdfamilie.js`):
   - Palletmaat L×B×H per soort, alleen opslagmaten.
   - Aanvullen bij 1. Max op pick = bij + ± 2 weken verkoop.
   - Afwijkende Picqer-gewichten krijgen "klopt dit gewicht in Picqer?".
   - Mix geleverd = wisselt.
   - Per cm afronden op 50 cm; per meter alleen hele meters. Breder dan 170 cm (DPD) = alleen pallet.
   - Sportvloer/rubber op rol volgt de eenheid uit de productnaam.
   - Stuks per pallet uit vaste aantallen van bulk naar pick (retourkar telt niet).
2. Niet gedaan: de volledige Picqer-geschiedenis ophalen. De functie `picqer` vraagt een koppelcode die alleen op de apparaten staat; die zit niet in GitHub. Zonder de functie te wijzigen kan een workflow hem dus niet aanroepen. De app leert nu uit de 60 dagen in `wh-verplaatsingen`.
3. Niet gedaan: schattingen opnieuw wegschrijven. De versleutelde datakopie mocht in deze sessie niet worden aangevraagd (geweigerd door de beveiliging van de sessie). Zonder echte data kon ik niets herberekenen of controleren. Daarom zijn er **0 schattingen** naar de database geschreven (0 uit de geschiedenis). Er is niets overschreven. De app toont de nieuwe regels wel meteen als schatting in Productdata en Per familie.

## Testen
- Er was geen echte datakopie, dus de test liep op een emulator met verzonnen testdata en nep-livedata (picklijsten en backorders). Alle schrijfacties werden onderschept.
- **Regressie** vóór en na, met en zonder livedata: zichtbare tekst identiek, geen nieuwe `PAGEERROR`. Getest: `warehouse.html#/`, `#/aanvullen`, `junior.html#/`, `ploeg.html`, `containerplanning.html#/`, `index.html`, `productkaart.html`, `claude.html`.
- **Te controleren → Aannames:** de nieuwe groepen en alle chat-besluiten staan als ✓.
- **Dagstart om 09:00 en 13:00:** "orders ouder dan 12 uur" is neutraal → rood.
- **Aanvuladvies:** 4 dozen + 3 los (46); 3 pallets voor orders boven max; 1 pallet; eerst het restje.
- **Locaties:** de map, AE/AF-uitzondering, Kate-taak en het blok "wacht op lossen" werken.
- **Telefoon 390 px:** geen horizontaal scrollen.

## Nieuwe open aannames
- `k-bo2` "Backorders die wij oplossen": grens `1 · 5`.
- `p-kokos` "Grens breedte kokos doos/pallet": waarde leeg.
- `p-wbh` "Hoogte pallet grote whiteboards (maat bekend)": 140 cm. Past een board op geen van de vier grote maten, dan de kleinste opslagmaat.
- `p-gewafw` "Picqer-gewicht afwijkend": meer dan 2× of minder dan de helft van de familie.
- `p-gesch` "Leren uit de verplaatsingen": vast aantal ≥ 3× van bulk naar pick = volle pallet.
- `a-rest` "Na het restje": een volle pallet erbij alleen als de pick dan nog op of onder "bij" zit, of als de orders meer vragen.

## Voor Daan
1. Open 3.0 → **Te controleren** → tab **Aannames**. Bovenaan staat hoeveel er open zijn. Jouw besluiten uit de chat staan op ✓.
2. Loop de open regels door en tik **Klopt**, of pas de waarde aan. Typ een grens als `6.10`; eronder zie je meteen wat hij betekent.
3. Open **Dagstart**: vóór 12:00 is "Orders ouder dan 12 uur" grijs. De derde tegel heet nu "Backorders die wij oplossen".
4. Open **Locaties** → tegel **Hoog maar pick** of **Op een map** en controleer een paar regels.
5. Open **Aanvullen** → **Aanvulronde**: bij producten met "aanvullen met = pallet" staat nu pallets, dozen + los, of restje.
6. Moeten de herberekende schattingen ook in de database: dat kan in een volgende ronde met een nieuwe datakopie. Die mocht deze sessie niet aanvragen.

## Ronde 2 (laatste antwoorden van Daan, 16-10)

**1. Kerncijfer-grenzen: klaar.**
- `k-o24` `4 · 8`, `k-bo2` `5 · 10`, `k-nu` `5 · 11`, `k-taak` `4 · 6`, `k-geen` `26 · 76`, allemaal ✓ Daan (chat). De leestekst eronder volgt vanzelf, bijv. "0–3 goed · 4–7 let op · 8+ probleem".
- Nieuw: een besluit uit deze ronde gaat voor een keuze die je eerder in de app maakte (vóór 16-10 16:35). Anders bleef bijv. je oude app-waarde bij `k-geen` gelden. Kies je daarna iets in de app (Klopt, aanpassen of Opnieuw), dan telt dat weer. Je eerdere keuzes blijven in de catalog staan.

**2. Dagritme: klaar.**
- `d-01` is nu twee regels: Ochtendoverleg 08:00 · Daan, Karin, Kate en 09:00 · Daan, Kate, Sala. Je oude app-keuze bij `d-01` hoort bij de vervallen regel en telt niet meer.
- `d-03` 09:00–17:30 · orderpickers. `d-06` 12:00 · Daan blijft zo (✓). `d-10` 17:00–17:30 · Kate, Sala.
- Dagstart: het kopje van het ochtendoverleg komt nu uit deze regels. Hoe staat het ervoor: "planning staat" wordt oranje na 09:30 (was 07:30), en de einde-dag-check toont 17:00–17:30 (was 16:30). Hulp (vloer) noemt 08:00 en 09:00. Stappen met "einde dag" staan nu na 17:00. De VST-mail van Karin blijft 16:30.

**3. Productdata-schattingen: klaar.**
- `p-wbh`, `p-gewafw` en `a-rest`: ✓, waarde ongewijzigd.
- `p-gesch` volgt jouw regel (Productdata en Per familie):
  - 3× of vaker de hele voorraad van een bulklocatie naar pick: volle pallet. Dat aantal wordt de stuks per pallet.
  - 3× of vaker hetzelfde aantal, maar niet de hele voorraad: deel van een pallet. Max op pick = aanvullen bij + het gemiddelde.
  - De retourkar telt niet mee.
- "Hele voorraad" = de bulklocatie was daarna leeg. De bewaarde verplaatsingen hebben geen voorraad vóór de verplaatsing, dus rekent de app terug vanaf de voorraad-export. Klopt dat terugrekenen niet, dan telt de verplaatsing niet als hele voorraad.
- De app leert uit de 60 dagen in `wh-verplaatsingen`. Er zijn geen schattingen naar de database geschreven; dat vroeg deze ronde niet.

**4. Kokos doos of pallet: klaar.**
- `p-kokos` = "200 breed: lengte boven 200 cm = pallet; 100 breed: gewicht beslist; boven 30 kg altijd pallet" (✓). De getallen in die tekst stuurt de rekenregel. Pas je ze aan, dan rekent de app mee.
- In Productdata en Per familie wordt dat "max cm per doos" (afgerond op 50 cm); langer = pallet. De DPD-grens van 170 cm geldt niet meer voor kokos.
- Voorbeelden: 200 breed licht → max 200 cm; 200 breed zwaar (0,16 kg/cm) → 150 cm; 100 breed × 4 m × 35 kg → max 300 cm, dus pallet.
- Zonder gewicht: 200 breed krijgt 200 cm als onzeker voorstel; 100 breed krijgt geen voorstel. Je eigen taak blijft: controleren of dit de vaste richtlijn is.

**5. Cut-off: niets gebouwd** (zoals gevraagd; `d-09` blijft vervallen).

**Testen**
- Emulator met verzonnen testdata: nep-livedata en nep-verplaatsingen, alle schrijfacties onderschept.
- Regressie vóór en na elk onderdeel op `warehouse.html#/`, `#/aanvullen`, `junior.html#/`, `ploeg.html`, `containerplanning.html#/`, `index.html`, `productkaart.html` en `claude.html`: zichtbare tekst identiek, geen `PAGEERROR`.
- Gecontroleerd:
  - Tegelkleuren bij 3/4/8 (picklijsten), 4/5/11 (nu verplaatsen) en 3/4/6 (taken).
  - Een oude app-keuze telt niet meer, een nieuwere wel.
  - Ritme, kopje en "planning staat" om 09:20 en 09:40.
  - Volle pallet, deel met gemiddelde, en de retourkar telt niet.
  - Kokos 100/200 breed, licht en zwaar.
  - Telefoon 390 px zonder horizontaal scrollen.

**Nog open in Te controleren:** in de code staan alle 48 aannames op ✓. Open is alleen nog wat jij zelf in de app op **Opnieuw** zette; dat kan ik niet zien.

**Voor Daan**
1. Open 3.0 → **Te controleren** → tab **Aannames**. Bovenaan staat hoeveel er open zijn.
2. Kerncijfers: onder elke grens staat de leestekst, bijv. "0–25 goed · 26–75 let op · 76+ probleem".
3. Open **Dagstart**: het ritme begint met overleg om 08:00 en 09:00; picken staat op 09:00–17:30 en einde dag op 17:00–17:30.
4. Open **Productdata** of **Per familie** bij kokos: bij stuks per doos staat de max cm per doos met de reden.
5. Klopt een besluit uit de chat toch niet: tik **Opnieuw** of pas de waarde aan; jouw keuze in de app gaat dan weer voor.
