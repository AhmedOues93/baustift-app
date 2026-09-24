/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // @react-pdf/renderer und die Server-SDKs (Anthropic/OpenAI) müssen im
  // Node-Runtime laufen und dürfen nicht ins Client-Bundle gebündelt werden.
  // Seit Next 15 heisst der Schalter so; unter experimental wird er ignoriert.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
