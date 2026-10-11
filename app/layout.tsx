import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Onest } from "next/font/google";
import "./globals.css";
import MobileConsole from "./components/MobileConsole";
import Providers from "./providers";

// Títulos y números grandes
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

// Texto
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "xCal - Analiza tu comida con IA",
  description: "Escanea tus comidas con IA y alcanza tus objetivos nutricionales. Calcula calorías y macronutrientes personalizados.",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'xCal',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf4e6' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1220' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // next-themes pone la clase del tema en <html> antes de hidratar
    <html lang="es" suppressHydrationWarning>
      <body className={`${bricolage.variable} ${onest.variable} antialiased`}>
        <Providers>{children}</Providers>

        {/* Consola móvil para desarrollo */}
        <MobileConsole />
      </body>
    </html>
  );
}
