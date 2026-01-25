import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import PageTransition from '@/components/PageTransition';

export const metadata: Metadata = {
  title: pageMetadata.codeTesting.title,
  description: pageMetadata.codeTesting.description,
  openGraph: {
    title: pageMetadata.codeTesting.title,
    description: pageMetadata.codeTesting.description,
  },
};

export default function CodeTestingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
