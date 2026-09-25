/* eslint-disable */
// @ts-nocheck
/**
 * Middleware-Ersatz für den Rauchtest — NICHT Teil der Anwendung.
 *
 * Die echte Middleware prüft die Supabase-Session und leitet ohne Anmeldung
 * auf /login um. Im Rauchtest gibt es keine Session; die Anmeldung selbst
 * wird hier nicht geprüft, sondern das, was hinter ihr liegt.
 */
import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}

export const config = { matcher: [] };
