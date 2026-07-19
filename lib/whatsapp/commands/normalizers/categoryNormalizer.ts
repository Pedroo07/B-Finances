import type { BFinanceCommand, BFinanceTransactionType } from "../types";

const EXPENSE_CATEGORIES = [
  "fixes",
  "foods",
  "housing",
  "transport",
  "delivery",
  "shopping",
  "subscriptions",
  "entertainment",
  "other",
] as const;

const INCOME_CATEGORIES = ["salary", "extra", "other"] as const;

type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type TransactionCategory = ExpenseCategory | IncomeCategory;

type CategoryRule = {
  category: ExpenseCategory;
  strongTerms?: string[];
  terms: string[];
};

const CATEGORY_ALIASES: Record<TransactionCategory, string[]> = {
  fixes: [
    "fixes",
    "fixas",
    "fixa",
    "conta",
    "contas",
    "contas fixas",
    "despesas fixas",
  ],
  foods: [
    "foods",
    "food",
    "alimentacao",
    "alimento",
    "alimentos",
    "comida",
    "comidas",
  ],
  housing: ["housing", "moradia", "habitacao", "casa"],
  transport: ["transport", "transporte", "locomocao"],
  delivery: ["delivery", "entrega", "comida por delivery"],
  shopping: ["shopping", "compra", "compras"],
  subscriptions: ["subscriptions", "subscription", "assinatura", "assinaturas"],
  entertainment: ["entertainment", "lazer", "entretenimento"],
  salary: ["salary", "salario", "ordenado"],
  extra: ["extra", "renda extra", "receita extra"],
  other: ["other", "outro", "outros", "outra", "outras"],
};

const EXPENSE_RULES: CategoryRule[] = [
  {
    category: "delivery",
    strongTerms: [
      "ifood",
      "i food",
      "rappi",
      "aiqfome",
      "99 food",
      "uber eats",
      "z delivery",
    ],
    terms: ["delivery", "tele entrega", "entrega de comida", "pedido entregue"],
  },
  {
    category: "shopping",
    strongTerms: [
      "mercado livre",
      "amazon",
      "shopee",
      "shein",
      "aliexpress",
      "magalu",
      "magazine luiza",
      "casas bahia",
      "renner",
      "riachuelo",
      "cea",
    ],
    terms: [
      "roupa",
      "roupas",
      "camisa",
      "camiseta",
      "calca",
      "vestido",
      "tenis",
      "sapato",
      "calcado",
      "eletronico",
      "eletronicos",
      "celular",
      "smartphone",
      "notebook",
      "computador",
      "fone",
      "presente",
      "cosmetico",
      "cosmeticos",
      "maquiagem",
      "perfume",
      "farmacia",
      "remedio",
    ],
  },
  {
    category: "subscriptions",
    strongTerms: [
      "netflix",
      "spotify",
      "prime video",
      "amazon prime",
      "disney plus",
      "disney",
      "hbo max",
      "youtube premium",
      "apple music",
      "google one",
      "icloud",
      "deezer",
      "globoplay",
      "crunchyroll",
      "game pass",
    ],
    terms: [
      "assinatura",
      "mensalidade",
      "streaming",
      "plano recorrente",
      "academia",
    ],
  },
  {
    category: "transport",
    strongTerms: [
      "uber",
      "99 taxi",
      "99 pop",
      "cabify",
      "sem parar",
      "veloe",
      "posto de gasolina",
    ],
    terms: [
      "taxi",
      "gasolina",
      "etanol",
      "diesel",
      "combustivel",
      "abastecimento",
      "abasteci",
      "estacionamento",
      "pedagio",
      "onibus",
      "metro",
      "trem",
      "passagem",
      "bilhete unico",
      "transporte",
      "corrida",
    ],
  },
  {
    category: "housing",
    strongTerms: [
      "financiamento imobiliario",
      "prestacao da casa",
      "seguro residencial",
    ],
    terms: [
      "aluguel",
      "condominio",
      "iptu",
      "moradia",
      "habitacao",
      "reforma",
      "material de construcao",
    ],
  },
  {
    category: "foods",
    strongTerms: [
      "pao de acucar",
      "carrefour",
      "assai",
      "atacadao",
      "outback",
      "mcdonalds",
      "mc donalds",
      "burger king",
      "starbucks",
    ],
    terms: [
      "mercado",
      "supermercado",
      "hortifruti",
      "sacolao",
      "acougue",
      "padaria",
      "restaurante",
      "lanchonete",
      "cafeteria",
      "almoco",
      "jantar",
      "refeicao",
      "comida",
      "alimento",
      "alimentos",
      "lanche",
      "pizza",
      "hamburguer",
      "sorvete",
      "cafe",
    ],
  },
  {
    category: "entertainment",
    strongTerms: [
      "ingresso de cinema",
      "ingresso do show",
      "parque de diversoes",
    ],
    terms: [
      "cinema",
      "teatro",
      "show",
      "festa",
      "bar",
      "balada",
      "viagem",
      "passeio",
      "ingresso",
      "parque",
      "hotel",
      "pousada",
      "jogo",
      "videogame",
      "boliche",
    ],
  },
  {
    category: "fixes",
    strongTerms: [
      "conta de luz",
      "conta de energia",
      "conta de agua",
      "conta de gas",
      "conta de internet",
      "conta de telefone",
      "conta de celular",
      "plano de celular",
      "seguro do carro",
    ],
    terms: [
      "energia eletrica",
      "energia",
      "luz",
      "internet",
      "telefone",
      "celular pos pago",
      "agua",
      "esgoto",
      "gas encanado",
      "seguro",
      "conta",
      "contas",
      "boleto",
    ],
  },
];

