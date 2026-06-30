import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { standardizePhoneNumber, getPhoneVariations } from "@/lib/utils";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const agentModels = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3-flash",
];

async function sendWhatsAppMessage(to: string, text: string) {
  const url = `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`;
  await fetch(url, {
    method: "POST",
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

async function getUserIdByPhone(phoneNumber: string): Promise<string | null> {
  try {
    const variations = getPhoneVariations(phoneNumber);
    const snapshot = await db.collection("users")
      .where("phoneNumber", "in", variations)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }
  } catch (err) {
    console.error("Erro ao buscar usuário por telefone:", err);
  }

  return null;
}

async function downloadWhatsAppAudio(mediaId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  const mediaResponse = await fetch(
    `https://graph.facebook.com/v23.0/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
    },
  );

  if (!mediaResponse.ok) {
    const errorBody = await mediaResponse.text();

    console.error("META ERROR:", errorBody);

    throw new Error(
      `Erro ao buscar mídia: ${mediaResponse.status} ${errorBody}`,
    );
  }

  const mediaData = await mediaResponse.json();

  const audioResponse = await fetch(mediaData.url, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
    },
  });

  if (!audioResponse.ok) {
    throw new Error(
      `Erro ao baixar áudio: ${audioResponse.status} ${audioResponse.statusText}`,
    );
  }

  const arrayBuffer = await audioResponse.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: mediaData.mime_type || "audio/ogg",
  };
}
async function generateContentWithFallback(
  promptPayload: any,
  systemInstruction?: string,
): Promise<string> {
  let ultimoErro: any = null;

  for (const agent of agentModels) {
    try {
      const config: any = { model: agent };
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      const model = genAI.getGenerativeModel(config);
      const result = await model.generateContent(promptPayload);
      return result.response.text();
    } catch (error) {
      console.warn(
        `Falha ou limite atingido no modelo ${agent}. Tentando o próximo da lista...`,
      );
      ultimoErro = error;
    }
  }

  throw new Error(
    `Todos os modelos falharam. Último erro: ${ultimoErro?.message || ultimoErro}`,
  );
}

async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
): Promise<string> {
  const promptPayload = [
    {
      inlineData: {
        mimeType,
        data: audioBuffer.toString("base64"),
      },
    },
    {
      text: "Transcreva apenas o conteúdo deste áudio em português. Retorne somente a transcrição, sem explicações.",
    },
  ];

  return await generateContentWithFallback(promptPayload);
}

async function getChatContext(phoneNumber: string): Promise<string> {
  try {
    const sessionDoc = await db
      .collection("whatsapp_sessions")
      .doc(phoneNumber)
      .get();
    if (sessionDoc.exists) {
      const history = sessionDoc.data()?.history || [];
      return history.map((h: any) => `${h.role}: ${h.text}`).join("\n");
    }
  } catch (err) {
    console.error("Erro ao buscar contexto:", err);
  }
  return "Nenhum histórico anterior.";
}

async function saveChatContext(
  phoneNumber: string,
  role: "user" | "assistant",
  text: string,
) {
  try {
    const sessionRef = db.collection("whatsapp_sessions").doc(phoneNumber);
    const sessionDoc = await sessionRef.get();
    let history = [];
    if (sessionDoc.exists) {
      history = sessionDoc.data()?.history || [];
    }
    history.push({ role, text, timestamp: new Date() });
    if (history.length > 10) history.shift();
    await sessionRef.set({ history });
  } catch (err) {
    console.error("Erro ao salvar contexto:", err);
  }
}

async function clearChatContext(phoneNumber: string) {
  try {
    await db.collection("whatsapp_sessions").doc(phoneNumber).delete();
  } catch (err) {
    console.error("Erro ao limpar contexto:", err);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado com sucesso!");
    return new Response(challenge, { status: 200 });
  }

  console.warn(
    "Falha na verificação do webhook. Token inválido ou mode incorreto.",
  );

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const messageEntry = data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!messageEntry) {
      return NextResponse.json({ status: "ignored" });
    }

    const fromPhoneNumber = messageEntry.from;
    if (!fromPhoneNumber) {
      return NextResponse.json({ status: "ignored_no_sender" });
    }

    const userId = await getUserIdByPhone(fromPhoneNumber);
    if (!userId) {
      console.warn(`Mensagem recebida de número não cadastrado: ${fromPhoneNumber}`);
      await sendWhatsAppMessage(
        fromPhoneNumber,
        "⚠️ Olá! Não encontramos nenhuma conta associada a este número de telefone no B-Finances. Por favor, registre o seu número na tela de cadastro do aplicativo para poder utilizar o nosso bot do WhatsApp."
      );
      return NextResponse.json({
        status: "error",
        error: "Unregistered phone number"
      });
    }

    let messageText = "";

    if (messageEntry.type === "text") {
      messageText = messageEntry.text?.body?.trim() || "";
    }

    if (messageEntry.type === "audio") {
      const mediaId = messageEntry.audio?.id;

      if (!mediaId) {
        return NextResponse.json({
          status: "audio_without_media_id",
        });
      }

      console.log("Recebido áudio:", mediaId);

      const { buffer, mimeType } = await downloadWhatsAppAudio(mediaId);

      messageText = await transcribeAudio(buffer, mimeType);

      console.log("Transcrição:", messageText);
    }

    if (!messageText) {
      return NextResponse.json({
        status: "unsupported_or_empty_message",
      });
    }
    await saveChatContext(fromPhoneNumber, "user", messageText);
    const conversationHistory = await getChatContext(fromPhoneNumber);
    const todayStr = new Date().toISOString().split("T")[0];

    const systemInstruction = `Você é o Assistente Financeiro do aplicativo B-Finances. Sua missão é ler mensagens do usuário descrevendo transações financeiras (despesas ou receitas) e extrair os dados estruturados no formato JSON especificado.
			Você deve responder EXCLUSIVAMENTE com o objeto JSON estruturado. Não adicione nenhuma saudação, explicação, markdown ou texto adicional fora do JSON.

			DATA DE HOJE A SER CONSIDERADA COMO REFERÊNCIA: ${todayStr}

			### HISTÓRICO RECENTE DA CONVERSA:
			Abaixo está o histórico recente com o usuário. Utilize-o para preencher dados que ele já enviou em mensagens anteriores para a mesma transação em andamento:
			${conversationHistory}

			### DATA DA TRANSAÇÃO:
			Sempre use a data de hoje como referência ou infira com base em palavras-chave (ex: "hoje", "ontem", "anteontem", "segunda-feira passada"). Formate sempre como "YYYY-MM-DD".
			- Se a mensagem disser "ontem", calcule o dia anterior à data de referência (${todayStr}).
			- Se nenhuma data/referência for mencionada, assuma a data de referência (${todayStr}).

			### REGRAS PARA DESPESAS (Gastos):
			1. O valor (amount) deve ser sempre NEGATIVO (ex: -15.50).
			2. Se o método de pagamento (paymentMethod) for "credit_card" (Cartão de Crédito), a transação é considerada uma "Transação de Cartão" (Card Transaction). Nesse caso, você DEVE extrair o campo "card" informando qual é o banco/cartão.
				- Cartões aceitos (valores exatos): "Nubank", "Inter", "PicPay", "BB", "C6", "Mercado Pago", "Bradesco".
			3. Se o método de pagamento não for cartão de crédito, use uma das opções: "cash" (Dinheiro), "pix" (Pix), "debit" (Cartão de Débito).
			4. Categorias de despesas permitidas:
				- "fixes" (Contas fixas, aluguel, luz, internet, etc.)
				- "foods" (Alimentação, restaurantes, supermercado, lanches, sorvete)
				- "entertainment" (Lazer, cinema, festas, viagens, jogos)
				- "other" (Outros gastos que não se encaixam nos anteriores)

			### REGRAS PARA RECEITAS (Lucros/Entradas):
			1. O valor (amount) deve ser sempre POSITIVO (ex: 800.00).
			2. O campo type deve ser "income".
			3. O campo paymentMethod padrão deve ser "pix", a menos que o usuário cite "dinheiro" ("cash") ou outro método explicitamente.
			4. Categorias de receitas permitidas:
				- "salary" (Salário, trabalho principal)
				- "extra" (Trabalho extra, freela, bônus, prêmios, apostas, rendimentos extras)
				- "other" (Outras entradas)

			### TRATAMENTO DE INFORMAÇÕES INCOMPLETAS:
			Se a mensagem do usuário não contiver informações essenciais (ex: faltar o valor, não ficar claro se é receita/despesa, ou se for cartão de crédito mas ele não especificar qual cartão), você deve responder com o status "incomplete" e formular uma pergunta curta e amigável em português pedindo a informação faltante.

			### SCHEMA DE RETORNO (JSON):

			Se a transação estiver completa (status "complete"), responda neste formato:
			{
				"status": "complete",
				"isCardTransaction": true | false,
				"transaction": {
					"description": "Descrição curta da transação",
					"date": "YYYY-MM-DD",
					"amount": number,
					"category": "foods" | "fixes" | "entertainment" | "other" | "salary" | "extra",
					"type": "income" | "expense",
					"paymentMethod": "cash" | "pix" | "debit",
					"card": "Nubank" | "Inter" | "PicPay" | "BB" | "C6" | "Mercado Pago" | "Bradesco"
				}
			}

			Se faltar alguma informação (status "incomplete"), responda neste formato:
			{
				"status": "complete" | "incomplete",
				"missingFields": ["amount" | "description" | "paymentMethod" | "card"],
				"responseMessage": "Pergunta curta para o usuário em português."
			}`;

    const responseText = await generateContentWithFallback(
      messageText,
      systemInstruction,
    );

    const cleanJson = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanJson);

    if (parsed.status === "complete") {
      const transactionData = parsed.transaction;

      const collectionName = parsed.isCardTransaction
        ? "cardTransactions"
        : "transactions";

      await db.collection(`users/${userId}/${collectionName}`).add({
        ...transactionData,
        phoneNumber: fromPhoneNumber,
        originalMessage: messageText,
        createdAt: new Date(),
      });
      const messageReply =
        collectionName === "cardTransactions"
          ? "Gasto adicionado ao cartão!✅"
          : "Gasto adicionado a lista de transferencias!✅";

      await sendWhatsAppMessage(fromPhoneNumber, messageReply);

      console.log("Transação salva com sucesso:", transactionData);
    } else {
      await clearChatContext(fromPhoneNumber);

      await sendWhatsAppMessage(fromPhoneNumber, parsed.responseMessage);

      await saveChatContext(
        fromPhoneNumber,
        "assistant",
        parsed.responseMessage,
      );
      console.log(
        "IA precisa de mais info. Pergunta enviada:",
        parsed.responseMessage,
      );
    }

    return NextResponse.json({
      status: "success",
    });
  } catch (error) {
    console.error("Erro no processamento:", error);

    return NextResponse.json(
      {
        status: "error",
      },
      {
        status: 500,
      },
    );
  }
}
