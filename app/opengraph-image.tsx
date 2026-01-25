import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'WinQA - AI Testing Playground';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 60,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          position: 'relative',
        }}
      >
        {/* Gradient orbs */}
        <div
          style={{
            position: 'absolute',
            top: '10%',
            left: '10%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(124, 58, 237, 0.4) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '10%',
            right: '10%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Logo/Title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '20px',
              fontSize: '48px',
              fontWeight: 'bold',
              color: 'white',
            }}
          >
            W
          </div>
          <span
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              background: 'linear-gradient(90deg, #7c3aed, #ec4899)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            WinQA
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '36px',
            color: '#e2e8f0',
            textAlign: 'center',
            maxWidth: '800px',
          }}
        >
          AI Testing Playground
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: '24px',
            color: '#94a3b8',
            textAlign: 'center',
            maxWidth: '900px',
            marginTop: '20px',
          }}
        >
          Compare AI models, test prompts, track bugs & master prompt engineering
        </div>
      </div>
    ),
    { ...size }
  );
}
