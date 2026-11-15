import "server-only";

// Client for Pomami's bridge endpoints (contract: ../pomami/docs/archive/
// restaurant-finder-bridge.md). Configured by POMAMI_BRIDGE_URL (Pomami's console
// origin, e.g. https://console.pomami.com) and POMAMI_BRIDGE_TOKEN; without both, the app
// shows the bridge as not configured and never calls Pomami. Each falls back to its
// name from before the rename (POMOVI_*), so the Vercel variables can move at any time.
const bridgeUrl = () => process.env.POMAMI_BRIDGE_URL || process.env.POMOVI_BRIDGE_URL;
const bridgeToken = () => process.env.POMAMI_BRIDGE_TOKEN || process.env.POMOVI_BRIDGE_TOKEN;

export type BridgedVenue = {
  source_ref: string;
  pomovi_venue_id: number;
  slug: string;
  status: string;
  public_url?: string | null;
  wizard_url?: string | null;
  menu_items?: number | null;
  created?: boolean;
};

export type DemoRequest = {
  source_ref: string;
  name: string;
  category: string;
  address: string;
  municipality: string;
  province: string;
  region: string;
  phone: string;
  website_url: string;
  website_status: "verified" | "candidate";
  latitude: number;
  longitude: number;
  source_snapshot: Record<string, unknown>;
};

export function pomoviConfigured(): boolean {
  return Boolean(bridgeUrl() && bridgeToken());
}

async function call(path: string, init: RequestInit = {}) {
  if (!pomoviConfigured()) throw new Error("the Pomami bridge is not configured (POMAMI_BRIDGE_URL, POMAMI_BRIDGE_TOKEN)");
  const base = String(bridgeUrl()).replace(/\/+$/, "");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${bridgeToken()}`,
      "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try { body = text ? JSON.parse(text) : {}; } catch { /* not JSON: reported below */ }
  if (!response.ok) {
    throw new Error(`Pomami answered ${response.status}${body.error ? `: ${body.error}` : ""}`);
  }
  return body;
}

/** Creates (or finds, if already bridged) the Pomami prospect for one lead. */
export async function createDemo(request: DemoRequest): Promise<BridgedVenue> {
  const body = await call("/api/bridge/venues", { method: "POST", body: JSON.stringify(request) });
  return { ...(body as unknown as BridgedVenue), source_ref: request.source_ref };
}

/** Every bridged venue with its demo state. */
export async function listBridged(): Promise<BridgedVenue[]> {
  const body = await call("/api/bridge/venues");
  return Array.isArray(body.venues) ? (body.venues as BridgedVenue[]) : [];
}

// Inbound self-signup API, a separate credential from the outbound console bridge.
export { authorizePomovi, catalogueQuery, pomoviJson, PomoviSignupError,
  searchPomoviCatalogue, signupNotification } from "@rf/pomovi-signups.mjs";
