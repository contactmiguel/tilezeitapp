import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tile & Stone Takeoff",
  description: "Turn architectural plans into material takeoffs and estimates",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
