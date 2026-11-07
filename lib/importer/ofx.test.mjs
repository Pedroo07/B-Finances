import assert from "node:assert/strict";
import test from "node:test";

import { parseOfx } from "./ofx.ts";

const HEADER = [
  "OFXHEADER:100",
  "DATA:OFXSGML",
  "VERSION:102",
  "CHARSET:1252",
  "",
  "<OFX>",
  "<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0</CODE></STATUS>",
  "<FI>",
  "<ORG>NU PAGAMENTOS S.A.",
  "<FID>260",
  "</FI></SONRS></SIGNONMSGSRSV1>",
  "<CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>",
  "<CURDEF>BRL",
  "<BANKTRANLIST>",
].join("\r\n");

const FOOTER =
  "</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>";

function transaction({ type, date, amount, id, memo }) {
  return [
    "<STMTTRN>",
    `<TRNTYPE>${type}</TRNTYPE>`,
    `<DTPOSTED>${date}000000[-3:BRT]</DTPOSTED>`,
    `<TRNAMT>${amount}</TRNAMT>`,
    `<FITID>${id}</FITID>`,
    `<MEMO>${memo}</MEMO>`,
    "</STMTTRN>",
  ].join("\r\n");
}

const SAMPLE = [
  HEADER,
  transaction({
    type: "DEBIT",
    date: "20261107",
    amount: "-12.90",
    id: "id-1",
    memo: "Dl*Spotify P48e6",
  }),
  transaction({
    type: "CREDIT",
    date: "20261018",
    amount: "526.33",
    id: "id-2",
    memo: "Pagamento recebido",
  }),
  transaction({
    type: "DEBIT",
    date: "20261011",
    amount: "-30.00",
    id: "id-3",
    memo: "Bmb *Vivoeasy Lite - Parcela 12/12",
  }),
  FOOTER,
].join("\r\n");

test("lê transações do cartão e inverte o sinal para gasto positivo", () => {
  const statement = parseOfx(SAMPLE);

  assert.equal(statement.source, "ofx");
  assert.equal(statement.accountKind, "credit-card");
  assert.equal(statement.bankHint, "NU PAGAMENTOS S.A.");
  assert.equal(statement.entries.length, 3);
  assert.deepEqual(statement.warnings, []);
  assert.deepEqual(statement.entries[0], {
    date: "2026-11-07",
    description: "Dl*Spotify P48e6",
    rawDescription: "Dl*Spotify P48e6",
    amount: 12.9,
    kind: "purchase",
    externalId: "id-1",
  });
});

test("classifica pagamento e extrai parcela", () => {
  const { entries } = parseOfx(SAMPLE);

  assert.equal(entries[1].kind, "payment");
  assert.equal(entries[1].amount, -526.33);
  assert.equal(entries[2].description, "Bmb *Vivoeasy Lite");
  assert.equal(entries[2].installmentNumber, 12);
  assert.equal(entries[2].installmentCount, 12);
});

test("aceita tags sem fechamento no estilo SGML", () => {
  const sgml = [
    "<OFX><BANKMSGSRSV1><BANKTRANLIST>",
    "<STMTTRN>",
    "<TRNTYPE>DEBIT",
    "<DTPOSTED>20261003",
    "<TRNAMT>-45.10",
    "<FITID>abc",
    "<NAME>Mercado &amp; Cia",
    "</STMTTRN>",
    "</BANKTRANLIST></BANKMSGSRSV1></OFX>",
  ].join("\n");
  const statement = parseOfx(sgml);

  assert.equal(statement.accountKind, "bank");
  assert.equal(statement.entries[0].description, "Mercado & Cia");
  assert.equal(statement.entries[0].amount, 45.1);
});

test("ignora transações inválidas e identificadores repetidos", () => {
  const content = [
    HEADER,
    transaction({
      type: "DEBIT",
      date: "20261107",
      amount: "-12.90",
      id: "dup",
      memo: "Loja A",
    }),
    transaction({
      type: "DEBIT",
      date: "20261107",
      amount: "-12.90",
      id: "dup",
      memo: "Loja A",
    }),
    transaction({
      type: "DEBIT",
      date: "20261107",
      amount: "abc",
      id: "x",
      memo: "Loja B",
    }),
    FOOTER,
  ].join("\r\n");
  const { entries, warnings } = parseOfx(content);

  assert.equal(entries.length, 1);
  assert.equal(warnings.length, 2);
});

test("falha em arquivo que não é OFX", () => {
  assert.throws(() => parseOfx("date,title,amount"), /OFX/);
});
