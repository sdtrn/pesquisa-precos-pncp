import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pesquisa de Preços PNCP | Auditoria & Parecer Técnico (Lei 14.133/2021)",
  description:
    "Plataforma de pesquisa de preços em Atas de Registro de Preços do PNCP com auditoria R1–R7, análise estatística, gráficos de dispersão e exportação para Excel (.xlsx), PDF e CSV. Desenvolvido por Sérgio Dantas Torres.",
  authors: [{ name: "Sérgio Dantas Torres" }],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.svg"],
    apple: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gov-mesh font-sans antialiased selection:bg-[#1B365D] selection:text-white dark:selection:bg-[#B59410] dark:selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
