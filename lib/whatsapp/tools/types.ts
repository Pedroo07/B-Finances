export type ToolExecutionContext = {
  userId: string;
  parameters?: Record<string, unknown>;
  messageText?: string;
  conversationHistory?: string;
  phoneNumber?: string;
  pendingAction?: unknown;
  confirmation?: string;
};

export type ToolParameter = {
  name: string;
  description: string;
  required: boolean;
  enum?: Array<string | number | boolean>;
};

export type Tool<TResult = unknown> = {
  name: string;
  description: string;
  parameters: ToolParameter[];
  requiredParameters: string[];
  execute(context: ToolExecutionContext): Promise<TResult>;
};

export type DeleteToolResult = {
  message: string;
  needsConfirmation: boolean;
  pendingAction?: unknown;
};
