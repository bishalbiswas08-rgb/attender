import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATTENDER | Smart attendance. Zero hassle.",
  description: "Modern AI-powered classroom attendance management system powered by Gemini Vision and Supabase.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased text-slate-900 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
