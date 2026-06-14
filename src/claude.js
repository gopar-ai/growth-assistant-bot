const Anthropic = require('@anthropic-ai/sdk');
const { getSQLsYGanados, getActividadesEquipo, getStatusDealPorTitulo, hasPipedriveCreds } = require('./pipedrive');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const conversations = new Map();
const MAX_HISTORY = 20;

let knowledgeBase = '';

function setKnowledgeBase(kb) {
  knowledgeBase = kb;
}

const PIPEDRIVE_TOOLS = [
  {
    name: 'consultar_sqls_y_ganados',
    description: 'Obtiene los SQLs (Sales Qualified Leads) creados y los deals/clientes ganados en un rango de fechas, desde Pipedrive.',
    input_schema: {
      type: 'object',
      properties: {
        fecha_inicio: { type: 'string', description: 'Fecha de inicio en formato YYYY-MM-DD' },
        fecha_fin: { type: 'string', description: 'Fecha de fin en formato YYYY-MM-DD' },
      },
      required: ['fecha_inicio', 'fecha_fin'],
    },
  },
  {
    name: 'consultar_actividades_equipo',
    description: 'Obtiene las actividades (llamadas, reuniones, tareas, etc.) del equipo de ventas en un rango de fechas, para medir productividad. Desde Pipedrive.',
    input_schema: {
      type: 'object',
      properties: {
        fecha_inicio: { type: 'string', description: 'Fecha de inicio en formato YYYY-MM-DD' },
        fecha_fin: { type: 'string', description: 'Fecha de fin en formato YYYY-MM-DD' },
      },
      required: ['fecha_inicio', 'fecha_fin'],
    },
  },
  {
    name: 'consultar_status_deal',
    description: 'Busca uno o varios deals en Pipedrive por su título y devuelve su status: etapa del pipeline, si está ganado/perdido/abierto, valor y responsable.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título o parte del título del deal a buscar' },
      },
      required: ['titulo'],
    },
  },
];

// Tool de búsqueda web nativa de Anthropic (ejecutada por Anthropic, no requiere implementación propia).
// El nombre "web_search" es fijo, requerido por la API.
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: 3,
};

async function executeTool(name, input) {
  try {
    switch (name) {
      case 'consultar_sqls_y_ganados':
        return await getSQLsYGanados(input.fecha_inicio, input.fecha_fin);
      case 'consultar_actividades_equipo':
        return await getActividadesEquipo(input.fecha_inicio, input.fecha_fin);
      case 'consultar_status_deal':
        return await getStatusDealPorTitulo(input.titulo);
      default:
        return `Herramienta desconocida: ${name}`;
    }
  } catch (err) {
    return `Error al consultar Pipedrive: ${err.message}`;
  }
}

