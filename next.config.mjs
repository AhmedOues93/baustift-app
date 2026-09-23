/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // @react-pdf/renderer w les SDK serveur (Anthropic/OpenAI) lezemhom ymchiw
    // fel runtime Node, mouch fel bundle client.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
};

export default nextConfig;
