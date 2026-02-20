import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
              "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://api.cohere.ai https://generativelanguage.googleapis.com https://api.groq.com https://openrouter.ai wss://*.clerk.accounts.dev https://challenges.cloudflare.com https://clerk-telemetry.com https://clerk.winqa.ai https://*.clerk.com wss://clerk.winqa.ai",
              "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://challenges.cloudflare.com https://clerk.winqa.ai https://*.clerk.com",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
