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
