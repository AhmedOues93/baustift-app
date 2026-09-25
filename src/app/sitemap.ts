import type { MetadataRoute } from "next";

import { publicEnv } from "@/lib/env";

/**
 * Nur die öffentlichen Seiten. Alles hinter der Anmeldung hat hier nichts
 * verloren — es wäre ohne Session ohnehin leer und würde nur die Adressen
 * bekannt machen.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const basis = publicEnv.siteUrl;
  const heute = new Date();

  return [
    { url: `${basis}/`, lastModified: heute, changeFrequency: "monthly", priority: 1 },
    { url: `${basis}/signup`, lastModified: heute, changeFrequency: "yearly", priority: 0.8 },
    { url: `${basis}/login`, lastModified: heute, changeFrequency: "yearly", priority: 0.3 },
    { url: `${basis}/rechtliches/impressum`, lastModified: heute, changeFrequency: "yearly", priority: 0.2 },
    { url: `${basis}/rechtliches/datenschutz`, lastModified: heute, changeFrequency: "yearly", priority: 0.2 },
    { url: `${basis}/rechtliches/agb`, lastModified: heute, changeFrequency: "yearly", priority: 0.2 },
    { url: `${basis}/rechtliches/av-vertrag`, lastModified: heute, changeFrequency: "yearly", priority: 0.2 },
  ];
}
