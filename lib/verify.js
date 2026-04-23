import { downloadMedia } from './uazapi.js';

const GEMINI_KEY      = process.env.GEMINI_API_KEY;
const EXPECTED_VALUE  = process.env.PIX_VALUE;
const EXPECTED_NAME   = process.env.PIX_RECIPIENT_NAME;

export async function verifyPaymentProof({ url, base64Already, mimeType }) {
  const base64 = base64Already ?? (await downloadMedia(url));
  const mediaType = mimeType ?? 'image/jpeg';

  const hoje = new Date().toLocaleDateString('pt-BR');
  const ontem = new Date(Date.now() - 86400000).toLocaleDateString('pt-BR');

  const prompt = `Você é um verificador de comprovantes Pix. Responda APENAS com JSON:
{
  "valid": true ou false,
  "value_found": "valor encontrado ou null",
  "recipient_found": "nome encontrado ou null",
  "date_found": "data encontrada ou null",
  "reason": "motivo se inválido ou null"
}

Critérios para VÁLIDO:
1. Valor exatamente R$ ${EXPECTED_VALUE}
2. Destinatário contém "${EXPECTED_NAME}"
3. Data é ${hoje} ou ${ontem}
4. Parece um comprovante Pix real e não editado`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mediaType, data: base64 } },
            { text: prompt }
          ]
        }]
      }),
    }
  );

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

  try {
    const result = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    console.log('Verificação:', result);
    return result.valid === true;
  } catch {
    return false;
  }
}
