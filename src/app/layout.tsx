import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DbSessionProvider } from '@/hooks/useDbSession';

export const metadata: Metadata = {
  title: 'DB Refactor Toolkit',
  description: 'A toolkit for refactoring databases and codebases.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <DbSessionProvider>
          <SidebarProvider>
              {children}
          </SidebarProvider>
        </DbSessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
