"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { auth } from "@/lib/firebase"
import {
  getDefaultProfileName,
  getProfileNameStorageKey,
  PROFILE_NAME_UPDATED_EVENT,
} from "@/lib/profile"
import { signOut } from "firebase/auth"
import { LogOut, Settings2, UserRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuthState } from "react-firebase-hooks/auth"
import { toast } from "sonner"

export const AccountMenu = () => {
  const [user, loading] = useAuthState(auth)
  const [storedProfile, setStoredProfile] = useState<{
    userId: string
    name: string
  } | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!user) return

    const storageKey = getProfileNameStorageKey(user.uid)
    const syncProfileName = () => {
      let name = getDefaultProfileName(user.email)
      try {
        name = window.localStorage.getItem(storageKey)?.trim() || name
      } catch {
        // Browsers can disable local storage. The derived name remains usable.
      }
      setStoredProfile({ userId: user.uid, name })
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) syncProfileName()
    }

    const initialSync = window.setTimeout(syncProfileName, 0)
    window.addEventListener(PROFILE_NAME_UPDATED_EVENT, syncProfileName)
    window.addEventListener("storage", handleStorage)

    return () => {
      window.clearTimeout(initialSync)
      window.removeEventListener(PROFILE_NAME_UPDATED_EVENT, syncProfileName)
      window.removeEventListener("storage", handleStorage)
    }
  }, [user])

  const accountSignOut = async () => {
    try {
      await signOut(auth)
      router.push("/login")
    } catch {
      toast.error("Não foi possível sair da conta.")
    }
  }

  const profileName =
    storedProfile && user && storedProfile.userId === user.uid
      ? storedProfile.name
      : getDefaultProfileName(user?.email)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Abrir menu da conta"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/80 text-[#334155] shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-all hover:scale-[1.02] hover:border-[#22C55E]/40 hover:text-[#22C55E] dark:bg-white/5 dark:text-[#E2E8F0] dark:hover:text-[#22C55E]"
        >
          <Settings2 className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex min-w-0 flex-col gap-0.5">
          {loading ? (
            <>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-1 h-3 w-40" />
            </>
          ) : (
            <>
              <span className="truncate text-sm font-semibold text-foreground">
                {profileName || getDefaultProfileName(user?.email)}
              </span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {user?.email || "Usuário desconhecido"}
              </span>
            </>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <UserRound className="h-4 w-4" />
            <span>Meu perfil</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-rose-500 focus:text-rose-600 dark:text-rose-300 dark:focus:text-rose-200"
          onSelect={() => void accountSignOut()}
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
