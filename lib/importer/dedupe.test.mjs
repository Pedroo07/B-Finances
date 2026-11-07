import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEntryFingerprint,
  buildImportKeys,
  findDuplicates,
} from "./dedupe.ts";

const entry = (overrides = {}) => ({
  date: "2026-10-13",
  description: "Supermercado Leal",
  rawDescription: "Supermercado Leal",
  amount: 98.19,
  kind: "purchase",
  ...overrides,
});

test("fingerprint ignora sufixos variáveis e sinal", () => {
  const first = buildEntryFingerprint(
    entry({ rawDescription: "Dl *Spotify P47eaf73cf", amount: 12.9 }),
  );
  const second = buildEntryFingerprint(
    entry({ rawDescription: "Dl*Spotify P48e6", amount: -12.9 }),
  );

  assert.equal(first, second);
});

test("detecta lançamento manual equivalente e consome um por vez", () => {
  const entries = [entry(), entry()];
  const duplicates = findDuplicates(entries, [
    { date: "2026-10-13", amount: -98.19, description: "supermercado leal" },
  ]);

  assert.equal(duplicates.get(0), "matches-existing");
  assert.equal(duplicates.has(1), false);
});

test("compras idênticas no mesmo arquivo recebem ocorrências diferentes", () => {
  const keys = buildImportKeys([entry(), entry(), entry({ amount: 10 })]);

  assert.equal(new Set(keys).size, 3);
  assert.match(keys[0], /#1$/);
  assert.match(keys[1], /#2$/);
});

test("detecta lançamentos já importados pela chave", () => {
  const entries = [entry(), entry({ amount: 40, rawDescription: "Posto" })];
  const keys = buildImportKeys(entries);
  const duplicates = findDuplicates(entries, [
    {
      date: "2026-10-13",
      amount: -98.19,
      description: "x",
      importKey: keys[0],
    },
  ]);

  assert.equal(duplicates.get(0), "imported-before");
  assert.equal(duplicates.has(1), false);
});

test("detecta lançamentos já importados pelo identificador externo", () => {
  const entries = [entry({ externalId: "abc" })];
  const duplicates = findDuplicates(entries, [
    {
      date: "2000-01-01",
      amount: -1,
      description: "outro",
      importKey: "k",
      importExternalId: "abc",
    },
  ]);

  assert.equal(duplicates.get(0), "imported-before");
});
