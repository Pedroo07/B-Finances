import { IntentType } from "../intents/intentTypes";

export type ToolExecutionContext = {
  userId: string;
  intent?: IntentType;
  parameters?: Record<string, unknown>;
  messageText?: string;
  conversationHistory?: string;
  phoneNumber?: string;
  pendingAction?: unknown;
  confirmation?: string;
};

export type Tool<TResult = unknown> = {
  name: string;
  description: string;
  requiredParameters: string[];
  execute(context: ToolExecutionContext): Promise<TResult>;
};

export type DeleteToolResult = {
  message: string;
  needsConfirmation: boolean;
  pendingAction?: unknown;
};
