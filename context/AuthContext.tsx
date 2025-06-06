'use client'
import { createContext, ReactNode } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { auth } from '@/lib/firebase'
import { User } from 'firebase/auth'

type AuthContextType = {
  user: User | null
  loading: boolean
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
})

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, loading] = useAuthState(auth)

  return (
    <AuthContext.Provider value={{ user: user || null, loading }}>
      {children}
    </AuthContext.Provider>
  )
}