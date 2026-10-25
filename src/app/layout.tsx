import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SITE } from "@/articles/prose";

import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    // Links shared from the site, and their pictures, need its full address.
    metadataBase: new URL(`https://${SITE}`),
    title: { template: "%s | Physics Visualisations", default: "Physics Visualisations" },
    description: "Interactive physics diagrams with adjustable parameters",
};

/** The browser's bars, where it colours them (Chrome on Android, Safari), take the page's background. */
export const viewport: Viewport = { themeColor: "#020617" };

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
        >
            {/* The site's chrome is in `(site)/layout.tsx`; the knot editor, in `(editor)`, has its own. */}
            <body className="h-dvh overflow-hidden font-sans">{children}</body>
        </html>
    );
}
