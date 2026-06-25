import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { GoogleGenerativeAI } from '@google/generative-ai';

const VERIFY_TOKEN =
  process.env.WHATSAPP_VERIFY_TOKEN || 'meu_token_secreto';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN!;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function getUserIdByPhone(phoneNumber: string): Promise<string> {
  try {
    const docRef = db.collection('phone_mappings').doc(phoneNumber);
    const docSnap = (await docRef.get()) as any;

    if (docSnap.exists && docSnap.data()?.userId) {
      return docSnap.data().userId;
    }
  } catch (err) {
    console.error('Erro ao buscar mapeamento de telefone:', err);
  }

  return 'SEU_UID_DE_TESTES_AQUI';
}

async function downloadWhatsAppAudio(mediaId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  const mediaResponse = await fetch(
    `https://graph.facebook.com/v23.0/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
    }
  );

 if (!mediaResponse.ok) {
  const errorBody = await mediaResponse.text();

  console.error('META ERROR:', errorBody);

  throw new Error(
    `Erro ao buscar mídia: ${mediaResponse.status} ${errorBody}`
  );
}

  const mediaData = await mediaResponse.json();

  const audioResponse = await fetch(mediaData.url, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    },
  });

  if (!audioResponse.ok) {
    throw new Error(
      `Erro ao baixar áudio: ${audioResponse.status} ${audioResponse.statusText}`
    );
  }

  const arrayBuffer = await audioResponse.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: mediaData.mime_type || 'audio/ogg',
  };
}

async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
  });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: audioBuffer.toString('base64'),
      },
    },
    {
      text: 'Transcreva apenas o conteúdo deste áudio em português. Retorne somente a transcrição, sem explicações.',
    },
  ]);

  return result.response.text().trim();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verificado com sucesso!');
    return new Response(challenge, { status: 200 });
  }

  console.warn(
    'Falha na verificação do webhook. Token inválido ou mode incorreto.'
  );

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const messageEntry =
      data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!messageEntry) {
      return NextResponse.json({ status: 'ignored' });
    }

    const fromPhoneNumber = messageEntry.from;

    let messageText = '';

    if (messageEntry.type === 'text') {
      messageText = messageEntry.text?.body?.trim() || '';
    }

    if (messageEntry.type === 'audio') {
      const mediaId = messageEntry.audio?.id;

      if (!mediaId) {
        return NextResponse.json({
          status: 'audio_without_media_id',
        });
      }

      console.log('Recebido áudio:', mediaId);

      const { buffer, mimeType } = await downloadWhatsAppAudio(mediaId);

      messageText = await transcribeAudio(buffer, mimeType);

      console.log('Transcrição:', messageText);
    }

    if (!messageText) {
      return NextResponse.json({
        status: 'unsupported_or_empty_message',
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `Você é o Assistente Financeiro do aplicativo B-Finances. Sua missão é ler mensagens do usuário descrevendo transações financeiras (despesas ou receitas) e extrair os dados estruturados no formato JSON especificado.
Você deve responder EXCLUSIVAMENTE com o objeto JSON estruturado. Não adicione nenhuma saudação, explicação, markdown ou texto adicional fora do JSON.

DATA DE HOJE A SER CONSIDERADA COMO REFERÊNCIA: ${todayStr}

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
  "status": "incomplete",
  "missingFields": ["amount" | "description" | "paymentMethod" | "card"],
  "responseMessage": "Pergunta curta para o usuário em português."
}`,
    });

    const result = await model.generateContent(messageText);

    const responseText = result.response.text();

    const cleanJson = responseText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanJson);

    if (parsed.status === 'complete') {
      const transactionData = parsed.transaction;

      const userId = await getUserIdByPhone(fromPhoneNumber);

      const collectionName = parsed.isCardTransaction
        ? 'cardTransactions'
        : 'transactions';

      await db.collection(`users/${userId}/${collectionName}`).add({
        ...transactionData,
        phoneNumber: fromPhoneNumber,
        originalMessage: messageText,
        createdAt: new Date(),
      });

      console.log('Transação salva com sucesso:', transactionData);
    } else {
      console.log('IA precisa de mais info:', parsed.responseMessage);
    }

    return NextResponse.json({
      status: 'success',
    });
  } catch (error) {
    console.error('Erro no processamento:', error);

    return NextResponse.json(
      {
        status: 'error',
      },
      {
        status: 500,
      }
    );
  }
}