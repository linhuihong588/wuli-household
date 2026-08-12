"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowCounterClockwise,
  Archive,
  Bell,
  CalendarBlank,
  CalendarCheck,
  Check,
  Clock,
  House,
  Leaf,
  Pause,
  PencilSimple,
  Play,
  Plus,
  ShareNetwork,
  Trash,
  User,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import type { Chore, Completion, Household, Member, TaskEvent } from "@/lib/types";
import { DATA_VERSION, loadHouseholdState, saveHouseholdState } from "@/lib/household-store";
import { useCloud } from "@/lib/cloud-context";
import { deleteCloudRow, loadCloudHouseholdData, loadCloudMembers, loadReminderPreferences, saveReminderPreferences, signOutCloud, upsertCloudRows, type ReminderPreferences } from "@/lib/supabase-rest";
import { addDays, getChoreState, getDueDate, isThisWeek, stateLabel } from "@/lib/schedule";

const members: Member[] = [
  { id: "lin", name: "小林", initials: "林", color: "#d9e6d7", role: "owner" },
  { id: "yu", name: "阿雨", initials: "雨", color: "#e8ddd2", role: "member" },
  { id: "an", name: "安安", initials: "安", color: "#d7e0e5", role: "member" },
];

const defaultHousehold: Household = { id: "wuli-home", name: "我们家", inviteCode: "WULI-8256", createdAt: new Date().toISOString() };
const defaultReminderPreferences: ReminderPreferences = { reminders_enabled: true, advance_minutes: 120, quiet_start: "22:00", quiet_end: "08:00", daily_digest_time: "19:00" };

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function cloudChoreToLocal(row: Record<string, unknown>, currentUserId: string): Chore {
  return {
    id: String(row.id), householdId: String(row.household_id), name: String(row.name),
    ownerId: row.owner_id === currentUserId || !row.owner_id ? "lin" : String(row.owner_id),
    intervalDays: Number(row.interval_days), duration: Number(row.duration), lastCompleted: String(row.last_completed),
    preferred: (row.preferred ?? undefined) as Chore["preferred"], paused: Boolean(row.paused), archived: Boolean(row.archived),
    category: row.category as Chore["category"], taskType: row.task_type as Chore["taskType"], reminderTime: row.reminder_time ? String(row.reminder_time).slice(0, 5) : undefined,
    dueAt: row.due_at ? String(row.due_at) : undefined, currentValue: row.current_value == null ? undefined : Number(row.current_value), targetValue: row.target_value == null ? undefined : Number(row.target_value),
    space: row.space as Chore["space"], unit: row.unit ? String(row.unit) : undefined, snoozedUntil: row.snoozed_until ? String(row.snoozed_until) : undefined,
    postponedUntil: row.postponed_until ? String(row.postponed_until) : undefined, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function localChoreToCloud(chore: Chore, householdId: string, currentUserId: string) {
  return {
    id: chore.id, household_id: householdId, name: chore.name, owner_id: chore.ownerId === "lin" ? currentUserId : chore.ownerId,
    interval_days: chore.intervalDays, duration: chore.duration, last_completed: chore.lastCompleted, preferred: chore.preferred ?? null,
    paused: chore.paused ?? false, archived: chore.archived ?? false, category: chore.category ?? inferCategory(chore), task_type: chore.taskType ?? "cycle",
    reminder_time: chore.reminderTime ?? null, due_at: chore.dueAt ?? null, current_value: chore.currentValue ?? null, target_value: chore.targetValue ?? null,
    space: chore.space ?? inferSpace(chore), unit: chore.unit ?? null, snoozed_until: chore.snoozedUntil ?? null, postponed_until: chore.postponedUntil ?? null,
    created_at: chore.createdAt ?? new Date().toISOString(), updated_at: chore.updatedAt ?? new Date().toISOString(),
  };
}

const initialChores: Chore[] = [
  { id: "towels", name: "浴巾清洗", ownerId: "lin", intervalDays: 5, duration: 15, lastCompleted: isoDaysAgo(5), preferred: "evening" },
  { id: "bed", name: "床上吸灰", ownerId: "yu", intervalDays: 3, duration: 10, lastCompleted: isoDaysAgo(4), preferred: "evening" },
  { id: "bin", name: "卫生间垃圾", ownerId: "an", intervalDays: 7, duration: 5, lastCompleted: isoDaysAgo(7) },
  { id: "bathroom", name: "卫生间打扫", ownerId: "lin", intervalDays: 7, duration: 30, lastCompleted: isoDaysAgo(4), preferred: "weekend" },
  { id: "sheets", name: "更换床单", ownerId: "yu", intervalDays: 14, duration: 20, lastCompleted: isoDaysAgo(9), preferred: "weekend" },
  { id: "plants", name: "浇花", ownerId: "an", intervalDays: 14, duration: 10, lastCompleted: isoDaysAgo(5) },
];

type Tab = "today" | "status" | "plan" | "me";
type SyncState = "loading" | "syncing" | "synced" | "offline" | "error";

function isActionable(chore: Chore) {
  if (chore.snoozedUntil && new Date(chore.snoozedUntil) > new Date()) return false;
  if (chore.taskType === "time") return true;
  if (chore.taskType === "battery") return (chore.currentValue ?? 100) <= (chore.targetValue ?? 20);
  if (chore.taskType === "usage") return (chore.currentValue ?? 0) >= (chore.targetValue ?? Infinity);
  if (chore.taskType === "quantity") return (chore.currentValue ?? Infinity) <= (chore.targetValue ?? 0);
  return ["overdue", "due"].includes(getChoreState(chore));
}

export function HouseholdApp() {
  const cloud = useCloud();
  const household: Household = cloud ? { id: cloud.household.id, name: cloud.household.name, inviteCode: cloud.household.invite_code, createdAt: cloud.household.created_at } : defaultHousehold;
  const [tab, setTab] = useState<Tab>("today");
  const [chores, setChores] = useState<Chore[]>(cloud ? [] : initialChores);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [familyMembers, setFamilyMembers] = useState<Member[]>(cloud ? [] : members);
  const displayMembers = familyMembers.length ? familyMembers : members.slice(0, 1);
  const [ready, setReady] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(cloud ? "loading" : "synced");
  const [syncRetry, setSyncRetry] = useState(0);
  const cloudLoaded = useRef(false);
  const skipNextCloudWrite = useRef(false);
  const cloudWritePending = useRef(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showFamily, setShowFamily] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [reminderPreferences, setReminderPreferences] = useState(defaultReminderPreferences);
  const [selectedChoreId, setSelectedChoreId] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ chore: Chore; completionId: string; eventId: string } | null>(null);

  const refreshCloud = useCallback(async (quiet = false) => {
    if (!cloud) return;
    if (quiet && cloudWritePending.current) return;
    if (!navigator.onLine) { setSyncState("offline"); return; }
    if (!quiet) setSyncState("loading");
    try {
      const [stored, cloudMembers] = await Promise.all([loadCloudHouseholdData(cloud.session, cloud.household.id), loadCloudMembers(cloud.session, cloud.household.id)]);
      const userId = cloud.session.user!.id;
      skipNextCloudWrite.current = true;
      setFamilyMembers(cloudMembers.map((item) => ({ id: item.profile.id === userId ? "lin" : item.profile.id, name: item.profile.name, initials: item.profile.initials, color: item.profile.color, role: item.role, joinedAt: item.joined_at })));
      setChores(stored.chores.map((row) => cloudChoreToLocal(row, userId)));
      setCompletions(stored.completions.map((row) => ({ id: row.id, householdId: cloud.household.id, choreId: row.chore_id, memberId: row.member_id === userId ? "lin" : row.member_id ?? "lin", completedAt: row.completed_at })));
      setEvents(stored.events.map((row) => ({ id: row.id, householdId: cloud.household.id, choreId: row.chore_id, memberId: row.member_id === userId ? "lin" : row.member_id ?? "lin", type: row.type as TaskEvent["type"], createdAt: row.created_at, value: row.value ?? undefined, note: row.note ?? undefined })));
      cloudLoaded.current = true;
      setSyncState("synced");
    } catch { setSyncState(navigator.onLine ? "error" : "offline"); }
  }, [cloud]);

  useEffect(() => {
    cloudLoaded.current = false;
    if (cloud) {
      refreshCloud().finally(() => setReady(true));
      return;
    }
    const stored = loadHouseholdState({ currentMemberId: "lin", household: defaultHousehold, members, chores: initialChores });
    setChores(stored.chores.map((chore) => ({ ...chore, category: chore.category ?? inferCategory(chore), space: chore.space ?? inferSpace(chore) })));
    setCompletions(stored.completions);
    setEvents(stored.events);
    setReady(true);
  }, [cloud?.household.id, cloud?.session.access_token, refreshCloud]);

  useEffect(() => {
    if (ready && !cloud) saveHouseholdState({
      version: DATA_VERSION,
      currentMemberId: "lin",
      household,
      members,
      memberships: members.map((member) => ({ householdId: household.id, memberId: member.id, role: member.role ?? "member", joinedAt: member.joinedAt ?? household.createdAt })),
      chores,
      completions,
      events,
    });
  }, [chores, completions, events, ready, cloud, syncRetry]);

  useEffect(() => {
    if (!ready || !cloud || !cloudLoaded.current) return;
    if (skipNextCloudWrite.current) { skipNextCloudWrite.current = false; return; }
    if (!navigator.onLine) { setSyncState("offline"); return; }
    const userId = cloud.session.user!.id;
    const householdId = cloud.household.id;
    setSyncState("syncing");
    cloudWritePending.current = true;
    const timer = window.setTimeout(() => Promise.all([
      upsertCloudRows(cloud.session, "chores", chores.map((chore) => localChoreToCloud(chore, householdId, userId))),
      upsertCloudRows(cloud.session, "completions", completions.map((item) => ({ id: item.id, household_id: householdId, chore_id: item.choreId, member_id: item.memberId === "lin" ? userId : item.memberId, completed_at: item.completedAt }))),
      upsertCloudRows(cloud.session, "task_events", events.map((item) => ({ id: item.id, household_id: householdId, chore_id: item.choreId, member_id: item.memberId === "lin" ? userId : item.memberId, type: item.type, created_at: item.createdAt, value: item.value ?? null, note: item.note ?? null }))),
    ]).then(() => setSyncState("synced")).catch(() => setSyncState(navigator.onLine ? "error" : "offline")).finally(() => { cloudWritePending.current = false; }), 450);
    return () => { window.clearTimeout(timer); cloudWritePending.current = false; };
  }, [chores, completions, events, ready, cloud]);

  useEffect(() => {
    if (!cloud) return;
    const refresh = () => { if (document.visibilityState === "visible") void refreshCloud(true); };
    const online = () => setSyncRetry((value) => value + 1);
    const offline = () => setSyncState("offline");
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refreshCloud(true); }, 15_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, [cloud, refreshCloud]);

  useEffect(() => {
    if (cloud) loadReminderPreferences(cloud.session).then(setReminderPreferences).catch(() => undefined);
    else {
      const stored = window.localStorage.getItem("wuli-reminder-preferences");
      if (stored) try { setReminderPreferences(JSON.parse(stored)); } catch { /* use defaults */ }
    }
  }, [cloud]);

  useEffect(() => {
    if (!reminderPreferences.reminders_enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const check = () => {
      const now = new Date();
      const hhmm = now.toTimeString().slice(0, 5);
      const quiet = reminderPreferences.quiet_start > reminderPreferences.quiet_end
        ? hhmm >= reminderPreferences.quiet_start || hhmm < reminderPreferences.quiet_end
        : hhmm >= reminderPreferences.quiet_start && hhmm < reminderPreferences.quiet_end;
      if (quiet) return;
      chores.filter((chore) => !chore.paused && !chore.archived).forEach((chore) => {
        const due = getDueDate(chore).getTime();
        const remaining = due - now.getTime();
        const key = `wuli-notified-${chore.id}-${new Date(due).toISOString().slice(0, 10)}`;
        if (remaining <= reminderPreferences.advance_minutes * 60_000 && remaining > -24 * 60 * 60_000 && !window.localStorage.getItem(key)) {
          new Notification(`屋里提醒 · ${chore.name}`, { body: remaining <= 0 ? "这件事已经到时间了。" : `还有约 ${Math.max(1, Math.ceil(remaining / 3_600_000))} 小时到时间。`, icon: "/icon-192.png" });
          window.localStorage.setItem(key, "1");
        }
      });
    };
    check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [chores, reminderPreferences]);

  const active = useMemo(() => chores.filter((chore) => !chore.paused && !chore.archived), [chores]);
  const actionable = useMemo(
    () => active.filter(isActionable).sort((a, b) => getDueDate(a).getTime() - getDueDate(b).getTime()),
    [active],
  );
  const tonightMinutes = actionable.filter((chore) => ["overdue", "due"].includes(getChoreState(chore))).reduce((sum, chore) => sum + chore.duration, 0);

  function complete(chore: Chore) {
    const completedAt = new Date().toISOString();
    const completionId = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    const eventType: TaskEvent["type"] = chore.taskType === "time" ? "fed" : chore.taskType === "battery" ? "charged" : chore.taskType === "quantity" ? "refilled" : chore.taskType === "usage" ? "maintained" : "completed";
    setChores((items) => items.map((item) => item.id === chore.id ? { ...item, lastCompleted: completedAt, updatedAt: completedAt, archived: item.taskType === "deadline" ? true : item.archived, snoozedUntil: undefined, postponedUntil: undefined, currentValue: item.taskType === "battery" ? 100 : item.taskType === "usage" ? 0 : item.taskType === "quantity" ? Math.max((item.targetValue ?? 1) * 2, (item.targetValue ?? 0) + 1) : item.currentValue } : item));
    setCompletions((items) => [{ id: completionId, householdId: household.id, choreId: chore.id, memberId: "lin", completedAt }, ...items]);
    setEvents((items) => [{ id: eventId, householdId: household.id, choreId: chore.id, memberId: "lin", type: eventType, createdAt: completedAt }, ...items]);
    setUndo({ chore, completionId, eventId });
    window.setTimeout(() => setUndo((value) => value?.completionId === completionId ? null : value), 5000);
  }

  function undoComplete() {
    if (!undo) return;
    setChores((items) => items.map((item) => item.id === undo.chore.id ? undo.chore : item));
    setCompletions((items) => items.filter((item) => item.id !== undo.completionId));
    setEvents((items) => items.filter((item) => item.id !== undo.eventId));
    if (cloud) Promise.all([deleteCloudRow(cloud.session, "completions", undo.completionId), deleteCloudRow(cloud.session, "task_events", undo.eventId)]).catch(() => undefined);
    setUndo(null);
  }

  function handleTaskAction(chore: Chore, type: "snoozed" | "postponed" | "skipped" | "transferred" | "updated", value?: number) {
    const createdAt = new Date().toISOString();
    setChores((items) => items.map((item) => {
      if (item.id !== chore.id) return item;
      if (type === "snoozed") return { ...item, snoozedUntil: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() };
      if (type === "postponed") { const tomorrow = addDays(new Date(), 1); tomorrow.setHours(19, 0, 0, 0); return { ...item, postponedUntil: tomorrow.toISOString(), snoozedUntil: undefined }; }
      if (type === "skipped") return { ...item, lastCompleted: createdAt, postponedUntil: undefined, snoozedUntil: undefined };
      if (type === "transferred") { const index = displayMembers.findIndex((member) => member.id === item.ownerId); return { ...item, ownerId: displayMembers[(index + 1) % displayMembers.length].id }; }
      return { ...item, currentValue: value };
    }));
    setEvents((items) => [{ id: crypto.randomUUID(), householdId: household.id, choreId: chore.id, memberId: "lin", type, createdAt, value }, ...items]);
  }

  return (
    <main className="app-shell">
      <section className="app-frame" aria-label="屋里家庭工作台">
        <Header immersive={tab === "today"} members={displayMembers} syncState={cloud ? syncState : undefined} />
        <div className="screen" aria-live="polite">
          {tab === "today" && <Home chores={active} actionable={actionable} completions={completions} members={displayMembers} minutes={tonightMinutes} onComplete={complete} onOpen={setSelectedChoreId} onCreate={() => setShowCreate(true)} />}
          {tab === "status" && <StatusView chores={active} completions={completions} members={displayMembers} onOpen={setSelectedChoreId} />}
          {tab === "plan" && <CalendarView chores={active} members={displayMembers} onOpen={setSelectedChoreId} />}
          {tab === "me" && <MeView chores={chores} completions={completions} members={displayMembers} cloudMode={Boolean(cloud)} syncState={syncState} onFamily={() => setShowFamily(true)} onReminders={() => setShowReminders(true)} onArchive={() => setShowArchive(true)} onAccount={() => setShowAccount(true)} />}
        </div>
        <BottomNav tab={tab} onChange={setTab} />
      </section>
      {showCreate && <CreateChore members={displayMembers} onClose={() => setShowCreate(false)} onCreate={(chore) => { setChores((items) => [...items, chore]); setShowCreate(false); }} />}
      {showFamily && <FamilySpace household={household} members={displayMembers} chores={chores} completions={completions} onClose={() => setShowFamily(false)} />}
      {showReminders && <ReminderSettings preferences={reminderPreferences} onClose={() => setShowReminders(false)} onTestEmail={cloud ? async () => { const response = await fetch("/api/email/test", { method: "POST", headers: { Authorization: `Bearer ${cloud.session.access_token}` } }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "测试邮件发送失败"); } : undefined} onSave={async (preferences) => { setReminderPreferences(preferences); if (cloud) await saveReminderPreferences(cloud.session, preferences); else window.localStorage.setItem("wuli-reminder-preferences", JSON.stringify(preferences)); }} />}
      {showAccount && <AccountSettings email={cloud?.session.user?.email} cloudMode={Boolean(cloud)} onClose={() => setShowAccount(false)} onSignOut={async () => { if (!cloud) return; await signOutCloud(cloud.session); window.location.reload(); }} />}
      {showArchive && <ArchiveView chores={chores.filter((chore) => chore.archived)} members={displayMembers} onClose={() => setShowArchive(false)} onRestore={(id) => { const createdAt = new Date().toISOString(); setChores((items) => items.map((item) => item.id === id ? { ...item, archived: false, paused: false, lastCompleted: createdAt, dueAt: item.taskType === "deadline" ? addDays(new Date(), 1).toISOString() : item.dueAt } : item)); setEvents((items) => [{ id: crypto.randomUUID(), choreId: id, memberId: "lin", type: "restored", createdAt }, ...items]); }} />}
      {selectedChoreId && chores.find((chore) => chore.id === selectedChoreId) && <ChoreDetail chore={chores.find((chore) => chore.id === selectedChoreId)!} completions={completions.filter((item) => item.choreId === selectedChoreId)} members={displayMembers} onClose={() => setSelectedChoreId(null)} onComplete={(chore) => { complete(chore); setSelectedChoreId(null); }} onSave={(updated) => setChores((items) => items.map((item) => item.id === updated.id ? updated : item))} onAction={handleTaskAction} onDelete={() => { const createdAt = new Date().toISOString(); setChores((items) => items.map((item) => item.id === selectedChoreId ? { ...item, archived: true } : item)); setEvents((items) => [{ id: crypto.randomUUID(), choreId: selectedChoreId, memberId: "lin", type: "archived", createdAt }, ...items]); setSelectedChoreId(null); }} />}
      {undo && <div className="toast"><span><Check size={18} weight="bold" />已完成“{undo.chore.name}”</span><button onClick={undoComplete}>撤销</button></div>}
    </main>
  );
}

function Header({ immersive, members, syncState }: { immersive: boolean; members: Member[]; syncState?: SyncState }) {
  const label = syncState === "loading" ? "读取中" : syncState === "syncing" ? "同步中" : syncState === "offline" ? "离线" : syncState === "error" ? "同步失败" : "已同步";
  return <header className={`topbar ${immersive ? "topbar-immersive" : "topbar-solid"}`}><div className="brand-lockup"><strong>屋里</strong>{syncState && <span className={`sync-badge sync-${syncState}`}><i />{label}</span>}</div><div className="member-stack" aria-label="家庭成员">{members.map((member) => <Avatar key={member.id} member={member} />)}</div></header>;
}

function Avatar({ member, small = false }: { member: Member; small?: boolean }) {
  return <span className={small ? "avatar avatar-small" : "avatar"} style={{ background: member.color }} title={member.name}>{member.initials}</span>;
}

const categoryLabels = { all: "全部", cleaning: "清洁", linen: "寝具", device: "设备", supply: "耗材", pet: "宠物", plant: "植物", safety: "安全", other: "其他" } as const;
const spaceLabels: Record<NonNullable<Chore["space"]>, string> = { living: "客厅", bedroom: "卧室", kitchen: "厨房", bathroom: "卫生间", balcony: "阳台", entry: "玄关", pet: "宠物区", other: "其他" };
const typeLabels: Record<NonNullable<Chore["taskType"]>, string> = { cycle: "按周期", time: "固定时刻", deadline: "截止日期", quantity: "耗材余量", battery: "设备电量", usage: "使用次数" };

function inferCategory(chore: Chore): Exclude<keyof typeof categoryLabels, "all"> {
  if (chore.category) return chore.category;
  if (/浴巾|床单|被子/.test(chore.name)) return "linen";
  if (/花|植物/.test(chore.name)) return "plant";
  if (/机器人|门锁|滤芯|电池/.test(chore.name)) return "device";
  if (/宠物|猫|狗|投喂/.test(chore.name)) return "pet";
  return "cleaning";
}

function inferSpace(chore: Chore): NonNullable<Chore["space"]> {
  if (chore.space) return chore.space;
  if (/床|被子|床单|浴巾/.test(chore.name)) return "bedroom";
  if (/厨房|灶|油烟/.test(chore.name)) return "kitchen";
  if (/卫生间|马桶|浴室/.test(chore.name)) return "bathroom";
  if (/阳台|花|植物/.test(chore.name)) return "balcony";
  if (/门锁|玄关|鞋/.test(chore.name)) return "entry";
  if (/宠物|猫|狗|投喂/.test(chore.name)) return "pet";
  if (/客厅|沙发|电视/.test(chore.name)) return "living";
  return "other";
}

function lifecycleProgress(chore: Chore) {
  if (chore.taskType === "battery") return Math.max(3, Math.min(100, chore.currentValue ?? 100));
  if (chore.taskType === "usage" || chore.taskType === "quantity") {
    return Math.max(3, Math.min(100, Math.round(((chore.currentValue ?? 0) / Math.max(1, chore.targetValue ?? 1)) * 100)));
  }
  const start = new Date(chore.lastCompleted).getTime();
  const end = getDueDate(chore).getTime();
  const elapsed = Date.now() - start;
  return Math.max(4, Math.min(100, Math.round((elapsed / Math.max(1, end - start)) * 100)));
}

function taskStateLabel(chore: Chore) {
  if (chore.taskType === "time" && chore.reminderTime) return `今天 ${chore.reminderTime}`;
  if (chore.taskType === "battery") {
    const value = chore.currentValue ?? 100;
    return value <= (chore.targetValue ?? 20) ? `电量仅 ${value}%` : `电量 ${value}%`;
  }
  if (chore.taskType === "usage") return `已用 ${chore.currentValue ?? 0}/${chore.targetValue ?? 0} 次`;
  if (chore.taskType === "quantity") return `余量 ${chore.currentValue ?? 0}/${chore.targetValue ?? 0}`;
  return stateLabel(chore);
}

function taskProgressCaption(chore: Chore) {
  if (chore.taskType === "time" && chore.reminderTime) return `下次 ${chore.reminderTime}`;
  if (chore.taskType === "battery") return `低于 ${chore.targetValue ?? 20}% 提醒`;
  if (chore.taskType === "usage") return `到 ${chore.targetValue ?? 0} 次维护`;
  if (chore.taskType === "quantity") return `阈值 ${chore.targetValue ?? 0}`;
  return `下次 ${getDueDate(chore).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}`;
}

function taskPrimaryFact(chore: Chore) {
  if (chore.taskType === "time") return { label: "提醒时刻", value: chore.reminderTime ?? "19:00" };
  if (chore.taskType === "battery") return { label: "当前电量", value: `${chore.currentValue ?? 100}%` };
  if (chore.taskType === "usage") return { label: "使用次数", value: `${chore.currentValue ?? 0}/${chore.targetValue ?? 0} 次` };
  if (chore.taskType === "quantity") return { label: "当前余量", value: `${chore.currentValue ?? 0}/${chore.targetValue ?? 0}` };
  return { label: chore.taskType === "deadline" ? "截止日期" : "下次到期", value: getDueDate(chore).toLocaleDateString("zh-CN", { month: "long", day: "numeric" }) };
}

function taskActionLabel(chore: Chore) {
  if (chore.taskType === "time") return inferCategory(chore) === "pet" ? "已投喂" : "已处理";
  if (chore.taskType === "battery") return "已充满";
  if (chore.taskType === "quantity") return "已补充";
  if (chore.taskType === "usage") return "已维护";
  if (chore.taskType === "deadline") return "已办妥";
  return "完成";
}

function Home({ chores, actionable, completions, members, minutes, onComplete, onOpen, onCreate }: { chores: Chore[]; actionable: Chore[]; completions: Completion[]; members: Member[]; minutes: number; onComplete: (chore: Chore) => void; onOpen: (id: string) => void; onCreate: () => void }) {
  const [category, setCategory] = useState<keyof typeof categoryLabels>("all");
  const today = new Date();
  const days = ["一", "二", "三", "四", "五", "六", "日"];
  const current = (today.getDay() + 6) % 7;
  const [selectedDay, setSelectedDay] = useState(current);
  const monday = addDays(today, -current);
  const weekDates = days.map((_, index) => addDays(monday, index));
  const sameDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  const itemsForDay = (index: number) => index === current ? actionable : chores.filter((chore) => sameDay(getDueDate(chore), weekDates[index]));
  const selectedItems = itemsForDay(selectedDay);
  const visible = selectedItems.filter((chore) => category === "all" || inferCategory(chore) === category);
  const selectedMinutes = selectedItems.reduce((sum, chore) => sum + chore.duration, 0);
  const selectedDate = weekDates[selectedDay];
  const selectedLabel = selectedDay === current ? "今天" : selectedDay === current + 1 ? "明天" : `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`;
  const upcoming = nextChore(chores);
  return <>
    <section className="hero">
      <div className="hero-copy"><span className="hero-lead">{selectedLabel}，{selectedItems.length ? "需要处理" : "暂无安排"}</span><h1><b>{selectedItems.length}</b> 件事</h1><p>{selectedItems.length ? `预计 ${selectedDay === current ? minutes : selectedMinutes} 分钟，按当天安排逐项处理。` : upcoming ? `下一项「${upcoming.name}」将在 ${stateLabel(upcoming)}。` : "家里暂时没有待处理事项。"}</p></div>
    </section>
    <section className="rhythm" aria-label="本周任务导航">
      <div className="rhythm-line" />
      {days.map((day, index) => { const pending = itemsForDay(index); const done = completions.filter((item) => sameDay(new Date(item.completedAt), weekDates[index])).length; const hasOverdue = index === current && pending.some((chore) => getChoreState(chore) === "overdue"); const dayLabel = index === current ? "今天" : `${weekDates[index].getMonth() + 1}月${weekDates[index].getDate()}日`; return <button type="button" className={`day ${index === current ? "today" : ""} ${index === selectedDay ? "selected" : ""} ${hasOverdue ? "has-overdue" : ""}`} key={day} onClick={() => { setSelectedDay(index); setCategory("all"); }} aria-pressed={index === selectedDay} aria-label={`${dayLabel}，${pending.length} 项待处理，${done} 项已完成`}><span>{day}</span><i>{pending.length ? pending.length : done ? <Check size={13} weight="bold" /> : null}</i><small>{index === current ? "今天" : `${weekDates[index].getDate()}日`}</small></button>; })}
    </section>
    <section className="content-section">
      <div className="section-heading"><div><h2>{selectedItems.length ? `${selectedLabel}要做` : "接下来"}</h2><p>{selectedItems.length ? `${selectedItems.length} 项安排，预计 ${selectedMinutes} 分钟。` : upcoming ? `${upcoming.name} · ${stateLabel(upcoming)}` : "点击右侧加号，添加第一项家庭事项。"}</p></div><button className="icon-button" onClick={onCreate} aria-label="新建事项"><Plus size={22} /></button></div>
      {selectedItems.length > 0 && <><div className="category-strip" aria-label="任务分类">{Object.entries(categoryLabels).map(([id, label]) => <button key={id} className={category === id ? "active" : ""} onClick={() => setCategory(id as keyof typeof categoryLabels)}>{label}</button>)}</div><div className="chore-list">{visible.length ? visible.slice(0, 5).map((chore) => <ChoreRow chore={chore} members={members} key={chore.id} onComplete={onComplete} onOpen={onOpen} />) : <div className="rest-state"><Leaf size={28} /><span>这个分类暂时没有待处理事项</span></div>}</div></>}
    </section>
  </>;
}

function nextChore(chores: Chore[]) { return [...chores].sort((a, b) => getDueDate(a).getTime() - getDueDate(b).getTime())[0]; }

function ChoreRow({ chore, members, onComplete, onOpen }: { chore: Chore; members: Member[]; onComplete: (chore: Chore) => void; onOpen: (id: string) => void }) {
  const owner = members.find((item) => item.id === chore.ownerId) ?? members[0];
  const state = getChoreState(chore);
  const progress = lifecycleProgress(chore);
  const visualState = chore.taskType === "battery" && (chore.currentValue ?? 100) <= (chore.targetValue ?? 20) ? "overdue" : chore.taskType === "quantity" && (chore.currentValue ?? Infinity) <= (chore.targetValue ?? 0) ? "overdue" : chore.taskType === "usage" && (chore.currentValue ?? 0) >= (chore.targetValue ?? Infinity) ? "due" : state;
  const actionLabel = taskActionLabel(chore);
  return <article className={`chore-row chore-${visualState}`}><div className="chore-category">{categoryLabels[inferCategory(chore)]}</div><div className="chore-main"><div className="chore-title-line"><h3><button className="chore-open" onClick={() => onOpen(chore.id)}>{chore.name}</button></h3><p className={`state state-${visualState}`}>{taskStateLabel(chore)}</p></div><div className="lifecycle-track" aria-label={`任务进度 ${progress}%`}><i style={{ width: `${progress}%` }} /></div><div className="chore-meta"><span>{taskProgressCaption(chore)}</span><span>{owner.name} · {chore.duration}分钟</span></div></div><button className="complete-button" onClick={() => onComplete(chore)} aria-label={`${actionLabel}${chore.name}`}><Check size={16} weight="bold" /><span>{actionLabel}</span></button></article>;
}

function StatusView({ chores, completions, members, onOpen }: { chores: Chore[]; completions: Completion[]; members: Member[]; onOpen: (id: string) => void }) {
  const [category, setCategory] = useState<keyof typeof categoryLabels>("all");
  const categories = Object.entries(categoryLabels).filter(([id]) => id !== "all");
  const filtered = category === "all" ? chores : chores.filter((chore) => inferCategory(chore) === category);
  const allAttention = chores.filter(isActionable);
  const attentionItems = filtered.filter(isActionable).sort((a, b) => getDueDate(a).getTime() - getDueDate(b).getTime());
  const calmItems = filtered.filter((chore) => !isActionable(chore)).sort((a, b) => getDueDate(a).getTime() - getDueDate(b).getTime());
  const attention = allAttention.length;
  const soon = chores.filter((chore) => getChoreState(chore) === "soon").length;
  const weekDone = completions.filter((item) => isThisWeek(new Date(item.completedAt))).length;
  const statusRow = (chore: Chore, index: number) => <button className="status-flow-row" key={chore.id} onClick={() => onOpen(chore.id)}><span className="status-index">{String(index + 1).padStart(2, "0")}</span><span className="status-flow-main"><b>{chore.name}</b><small>{categoryLabels[inferCategory(chore)]} / {members.find((member) => member.id === chore.ownerId)?.name}</small></span><span className={`status-flow-value state-${getChoreState(chore)}`}>{taskStateLabel(chore)}</span></button>;
  return <section className="page-section status-page">
    <div className="status-title"><div><h1>屋况</h1><p className="page-intro">家里的事情，都在自己的节奏里。</p></div><span>{chores.length} 项</span></div>
    <section className="status-editorial" aria-label="家庭状态概览"><p>此刻家里</p><h2>{attention ? <><strong>{attention}</strong> 处需要留意</> : <>一切都在正常运转</>}</h2><div className="status-facts"><span><b>{soon}</b> 项即将到期</span><span><b>{weekDone}</b> 项本周完成</span><span><b>{chores.length - attention}</b> 项状态安稳</span></div></section>
    <nav className="status-categories" aria-label="屋况分类"><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}><span>全部</span><b>{chores.length}</b></button>{categories.map(([id, label]) => { const items = chores.filter((chore) => inferCategory(chore) === id); const alerts = items.filter(isActionable).length; if (!items.length) return null; return <button className={category === id ? "active" : ""} key={id} onClick={() => setCategory(id as keyof typeof categoryLabels)}><span>{label}</span><b>{items.length}</b>{alerts > 0 && <i>{alerts} 需留意</i>}</button>; })}</nav>
    {attentionItems.length > 0 && <section className="status-flow"><header><h2>需要留意</h2><span>按紧急程度</span></header>{attentionItems.map(statusRow)}</section>}
    <section className="status-flow calm-flow"><header><h2>状态安稳</h2><span>{category === "all" ? "未来会再提醒" : categoryLabels[category]}</span></header>{calmItems.length ? calmItems.map(statusRow) : <p className="status-empty">这个分类暂时没有处于安稳状态的事项。</p>}</section>
  </section>;
}

function CalendarView({ chores, members, onOpen }: { chores: Chore[]; members: Member[]; onOpen: (id: string) => void }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const dates = Array.from({ length: 14 }, (_, index) => addDays(new Date(), index));
  const overdue = chores.filter((chore) => getChoreState(chore) === "overdue");
  const today = chores.filter((chore) => getChoreState(chore) === "due" || chore.taskType === "time");
  const future = chores.filter((chore) => !overdue.includes(chore) && !today.includes(chore)).sort((a, b) => getDueDate(a).getTime() - getDueDate(b).getTime());
  const selectedDate = selectedIndex === null ? null : dates[selectedIndex];
  const selectedItems = selectedDate ? chores.filter((chore) => { const due = getDueDate(chore); return due.getFullYear() === selectedDate.getFullYear() && due.getMonth() === selectedDate.getMonth() && due.getDate() === selectedDate.getDate(); }).sort((a, b) => getDueDate(a).getTime() - getDueDate(b).getTime()) : [];
  const renderItems = (items: Chore[]) => items.map((chore) => <article key={chore.id}><time>{chore.taskType === "time" ? chore.reminderTime : getDueDate(chore).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}</time><div><h3><button className="timeline-open" onClick={() => onOpen(chore.id)}>{chore.name}</button></h3><p>{members.find((m) => m.id === chore.ownerId)?.name} · {chore.duration} 分钟</p></div></article>);
  return <section className="page-section plan-page"><h1>计划</h1><p className="page-intro">点选日期查看当天，再点一次返回全部计划。</p><div className="date-strip">{dates.slice(0, 7).map((date, index) => <button type="button" className={selectedIndex === index ? "date-cell active" : "date-cell"} onClick={() => setSelectedIndex((value) => value === index ? null : index)} aria-pressed={selectedIndex === index} key={date.toISOString()}><span>{["日", "一", "二", "三", "四", "五", "六"][date.getDay()]}</span><b>{date.getDate()}</b></button>)}</div>
    {selectedDate ? <><div className="plan-heading"><h2>{selectedIndex === 0 ? "今天" : selectedDate.toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}</h2><span>{selectedItems.length} 项</span></div><div className="timeline">{selectedItems.length ? renderItems(selectedItems) : <p className="plan-empty">这一天暂时没有安排。</p>}</div></> : <>{overdue.length > 0 && <><div className="plan-heading overdue-heading"><h2>需要补做</h2><span>{overdue.length} 项</span></div><div className="timeline overdue-timeline">{renderItems(overdue)}</div></>}{today.length > 0 && <><div className="plan-heading"><h2>今天</h2><span>{today.length} 项</span></div><div className="timeline">{renderItems(today)}</div></>}<div className="plan-heading"><h2>接下来</h2><span>{future.length} 项</span></div><div className="timeline">{future.length ? renderItems(future) : <p className="plan-empty">未来暂时没有安排。</p>}</div></>}
  </section>;
}

function ProgressView({ chores, completions }: { chores: Chore[]; completions: Completion[] }) {
  const weekChores = chores.filter((chore) => isThisWeek(getDueDate(chore)) || getChoreState(chore) === "overdue");
  const weekCompleted = completions.filter((item) => isThisWeek(new Date(item.completedAt)));
  const remaining = weekChores.reduce((sum, chore) => sum + chore.duration, 0);
  return <section className="page-section"><h1>这一周</h1><p className="page-intro">不是比赛，只是让分工更清楚。</p><div className="progress-hero"><div><strong>{weekCompleted.length}</strong><span>项已完成</span></div><div><strong>{remaining}</strong><span>分钟待处理</span></div></div><h2>家庭分工</h2><div className="workload">{members.map((member) => { const owned = chores.filter((chore) => chore.ownerId === member.id && ["overdue", "due", "soon"].includes(getChoreState(chore))); const mins = owned.reduce((sum, chore) => sum + chore.duration, 0); return <article key={member.id}><Avatar member={member} /><div><h3>{member.name}</h3><p>{owned.length} 项 · 预计 {mins} 分钟</p></div><span>{mins ? "有安排" : "很轻松"}</span></article>; })}</div></section>;
}

function MeView({ chores, completions, members, cloudMode, syncState, onFamily, onReminders, onArchive, onAccount }: { chores: Chore[]; completions: Completion[]; members: Member[]; cloudMode: boolean; syncState: SyncState; onFamily: () => void; onReminders: () => void; onArchive: () => void; onAccount: () => void }) {
  const mine = chores.filter((chore) => chore.ownerId === "lin");
  const done = completions.filter((item) => item.memberId === "lin").length;
  const archived = chores.filter((chore) => chore.archived).length;
  const syncLabel = syncState === "syncing" ? "正在同步" : syncState === "offline" ? "离线，联网后重试" : syncState === "error" ? "同步失败，请稍后重试" : "云端已同步";
  return <section className="page-section"><div className="profile"><Avatar member={members[0]} /><div><h1>{members[0].name}</h1><p>这个家一起住，也一起照料。</p></div></div><div className="profile-stats"><div><b>{mine.filter((chore) => !chore.archived).length}</b><span>我的事项</span></div><div><b>{done}</b><span>完成记录</span></div></div><div className="settings-list"><button onClick={onFamily}><UsersThree size={22} /><span>家庭空间</span><small>{members.length} 人</small></button><button onClick={onReminders}><Clock size={22} /><span>提醒与勿扰</span><small>非工作时间</small></button><button><CalendarCheck size={22} /><span>任务模板</span><small>常用家庭事项</small></button><button onClick={onArchive}><Archive size={22} /><span>已归档事项</span><small>{archived ? `${archived} 项` : "暂无"}</small></button><button onClick={onAccount}><User size={22} /><span>账号与同步</span><small>{cloudMode ? syncLabel : "当前为本地模式"}</small></button></div><p className="settings-note">全部家庭事项已移到“屋况”，未来安排已移到“计划”。</p></section>;
}

function AccountSettings({ email, cloudMode, onClose, onSignOut }: { email?: string; cloudMode: boolean; onClose: () => void; onSignOut: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="sheet account-sheet" role="dialog" aria-modal="true" aria-label="账号与同步"><header><div><h2>账号与同步</h2><p>管理当前设备上的登录状态。</p></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={22} /></button></header><div className="account-summary"><User size={23} /><div><strong>{cloudMode ? "云端账号" : "本地体验模式"}</strong><span>{email ?? "数据仅保存在当前设备"}</span></div></div>{cloudMode ? <button className="danger-button account-signout" disabled={busy} onClick={async () => { setBusy(true); try { await onSignOut(); } finally { setBusy(false); } }}>{busy ? "正在退出…" : "退出当前账号"}</button> : <p className="reminder-footnote">退出本地体验并刷新页面后，即可登录云端账号。</p>}</section></div>;
}

function ReminderSettings({ preferences, onClose, onSave, onTestEmail }: { preferences: ReminderPreferences; onClose: () => void; onSave: (preferences: ReminderPreferences) => Promise<void>; onTestEmail?: () => Promise<void> }) {
  const [draft, setDraft] = useState(preferences);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") new Notification("屋里提醒已开启", { body: "到了时间，屋里会轻轻提醒你。" });
  }
  async function submit() {
    setBusy(true); setMessage("");
    try { await onSave(draft); setMessage("设置已保存"); window.setTimeout(onClose, 650); }
    catch { setMessage("保存失败，请检查网络后重试"); }
    finally { setBusy(false); }
  }
  async function testEmail() {
    if (!onTestEmail) return;
    setBusy(true); setMessage("正在发送测试邮件…");
    try { await onTestEmail(); setMessage("测试邮件已发送，请查看收件箱"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "测试邮件发送失败"); }
    finally { setBusy(false); }
  }
  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="sheet reminder-sheet" role="dialog" aria-modal="true" aria-label="提醒与勿扰">
    <header><div><h2>提醒与勿扰</h2><p>该提醒谁，就只通知对应负责人。</p></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={22} /></button></header>
    <div className={`notification-access access-${permission}`}><Bell size={23} weight="fill" /><div><strong>{permission === "granted" ? "当前设备通知已开启" : permission === "denied" ? "通知权限已被关闭" : permission === "unsupported" ? "当前浏览器不支持通知" : "先允许屋里发送通知"}</strong><span>{permission === "granted" ? "页面打开时，到期事项会按设置提醒。" : "需要授权后才能在这台设备上收到提醒。"}</span></div>{permission === "default" && <button onClick={enableNotifications}>开启</button>}</div>
    <label className="toggle-row"><span><b>任务提醒</b><small>到期和即将到期时通知我</small></span><input type="checkbox" checked={draft.reminders_enabled} onChange={(event) => setDraft({ ...draft, reminders_enabled: event.target.checked })} /></label>
    <div className="reminder-form">
      <label>提前提醒<select value={draft.advance_minutes} onChange={(event) => setDraft({ ...draft, advance_minutes: Number(event.target.value) })}><option value={0}>到期时</option><option value={60}>提前 1 小时</option><option value={120}>提前 2 小时</option><option value={360}>提前 6 小时</option><option value={1440}>提前 1 天</option><option value={2880}>提前 2 天</option></select></label>
      <div className="form-grid"><label>勿扰开始<input type="time" value={draft.quiet_start} onChange={(event) => setDraft({ ...draft, quiet_start: event.target.value })} /></label><label>勿扰结束<input type="time" value={draft.quiet_end} onChange={(event) => setDraft({ ...draft, quiet_end: event.target.value })} /></label></div>
      <label>每日家庭摘要<input type="time" value={draft.daily_digest_time} onChange={(event) => setDraft({ ...draft, daily_digest_time: event.target.value })} /></label>
    </div>
    {message && <p className="reminder-message" role="status">{message}</p>}<button className="primary-button" disabled={busy} onClick={submit}>{busy ? "正在处理…" : "保存提醒设置"}</button>{onTestEmail && <button className="secondary-button reminder-test" disabled={busy} onClick={testEmail}>发送一封测试邮件</button>}
    <p className="reminder-footnote">当前网页版需保持页面打开才能准时触发；发布为小程序后会接入微信订阅消息，实现后台提醒。</p>
  </section></div>;
}

function ArchiveView({ chores, members, onClose, onRestore }: { chores: Chore[]; members: Member[]; onClose: () => void; onRestore: (id: string) => void }) {
  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="sheet archive-sheet" role="dialog" aria-modal="true" aria-label="已归档事项">
    <header><div><h2>已归档事项</h2><p>不再提醒，但完成记录仍然保留。</p></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={22} /></button></header>
    {chores.length ? <div className="archive-list">{chores.map((chore) => <article key={chore.id}><div><span>{categoryLabels[inferCategory(chore)]}</span><strong>{chore.name}</strong><small>{typeLabels[chore.taskType ?? "cycle"]} · {members.find((member) => member.id === chore.ownerId)?.name ?? "未分配"}</small></div><button onClick={() => onRestore(chore.id)}><ArrowCounterClockwise size={16} />恢复</button></article>)}</div> : <div className="archive-empty"><Archive size={32} /><strong>归档里很安静</strong><p>暂时没有被归档的家庭事项。</p></div>}
  </section></div>;
}

function FamilySpace({ household, members, chores, completions, onClose }: { household: Household; members: Member[]; chores: Chore[]; completions: Completion[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const recent = completions.slice(0, 4);
  async function copyInvite() {
    await navigator.clipboard.writeText(household.inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  async function shareInvite() {
    const text = `来加入“${household.name}”，在屋里一起照料家庭。邀请码：${household.inviteCode}`;
    if (navigator.share) { await navigator.share({ title: `加入${household.name}`, text }); return; }
    await copyInvite();
  }
  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="sheet family-sheet" role="dialog" aria-modal="true" aria-label="家庭空间">
    <header><div><h2>{household.name}</h2><p>成员共享同一份家庭事项和完成记录。</p></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={22} /></button></header>
    <div className="invite-card"><div><span>家庭邀请码</span><strong>{household.inviteCode}</strong><small>家人登录后选择“用邀请码加入”</small></div><div className="invite-actions"><button type="button" onClick={copyInvite}>{copied ? "已复制" : "复制"}</button><button type="button" onClick={shareInvite}><ShareNetwork size={15} />分享</button></div></div>
    <div className="family-heading"><h3>家庭成员</h3><span>{members.length} 人</span></div>
    <div className="family-members">{members.map((member) => { const assigned = chores.filter((chore) => chore.ownerId === member.id && !chore.paused).length; return <article key={member.id}><Avatar member={member} /><div><strong>{member.name}{member.id === "lin" ? "（我）" : ""}</strong><span>{assigned} 项负责事项</span></div><small>{member.role === "owner" ? "管理员" : "成员"}</small></article>; })}</div>
    <div className="family-heading"><h3>最近动态</h3><span>全家可见</span></div>
    <div className="family-activity">{recent.length ? recent.map((item) => <p key={item.id}><Check size={15} weight="bold" /><span><b>{members.find((member) => member.id === item.memberId)?.name ?? "家人"}</b> 完成了 {chores.find((chore) => chore.id === item.choreId)?.name ?? "一项任务"}</span><time>{new Date(item.completedAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</time></p>) : <div className="activity-empty">完成一项任务后，家庭动态会出现在这里。</div>}</div>
  </section></div>;
}

function ChoreDetail({ chore, completions, members, onClose, onComplete, onSave, onAction, onDelete }: { chore: Chore; completions: Completion[]; members: Member[]; onClose: () => void; onComplete: (chore: Chore) => void; onSave: (chore: Chore) => void; onAction: (chore: Chore, type: "snoozed" | "postponed" | "skipped" | "transferred" | "updated", value?: number) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(chore.name);
  const [ownerId, setOwnerId] = useState(chore.ownerId);
  const [intervalDays, setIntervalDays] = useState(chore.intervalDays);
  const [duration, setDuration] = useState(chore.duration);
  const [category, setCategory] = useState<NonNullable<Chore["category"]>>(chore.category ?? inferCategory(chore));
  const [space, setSpace] = useState<NonNullable<Chore["space"]>>(chore.space ?? inferSpace(chore));
  const [taskType, setTaskType] = useState<NonNullable<Chore["taskType"]>>(chore.taskType ?? "cycle");
  const [reminderTime, setReminderTime] = useState(chore.reminderTime ?? "19:00");
  const [dueAt, setDueAt] = useState((chore.dueAt ?? addDays(new Date(), 7).toISOString()).slice(0, 10));
  const [currentValue, setCurrentValue] = useState(chore.currentValue ?? (chore.taskType === "battery" ? 100 : 0));
  const [targetValue, setTargetValue] = useState(chore.targetValue ?? 20);
  const [unit, setUnit] = useState(chore.unit ?? "个");
  const owner = members.find((member) => member.id === chore.ownerId)!;
  const primaryFact = taskPrimaryFact(chore);

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onSave({ ...chore, name: name.trim(), ownerId, intervalDays, duration, category, space, taskType, reminderTime: taskType === "time" ? reminderTime : undefined, dueAt: taskType === "deadline" ? new Date(`${dueAt}T19:00:00`).toISOString() : undefined, currentValue: ["quantity", "battery", "usage"].includes(taskType) ? currentValue : undefined, targetValue: ["quantity", "battery", "usage"].includes(taskType) ? targetValue : undefined, unit: taskType === "quantity" ? unit.trim() || "个" : undefined });
    setEditing(false);
  }

  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="sheet detail-sheet" role="dialog" aria-modal="true" aria-label={`${chore.name}详情`}>
    <header className="detail-header"><button className="icon-button" onClick={onClose} aria-label="返回"><ArrowLeft size={22} /></button><span>家庭事项详情</span><button className="icon-button" onClick={() => setEditing((value) => !value)} aria-label={editing ? "取消编辑" : "编辑事项"}>{editing ? <X size={21} /> : <PencilSimple size={21} />}</button></header>
    {editing ? <form className="detail-form" onSubmit={save}><label>事项名称<input value={name} onChange={(event) => setName(event.target.value)} /></label><div className="form-grid"><label>分类<select value={category} onChange={(event) => setCategory(event.target.value as NonNullable<Chore["category"]>)}>{Object.entries(categoryLabels).filter(([id]) => id !== "all").map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><label>所在空间<select value={space} onChange={(event) => setSpace(event.target.value as NonNullable<Chore["space"]>)}>{Object.entries(spaceLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label></div><div className="form-grid"><label>任务类型<select value={taskType} onChange={(event) => { const next = event.target.value as NonNullable<Chore["taskType"]>; setTaskType(next); if (next === "battery" && chore.taskType !== "battery") setCurrentValue(100); }}>{Object.entries(typeLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><label>默认负责人<select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>{members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label></div>{taskType === "time" ? <div className="form-grid"><label>提醒时刻<input type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} /></label><label>重复间隔（天）<input type="number" min="1" max="365" value={intervalDays} onChange={(event) => setIntervalDays(Number(event.target.value))} /></label></div> : taskType === "deadline" ? <label>截止日期<input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label> : ["quantity", "battery", "usage"].includes(taskType) ? <><div className="form-grid"><label>{taskType === "battery" ? "当前电量（%）" : taskType === "usage" ? "当前次数" : "当前余量"}<input type="number" min="0" max={taskType === "battery" ? 100 : undefined} value={currentValue} onChange={(event) => setCurrentValue(Number(event.target.value))} /></label><label>{taskType === "battery" ? "提醒阈值（%）" : taskType === "usage" ? "维护阈值（次）" : "补充阈值"}<input type="number" min="1" max={taskType === "battery" ? 100 : undefined} value={targetValue} onChange={(event) => setTargetValue(Number(event.target.value))} /></label></div>{taskType === "quantity" && <label>计量单位<input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="例如：个、袋、升" /></label>}</> : <label>重复间隔（天）<input type="number" min="1" max="365" value={intervalDays} onChange={(event) => setIntervalDays(Number(event.target.value))} /></label>}<label>预计处理时间（分钟）<input type="number" min="1" max="480" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label><button className="primary-button" disabled={!name.trim()}>保存修改</button></form> : <>
      <div className="detail-title"><Avatar member={owner} /><div><h2>{chore.name}</h2><p className={`state state-${getChoreState(chore)}`}>{chore.paused ? "已暂停提醒" : stateLabel(chore)}</p></div></div>
      <div className="detail-facts"><div><CalendarCheck size={22} /><span>{primaryFact.label}<b>{primaryFact.value}</b></span></div><div><Clock size={22} /><span>预计用时<b>{chore.duration} 分钟</b></span></div><div><User size={22} /><span>默认负责人<b>{owner.name}</b></span></div></div>
      {["battery", "quantity", "usage"].includes(chore.taskType ?? "") && <div className="quick-update"><span>快速更新<strong>{chore.currentValue ?? 0}{chore.taskType === "battery" ? "%" : chore.unit ? ` ${chore.unit}` : ""}</strong></span><div><button onClick={() => onAction(chore, "updated", Math.max(0, (chore.currentValue ?? 0) - (chore.taskType === "battery" ? 10 : 1)))}>减少</button><button onClick={() => onAction(chore, "updated", Math.min(chore.taskType === "battery" ? 100 : 9999, (chore.currentValue ?? 0) + (chore.taskType === "battery" ? 10 : 1)))}>增加</button></div></div>}
      <button className="detail-complete-button" onClick={() => onComplete(chore)}><Check size={20} weight="bold" /><span>{taskActionLabel(chore)}这项任务</span></button>
      <div className="task-actions"><button onClick={() => { onAction(chore, "snoozed"); onClose(); }}><span>稍后提醒</span><small>2小时后</small></button><button onClick={() => { onAction(chore, "postponed"); onClose(); }}><span>延后</span><small>明天19:00</small></button><button onClick={() => { onAction(chore, "skipped"); onClose(); }}><span>跳过本次</span><small>进入下周期</small></button><button onClick={() => onAction(chore, "transferred")}><span>转交家人</span><small>给 {members[(members.findIndex((member) => member.id === chore.ownerId) + 1) % members.length].name}</small></button></div>
      <button className="pause-button secondary-action" onClick={() => onSave({ ...chore, paused: !chore.paused })}>{chore.paused ? <Play size={20} weight="fill" /> : <Pause size={20} weight="fill" />}<span>{chore.paused ? "恢复这项任务" : "暂停这项任务"}</span></button>
      <div className="history-heading"><h3>最近完成</h3><span>{completions.length} 次记录</span></div>
      <div className="history-list">{completions.length ? completions.slice(0, 6).map((completion) => <div key={completion.id}><Check size={16} weight="bold" /><span>{members.find((member) => member.id === completion.memberId)?.name ?? "家人"}</span><time>{new Date(completion.completedAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div>) : <p>完成一次后，记录会出现在这里。</p>}</div>
      {confirmDelete ? <div className="delete-confirm"><p>归档后不再生成提醒，但历史记录和家庭统计会保留。</p><div><button onClick={() => setConfirmDelete(false)}>取消</button><button onClick={onDelete}>确认归档</button></div></div> : <button className="delete-button" onClick={() => setConfirmDelete(true)}><Trash size={19} />归档这项任务</button>}
    </>}
  </section></div>;
}

function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const items = [{ id: "today" as const, label: "今天", icon: Check }, { id: "status" as const, label: "屋况", icon: House }, { id: "plan" as const, label: "计划", icon: CalendarBlank }, { id: "me" as const, label: "我的", icon: User }];
  return <nav className="bottom-nav">{items.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "active" : ""} onClick={() => onChange(id)}><Icon size={24} weight={tab === id ? "fill" : "regular"} /><span>{label}</span></button>)}</nav>;
}

function CreateChore({ members, onClose, onCreate }: { members: Member[]; onClose: () => void; onCreate: (chore: Chore) => void }) {
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState(members[0].id);
  const [category, setCategory] = useState<NonNullable<Chore["category"]>>("cleaning");
  const [space, setSpace] = useState<NonNullable<Chore["space"]>>("other");
  const [taskType, setTaskType] = useState<NonNullable<Chore["taskType"]>>("cycle");
  const [interval, setInterval] = useState(7);
  const [duration, setDuration] = useState(15);
  const [reminderTime, setReminderTime] = useState("19:00");
  const [dueAt, setDueAt] = useState(addDays(new Date(), 7).toISOString().slice(0, 10));
  const [currentValue, setCurrentValue] = useState(0);
  const [targetValue, setTargetValue] = useState(20);
  const [unit, setUnit] = useState("个");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onCreate({ id: crypto.randomUUID(), name: name.trim(), ownerId, category, space, taskType, intervalDays: interval, duration, lastCompleted: new Date().toISOString(), preferred: "any", reminderTime: taskType === "time" ? reminderTime : undefined, dueAt: taskType === "deadline" ? new Date(`${dueAt}T19:00:00`).toISOString() : undefined, currentValue: ["quantity", "battery", "usage"].includes(taskType) ? currentValue : undefined, targetValue: ["quantity", "battery", "usage"].includes(taskType) ? targetValue : undefined, unit: taskType === "quantity" ? unit.trim() || "个" : undefined });
  }

  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="sheet create-sheet" role="dialog" aria-modal="true" aria-label="添加家庭事项" onSubmit={submit}><header><div><h2>添加家庭事项</h2><p>清洁、设备、耗材和照护，都可以放在一起管理。</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={22} /></button></header>
    <label>事项名称<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：门锁充电" /></label>
    <div className="form-grid"><label>分类<select value={category} onChange={(e) => setCategory(e.target.value as NonNullable<Chore["category"]>)}>{Object.entries(categoryLabels).filter(([id]) => id !== "all").map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><label>所在空间<select value={space} onChange={(e) => setSpace(e.target.value as NonNullable<Chore["space"]>)}>{Object.entries(spaceLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label></div><label>任务类型<select value={taskType} onChange={(e) => { const next = e.target.value as NonNullable<Chore["taskType"]>; setTaskType(next); setCurrentValue(next === "battery" ? 100 : 0); setTargetValue(next === "usage" ? 30 : 20); }}>{Object.entries(typeLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
    <label>默认负责人<select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>{members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label>
    {taskType === "time" ? <div className="form-grid"><label>提醒时刻<input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} /></label><label>重复间隔（天）<input type="number" min="1" max="365" value={interval} onChange={(e) => setInterval(Number(e.target.value))} /></label></div> : taskType === "deadline" ? <label>截止日期<input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></label> : ["quantity", "battery", "usage"].includes(taskType) ? <><div className="form-grid"><label>{taskType === "battery" ? "当前电量（%）" : taskType === "usage" ? "当前次数" : "当前余量"}<input type="number" min="0" max={taskType === "battery" ? 100 : undefined} value={currentValue} onChange={(e) => setCurrentValue(Number(e.target.value))} /></label><label>{taskType === "battery" ? "提醒阈值（%）" : taskType === "usage" ? "维护阈值（次）" : "补充阈值"}<input type="number" min="1" max={taskType === "battery" ? 100 : undefined} value={targetValue} onChange={(e) => setTargetValue(Number(e.target.value))} /></label></div>{taskType === "quantity" && <label>计量单位<input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="例如：个、袋、升" /></label>}</> : <label>重复间隔（天）<input type="number" min="1" max="365" value={interval} onChange={(e) => setInterval(Number(e.target.value))} /></label>}
    <label>预计处理时间（分钟）<input type="number" min="1" max="480" value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label>
    <div className="next-preview"><CalendarBlank size={20} /><span>{taskType === "time" ? `${interval === 1 ? "每天" : `每 ${interval} 天`} ${reminderTime} 提醒` : taskType === "deadline" ? `${new Date(`${dueAt}T12:00:00`).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })} 前完成` : taskType === "battery" ? `电量低于 ${targetValue}% 时提醒` : taskType === "quantity" ? `余量不高于 ${targetValue}${unit ? ` ${unit}` : ""} 时提醒` : taskType === "usage" ? `累计 ${targetValue} 次后提醒维护` : `预计 ${addDays(new Date(), interval).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })} 再次处理`}</span></div>
    <button className="primary-button" disabled={!name.trim()}>保存家庭事项</button>
  </form></div>;
}
