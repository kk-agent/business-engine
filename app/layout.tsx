import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Business Engine - Video to Production Pipeline',
  description: 'Transform YouTube tutorials into deployable production systems automatically',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
