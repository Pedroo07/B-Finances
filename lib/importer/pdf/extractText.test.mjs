import assert from "node:assert/strict";
import test from "node:test";

import { detectBank } from "./detectBank.ts";
import { assertSelectablePdfText, extractPdfText } from "./extractText.ts";

function buildMinimalPdfBuffer(textOperators) {
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${textOperators.length} >>\nstream\n${textOperators}\nendstream\nendobj\n`,
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

  const buffer = Buffer.from(pdf, "latin1");
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
}

test("extrai o texto de um PDF válido", async () => {
  const buffer = buildMinimalPdfBuffer(
    "BT /F1 12 Tf 10 100 Td (Nu Pagamentos S.A. Fatura) Tj ET",
  );
  const text = await extractPdfText(buffer);

  assert.match(text, /Nu Pagamentos S\.A\. Fatura/);
});

test("rejeita PDF sem texto selecionável (escaneado)", async () => {
  const buffer = buildMinimalPdfBuffer("");

  await assert.rejects(
    () => extractPdfText(buffer),
    /n\u00e3o possui texto selecion\u00e1vel/i,
  );
  assert.throws(
    () => assertSelectablePdfText("   \n  "),
    /n\u00e3o possui texto selecion\u00e1vel/i,
  );
});

test("rejeita arquivo PDF corrompido ou truncado", async () => {
  const randomBytes = Buffer.from("arquivo invalido sem cabecalho");
  const corruptedPdf = Buffer.from("%PDF-1.4\n000000000000000000");

  await assert.rejects(
    () =>
      extractPdfText(
        randomBytes.buffer.slice(
          randomBytes.byteOffset,
          randomBytes.byteOffset + randomBytes.byteLength,
        ),
      ),
    /corrompido/i,
  );
  await assert.rejects(
    () =>
      extractPdfText(
        corruptedPdf.buffer.slice(
          corruptedPdf.byteOffset,
          corruptedPdf.byteOffset + corruptedPdf.byteLength,
        ),
      ),
    /corrompido/i,
  );
});

test("detecta Nubank, Mercado Pago ou layout desconhecido pelo texto", () => {
  assert.equal(
    detectBank(
      "FATURA 19 OUT 2026 EMISSÃO E ENVIO 11 OUT 2026\nNu Pagamentos S.A.",
    ),
    "nubank",
  );
  assert.equal(
    detectBank(
      "Pague sua fatura pelo app Mercado Pago\nDetalhes de consumo\nMovimentações na fatura",
    ),
    "mercado_pago",
  );
  assert.equal(detectBank("Banco Exemplo S.A. Demonstrativo Mensal"), null);
});
