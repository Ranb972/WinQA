import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import PageTransition from '@/components/PageTransition';

export const metadata: Metadata = {
  title: pageMetadata.insights.title,
  description: pageMetadata.insights.description,
  alternates: { canonical: pageMetadata.insights.canonical },
  openGraph: {
    title: pageMetadata.insights.title,
    description: pageMetadata.insights.description,
  },
};

export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
