import type { Metadata } from "next";
import "./globals.css";
import { Orbitron, Rajdhani, Great_Vibes, Pinyon_Script } from "next/font/google";

const orbitron = Orbitron({ subsets: ["latin"], weight: ["400", "700", "900"], variable: "--font-orbitron" });
const rajdhani = Rajdhani({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-rajdhani" });
const greatVibes = Great_Vibes({ subsets: ["latin"], weight: ["400"], variable: "--font-great-vibes" });
const pinyonScript = Pinyon_Script({ subsets: ["latin"], weight: ["400"], variable: "--font-pinyon-script" });

export const metadata: Metadata = {
  title: "e-SIGN.PDF — Signature électronique",
  description: "Signez vos PDF électroniquement. Traitement local, aucune donnée envoyée.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${orbitron.variable} ${rajdhani.variable} ${greatVibes.variable} ${pinyonScript.variable}`}>
      <body>{children}</body>
    </html>
  );
}
