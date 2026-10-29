import type { BFinanceCommand } from "./types";

export type FastRouteResult =
  | { type: "instant_reply"; message: string }
  | { type: "command"; command: BFinanceCommand }
  | { type: "none" };

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Roteador determinístico (Tier 1) de altíssima velocidade (0ms de IA).
 * Intercepta saudações, pedidos de ajuda, ping e consultas frequentes
 * sem gastar cota do Gemini e sem nenhuma latência de rede externa.
 */
export function resolveFastRoute(
  messageText: string,
  requestStartedAt?: number,
): FastRouteResult {
  const normalized = normalizeText(messageText);

  // 1. Comando PING (para teste de latência)
  if (/^!?ping\b/i.test(normalized) || normalized === "ping") {
    const elapsed = requestStartedAt ? Date.now() - requestStartedAt : 0;
    const latencyInfo = elapsed > 0 ? `\n⏱️ *Tempo de processamento:* ${elapsed}ms` : "";
    return {
      type: "instant_reply",
      message: `🏓 *Pong!*${latencyInfo}\n⚡ *Status:* Online e operacional\n🚀 *Motor:* Resposta determinística instantânea`,
    };
  }

  // 2. Saudações e conversa básica
  if (
    /^(oi|ola|olá|bom dia|boa tarde|boa noite|e ai|eai|opa|fala ai|fala aí)\b/i.test(
      normalized,
    ) &&
    normalized.length < 25
  ) {
    return {
      type: "instant_reply",
      message: [
        "Olá! 👋 Sou o assistente financeiro do *B-Finances*.",
        "",
        "💡 *Como posso te ajudar agora?*",
        "• _\"Gastei 45 no almoço\"_ (registra despesa)",
        "• _\"Recebi 500 do freela\"_ (registra receita)",
        "• _\"Uber 25 no Nubank\"_ (compra no cartão)",
        "• _\"Saldo\"_ (seu balanço atual)",
        "• _\"Gastos de hoje\"_ (despesas do dia)",
        "• _\"Quanto gastei este mês?\"_ (total mensal)",
        "• _\"Fatura\"_ (suas faturas em aberto)",
        "• _\"Ajuda\"_ (ver todos os comandos)",
      ].join("\n"),
    };
  }

  // 3. Agradecimentos
  if (
    /^(valeu|obrigado|obrigada|vlw|muito obrigado|agradecido|obg)\b/i.test(
      normalized,
    ) &&
    normalized.length < 20
  ) {
    return {
      type: "instant_reply",
      message: "Por nada! Sempre que precisar de uma força com as finanças, é só chamar! 🚀",
    };
  }

  // 4. Ajuda e Menu de Comandos
  if (
    /^(ajuda|help|menu|comandos|como funciona|o que voce faz|o que você faz)\b/i.test(
      normalized,
    ) &&
    normalized.length < 25
  ) {
    return {
      type: "instant_reply",
      message: [
        "📋 *Guia de Comandos do B-Finances*",
        "",
        "💰 *Registrar Dinheiro:*",
        "• `Almoço 35` (despesa rápida)",
        "• `Recebi 2500 do salário` (receita)",
        "• `Mercado 150 no débito`",
        "• `Tênis 300 em 3x no Nubank`",
        "",
        "📊 *Consultas Rápidas:*",
        "• `Saldo` (resumo geral)",
        "• `Gastos hoje` (despesas de hoje)",
        "• `Gastos do mês` (total deste mês)",
        "• `Faturas` (faturas de cartão)",
        "• `Contas a pagar` (contas pendentes)",
        "• `Investimentos` (posição atual)",
        "",
        "✏️ *Edição e Exclusão:*",
        "• `Altere o valor para 50`",
        "• `Apaga o último gasto`",
        "",
        "⚡ *Teste de Velocidade:*",
        "• `ping` (mede o tempo de resposta do bot)",
      ].join("\n"),
    };
  }

  // 5. Consultas Rápidas Determinísticas (BFinanceCommand direto, 0ms de IA)
  // 5.1. Saldo / Resumo Geral
  if (/^(saldo|meu saldo|ver saldo|balanco|meu balanço|resumo geral)$/i.test(normalized)) {
    return {
      type: "command",
      command: {
        action: "query",
        resource: "summary",
        operation: "summary",
        confidence: 1,
      },
    };
  }

  // 5.2. Gastos de Hoje
  if (/^(gastos (de )?hoje|despesas (de )?hoje|quanto gastei hoje|o que gastei hoje)$/i.test(normalized)) {
    return {
      type: "command",
      command: {
        action: "query",
        resource: "transaction",
        operation: "list",
        transactionType: "expense",
        period: {
          raw: "hoje",
          type: "today",
          startDate: null,
          endDate: null,
          month: null,
          year: null,
          days: null,
          isExplicit: true,
        },
        confidence: 1,
      },
    };
  }

  // 5.3. Gastos do Mês
  if (
    /^(gastos (deste|desse|do) mes|despesas (deste|desse|do) mes|quanto gastei (este|esse|no) mes)$/i.test(
      normalized,
    )
  ) {
    return {
      type: "command",
      command: {
        action: "query",
        resource: "transaction",
        operation: "total",
        transactionType: "expense",
        period: {
          raw: "este mês",
          type: "current_month",
          startDate: null,
          endDate: null,
          month: null,
          year: null,
          days: null,
          isExplicit: true,
        },
        confidence: 1,
      },
    };
  }

  // 5.4. Faturas de Cartão
  if (/^(fatura|faturas|minhas faturas|faturas em aberto|fatura atual)$/i.test(normalized)) {
    return {
      type: "command",
      command: {
        action: "query",
        resource: "invoice",
        operation: "list",
        confidence: 1,
      },
    };
  }

  // 5.5. Contas a Pagar / Pendentes
  if (/^(contas a pagar|contas pendentes|minhas contas|boletos a pagar|boletos pendentes)$/i.test(normalized)) {
    return {
      type: "command",
      command: {
        action: "query",
        resource: "bill",
        operation: "list",
        confidence: 1,
      },
    };
  }

  // 5.6. Investimentos
  if (/^(investimentos|meus investimentos|carteira de investimentos|patrimonio)$/i.test(normalized)) {
    return {
      type: "command",
      command: {
        action: "query",
        resource: "investment",
        operation: "summary",
        confidence: 1,
      },
    };
  }

  return { type: "none" };
}

