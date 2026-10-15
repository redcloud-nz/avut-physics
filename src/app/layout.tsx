import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
    title: { template: "%s | Physics Visualisations", default: "Physics Visualisations" },
    description: "Interactive physics diagrams with adjustable parameters",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
        >
            <body className="h-dvh overflow-hidden font-sans">
                {/* The page scrolls inside this box rather than the window, so its scrollbar can be styled everywhere. */}
                <div className="page-scroll flex h-full flex-col overflow-y-auto">
                    {children}
                    <footer className="mt-auto px-4 pb-6 text-center text-sm text-slate-500 print:hidden">
                        <a
                            href="https://github.com/redcloud-nz/avut-physics"
                            className="hover:text-sky-300"
                        >
                            Source on GitHub
                        </a>
                    </footer>
                </div>
            </body>
        </html>
    );
}
