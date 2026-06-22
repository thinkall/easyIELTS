import "server-only";

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export type PollResult =
  | { status: "connected"; accessToken: string }
  | { status: "pending" }
  | { status: "slow_down" }
  | { status: "error"; error: string };

/** Begin the OAuth device flow. `scope` defaults to read:user (enough for Models). */
export async function requestDeviceCode(
  clientId: string,
  fetchImpl: typeof fetch = fetch,
  scope = "read:user",
): Promise<DeviceCode> {
  const res = await fetchImpl(DEVICE_CODE_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, scope }),
  });
  if (!res.ok) throw new Error(`Device code request failed (${res.status})`);
  const data = (await res.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval,
  };
}

/** Poll once for the access token. Caller waits `interval` seconds between calls. */
export async function pollAccessToken(
  deviceCode: string,
  clientId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PollResult> {
  const res = await fetchImpl(ACCESS_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (data.access_token) return { status: "connected", accessToken: data.access_token };
  if (data.error === "authorization_pending") return { status: "pending" };
  if (data.error === "slow_down") return { status: "slow_down" };
  return { status: "error", error: data.error ?? "unknown_error" };
}
