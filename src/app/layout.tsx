import type { Metadata, Viewport } from 'next';
import { Fredoka, Nunito } from 'next/font/google';
import './globals.css';

const fredoka = Fredoka({
  subsets: ['latin'],
  variable: '--font-fredoka',
  weight: ['400', '500', '600', '700'],
});

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  weight: ['400', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: {
    default: 'llysSmart',
    template: '%s | llysSmart',
  },
  applicationName: 'llysSmart',
  description: "llysSmart (Let's Learn Your Skills) - Platform game edukasi multiplayer untuk guru dan siswa.",
  appleWebApp: {
    capable: true,
    title: 'llysSmart',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#f59321',
  interactiveWidget: 'overlays-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${fredoka.variable} ${nunito.variable}`}>{children}</body>
    </html>
  );
}
