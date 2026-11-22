import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    cacheComponents: true,
    // In development, let a phone or tablet on the same network open the dev server by its address (it only allows
    // localhost otherwise). Private network addresses only.
    allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
    partialPrefetching: true,
    // MathJax typesets the maths on the server, loading parts of its font as it needs them; bundled, those parts
    // register on a different copy of the font than the one in use.
    serverExternalPackages: ["@mathjax/src", "@mathjax/mathjax-newcm-font"],
    // The ladder hinge page moved; keep links to its old address working.
    redirects() {
        return [{ source: "/ladder-hinge", destination: "/ladder-hinge-lower", permanent: true }];
    },
    turbopack: {
        rules: {
            "*.css": {
                loaders: ["@tailwindcss/turbopack"],
                as: "*.css",
            },
        },
    },
};

export default nextConfig;
