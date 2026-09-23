import "server-only";

import Stripe from "stripe";

import { serverEnv } from "@/lib/env";

/**
 * Stripe-Client.
 *
 * Als Funktion und nicht als Modul-Konstante: sonst würde der Key schon beim
 * Import gelesen und `next build` scheitert in einer Umgebung ohne Secrets.
 */
export function stripe(): Stripe {
  return new Stripe(serverEnv().stripeSecretKey, {
    // Feste API-Version: sonst ändert Stripe eines Tages das Format und der
    // Webhook interpretiert Felder anders, ohne dass hier etwas passiert ist.
    apiVersion: "2025-08-27.basil",
    appInfo: { name: "Baustift" },
  });
}

/**
 * Stripe-Status → unser Abo-Status.
 *
 * Stripe kennt neun Zustände, für das Produkt sind drei entscheidend: darf
 * jemand arbeiten, soll er zahlen, oder ist Schluss. `past_due` bleibt
 * bewusst aktiv — eine geplatzte Lastschrift ist ein Bankproblem, kein Grund,
 * einem Betrieb mitten am Tag das Werkzeug wegzunehmen. Stripe versucht es
 * mehrfach; erst `unpaid`/`canceled` beendet den Zugang.
 */
export function aboStatusAus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "trialing":
      return "trial";
    case "active":
    case "past_due":
      return "aktiv";
    case "paused":
      return "pausiert";
    default:
      return "gekuendigt";
  }
}
