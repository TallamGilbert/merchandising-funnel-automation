/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @mms/ui ships TypeScript source; Next compiles it with the app.
  transpilePackages: ["@mms/ui"],
};

export default nextConfig;
