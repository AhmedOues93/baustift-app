/**
 * Erzeugt die PWA-Icons als PNG — ohne Bild-Bibliothek, nur mit `zlib` aus
 * Node. So bleiben die Icons im Repo reproduzierbar (`npm run icons`) und wir
 * schleppen keine Design-Tools als Abhängigkeit mit.
 *
 * Motiv: ein Zimmermannsbleistift (Baustift) mit Terrakotta-Mine auf dunklem
 * Grund — dieselben Tokens wie in der App.
 * Gezeichnet wird per Punkt-in-Polygon-Test pro Pixel — bei 512x512 ist das
 * in wenigen Millisekunden durch.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const GRUND = [27, 26, 23]; // --farbe-tief (fast schwarz)
const PAPIER = [243, 239, 231]; // --farbe-papier
const AKZENT = [194, 65, 12]; // --farbe-akzent (Terrakotta)

/** Liegt (x, y) im Polygon? Standard-Ray-Casting. */
function imPolygon(x, y, punkte) {
  let drin = false;
  for (let i = 0, j = punkte.length - 1; i < punkte.length; j = i++) {
    const [xi, yi] = punkte[i];
    const [xj, yj] = punkte[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      drin = !drin;
    }
  }
  return drin;
}

/**
 * Zeichnet das Motiv.
 * `rand` = Anteil Innenabstand. Für maskable Icons grösser, weil Android das
 * Icon rund oder als Squircle beschneidet und die Ecken wegfallen dürfen.
 */
function zeichne(groesse, { rand = 0.18, hintergrundRadius = 0.22 } = {}) {
  const px = new Uint8Array(groesse * groesse * 4);
  const s = groesse;
  const r = hintergrundRadius * s;

  // Bleistift als Polygon in relativen Koordinaten (0..1), diagonal.
  const skala = (pts) => pts.map(([x, y]) => [x * s, y * s]);
  const koerper = skala([
    [0.30, 0.72],
    [0.66, 0.22],
    [0.78, 0.31],
    [0.42, 0.81],
  ]);
  // Angespitztes Ende: dunkle Mine, dadurch ist die Form eindeutig ein Stift
  // und nicht nur ein schräger Balken.
  const spitze = skala([
    [0.30, 0.72],
    [0.42, 0.81],
    [0.21, 0.87],
  ]);

  const innen = rand * s;

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4;
      let farbe = null;

      // Abgerundetes Quadrat als Hintergrund.
      const inX = Math.min(x, s - 1 - x);
      const inY = Math.min(y, s - 1 - y);
      const eckenAbstand =
        inX < r && inY < r ? Math.hypot(r - inX, r - inY) : 0;
      if (eckenAbstand <= r) farbe = GRUND;

      if (farbe) {
        // Motiv nur innerhalb des sicheren Bereichs zeichnen.
        const drinnen =
          x > innen && x < s - innen && y > innen && y < s - innen;
        if (drinnen) {
          if (imPolygon(x, y, spitze)) farbe = AKZENT;
          else if (imPolygon(x, y, koerper)) farbe = PAPIER;
        }
      }

      if (farbe) {
        px[i] = farbe[0];
        px[i + 1] = farbe[1];
        px[i + 2] = farbe[2];
        px[i + 3] = 255;
      }
    }
  }

  return px;
}

/** Minimaler PNG-Encoder (RGBA, Filter 0). */
function alsPng(px, groesse) {
  const roh = Buffer.alloc(groesse * (groesse * 4 + 1));
  for (let y = 0; y < groesse; y++) {
    roh[y * (groesse * 4 + 1)] = 0; // Filter-Byte pro Zeile
    Buffer.from(px.buffer, y * groesse * 4, groesse * 4).copy(
      roh,
      y * (groesse * 4 + 1) + 1,
    );
  }

  const chunk = (typ, daten) => {
    const laenge = Buffer.alloc(4);
    laenge.writeUInt32BE(daten.length);
    const inhalt = Buffer.concat([Buffer.from(typ, "ascii"), daten]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(inhalt) >>> 0);
    return Buffer.concat([laenge, inhalt, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(groesse, 0);
  ihdr.writeUInt32BE(groesse, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 6; // Farbtyp RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(roh, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC_TABELLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++)
    c = CRC_TABELLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

mkdirSync("public/icons", { recursive: true });

const dateien = [
  { name: "icon-192.png", groesse: 192, opt: {} },
  { name: "icon-512.png", groesse: 512, opt: {} },
  // Maskable: mehr Rand, kein runder Hintergrund (Android maskiert selbst).
  { name: "icon-maskable-512.png", groesse: 512, opt: { rand: 0.28, hintergrundRadius: 0 } },
  // iOS zeigt das Icon ohne Transparenz und rundet selbst ab.
  { name: "apple-touch-icon.png", groesse: 180, opt: { hintergrundRadius: 0 } },
];

for (const { name, groesse, opt } of dateien) {
  const px = zeichne(groesse, opt);
  writeFileSync(`public/icons/${name}`, alsPng(px, groesse));
  console.log(`public/icons/${name} (${groesse}x${groesse})`);
}
