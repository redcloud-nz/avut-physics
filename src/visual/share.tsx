"use client";

import { Check, Link as LinkIcon, Mail, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { SITE } from "@/articles/prose";

const BUTTON =
    "flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 py-2 text-sm font-medium text-slate-200 hover:border-sky-500";

const noSubscribe = () => () => {};

/**
 * Ways to pass the series on: the phone's own share sheet where there is one, a link to copy, and Facebook, WhatsApp
 * and email.
 */
export function Share(props: { title: string; text: string; path: string }) {
    const url = `https://${SITE}${props.path}`;
    const [copied, setCopied] = useState(false);

    // Only known in the browser; the server's page goes without, so the first render matches it.
    const canShare = useSyncExternalStore(
        noSubscribe,
        () => typeof navigator.share === "function",
        () => false,
    );

    const message = `${props.title}: ${props.text}`;
    const links = [
        {
            name: "Facebook",
            href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        },
        {
            name: "WhatsApp",
            href: `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`,
        },
    ];

    return (
        <section className="flex flex-col gap-3 border-t border-slate-800 pt-5">
            <h2 className="text-sm font-medium text-slate-400">Share this series</h2>
            <div className="grid grid-cols-2 gap-2">
                {canShare && (
                    <button
                        type="button"
                        className={`${BUTTON} col-span-2 border-sky-500 text-sky-300`}
                        // Closing the share sheet without sharing rejects; there's nothing to do then.
                        onClick={() =>
                            navigator
                                .share({ title: props.title, text: props.text, url })
                                .catch(() => {})
                        }
                    >
                        <Share2 className="size-4" aria-hidden />
                        Share…
                    </button>
                )}
                <button
                    type="button"
                    className={BUTTON}
                    onClick={() =>
                        navigator.clipboard.writeText(url).then(() => {
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                        })
                    }
                >
                    {copied ? (
                        <Check className="size-4" aria-hidden />
                    ) : (
                        <LinkIcon className="size-4" aria-hidden />
                    )}
                    {copied ? "Copied" : "Copy link"}
                </button>
                <a
                    className={BUTTON}
                    href={`mailto:?subject=${encodeURIComponent(props.title)}&body=${encodeURIComponent(`${props.text}\n\n${url}`)}`}
                >
                    <Mail className="size-4" aria-hidden />
                    Email
                </a>
                {links.map((l) => (
                    <a
                        key={l.name}
                        className={BUTTON}
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {l.name}
                    </a>
                ))}
            </div>
        </section>
    );
}
