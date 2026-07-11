import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type ModelParams,
  type Part,
} from "@google/generative-ai";
import { IntentType, IntentResult } from "./intentTypes";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const agentModels = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3-flash",
];

async function generateContentWithFallback(
  promptPayload: GenerateContentRequest | string | Array<string | Part>,
  systemInstruction?: string,
): Promise<string> {
  let ultimoErro: unknown = null;

  for (const agent of agentModels) {
    try {
      const config: ModelParams = { model: agent };
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
    `Todos os modelos falharam. Último erro: ${ultimoErro instanceof Error ? ultimoErro.message : String(ultimoErro)}`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function classifyIntent(
  message: string,
  conversationHistory: string,
): Promise<IntentResult> {
  const todayStr = new Date().toISOString().split("T")[0];

  const systemInstruction = `Você é um classificador de intenções para um assistente financeiro do WhatsApp.
Sua tarefa é analisar a mensagem do usuário e identificar qual é a intenção dele.

DATA DE HOJE: ${todayStr}

HISTÓRICO DA CONVERSA:
${conversationHistory}

INTENÇÕES DISPONÍVEIS:

1. ADD_TRANSACTION - Adicionar despesa ou receita
   Exemplos: "gastei 50 reais", "recebi meu salário", "comprei um lanche"

2. QUERY_EXPENSES - Consultar gastos ou listar últimas despesas
   Exemplos: "quanto gastei esse mês?", "gastos com comida", "despesas de janeiro", "liste meus últimos 5 gastos", "meus últimos 3 gastos com alimentação", "gastos no cartão Inter"
   Parâmetros: period, limit (número de itens), category_filter (categoria interna), card_filter (nome do cartão)

3. QUERY_INCOME - Consultar receitas ou listar últimas entradas
   Exemplos: "quanto ganhei esse mês?", "minhas receitas", "liste meus últimos 3 lucros", "últimas 10 entradas"
   Parâmetros: period, limit (número de itens)

4. QUERY_BALANCE - Consultar saldo ou resumo financeiro completo do mês
   Exemplos: "qual meu saldo?", "resumo financeiro", "como estão minhas finanças?", "resumo do mês", "balanço mensal"
   Parâmetros: period

5. QUERY_CARD_INVOICE - Consultar fatura(s) de cartão
   Exemplos: "fatura do nubank", "quanto devo no cartão?", "quais minhas faturas em aberto?", "todas as faturas", "faturas dos meus cartões"
   Parâmetros: card (nome do cartão OU null para todas), all_invoices (true se quer todas as faturas)

6. QUERY_BILLS - Consultar contas a pagar
   Exemplos: "próximas contas", "contas pendentes", "o que vence essa semana?"

7. QUERY_INVESTMENTS - Consultar investimentos
   Exemplos: "quanto tenho investido?", "meus investimentos", "saldo em CDB"

8. DELETE_TRANSACTION - Deletar transação
   Exemplos: "deletar gasto com pizza", "remover transação", "apagar compra"

9. DELETE_CARD_TRANSACTION - Deletar transação de cartão
   Exemplos: "remover compra do cartão", "deletar gasto no nubank"

10. PAY_BILL - Pagar conta
    Exemplos: "pagar conta de luz", "marcar conta como paga"

11. PAY_CARD_INVOICE - Pagar fatura de cartão
    Exemplos: "pagar fatura do nubank", "paguei o cartão"

12. ADD_INVESTMENT - Adicionar investimento
    Exemplos: "investi 1000 em CDB", "adicionar investimento"

13. REDEEM_INVESTMENT - Resgatar investimento
    Exemplos: "resgatar 500 do CDB", "sacar investimento"

14. TOGGLE_NOTIFICATIONS - Ativar/desativar notificações
    Exemplos: "desativar alertas", "ativar notificações", "parar de me avisar"

15. HELP - Pedir ajuda
    Exemplos: "ajuda", "o que você faz?", "comandos disponíveis"

16. UNKNOWN - Não identificado

RESPONDA APENAS COM UM JSON no seguinte formato:
{
  "intent": "NOME_DA_INTENCAO",
  "confidence": 0.95,
  "parameters": {
    "category": "foods",
    "period": "month",
    "card": "Nubank",
    "all_invoices": false,
    "description": "pizza",
    "amount": 50,
    "limit": 5,
    "category_filter": "foods",
    "card_filter": "Inter"
  }
}

REGRAS PARA PARÂMETROS:
- "limit": extraia quando o usuário pedir número específico (ex: "últimos 5", "3 gastos")
- "category_filter": extraia a categoria interna quando filtrar por tipo (alimentação→foods, lazer→entertainment, fixas→fixes, salário→salary, extra→extra, outros→other)
- "card_filter": extraia quando o usuário mencionar cartão em QUERY_EXPENSES (ex: "gastos no Inter")
- "all_invoices": true quando pedir todas as faturas sem especificar cartão
- "card": nome do cartão em QUERY_CARD_INVOICE quando especificado
A confiança (confidence) deve ser um número entre 0 e 1.`;

  try {
    const responseText = await generateContentWithFallback(
      message,
      systemInstruction,
    );

    const cleanJson = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed: unknown = JSON.parse(cleanJson);
    if (!isRecord(parsed)) {
      throw new Error("Resposta do classificador não é um objeto JSON.");
    }

    const parsedIntent = typeof parsed.intent === "string"
      && Object.values(IntentType).includes(parsed.intent as IntentType)
      ? parsed.intent as IntentType
      : IntentType.UNKNOWN;
    const parsedConfidence = typeof parsed.confidence === "number"
      ? parsed.confidence
      : 0.8;
    const parsedParameters = isRecord(parsed.parameters) ? parsed.parameters : {};

    return {
      intent: parsedIntent,
      confidence: parsedConfidence,
      parameters: parsedParameters,
    };
  } catch (error) {
    console.error("Erro ao classificar intenção:", error);
    return {
      intent: IntentType.UNKNOWN,
      confidence: 0,
      parameters: {},
    };
  }
}
