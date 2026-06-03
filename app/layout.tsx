import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "e-SIGN.PDF — Signature électronique",
  description: "Signez vos PDF électroniquement. Traitement local, aucune donnée envoyée.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;500;600&family=Dancing+Script:wght@700&family=Whisper&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
