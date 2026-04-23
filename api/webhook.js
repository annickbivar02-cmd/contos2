import { kvGet, kvSet } from '../lib/kv.js';
import { sendText } from '../lib/uazapi.js';
import { verifyPaymentProof } from '../lib/verify.js';

const ESTADOS = {
  AGUARDANDO_PAGAMENTO: 'aguardando_pagamento',
  ENTREGUE: 'entregue',
};

export default async function handler(req, res) {
  res.status(200).json({ ok: true });
  if (req.method !== 'POST') return;

  try {
    const body = req.body;

    // Ignora mensagens enviadas pelo próprio bot
    if (body?.wasSentByApi === true) return;
    // Ignora grupos
    if (body?.isGroup === true) return;

    const from = body?.sender_pn || body?.from;
    if (!from) return;

    const tipo = body?.type;
    const estado = await kvGet(`estado:${from}`);

    if (tipo === 'text') {
      await handleTexto(from, body?.content ?? body?.text ?? '', estado);
    } else if (tipo === 'image') {
      await handleComprovante(from, {
        url: body?.mediaUrl,
        base64Already: body?.mediaBase64 ?? null,
        mimeType: body?.mimeType ?? 'image/jpeg',
      }, estado);
    } else if (tipo === 'document') {
      const mime = body?.mimeType ?? '';
      if (!mime.includes('pdf')) {
        await sendText(from, 'Por favor, envie o comprovante como *foto* ou *PDF*. 📎');
        return;
      }
      await handleComprovante(from, {
        url: body?.mediaUrl,
        base64Already: body?.mediaBase64 ?? null,
        mimeType: 'application/pdf',
      }, estado);
    } else {
      if (estado === ESTADOS.AGUARDANDO_PAGAMENTO) {
        await sendText(from, '😊 Estou aguardando seu comprovante! Envie como *foto* ou *PDF*.');
      }
    }
  } catch (err) {
    console.error('Erro no webhook:', err);
  }
}

async function handleTexto(from, texto, estado) {
  if (estado === ESTADOS.ENTREGUE) {
    await sendText(from,
      `✨ Você já recebeu *${process.env.CONTO_TITLE}*!\n\n` +
      `Aqui está o link novamente: ${process.env.CONTENT_URL}`
    );
    return;
  }

  await kvSet(`estado:${from}`, ESTADOS.AGUARDANDO_PAGAMENTO, 86400);

  await sendText(from,
    `Olá! 👋 Seja bem-vinda!\n\n` +
    `Você está a um passo de receber *${process.env.CONTO_TITLE}*. 📖\n\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `💰 *Valor:* R$ ${process.env.PIX_VALUE}\n` +
    `🔑 *Chave Pix:* ${process.env.PIX_KEY}\n` +
    `👤 *Destinatário:* ${process.env.PIX_RECIPIENT_NAME}\n` +
    `━━━━━━━━━━━━━━━━━\n\n` +
    `Após o Pix, envie o *comprovante* (foto ou PDF) e a entrega é automática! ✅`
  );
}

async function handleComprovante(from, { url, base64Already, mimeType }, estado) {
  if (estado === ESTADOS.ENTREGUE) {
    await sendText(from, `✨ Você já recebeu seu conto! Aqui está o link: ${process.env.CONTENT_URL}`);
    return;
  }

  await sendText(from, '⏳ Recebi! Estou verificando seu comprovante...');

  const valido = await verifyPaymentProof({ url, base64Already, mimeType });

  if (valido) {
    await kvSet(`estado:${from}`, ESTADOS.ENTREGUE, 86400 * 30);
    await sendText(from,
      `✅ *Pagamento confirmado!*\n\n` +
      `📖 *${process.env.CONTO_TITLE}*\n` +
      `🔗 ${process.env.CONTENT_URL}\n\n` +
      `Boa leitura! 🌙✨`
    );
  } else {
    await sendText(from,
      `❌ Não consegui confirmar este pagamento.\n\n` +
      `Verifique se o comprovante está *nítido* e se os dados batem:\n` +
      `• Valor: R$ ${process.env.PIX_VALUE}\n` +
      `• Destinatário: ${process.env.PIX_RECIPIENT_NAME}\n\n` +
      `Tente enviar novamente. 💬`
    );
  }
}
