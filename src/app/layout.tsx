import type { Metadata } from "next";
import { Commissioner, Literata } from "next/font/google";
import "./globals.css";

const commissioner = Commissioner({
  variable: "--font-commissioner",
  subsets: ["greek", "latin"],
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["greek", "latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Iatreio — Διαχείριση Ιατρείου",
    template: "%s · Iatreio",
  },
  description:
    "Σύγχρονο πρόγραμμα διαχείρισης ιατρείου: ραντεβού, ηλεκτρονικός φάκελος ασθενή, τιμολόγηση και online κρατήσεις — με έξυπνα εργαλεία διοικητικής υποστήριξης.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="el" className={`${commissioner.variable} ${literata.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
