export type TransactionValidationOption = {
  value: string;
  label: string;
  aliases?: string[];
};

export type OptionResolution =
  | { status: "matched"; option: TransactionValidationOption }
  | { status: "ambiguous"; options: TransactionValidationOption[] }
  | { status: "unmatched" };

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bcartao\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function distance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[right.length];
}

export function resolveClosestOption(
  input: string,
  options: TransactionValidationOption[],
): OptionResolution {
  const normalizedInput = normalize(input);
  if (!normalizedInput) return { status: "unmatched" };

  const exact = options.filter((option) =>
    [option.value, option.label, ...(option.aliases ?? [])].some(
      (candidate) => normalize(candidate) === normalizedInput,
    ),
  );
  if (exact.length === 1) return { status: "matched", option: exact[0] };
  if (exact.length > 1) return { status: "ambiguous", options: exact };

  const candidates = options
    .map((option) => {
      const names = [option.value, option.label, ...(option.aliases ?? [])]
        .map(normalize)
        .filter(Boolean);
      const bestDistance = Math.min(...names.map((name) => distance(normalizedInput, name)));
      const maxLength = Math.max(
        normalizedInput.length,
        ...names.map((name) => name.length),
      );
      return { option, bestDistance, score: 1 - bestDistance / maxLength };
    })
    .filter(({ bestDistance, score }) => bestDistance <= 1 && score >= 0.72)
    .sort((a, b) => a.bestDistance - b.bestDistance);

  if (candidates.length === 0) return { status: "unmatched" };
  if (
    candidates.length > 1 &&
    candidates[0].bestDistance === candidates[1].bestDistance
  ) {
    return {
      status: "ambiguous",
      options: candidates
        .filter(({ bestDistance }) => bestDistance === candidates[0].bestDistance)
        .map(({ option }) => option),
    };
  }
  return { status: "matched", option: candidates[0].option };
}

export function getOptionLabel(
  resolution: OptionResolution,
  fallback: string,
): string {
  if (resolution.status === "matched") return resolution.option.label;
  return fallback;
}

export function isOptionUnmatched(resolution: OptionResolution): boolean {
  return resolution.status !== "matched";
}

