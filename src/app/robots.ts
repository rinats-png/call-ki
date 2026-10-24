import type { MetadataRoute } from "next";

/** Das Portal ist nicht öffentlich – Suchmaschinen sollen nichts indexieren. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
