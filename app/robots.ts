import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: '/api/',
      },
      {
        userAgent: 'ChatGPT-User',
        allow: '/',
        disallow: '/api/',
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: '/',
        disallow: '/api/',
      },
      {
        userAgent: 'ClaudeBot',
        allow: '/',
        disallow: '/api/',
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: '/api/',
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: '/api/',
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: '/api/',
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: '/api/',
      },
      {
        userAgent: 'Applebot-Extended',
        allow: '/',
        disallow: '/api/',
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: '/api/',
      },
    ],
    sitemap: 'https://winqa.ai/sitemap.xml',
  };
}
