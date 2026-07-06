import { normalizeCommandFilters } from "./normalizers/filterNormalizer";
import { normalizeCommandPeriod } from "./normalizers/periodNormalizer";
import { normalizeCommandScope } from "./normalizers/scopeNormalizer";
import type { BFinanceCommand } from "./types";

type ManualExpected = {
  action?: BFinanceCommand["action"];
  resource?: BFinanceCommand["resource"];
  operation?: BFinanceCommand["operation"];
  transactionType?: BFinanceCommand["transactionType"];
  period?: Partial<NonNullable<BFinanceCommand["period"]>>;
  scope?: Partial<NonNullable<BFinanceCommand["scope"]>>;
  filters?: Partial<NonNullable<BFinanceCommand["filters"]>>;
  note: string;
};

type ManualCase = {
  id: number;
  message: string;
  inputCommand: BFinanceCommand;
  previousCommand?: BFinanceCommand;
  expected: ManualExpected;
};

const CURRENT_DATE = new Date(2026, 6, 3);

function baseQueryCommand(
  overrides: Partial<BFinanceCommand> = {},
): BFinanceCommand {
  return {
    action: "query",
    resource: "transaction",
    operation: "list",
    transactionType: "expense",
    period: {
      raw: null,
      type: "all",
      startDate: null,
      endDate: null,
      month: null,
      year: null,
      days: null,
      isExplicit: false,
    },
    scope: {
      includeNormalTransactions: true,
      includeCardTransactions: true,
      cardName: null,
      excludeCardTransactions: false,
      paymentMethod: null,
      excludePaymentMethod: null,
    },
    filters: {
      orderBy: "date_desc",
    },
    confidence: 0.9,
    ...overrides,
  };
}

const juneIncomeList = baseQueryCommand({
  transactionType: "income",
  period: {
    raw: "junho",
    type: "specific_month",
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    month: 6,
    year: 2026,
    days: null,
    isExplicit: true,
  },
});

