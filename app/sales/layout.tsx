import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sales OS | Sea of Blue',
  description: 'Sea of Blue Sales Operating System — Field Canvassing, Commercial B2B, and Tele-Sales Workstation',
  manifest: '/sales-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sales OS',
  },
};

export default function SalesOSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
