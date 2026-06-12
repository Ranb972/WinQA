'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import ChatInterface from '@/components/ChatInterface';
import { Skeleton } from '@/components/ui/skeleton';

function ChatLabContent() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get('prompt') || undefined;
  const mode = searchParams.get('mode');
  const initialCompareMode = mode === 'compare';

  return <ChatInterface initialPrompt={initialPrompt} initialCompareMode={initialCompareMode} />;
}

function ChatLabSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      {/* Header skeleton */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-48 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>

      {/* Messages area skeleton */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Input skeleton */}
      <div className="p-4 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Skeleton className="flex-1 h-[60px] rounded-md" />
          <Skeleton className="h-[60px] w-[60px] rounded-md" />
        </div>
      </div>
    </div>
  );
}

export default function ChatLabPage() {
  return (
    <div className="h-screen">
      <Suspense fallback={<ChatLabSkeleton />}>
        <ChatLabContent />
      </Suspense>
    </div>
  );
}
