'use client';

import { useUser } from '@clerk/nextjs';
import Navbar from '@/components/Navbar';

// Client-side auth shell for the static (public) pages. During prerender (and
// while Clerk loads) isSignedIn is undefined, so the static HTML contains the
// bare page content; signed-in visitors get the Navbar + app padding after
// hydration. Server-side SignedIn/SignedOut here would force dynamic rendering.
export default function PublicShell({ children }: { children: React.ReactNode }) {
    const { isSignedIn } = useUser();

    if (isSignedIn) {
        return (
            <>
                <Navbar />
                <main className="pt-20 sm:pt-24 px-3 sm:px-4 md:px-6 pb-6 sm:pb-8 max-w-7xl mx-auto relative">
                    {children}
                </main>
            </>
        );
    }

    return <>{children}</>;
}
