import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import PageTransition from '@/components/PageTransition';

export const metadata: Metadata = {
  title: pageMetadata.bugs.title,
  description: pageMetadata.bugs.description,
  alternates: { canonical: pageMetadata.bugs.canonical },
  openGraph: {
    title: pageMetadata.bugs.title,
    description: pageMetadata.bugs.description,
  },
};

export default function BugsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
