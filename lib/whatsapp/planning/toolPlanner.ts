import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type Part,
} from "@google/generative-ai";
import { plannableWhatsappTools, type Tool } from "../tools";
import type {
  ShortTermMemorySnapshot,
  ShortTermMemoryTurn,
} from "../utils/shortTermMemory";

type PromptPayload = string | GenerateContentRequest | Array<string | Part>;

export type ToolPlan =
  | {
      action: "execute";
      toolName: string;
      parameters: Record<string, unknown>;
      confidence: number;
    }
  | {
      action: "ask";
      toolName?: string;
      missingParameters: string[];
      question: string;
      confidence: number;
    };

type ToolResultResponseInput = {
  messageText: string;
  conversationHistory: string;
  tool: Tool;
  parameters: Record<string, unknown>;
  result: unknown;
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const agentModels = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3-flash",
];

async function generateContentWithFallback(
  promptPayload: PromptPayload,
  systemInstruction?: string,
): Promise<string> {
  let ultimoErro: unknown = null;

  for (const agent of agentModels) {
    try {
      const config: { model: string; systemInstruction?: string } = {
        model: agent,
      };
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      const model = genAI.getGenerativeModel(config);
      const result = await model.generateContent(promptPayload);
      return result.response.text();
    } catch (error) {
      console.warn(
        `Falha ou limite atingido no modelo ${agent}. Tentando o proximo da lista...`,
      );
      ultimoErro = error;
    }
  }

  const errMsg =
    ultimoErro instanceof Error ? ultimoErro.message : String(ultimoErro);

  throw new Error(`Todos os modelos falharam. Ultimo erro: ${errMsg}`);
}

function cleanJsonResponse(responseText: string): string {
  return responseText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

function buildToolsPromptPayload() {
  return plannableWhatsappTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    requiredParameters: tool.requiredParameters,
    parameters: tool.parameters,
  }));
}

function normalizeParameterValue(
  parameterName: string,
  value: unknown,
): unknown {
  const numericParameters = new Set(["amount", "days", "limit", "month", "year"]);
  const booleanParameters = new Set(["all_invoices", "enable"]);

  if (numericParameters.has(parameterName) && typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : value;
  }

  if (booleanParameters.has(parameterName) && typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return value;
}

function normalizeParameters(
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(parameters).map(([parameterName, value]) => [
      parameterName,
      normalizeParameterValue(parameterName, value),
    ]),
  );
}

function isMissingParameter(
  parameterName: string,
  parameters: Record<string, unknown>,
  messageText: string,
): boolean {
  if (parameterName === "messageText") {
    return messageText.trim().length === 0;
  }

  const value = parameters[parameterName];
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && value.trim().length === 0) return true;
  return false;
}

function validateRequiredParameters(
  tool: Tool,
  parameters: Record<string, unknown>,
  messageText: string,
): string[] {
  return tool.requiredParameters.filter((parameterName) =>
    isMissingParameter(parameterName, parameters, messageText),
  );
}

function buildMissingParameterQuestion(
  tool: Tool | undefined,
  missingParameters: string[],
): string {
  if (!tool || missingParameters.length === 0) {
    return "Pode me dizer um pouco melhor o que voce quer fazer?";
  }

  const friendlyNames: Record<string, string> = {
    amount: "o valor",
    card: "o cartao",
    category: "a categoria",
    confirmation: "a confirmacao",
    description: "a descricao",
    enable: "se deseja ativar ou desativar",
    messageText: "a mensagem",
    type: "se voce quer gastos ou receitas",
  };
  const labels = missingParameters
    .map((parameterName) => friendlyNames[parameterName] || parameterName)
    .join(", ");

  return `Preciso que voce informe: ${labels}.`;
}

