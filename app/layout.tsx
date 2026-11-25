import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const poppins = localFont({
  variable: "--font-poppins",
  src: [
    { path: "../public/Poppins/Poppins-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/Poppins/Poppins-Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/Poppins/Poppins-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../public/Poppins/Poppins-Bold.ttf", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "CLH",
  description: "Campus Learning Hub",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full bg-hitamdov flex flex-col font-poppins">
        {children}
      </body>
    </html>
  );
}
