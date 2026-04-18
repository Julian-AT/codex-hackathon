import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Sentry pulls @sentry/node → Prisma OTEL instrumentation, which uses
    // dynamic requires webpack flags as "Critical dependency" (harmless noise).
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /node_modules\/@opentelemetry\/instrumentation/ },
      { module: /node_modules\/@prisma\/instrumentation/ },
    ];
    return config;
  },
};

export default nextConfig;
