import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This repo keeps its agent rules in CLAUDE.md, so stop `next dev` from
  // generating a separate AGENTS.md.
  agentRules: false,
};

export default nextConfig;
