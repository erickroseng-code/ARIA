import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ARIA - Your AI Assistant',
  description: 'Chat with ARIA, your intelligent AI assistant',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-background text-foreground antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
