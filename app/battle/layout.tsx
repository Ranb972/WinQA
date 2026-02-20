import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import PageTransition from '@/components/PageTransition';

export const metadata: Metadata = {
  title: pageMetadata.battle.title,
  description: pageMetadata.battle.description,
  openGraph: {
    title: pageMetadata.battle.title,
    description: pageMetadata.battle.description,
  },
};

export default function BattleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
