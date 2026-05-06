
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import React from 'react'
import { LogOut, Settings2 } from "lucide-react";
import { toast } from 'sonner';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';


export const AccountMenu = () => {
    const [user, loading] = useAuthState(auth)
    const router = useRouter()

    const AccontSignOut = () => {
        signOut(auth).then(() =>
            router.push('/login')
        ).catch(() => toast.error('Não foi possível sair da conta.'))

    }
    return (
        <Dialog>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className='flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/80 text-[#334155] shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-all hover:scale-[1.02] hover:border-[#22C55E]/40 hover:text-[#22C55E] dark:bg-white/5 dark:text-[#E2E8F0] dark:hover:text-[#22C55E]'>
                        <Settings2 className='h-5 w-5' />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="flex flex-col">
                        {loading ? (
                           <Skeleton className='h-4 w-32' />
                        ) : (
                            <span className="text-sm font-medium text-foreground">
                                {user?.email || 'usuário desconhecido'}
                            </span>
                        )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DialogTrigger asChild>
                    </DialogTrigger>
                    <DropdownMenuItem asChild className="text-rose-500 dark:text-rose-300" >
                        <button className="w-full" onClick={AccontSignOut}>
                            <LogOut className='h-4 w-4' />
                            <span>Sair</span>
                        </button>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </Dialog>
    )
}
