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
}

// Model configurations per task: Primary followed by fallback reserves
const TASK_MODEL_CHAINS: Record<AiTaskType, string[]> = {
  AUDIO_TRANSCRIPTION: [
    "gemini-3.5-transcribe", // Modelo dedicado para áudio (~260ms, pool de cota isolado)
    "gemini-2.5-flash",      // Reserva 1 (multimodal completo)
    "gemini-3.5-flash",      // Reserva 2
  ],
  INTENT_CLASSIFICATION: [
    "gemini-3.5-flash-lite", // Preferido do usuário para qualidade em tarefas leves
    "gemini-2.5-flash",      // Reserva 1 (rápido e alta precisão)
    "gemini-3.1-flash-lite", // Reserva 2
    "gemini-3.6-flash",      // Reserva 3
  ],
  COMMAND_INTERPRETATION: [
    "gemini-3.5-flash",      // Primário para NLU e estruturação financeira (~1.5s)
    "gemini-3.5-flash-lite", // Reserva 1 (alta qualidade quando disponível)
    "gemini-3.6-flash",      // Reserva 2 (raciocínio avançado)
    "gemini-flash-latest",   // Reserva 3
  ],
  TRANSACTION_EXTRACTION: [
    "gemini-3-flash",      // Primário
    "gemini-3.5-flash-lite", // Reserva 1
    "gemini-3.6-flash",      // Reserva 2
    "gemini-3.1-flash-lite", // Reserva 3
  ],
  TOOL_PLANNING: [
    "gemini-2.5-flash",      // Primário
    "gemini-3.6-flash",      // Reserva 1
    "gemini-3.5-flash-lite", // Reserva 2
    "gemini-3.1-flash-lite", // Reserva 3
  ],
};

// Cooldown em memória para modelos que retornaram 503 (High Demand) ou 429 (Rate Limit)
const MODEL_COOLDOWN_MS = 60 * 1000; // 60 segundos de cooldown
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

function setModelCooldown(modelName: string, reason: string): void {
  const expiry = Date.now() + MODEL_COOLDOWN_MS;
  modelCooldownMap.set(modelName, expiry);
  console.warn(
    `[GeminiClient] Modelo ${modelName} entrou em cooldown de 60s (${reason}). Pulando nas próximas requisições...`,
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
}: GenerateAiOptions): Promise<string> {
  const chain = TASK_MODEL_CHAINS[task] || [
    "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest",
  ];

  let lastError: unknown = null;
  const attemptedModels: string[] = [];

  for (const modelName of chain) {
    // Se o modelo falhou recentemente por 503 ou 429, pula imediatamente (0ms de atraso)
    if (isModelInCooldown(modelName)) {
      continue;
    }

    attemptedModels.push(modelName);

    try {
      const model = getGenAI().getGenerativeModel(
        {
          model: modelName,
          systemInstruction: systemInstruction || undefined,
          generationConfig: generationConfig || undefined,
        },
        {
          timeout: timeoutMs,
        },
      );

      const startTime = Date.now();
      const result = await model.generateContent(promptPayload);
      const elapsed = Date.now() - startTime;

      const text = result.response.text();
      if (text !== undefined) {
        if (elapsed > 2500) {
          console.info(
            `[GeminiClient] Tarefa ${task} concluída pelo modelo ${modelName} em ${elapsed}ms.`,
          );
        }
        return text;
      }
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
          `[GeminiClient] Modelo ${modelName} atingiu timeout de ${timeoutMs}ms na tarefa ${task}. Acionando reserva...`,
        );
      } else {
        console.warn(
          `[GeminiClient] Falha no modelo ${modelName} (${task}): ${errorMsg}. Tentando próximo...`,
        );
      }
    }
  }

  // Se todos os modelos da cadeia foram pulados por cooldown, tenta o mais estável diretamente como última cartada
  if (attemptedModels.length === 0) {
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
        { timeout: 5000 },
      );
      const res = await emergencyModel.generateContent(promptPayload);
      return res.response.text();
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
