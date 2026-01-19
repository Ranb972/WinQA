'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import ChatInterface from '@/components/ChatInterface';

function ChatLabContent() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get('prompt') || undefined;

  return <ChatInterface initialPrompt={initialPrompt} />;
}

export default function ChatLabPage() {
  return (
    <div className="h-screen">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-400">Loading...</div>
          </div>
        }
      >
        <ChatLabContent />
      </Suspense>
    </div>
  );
}
