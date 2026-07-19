import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type Part,
} from "@google/generative-ai";
import {
  createCardInstallmentTransactions,
  createCardTransaction,
} from "@/lib/services/admin/cardTransactionsAdmin";
import { createTransaction } from "@/lib/services/admin/transactionsAdmin";
import { CREDIT_CARD_NAMES, CREDIT_CARD_NAMES_TEXT } from "@/lib/creditCards/catalog";
import { formatCategoryWithEmoji } from "@/lib/whatsapp/categories";
import { formatCurrency } from "../formatters/responseFormatter";
import { resolveTransactionCategory } from "../commands/normalizers/categoryNormalizer";
import { extractInstallmentMention } from "../commands/normalizers/installmentNormalizer";
import { formatBrasiliaDate } from "../utils/brasiliaDate";

type PromptPayload = string | GenerateContentRequest | Array<string | Part>;

const agentModels = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3-flash",
];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!); // Supondo que você já tenha o genAI configurado

const creditCardNameUnion = CREDIT_CARD_NAMES.map((cardName) => `"${cardName}"`).join(" | ");

async function generateContentWithFallback(
  promptPayload: PromptPayload,
  systemInstruction?: string
): Promise<string> {
  let ultimoErro: unknown = null;

  for (const agent of agentModels) {
    try {
      const config: { model: string; systemInstruction?: string } = { model: agent };
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      const model = genAI.getGenerativeModel(config);
      const result = await model.generateContent(promptPayload);
      return result.response.text();
    } catch (error) {
      console.warn(
        `Falha ou limite atingido no modelo ${agent}. Tentando o próximo da lista...`
      );
      ultimoErro = error;
    }
  }

  throw new Error(
    `Todos os modelos falharam. Último erro: ${ultimoErro instanceof Error ? ultimoErro.message : String(ultimoErro)}`
  );
}

export async function handleAddTransaction(
  userId: string,
  messageText: string,
  conversationHistory: string
): Promise<string> {
  const todayStr = formatBrasiliaDate();

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
        - Cartões aceitos (valores exatos): ${CREDIT_CARD_NAMES_TEXT}.
    3. Se o método de pagamento não for cartão de crédito, use uma das opções: "cash" (Dinheiro), "pix" (Pix), "debit" (Cartão de Débito).
    4. Categorias de despesas permitidas:
        - "fixes" (Contas fixas, luz, internet, água, telefone)
        - "foods" (Alimentação, restaurantes, supermercado, lanches, sorvete)
        - "housing" (Moradia, aluguel, condomínio, habitação)
        - "transport" (Transporte, Uber, táxi, ônibus, metrô, combustível)
        - "delivery" (Delivery, iFood e outras entregas)
        - "shopping" (Compras, roupas, calçados, eletrônicos, shopping)
        - "subscriptions" (Assinaturas, mensalidades, streaming, Netflix, Spotify)
        - "entertainment" (Lazer, cinema, festas, viagens, jogos)
        - "other" (Outros gastos que não se encaixam nos anteriores)
    5. Se o usuário disser "parcelado", "dividido", "10x" ou "em 10 vezes", trate como compra no cartão e preencha installmentCount entre 2 e 12. O amount continua sendo o valor TOTAL da compra. Sem indicação de parcelamento, use installmentCount 1.

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
            "category": "foods" | "fixes" | "housing" | "transport" | "delivery" | "shopping" | "subscriptions" | "entertainment" | "other" | "salary" | "extra",
            "type": "income" | "expense",
            "paymentMethod": "cash" | "pix" | "debit",
            "card": ${creditCardNameUnion},
            "installmentCount": number
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
    systemInstruction
  );

  const cleanJson = responseText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const parsed = JSON.parse(cleanJson);

  if (parsed.status === "complete") {
    const transactionData = parsed.transaction;
    transactionData.category = resolveTransactionCategory({
      messageText,
      description: transactionData.description,
      transactionType:
        transactionData.type === "income" ? "income" : "expense",
      suggestedCategory: transactionData.category,
    });
    const installment = extractInstallmentMention(messageText);
    const installmentCount = installment.count ?? 1;

    if (installment.requested && installment.count === null) {
      return "Em quantas vezes foi parcelada a compra? Escolha entre 2x e 12x.";
    }
    if (installment.requested && (installmentCount < 2 || installmentCount > 12)) {
      return "O parcelamento deve estar entre 2x e 12x.";
    }

    const isCardTransaction = parsed.isCardTransaction || installmentCount > 1;
    const collectionName = isCardTransaction
      ? "cardTransactions"
      : "transactions";

    if (isCardTransaction && !transactionData.card) {
      return "Qual cartão devo usar para essa compra?";
    }

    if (isCardTransaction && installmentCount > 1) {
      await createCardInstallmentTransactions(userId, {
        description: transactionData.description,
        category: transactionData.category,
        purchaseDate: transactionData.date,
        totalAmount: Math.abs(transactionData.amount),
        card: transactionData.card,
        installmentCount,
      });
    } else if (isCardTransaction) {
      await createCardTransaction(userId, transactionData);
    } else {
      await createTransaction(userId, transactionData);
    }

    const typeLabel = transactionData.type === "income" ? "Receita" : "Despesa";
    const messageLines = [
      `✅ *${typeLabel} adicionada*`,
      `${formatCategoryWithEmoji(transactionData.category)} · ${transactionData.description}`,
      `💰 ${formatCurrency(Math.abs(transactionData.amount))} · ${transactionData.date}`,
    ];

    if (collectionName === "cardTransactions" && transactionData.card) {
      messageLines.push(`💳 ${transactionData.card}`);
    }
    if (installmentCount > 1) {
      messageLines.push(`📆 ${installmentCount}x de ${formatCurrency(Math.abs(transactionData.amount) / installmentCount)}`);
    }

    return messageLines.join("\n");
  } else {
    return parsed.responseMessage;
  }
}
