
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getAuth, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import React from 'react'
import { CiSettings } from "react-icons/ci";
import { toast } from 'sonner';

export const AccountMenu = () => {
    const auth = getAuth()
    const user = auth.currentUser
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
                            <>
                                <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                            </>
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
