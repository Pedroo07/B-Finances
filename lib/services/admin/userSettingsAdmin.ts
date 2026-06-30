import { db } from "@/lib/firebaseAdmin";

export type UserSettings = {
  whatsappNotifications: boolean;
  notifyUpcomingBills: boolean;
  notifyHighExpenses: boolean;
  billNotificationDays: number;
};

const defaultSettings: UserSettings = {
  whatsappNotifications: true,
  notifyUpcomingBills: true,
  notifyHighExpenses: true,
  billNotificationDays: 3,
};

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const doc = await db.collection("users").doc(userId).get();

  if (!doc.exists) {
    return defaultSettings;
  }

  const data = doc.data();
  return {
    ...defaultSettings,
    ...data?.settings,
  };
}

export async function updateUserSettings(
  userId: string,
  settings: Partial<UserSettings>
): Promise<UserSettings> {
  const currentSettings = await getUserSettings(userId);
  const newSettings = { ...currentSettings, ...settings };

  await db
    .collection("users")
    .doc(userId)
    .set({ settings: newSettings }, { merge: true });

  return newSettings;
}

export async function toggleWhatsAppNotifications(
  userId: string,
  enabled: boolean
): Promise<UserSettings> {
  return updateUserSettings(userId, { whatsappNotifications: enabled });
}
