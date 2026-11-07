import { buildRuleFromEdit, mergeRule } from "./rules.ts";
import type { ImportRule, ImportRuleInput } from "./rules.ts";
import type { ReviewRow } from "./review.ts";

export function collectRulesToLearn(
  rows: ReviewRow[],
  existingRules: ImportRule[],
): ImportRuleInput[] {
  const learned = new Map<string, ImportRuleInput>();

  for (const row of rows) {
    if (!row.included || row.manual || !row.original) continue;

    const input = buildRuleFromEdit({
      rawDescription: row.original.rawDescription,
      originalDescription: row.defaults.description,
      editedDescription: row.values.description,
      originalCategory: row.defaults.category,
      editedCategory: row.values.category,
    });
    if (!input) continue;

    const previous = learned.get(input.matchText);
    learned.set(input.matchText, { ...previous, ...input });
  }

  return [...learned.values()].map((input) => mergeRule(existingRules, input));
}
