import assert from "node:assert/strict";
import test from "node:test";

import { parseCsv } from "./csv.ts";

const NUBANK_SAMPLE = [
  "date,title,amount",
  '2026-11-07,Dl*Spotify P48e6,"12,90"',
  '2026-10-18,Pagamento recebido,"- 526,33"',
  '2026-10-12,Rede Ed Santa Monica,"30,00"',
  '2026-10-11,Bmb *Vivoeasy Lite - Parcela 12/12,"30,00"',
].join("\r\n");

test("lê o CSV do Nubank com valores em formato brasileiro", () => {
  const statement = parseCsv(NUBANK_SAMPLE);

  assert.equal(statement.source, "csv");
  assert.equal(statement.entries.length, 4);
  assert.deepEqual(statement.warnings, []);
  assert.deepEqual(statement.entries[0], {
    date: "2026-11-07",
    description: "Dl*Spotify P48e6",
    rawDescription: "Dl*Spotify P48e6",
    amount: 12.9,
    kind: "purchase",
  });
});

test("marca pagamentos e extrai parcelas", () => {
  const { entries } = parseCsv(NUBANK_SAMPLE);

  assert.equal(entries[1].kind, "payment");
  assert.equal(entries[1].amount, -526.33);
  assert.equal(entries[3].description, "Bmb *Vivoeasy Lite");
  assert.equal(entries[3].installmentNumber, 12);
  assert.equal(entries[3].installmentCount, 12);
});

test("aceita ponto e vírgula, BOM e datas dd/mm/aaaa", () => {
  const csv = "\uFEFFData;Descrição;Valor\n05/10/2026;Padaria Central;25,50\n";
  const { entries } = parseCsv(csv);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].date, "2026-10-05");
  assert.equal(entries[0].description, "Padaria Central");
  assert.equal(entries[0].amount, 25.5);
});

test("respeita aspas com vírgula e aspas escapadas", () => {
  const csv = 'date,title,amount\n2026-10-05,"Loja ""X"", Filial 2","10,00"\n';
  const { entries } = parseCsv(csv);

  assert.equal(entries[0].description, 'Loja "X", Filial 2');
});

test("ignora linhas inválidas e registra aviso", () => {
  const csv =
    'date,title,amount\n2026-10-05,Loja,abc\n2026-10-06,Mercado,"9,99"\n';
  const { entries, warnings } = parseCsv(csv);

  assert.equal(entries.length, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Linha 2/);
});

test("falha quando faltam colunas obrigatórias", () => {
  assert.throws(() => parseCsv("a,b,c\n1,2,3"), /colunas/);
  assert.throws(() => parseCsv(""), /vazio/);
});
