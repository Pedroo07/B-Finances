import { handleNotificationToggle } from "../handlers/notificationHandler";
import type { Tool } from "./types";

export const toggleNotificationsTool: Tool<string> = {
  name: "toggle_notifications",
  description: "Ativa ou desativa as notificacoes do WhatsApp.",
  requiredParameters: ["userId", "parameters.enable"],
  execute: ({ userId, parameters = {} }) =>
    handleNotificationToggle(userId, parameters),
};
