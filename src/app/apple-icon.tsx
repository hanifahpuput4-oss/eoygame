import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #ffbe4d 0%, #f59321 55%, #d96b08 100%)',
          padding: 12,
        }}
      >
        <div
          style={{
            width: 152,
            height: 152,
            borderRadius: 34,
            background: 'linear-gradient(180deg, #263859 0%, #182234 100%)',
            border: '4px solid #8ea8d6',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="104" height="96" viewBox="0 0 200 185">
            <polygon points="38,78 24,26 76,52" fill="#ffb03b" stroke="#4e2b11" strokeWidth="8" strokeLinejoin="round" />
            <polygon points="162,78 176,26 124,52" fill="#ffb03b" stroke="#4e2b11" strokeWidth="8" strokeLinejoin="round" />
            <polygon points="44,68 35,38 66,54" fill="#ff8ab5" />
            <polygon points="156,68 165,38 134,54" fill="#ff8ab5" />

            <ellipse cx="100" cy="102" rx="68" ry="56" fill="#ffc93c" stroke="#4e2b11" strokeWidth="8" />
            <ellipse cx="100" cy="116" rx="42" ry="28" fill="#fff5e1" />

            <circle cx="74" cy="94" r="10" fill="#182234" />
            <circle cx="126" cy="94" r="10" fill="#182234" />
            <circle cx="71" cy="91" r="3.5" fill="#ffffff" />
            <circle cx="123" cy="91" r="3.5" fill="#ffffff" />

            <polygon points="100,108 93,101 107,101" fill="#ef4b5b" />
            <path d="M90 116 Q100 125 110 116" fill="none" stroke="#4e2b11" strokeWidth="6" strokeLinecap="round" />

            <polygon points="100,8 36,34 100,58 164,34" fill="#182234" stroke="#ffd338" strokeWidth="5" strokeLinejoin="round" />
            <rect x="70" y="48" width="60" height="14" rx="6" fill="#263859" stroke="#ffd338" strokeWidth="4" />
            <path d="M148 39 L156 68" stroke="#ffd338" strokeWidth="5" strokeLinecap="round" />
            <circle cx="156" cy="70" r="6" fill="#ffd338" />

            <rect x="52" y="138" width="96" height="40" rx="20" fill="#e8eefc" stroke="#233866" strokeWidth="7" />
            <path d="M76 151v14M69 158h14" stroke="#3b66c4" strokeWidth="6" strokeLinecap="round" />
            <circle cx="118" cy="153" r="5.5" fill="#ef4b5b" />
            <circle cx="130" cy="162" r="5.5" fill="#ffb03b" />
          </svg>

          <div
            style={{
              marginTop: 2,
              fontSize: 20,
              fontWeight: 900,
              color: '#ffd338',
              letterSpacing: '-0.5px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            llysSmart
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
