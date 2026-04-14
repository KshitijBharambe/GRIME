import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { PageProgress } from "@/components/ui/page-progress";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "GRIME",
  description: "Generalized Rule & Integrity Management Engine",
  keywords: ["data quality", "data cleansing", "data validation", "ETL"],
  icons: {
    icon: [
      { url: "/favicon-16x16.svg", sizes: "16x16", type: "image/svg+xml" },
      { url: "/favicon-32x32.svg", sizes: "32x32", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    apple: {
      url: "/apple-touch-icon.svg",
      sizes: "180x180",
      type: "image/svg+xml",
    },
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <NextThemesProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={null}>
            <PageProgress />
          </Suspense>
          <AuthProvider>
            <QueryProvider>
              <CommandPalette />
              {children}
            </QueryProvider>
          </AuthProvider>
        </NextThemesProvider>
      </body>
    </html>
  );
}
