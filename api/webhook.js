import { kvGet, kvSet } from '../lib/kv.js';
import { sendText } from '../lib/uazapi.js';
import { verifyPaymentProof } from '../lib/verify.js';

const ESTADOS = {
  AGUARDANDO_PAGAMENTO: 'aguardando_pagamento',
  ENTREGUE: 'entregue',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true });
  }

  try {
    const body = req.body;

    if (body?.wasSentByApi === true || body?.isGroup === true) {
      return res.status(200).json({ ok: true });
    }

    const from = body?.sender_pn || body?.from;
    if (!from) return res.status(200).json({ ok: true });

    const tipo = body?.type;
    const estado = await kvGet(`estado:${from}`);

    console.log('Mensagem de:', from, '| Tipo:', tipo, '| Estado:', estado);

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
      } else {
        await handleComprovante(from, {
          url: body?.mediaUrl,
          base64Already: body?.mediaBase64 ?? null,
          mimeType: 'application/pdf',
        }, estado);
      }
    } else {
      if (estado === ESTADOS.AGUARDANDO_PAGAMENTO) {
        await sendText(from, '😊 Estou aguardando seu comprovante! Envie como *foto* ou *PDF*.');
      }
    }

  } catch (err) {
    console.error('Erro no webhook:', err);
  }

  return res.status(200).json({ ok: true });
}

async function handleTexto(from, texto, estado) {
  if (estado === ESTADOS.ENTREGUE) {
    await sendText(from,
      `✨ Você já recebeu *${process.env.CONTO_TITLE}*!\n\nAqui está o link novamente: ${process.env.CONTENT_URL}`
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
    await sendText(from, `✨ Você já recebeu seu conto! Aqui está: ${process.env.CONTENT_URL}`);
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
