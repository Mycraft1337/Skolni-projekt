# MindTrack v3.1

Denní zápis sociálních sítí, následujícího spánku a nálady. Stres, soustředění a volné poznámky se nesbírají. Datum označuje den používání sítí a nálady; spánek patří k noci, která po tomto dni následovala. Vyplňuje se ráno.

## Stav

Databáze je připravená a Anonymous Sign-Ins byly zapnuty. Před sběrem dat zbývá ověřit celý tok v prohlížeči. Verze 3 otevírá rovnou zápis, pět otázek je na jedné stránce, čas se vybírá dvěma kolečky vedle sebe (hodiny a minuty). Den obsahuje čas na sítích a náladu, druhý blok obsahuje večerní používání a spánek s konkrétními daty noci. Rozpracovaný formulář přežije obnovení stejné karty. Po uložení je dostupná oprava.

Nové večerní odpovědi jsou Ano/Ne (`before_bed`); starší `bed_minutes` zůstávají zachované. CSV obsahuje oddělené sloupce a verzi záznamu. Staré minuty se automaticky nepřevádějí na přímé odpovědi. Použij také migraci evening_yes_no; na existujícím projektu byla již provedena. Kontroly validace, importu/exportu, DOM formuláře a databázových omezení prošly; úplný vizuální a živý synchronizační test dosud neproběhl.

Advisors upozorňují na povolené anonymní účty (záměr; RLS nadále omezuje přístup na vlastní user_id) a vypnutou ochranu uniklých hesel (aplikace hesla nepoužívá). Viz https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins a https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Supabase

1. Projekt: `rukeziypxobbwzrjnlqj` (již existující projekt autora).
2. Spustit `supabase/migrations/202611050001_mindtrack_v2.sql` jednou na tomto projektu.
3. V Authentication → Sign In / Providers povolit Anonymous Sign-Ins.
4. `config.js` obsahuje pouze veřejnou adresu a veřejný publishable key. Nikdy sem nevkládat service_role ani secret key.
5. Každý účastník má vlastní Supabase Auth ID. RLS omezuje čtení, změny a mazání na jeho vlastní řádky. Autor vyhodnocuje data z dashboardu Supabase, nikoli přes veřejný administrátorský klíč ve webu.

Nový uživatel má automatické odesílání po uložení; u formuláře je informace o příjemci a účelu a odkaz na vypnutí odesílání. Nevyskakuje potvrzovací dialog. Samotné otevření aplikace nevytváří účet. Dřívější vypnutí sdílení u existujících uživatelů zůstává zachované. Opětovné zapnutí odešle i dosavadní místní záznamy. Verze informace je u nového účastníka označena 2026-11-v3-auto-notice; neznamená souhlas zaškrtnutím políčka. Přiložená migrace automatic_sharing_notice byla na existujícím projektu aplikována. Opravy využívají upsert podle účastníka a dne. Neodeslané změny zůstávají místně pro další pokus. Pozastavení nezničí již odeslaná data. Ukončení účasti smaže řádek účastníka a kaskádově jeho záznamy; místní kopie zůstává.

Původní v1 data se automaticky nepřevádějí, protože měla jiné časové přiřazení spánku. Lze je samostatně stáhnout. Nemíchat je s v2 výzkumem.

## Spuštění a ověření

`python3 -m http.server 8000` a otevřít `/`.

Ověřit zápis, opravu, export, import v2, výpadek internetu a opakované odeslání bez duplicit. Dva prohlížeče musí představovat dva oddělené účastníky. Po smazání dat prohlížeče nelze obnovit původní anonymní přihlášení jen ze zálohy záznamů.

Počet účastníků, doba sledování a doba uchování údajů dosud nejsou určeny. Před sběrem je musí autor sdělit účastníkům.

Kontroly v3.1: volba koleček, klávesnice, obnovení při editaci a rozpracovaný formulář; automatické odeslání přes mock adaptér a respektování vypnutého sdílení; databázový test obou verzí informace. Skutečný mobilní prohlížeč je ještě potřeba ověřit.

## Sleep units (v3.1.1)
For analysis use `social_minutes` and `sleep_minutes`: both contain total whole minutes. `sleep_minutes` is generated automatically for existing and future rows, including edits. `sleep_hours` remains for compatibility with existing clients; do not write to the generated column. 13.37 decimal hours corresponds to approximately 802 minutes, not 13 h 37 min. The app CSV uses `nasledujici_spanek_min`. The wheel UI and local backup format remain unchanged. Migration sleep_minutes was applied on 2026-11-07. Every whole-minute duration from 0 to 1440 was checked for round-trip conversion through numeric(4,2).

## v4: samostatný ranní a večerní zápis

Denní zápis otevře dvě karty pro vybraný den vyplňování (výchozí: dnes).
Ráno: délka a kvalita uplynulého spánku, sítě v poslední hodině před usnutím Ano/Ne.
Večer: čas na sítích a nálada za vybraný den. Hodiny/minuty zůstávají na dvou kolečkách.
Obě části se ukládají a automaticky odesílají nezávisle; lze je také zpětně doplnit nebo upravit.
Předchozí vypnutí odesílání zůstává respektováno.

`day` v databázi i CSV stále označuje den sociálních sítí/nálady; ranní zápis dne D patří k řádku D−1.
Například pondělní večer a úterní ráno tvoří jeden výzkumný řádek.
Chybějící část má NULL (v CSV prázdná pole), nikoli nuly. Statistiky ignorují chybějící hodnoty;
postřehy používají úplné dvojice. Nula minut zůstává platnou odpovědí.
Večerní čas je stav při vyplnění: další používání před usnutím může nastat až potom,
proto se ranní Ano nekontroluje proti večerní nule. Pro výzkum jde o omezení měření.
Doporučení účastníkům: večerní záznam vyplňovat co nejblíže konci dne.

Migrace `20261107104750_split_checkins.sql` je už aplikovaná v připojeném projektu.
Rozšiřuje dosavadní tabulku o možnost chybějící poloviny, zachovává data, generované
`sleep_minutes`, RLS i kompatibilitu stávající aplikace. Při novém nasazení použij migrace v pořadí.
Místní klíč úložiště zůstává v2; import čte zálohy 2/3/4, nové exporty mají verzi 4.

Ověření:
- `node tests/checkins.cjs`
- `NODE_PATH=/cesta/k/node_modules node tests/checkins-ui.cjs` (jsdom 26.1.0)
- Databázový test částečných řádků, doplnění druhé poloviny, NULL a odmítnutí nedokončené noci proběhl v transakci s rollbackem.
- Testy DOM používají mock cloudového přenosu. Vizuální/touch test na skutečném telefonu je ještě potřeba; automatický Chromium download v pracovním prostředí selhal na neúplném ZIP.

### Možnosti připomínek (zatím neimplementováno)

Web Push funguje i při zavřené aplikaci. Na iPhonu/iPadu musí být web přidaný na plochu
(iOS/iPadOS 16.4+) a uživatel musí aktivně povolit oznámení.
Samotný statický GitHub Pages neumí plánovat serverové odesílání.
Pro další implementaci je potřeba: přihlášení k Push API, uložení odběru s RLS,
serverová funkce s privátním VAPID klíčem a plánovač, uživatelská volba ranního/večerního času
s časovým pásmem a možnost vypnutí. Připomínky by měly vynechat již vyplněnou část;
oznámení nemají obsahovat odpovědi účastníka. Nestačí `setTimeout` nebo interval v otevřené stránce.

Zdroje:
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- https://developer.mozilla.org/en-US/docs/Web/API/Push_API
