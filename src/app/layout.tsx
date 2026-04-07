import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aura Calendar | Smart Visual Planner",
  description: "A premium interactive calendar component with smart scheduling and visual themes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
