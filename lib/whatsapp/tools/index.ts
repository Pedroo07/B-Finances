import { IntentType } from "../intents/intentTypes";
import {
  addInvestmentTool,
  queryInvestmentsTool,
  redeemInvestmentTool,
} from "./investmentTools";
import { toggleNotificationsTool } from "./notificationTools";
import { payBillTool, payInvoiceTool } from "./paymentTools";
import {
  addTransactionTool,
  confirmDeleteTool,
  deleteTransactionTool,
  queryBalanceTool,
  queryBillsTool,
  queryCardInvoiceTool,
  queryTransactionsTool,
} from "./transactionTools";
import type { Tool } from "./types";

export type { DeleteToolResult, Tool, ToolExecutionContext } from "./types";

export {
  addInvestmentTool,
  addTransactionTool,
  confirmDeleteTool,
  deleteTransactionTool,
  payBillTool,
  payInvoiceTool,
  queryBalanceTool,
  queryBillsTool,
  queryCardInvoiceTool,
  queryInvestmentsTool,
  queryTransactionsTool,
  redeemInvestmentTool,
  toggleNotificationsTool,
};

export const whatsappTools = [
  addTransactionTool,
  queryTransactionsTool,
  queryBalanceTool,
  queryCardInvoiceTool,
  queryBillsTool,
  queryInvestmentsTool,
  deleteTransactionTool,
  confirmDeleteTool,
  payBillTool,
  payInvoiceTool,
  addInvestmentTool,
  redeemInvestmentTool,
  toggleNotificationsTool,
] as const;

export const whatsappToolsByName = whatsappTools.reduce<Record<string, Tool>>(
  (toolsByName, tool) => {
    toolsByName[tool.name] = tool;
    return toolsByName;
  },
  {},
);

const intentTools: Partial<Record<IntentType, Tool>> = {
  [IntentType.ADD_TRANSACTION]: addTransactionTool,
  [IntentType.QUERY_EXPENSES]: queryTransactionsTool,
  [IntentType.QUERY_INCOME]: queryTransactionsTool,
  [IntentType.QUERY_BALANCE]: queryBalanceTool,
  [IntentType.QUERY_CARD_INVOICE]: queryCardInvoiceTool,
  [IntentType.QUERY_BILLS]: queryBillsTool,
  [IntentType.QUERY_INVESTMENTS]: queryInvestmentsTool,
  [IntentType.DELETE_TRANSACTION]: deleteTransactionTool,
  [IntentType.DELETE_CARD_TRANSACTION]: deleteTransactionTool,
  [IntentType.PAY_BILL]: payBillTool,
  [IntentType.PAY_CARD_INVOICE]: payInvoiceTool,
  [IntentType.ADD_INVESTMENT]: addInvestmentTool,
  [IntentType.REDEEM_INVESTMENT]: redeemInvestmentTool,
  [IntentType.TOGGLE_NOTIFICATIONS]: toggleNotificationsTool,
};

export function getToolForIntent(intent: IntentType): Tool | undefined {
  return intentTools[intent];
}
