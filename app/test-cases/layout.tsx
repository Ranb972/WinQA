import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import PageTransition from '@/components/PageTransition';

export const metadata: Metadata = {
  title: pageMetadata.testCases.title,
  description: pageMetadata.testCases.description,
  openGraph: {
    title: pageMetadata.testCases.title,
    description: pageMetadata.testCases.description,
  },
};

export default function TestCasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
