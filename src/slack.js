const { App } = require('@slack/bolt');
const { sendMessage, clearHistory } = require('./claude');

const BOT_MENTION_REGEX = /<@[A-Z0-9]+>/g;

async function addReaction(client, channel, ts, emoji) {
  try {
    await client.reactions.add({ channel, timestamp: ts, name: emoji });
  } catch {}
}

async function removeReaction(client, channel, ts, emoji) {
  try {
    await client.reactions.remove({ channel, timestamp: ts, name: emoji });
  } catch {}
}

async function handleChannelMention({ channel, user, ts, threadTs, text, client }) {
  const conversationId = `${channel}:${user}`;

  // Comando para limpiar historial desde un canal
  if (text.toLowerCase() === '!limpiar') {
    clearHistory(conversationId);
    await client.chat.postMessage({
      channel,
      text: `<@${user}> Historial borrado. ¿En qué puedo ayudarte?`,
      thread_ts: threadTs,
    });
    return;
  }

  await addReaction(client, channel, ts, 'thinking_face');

  try {
    const reply = await sendMessage(conversationId, text || '¡Hola! ¿En qué puedo ayudarte?');
    await client.chat.postMessage({
      channel,
      text: `<@${user}> ${reply}`,
      thread_ts: threadTs,
    });
  } catch (err) {
    console.error('Error en mención:', err.message);
    await client.chat.postMessage({
      channel,
      text: `<@${user}> Lo siento, ocurrió un error al procesar tu mensaje.`,
      thread_ts: threadTs,
    });
  } finally {
    await removeReaction(client, channel, ts, 'thinking_face');
  }
}

function createSlackApp() {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN,
  });

  // Mensajes directos (DM)
  app.message(async ({ message, say, client }) => {
    if (message.channel_type !== 'im' || message.bot_id || message.subtype) return;

    const text = (message.text || '').trim();

    // Comando para limpiar el historial
    if (text.toLowerCase() === '!limpiar') {
      clearHistory(message.user);
      await say('Historial borrado. Empezamos de cero. ¿En qué puedo ayudarte?');
      return;
    }

    if (!text) return;

    await addReaction(client, message.channel, message.ts, 'thinking_face');

    try {
      const reply = await sendMessage(message.user, text);
      await client.chat.postMessage({ channel: message.channel, text: reply });
    } catch (err) {
      console.error('Error en DM:', err.message);
      await client.chat.postMessage({ channel: message.channel, text: 'Lo siento, ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo.' });
    } finally {
      await removeReaction(client, message.channel, message.ts, 'thinking_face');
    }
  });

  // Menciones en canales (@bot mensaje) — solo se dispara si app_mention está suscrito
  app.event('app_mention', async ({ event, client }) => {
    if (event.bot_id || event.subtype) return;

    const text = (event.text || '').replace(BOT_MENTION_REGEX, '').trim();
    await handleChannelMention({
      channel: event.channel,
      user: event.user,
      ts: event.ts,
      threadTs: event.thread_ts || event.ts,
      text,
      client,
    });
  });

  return app;
}

module.exports = { createSlackApp };
