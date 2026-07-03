import { handleNotificationToggle } from "../handlers/notificationHandler";
import type { Tool } from "./types";

export const toggleNotificationsTool: Tool<string> = {
  name: "toggle_notifications",
  description: "Ativa ou desativa as notificacoes do WhatsApp.",
  parameters: [
    {
      name: "enable",
      description:
        "true para ativar notificacoes ou false para desativar notificacoes.",
      required: true,
      enum: [true, false],
    },
  ],
  requiredParameters: ["enable"],
  execute: ({ userId, parameters = {} }) =>
    handleNotificationToggle(userId, parameters),
};