function normalizePlan(parsed: unknown): ToolPlan {
  if (!parsed || typeof parsed !== "object") {
    return {
      action: "ask",
      missingParameters: [],
      question: "Pode me dizer um pouco melhor o que voce quer fazer?",
      confidence: 0,
    };
  }

  const rawPlan = parsed as Record<string, unknown>;
  const confidence =
    typeof rawPlan.confidence === "number" ? rawPlan.confidence : 0.8;

  if (rawPlan.action === "execute" && typeof rawPlan.toolName === "string") {
    const parameters =
      rawPlan.parameters &&
      typeof rawPlan.parameters === "object" &&
      !Array.isArray(rawPlan.parameters)
        ? (rawPlan.parameters as Record<string, unknown>)
        : {};

    return {
      action: "execute",
      toolName: rawPlan.toolName,
      parameters: normalizeParameters(parameters),
      confidence,
    };
  }

  const missingParameters = Array.isArray(rawPlan.missingParameters)
    ? rawPlan.missingParameters.filter(
        (parameter): parameter is string => typeof parameter === "string",
      )
    : [];

  return {
    action: "ask",
    toolName:
      typeof rawPlan.toolName === "string" ? rawPlan.toolName : undefined,
    missingParameters,
    question:
      typeof rawPlan.question === "string" && rawPlan.question.trim()
        ? rawPlan.question
        : "Pode me dizer um pouco melhor o que voce quer fazer?",
    confidence,
  };
}

function truncateMemoryText(value: string): string {
  return value.length > 220 ? `${value.slice(0, 217)}...` : value;
}

function buildShortTermMemoryPrompt(
  shortTermMemory?: ShortTermMemorySnapshot | null,
): string {
  if (!shortTermMemory || shortTermMemory.turns.length === 0) {
    return "Nenhuma memoria curta ativa.";
  }

  return shortTermMemory.turns
    .map((turn, index) => {
      return [
        `${index + 1}. Usuario: ${truncateMemoryText(turn.userMessage)}`,
        `   Ferramenta: ${turn.toolName}`,
        `   Parametros: ${JSON.stringify(turn.parameters)}`,
        `   Resposta: ${truncateMemoryText(turn.assistantReply)}`,
      ].join("\n");
    })
    .join("\n\n");
}

function normalizeFreeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getLatestContextualTurn(
  shortTermMemory?: ShortTermMemorySnapshot | null,
): ShortTermMemoryTurn | undefined {
  if (!shortTermMemory) return undefined;

  return [...shortTermMemory.turns]
    .reverse()
    .find((turn) =>
      ["query_transactions", "query_balance", "query_card_invoice"].includes(
        turn.toolName,
      ),
    );
}

function messageLooksLikeContinuation(messageText: string): boolean {
  const normalized = normalizeFreeText(messageText);

  return (
    /^(e|ea|eo|agora|tambem|passad[oa]|anterior)\b/.test(normalized) ||
    /\b(e no|e na|e em|passad[oa]|anterior)\b/.test(normalized)
  );
}

function hasExplicitDifferentIntent(messageText: string): boolean {
  const normalized = normalizeFreeText(messageText);

  return /\b(adicionar|adicione|cadastre|deletar|delete|excluir|exclua|fatura|investimento|pagar|paguei|recebi|ganhei)\b/.test(
    normalized,
  );
}

function inferPeriodFromMessage(messageText: string): string | undefined {
  const normalized = normalizeFreeText(messageText);

  if (/\bmes\s+passad[oa]\b/.test(normalized)) return "last_month";
  if (/\bpassad[oa]\b/.test(normalized) && !/\b(semana|ano)\b/.test(normalized)) {
    return "last_month";
  }
  if (/\bhoje\b/.test(normalized)) return "today";
  if (/\bsemana\b/.test(normalized)) return "week";
  if (/\bmes\b/.test(normalized)) return "month";
  if (/\bano\b/.test(normalized)) return "year";

  return undefined;
}

function inferCardFromMessage(messageText: string): string | undefined {
  const normalized = normalizeFreeText(messageText);
  const cards = [
    "Nubank",
    "Inter",
    "PicPay",
    "BB",
    "C6",
    "Mercado Pago",
    "Bradesco",
  ];

  return cards.find((card) => {
    const normalizedCard = normalizeFreeText(card);
    return new RegExp(`\\b${normalizedCard}\\b`).test(normalized);
  });
}

function inferTransactionTypeFromMessage(
  messageText: string,
): "expense" | "income" | undefined {
  const normalized = normalizeFreeText(messageText);

  if (/\b(gasto|gastei|despesa|despesas|compras?)\b/.test(normalized)) {
    return "expense";
  }

  if (/\b(receita|receitas|entrada|entradas|lucro|ganhei|recebi)\b/.test(normalized)) {
    return "income";
  }

  return undefined;
}

