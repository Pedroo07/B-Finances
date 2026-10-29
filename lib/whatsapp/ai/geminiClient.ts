import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type GenerationConfig,
  type Part,
} from "@google/generative-ai";

export type AiTaskType =
  | "AUDIO_TRANSCRIPTION"
  | "COMMAND_INTERPRETATION"
  | "INTENT_CLASSIFICATION"
  | "TRANSACTION_EXTRACTION"
  | "TOOL_PLANNING";

export type PromptPayload =
  | string
  | GenerateContentRequest
  | Array<string | Part>;

export interface GenerateAiOptions {
  task: AiTaskType;
  promptPayload: PromptPayload;
  systemInstruction?: string;
  generationConfig?: GenerationConfig;
  timeoutMs?: number;
  maxTotalTimeMs?: number;
}

// Model configurations per task: Primary followed by fallback reserves
const TASK_MODEL_CHAINS: Record<AiTaskType, string[]> = {
  AUDIO_TRANSCRIPTION: [
    "gemini-3.5-transcribe", // Modelo dedicado e ultra-rápido para áudio (~540ms)
    "gemini-2.5-flash",      // Reserva 1
  ],
  INTENT_CLASSIFICATION: [
    "gemini-2.5-flash",      // Primário estável e rápido (~950ms)
    "gemini-3.1-flash-lite", // Reserva 1
  ],
  COMMAND_INTERPRETATION: [
    "gemini-2.5-flash",      // Primário altamente estável (~950ms)
    "gemini-3.1-flash-lite", // Reserva 1
    "gemini-3.5-flash",      // Reserva 2
  ],
  TRANSACTION_EXTRACTION: [
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite",
  ],
  TOOL_PLANNING: [
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite",
  ],
};

// Cooldown em memória para modelos que retornaram 503 (High Demand) ou 429 (Rate Limit)
const MODEL_COOLDOWN_MS = 60 * 1000; // 60 segundos de cooldown
// Cooldown mais curto para modelos que estouraram o timeout, evitando que um
// modelo lento consuma o orçamento de tempo das próximas mensagens.
const TIMEOUT_COOLDOWN_MS = 30 * 1000;
// Não vale a pena disparar uma tentativa com menos tempo que isso: ela seria abortada.
const MIN_ATTEMPT_TIME_MS = 1500;
const modelCooldownMap = new Map<string, number>();

function isModelInCooldown(modelName: string): boolean {
  const expiry = modelCooldownMap.get(modelName);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    modelCooldownMap.delete(modelName);
    return false;
  }
  return true;
}

function setModelCooldown(
  modelName: string,
  reason: string,
  durationMs: number = MODEL_COOLDOWN_MS,
): void {
  const expiry = Date.now() + durationMs;
  modelCooldownMap.set(modelName, expiry);
  console.warn(
    `[GeminiClient] Modelo ${modelName} entrou em cooldown de ${Math.round(durationMs / 1000)}s (${reason}). Pulando nas próximas requisições...`,
  );
}

let cachedGenAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY || "";
  if (!cachedGenAI || (cachedGenAI as any).apiKey !== key) {
    cachedGenAI = new GoogleGenerativeAI(key);
  }
  return cachedGenAI;
}

/**
 * Extrai o texto gerado da resposta do Gemini, incluindo suporte a modelos de
 * transcrição de áudio (como gemini-3.5-transcribe) que retornam texto dentro
 * de `audioTranscription.text` em vez do campo padrão `text`.
 */
export function extractTextFromResponse(response: any): string {
  if (!response) return "";

  const candidates = response.candidates;
  if (Array.isArray(candidates) && candidates.length > 0) {
    const parts = candidates[0]?.content?.parts;
    if (Array.isArray(parts) && parts.length > 0) {
      const texts: string[] = [];
      for (const part of parts) {
        if (typeof part.text === "string" && part.text.length > 0) {
          texts.push(part.text);
        } else if (
          part.audioTranscription &&
          typeof part.audioTranscription.text === "string" &&
          part.audioTranscription.text.length > 0
        ) {
          texts.push(part.audioTranscription.text);
        }
      }
      const combined = texts.join(" ").trim();
      if (combined) {
        return combined;
      }
    }
  }

  try {
    if (typeof response.text === "function") {
      return response.text()?.trim() || "";
    }
  } catch {
    // Ignora erro caso o SDK não encontre parts com text
  }

  return "";
}

/**
 * Executa geração de conteúdo com Fail-Fast timeout por modelo,
 * Circuit Breaker para pular modelos em 503/429 sem atrasar o usuário,
 * e fallback automático para a lista de reservas da tarefa.
 */
