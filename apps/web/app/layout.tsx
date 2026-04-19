import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Benefits.AI',
  description: 'Discover Australian government entitlements you may qualify for',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
