import assert from "node:assert/strict";
import test from "node:test";

import {
  GEMINI_FALLBACK_WARNING,
  parseGeminiPdfResponse,
  parsePdfWithGemini,
} from "./gemini.ts";

test("converte resposta JSON do Gemini em ParsedStatement com aviso externo", async () => {
  let receivedPrompt = "";
  const statement = await parsePdfWithGemini(
    "Banco Inter Fatura Outubro 2026 Vencimento 15/10/2026",
    async (prompt) => {
      receivedPrompt = prompt;
      return JSON.stringify({
        bankHint: "Inter",
        closingDay: 8,
        dueDay: 15,
        expectedTotal: 149.9,
        periodLabel: "08/09 a 08/10",
        entries: [
          {
            date: "2026-10-02",
            description: "Supermercado Ideal - Parcela 2/3",
            amount: 149.9,
            kind: "purchase",
            cardLast4: "4321",
          },
          {
            date: "2026-09-15",
            description: "Pagamento de fatura",
            amount: 200,
            kind: "payment",
            cardLast4: null,
          },
          {
            date: "2026-10-08",
            description: "Encargo contratual",
            amount: 4.5,
            kind: "fee",
          },
        ],
      });
    },
  );

  assert.match(receivedPrompt, /Banco Inter Fatura Outubro 2026/);
  assert.equal(statement.source, "pdf");
  assert.equal(statement.bankHint, "Inter");
  assert.equal(statement.closingDay, 8);
  assert.equal(statement.dueDay, 15);
  assert.equal(statement.expectedTotal, 149.9);
  assert.equal(statement.periodLabel, "08/09 a 08/10");
  assert.ok(statement.warnings.includes(GEMINI_FALLBACK_WARNING));
  assert.equal(statement.entries.length, 3);
  assert.deepEqual(statement.entries[0], {
    date: "2026-10-02",
    description: "Supermercado Ideal",
    rawDescription: "Supermercado Ideal - Parcela 2/3",
    amount: 149.9,
    kind: "purchase",
    installmentNumber: 2,
    installmentCount: 3,
    cardLast4: "4321",
  });
  assert.equal(statement.entries[1].kind, "payment");
  assert.equal(statement.entries[2].kind, "fee");
});

test("ignora linhas incompletas do Gemini e limpa blocos markdown", () => {
  const statement = parseGeminiPdfResponse(
    [
      "```json",
      JSON.stringify({
        bankHint: "C6 Bank",
        entries: [
          { date: "data-invalida", description: "Teste", amount: 10 },
          { date: "2026-10-05", description: "Padaria", amount: "25,50" },
        ],
      }),
      "```",
    ].join("\n"),
  );

  assert.equal(statement.entries.length, 1);
  assert.equal(statement.entries[0].description, "Padaria");
  assert.equal(statement.entries[0].amount, 25.5);
  assert.equal(statement.warnings.length, 2);
});

test("lança erro claro quando o JSON do Gemini é inválido", () => {
  assert.throws(
    () => parseGeminiPdfResponse("resposta fora de formato"),
    /CSV ou OFX/i,
  );
});
