import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent stale clients from invoking Server Actions from a previous deploy.
  // Vercel provides these values during the build; the commit hash keeps local
  // builds deterministic when no deployment id is available.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
};

export default nextConfig;
