/**
 * Ersatz für das Paket `server-only` in Tests.
 *
 * `server-only` wirft beim Import ausserhalb einer Server-Komponente — genau
 * das ist sein Zweck und in der Anwendung richtig. Im Testlauf gibt es diese
 * Unterscheidung nicht, also zeigt der Alias hierher.
 */
export {};
