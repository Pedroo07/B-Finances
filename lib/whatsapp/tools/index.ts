import { showHelpTool } from "./helpTool";
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
  findTransactionTool,
  queryBalanceTool,
  queryBillsTool,
  queryCardInvoiceTool,
  queryTransactionsTool,
} from "./transactionTools";
import type { Tool } from "./types";

export type {
  DeleteToolResult,
  PendingActionToolResult,
  Tool,
  ToolExecutionContext,
} from "./types";

export {
  addInvestmentTool,
  addTransactionTool,
  confirmDeleteTool,
  deleteTransactionTool,
  findTransactionTool,
  payBillTool,
  payInvoiceTool,
  queryBalanceTool,
  queryBillsTool,
  queryCardInvoiceTool,
  queryInvestmentsTool,
  queryTransactionsTool,
  redeemInvestmentTool,
  showHelpTool,
  toggleNotificationsTool,
};

export const whatsappTools = [
  addTransactionTool,
  queryTransactionsTool,
  queryBalanceTool,
  findTransactionTool,
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
  showHelpTool,
] as const;

export const plannableWhatsappTools = [
  addTransactionTool,
  queryTransactionsTool,
  queryBalanceTool,
  findTransactionTool,
  queryCardInvoiceTool,
  queryBillsTool,
  queryInvestmentsTool,
  deleteTransactionTool,
  payBillTool,
  payInvoiceTool,
  addInvestmentTool,
  redeemInvestmentTool,
  toggleNotificationsTool,
  showHelpTool,
] as const;

export const whatsappToolsByName = whatsappTools.reduce<Record<string, Tool>>(
  (toolsByName, tool) => {
    toolsByName[tool.name] = tool;
    return toolsByName;
  },
  {},
);

export function getToolByName(toolName: string): Tool | undefined {
  return whatsappToolsByName[toolName];
}
