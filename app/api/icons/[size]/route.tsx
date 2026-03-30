import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(
  _req: Request,
  { params }: { params: { size: string } }
) {
  const size = parseInt(params.size) || 192

  return new ImageResponse(
    (
      <div
        style={{
          width:          size,
          height:         size,
          background:     '#2563eb',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          borderRadius:   size * 0.2,
        }}
      >
        <span
          style={{
            color:      'white',
            fontSize:   size * 0.42,
            fontWeight: 'bold',
            lineHeight: 1,
          }}
        >
          세
        </span>
      </div>
    ),
    { width: size, height: size }
  )
}
