import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './globals.css';
import Providers from '@/components/Providers';

export const metadata: Metadata = { title: { default: 'NexBank', template: '%s · NexBank' }, description: 'NexBank — a simulated digital banking platform.' };
export const viewport: Viewport = { themeColor: '#0f5c4d', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
