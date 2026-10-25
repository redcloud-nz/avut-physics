import { writeFile } from "node:fs/promises";
import path from "node:path";

import { EDITABLE } from "@/knots/editable";

/**
 * Saves the rope editor's steps over the file of the knot named by `?knot=` (see `editable.ts`), formatted as Prettier
 * would. Only while developing: it writes into the source.
 */
export async function POST(request: Request) {
    if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
    const slug = new URL(request.url).searchParams.get("knot");
    const knot = EDITABLE.find((k) => k.slug === slug);
    if (!knot) return new Response("No such knot", { status: 404 });
    const FILE = path.join(process.cwd(), knot.path);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !Array.isArray((body as { steps?: unknown }).steps))
        return new Response("Expected { steps: [...] }", { status: 400 });
    const prettier = await import("prettier");
    const options = (await prettier.resolveConfig(FILE)) ?? {};
    const text = await prettier.format(JSON.stringify(body), { ...options, filepath: FILE });
    await writeFile(FILE, text);
    return Response.json({ saved: true });
}
