type CategoryDefinition = {
  label: string;
  emoji: string;
};

const CATEGORY_DEFINITIONS: Record<string, CategoryDefinition> = {
  salary: { label: "Salário", emoji: "💼" },
  extra: { label: "Extra", emoji: "✨" },
  other: { label: "Outros", emoji: "🏷️" },
  fixes: { label: "Fixas", emoji: "🧾" },
  contas: { label: "Contas", emoji: "📄" },
  foods: { label: "Alimentação", emoji: "🍟" },
  housing: { label: "Moradia", emoji: "🏠" },
  transport: { label: "Transporte", emoji: "🚌" },
  delivery: { label: "Delivery", emoji: "🛵" },
  shopping: { label: "Compras", emoji: "🛍️" },
  subscriptions: { label: "Assinaturas", emoji: "🔄" },
  entertainment: { label: "Lazer", emoji: "🎬" },
  credit_card: { label: "Cartão de crédito", emoji: "💳" },
  "credit card": { label: "Cartão de crédito", emoji: "💳" },
  cdb: { label: "CDB", emoji: "🏦" },
  imoveis: { label: "Imóveis", emoji: "🏘️" },
  cripto: { label: "Cripto", emoji: "🪙" },
  acoes: { label: "Ações", emoji: "📈" },
  fundos: { label: "Fundos", emoji: "📊" },
};

export const CATEGORY_ALIASES: Array<{ category: string; terms: string[] }> = [
  {
    category: "foods",
    terms: ["alimentacao", "comida", "mercado", "supermercado", "restaurante", "lanche"],
  },
  {
    category: "housing",
    terms: ["moradia", "aluguel", "condominio", "habitacao", "casa"],
  },
  {
    category: "transport",
    terms: ["transporte", "uber", "taxi", "gasolina", "combustivel", "estacionamento", "onibus", "metro"],
  },
  {
    category: "delivery",
    terms: ["delivery", "ifood", "entrega"],
  },
  {
    category: "shopping",
    terms: ["compras", "shopping", "roupa", "roupas", "calcado", "calcados", "eletronicos"],
  },
  {
    category: "subscriptions",
    terms: ["assinatura", "assinaturas", "mensalidade", "streaming", "netflix", "spotify", "prime"],
  },
  {
    category: "fixes",
    terms: ["fixas", "conta", "contas", "conta fixa", "contas fixas", "internet", "luz", "agua", "telefone"],
  },
  {
    category: "entertainment",
    terms: ["lazer", "cinema", "festa", "viagem", "jogo", "jogos", "show"],
  },
  {
    category: "salary",
    terms: ["salario", "ordenado"],
  },
  {
    category: "extra",
    terms: ["extra", "freela", "bonus", "premio", "rendimento"],
  },
  {
    category: "other",
    terms: ["outro", "outros"],
  },
];

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}

export function getCategoryLabel(category?: string | null): string {
  if (!category) return "Sem categoria";
  return CATEGORY_DEFINITIONS[normalizeCategory(category)]?.label ?? category;
}

export function getCategoryEmoji(category?: string | null): string {
  if (!category) return "🏷️";
  return CATEGORY_DEFINITIONS[normalizeCategory(category)]?.emoji ?? "🏷️";
}

export function formatCategoryWithEmoji(category?: string | null): string {
  return `${getCategoryEmoji(category)} ${getCategoryLabel(category)}`;
}
