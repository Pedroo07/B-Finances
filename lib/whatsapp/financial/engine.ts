import { executeFinancialCapabilities } from "./dataTools";
import { planFinancialResponse } from "./planner";
import { formatPeriodForLog } from "./periodResolver";
import { composeFinancialResponse } from "./responseComposer";
import type { FinancialEngineInput, FinancialEngineResult } from "./types";

export async function tryHandleFinancialMessage(
  input: FinancialEngineInput,
): Promise<FinancialEngineResult> {
  const plan = planFinancialResponse(input);

  if (!plan) {
    return { handled: false };
  }

  console.log("Financial Planner plan:", JSON.stringify(plan));
  console.log("Financial period resolved:", formatPeriodForLog(plan.period));
  console.log("Financial capabilities:", plan.requiredCapabilities);

  if (plan.needsClarification) {
    return {
      handled: true,
      reply:
        plan.clarificationQuestion ||
        "Pode me dizer um pouco melhor o que voce quer consultar?",
      plan,
      memoryParameters: {
        financialPlan: plan,
      },
    };
  }

  const data = await executeFinancialCapabilities(input.userId, plan);
  console.log("Financial tools executed:", data.toolsExecuted);

  const composed = composeFinancialResponse(plan, data);
  console.log("Financial composer used:", plan.responseLevel);

  return {
    handled: true,
    reply: composed.reply,
    plan,
    resultContext: composed.resultContext,
    memoryParameters: {
      financialPlan: plan,
      financialResultContext: composed.resultContext,
      toolsExecuted: data.toolsExecuted,
    },
  };
}
