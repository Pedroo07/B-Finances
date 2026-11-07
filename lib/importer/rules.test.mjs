import assert from "node:assert/strict";
import test from "node:test";

import { buildRuleFromEdit, findMatchingRule, mergeRule } from "./rules.ts";

test("encontra regra pelo texto normalizado", () => {
  const rules = [
    {
      id: "1",
      matchText: "maria aparecida",
      rewriteDescription: "Floricultura",
    },
  ];

  assert.equal(findMatchingRule(rules, "MARIA  Aparecida 123")?.id, "1");
  assert.equal(findMatchingRule(rules, "Outra Pessoa"), undefined);
  assert.equal(findMatchingRule(rules, "12345"), undefined);
});

test("gera regra a partir de edição de descrição e categoria", () => {
  assert.deepEqual(
    buildRuleFromEdit({
      rawDescription: "Maria Aparecida",
      originalDescription: "Maria Aparecida",
      editedDescription: "Floricultura",
      originalCategory: "other",
      editedCategory: "shopping",
    }),
    {
      matchText: "maria aparecida",
      rewriteDescription: "Floricultura",
      category: "shopping",
    },
  );
});

test("não gera regra sem alteração ou sem texto comparável", () => {
  assert.equal(
    buildRuleFromEdit({
      rawDescription: "Maria Aparecida",
      originalDescription: "Maria Aparecida",
      editedDescription: "Maria Aparecida",
      originalCategory: "other",
      editedCategory: "other",
    }),
    null,
  );
  assert.equal(
    buildRuleFromEdit({
      rawDescription: "12345",
      originalDescription: "12345",
      editedDescription: "Algo",
      originalCategory: "other",
      editedCategory: "other",
    }),
    null,
  );
});

test("mescla regra existente preservando campos não editados", () => {
  const merged = mergeRule(
    [
      {
        id: "1",
        matchText: "maria aparecida",
        rewriteDescription: "Floricultura",
      },
    ],
    { matchText: "maria aparecida", category: "shopping" },
  );

  assert.deepEqual(merged, {
    matchText: "maria aparecida",
    rewriteDescription: "Floricultura",
    category: "shopping",
  });
});
