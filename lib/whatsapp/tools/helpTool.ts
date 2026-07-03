import { formatHelpMessage } from "../formatters/responseFormatter";
import type { Tool } from "./types";

export const showHelpTool: Tool<string> = {
  name: "show_help",
  description:
    "Mostra a lista de recursos e exemplos de comandos disponiveis no assistente.",
  parameters: [],
  requiredParameters: [],
  execute: async () => formatHelpMessage(),
};
