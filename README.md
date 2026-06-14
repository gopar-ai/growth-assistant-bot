# Slack Assistant Bot

Bot de Slack con inteligencia artificial usando Claude (Anthropic). Responde preguntas en DMs y menciones de canal, con soporte para una base de conocimientos personalizada.

## Características

- Responde en DMs y canales (vía `@bot`)
- Mantiene contexto de conversación por usuario
- Base de conocimientos desde archivos `.txt`, `.md` y `.pdf`
- Integración con Pipedrive: SQLs y deals ganados por periodo, actividades del equipo (productividad) y status de un deal por título
- Health check y estadísticas vía HTTP

## Requisitos

- Node.js >= 18
- Cuenta de Anthropic con API Key
- Slack App configurada con Socket Mode

## Configuración de la Slack App

1. Ve a [api.slack.com/apps](https://api.slack.com/apps) y crea una nueva app desde cero.

2. En **OAuth & Permissions → Bot Token Scopes**, agrega:
   - `chat:write`
   - `reactions:write`
   - `reactions:read`
   - `im:history`
   - `im:read`
   - `channels:history`
   - `app_mentions:read`

3. En **Event Subscriptions → Subscribe to bot events**, agrega:
   - `message.im`
   - `app_mention`

4. En **Socket Mode**, activa Socket Mode y genera un **App-Level Token** con scope `connections:write`. Este es tu `SLACK_APP_TOKEN`.

5. Instala la app en tu workspace y copia el `Bot User OAuth Token` (`SLACK_BOT_TOKEN`).

6. En **Basic Information**, copia el `Signing Secret` (`SLACK_SIGNING_SECRET`).

## Instalación

```bash
# Clonar e instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales
```

## Base de conocimientos

Coloca tus documentos en la carpeta `knowledge/`:

```
knowledge/
  manual-empresa.pdf
  preguntas-frecuentes.txt
  politicas.md
```

Los documentos se cargan al iniciar el bot. Para recargarlos, reinicia el proceso.

## Integración con Pipedrive

Si configuras las variables `PIPEDRIVE_*` (ver tabla abajo), el bot puede responder preguntas usando datos reales de Pipedrive:

- **SQLs y deals ganados**: "¿cuántos SQLs y deals ganados tuvimos del 1 al 14 de junio?"
- **Actividades del equipo (productividad)**: "¿cuántas actividades hizo el equipo esta semana?"
- **Status de un deal por título**: "¿cómo va el deal Madomex?"

Claude decide automáticamente cuándo consultar Pipedrive según la pregunta. Si no se configura `PIPEDRIVE_API_TOKEN`, esta funcionalidad se desactiva sin afectar el resto del bot.

## Uso

```bash
# Producción
npm start

# Desarrollo (recarga automática con Node.js --watch)
npm run dev
```

El bot estará disponible en Slack. También expone:
- `GET /health` → estado del servicio
- `GET /stats`  → estadísticas de conversaciones activas

## Comandos en Slack

| Comando | Dónde | Efecto |
|---------|-------|--------|
| Cualquier mensaje | DM | El bot responde |
| `@bot <pregunta>` | Canal | El bot responde en hilo |
| `!limpiar` | DM o mención | Borra el historial de esa conversación |

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key de Anthropic |
| `SLACK_BOT_TOKEN` | Token `xoxb-...` del bot |
| `SLACK_SIGNING_SECRET` | Signing secret de la Slack App |
| `SLACK_APP_TOKEN` | Token `xapp-...` para Socket Mode |
| `PORT` | Puerto HTTP (default: `3000`) |
| `PIPEDRIVE_API_TOKEN` | API token de Pipedrive (opcional, habilita la integración) |
| `PIPEDRIVE_PIPELINE_ID` | ID del pipeline a consultar |
| `PIPEDRIVE_FIELD_CALIFICACION_SQL` | Key del campo personalizado "Calificación SQL" |