const INCOME_RULES: Array<{
  category: IncomeCategory;
  strongTerms?: string[];
  terms: string[];
}> = [
  {
    category: "salary",
    strongTerms: [
      "salario",
      "decimo terceiro",
      "13 salario",
      "pagamento da empresa",
      "folha de pagamento",
    ],
    terms: ["ordenado", "holerite", "adiantamento salarial"],
  },
  {
    category: "extra",
    strongTerms: [
      "freela",
      "freelance",
      "renda extra",
      "trabalho extra",
      "cashback",
    ],
    terms: [
      "bico",
      "bonus",
      "premio",
      "comissao",
      "gorjeta",
      "rendimento",
      "venda",
      "reembolso",
    ],
  },
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesTerm(normalizedText: string, rawTerm: string): boolean {
  const term = normalizeText(rawTerm);
  return Boolean(term) && ` ${normalizedText} `.includes(` ${term} `);
}

function aliasesForType(
  transactionType: BFinanceTransactionType,
): Array<[TransactionCategory, string[]]> {
  const allowed =
    transactionType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return allowed.map((category) => [category, CATEGORY_ALIASES[category]]);
}

export function canonicalizeTransactionCategory(
  category: string | null | undefined,
  transactionType: BFinanceTransactionType,
): TransactionCategory | null {
  if (!category) return null;
  const normalized = normalizeText(category);
  if (!normalized) return null;

  for (const [canonical, aliases] of aliasesForType(transactionType)) {
    if (
      normalized === normalizeText(canonical) ||
      aliases.some((alias) => normalized === normalizeText(alias))
    ) {
      return canonical;
    }
  }

  return null;
}

function findMentionedCategory(
  text: string,
  transactionType: BFinanceTransactionType,
): TransactionCategory | null {
  const normalized = normalizeText(text);

  for (const [category, aliases] of aliasesForType(transactionType)) {
    if (aliases.some((alias) => includesTerm(normalized, alias))) {
      return category;
    }
  }

  return null;
}

function extractExplicitCategory(
  messageText: string,
  transactionType: BFinanceTransactionType,
): TransactionCategory | null {
  const normalized = normalizeText(messageText);
  const categoryInstruction =
    normalized.match(
      /\b(?:categoria|categorize|categorizar|classifique|classificar)\b(?:\s+(?:como|em|na|no))?\s+(.{1,40})$/,
    ) ||
    normalized.match(
      /\b(?:coloque|registre|lance)\b.{0,20}\b(?:como|na|no)\s+(.{1,30})$/,
    );

  return categoryInstruction
    ? findMentionedCategory(categoryInstruction[1], transactionType)
    : null;
}

function buildSearchText(
  messageText: string,
  description?: string | null,
): string {
  const normalizedMessage = normalizeText(messageText);
  const normalizedDescription = normalizeText(description ?? "");

  if (
    !normalizedDescription ||
    normalizedMessage.includes(normalizedDescription)
  ) {
    return normalizedMessage;
  }

  return `${normalizedMessage} ${normalizedDescription}`.trim();
}

function inferFromRules(
  normalizedText: string,
  rules: Array<{
    category: TransactionCategory;
    strongTerms?: string[];
    terms: string[];
  }>,
): TransactionCategory | null {
  const scores = rules
    .map((rule, index) => {
      const strongMatches = (rule.strongTerms ?? []).filter((term) =>
        includesTerm(normalizedText, term),
      ).length;
      const regularMatches = rule.terms.filter((term) =>
        includesTerm(normalizedText, term),
      ).length;

      return {
        category: rule.category,
        index,
        score: strongMatches * 5 + regularMatches * 2,
      };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) => right.score - left.score || left.index - right.index,
    );

  return scores[0]?.category ?? null;
}

export function inferTransactionCategory(
  messageText: string,
  description: string | null | undefined,
  transactionType: BFinanceTransactionType,
): TransactionCategory | null {
  const normalizedText = buildSearchText(messageText, description);
  if (!normalizedText) return null;

  if (transactionType === "income") {
    return inferFromRules(normalizedText, INCOME_RULES);
  }

  const inferredExpense = inferFromRules(normalizedText, EXPENSE_RULES);
  if (inferredExpense) return inferredExpense;

  if (
    includesTerm(normalizedText, "compra") ||
    includesTerm(normalizedText, "compras")
  ) {
    return "shopping";
  }

  return null;
}

type ResolveTransactionCategoryInput = {
  messageText: string;
  description?: string | null;
  transactionType?: BFinanceTransactionType;
  suggestedCategory?: string | null;
  filterCategory?: string | null;
};

export function resolveTransactionCategory({
  messageText,
  description,
  transactionType = "expense",
  suggestedCategory,
  filterCategory,
}: ResolveTransactionCategoryInput): TransactionCategory {
  const effectiveType = transactionType === "income" ? "income" : "expense";
  const explicitCategory = extractExplicitCategory(messageText, effectiveType);
  if (explicitCategory) return explicitCategory;

  const suggested = canonicalizeTransactionCategory(
    suggestedCategory,
    effectiveType,
  );
  if (suggested && suggested !== "other") return suggested;

  const deterministicFilter = canonicalizeTransactionCategory(
    filterCategory,
    effectiveType,
  );
  if (deterministicFilter && deterministicFilter !== "other") {
    return deterministicFilter;
  }

  const inferred = inferTransactionCategory(
    messageText,
    description,
    effectiveType,
  );
  if (inferred) return inferred;

  return effectiveType === "income" ? "extra" : "other";
}

export function normalizeCommandCategory(
  messageText: string,
  command: BFinanceCommand,
): BFinanceCommand {
  if (
    command.action !== "create" ||
    (command.resource !== "transaction" &&
      command.resource !== "card_transaction")
  ) {
    return command;
  }

  const category = resolveTransactionCategory({
    messageText,
    description: command.data?.description ?? command.filters?.description,
    transactionType: command.transactionType,
    suggestedCategory: command.data?.category,
    filterCategory: command.filters?.category,
  });

  return {
    ...command,
    data: {
      ...command.data,
      category,
    },
  };
}
