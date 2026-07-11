import {
  getUserSettings,
  toggleWhatsAppNotifications,
} from "@/lib/services/admin/userSettingsAdmin";

export async function handleNotificationToggle(
  userId: string,
  parameters: Record<string, unknown>
): Promise<string> {
  try {
    const enable = parameters.enable !== false; 

    const settings = await toggleWhatsAppNotifications(userId, enable);

    if (settings.whatsappNotifications) {
      return "🔔 Notificações do WhatsApp ativadas!\n\nVocê receberá alertas sobre:\n• Contas próximas do vencimento\n• Gastos elevados\n\n_Para desativar, diga: \"desativar alertas\"_";
    } else {
      return "🔕 Notificações do WhatsApp desativadas.\n\n_Para reativar, diga: \"ativar notificações\"_";
    }
  } catch (error) {
    console.error("Erro ao alternar notificações:", error);
    return "❌ Ocorreu um erro ao alterar as configurações de notificação.";
  }
}

export async function checkNotificationSettings(userId: string): Promise<boolean> {
  try {
    const settings = await getUserSettings(userId);
    return settings.whatsappNotifications;
  } catch (error) {
    console.error("Erro ao verificar configurações:", error);
    return true;
  }
}
