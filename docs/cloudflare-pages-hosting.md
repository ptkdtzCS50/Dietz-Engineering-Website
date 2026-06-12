# DIETZ Website auf Cloudflare Pages hosten

Ziel: denselben aktuellen Website-Stand wie `dietz-engineering.com` separat auf Cloudflare Pages hosten und anschließend eine zweite Cloudflare-Domain direkt darauf legen.

## Stand

- Quelle: `Dietz-Engineering-Website`
- Build: Eleventy → `_site/`
- Projektvorschlag Cloudflare Pages: `dietz-engineering-website`
- Build command: `npm run build`
- Output directory: `_site`

## Wichtig für Chatbot / Telegram-Handoff

Die statische Website kann sofort über Cloudflare Pages ausgeliefert werden. Der Aria-/Telegram-Handoff ruft aber den Supabase Edge Function Endpoint auf:

```text
https://syngygsidzrwrnjrxlbt.supabase.co/functions/v1/assistant
```

Die Supabase Function nutzt eine Origin-Allowlist über `ASSISTANT_ALLOWED_ORIGIN`. Für die zweite Domain muss dort ergänzt werden:

```text
https://NEUE-DOMAIN.example,https://www.NEUE-DOMAIN.example
```

Bestehende Origins für `dietz-engineering.com` nicht entfernen.

## CLI-Deploy

Einmal lokal in Cloudflare einloggen:

```bash
npx wrangler login
```

Dann deployen:

```bash
CLOUDFLARE_PAGES_PROJECT=dietz-engineering-website \
CLOUDFLARE_PAGES_BRANCH=main \
bash scripts/deploy_cloudflare_pages.sh
```

Das Script macht:

1. `npm run build`
2. Website-Smoke-Tests für Chatbot, Telegram-Handoff, Operator-Seite, Customer-Care und Bildfix
3. Wrangler-Auth-Check
4. `npx wrangler pages deploy _site --project-name dietz-engineering-website --branch main`

## Cloudflare Dashboard Schritte

Wenn das Pages-Projekt noch nicht existiert:

1. Cloudflare Dashboard → Workers & Pages → Create → Pages
2. Entweder GitHub-Repo verbinden oder per Wrangler Direct Upload deployen
3. Project name: `dietz-engineering-website`
4. Build command: `npm run build`
5. Output directory: `_site`

Custom Domain verbinden:

1. Pages-Projekt öffnen
2. Custom domains → Set up a custom domain
3. Zweite Domain eintragen
4. Cloudflare legt den nötigen DNS Record automatisch an
5. SSL/HTTPS aktiv lassen

## Verifikation nach Deploy

Für die neue Domain prüfen:

```bash
python3 - <<'PY'
from urllib.request import Request, urlopen
DOMAIN='https://NEUE-DOMAIN.example'
for path in ['/', '/assistant-config.js', '/operator-reply/', '/customer-care/']:
    url=DOMAIN+path
    req=Request(url, headers={'User-Agent':'DIETZ-smoke'})
    with urlopen(req, timeout=15) as r:
        body=r.read(200000).decode('utf-8','ignore')
        print(url, r.status, r.headers.get('content-type'), len(body))
        for marker in ['DIETZ_ASSISTANT_CONFIG','sendAssistantLead','Herr Dietz','Telegram']:
            if marker in body:
                print('  marker', marker)
PY
```

Wenn die Seiten laden, aber Chat/Handoff fehlschlägt: zuerst `ASSISTANT_ALLOWED_ORIGIN` in Supabase ergänzen und die Function neu deployen bzw. Env aktualisieren.
