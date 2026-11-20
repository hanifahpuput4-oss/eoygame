import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'llysSmart',
    short_name: 'llysSmart',
    description: "llysSmart (Let's Learn Your Skills) - Platform game edukasi multiplayer untuk guru dan siswa.",
    start_url: '/',
    display: 'standalone',
    background_color: '#182234',
    theme_color: '#f59321',
    icons: [
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
