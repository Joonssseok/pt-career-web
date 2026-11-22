/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(process.env.NODE_ENV === 'development' && process.env.PTCAREER_DEV_DIST_DIR
    ? { distDir: process.env.PTCAREER_DEV_DIST_DIR }
    : {}),
};

export default nextConfig;
