/** @type {import('next').NextConfig} */

// Allow the practice website to embed the intake widget in an iframe.
// (CSP frame-ancestors replaces X-Frame-Options and supports specific origins.)
const FRAME_ANCESTORS =
  "frame-ancestors 'self' https://destinationsmile.com https://*.destinationsmile.com http://localhost:* http://127.0.0.1:*"

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Content-Security-Policy", value: FRAME_ANCESTORS },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Recorder needs camera/mic/display-capture; everything else off.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
]

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
