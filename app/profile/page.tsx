"use client"

import Header from "@/app/dashboard/components/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { AuthContext } from "@/context/AuthContext"
import { auth, db } from "@/lib/firebase"
import {
  formatProfilePhone,
  getDefaultProfileName,
  getProfileNameStorageKey,
  PROFILE_NAME_UPDATED_EVENT,
} from "@/lib/profile"
import { FirebaseError } from "firebase/app"
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import {
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  PencilLine,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  FormEvent,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { toast } from "sonner"

const passwordErrorMessages: Record<string, string> = {
  "auth/invalid-credential": "A senha atual está incorreta.",
  "auth/wrong-password": "A senha atual está incorreta.",
  "auth/weak-password": "A nova senha deve ter pelo menos 6 caracteres.",
  "auth/too-many-requests":
    "Muitas tentativas. Tente novamente em alguns instantes.",
  "auth/network-request-failed":
    "Não foi possível conectar. Verifique sua internet e tente novamente.",
  "auth/requires-recent-login":
    "Por segurança, entre novamente na sua conta antes de trocar a senha.",
}

function getPasswordErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return (
      passwordErrorMessages[error.code] ??
      "Não foi possível alterar a senha."
    )
  }
  return "Não foi possível alterar a senha."
}

export default function ProfilePage() {
  const { user, loading } = useContext(AuthContext)
  const router = useRouter()
  const [profileName, setProfileName] = useState("")
  const [savedProfileName, setSavedProfileName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("Não informado")
  const [phoneUserId, setPhoneUserId] = useState<string | null>(null)
  const [phoneLoading, setPhoneLoading] = useState(true)
  const [savingName, setSavingName] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [showPasswords, setShowPasswords] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [loading, router, user])

  useEffect(() => {
    if (!user) return

    const initialSync = window.setTimeout(() => {
      const defaultName = getDefaultProfileName(user.email)
      let storedName: string | null = null
      try {
        storedName = window.localStorage.getItem(
          getProfileNameStorageKey(user.uid)
        )
      } catch {
       
      }
      const nextName = storedName?.trim() || defaultName
      setProfileName(nextName)
      setSavedProfileName(nextName)
    }, 0)

    return () => window.clearTimeout(initialSync)
  }, [user])

  useEffect(() => {
    if (!user) return

    let active = true

    const loadPhoneNumber = async () => {
      try {
        const userDocument = await getDoc(doc(db, "users", user.uid))
        if (!active) return
        setPhoneNumber(
          userDocument.exists()
            ? formatProfilePhone(userDocument.data().phoneNumber)
            : "Não informado"
        )
        setPhoneUserId(user.uid)
      } catch {
        if (active) {
          setPhoneNumber("Não informado")
          setPhoneUserId(user.uid)
        }
      } finally {
        if (active) setPhoneLoading(false)
      }
    }

    void loadPhoneNumber()
    return () => {
      active = false
    }
  }, [user])

  const initials = useMemo(() => {
    const parts = profileName.trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return "U"
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("")
  }, [profileName])

  const handleSaveName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || savingName) return

    const normalizedName = profileName.trim()
    if (!normalizedName) {
      toast.error("Digite um nome para continuar.")
      return
    }

    setSavingName(true)
    try {
      window.localStorage.setItem(
        getProfileNameStorageKey(user.uid),
        normalizedName
      )
      setProfileName(normalizedName)
      setSavedProfileName(normalizedName)
      window.dispatchEvent(new Event(PROFILE_NAME_UPDATED_EVENT))
      toast.success("Nome atualizado neste navegador.")
    } catch {
      toast.error(
        "O navegador bloqueou o armazenamento local. Não foi possível salvar o nome."
      )
    } finally {
      setSavingName(false)
    }
  }

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || changingPassword) return

    if (!user.email) {
      toast.error(
        "Sua conta não possui um e-mail disponível para confirmação."
      )
      return
    }
    if (!currentPassword || !newPassword || !passwordConfirmation) {
      toast.error("Preencha todos os campos de senha.")
      return
    }
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.")
      return
    }
    if (newPassword !== passwordConfirmation) {
      toast.error("A confirmação não corresponde à nova senha.")
      return
    }
    if (currentPassword === newPassword) {
      toast.error("A nova senha deve ser diferente da senha atual.")
      return
    }

    setChangingPassword(true)
    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      )
      await reauthenticateWithCredential(user, credential)
      await updatePassword(auth.currentUser ?? user, newPassword)
      setCurrentPassword("")
      setNewPassword("")
      setPasswordConfirmation("")
      toast.success("Senha alterada com sucesso.")
    } catch (error) {
      toast.error(getPasswordErrorMessage(error))
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading || !user) {
    return (
      <div>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Skeleton className="h-48 w-full rounded-[28px]" />
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-96 w-full rounded-[28px]" />
            <Skeleton className="h-96 w-full rounded-[28px]" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="surface-card-strong overflow-hidden">
          <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#22C55E]/12 blur-3xl" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-[30px] border border-[#22C55E]/25 bg-[#22C55E]/12 text-3xl font-semibold text-[#15803D] shadow-[0_18px_42px_rgba(34,197,94,0.15)] dark:text-[#4ADE80]">
              {initials}
            </div>
            <div className="relative min-w-0">
              <span className="inline-flex rounded-full border border-[#22C55E]/20 bg-[#22C55E]/10 px-4 py-2 text-sm font-medium text-[#15803D] dark:text-[#4ADE80]">
                Área do usuário
              </span>
              <h1 className="mt-4 truncate text-3xl font-semibold tracking-tight text-[#0F172A] dark:text-white">
                {savedProfileName}
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#64748B] dark:text-[#94A3BB]">
                Consulte seus dados, personalize como seu nome aparece e mantenha
                sua conta protegida.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
          <section className="surface-card p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#3B82F6]/10 text-[#3B82F6]">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[#0F172A] dark:text-white">
                  Informações pessoais
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#64748B] dark:text-[#94A3BB]">
                  E-mail e telefone estão vinculados à sua conta.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B] dark:text-[#94A3BB]">
                  <Mail className="h-4 w-4" />
                  E-mail
                </div>
                <p className="mt-2 break-all text-sm font-medium text-foreground">
                  {user.email ?? "Não informado"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B] dark:text-[#94A3BB]">
                  <Phone className="h-4 w-4" />
                  Telefone
                </div>
                {phoneLoading || phoneUserId !== user.uid ? (
                  <Skeleton className="mt-2 h-5 w-40" />
                ) : (
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {phoneNumber}
                  </p>
                )}
              </div>
            </div>

            <form className="mt-7" onSubmit={handleSaveName}>
              <label
                htmlFor="profile-name"
                className="flex items-center gap-2 text-sm font-semibold text-foreground"
              >
                <PencilLine className="h-4 w-4 text-[#22C55E]" />
                Nome de exibição
              </label>
              <Input
                id="profile-name"
                className="mt-3"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                maxLength={60}
                autoComplete="name"
                aria-describedby="profile-name-help"
              />
              <Button
                type="submit"
                className="mt-4 w-full sm:w-auto"
                disabled={
                  savingName ||
                  !profileName.trim() ||
                  profileName.trim() === savedProfileName
                }
              >
                {savingName ? (
                  <LoaderCircle className="animate-spin" />
                ) : profileName.trim() === savedProfileName ? (
                  <Check />
                ) : (
                  <Save />
                )}
                {profileName.trim() === savedProfileName
                  ? "Nome salvo"
                  : "Salvar nome"}
              </Button>
            </form>
          </section>

          <section className="surface-card p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#22C55E]/10 text-[#16A34A] dark:text-[#4ADE80]">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[#0F172A] dark:text-white">
                  Alterar senha
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#64748B] dark:text-[#94A3BB]">
                  Confirme sua identidade antes de definir uma nova senha.
                </p>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleChangePassword}>
              <div>
                <label
                  htmlFor="current-password"
                  className="text-sm font-semibold text-foreground"
                >
                  Senha atual
                </label>
                <div className="relative mt-2">
                  <Input
                    id="current-password"
                    type={showPasswords ? "text" : "password"}
                    value={currentPassword}
                    onChange={(event) =>
                      setCurrentPassword(event.target.value)
                    }
                    autoComplete="current-password"
                    className="pr-12"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#64748B] transition-colors hover:text-foreground"
                    onClick={() => setShowPasswords((visible) => !visible)}
                    aria-label={
                      showPasswords ? "Ocultar senhas" : "Mostrar senhas"
                    }
                  >
                    {showPasswords ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label
                  htmlFor="new-password"
                  className="text-sm font-semibold text-foreground"
                >
                  Nova senha
                </label>
                <Input
                  id="new-password"
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  className="mt-2"
                  aria-describedby="password-help"
                />
              </div>
              <div>
                <label
                  htmlFor="password-confirmation"
                  className="text-sm font-semibold text-foreground"
                >
                  Confirmar nova senha
                </label>
                <Input
                  id="password-confirmation"
                  type={showPasswords ? "text" : "password"}
                  value={passwordConfirmation}
                  onChange={(event) =>
                    setPasswordConfirmation(event.target.value)
                  }
                  autoComplete="new-password"
                  minLength={6}
                  className="mt-2"
                />
              </div>
              <p
                id="password-help"
                className="text-xs leading-5 text-[#64748B] dark:text-[#94A3BB]"
              >
                Use pelo menos 6 caracteres e evite reutilizar sua senha atual.
              </p>
              <Button
                type="submit"
                className="w-full"
                disabled={
                  changingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !passwordConfirmation
                }
              >
                {changingPassword ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <ShieldCheck />
                )}
                {changingPassword ? "Alterando senha..." : "Alterar senha"}
              </Button>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}
