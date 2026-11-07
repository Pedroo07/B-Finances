import { normalizeForMatch } from "./normalize.ts";

export const DEFAULT_IMPORT_CATEGORY = "other";

const KEYWORD_RULES: { category: string; keywords: string[] }[] = [
  {
    category: "shopping",
    keywords: ["mercado livre", "mercadolivre"],
  },
  {
    category: "delivery",
    keywords: [
      "ifood",
      "rappi",
      "uber eats",
      "ubereats",
      "aiqfome",
      "delivery",
    ],
  },
  {
    category: "subscriptions",
    keywords: [
      "spotify",
      "netflix",
      "youtube",
      "disney",
      "hbo",
      "max com",
      "prime video",
      "amazon prime",
      "deezer",
      "icloud",
      "apple com bill",
      "google one",
      "globoplay",
      "paramount",
      "crunchyroll",
      "chatgpt",
      "openai",
    ],
  },
  {
    category: "transport",
    keywords: [
      "posto",
      "uber",
      "shell",
      "ipiranga",
      "combustivel",
      "estacionamento",
      "pedagio",
      "sem parar",
      "taxi",
      "cabify",
    ],
  },
  {
    category: "foods",
    keywords: [
      "supermercado",
      "mercado",
      "padaria",
      "panificadora",
      "confeit",
      "acougue",
      "emporio",
      "restaurante",
      "lanchonete",
      "hortifruti",
      "atacadao",
      "assai",
      "pizzaria",
      "sorveteria",
      "cafe",
    ],
  },
  {
    category: "housing",
    keywords: [
      "aluguel",
      "condominio",
      "energia",
      "saneamento",
      "copel",
      "cemig",
      "enel",
      "sabesp",
    ],
  },
  {
    category: "fixes",
    keywords: [
      "vivo",
      "claro",
      "tim",
      "oi fibra",
      "internet",
      "escola",
      "faculdade",
      "seguro",
      "plano de saude",
      "clinica",
      "farmacia",
      "drogaria",
    ],
  },
  {
    category: "entertainment",
    keywords: [
      "cinema",
      "ingresso",
      "steam",
      "playstation",
      "xbox",
      "nintendo",
      "teatro",
      "show",
    ],
  },
  {
    category: "shopping",
    keywords: [
      "amazon",
      "shopee",
      "mercado livre",
      "mercadolivre",
      "magalu",
      "magazine",
      "americanas",
      "shein",
      "aliexpress",
      "renner",
      "riachuelo",
      "loja",
    ],
  },
];

export function suggestCategory(description: string): string {
  const haystack = ` ${normalizeForMatch(description)} `;

  for (const rule of KEYWORD_RULES) {
    const matched = rule.keywords.some((keyword) =>
      haystack.includes(keyword.length <= 3 ? ` ${keyword} ` : keyword),
    );
    if (matched) return rule.category;
  }

  return DEFAULT_IMPORT_CATEGORY;
}
