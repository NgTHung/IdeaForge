import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IdeaForge — Brainstorming canvas",
  description: "A local canvas for capturing and connecting ideas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
