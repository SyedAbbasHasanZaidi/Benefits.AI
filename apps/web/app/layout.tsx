import type { Metadata } from 'next'
import { Hanken_Grotesk } from 'next/font/google'
import { AuthProvider } from '@/lib/auth/context'
import './globals.css'

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-hanken',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Benefits.AI',
  description: 'Discover Australian government entitlements you may qualify for',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={hanken.variable}>
      <body className="antialiased" style={{ fontFamily: 'var(--font-hanken, "Hanken Grotesk", sans-serif)' }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
