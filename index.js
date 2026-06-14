require('dotenv').config();

const express = require('express');
const { createSlackApp } = require('./src/slack');
const { loadKnowledgeBase } = require('./src/knowledge');
const { setKnowledgeBase, getStats } = require('./src/claude');

const PORT = process.env.PORT || 3000;

async function main() {
  // Validar variables de entorno requeridas
  const required = ['ANTHROPIC_API_KEY', 'SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_APP_TOKEN'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Faltan variables de entorno: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Cargar base de conocimientos
  console.log('Cargando base de conocimientos...');
  const kb = await loadKnowledgeBase();
  setKnowledgeBase(kb);
  if (kb) {
    console.log(`Base de conocimientos cargada (${kb.length} caracteres).`);
  } else {
    console.log('No se encontraron documentos en /knowledge. El bot funcionará sin base de conocimientos.');
  }

  // Iniciar bot de Slack
  const slackApp = createSlackApp();
  await slackApp.start();
  console.log('Bot de Slack iniciado (Socket Mode).');

  // Servidor Express para health check y métricas
  const httpApp = express();
  httpApp.use(express.json());

  httpApp.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  httpApp.get('/stats', (_req, res) => {
    res.json(getStats());
  });

  httpApp.listen(PORT, () => {
    console.log(`Servidor HTTP escuchando en http://localhost:${PORT}`);
    console.log(`  GET /health  → estado del servicio`);
    console.log(`  GET /stats   → estadísticas de conversaciones`);
  });
}

main().catch((err) => {
  console.error('Error al iniciar el bot:', err);
  process.exit(1);
});
