export async function sendWhatsAppMessage(to: string, text: string) {
  const url = `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`;

  await fetch(url, {
    method: "POST",
    keepalive: true,
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      text: { body: text },
    }),
  });
}

/**
 * Envia recibo de leitura ("status: read") para a Meta de forma não-bloqueante.
 * Faz aparecer os dois tracinhos azuis instantaneamente no celular do usuário.
 */
export async function markWhatsAppMessageAsRead(messageId: string): Promise<void> {
  const url = `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`;

  try {
    await fetch(url, {
      method: "POST",
      keepalive: true,
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  } catch (err) {
    console.error("Erro ao enviar status de lido para Meta:", err);
  }
}