export const manualCommandNormalizerCases: ManualCase[] = [
  {
    id: 1,
    message: "Liste todas as minhas despesas",
    inputCommand: baseQueryCommand({
      resource: "card_transaction",
      scope: {
        includeNormalTransactions: false,
        includeCardTransactions: true,
      },
    }),
    expected: {
      resource: "transaction",
      transactionType: "expense",
      scope: {
        includeNormalTransactions: true,
        includeCardTransactions: true,
      },
      note: "Consulta geral de despesas, nao apenas cartao.",
    },
  },
  {
    id: 2,
    message: "Liste apenas as despesas do cartao Nubank",
    inputCommand: baseQueryCommand(),
    expected: {
      resource: "card_transaction",
      scope: {
        includeNormalTransactions: false,
        includeCardTransactions: true,
        cardName: "Nubank",
      },
      note: "Apenas cardTransactions do Nubank.",
    },
  },
  {
    id: 3,
    message: "Liste minhas despesas, mas ignore cartao",
    inputCommand: baseQueryCommand({
      scope: {
        includeNormalTransactions: false,
        includeCardTransactions: true,
      },
    }),
    expected: {
      scope: {
        includeNormalTransactions: true,
        includeCardTransactions: false,
        excludeCardTransactions: true,
        excludePaymentMethod: "credit_card",
      },
      note: "Apenas transacoes normais, sem cardTransactions.",
    },
  },
  {
    id: 4,
    message: "Liste somente compras feitas no cartao",
    inputCommand: baseQueryCommand(),
    expected: {
      resource: "card_transaction",
      scope: {
        includeNormalTransactions: false,
        includeCardTransactions: true,
      },
      note: "Apenas cardTransactions.",
    },
  },
  {
    id: 5,
    message: "Quanto gastei mes passado?",
    inputCommand: baseQueryCommand({
      operation: "total",
      period: {
        raw: "mes atual",
        type: "current_month",
        isExplicit: true,
      },
    }),
    expected: {
      operation: "total",
      period: {
        type: "last_month",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
      note: "Total de despesas de 01/06/2026 a 30/06/2026.",
    },
  },
  {
    id: 6,
    message: "Quanto gastei nos ultimos 30 dias?",
    inputCommand: baseQueryCommand({ operation: "total" }),
    expected: {
      period: {
        type: "last_n_days",
        startDate: "2026-06-04",
        endDate: "2026-07-03",
        days: 30,
      },
      note: "Intervalo movel de 30 dias, nao mes passado.",
    },
  },
  {
    id: 7,
    message: "Liste meus ganhos de junho",
    inputCommand: baseQueryCommand({ transactionType: "income" }),
    expected: {
      transactionType: "income",
      period: {
        type: "specific_month",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
      note: "Lista de receitas de junho.",
    },
  },
  {
    id: 8,
    message: "Agora so os acima de R$500",
    previousCommand: juneIncomeList,
    inputCommand: {
      action: "clarify",
      resource: "transaction",
      confidence: 0.5,
    },
    expected: {
      action: "query",
      transactionType: "income",
      period: {
        type: "specific_month",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
      filters: {
        minAmount: 500,
      },
      note: "Continua receitas de junho e aplica minAmount 500.",
    },
  },
  {
    id: 9,
    message: "Ordene do maior para o menor",
    previousCommand: {
      ...juneIncomeList,
      filters: { minAmount: 500, orderBy: "date_desc" },
    },
    inputCommand: {
      action: "clarify",
      resource: "transaction",
      confidence: 0.5,
    },
    expected: {
      action: "query",
      transactionType: "income",
      filters: {
        minAmount: 500,
        orderBy: "amount_desc",
      },
      note: "Continua a lista anterior e ordena por valor desc.",
    },
  },
  {
    id: 10,
    message: "Apague aquela compra",
    inputCommand: {
      action: "delete",
      resource: "transaction",
      operation: "detail",
      transactionType: "expense",
      data: { description: "aquela compra" },
      confidence: 0.9,
    },
    expected: {
      action: "delete",
      note: "Executor deve pedir qual compra ou buscar pistas; nunca falhar seco.",
    },
  },
  {
    id: 11,
    message: "Estou gastando muito?",
    inputCommand: {
      action: "query",
      resource: "summary",
      operation: "summary",
      transactionType: "expense",
      confidence: 0.9,
    },
    expected: {
      action: "query",
      resource: "summary",
      note: "Webhook deve limpar pendingAction antes e processar como nova pergunta.",
    },
  },
  {
    id: 12,
    message: "Despesas do mes passado exceto cartao",
    inputCommand: baseQueryCommand(),
    expected: {
      period: {
        type: "last_month",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
      scope: {
        includeNormalTransactions: true,
        includeCardTransactions: false,
        excludeCardTransactions: true,
      },
      note: "Junho/2026, despesas normais, sem cardTransactions.",
    },
  },
  {
    id: 13,
    message: "Resumo financeiro do mes passado",
    inputCommand: {
      action: "query",
      resource: "summary",
      operation: "summary",
      confidence: 0.9,
    },
    expected: {
      resource: "summary",
      period: {
        type: "last_month",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
      scope: {
        includeNormalTransactions: true,
        includeCardTransactions: true,
      },
      note: "Resumo geral com receitas, despesas, cartoes, saldo, contas e investimentos.",
    },
  },
  {
    id: 14,
    message: "Gastos do cartao Inter",
    inputCommand: baseQueryCommand(),
    expected: {
      resource: "card_transaction",
      scope: {
        includeNormalTransactions: false,
        includeCardTransactions: true,
        cardName: "Inter",
      },
      note: "Apenas cartao Inter.",
    },
  },
  {
    id: 15,
    message: "Fatura do Nubank",
    inputCommand: {
      action: "query",
      resource: "invoice",
      operation: "detail",
      confidence: 0.9,
    },
    expected: {
      resource: "invoice",
      scope: {
        includeNormalTransactions: false,
        includeCardTransactions: true,
        cardName: "Nubank",
      },
      note: "Fatura do Nubank, nao resumo geral.",
    },
  },
  {
    id: 16,
    message: "Minhas contas a pagar",
    inputCommand: {
      action: "query",
      resource: "bill",
      operation: "list",
      confidence: 0.9,
    },
    expected: {
      resource: "bill",
      operation: "list",
      note: "Contas pendentes.",
    },
  },
  {
    id: 17,
    message: "Meus investimentos",
    inputCommand: {
      action: "query",
      resource: "investment",
      operation: "summary",
      confidence: 0.9,
    },
    expected: {
      resource: "investment",
      operation: "summary",
      note: "Resumo de investimentos.",
    },
  },
  {
    id: 18,
    message: "Gastei 50 conto no lanche",
    inputCommand: {
      action: "create",
      resource: "transaction",
      transactionType: "expense",
      data: { description: "lanche", amount: 50, category: "foods" },
      confidence: 0.9,
    },
    expected: {
      action: "create",
      transactionType: "expense",
      filters: {
        category: "foods",
      },
      note: "Adicionar despesa de R$50, descricao lanche, categoria alimentacao se possivel.",
    },
  },
  {
    id: 19,
    message: "Recebi 300 do freela",
    inputCommand: {
      action: "create",
      resource: "transaction",
      transactionType: "income",
      data: { description: "freela", amount: 300, category: "extra" },
      confidence: 0.9,
    },
    expected: {
      action: "create",
      transactionType: "income",
      filters: {
        category: "extra",
      },
      note: "Adicionar receita de R$300.",
    },
  },
  {
    id: 20,
    message: "qnt gastei no mercado mes passado?",
    inputCommand: baseQueryCommand({ operation: "total" }),
    expected: {
      operation: "total",
      transactionType: "expense",
      period: {
        type: "last_month",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
      filters: {
        category: "foods",
        description: "mercado",
      },
      note: "Despesa filtrada por descricao/categoria mercado no mes passado.",
    },
  },
  {
    id: 21,
    message: "Quero meus gastos com cartao da ultima semana",
    inputCommand: baseQueryCommand(),
    expected: {
      resource: "card_transaction",
      period: {
        type: "last_week",
        startDate: "2026-06-21",
        endDate: "2026-06-27",
      },
      scope: {
        includeNormalTransactions: false,
        includeCardTransactions: true,
      },
      note: "Semana deve ir de domingo a sabado e escopo deve ser apenas cartao.",
    },
  },
  {
    id: 22,
    message: "Quero meus gastos com o cartao inter dos ultimos 10 dias",
    inputCommand: baseQueryCommand(),
    expected: {
      resource: "card_transaction",
      period: {
        type: "last_n_days",
        startDate: "2026-06-24",
        endDate: "2026-07-03",
        days: 10,
      },
      scope: {
        includeNormalTransactions: false,
        includeCardTransactions: true,
        cardName: "Inter",
      },
      note: "Ultimos N dias com filtro de cartao especifico.",
    },
  },
  {
    id: 23,
    message: "Quero todos meus gastos da ultima semana",
    inputCommand: baseQueryCommand(),
    expected: {
      period: {
        type: "last_week",
        startDate: "2026-06-21",
        endDate: "2026-06-27",
      },
      scope: {
        includeNormalTransactions: true,
        includeCardTransactions: true,
      },
      note: "Todos os gastos da semana inclui transacoes normais e cartao.",
    },
  },
  {
    id: 24,
    message: "Quero minhas contas da proxima semana",
    inputCommand: {
      action: "query",
      resource: "bill",
      operation: "list",
      confidence: 0.9,
    },
    expected: {
      resource: "bill",
      period: {
        type: "next_week",
        startDate: "2026-07-05",
        endDate: "2026-07-11",
      },
      note: "Contas da proxima semana filtram dueDate no executor.",
    },
  },
  {
    id: 25,
    message: "Me de os gastos da data 01/06 ate a data 15/06",
    inputCommand: baseQueryCommand(),
    expected: {
      period: {
        type: "date_range",
        startDate: "2026-06-01",
        endDate: "2026-06-15",
      },
      note: "Intervalo explicito deve preencher startDate e endDate.",
    },
  },
  {
    id: 26,
    message: "Liste os gastos do meu cartao",
    inputCommand: baseQueryCommand(),
    expected: {
      resource: "card_transaction",
      period: {
        type: "all",
        isExplicit: false,
      },
      scope: {
        includeNormalTransactions: false,
        includeCardTransactions: true,
        cardName: null,
      },
      note: "Executor deve trocar para fatura atual ou perguntar cartao conforme os cartoes do usuario.",
    },
  },
  {
    id: 27,
    message: "Me de todo o historico do cartao Inter",
    inputCommand: baseQueryCommand(),
    expected: {
      resource: "card_transaction",
      period: {
        type: "all",
        isExplicit: true,
      },
      scope: {
        includeNormalTransactions: false,
        includeCardTransactions: true,
        cardName: "Inter",
      },
      note: "Historico completo do cartao deve manter periodo all explicito.",
    },
  },
];

export function normalizeForManualTest(
  message: string,
  inputCommand: BFinanceCommand,
  previousCommand?: BFinanceCommand,
): BFinanceCommand {
  const context = { previousCommand: previousCommand ?? null };
  let command = normalizeCommandPeriod(
    message,
    inputCommand,
    CURRENT_DATE,
    context,
  );
  command = normalizeCommandScope(message, command, CURRENT_DATE, context);
  command = normalizeCommandFilters(message, command, CURRENT_DATE, context);
  return command;
}

function assertPartial(
  label: string,
  actual: Record<string, unknown> | undefined,
  expected: Record<string, unknown> | undefined,
): string[] {
  if (!expected) return [];

  return Object.entries(expected).flatMap(([key, expectedValue]) => {
    const actualValue = actual?.[key];
    return actualValue === expectedValue
      ? []
      : [`${label}.${key}: esperado ${String(expectedValue)}, recebido ${String(actualValue)}`];
  });
}

export function runManualCommandNormalizerChecks(): string[] {
  return manualCommandNormalizerCases.flatMap((testCase) => {
    const command = normalizeForManualTest(
      testCase.message,
      testCase.inputCommand,
      testCase.previousCommand,
    );
    const failures = [
      ...assertPartial("period", command.period, testCase.expected.period),
      ...assertPartial("scope", command.scope, testCase.expected.scope),
      ...assertPartial("filters", command.filters, testCase.expected.filters),
    ];

    if (
      testCase.expected.action &&
      command.action !== testCase.expected.action
    ) {
      failures.push(
        `action: esperado ${testCase.expected.action}, recebido ${command.action}`,
      );
    }

    if (
      testCase.expected.resource &&
      command.resource !== testCase.expected.resource
    ) {
      failures.push(
        `resource: esperado ${testCase.expected.resource}, recebido ${command.resource}`,
      );
    }

    if (
      testCase.expected.operation &&
      command.operation !== testCase.expected.operation
    ) {
      failures.push(
        `operation: esperado ${testCase.expected.operation}, recebido ${command.operation}`,
      );
    }

    if (
      testCase.expected.transactionType &&
      command.transactionType !== testCase.expected.transactionType
    ) {
      failures.push(
        `transactionType: esperado ${testCase.expected.transactionType}, recebido ${command.transactionType}`,
      );
    }

    return failures.map((failure) => `Caso ${testCase.id}: ${failure}`);
  });
}
