# Hosting: Cloudflare Pages + Render (gratis)

Reihenfolge: erst Render, dann Cloudflare, dann die Adressen in Render nachtragen.

## 1. Backend auf Render
New, Blueprint, Repo wählen (`render.yaml`). Variablen zunächst leer lassen. Die Adresse notieren, zum Beispiel `https://abholdemo-api.onrender.com`.

## 2. Zwei Projekte auf Cloudflare Pages
Beide aus demselben Repo (Workers & Pages, Create, Pages, Connect to Git). Root directory leer lassen.

| | betrieb | kunde |
|---|---|---|
| Build command | `npm ci && npm run build -w @abholdemo/betrieb` | `npm ci && npm run build -w @abholdemo/kunde` |
| Output directory | `apps/betrieb/dist` | `apps/kunde/dist` |

Variablen bei beiden: `NODE_VERSION` = `20`, `VITE_API_URL` = Render Adresse, `VITE_KUNDE_URL` = Pages Adresse der Kundenwebsite.

## 3. Render Variablen nachtragen
- `KUNDE_URL` = Pages Adresse der Kundenwebsite
- `CORS_ORIGINS` = beide Pages Adressen, kommagetrennt
- `DATABASE_URL` = nur wenn Änderungen Neustarts überleben sollen (Supabase, Session pooler)

Danach Pages neu deployen, weil `VITE_*` beim Build eingebaut wird.

Hinweise: Render schläft nach 15 Minuten, der erste Aufruf dauert etwa eine Minute. Fotos liegen auf der Platte und sind nach einem Neustart weg.
