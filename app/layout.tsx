import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MobileConsole from "./components/MobileConsole";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "xCal - Analiza tu comida con IA",
  description: "Escanea tus comidas con IA y alcanza tus objetivos nutricionales. Calcula calorías y macronutrientes personalizados.",
  icons: {
    icon: '/favicon.png',
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
  themeColor: '#f97316',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'xCal',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        
        {/* Consola móvil para desarrollo */}
        <MobileConsole />
        
        {/* Footer Global */}
        <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center">
          <p className="text-sm text-slate-600">
            Desarrollada por{' '}
            <a 
              href="https://www.devvisualstudio.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-orange-500 font-semibold hover:text-orange-600 transition-colors hover:underline"
            >
              DevVisual Studio
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
