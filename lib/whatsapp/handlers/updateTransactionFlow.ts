export type UpdateFlowRequest = {
  field?: string | null;
  value?: string | number | null;
};

export type UpdateFlowNextStep =
  | { kind: "apply"; field: string; value: string | number }
  | { kind: "ask_value"; field: string }
  | { kind: "ask_field" };

export type UpdateTargetStrategy = "recent" | "criteria" | "query";

export type CreatedTransactionCandidate = {
  date: string;
  createdAt?: string | null;
};

export function clearlyStartsNewCommand(messageText: string): boolean {
  const normalized = messageText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return /^(gastei|comprei|recebi|ganhei|adicione|adicionar|registre|registrar|altere|alterar|atualize|atualizar|mude|mudar|corrija|corrigir|edite|editar|troque|trocar|quanto|liste|listar|mostre|mostrar|resumo|apague|apagar|delete|deletar)\b/.test(
    normalized,
  );
}

export function resolveUpdateTargetStrategy(input: {
  reference?: "recent" | "latest" | null;
  hasExplicitTarget: boolean;
  hasRecentTarget: boolean;
  recentMatchesType: boolean;
}): UpdateTargetStrategy {
  if (
    !input.hasExplicitTarget &&
    input.hasRecentTarget &&
    input.recentMatchesType &&
    input.reference === "recent"
  ) {
    return "recent";
  }

  if (!input.hasExplicitTarget && input.reference !== "latest") {
    return "criteria";
  }

  return "query";
}

export function compareCreatedAtDescending(
  left: CreatedTransactionCandidate,
  right: CreatedTransactionCandidate,
): number {
  const createdAtComparison = (right.createdAt ?? "").localeCompare(
    left.createdAt ?? "",
  );
  if (createdAtComparison !== 0) return createdAtComparison;
  return right.date.localeCompare(left.date);
}

export function selectCandidateByNumber<T>(
  candidates: T[],
  messageText: string,
): T | null {
  const normalized = messageText.trim().replace(/^#/, "");
  if (!/^\d+$/.test(normalized)) return null;
  const index = Number(normalized) - 1;
  return Number.isInteger(index) && index >= 0
    ? candidates[index] ?? null
    : null;
}

export function getNextUpdateStep(
  update?: UpdateFlowRequest,
): UpdateFlowNextStep {
  const field = update?.field?.trim();
  const value = update?.value;

  if (field && value !== null && value !== undefined && value !== "") {
    return { kind: "apply", field, value };
  }
  if (field) return { kind: "ask_value", field };
  return { kind: "ask_field" };
}

export function getNextUpdateStepAfterFieldSelection(
  update: UpdateFlowRequest | undefined,
  field: string,
  inlineValue?: string | number | null,
): UpdateFlowNextStep {
  return getNextUpdateStep({
    field,
    value:
      inlineValue !== null && inlineValue !== undefined && inlineValue !== ""
        ? inlineValue
        : update?.value,
  });
}
