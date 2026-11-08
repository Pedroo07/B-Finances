import assert from "node:assert/strict";
import test from "node:test";

import { parseMercadoPagoPdf } from "./mercadopago.ts";

const MERCADO_PAGO_SAMPLE_TEXT = [
  "Cliente Exemplo",
  "Emitida em: 30/07/2026",
  "Olá, Cliente Exemplo",
  "Essa é sua fatura de julho",
  "Total a pagar",
  "R$ 73,88",
  "Vence em",
  "04/08/2026",
  "Resumo da fatura",
  "Consumos de 30/06 a 29/07   R$ 72,27",
  "Tarifas e encargos   R$ 0,16",
  "Multas por atraso   R$ 0,74",
  "Total da fatura de junho   R$ 36,94",
  "Juros do mês anterior   R$ 0,71",
  "Pagamentos e créditos devolvidos   R$ 36,94",
  "Total   R$ 73,88",
  "Pague sua fatura pelo app Mercado Pago",
  "Vencimento: 04/08/2026",
  "Detalhes de consumo",
  "Movimentações na fatura",
  "Data   Movimentações   Valor em R$",
  "09/07Pagamento da fatura de julho/2026R$ 36,94",
  "30/07Juros de moraR$ 0,04",
  "30/07IOF do rotativoR$ 0,16",
  "30/07Juros do rotativoR$ 0,67",
  "30/07Multa por atrasoR$ 0,74",
  "Cartão Visa [************9999]",
  "Data   Movimentações   Valor em R$",
  "12/0712.345.678 LOJA EXEMPLOParcela 12 de 12R$ 36,94",
  "03/07AMAZON BR   *Amazon BRR$ 35,33",
  "Total   R$ 72,27",
  "Parcele a fatura do seu Cartão de Crédito Mercado Pago",
  "Seu cartão de crédito",
  "Datas importantes",
  "Melhor dia de compra   30/07/2026",
  "Fechamento da fatura   29/07/2026",
  "Próximo fechamento   29/08/2026",
].join("\n");

test("extrai movimentações, compras concatenadas, parcelas e totais do Mercado Pago", () => {
  const statement = parseMercadoPagoPdf(MERCADO_PAGO_SAMPLE_TEXT);

  assert.equal(statement.source, "pdf");
  assert.equal(statement.bankHint, "Mercado Pago");
  assert.equal(statement.expectedTotal, 72.27);
  assert.equal(statement.closingDay, 29);
  assert.equal(statement.dueDay, 4);
  assert.equal(statement.periodLabel, "30/06 a 29/07");

  const purchases = statement.entries.filter(
    (entry) => entry.kind === "purchase",
  );
  assert.equal(purchases.length, 2);

  assert.deepEqual(purchases[0], {
    date: "2026-07-12",
    description: "12.345.678 LOJA EXEMPLO",
    rawDescription: "12.345.678 LOJA EXEMPLOParcela 12 de 12",
    amount: 36.94,
    kind: "purchase",
    installmentNumber: 12,
    installmentCount: 12,
    cardLast4: "9999",
  });

  assert.deepEqual(purchases[1], {
    date: "2026-07-03",
    description: "AMAZON BR *Amazon BR",
    rawDescription: "AMAZON BR *Amazon BR",
    amount: 35.33,
    kind: "purchase",
    cardLast4: "9999",
  });

  const payments = statement.entries.filter(
    (entry) => entry.kind === "payment",
  );
  assert.equal(payments.length, 1);
  assert.equal(payments[0].date, "2026-07-09");
  assert.equal(payments[0].amount, 36.94);

  const fees = statement.entries.filter((entry) => entry.kind === "fee");
  assert.equal(fees.length, 4);
  const feeSum =
    Math.round(fees.reduce((sum, entry) => sum + entry.amount, 0) * 100) / 100;
  assert.equal(feeSum, 1.61);
});

test("aceita linhas com espaços entre colunas e virada de ano", () => {
  const text = [
    "Vencimento: 04/01/2027",
    "Detalhes de consumo",
    "Movimentações na fatura",
    "15/12   Tarifa administrativa   R$ 5,00",
    "Cartão Visa [****1234]",
    "20/12   MERCADO LIVRE   Parcela 2 de 4   R$ 50,00",
    "02/01   PADARIA CENTRAL   R$ 20,00",
    "Total   R$ 70,00",
  ].join("\n");

  const statement = parseMercadoPagoPdf(text);

  assert.equal(statement.expectedTotal, 70);
  assert.equal(statement.entries.length, 3);
  assert.equal(statement.entries[0].kind, "fee");
  assert.equal(statement.entries[0].date, "2026-12-15");
  assert.equal(statement.entries[1].date, "2026-12-20");
  assert.equal(statement.entries[1].installmentNumber, 2);
  assert.equal(statement.entries[1].installmentCount, 4);
  assert.equal(statement.entries[2].date, "2027-01-02");
});
