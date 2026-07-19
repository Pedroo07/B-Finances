export const PROFILE_NAME_UPDATED_EVENT = "b-finances:profile-name-updated"

const PROFILE_NAME_STORAGE_PREFIX = "b-finances:profile-name:"

export function getDefaultProfileName(email: string | null | undefined): string {
  const localPart = email?.split("@", 1)[0]?.trim()
  return localPart || "Usuário"
}

export function getProfileNameStorageKey(userId: string): string {
  return `${PROFILE_NAME_STORAGE_PREFIX}${userId}`
}

export function formatProfilePhone(phoneNumber: unknown): string {
  if (typeof phoneNumber !== "string" || !phoneNumber.trim()) {
    return "Não informado"
  }

  const digits = phoneNumber.replace(/\D/g, "")
  const nationalNumber =
    digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits

  if (nationalNumber.length === 11) {
    return `+55 (${nationalNumber.slice(0, 2)}) ${nationalNumber.slice(2, 7)}-${nationalNumber.slice(7)}`
  }

  if (nationalNumber.length === 10) {
    return `+55 (${nationalNumber.slice(0, 2)}) ${nationalNumber.slice(2, 6)}-${nationalNumber.slice(6)}`
  }

  return phoneNumber.trim()
}
