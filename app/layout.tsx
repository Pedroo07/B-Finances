import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="page-shell" suppressHydrationWarning>
        <Providers>
          <AuthProvider>
            {children}
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
