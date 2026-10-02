import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not advertise the framework in an X-Powered-By response header
  poweredByHeader: false,

  // Security headers
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            // Content Security Policy
            // Note: 'unsafe-inline' and 'unsafe-eval' needed for Next.js and Framer Motion
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://just-ant-19.clerk.accounts.dev https://challenges.cloudflare.com https://clerk.winqa.ai https://*.clerk.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://api.cohere.ai https://generativelanguage.googleapis.com https://api.groq.com https://api.mistral.ai wss://*.clerk.accounts.dev https://challenges.cloudflare.com https://clerk-telemetry.com https://clerk.winqa.ai https://*.clerk.com wss://clerk.winqa.ai",
              "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://challenges.cloudflare.com https://clerk.winqa.ai https://*.clerk.com",
              "worker-src 'self' blob:",
              "base-uri 'self'",
              "object-src 'none'",
              // Matches X-Frame-Options: DENY above. Clerk and the Vercel toolbar frame their own
              // origins INTO this app (frame-src); neither frames WinQA itself.
              "frame-ancestors 'none'",
              // The app has no HTML form that posts cross-origin, and Clerk components submit via fetch, which connect-src already governs.
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
