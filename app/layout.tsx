import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Business Engine — YouTube to Production',
    template: '%s · Business Engine',
  },
  description:
    'Transform YouTube tutorials into deployable production systems: skills, DAGs, artifacts, and marketing assets.',
  openGraph: {
    title: 'Business Engine',
    description: 'Turn tutorials into sellable production systems.',
    type: 'website',
  },
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
