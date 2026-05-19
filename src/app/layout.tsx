import type { Metadata } from "next";
import { Anton, Condiment, Fustat, Inter, Noto_Sans, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const anton = Anton({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: "400",
});

const condiment = Condiment({
  variable: "--font-condiment",
  subsets: ["latin"],
  weight: "400",
});

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fustat = Fustat({
  variable: "--font-fustat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Movie Agentic RAG",
  description: "Movie recommendation chat and AI tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${condiment.variable} ${schibsted.variable} ${inter.variable} ${notoSans.variable} ${fustat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#010828] text-[#EFF4FF]">{children}</body>
    </html>
  );
}
