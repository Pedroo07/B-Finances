import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import {Montserrat} from '@next/font/google'
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "B Finance | Sistema Financeiro",
  description: "Gerencie receitas, despesas, transações e cartões em um único painel.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-mont', 
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${montserrat.className} page-shell`} suppressHydrationWarning>
        <Providers>
          <AuthProvider>
            {children}
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
