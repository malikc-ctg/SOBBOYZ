import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';


import localFont from 'next/font/local';
import { LenisProvider } from '@/lib/motion/LenisProvider';
import AuthInterceptor from '@/components/shared/AuthInterceptor';
import MetricoolScript from '@/components/shared/MetricoolScript';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const rustic = localFont({
  src: './fonts/Rustic Printed Regular.ttf',
  variable: '--font-rustic',
  display: 'swap',
});

const brice = localFont({
  src: './fonts/Brice Regular SemiExpanded.otf',
  variable: '--font-brice',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e40af',
};

export const metadata: Metadata = {
  title: 'Sea of Blue',
  description: 'Sea of Blue dispatch and operations platform',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sea of Blue',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${rustic.variable} ${brice.variable}`}>
      <body className="font-sans antialiased">
        <AuthInterceptor />
        <LenisProvider>
          {children}
        </LenisProvider>
        <Toaster position="top-right" richColors />
        <MetricoolScript />
      </body>
    </html>
  );
}
