import assert from "node:assert/strict";
import test from "node:test";

import { parseNubankPdf } from "./nubank.ts";

const NUBANK_SAMPLE_TEXT = [
  "Olá, CLIENTE.",
  "Esta é a sua fatura de outubro, no valor de R$ 526,99",
  "Data de vencimento: 19 OUT 2026",
  "Período vigente: 11 SET a 11 OUT",
  "Limite total do cartão de crédito: R$ 1.000,00",
  "1 de 6",
  "CLIENTE EXEMPLO DA SILVA",
  "FATURA 19 OUT 2026   EMISSÃO E ENVIO 11 OUT 2026",
  "RESUMO DA FATURA ATUAL",
  "Fatura anterior   R$ 166,53",
  "Pagamento recebido   −R$ 166,53",
  "Saldo financiado   R$ 4,38",
  "Total de compras de todos os cartões, 11 SET a 11 OUT   R$ 522,60",
  "Outros lançamentos   R$ 4,39",
  "Total a pagar   R$ 526,99",
  "4 de 6",
  "CLIENTE EXEMPLO DA SILVA",
  "FATURA 19 OUT 2026   EMISSÃO E ENVIO 11 OUT 2026",
  "TRANSAÇÕES   DE 11 SET A 11 OUT",
  "Cliente E Silva   R$ 522,60",
  "11 SET   •••• 1111   Bmb *Vivoeasy Lite - Parcela 11/12   R$ 30,00",
  "16 SET   •••• 1111   Posto dos Amigos   R$ 280,00",
  "16 SET   •••• 1111   Clinica Bom Sorrir   R$ 85,00",
  "17 SET   •••• 2222   Editora e Dist Educaci   R$ 65,46",
  "17 SET   •••• 1111   Emporio Brasil   R$ 33,66",
  "18 SET   •••• 1111   Emporio Brasil   R$ 22,78",
  "21 SET   •••• 2222   Panificadora e Confeit   R$ 5,70",
  "Pagamentos e Financiamentos   -R$ 162,13",
  "19 SET   Pagamento em 19 SET   −R$ 166,53",
  "18 SET   Saldo em atraso",
  "• Saldo em aberto de R$ 167,16. Valor total acumulado de encargos R$ 0,00.",
  "• Valor original: R$ 167,16",
  "R$ 166,53",
  "18 SET   Crédito de atraso   −R$ 166,53",
  "19 SET   Crédito de rotativo   −R$ 166,53",
  "19 SET   Saldo em rotativo",
  "• Saldo em aberto de R$ 170,91.",
  "R$ 4,39",
  "19 SET   Saldo em rotativo",
  "• Saldo em aberto de R$ 170,91.",
  "R$ 166,53",
  "19 SET   Multa de atraso",
  "Referente ao valor em aberto de R$ 166,53 de 20/09/2026",
  "R$ 3,34",
  "19 SET   IOF Complementar por renegociação",
  "Total a pagar: R$ 167,16",
  "R$ 0,40",
  "19 SET   Encerramento de dívida   −R$ 4,39",
  "5 de 6",
  "CLIENTE EXEMPLO DA SILVA",
  "FATURA 19 OUT 2026   EMISSÃO E ENVIO 11 OUT 2026",
  "TRANSAÇÕES   DE 11 SET A 11 OUT",
  "19 SET   IOF de atraso",
  "Referente ao valor em aberto de R$ 166,53 de 20/09/2026",
  "R$ 0,65",
  "Em cumprimento à regulação do Banco Central, as suas operações de crédito serão comunicadas.",
  "6 de 6",
].join("\n");

test("extrai compras, encargos, pagamento, totais e datas da fatura do Nubank", () => {
  const statement = parseNubankPdf(NUBANK_SAMPLE_TEXT);

  assert.equal(statement.source, "pdf");
  assert.equal(statement.bankHint, "Nubank");
  assert.equal(statement.expectedTotal, 522.6);
  assert.equal(statement.closingDay, 11);
  assert.equal(statement.dueDay, 19);
  assert.equal(statement.periodLabel, "11 SET a 11 OUT");

  const purchases = statement.entries.filter(
    (entry) => entry.kind === "purchase",
  );
  assert.equal(purchases.length, 7);

  const purchaseSum =
    Math.round(purchases.reduce((sum, entry) => sum + entry.amount, 0) * 100) /
    100;
  assert.equal(purchaseSum, 522.6);

  assert.deepEqual(purchases[0], {
    date: "2026-09-11",
    description: "Bmb *Vivoeasy Lite",
    rawDescription: "Bmb *Vivoeasy Lite - Parcela 11/12",
    amount: 30,
    kind: "purchase",
    installmentNumber: 11,
    installmentCount: 12,
    cardLast4: "1111",
  });

  const payments = statement.entries.filter(
    (entry) => entry.kind === "payment",
  );
  assert.equal(payments.length, 1);
  assert.equal(payments[0].description, "Pagamento em 19 SET");
  assert.equal(payments[0].amount, -166.53);

  const fees = statement.entries.filter((entry) => entry.kind === "fee");
  assert.equal(fees.length, 3);
  const feeSum =
    Math.round(fees.reduce((sum, entry) => sum + entry.amount, 0) * 100) / 100;
  assert.equal(feeSum, 4.39);
});

test("infere o ano anterior para compras de dezembro em fatura de janeiro", () => {
  const text = [
    "FATURA 19 JAN 2027   EMISSÃO E ENVIO 11 JAN 2027",
    "Total de compras de todos os cartões, 11 DEZ a 11 JAN   R$ 150,00",
    "TRANSAÇÕES   DE 11 DEZ A 11 JAN",
    "20 DEZ   •••• 1111   Supermercado Central   R$ 100,00",
    "05 JAN   •••• 1111   Farmacia Popular   R$ 50,00",
  ].join("\n");

  const statement = parseNubankPdf(text);

  assert.equal(statement.entries.length, 2);
  assert.equal(statement.entries[0].date, "2026-12-20");
  assert.equal(statement.entries[1].date, "2027-01-05");
});
