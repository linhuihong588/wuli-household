"use client";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SESSION_KEY = "wuli-cloud-session";
const REQUEST_TIMEOUT_MS = 12_000;

function withTimeout(init: RequestInit = {}) {
  return { ...init, signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
}

export type CloudUser = { id: string; email?: string; user_metadata?: { name?: string } };
export type CloudSession = { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; user?: CloudUser };
export type CloudHousehold = { id: string; name: string; invite_code: string; created_at: string; role: "owner" | "member" };
export type ReminderPreferences = { reminders_enabled: boolean; advance_minutes: number; quiet_start: string; quiet_end: string; daily_digest_time: string };

async function authRequest<T>(path: string, init: RequestInit = {}) {
  if (!url || !publishableKey) throw new Error("云端服务尚未配置");
  const response = await fetch(`${url}/auth/v1/${path}`, withTimeout({ ...init, headers: { apikey: publishableKey, "Content-Type": "application/json", ...init.headers } }));
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.msg ?? data.message ?? data.error_description ?? "请求失败，请稍后重试");
  return data as T;
}

export async function sendMagicLink(email: string, name: string) {
  await authRequest("otp", { method: "POST", body: JSON.stringify({ email, create_user: true, data: { name }, email_redirect_to: `${window.location.origin}/` }) });
}

function sessionFromHash(): CloudSession | null {
  if (!window.location.hash.includes("access_token")) return null;
  const values = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = values.get("access_token");
  const refreshToken = values.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  const expiresIn = Number(values.get("expires_in") ?? 3600);
  return { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn, expires_at: Date.now() + expiresIn * 1000 };
}

export async function restoreCloudSession(): Promise<CloudSession | null> {
  if (!url || !publishableKey) return null;
  const linked = sessionFromHash();
  if (linked) {
    window.history.replaceState({}, "", window.location.pathname + window.location.search);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(linked));
  }
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw && !linked) return null;
  let session = linked ?? JSON.parse(raw!) as CloudSession;
  if ((session.expires_at ?? 0) <= Date.now() + 60_000) {
    session = await authRequest<CloudSession>("token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: session.refresh_token }) });
    session.expires_at = Date.now() + session.expires_in * 1000;
  }
  try {
    session.user = await authRequest<CloudUser>("user", { headers: { Authorization: `Bearer ${session.access_token}` } });
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function isCloudConfigured() { return Boolean(url && publishableKey); }

export async function signOutCloud(session: CloudSession) {
  try { await authRequest("logout", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } }); }
  finally { window.localStorage.removeItem(SESSION_KEY); window.localStorage.removeItem("wuli-active-household"); }
}

async function dataRequest<T>(session: CloudSession, path: string, init: RequestInit = {}) {
  if (!url || !publishableKey) throw new Error("云端服务尚未配置");
  const response = await fetch(`${url}/rest/v1/${path}`, withTimeout({
    ...init,
    headers: { apikey: publishableKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", ...init.headers },
  }));
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message ?? data?.hint ?? "家庭数据读取失败");
  return data as T;
}

export async function listMyHouseholds(session: CloudSession): Promise<CloudHousehold[]> {
  const memberId = session.user?.id;
  if (!memberId) return [];
  const select = encodeURIComponent("role,household:households(id,name,invite_code,created_at)");
  const rows = await dataRequest<Array<{ role: "owner" | "member"; household: Omit<CloudHousehold, "role"> }>>(session, `household_members?member_id=eq.${memberId}&select=${select}`);
  return rows.map((row) => ({ ...row.household, role: row.role }));
}

export async function createCloudHousehold(session: CloudSession, name: string) {
  return dataRequest<string>(session, "rpc/create_household", { method: "POST", body: JSON.stringify({ household_name: name.trim() }) });
}

export async function joinCloudHousehold(session: CloudSession, code: string) {
  return dataRequest<string>(session, "rpc/join_household", { method: "POST", body: JSON.stringify({ code: code.trim().toUpperCase() }) });
}

type CloudChoreRow = Record<string, unknown> & { id: string; owner_id: string | null };
type CloudCompletionRow = { id: string; chore_id: string; member_id: string | null; completed_at: string };
type CloudEventRow = { id: string; chore_id: string; member_id: string | null; type: string; created_at: string; value: number | null; note: string | null };

export async function loadCloudHouseholdData(session: CloudSession, householdId: string) {
  const filter = `household_id=eq.${householdId}`;
  const [chores, completions, events] = await Promise.all([
    dataRequest<CloudChoreRow[]>(session, `chores?${filter}&select=*&order=created_at.asc`),
    dataRequest<CloudCompletionRow[]>(session, `completions?${filter}&select=*&order=completed_at.desc`),
    dataRequest<CloudEventRow[]>(session, `task_events?${filter}&select=*&order=created_at.desc`),
  ]);
  return { chores, completions, events };
}

export async function loadCloudMembers(session: CloudSession, householdId: string) {
  const select = encodeURIComponent("role,joined_at,profile:profiles(id,name,initials,color)");
  return dataRequest<Array<{ role: "owner" | "member"; joined_at: string; profile: { id: string; name: string; initials: string; color: string } }>>(session, `household_members?household_id=eq.${householdId}&select=${select}&order=joined_at.asc`);
}

export async function loadReminderPreferences(session: CloudSession): Promise<ReminderPreferences> {
  const fallback = { reminders_enabled: true, advance_minutes: 120, quiet_start: "22:00", quiet_end: "08:00", daily_digest_time: "19:00" };
  if (!session.user?.id) return fallback;
  const rows = await dataRequest<ReminderPreferences[]>(session, `user_preferences?user_id=eq.${session.user.id}&select=reminders_enabled,advance_minutes,quiet_start,quiet_end,daily_digest_time`);
  return rows[0] ? { ...rows[0], quiet_start: rows[0].quiet_start.slice(0, 5), quiet_end: rows[0].quiet_end.slice(0, 5), daily_digest_time: rows[0].daily_digest_time.slice(0, 5) } : fallback;
}

export async function saveReminderPreferences(session: CloudSession, preferences: ReminderPreferences) {
  if (!session.user?.id) throw new Error("登录状态已失效");
  await dataRequest(session, "user_preferences", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: session.user.id, ...preferences, updated_at: new Date().toISOString() }) });
}

export async function upsertCloudRows(session: CloudSession, table: "chores" | "completions" | "task_events", rows: unknown[]) {
  if (!rows.length) return;
  await dataRequest(session, table, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
}

export async function deleteCloudRow(session: CloudSession, table: "completions" | "task_events", id: string) {
  await dataRequest(session, `${table}?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}
