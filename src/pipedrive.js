const BASE = 'https://api.pipedrive.com/v1';

function hasPipedriveCreds() {
  const token = process.env.PIPEDRIVE_API_TOKEN;
  return !!(token && token.trim());
}

async function pdFetch(path, params = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('api_token', process.env.PIPEDRIVE_API_TOKEN);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Pipedrive ${resp.status} ${resp.statusText}`);
  const json = await resp.json();
  if (!json.success) throw new Error(json.error || 'Error de Pipedrive');
  return json;
}

async function fetchAllPaged(path, params = {}) {
  let all = [];
  let start = 0;
  while (true) {
    const json = await pdFetch(path, { ...params, limit: 500, start });
    if (!Array.isArray(json.data) || !json.data.length) break;
    all = all.concat(json.data);
    start += 500;
    if (!json.additional_data?.pagination?.more_items_in_collection) break;
  }
  return all;
}

async function fetchAllDeals() {
  return fetchAllPaged('/deals', {
    status: 'all_not_deleted',
    pipeline_id: process.env.PIPEDRIVE_PIPELINE_ID || undefined,
  });
}

let _stageCache = null;
async function fetchStageMap() {
  if (_stageCache) return _stageCache;
  const json = await pdFetch('/stages', { pipeline_id: process.env.PIPEDRIVE_PIPELINE_ID || undefined });
  const stages = json.data || [];
  _stageCache = Object.fromEntries(stages.map((s) => [s.id, s.name]));
  return _stageCache;
}

function formatMoney(value, currency) {
  if (value == null || value === '') return '–';
  return `$${Number(value).toLocaleString('es-MX')} ${currency || ''}`.trim();
}

function inRange(dateStr, startDate, endDate) {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= startDate && d <= endDate;
}

// 1. SQLs creados y deals ganados en un rango de fechas
async function getSQLsYGanados(startDate, endDate) {
  if (!hasPipedriveCreds()) return 'Pipedrive no está configurado (falta PIPEDRIVE_API_TOKEN).';

  const deals = await fetchAllDeals();
  const fieldCalSQL = process.env.PIPEDRIVE_FIELD_CALIFICACION_SQL || '';

  const isSQL = (d) => (fieldCalSQL ? d[fieldCalSQL] != null && d[fieldCalSQL] !== '' : false);

  const sqlDeals = deals.filter((d) => isSQL(d) && inRange(d.add_time, startDate, endDate));
  const wonDeals = deals.filter((d) => inRange(d.won_time, startDate, endDate));

  const wonTotal = wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const wonCurrency = wonDeals[0]?.currency || 'MXN';

  const lines = [];
  lines.push(`Periodo: ${startDate} a ${endDate}`);
  lines.push('');
  lines.push(`SQLs creados: ${sqlDeals.length}`);
  for (const d of sqlDeals.slice(0, 25)) {
    lines.push(`- ${d.title || '(sin título)'} (${formatMoney(d.value, d.currency)}) — responsable: ${d.owner_name || '–'}`);
  }
  if (sqlDeals.length > 25) lines.push(`... y ${sqlDeals.length - 25} más`);

  lines.push('');
  lines.push(`Deals ganados: ${wonDeals.length} (total ${formatMoney(wonTotal, wonCurrency)})`);
  for (const d of wonDeals.slice(0, 25)) {
    lines.push(`- ${d.title || '(sin título)'} (${formatMoney(d.value, d.currency)}) — responsable: ${d.owner_name || '–'}, cerrado: ${(d.won_time || '').slice(0, 10)}`);
  }
  if (wonDeals.length > 25) lines.push(`... y ${wonDeals.length - 25} más`);

  return lines.join('\n');
}

// 2. Actividades del equipo (productividad) en un rango de fechas
async function getActividadesEquipo(startDate, endDate) {
  if (!hasPipedriveCreds()) return 'Pipedrive no está configurado (falta PIPEDRIVE_API_TOKEN).';

  const activities = await fetchAllPaged('/activities', {
    user_id: 0,
    start_date: startDate,
    end_date: endDate,
  });

  const byUser = {};
  for (const a of activities) {
    const owner = a.owner_name || `Usuario ${a.user_id || '–'}`;
    if (!byUser[owner]) byUser[owner] = { total: 0, done: 0, pending: 0, types: {} };
    byUser[owner].total++;
    if (a.done) byUser[owner].done++;
    else byUser[owner].pending++;
    const type = a.type || 'otro';
    byUser[owner].types[type] = (byUser[owner].types[type] || 0) + 1;
  }

  const lines = [];
  lines.push(`Periodo: ${startDate} a ${endDate}`);
  lines.push(`Total de actividades: ${activities.length}`);
  lines.push('');

  const users = Object.entries(byUser).sort((a, b) => b[1].total - a[1].total);
  if (!users.length) {
    lines.push('No se encontraron actividades en este periodo.');
  }
  for (const [owner, stats] of users) {
    const typesStr = Object.entries(stats.types)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');
    lines.push(`- ${owner}: ${stats.total} actividades (${stats.done} completadas, ${stats.pending} pendientes) — ${typesStr}`);
  }

  return lines.join('\n');
}

// 3. Status de un deal por título
async function getStatusDealPorTitulo(titulo) {
  if (!hasPipedriveCreds()) return 'Pipedrive no está configurado (falta PIPEDRIVE_API_TOKEN).';

  const json = await pdFetch('/deals/search', {
    term: titulo,
    fields: 'title',
    exact_match: false,
    limit: 10,
  });

  const items = json.data?.items || [];
  if (!items.length) return `No se encontró ningún deal con el título "${titulo}".`;

  const lines = [];
  lines.push(`Resultados para "${titulo}": ${items.length}`);
  for (const { item } of items.slice(0, 5)) {
    const detail = (await pdFetch(`/deals/${item.id}`)).data;
    const status = detail.status === 'won' ? 'Ganado' : detail.status === 'lost' ? 'Perdido' : 'Abierto';
    const stage = detail.stage_id ? (await fetchStageMap())[detail.stage_id] || `Etapa ${detail.stage_id}` : '–';
    lines.push(
      `- "${detail.title}" (ID ${detail.id}) — Status: ${status}, Etapa: ${stage}, Valor: ${formatMoney(detail.value, detail.currency)}, Responsable: ${detail.owner_name || '–'}`
    );
  }
  if (items.length > 5) lines.push(`... y ${items.length - 5} más`);

  return lines.join('\n');
}

module.exports = {
  hasPipedriveCreds,
  getSQLsYGanados,
  getActividadesEquipo,
  getStatusDealPorTitulo,
};
