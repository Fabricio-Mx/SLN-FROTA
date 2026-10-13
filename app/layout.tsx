import React from "react"
import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider'
import {
  APP_THEME_CLASS_MAP,
  APP_THEME_STORAGE_KEY,
  APP_THEMES,
  DEFAULT_APP_THEME,
  NAVY_THEME_FILTER_ID,
  NAVY_THEME_INVERSE_FILTER_ID,
  buildNavyThemeColorMatrices,
} from '@/lib/app-themes'
import './globals.css'

const navyThemeMatrices = buildNavyThemeColorMatrices()

const nunito = Nunito({ 
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["400", "700", "800", "900"]
});

export const metadata: Metadata = {
  title: 'Sistema de Frota | Controle de Veículos',
  description: 'Sistema de gestão e controle de frota de veículos corporativos',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`font-sans antialiased overflow-x-hidden ${nunito.variable}`}>
        <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: 'absolute' }}>
          <filter id={NAVY_THEME_FILTER_ID} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={navyThemeMatrices.forward} />
          </filter>
          <filter id={NAVY_THEME_INVERSE_FILTER_ID} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={navyThemeMatrices.inverse} />
          </filter>
        </svg>
        <ThemeProvider
          attribute="class"
          defaultTheme={DEFAULT_APP_THEME}
          enableSystem={false}
          themes={APP_THEMES.map((theme) => theme.id)}
          value={APP_THEME_CLASS_MAP}
          storageKey={APP_THEME_STORAGE_KEY}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
