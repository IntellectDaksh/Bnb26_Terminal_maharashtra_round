import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Fair Drop | Anti-Bot Flash Ticket Drops",
  description: "Book high-demand events fairly. One entry per person, a randomized queue, and no advantage for bots.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} scroll-smooth h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
