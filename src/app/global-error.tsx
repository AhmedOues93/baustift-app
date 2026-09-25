"use client";

/**
 * Letzte Auffangstelle: ein Fehler im Wurzel-Layout selbst.
 *
 * Hier greift error.tsx nicht mehr, weil das Layout gar nicht erst steht —
 * deshalb bringt diese Seite eigenes html und body mit und kommt ohne die
 * Schriften und Farbtoken der App aus. Sie soll nicht schön sein, sondern
 * überhaupt erscheinen.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          background: "#f3efe7",
          color: "#1b1a17",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>
          Baustift konnte nicht geladen werden
        </h1>
        <p style={{ margin: 0, color: "#5f5a50", maxWidth: "24rem" }}>
          Deine Daten sind nicht betroffen. Bitte lade die Seite neu.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: "3rem",
            padding: "0 1.5rem",
            borderRadius: "1.25rem",
            border: "none",
            background: "#c2410c",
            color: "#fff",
            fontSize: "1rem",
            fontWeight: 500,
          }}
        >
          Neu laden
        </button>
      </body>
    </html>
  );
}
