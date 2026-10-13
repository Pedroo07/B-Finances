import {
  CREDIT_CARD_BANK_KEYS,
  CREDIT_CARD_CATALOG,
} from "@/lib/creditCards/catalog";
import { parseMoney, MONEY_VALUE_PATTERN } from "../utils/moneyParser";
import {
  resolveClosestOption,
  type TransactionValidationOption,
} from "./normalizers/transactionValidation";
import type { BFinanceCommand, BFinancePaymentMethod } from "./types";

/**
 * Interpretador deterministico usado quando a IA esta indisponivel (timeout,
 * 503, JSON invalido...). Cobre apenas o caso mais comum e seguro: criacao de
 * uma transacao simples, ex. "Corte de cabelo 40 reais no cartao nubank".
 *
 * Consultas, edicoes e exclusoes NUNCA sao tratadas aqui: nesses casos retorna
 * null e o fluxo normal pede para o usuario reformular.
 */

type Span = [number, number];

function normalizeText(value: string): string {
  // NFD + remocao de acentos preserva o tamanho de textos em NFC (padrao do
  // WhatsApp), entao os indices do texto normalizado valem para o original.
  return value
    .normalize("NFC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const NON_CREATE_HINTS =
  /\b(quanto|quantos|quantas|qnt|qto|qual|quais|liste|listar|lista|mostre|mostrar|mostra|ver|veja|tem|houve|existe|consult\w*|ultim[oa]s?|resumo|balanco|fatura|faturas|extrato|historico|saldo|relatorio|ranking|grafico|apag\w*|delet\w*|exclu\w*|remov\w*|edit\w*|alter\w*|mud\w*|troc\w*|corrig\w*|atualiz\w*|pendentes?|investimentos?|ajuda)\b|\?/;

const INCOME_HINTS =
  /\b(recebi|recebido|ganhei|entrou|entrada|salario|freela|renda|lucro|vendi)\b/;

const CARD_OPTIONS: TransactionValidationOption[] = CREDIT_CARD_BANK_KEYS.map(
  (bankKey) => ({
    value: CREDIT_CARD_CATALOG[bankKey].name,
    label: CREDIT_CARD_CATALOG[bankKey].name,
    aliases: [
      bankKey,
      bankKey.replace(/_/g, " "),
      ...(bankKey === "inter" ? ["iti"] : []),
      ...(bankKey === "mercado_pago" ? ["mercado"] : []),
      ...(bankKey === "c6bank" ? ["c6 bank"] : []),
    ],
  }),
);

type MoneyHit = { value: number; span: Span };

function findAmount(normalized: string): MoneyHit | null {
  const currencyBefore = new RegExp(`(?:r\\$|rs)\\s*(${MONEY_VALUE_PATTERN})`);
  const currencyAfter = new RegExp(
    `(${MONEY_VALUE_PATTERN})\\s*(?:reais|real|conto|contos|pila|pilas)\\b`,
  );

  for (const pattern of [currencyBefore, currencyAfter]) {
    const match = pattern.exec(normalized);
    if (match) {
      const value = parseMoney(match[1]);
      if (value !== null && value > 0) {
        return { value, span: [match.index, match.index + match[0].length] };
      }
    }
  }

  // Sem moeda explicita: so aceita se houver exatamente um numero que nao
  // seja parcelamento ("10x", "10 vezes").
  const numberPattern = new RegExp(
    `(?<![\\d.,a-z])(${MONEY_VALUE_PATTERN})(?![\\d.,]|\\s*x\\b|\\s*(?:vezes|parcelas)\\b)`,
    "g",
  );
  const hits = [...normalized.matchAll(numberPattern)];
  if (hits.length !== 1 || hits[0].index === undefined) return null;
  const value = parseMoney(hits[0][1]);
  if (value === null || value <= 0) return null;
  return {
    value,
    span: [hits[0].index, hits[0].index + hits[0][0].length],
  };
}

type PaymentHit = {
  paymentMethod: BFinancePaymentMethod | null;
  cardName: string | null;
  spans: Span[];
};

function findCardByName(normalized: string): PaymentHit | null {
  // Nome do banco sem a palavra "cartao" ("40 reais no nubank"). Exige uma
  // preposicao antes para nao confundir "caixa de som" com o cartao Caixa.
  for (const option of CARD_OPTIONS) {
    for (const name of [option.label, ...(option.aliases ?? [])]) {
      const phrase = escapeRegExp(normalizeText(name)).replace(/\s+/g, "\\s+");
      const match = new RegExp(`\\b(?:no|na|pelo|pela)\\s+${phrase}\\b`).exec(
        normalized,
      );
      if (match) {
        return {
          paymentMethod: "credit_card",
          cardName: option.value,
          spans: [[match.index, match.index + match[0].length]],
        };
      }
    }
  }
  return null;
}

function findPayment(normalized: string): PaymentHit {
  const debit =
    /(?:\b(?:no|na|em|via|pelo|pela)\s+)?(?:\bcartao\s+(?:de\s+)?)?\bdebito\b/.exec(
      normalized,
    );
  if (debit) {
    return {
      paymentMethod: "debit",
      cardName: null,
      spans: [[debit.index, debit.index + debit[0].length]],
    };
  }

  const pix = /(?:\b(?:no|na|em|via|pelo|pela|por)\s+)?\bpix\b/.exec(normalized);
  if (pix) {
    return {
      paymentMethod: "pix",
      cardName: null,
      spans: [[pix.index, pix.index + pix[0].length]],
    };
  }

  const cash = /(?:\b(?:no|na|em|com)\s+)?\b(?:dinheiro|especie)\b/.exec(
    normalized,
  );
  if (cash) {
    return {
      paymentMethod: "cash",
      cardName: null,
      spans: [[cash.index, cash.index + cash[0].length]],
    };
  }

  // "cartao <nome>" com tolerancia a erro de digitacao/audio ("cartao inte" => Inter)
  const card =
    /(?:\b(?:no|na|em|pelo|pela|com)\s+)?\bcartao\b(?:\s+de\s+credito\b)?(?:\s+(?:do|da|de)\b)?/.exec(
      normalized,
    );
  if (card) {
    const prefixEnd = card.index + card[0].length;
    const tail = normalized.slice(prefixEnd);
    const wordMatches = [...tail.matchAll(/[a-z0-9]+/g)].slice(0, 2);
    const words = wordMatches.map((match) => ({
      text: match[0],
      end: prefixEnd + (match.index ?? 0) + match[0].length,
    }));

    const candidates =
      words.length >= 2
        ? [words.slice(0, 2), words.slice(0, 1)]
        : words.length === 1
          ? [words.slice(0, 1)]
          : [];

    for (const candidateWords of candidates) {
      const candidate = candidateWords.map((word) => word.text).join(" ");
      const resolution = resolveClosestOption(candidate, CARD_OPTIONS);
      if (resolution.status === "matched") {
        return {
          paymentMethod: "credit_card",
          cardName: resolution.option.value,
          spans: [[card.index, candidateWords[candidateWords.length - 1].end]],
        };
      }
    }

    // Mencionou cartao mas o nome nao bate com o catalogo: repassa o texto cru.
    // O executor compara com os cartoes do usuario e pergunta se precisar.
    const first = words[0];
    const isGenericWord = !first || /^(credito|de|do|da|e)$/.test(first.text);
    return {
      paymentMethod: "credit_card",
      cardName: isGenericWord ? null : first.text,
      spans: [[card.index, first ? first.end : prefixEnd]],
    };
  }

  const byName = findCardByName(normalized);
  if (byName) return byName;

  const credit = /(?:\b(?:no|na|em)\s+)?\bcredito\b/.exec(normalized);
  if (credit) {
    return {
      paymentMethod: "credit_card",
      cardName: null,
      spans: [[credit.index, credit.index + credit[0].length]],
    };
  }

  return { paymentMethod: null, cardName: null, spans: [] };
}

function buildDescription(original: string, spans: Span[]): string | null {
  // Remove os trechos de valor/pagamento mantendo a grafia original do usuario.
  const chars = original.split("");
  for (const [start, end] of spans) {
    for (let i = start; i < end && i < chars.length; i += 1) chars[i] = " ";
  }

  let text = chars
    .join("")
    .replace(/\b(?:parcelad[oa]|dividid[oa])\b.*$/i, " ")
    .replace(/\b\d{1,2}\s*x\b/gi, " ")
    .replace(/\b(?:hoje|ontem|anteontem)\b/gi, " ")
    .replace(
      /^\s*(?:eu\s+)?(?:gastei|comprei|paguei|recebi|ganhei|adicione|adiciona|adicionar|registre|registra|lance|anote|anota|coloca|coloque)\b/i,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  // Remove conectores soltos no inicio/fim ("de", "no", "com", "por"...)
  const connectors =
    /^(?:de|do|da|no|na|em|com|por|pra|para|um|uma|e)\s+|\s+(?:de|do|da|no|na|em|com|por|pra|para|e)$/i;
  let previous = "";
  while (previous !== text) {
    previous = text;
    text = text
      .replace(connectors, "")
      .replace(/^[-,.:;]+|[-,.:;]+$/g, "")
      .trim();
  }

  if (!text || !/[a-zA-ZÀ-ÿ]/.test(text)) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildLocalFallbackCommand(
  messageText: string,
): BFinanceCommand | null {
  const original = messageText.trim().normalize("NFC");
  if (!original) return null;

  const normalized = normalizeText(original);
  if (normalized.length !== original.length) return null;
  if (NON_CREATE_HINTS.test(normalized)) return null;

  const amount = findAmount(normalized);
  if (!amount) return null;

  const payment = findPayment(normalized);
  const description = buildDescription(original, [
    amount.span,
    ...payment.spans,
  ]);
  if (!description) return null;

  const isCard = payment.paymentMethod === "credit_card";
  const isIncome = !isCard && INCOME_HINTS.test(normalized);

  return {
    action: "create",
    resource: isCard ? "card_transaction" : "transaction",
    transactionType: isIncome ? "income" : "expense",
    data: {
      description,
      amount: amount.value,
      category: null,
      date: null,
      cardName: payment.cardName,
      paymentMethod: payment.paymentMethod,
      installmentCount: null,
    },
    ...(isCard
      ? {
          scope: {
            includeNormalTransactions: false,
            includeCardTransactions: true,
            cardName: payment.cardName,
            excludeCardTransactions: false,
            paymentMethod: "credit_card" as const,
            excludePaymentMethod: null,
          },
        }
      : {}),
    confidence: 0.6,
  };
}
