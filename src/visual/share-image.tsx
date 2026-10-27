import { ImageResponse } from "next/og";
import type { ReactNode } from "react";

import { SITE } from "@/articles/prose";
import { vec2, type Vector2 } from "@/lib/vector2";

import { SERIES, SERIES_DESCRIPTION } from "./series";

/*
 * The picture a link to the visual introduction shows when it's shared: the page's headline beside two forces on a
 * bolt and the one they make together, on the series' dark background.
 */

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

/*
 * next/og draws this without the page's stylesheet, so it can't use the colour tokens in globals.css. These are their
 * dark values, and the picture is the same whatever theme a viewer uses.
 */
const BACKGROUND = "#020617";
const TOGETHER = "#f1f5f9";
const PULL = "#38bdf8";
const REDIRECT = "#a78bfa";

/** One kilonewton on the drawing's grid. */
const KN = 60;
const BOLT = vec2(90, 390);

/**
 * An arrow, called as a function: inside an <svg>, the image can only draw plain SVG elements, not components. A dashed
 * one, an arrow drawn again from the other's tip, goes without its head so as not to crowd the tip it shares.
 */
function arrow(props: { from: Vector2; v: Vector2; color: string; dashed?: boolean }) {
    const u = props.v.scale(1 / props.v.len());
    const tip = props.from.add(props.v);
    const base = tip.add(u.scale(-30));
    const side = u.perp().scale(13);
    const [p1, p2] = [base.add(side), base.sub(side)];
    return (
        <g opacity={props.dashed ? 0.6 : 1}>
            <line
                x1={props.from.x}
                y1={props.from.y}
                x2={base.x}
                y2={base.y}
                stroke={props.color}
                strokeWidth={props.dashed ? 5 : 8}
                strokeDasharray={props.dashed ? "14 10" : undefined}
            />
            {!props.dashed && (
                <polygon
                    points={`${tip.x},${tip.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`}
                    fill={props.color}
                />
            )}
        </g>
    );
}

/** Two forces on a bolt, added tip to tail, as on the page that adds arrows. */
function Forces() {
    const a = vec2(4, -1).scale(KN);
    const b = vec2(1, -4).scale(KN);
    return (
        <svg width={480} height={480} viewBox="0 0 480 480">
            {Array.from({ length: 9 }, (_, i) => (
                <g key={i}>
                    <line
                        x1={i * KN}
                        y1={0}
                        x2={i * KN}
                        y2={480}
                        stroke="#1e293b"
                        strokeWidth={2}
                    />
                    <line
                        x1={0}
                        y1={i * KN}
                        x2={480}
                        y2={i * KN}
                        stroke="#1e293b"
                        strokeWidth={2}
                    />
                </g>
            ))}
            {arrow({ from: BOLT.add(a), v: b, color: REDIRECT, dashed: true })}
            {arrow({ from: BOLT.add(b), v: a, color: PULL, dashed: true })}
            {arrow({ from: BOLT, v: a.add(b), color: TOGETHER })}
            {arrow({ from: BOLT, v: a, color: PULL })}
            {arrow({ from: BOLT, v: b, color: REDIRECT })}
            <circle cx={BOLT.x} cy={BOLT.y} r={11} fill="#94a3b8" />
        </svg>
    );
}

/** The site's icon: a pulley with a load on its rope (as src/app/icon.svg). */
function Icon() {
    return (
        <svg width={52} height={52} viewBox="0 0 64 64">
            <rect width="64" height="64" rx="14" fill="#0ea5e9" />
            <circle cx="32" cy="25" r="9.5" fill="none" stroke={BACKGROUND} strokeWidth="3.5" />
            <circle cx="32" cy="25" r="2.5" fill={BACKGROUND} />
            <path
                d="M18 58V25a14 14 0 0 1 28 0v11"
                fill="none"
                stroke={BACKGROUND}
                strokeWidth="5"
            />
            <rect x="36" y="36" width="20" height="17" rx="3" fill={BACKGROUND} />
        </svg>
    );
}

/**
 * A share picture: the eyebrow, title and text down the left, the site at the foot, and a picture on the right (by
 * default, the forces on a bolt).
 */
export function shareImage(props: {
    eyebrow: string;
    title: string;
    text: string;
    picture?: ReactNode;
}) {
    return new ImageResponse(
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                gap: 48,
                padding: "64px 56px 64px 72px",
                background: BACKGROUND,
            }}
        >
            <div
                style={{
                    flex: 1,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                }}
            >
                <div style={{ display: "flex", fontSize: 28, color: "#38bdf8" }}>
                    {props.eyebrow}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <div style={{ fontSize: 60, lineHeight: 1.1, color: "#f8fafc" }}>
                        {props.title}
                    </div>
                    <div style={{ fontSize: 28, lineHeight: 1.35, color: "#cbd5e1" }}>
                        {props.text}
                    </div>
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 18,
                        fontSize: 28,
                        color: "#94a3b8",
                    }}
                >
                    <Icon />
                    {SITE}
                </div>
            </div>
            {props.picture ?? <Forces />}
        </div>,
        SHARE_IMAGE_SIZE,
    );
}

/** The series' own picture: for links to its first page, and on that page beside the contents on a wide screen. */
export function seriesImage() {
    return shareImage({
        eyebrow: "Physics Visualisations",
        title: SERIES,
        text: SERIES_DESCRIPTION,
    });
}
