// lib/kv.js
// Funções simples para guardar/ler dados do Vercel KV (banco gratuito da Vercel)
// Cada lead tem um "estado" que controla em qual etapa da conversa ele está.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

// Lê um valor do banco pelo nome da chave
export async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result ?? null;
}

// Salva um valor no banco
// ttlSegundos = tempo até expirar (opcional)
export async function kvSet(key, value, ttlSegundos) {
  let url = `${KV_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
  if (ttlSegundos) url += `?ex=${ttlSegundos}`;

  await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}
