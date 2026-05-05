import type { Metadata } from "next";
import { Poppins, Open_Sans, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Business360 — Modular ERP SaaS",
  description: "The modular ERP SaaS platform built for growing businesses. Install only what you need.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: `(function(){var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark');})()`}} />
      </head>
      <body className={`${poppins.variable} ${openSans.variable} ${geistMono.variable} h-full antialiased min-h-full flex flex-col bg-background text-foreground`}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
