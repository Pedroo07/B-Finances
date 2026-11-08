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

function buildPdfBufferWithLines(lines) {
  const ops = lines
    .map(
      (line, index) => `BT /F1 10 Tf 10 ${180 - index * 15} Td (${line}) Tj ET`,
    )
    .join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 220] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${ops.length} >>\nstream\n${ops}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index++) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return toBuffer(pdf, "latin1");
}

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

test("lê CSV pela extensão", async () => {
  const statement = await parseStatementFile(
    "fatura.CSV",
    toBuffer('date,title,amount\n2026-10-05,Padaria,"9,99"\n'),
  );

  assert.equal(statement.source, "csv");
  assert.equal(statement.entries.length, 1);
});

test("CSV em windows-1252 é decodificado com acentos", async () => {
  const statement = await parseStatementFile(
    "fatura.csv",
    toBuffer('date,title,amount\n2026-10-05,A\u00e7ougue,"9,99"\n', "latin1"),
  );

  assert.equal(statement.entries[0].description, "A\u00e7ougue");
});

test("OFX com CHARSET 1252 é decodificado com acentos", async () => {
  const statement = await parseStatementFile(
    "nubank.ofx",
    toBuffer(OFX, "latin1"),
  );

  assert.equal(statement.source, "ofx");
  assert.equal(statement.entries[0].description, "Padaria S\u00e3o Jo\u00e3o");
});

test("lê PDF reconhecido e aciona fallback quando o banco é desconhecido", async () => {
  const nubankPdf = buildPdfBufferWithLines([
    "Nu Pagamentos S.A.",
    "Data de vencimento: 19 OUT 2026",
    "Total de compras R$ 30,00",
    "TRANSACOES DE 11 SET A 11 OUT",
    "11 SET **** 1234 Padaria Central R$ 30,00",
  ]);
  const statement = await parseStatementFile("fatura.pdf", nubankPdf);

  assert.equal(statement.source, "pdf");
  assert.equal(statement.bankHint, "Nubank");
  assert.equal(statement.expectedTotal, 30);
  assert.equal(statement.entries.length, 1);

  const unknownPdf = buildPdfBufferWithLines([
    "Banco Desconhecido Demonstrativo Outubro 2026",
  ]);
  let fallbackCalled = false;
  const fallbackStatement = await parseStatementFile("outro.pdf", unknownPdf, {
    geminiFallback: async () => {
      fallbackCalled = true;
      return {
        source: "pdf",
        bankHint: "Inter",
        entries: [],
        warnings: ["fallback"],
      };
    },
  });

  assert.equal(fallbackCalled, true);
  assert.equal(fallbackStatement.bankHint, "Inter");
});

test("PDF corrompido e formatos desconhecidos geram mensagem clara", async () => {
  await assert.rejects(
    () => parseStatementFile("a.pdf", new ArrayBuffer(1)),
    /corrompido/i,
  );
  await assert.rejects(
    () => parseStatementFile("a.xlsx", new ArrayBuffer(1)),
    /PDF, CSV ou OFX/,
  );
});

test("detecta o banco pelo OFX e avisa quando diverge do cartão", async () => {
  const statement = await parseStatementFile(
    "nubank.ofx",
    toBuffer(OFX, "latin1"),
  );

  assert.equal(detectStatementBank(statement), "nubank");
  assert.equal(getBankMismatchWarning(statement, "nubank", "Nubank"), null);
  assert.match(
    getBankMismatchWarning(statement, "inter", "Inter"),
    /outro banco/,
  );
});

test("CSV sem indicação de banco não gera aviso", async () => {
  const statement = await parseStatementFile(
    "f.csv",
    toBuffer('date,title,amount\n2026-10-05,Loja,"1,00"\n'),
  );

  assert.equal(getBankMismatchWarning(statement, "inter", "Inter"), null);
});