export async function generateContentWithTaskRouting({
  task,
  promptPayload,
  systemInstruction,
  generationConfig,
  timeoutMs = 4000, // 4 segundos máx por modelo para evitar timeout na Vercel
  maxTotalTimeMs = timeoutMs * (TASK_MODEL_CHAINS[task]?.length ?? 3),
}: GenerateAiOptions): Promise<string> {
  const chain = TASK_MODEL_CHAINS[task] || [
    "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest",
  ];

  let lastError: unknown = null;
  const attemptedModels: string[] = [];
  const deadline = Date.now() + maxTotalTimeMs;

  for (const modelName of chain) {
    const remainingTimeMs = deadline - Date.now();
    if (remainingTimeMs < MIN_ATTEMPT_TIME_MS) break;

    // Se o modelo falhou recentemente por 503 ou 429, pula imediatamente (0ms de atraso)
    if (isModelInCooldown(modelName)) {
      continue;
    }

    attemptedModels.push(modelName);
    const attemptTimeoutMs = Math.min(timeoutMs, remainingTimeMs);

    try {
      const model = getGenAI().getGenerativeModel(
        {
          model: modelName,
          systemInstruction: systemInstruction || undefined,
          generationConfig: generationConfig || undefined,
        },
        { timeout: attemptTimeoutMs },
      );

      const startTime = Date.now();
      const result = await model.generateContent(promptPayload);
      const elapsed = Date.now() - startTime;

      const text = extractTextFromResponse(result.response);
      if (text && text.trim().length > 0) {
        console.info(
          `[GeminiClient] Tarefa ${task} concluída pelo modelo ${modelName} em ${elapsed}ms.`,
        );
        return text.trim();
      }

      console.warn(
        `[GeminiClient] Modelo ${modelName} (${task}) retornou resposta vazia. Tentando próximo modelo...`,
      );
    } catch (error) {
      lastError = error;
      const errorMsg =
        error instanceof Error ? error.message : String(error);

      const isHighDemand =
        errorMsg.includes("503") ||
        errorMsg.includes("high demand") ||
        errorMsg.includes("UNAVAILABLE");
      const isRateLimit =
        errorMsg.includes("429") ||
        errorMsg.includes("RESOURCE_EXHAUSTED") ||
        errorMsg.includes("quota");
      const isTimeout =
        errorMsg.includes("aborted") ||
        errorMsg.includes("timeout") ||
        errorMsg.includes("DEADLINE_EXCEEDED");

      if (isHighDemand) {
        setModelCooldown(modelName, "503 High Demand");
      } else if (isRateLimit) {
        setModelCooldown(modelName, "429 Rate Limit");
      } else if (isTimeout) {
        console.warn(
          `[GeminiClient] Modelo ${modelName} atingiu timeout de ${attemptTimeoutMs}ms na tarefa ${task}. Acionando reserva...`,
        );
        // Só penaliza o modelo se ele teve o tempo cheio; se foi cortado pelo
        // orçamento total da requisição, a culpa não é do modelo.
        if (attemptTimeoutMs >= timeoutMs) {
          setModelCooldown(modelName, "timeout", TIMEOUT_COOLDOWN_MS);
        }
      } else {
        console.warn(
          `[GeminiClient] Falha no modelo ${modelName} (${task}): ${errorMsg}. Tentando próximo...`,
        );
      }
    }
  }

  // Se todos os modelos da cadeia foram pulados por cooldown, tenta o mais estável diretamente como última cartada
  const remainingTimeMs = deadline - Date.now();
  if (attemptedModels.length === 0 && remainingTimeMs >= MIN_ATTEMPT_TIME_MS) {
    console.warn(
      `[GeminiClient] Todos os modelos de ${task} estavam em cooldown. Forçando tentativa de emergência em gemini-2.5-flash...`,
    );
    try {
      const emergencyModel = getGenAI().getGenerativeModel(
        {
          model: "gemini-2.5-flash",
          systemInstruction: systemInstruction || undefined,
          generationConfig: generationConfig || undefined,
        },
        { timeout: Math.min(5000, remainingTimeMs) },
      );
      const res = await emergencyModel.generateContent(promptPayload);
      const emergencyText = extractTextFromResponse(res.response);
      if (emergencyText && emergencyText.trim().length > 0) {
        return emergencyText.trim();
      }
    } catch (emErr) {
      lastError = emErr;
    }
  }

  throw new Error(
    `Todos os modelos da tarefa ${task} falharam. Tentados: [${attemptedModels.join(", ")}]. Último erro: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

/**
 * Utilitário para limpar marcação markdown de blocos JSON
 */
export function cleanJsonBlock(responseText: string): string {
  const cleaned = responseText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}
