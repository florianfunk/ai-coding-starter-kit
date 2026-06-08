import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withWorkflow } from "workflow/next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
};

// Order: next-intl plugin first, then the Workflow DevKit wrapper.
export default withWorkflow(withNextIntl(nextConfig));
