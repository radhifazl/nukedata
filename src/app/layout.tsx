import type { Metadata } from "next";
import "./globals.css";
import { DatasetProvider } from "@/context/DatasetContext";
export const metadata: Metadata = { title: "NukeData — Clean data with confidence", description: "A focused workspace for finding and fixing CSV data-quality issues." };
export default function RootLayout({ children }: LayoutProps<"/">) { return <html lang="en"><body><DatasetProvider>{children}</DatasetProvider></body></html>; }
