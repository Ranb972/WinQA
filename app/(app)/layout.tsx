import { SignedIn, SignedOut } from "@clerk/nextjs";
import Navbar from "@/components/Navbar";

// Server-rendered Clerk control components call auth() and opt this group into
// dynamic rendering — intentional here (flash-free auth branching for the app),
// and exactly why they must NOT live in the root layout (see (public) group).
export default function AppLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <>
            <SignedIn>
                <Navbar />
                <main className="pt-20 sm:pt-24 px-3 sm:px-4 md:px-6 pb-6 sm:pb-8 max-w-7xl mx-auto relative">
                    {children}
                </main>
            </SignedIn>
            <SignedOut>
                {children}
            </SignedOut>
        </>
    );
}