function buildCarriedParameters(
  toolName: string,
  previousParameters: Record<string, unknown>,
): Record<string, unknown> {
  const carried: Record<string, unknown> = {};
  const allowedParametersByTool: Record<string, string[]> = {
    query_transactions: ["type", "period", "category_filter", "card_filter"],
    query_balance: ["period"],
    query_card_invoice: ["card", "all_invoices", "month", "year"],
  };

  const allowedParameters = allowedParametersByTool[toolName] || [];
  for (const parameterName of allowedParameters) {
    if (previousParameters[parameterName] !== undefined) {
      carried[parameterName] = previousParameters[parameterName];
    }
  }

  return carried;
}

function buildInferredContinuationParameters(
  toolName: string,
  messageText: string,
): Record<string, unknown> {
  const inferred: Record<string, unknown> = {};
  const period = inferPeriodFromMessage(messageText);
  const card = inferCardFromMessage(messageText);

  if (
    period &&
    (toolName === "query_transactions" || toolName === "query_balance")
  ) {
    inferred.period = period;
  }

  if (card && toolName === "query_transactions") {
    inferred.card_filter = card;
  }

  if (card && toolName === "query_card_invoice") {
    inferred.card = card;
    inferred.all_invoices = false;
  }

  if (toolName === "query_transactions") {
    const type = inferTransactionTypeFromMessage(messageText);
    if (type) inferred.type = type;
  }

  return inferred;
}

function applyShortTermMemoryToPlan(
  plan: ToolPlan,
  messageText: string,
  shortTermMemory?: ShortTermMemorySnapshot | null,
): ToolPlan {
  const latestContextualTurn = getLatestContextualTurn(shortTermMemory);
  if (!latestContextualTurn || !messageLooksLikeContinuation(messageText)) {
    return plan;
  }

  const shouldKeepPreviousTool =
    !hasExplicitDifferentIntent(messageText) &&
    ["query_transactions", "query_balance", "query_card_invoice"].includes(
      latestContextualTurn.toolName,
    );

  const fallbackToolName = latestContextualTurn.toolName;

  if (plan.action === "ask" && shouldKeepPreviousTool) {
    return {
      action: "execute",
      toolName: fallbackToolName,
      parameters: {
        ...buildCarriedParameters(
          fallbackToolName,
          latestContextualTurn.parameters,
        ),
        ...buildInferredContinuationParameters(fallbackToolName, messageText),
      },
      confidence: Math.max(plan.confidence, 0.85),
    };
  }

  if (plan.action !== "execute") return plan;

  const toolName =
    shouldKeepPreviousTool &&
    plan.toolName !== latestContextualTurn.toolName
      ? latestContextualTurn.toolName
      : plan.toolName;

  if (toolName !== latestContextualTurn.toolName) {
    return plan;
  }

  return {
    ...plan,
    toolName,
    parameters: {
      ...buildCarriedParameters(toolName, latestContextualTurn.parameters),
      ...plan.parameters,
      ...buildInferredContinuationParameters(toolName, messageText),
    },
  };
}

