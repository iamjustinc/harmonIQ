import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "harmonIQ - CRM Readiness Studio",
  description: "AI-assisted CRM data harmonization for Revenue Operations teams",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
