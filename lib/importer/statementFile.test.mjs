import assert from "node:assert/strict";
import test from "node:test";

import {
  detectStatementBank,
  getBankMismatchWarning,
  parseStatementFile,
} from "./statementFile.ts";

const toBuffer = (text, encoding = "utf8") => {
  const buffer = Buffer.from(text, encoding);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
};

const OFX = [
  "OFXHEADER:100",
  "DATA:OFXSGML",
  "CHARSET:1252",
  "",
  "<OFX><FI><ORG>NU PAGAMENTOS S.A.</FI>",
  "<CREDITCARDMSGSRSV1><BANKTRANLIST>",
  "<STMTTRN><TRNAMT>-10.00<DTPOSTED>20261003000000[-3:BRT]<FITID>1<MEMO>Padaria S\u00e3o Jo\u00e3o</STMTTRN>",
  "</BANKTRANLIST></CREDITCARDMSGSRSV1></OFX>",
].join("\r\n");

test("lê CSV pela extensão", () => {
  const statement = parseStatementFile(
    "fatura.CSV",
    toBuffer('date,title,amount\n2026-10-05,Padaria,"9,99"\n'),
  );

  assert.equal(statement.source, "csv");
  assert.equal(statement.entries.length, 1);
});

test("CSV em windows-1252 é decodificado com acentos", () => {
  const statement = parseStatementFile(
    "fatura.csv",
    toBuffer('date,title,amount\n2026-10-05,A\u00e7ougue,"9,99"\n', "latin1"),
  );

  assert.equal(statement.entries[0].description, "A\u00e7ougue");
});

test("OFX com CHARSET 1252 é decodificado com acentos", () => {
  const statement = parseStatementFile("nubank.ofx", toBuffer(OFX, "latin1"));

  assert.equal(statement.source, "ofx");
  assert.equal(statement.entries[0].description, "Padaria S\u00e3o Jo\u00e3o");
});

test("PDF e formatos desconhecidos geram mensagem clara", () => {
  assert.throws(() => parseStatementFile("a.pdf", new ArrayBuffer(1)), /PDF/);
  assert.throws(
    () => parseStatementFile("a.xlsx", new ArrayBuffer(1)),
    /CSV ou OFX/,
  );
});

test("detecta o banco pelo OFX e avisa quando diverge do cartão", () => {
  const statement = parseStatementFile("nubank.ofx", toBuffer(OFX, "latin1"));

  assert.equal(detectStatementBank(statement), "nubank");
  assert.equal(getBankMismatchWarning(statement, "nubank", "Nubank"), null);
  assert.match(
    getBankMismatchWarning(statement, "inter", "Inter"),
    /outro banco/,
  );
});

test("CSV sem indicação de banco não gera aviso", () => {
  const statement = parseStatementFile(
    "f.csv",
    toBuffer('date,title,amount\n2026-10-05,Loja,"1,00"\n'),
  );

  assert.equal(getBankMismatchWarning(statement, "inter", "Inter"), null);
});
