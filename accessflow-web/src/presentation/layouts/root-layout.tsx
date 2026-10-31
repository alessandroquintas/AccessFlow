import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { cn } from "@/shared/lib/utils";
import { AppProviders } from "@/presentation/providers/app-providers";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
});

// A mono é só para identificadores de máquina (ver docs/design-direction.md).
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: o next-themes troca a classe do <html> antes da hidratação.
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn(plexSans.variable, plexMono.variable, "h-full antialiased")}
    >
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
