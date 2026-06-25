import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { GoogleGenerativeAI } from "@google/generative-ai";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'meu_token_secreto';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function getUserIdByPhone(phoneNumber: string): Promise<string> {
  try {

    const docRef = db.collection('phone_mappings').doc(phoneNumber);
    const docSnap = await docRef.get() as any;
    
    if (docSnap.exists && docSnap.data()?.userId) {
      return docSnap.data().userId;
    }
  } catch (err) {
    console.error("Erro ao buscar mapeamento de telefone:", err);
  }

  return "SEU_UID_DE_TESTES_AQUI"; 
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

  console.warn('Falha na verificação do webhook. Token inválido ou mode incorreto.');
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
export async function POST(req: Request) {
  try {
    const data = await req.json();
    const messageEntry = data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    
    if (!messageEntry) return NextResponse.json({ status: "ignored" });

    const messageText = messageEntry.text?.body;
    const fromPhoneNumber = messageEntry.from;

    if (!messageText) return NextResponse.json({ status: "no_text_message" });

    const todayStr = new Date().toISOString().split('T')[0];

    
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
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

---

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
    // Se isCardTransaction for false, inclua estes dois campos:
    "type": "income" | "expense",
    "paymentMethod": "cash" | "pix" | "debit",
    // Se isCardTransaction for true, inclua este campo em vez de type/paymentMethod:
    "card": "Nubank" | "Inter" | "PicPay" | "BB" | "C6" | "Mercado Pago" | "Bradesco"
  }
}

Se faltar alguma informação (status "incomplete"), responda neste formato:
{
  "status": "incomplete",
  "missingFields": ["amount" | "description" | "paymentMethod" | "card"],
  "responseMessage": "Pergunta curta para o usuário em português. Ex: 'Qual foi o valor do sorvete?' ou 'Qual cartão de crédito você usou?'"
}`
    });

    const result = await model.generateContent(messageText);
    const responseText = result.response.text();
       
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (parsed.status === 'complete') {
      const transactionData = parsed.transaction;
      
      const userId = await getUserIdByPhone(fromPhoneNumber);

      const collectionName = parsed.isCardTransaction ? 'cardTransactions' : 'transactions';
      await db.collection(`users/${userId}/${collectionName}`).add({
        ...transactionData,
        phoneNumber: fromPhoneNumber,
        createdAt: new Date()
      });

      console.log("Transação salva com sucesso:", transactionData);
    } else {
      console.log("IA precisa de mais info:", parsed.responseMessage);
    }

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Erro no processamento:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}