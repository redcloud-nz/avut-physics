import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
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
