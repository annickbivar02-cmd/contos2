const BASE_URL = process.env.UAZAPI_URL;
const INSTANCE  = process.env.UAZAPI_INSTANCE;
const TOKEN     = process.env.UAZAPI_TOKEN;

export async function sendText(to, text) {
  const number = to.replace('@s.whatsapp.net', '').replace('@g.us', '');

  const res = await fetch(`${BASE_URL}/message/sendText/${INSTANCE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: TOKEN,
    },
    body: JSON.stringify({
      number,
      textMessage: { text },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('UazAPI erro ao enviar mensagem:', err);
  }
}

export async function downloadMedia(mediaUrl) {
  const res = await fetch(mediaUrl, {
    headers: { apikey: TOKEN },
  });

  if (!res.ok) throw new Error(`Falha ao baixar mídia: ${res.status}`);

  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}