export async function planToolExecution(
  messageText: string,
  conversationHistory: string,
  shortTermMemory?: ShortTermMemorySnapshot | null,
): Promise<ToolPlan> {
  const todayStr = new Date().toISOString().split("T")[0];
  const tools = buildToolsPromptPayload();

  const systemInstruction = `Voce e o planejador de ferramentas do assistente financeiro B-Finances no WhatsApp.
Sua tarefa e escolher UMA ferramenta com base na mensagem do usuario e no historico.

DATA DE HOJE: ${todayStr}

HISTORICO DA CONVERSA:
${conversationHistory}

MEMORIA CURTA DA SESSAO:
${buildShortTermMemoryPrompt(shortTermMemory)}

FERRAMENTAS DISPONIVEIS:
${JSON.stringify(tools, null, 2)}

REGRAS:
- Nao execute ferramentas. Nao use Tool Calling da API. Este fluxo e apenas JSON baseado em prompt.
- Escolha a ferramenta pelo campo "name".
- Preencha "parameters" apenas com valores explicitamente informados ou claramente inferidos da mensagem/historico.
- Use a MEMORIA CURTA quando a mensagem atual continuar o assunto anterior, como "e no passado?", "e no Inter?", "e agora?", "tambem?".
- Em continuacoes, mantenha a ferramenta e os parametros anteriores e troque somente o detalhe novo citado pelo usuario.
- Se o usuario disser apenas "passado" depois de uma consulta mensal ou sem periodo explicito, interprete como period "last_month".
- NAO invente parametros obrigatorios.
- Se faltar qualquer item de "requiredParameters", responda com action "ask" e uma pergunta curta ao usuario.
- Parametros opcionais podem ser omitidos; os handlers aplicam seus padroes internos.
- Para add_transaction, nao extraia os campos da transacao. Use a ferramenta quando a mensagem descreve uma despesa ou receita; o executor usa a mensagem original.
- Para find_transaction, use quando o usuario quiser localizar uma transacao especifica por linguagem natural, inclusive mensagens curtas como "a pizza", "o mercado", "o Uber", "ontem", "segunda-feira", "semana passada", "50 reais" ou "cartao Inter". Envie query com a frase original.
- Mensagens curtas sem verbo claro de adicionar, remover ou consultar resumo devem usar find_transaction, nao add_transaction.
- Para query_transactions, use type "expense" para gastos/despesas e "income" para receitas/entradas.
- Para delete_transaction, use source "card" somente quando o usuario falar claramente de cartao; caso contrario use "transaction".
- Para toggle_notifications, enable deve ser booleano: true para ativar e false para desativar.

RESPONDA APENAS COM JSON, sem markdown.

Formato para executar:
{
  "action": "execute",
  "toolName": "nome_da_tool",
  "parameters": {
    "campo": "valor"
  },
  "confidence": 0.95
}

Formato para perguntar:
{
  "action": "ask",
  "toolName": "nome_da_tool_se_identificada",
  "missingParameters": ["campo_obrigatorio"],
  "question": "Pergunta curta em portugues pedindo o dado que falta.",
  "confidence": 0.8
}`;

  try {
    const responseText = await generateContentWithFallback(
      messageText,
      systemInstruction,
    );
    const parsed = JSON.parse(cleanJsonResponse(responseText));
    const plan = applyShortTermMemoryToPlan(
      normalizePlan(parsed),
      messageText,
      shortTermMemory,
    );

    if (plan.action === "ask") return plan;

    const tool = plannableWhatsappTools.find(
      (availableTool) => availableTool.name === plan.toolName,
    );

    if (!tool) {
      return {
        action: "ask",
        missingParameters: [],
        question: "Pode me dizer um pouco melhor o que voce quer fazer?",
        confidence: 0,
      };
    }

    const missingParameters = validateRequiredParameters(
      tool,
      plan.parameters,
      messageText,
    );

    if (missingParameters.length > 0) {
      return {
        action: "ask",
        toolName: tool.name,
        missingParameters,
        question: buildMissingParameterQuestion(tool, missingParameters),
        confidence: plan.confidence,
      };
    }

    return plan;
  } catch (error) {
    console.error("Erro ao planejar ferramenta:", error);
    return {
      action: "ask",
      missingParameters: [],
      question:
        "Nao consegui entender com seguranca. Voce pode reformular o pedido?",
      confidence: 0,
    };
  }
}

export async function generateResponseFromToolResult({
  messageText,
  conversationHistory,
  tool,
  parameters,
  result,
}: ToolResultResponseInput): Promise<string> {
  const systemInstruction = `Voce e o assistente financeiro B-Finances no WhatsApp.
Gere a resposta final ao usuario usando exclusivamente o resultado da ferramenta.

HISTORICO DA CONVERSA:
${conversationHistory}

FERRAMENTA EXECUTADA:
${JSON.stringify({
  name: tool.name,
  description: tool.description,
  parameters,
})}

RESULTADO DA FERRAMENTA:
${typeof result === "string" ? result : JSON.stringify(result)}

REGRAS:
- Nao invente informacoes.
- Preserve valores, datas, listas numeradas e pedidos de confirmacao do resultado.
- Se o resultado ja estiver pronto para o usuario, retorne o mesmo conteudo ou ajuste minimamente o tom.
- Para find_transaction com mais de um resultado, preserve a lista e peca para o usuario escolher pelo numero. Nunca escolha uma transacao automaticamente.
- Responda apenas com a mensagem final em portugues, sem JSON e sem markdown de bloco.`;

  try {
    return await generateContentWithFallback(messageText, systemInstruction);
  } catch (error) {
    console.error("Erro ao gerar resposta final:", error);
    return typeof result === "string" ? result : JSON.stringify(result);
  }
}
