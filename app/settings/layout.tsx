import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = {
  title: pageMetadata.settings.title,
  description: pageMetadata.settings.description,
  openGraph: {
    title: pageMetadata.settings.title,
    description: pageMetadata.settings.description,
  },
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
