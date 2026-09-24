/* eslint-disable */
/**
 * Supabase-Ersatz für Tests — eine Datenbank im Arbeitsspeicher.
 *
 * WAS DAS PRÜFT UND WAS NICHT.
 * Damit lässt sich prüfen, was eine Server-Action tatsächlich SCHREIBEN will:
 * welche Zeilen sie anlegt, welche sie löscht, welche Felder sie setzt. Das
 * ist die Logik, die bisher niemand getestet hat.
 *
 * Es prüft NICHT das Verhalten von Postgres — Trigger, Summen, RLS, die
 * Unveränderlichkeit gestellter Rechnungen. Das wäre hier auch wertlos, weil
 * ein nachgebauter Trigger nur bestätigt, was ich selbst hineingeschrieben
 * habe. Dafür gibt es scripts/db-test.sh gegen ein echtes Postgres.
 *
 * Die Aufteilung ist Absicht: hier die Absicht der Anwendung, dort das
 * Verhalten der Datenbank.
 */

type Zeile = Record<string, any>;

export interface FakeDb {
  client: any;
  tabellen: Record<string, Zeile[]>;
  /** Für Zusicherungen: was wurde in welcher Reihenfolge aufgerufen? */
  aufrufe: string[];
}

export function fakeSupabase(
  start: Record<string, Zeile[]> = {},
  optionen: { user?: { id: string; email?: string } | null; rpc?: Record<string, any> } = {},
): FakeDb {
  const tabellen: Record<string, Zeile[]> = {};
  for (const [name, zeilen] of Object.entries(start)) {
    tabellen[name] = zeilen.map((z) => ({ ...z }));
  }
  const aufrufe: string[] = [];
  const user = optionen.user === undefined ? { id: "u1", email: "chef@betrieb.de" } : optionen.user;

  let zaehler = 0;
  const neueId = () => `neu-${++zaehler}`;

  class Abfrage {
    private tabelle: string;
    private filter: Array<(z: Zeile) => boolean> = [];
    private modus: "select" | "insert" | "update" | "delete" = "select";
    private nutzlast: Zeile[] = [];
    private aenderung: Zeile = {};
    private sollZurueck = false;

    constructor(tabelle: string) {
      this.tabelle = tabelle;
      if (!tabellen[tabelle]) tabellen[tabelle] = [];
    }

    select(_s?: string, o?: any) {
      if (this.modus === "select") this.sollZurueck = true;
      else this.sollZurueck = true;
      if (o?.head || o?.count) this.sollZurueck = true;
      return this;
    }
    eq(spalte: string, wert: any) {
      this.filter.push((z) => z[spalte] === wert);
      return this;
    }
    is(spalte: string, wert: any) {
      this.filter.push((z) => (z[spalte] ?? null) === wert);
      return this;
    }
    /** Nur die Form `not("id", "in", "(a,b)")`, die der Code benutzt. */
    not(spalte: string, _op: string, liste: string) {
      const ids = liste.replace(/[()]/g, "").split(",").filter(Boolean);
      this.filter.push((z) => !ids.includes(z[spalte]));
      return this;
    }
    order() {
      return this;
    }
    limit() {
      return this;
    }
    insert(zeilen: Zeile | Zeile[]) {
      this.modus = "insert";
      this.nutzlast = Array.isArray(zeilen) ? zeilen : [zeilen];
      aufrufe.push(`insert:${this.tabelle}`);
      return this;
    }
    update(werte: Zeile) {
      this.modus = "update";
      this.aenderung = werte;
      aufrufe.push(`update:${this.tabelle}`);
      return this;
    }
    delete() {
      this.modus = "delete";
      aufrufe.push(`delete:${this.tabelle}`);
      return this;
    }

    private treffer() {
      return tabellen[this.tabelle].filter((z) => this.filter.every((f) => f(z)));
    }

    private ausfuehren(): { data: any; error: null } {
      if (this.modus === "insert") {
        const neu = this.nutzlast.map((z) => ({ id: z.id ?? neueId(), ...z }));
        tabellen[this.tabelle].push(...neu);
        return { data: neu, error: null };
      }
      if (this.modus === "update") {
        const treffer = this.treffer();
        for (const z of treffer) Object.assign(z, this.aenderung);
        return { data: treffer, error: null };
      }
      if (this.modus === "delete") {
        const weg = new Set(this.treffer());
        tabellen[this.tabelle] = tabellen[this.tabelle].filter((z) => !weg.has(z));
        return { data: [...weg], error: null };
      }
      return { data: this.treffer(), error: null };
    }

    maybeSingle() {
      const { data } = this.ausfuehren();
      return Promise.resolve({ data: (data as Zeile[])[0] ?? null, error: null });
    }
    single() {
      return this.maybeSingle();
    }
    then(auf: any) {
      const { data } = this.ausfuehren();
      return Promise.resolve({ data, count: (data as Zeile[]).length, error: null }).then(auf);
    }
  }

  const client = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: (tabelle: string) => new Abfrage(tabelle),
    rpc: async (name: string, _args?: any) => {
      aufrufe.push(`rpc:${name}`);
      return { data: optionen.rpc?.[name] ?? null, error: null };
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: { path: "x" }, error: null }),
        download: async () => ({ data: null, error: null }),
        remove: async () => ({ data: null, error: null }),
        createSignedUrl: async () => ({ data: null, error: null }),
      }),
    },
  };

  return { client, tabellen, aufrufe };
}
