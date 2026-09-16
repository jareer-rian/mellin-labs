import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mellin Labs",
  icons: { icon: "/favicon.svg" },
  description: "An interactive PDF inversion workbench. Explore Mellin moments, Tikhonov regularization and uncertainty propagation. 交互式 PDF 逆问题工作台：探索梅林矩、Tikhonov 正则化与不确定性传播。",
  openGraph: {
    title: "Mellin Labs",
    description: "From moments to distributions. An interactive PDF inversion workbench. 从矩到分布的交互式 PDF 逆问题工作台。",
    type: "website",
  },
  twitter: { card: "summary", title: "Mellin Labs", description: "From moments to distributions. 从矩到分布。" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
