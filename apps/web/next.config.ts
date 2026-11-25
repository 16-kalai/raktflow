import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@raktflow/core", "@raktflow/db", "@raktflow/domain", "@raktflow/flags", "@raktflow/sarvam"],
  serverExternalPackages: ["pg", "@flagsmith/nodejs"],
  poweredByHeader: false,
};

export default config;
