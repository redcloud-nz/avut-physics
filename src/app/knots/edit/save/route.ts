import { writeFile } from "node:fs/promises";
import path from "node:path";

/** Where the figure-8's tying steps are kept, which the rope editor saves to. */
const FILE = path.join(process.cwd(), "src/knots/figure-eight-tying.json");

/**
 * Saves the rope editor's steps over `figure-eight-tying.json`, formatted as Prettier would. Only while
 * developing: it writes into the source.
 */
export async function POST(request: Request) {
    if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !Array.isArray((body as { steps?: unknown }).steps))
        return new Response("Expected { steps: [...] }", { status: 400 });
    const prettier = await import("prettier");
    const options = (await prettier.resolveConfig(FILE)) ?? {};
    const text = await prettier.format(JSON.stringify(body), { ...options, filepath: FILE });
    await writeFile(FILE, text);
    return Response.json({ saved: true });
}
