import { Figtree } from 'next/font/google'

import getSongsByUserId from '@/actions/getSongsByUserId'
import getActiveProductsWithPrices from '@/actions/getActiveProductsWithPrices'
import Sidebar from '@/components/Sidebar'
import ToasterProvider from '@/provider/ToasterProvider'
import UserProvider from '@/provider/UserProvider'
import ModalProvider from '@/provider/ModalProvider'
import SupabaseProvider from '@/provider/SuperbaseProvider'
import Player from '@/components/Player'
import Footer from '@/components/Footer'

import './globals.css'
import type { Metadata } from 'next'

const font = Figtree({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Musify',
  description: 'Musify - Stream and discover music',
}

export const revalidate = 0;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const products = await getActiveProductsWithPrices();
  const userSongs = await getSongsByUserId();

  return (
    <html lang="en">
      <body className={font.className}>
        <ToasterProvider />
        <SupabaseProvider>
          <UserProvider>
            <ModalProvider products={products} />
            <Sidebar songs={userSongs}>
              {children}
            </Sidebar>
            <Player />
            <Footer/>
          </UserProvider>
        </SupabaseProvider>
      </body>
    </html>
  )
}
