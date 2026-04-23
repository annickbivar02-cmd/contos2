// api/webhook.js
// ─────────────────────────────────────────────────────────────────────────────
// PONTO DE ENTRADA DO BOT
// Este arquivo recebe TODAS as mensagens do WhatsApp via UazAPI
// e decide o que responder com base no estado de cada lead.
// ─────────────────────────────────────────────────────────────────────────────

import { kvGet, kvSet } from '../lib/kv.js';
import { sendText }     from '../lib/uazapi.js';
import { verifyPaymentProof } from '../lib/verify.js';

// Estados possíveis da conversa com cada lead
const ESTADOS = {
  AGUARDANDO_PAGAMENTO: 'aguardando_pagamento',
  ENTREGUE:             'entregue',
};

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL — Vercel chama esta função para cada mensagem recebida
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Responde 200 imediatamente para o UazAPI não repetir o envio
  res.status(200).json({ ok: true });

  // Ignora tudo que não for POST
  if (req.method !== 'POST') return;

  try {
    const body = req.body;

    // Ignora mensagens enviadas pelo próprio bot
    if (body?.data?.key?.fromMe) return;

    // Número do lead (ex: "5584999999999@s.whatsapp.net")
    const from = body?.data?.key?.remoteJid;
    if (!from || from.includes('@g.us')) return; // ignora grupos

    const tipo    = body?.data?.messageType;   // tipo da mensagem
    const message = body?.data?.message;       // conteúdo da mensagem

    // Estado atual deste lead (null = primeiro contato)
    const estado = await kvGet(`estado:${from}`);

    // ── Mensagem de texto ──────────────────────────────────────────────────
    if (tipo === 'conversation' || tipo === 'extendedTextMessage') {
      const texto = message?.conversation ?? message?.extendedTextMessage?.text ?? '';
      await handleTexto(from, texto, estado);

    // ── Imagem (comprovante em foto) ───────────────────────────────────────
    } else if (tipo === 'imageMessage') {
      await handleComprovante(from, {
        url:      message.imageMessage.url,
        base64:   message.imageMessage.base64 ?? null, // às vezes já vem em base64
        mimeType: message.imageMessage.mimetype ?? 'image/jpeg',
      }, estado);

    // ── Documento (comprovante em PDF) ─────────────────────────────────────
    } else if (tipo === 'documentMessage') {
      const mime = message.documentMessage.mimetype ?? '';
      if (!mime.includes('pdf')) {
        await sendText(from, 'Por favor, envie o comprovante como *foto* ou *PDF*. 📎');
        return;
      }
      await handleComprovante(from, {
        url:      message.documentMessage.url,
        base64:   message.documentMessage.base64 ?? null,
        mimeType: 'application/pdf',
      }, estado);

    // ── Áudio, sticker, etc. ───────────────────────────────────────────────
    } else {
      if (estado === ESTADOS.AGUARDANDO_PAGAMENTO) {
        await sendText(from, '😊 Estou aguardando seu comprovante! Envie como *foto* ou *PDF*.');
      }
    }

  } catch (err) {
    console.error('Erro no webhook:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIDA COM MENSAGENS DE TEXTO
// ─────────────────────────────────────────────────────────────────────────────
async function handleTexto(from, texto, estado) {
  // Se já recebeu o conto, apenas agradece
  if (estado === ESTADOS.ENTREGUE) {
    await sendText(from,
      `✨ Você já recebeu *${process.env.CONTO_TITLE}*!\n\n` +
      `Aproveite a leitura. 🌙\n\n` +
      `Aqui está o link novamente: ${process.env.CONTENT_URL}`
    );
    return;
  }

  // Qualquer mensagem de texto inicia o fluxo de venda
  await kvSet(`estado:${from}`, ESTADOS.AGUARDANDO_PAGAMENTO, 86400); // expira em 24h

  await sendText(from,
    `Olá! 👋 Seja bem-vinda!\n\n` +
    `Você está a um passo de receber *${process.env.CONTO_TITLE}*. 📖\n\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `💰 *Valor:* R$ ${process.env.PIX_VALUE}\n` +
    `🔑 *Chave Pix:* ${process.env.PIX_KEY}\n` +
    `👤 *Destinatário:* ${process.env.PIX_RECIPIENT_NAME}\n` +
    `━━━━━━━━━━━━━━━━━\n\n` +
    `Após fazer o Pix, envie aqui o *comprovante* (foto ou PDF) e a entrega é automática! ✅`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIDA COM COMPROVANTES (IMAGEM OU PDF)
// ─────────────────────────────────────────────────────────────────────────────
async function handleComprovante(from, { url, base64, mimeType }, estado) {
  // Se já entregou, não processa de novo
  if (estado === ESTADOS.ENTREGUE) {
    await sendText(from, `✨ Você já recebeu seu conto! Aqui está o link: ${process.env.CONTENT_URL}`);
    return;
  }

  // Se o lead enviou comprovante sem ter iniciado o fluxo, inicia primeiro
  if (!estado) {
    await kvSet(`estado:${from}`, ESTADOS.AGUARDANDO_PAGAMENTO, 86400);
  }

  await sendText(from, '⏳ Recebi! Estou verificando seu comprovante...');

  // Chama a IA para analisar
  const valido = await verifyPaymentProof({
    url,
    base64Already: base64,
    mimeType,
  });

  if (valido) {
    // ✅ Pagamento confirmado — entrega o conto!
    await kvSet(`estado:${from}`, ESTADOS.ENTREGUE, 86400 * 30); // guarda por 30 dias

    await sendText(from,
      `✅ *Pagamento confirmado!*\n\n` +
      `Aqui está seu conto:\n\n` +
      `📖 *${process.env.CONTO_TITLE}*\n` +
      `🔗 ${process.env.CONTENT_URL}\n\n` +
      `Boa leitura! 🌙✨\n\n` +
      `_Este link é pessoal — não compartilhe com outras pessoas._`
    );
  } else {
    // ❌ Comprovante inválido ou suspeito
    await sendText(from,
      `❌ Não consegui confirmar este pagamento.\n\n` +
      `Verifique se o comprovante está *nítido* e se os dados batem:\n` +
      `• Valor: R$ ${process.env.PIX_VALUE}\n` +
      `• Destinatário: ${process.env.PIX_RECIPIENT_NAME}\n\n` +
      `Tente enviar novamente. Se o problema persistir, entre em contato. 💬`
    );
  }
}
