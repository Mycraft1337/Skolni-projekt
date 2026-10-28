# MindTrack — PWA prototyp (v1)

Responzivní školní prototyp pro sledování vlastních návyků v oblasti sociálních sítí, spánku a subjektivní pohody.

## Funkce
- Denní záznam: čas na sociálních sítích, používání před spaním, délka/kvalita spánku, nálada, stres a soustředění.
- Přehled posledních 7 dní a SVG graf bez externí knihovny.
- Orientační textové souhrny.
- Historie, úprava a mazání záznamů.
- Export CSV, záloha/import JSON.
- Lokální ukládání pomocí `localStorage`.
- Manifest a Service Worker pro PWA/offline cache.

## Spuštění
PWA funkce (instalace a Service Worker) vyžadují `localhost` nebo HTTPS. Samotný web lze pro rychlý náhled otevřít jako `index.html`, ale pro testování všech PWA funkcí doporučujeme lokální server.

### Nejjednodušší varianta s Pythonem
Ve složce projektu spusť:
```bash
python3 -m http.server 8000
```
Pak na stejném počítači otevři `http://localhost:8000`.

### Test na iPhonu
Pro otevření na iPhonu je potřeba projekt zveřejnit na HTTPS hostingu (např. GitHub Pages nebo Netlify), případně spustit server v lokální síti a použít HTTPS pro plné PWA funkce. Potom otevři URL v Safari → Sdílet → Přidat na plochu.

## Data a soukromí
Data se ukládají v `localStorage` konkrétního prohlížeče a webové adresy. Automaticky se nesynchronizují mezi iPhonem a počítačem. Smazání dat webu může záznamy odstranit; pravidelně používej JSON zálohu. Nezadávej do školního prototypu citlivé informace, které nechceš mít uložené v prohlížeči.

## Limity
- Aplikace neměří automaticky čas strávený v jiných aplikacích.
- Textové postřehy jsou popisné a nejsou zdravotní diagnózou ani důkazem příčinné souvislosti.
- Pro reálné použití je potřeba důkladně otestovat import/export, validaci, offline chování a kompatibilitu prohlížečů.
