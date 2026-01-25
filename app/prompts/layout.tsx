import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import PageTransition from '@/components/PageTransition';

export const metadata: Metadata = {
  title: pageMetadata.prompts.title,
  description: pageMetadata.prompts.description,
  openGraph: {
    title: pageMetadata.prompts.title,
    description: pageMetadata.prompts.description,
  },
};

export default function PromptsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
