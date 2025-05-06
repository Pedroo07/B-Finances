export default function RootLayout({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    return (
      <html lang="en">
        <body className="bg-slate-800 dark:bg-slate-800">
          {children}
        </body>
      </html>
    );
  }
  