import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-neutral-100 dark:bg-slate-800">
        <AuthProvider>
        {children}
        </AuthProvider>
      </body>
    </html>
  );
}
