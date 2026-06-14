# Bot asistente de Growth

Bot de Slack con IA para equipos comerciales: responde preguntas en lenguaje natural usando datos en tiempo real del CRM, una base de conocimientos interna y búsqueda web.

## Cómo funciona

```
Usuario (Slack: DM o @mención en canal)
     │
     ▼
Slack Bot (Bolt + Socket Mode)
     │
     ▼
Claude (Anthropic, con tool use)
     │
     ├─► CRM API          ──► SQLs y deals ganados, actividades del equipo, status de un deal
     ├─► Web Search        ──► noticias, precios de mercado, regulaciones actualizadas
     └─► Base de conocimientos (/knowledge) ──► ICP, playbook, metodologías de ventas
     │
     ▼
Respuesta en Slack (hilo o DM)
```

<img width="548" height="455" alt="FireShot Capture 521 - Detector (Mensajes directos) - Detecta - 3 elementos nuevos - Slack_ -  app slack com" src="https://github.com/user-attachments/assets/6fe055ce-4e93-41fb-b024-d4d75d4d1e65" />

El bot decide automáticamente cuándo consultar el CRM, buscar en internet o usar la base de conocimientos según la pregunta del usuario.

## Features

- *CRM en tiempo real:* SQLs y deals ganados por periodo, actividades del equipo (productividad), status de un deal por título
- *Base de conocimientos propia:* ICP, playbook y metodologías de venta desde archivos `.txt` y `.md`
- *Búsqueda web automática:* noticias, precios de mercado y regulaciones, citando la fuente
- *Contexto por usuario:* mantiene historial de conversación en DMs y menciones de canal
- *Health check y estadísticas* vía HTTP

<img width="1400" height="1040" alt="assistant" src="https://github.com/user-attachments/assets/08b9657d-3c24-4a1b-a2cb-f4bc42382b3b" />

## Setup

```bash
npm install
cp .env.example .env   # completa tus credenciales
npm start
```

## Variables de entorno

| Variable | Descripción |
|---|---|
| `ANTHROPIC_API_KEY` | API key de Anthropic |
| `SLACK_BOT_TOKEN` / `SLACK_SIGNING_SECRET` / `SLACK_APP_TOKEN` | Credenciales de la Slack App (Socket Mode) |
| `PORT` | Puerto HTTP (default: `3000`) |
| `PIPEDRIVE_API_TOKEN` / `PIPEDRIVE_PIPELINE_ID` / `PIPEDRIVE_FIELD_CALIFICACION_SQL` | Credenciales del CRM (opcional) |

## Tech stack

- **Anthropic Claude (Haiku 4.5)** — modelo conversacional con tool use
- **Slack Bolt + Socket Mode** — integración con Slack
- **CRM API (Pipedrive)** — datos comerciales en tiempo real
- **Anthropic Web Search** — búsqueda web nativa con citas
- **Node.js / Express** — backend y health checks
- **Railway** — deploy
