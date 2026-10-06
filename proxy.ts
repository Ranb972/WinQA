import { clerkMiddleware } from '@clerk/nextjs/server'

// Next 16 names this file proxy.ts and runs it on the Node.js runtime; the
// docs recommend the proxy name for the function as well.
const proxy = clerkMiddleware();

export default proxy;

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
