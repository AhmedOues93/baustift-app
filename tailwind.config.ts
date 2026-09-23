import type { Config } from "tailwindcss";

/**
 * Tailwind-Konfiguration = die Design-Tokens aus globals.css, nutzbar gemacht.
 *
 * `colors` wird NICHT erweitert, sondern ERSETZT. Damit gibt es die
 * Standardpalette (slate, blue, red …) im Projekt nicht mehr — eine versehentlich
 * stehengebliebene Klasse wie `bg-blue-500` erzeugt dann einfach kein CSS und
 * fällt beim Durchsehen sofort auf. Genau das ist der Zweck: es soll unmöglich
 * sein, aus der Palette auszubrechen, ohne es zu merken.
 */
/**
 * Baut aus einer Kanal-Variablen eine Farbe, die Tailwinds Deckkraft-Kürzel
 * versteht: `bg-tief/10` wird zu `rgb(27 26 23 / 0.1)`.
 * Ohne den `<alpha-value>`-Platzhalter fällt jedes `/xx` still aus.
 */
const farbe = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",

      /* Flächen */
      papier: farbe("--farbe-papier"),
      flaeche: farbe("--farbe-flaeche"),
      tief: farbe("--farbe-tief"),

      /* Linien */
      linie: farbe("--farbe-linie"),

      /* Schrift */
      text: {
        DEFAULT: farbe("--farbe-text"),
        leise: farbe("--farbe-text-leise"),
        invers: farbe("--farbe-text-invers"),
      },

      /* Akzent */
      akzent: {
        DEFAULT: farbe("--farbe-akzent"),
        hover: farbe("--farbe-akzent-hover"),
        flaeche: farbe("--farbe-akzent-flaeche"),
      },

      /* Zustände */
      erfolg: {
        DEFAULT: farbe("--farbe-erfolg"),
        flaeche: farbe("--farbe-erfolg-flaeche"),
      },
      warnung: {
        DEFAULT: farbe("--farbe-warnung"),
        flaeche: farbe("--farbe-warnung-flaeche"),
      },
      info: {
        DEFAULT: farbe("--farbe-info"),
        flaeche: farbe("--farbe-info-flaeche"),
      },
    },

    extend: {
      fontFamily: {
        titel: ["var(--schrift-titel)", "system-ui", "sans-serif"],
        sans: ["var(--schrift-text)", "system-ui", "sans-serif"],
        zahl: ["var(--schrift-zahl)", "ui-monospace", "monospace"],
      },

      /**
       * Radien-Stufen statt freier Zahlen — so bleibt die Rundung im ganzen
       * Produkt konsistent.
       *   feld   12px  Eingaben, Chips, kleine Karten
       *   karte  16px  Listenkarten, Dialoge auf dem Desktop
       *   gross  20px  primäre Buttons
       *   sheet  24px  Bottom Sheet (nur oben gerundet)
       *   tafel  28px  grosse Aktionsflächen ("Neues Angebot")
       */
      borderRadius: {
        feld: "12px",
        karte: "16px",
        gross: "20px",
        sheet: "24px",
        tafel: "28px",
      },

      boxShadow: {
        karte: "var(--schatten-karte)",
        schwebend: "var(--schatten-schwebend)",
        sheet: "var(--schatten-sheet)",
      },

      /* Höhe der Tab-Leiste — an mehreren Stellen gebraucht (FAB, Abstände). */
      spacing: {
        navleiste: "4.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
