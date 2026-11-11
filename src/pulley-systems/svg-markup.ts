import { Fragment, isValidElement, type ReactNode } from "react";

/*
 * SVG drawn with React as a string of markup, for a picture next/og draws: Next won't let the app import
 * react-dom/server, and next/og draws only plain elements inside an <svg>, not components. This calls the components
 * itself, so it suits only those without hooks or context, as the systems' drawings are.
 */

/** Props React spells in camelCase that SVG spells the same, rather than with hyphens. */
const CAMEL = new Set([
    "viewBox",
    "gradientUnits",
    "gradientTransform",
    "maskUnits",
    "maskContentUnits",
    "patternUnits",
    "pathLength",
    "preserveAspectRatio",
]);

const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The attribute SVG has for a React prop. */
const attribute = (name: string) =>
    name === "className"
        ? "class"
        : CAMEL.has(name)
          ? name
          : name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** `node` as SVG markup. */
export function svgMarkup(node: ReactNode): string {
    if (node === null || node === undefined || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return escape(String(node));
    if (Array.isArray(node)) return node.map(svgMarkup).join("");
    if (!isValidElement(node)) return "";
    const props = node.props as Record<string, unknown> & { children?: ReactNode };
    if (node.type === Fragment) return svgMarkup(props.children);
    if (typeof node.type === "function")
        return svgMarkup((node.type as (p: typeof props) => ReactNode)(props));
    if (typeof node.type !== "string") return "";
    const attributes = Object.entries(props)
        .filter(([k, v]) => k !== "children" && v !== undefined && v !== null && v !== false)
        .map(([k, v]) => ` ${attribute(k)}="${escape(String(v))}"`)
        .join("");
    // A stylesheet's text is CSS, which escaping as text would spoil.
    const inner = node.type === "style" ? String(props.children ?? "") : svgMarkup(props.children);
    return `<${node.type}${attributes}>${inner}</${node.type}>`;
}
