import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
          borderRadius: '96px',
        }}
      >
        <span
          style={{
            fontSize: '320px',
            fontWeight: 'bold',
            color: 'white',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          W
        </span>
      </div>
    ),
    {
      width: 512,
      height: 512,
    }
  );
}
