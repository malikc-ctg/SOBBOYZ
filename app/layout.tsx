import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';


import localFont from 'next/font/local';
import { LenisProvider } from '@/lib/motion/LenisProvider';
import AuthInterceptor from '@/components/shared/AuthInterceptor';
import MetricoolScript from '@/components/shared/MetricoolScript';
import { AppearanceProvider } from '@/lib/theme/AppearanceProvider';

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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${rustic.variable} ${brice.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=location.pathname||'';if(p.indexOf('/sobadmin')===0||p.indexOf('/sales')===0){var h=document.documentElement;var r=localStorage.getItem('sob_os_appearance_v1');var s=r?JSON.parse(r):{};var m=s.mode||'ocean-dark';if(m==='system'){m=window.matchMedia('(prefers-color-scheme: dark)').matches?'ocean-dark':'frosted-light';}h.setAttribute('data-os-active','true');h.setAttribute('data-os-theme',m);h.setAttribute('data-os-accent',s.accent||'blue');if(m==='frosted-light'){h.classList.remove('dark');}else{h.classList.add('dark');}}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <AppearanceProvider>
          <AuthInterceptor />
          <LenisProvider>
            {children}
          </LenisProvider>
          <Toaster position="top-right" richColors />
        </AppearanceProvider>
        <MetricoolScript />
      </body>
    </html>
  );
}
