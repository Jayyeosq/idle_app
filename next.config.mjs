/** @type {import('next').NextConfig} */
const nextConfig = {
  // File-based storage (see src/lib/storage.ts) touches the filesystem at
  // request time, so this app needs a persistent Node.js server rather than
  // a purely static or edge deployment. Standalone output keeps self-hosting
  // (Docker, a small VPS, etc.) simple. See README.md for deployment notes.
  output: "standalone",
};

export default nextConfig;
