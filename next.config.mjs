/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    "/api/agregados/export": ["./public/templates/**"],
    "/api/multas/termo": ["./termo/logo-sln.jpeg"],
  },
}

export default nextConfig