function buildSystemPrompt() {
  let base = `1. Nombre y rol
Eres el asistente de Growth del equipo comercial. Conoces el negocio, el pipeline de ventas y el playbook comercial de memoria. No eres el asistente de una persona, sino del equipo completo: tratas a todos por igual y tu objetivo es ayudar a cerrar más y mejor, aumentar la productividad y eficiencia comercial, y capacitar al equipo.

2. Tono
Eres directo, empático y experto. Hablas como un colega senior que conoce el negocio de memoria — no como un manual corporativo. Usas lenguaje natural, concreto y sin rodeos. Siempre en español.
Puedes usar humor ligero y situacional cuando el contexto lo permita. Nunca forzado, nunca en temas sensibles como pérdida de deals o problemas del equipo.

3. Formato de respuestas
Escribe siempre en formato Slack nativo:
- Negritas con *texto*, nunca con **
- Listas con - o emojis, nunca con ## ni headers
- Respuestas cortas y escaneables, máximo 5-7 líneas salvo que pidan un resumen completo o se preste la conversación.

4. Emojis
Usa emojis con criterio — uno o dos por respuesta cuando aplique para dar contexto visual, no decoración. Ejemplos: 🎯 para objetivos, 📊 para datos, ⚠️ para alertas, ✅ para confirmaciones, 🔍 para búsquedas en CRM.
Emojis de expresión que funcionan bien:
- 😅 cuando algo es obvio o gracioso
- 🤔 cuando analiza algo complejo
- 💪 cuando da una recomendación fuerte
- 😬 cuando hay un dato preocupante
- 🎉 cuando hay un logro (deal ganado, meta cumplida)
- 👀 cuando encuentra algo interesante en los datos
La regla de oro: máximo 1 emoji de expresión por respuesta, y solo cuando el contexto lo justifica.

5. Lo que puedes hacer
- 📊 *Pipedrive en tiempo real:* SQLs, deals ganados, actividades del equipo, status de un deal por nombre
- 📚 *Base de conocimientos:* ICP, playbook, metodologías de ventas, etapas del embudo
- 🌐 *Búsqueda en internet:* noticias de competidores, precios de mercado, regulaciones, cualquier info externa actualizada
- 💬 *Consultas en tiempo real:* objeciones, criterios de calificación, qué hacer en cada etapa del pipeline
- 🔍 *Búsquedas rápidas:* "¿en qué etapa está el deal de X empresa?"
- 🗺️ *Flujos y esquemas:* visualizaciones en texto de procesos, embudos y metodologías cuando se soliciten

Cuando alguien te saluda o no sabe qué pedirte, preséntate brevemente y menciona 2-3 cosas concretas — no una lista exhaustiva.
Cuando uses búsqueda web, indica brevemente la fuente.

6. Reglas de oro
- Nunca uses ## ni headers de markdown
- Nunca uses ** para negritas, siempre *
- Nunca termines con una pregunta genérica
- Si la respuesta es un dato de Pipedrive, empieza directo con el dato
- Si es una explicación, empieza con la idea principal, no con "Claro, con gusto..."
- Varía la estructura de respuesta según el contexto — no sigas siempre el mismo patrón`;

  if (hasPipedriveCreds()) {
    base += `\n\nHoy es ${new Date().toISOString().slice(0, 10)}. Si te preguntan sobre SQLs, deals ganados o actividades sin especificar fechas, usa rangos razonables (por ejemplo, "este mes") y acláralo en tu respuesta.`;
  }

  if (!knowledgeBase) return base;
  return `${base}\n\nBase de conocimientos disponible:\n\n${knowledgeBase}`;
}

// Recorta el historial asegurando que siempre empiece con un mensaje de usuario
// que no sea un tool_result huérfano (la API de Anthropic lo requiere)
function trimHistory(history) {
  while (history.length > MAX_HISTORY) {
    history.shift();
    while (
      history.length &&
      (history[0].role !== 'user' ||
        (Array.isArray(history[0].content) && history[0].content.some((b) => b.type === 'tool_result')))
    ) {
      history.shift();
    }
  }
}

async function sendMessage(conversationId, userMessage) {
  if (!conversations.has(conversationId)) {
    conversations.set(conversationId, []);
  }

  const history = conversations.get(conversationId);
  history.push({ role: 'user', content: userMessage });
  trimHistory(history);

  const tools = [...(hasPipedriveCreds() ? PIPEDRIVE_TOOLS : []), WEB_SEARCH_TOOL];

  let response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: buildSystemPrompt(),
    messages: history,
    tools,
  });

  while (response.stop_reason === 'tool_use') {
    history.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const result = await executeTool(block.name, block.input);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }
    }
    history.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: buildSystemPrompt(),
      messages: history,
      tools,
    });
  }

  const assistantMessage = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  history.push({ role: 'assistant', content: response.content });
  trimHistory(history);

  return assistantMessage;
}

function clearHistory(conversationId) {
  conversations.delete(conversationId);
}

function getStats() {
  return {
    activeConversations: conversations.size,
    hasKnowledgeBase: knowledgeBase.length > 0,
    knowledgeBaseSize: knowledgeBase.length,
    pipedriveEnabled: hasPipedriveCreds(),
  };
}

module.exports = { sendMessage, setKnowledgeBase, clearHistory, getStats };
