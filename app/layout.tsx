import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mellin-lab.nair-surya3.chatgpt.site"),
  title: "Mellin Lab — From moments to distributions",
  icons: { icon: "/favicon.svg" },
  description: "An interactive PDF inversion workbench. Explore Mellin moments, Tikhonov regularization and uncertainty propagation.",
  openGraph: {
    url: "https://mellin-lab.nair-surya3.chatgpt.site",
    title: "Mellin Lab",
    description: "From moments to distributions. An interactive PDF inversion workbench.",
    type: "website",
  },
  twitter: { card: "summary", title: "Mellin Lab", description: "From moments to distributions." },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
