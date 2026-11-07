import { collapseSpaces, normalizeForMatch } from "./normalize.ts";

export type ImportRule = {
  id: string;
  matchText: string;
  rewriteDescription?: string;
  category?: string;
};

export type ImportRuleInput = Omit<ImportRule, "id">;

export function findMatchingRule(
  rules: ImportRule[],
  rawDescription: string,
): ImportRule | undefined {
  const normalized = normalizeForMatch(rawDescription);
  if (!normalized) return undefined;

  return rules.find((rule) => rule.matchText === normalized);
}

export function buildRuleFromEdit(params: {
  rawDescription: string;
  originalDescription: string;
  editedDescription: string;
  originalCategory: string;
  editedCategory: string;
}): ImportRuleInput | null {
  const matchText = normalizeForMatch(params.rawDescription);
  if (!matchText) return null;

  const editedDescription = collapseSpaces(params.editedDescription);
  const descriptionChanged =
    editedDescription !== "" &&
    editedDescription !== collapseSpaces(params.originalDescription);
  const categoryChanged = params.editedCategory !== params.originalCategory;

  if (!descriptionChanged && !categoryChanged) return null;

  return {
    matchText,
    ...(descriptionChanged && { rewriteDescription: editedDescription }),
    ...(categoryChanged && { category: params.editedCategory }),
  };
}

export function mergeRule(
  rules: ImportRule[],
  input: ImportRuleInput,
): ImportRuleInput {
  const current = rules.find((rule) => rule.matchText === input.matchText);
  if (!current) return input;

  return {
    matchText: input.matchText,
    ...((input.rewriteDescription ?? current.rewriteDescription) !==
      undefined && {
      rewriteDescription:
        input.rewriteDescription ?? current.rewriteDescription,
    }),
    ...((input.category ?? current.category) !== undefined && {
      category: input.category ?? current.category,
    }),
  };
}
