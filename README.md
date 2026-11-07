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
