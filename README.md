# Dietz Engineering Website

Statische Site für **patrick@dietz-engineering.com** — gehostet auf GitHub Pages,
gebaut mit [Eleventy](https://www.11ty.dev/), Inhalte gepflegt über Decap CMS.

Custom-Domain: **https://dietz-engineering.com**

---

## Wie editiere ich Inhalte?

> **In Vorbereitung** — Decap CMS wird in Phase 4 eingerichtet. Danach geht's so:

1. Auf `https://dietz-engineering.com/admin/` gehen
2. Mit GitHub einloggen
3. Im Admin-Bereich Texte, Bilder, Karten etc. editieren
4. Auf **Speichern** klicken
5. ~30 Sekunden warten, dann ist die Änderung live

Kein Terminal, kein Git, keine Code-Kenntnisse nötig.

---

## Wie ist das Repository aufgebaut?

```
.
├── package.json              ← npm-Dependencies (Eleventy)
├── .eleventy.js              ← Eleventy-Konfiguration
├── .gitignore                ← Was nicht in git eingecheckt wird
│
├── src/                      ← Quelldateien
│   ├── index.njk             ← Hauptseite (Nunjucks-Template)
│   ├── _data/                ← Inhaltsdaten (JSON/YAML, von Decap editiert)
│   ├── _includes/            ← Wiederverwendbare Template-Teile
│   └── static/               ← Statische Assets (Bilder, Logos, Legal-Seiten)
│       ├── hero-banner.png
│       ├── patrick-dietz.jpg (kommt noch)
│       ├── logo-*.svg
│       ├── agb.html
│       ├── datenschutz.html
│       ├── impressum.html
│       └── CNAME             ← Custom-Domain-Config für GitHub Pages
│
├── admin/                    ← Decap CMS Admin-Bereich (kommt in Phase 4)
│   ├── index.html
│   └── config.yml
│
├── .github/workflows/
│   └── build-and-deploy.yml  ← GitHub Actions: baut + deployt automatisch
│
└── _site/                    ← Build-Output (nicht in git, automatisch generiert)
```

---

## Wie funktioniert der Deploy?

Jeder Push zu `main` triggert automatisch:

1. **GitHub Actions** läuft an
2. Node.js + Eleventy werden installiert (~30 Sek)
3. `npx @11ty/eleventy` baut die Site aus `src/` nach `_site/`
4. `_site/` wird als Artifact zu GitHub Pages hochgeladen
5. **GitHub Pages** deployt → live auf `dietz-engineering.com`

Pushes auf `pre-release-test` werden gebaut (zum Test), aber **nicht deployt**.

---

## Lokales Entwickeln (optional, für Code-Änderungen)

> Brauchst du **nicht**, wenn du nur Inhalte über Decap CMS editierst.

```bash
npm install        # Eleventy installieren
npm run start      # Lokaler Dev-Server auf http://localhost:8080
npm run build      # Einmal-Build (Output in _site/)
```

---

## Status

| Phase | Was | Status |
|---|---|---|
| 1 | Eleventy Setup + GitHub Actions | ✅ |
| 2 | Inhalte in `_data/`-Dateien extrahieren | 🟡 in Arbeit |
| 3 | GitHub Pages Source auf "GitHub Actions" umstellen | ⏳ |
| 4 | Decap CMS Admin-Bereich | ⏳ |
| 5 | GitHub OAuth + Cloudflare Worker Proxy | ⏳ |
| 6 | End-to-End-Test | ⏳ |
