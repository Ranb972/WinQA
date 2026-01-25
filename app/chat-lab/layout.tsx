import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import PageTransition from '@/components/PageTransition';

export const metadata: Metadata = {
  title: pageMetadata.chatLab.title,
  description: pageMetadata.chatLab.description,
  openGraph: {
    title: pageMetadata.chatLab.title,
    description: pageMetadata.chatLab.description,
  },
};

export default function ChatLabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
