
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import React from 'react'
import { CiSettings } from "react-icons/ci";
import { toast } from 'sonner';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';

export const AccountMenu = () => {
    const [user, loading] = useAuthState(auth)
    const router = useRouter()

    const AccontSignOut = () => {
        signOut(auth).then(() =>
            router.push('/login')
        ).catch((error) => toast.error('error when logging out ', error))

    }
    return (
        <Dialog>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className='p-3 bg-gray-200 dark:bg-gray-800 rounded-lg'>
                        <CiSettings />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="flex flex-col">
                        {loading ? (
                            <span className="text-xs text-muted-foreground">Loanding...</span>
                        ) : (
                            <span className="text-xs font-normal text-muted-foreground">
                                {user?.email || 'unknown user'}
                            </span>
                        )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DialogTrigger asChild>
                    </DialogTrigger>
                    <DropdownMenuItem asChild className="text-rose-500 dark:text-rose-400" >
                        <button className="w-full" onClick={AccontSignOut}>
                            <span>Sair</span>
                        </button>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </Dialog>
    )
}
