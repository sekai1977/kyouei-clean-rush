import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL('https://kyouei-clean-rush.sekai1977.chatgpt.site'),
  title: 'CLEAN RUSH｜共栄美装 収集チャレンジ',
  description: '街の3か所を回収して、60秒以内にセンターへ。スマホで遊べる3D収集タイムトライアルの企画体験版。',
  icons: { icon: '/favicon.svg', apple: '/favicon.svg' },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'CLEAN RUSH', statusBarStyle: 'black-translucent' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#10283a' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
