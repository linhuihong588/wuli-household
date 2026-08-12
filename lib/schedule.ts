import type { Chore } from "./types";

export type ChoreState = "good" | "soon" | "due" | "overdue";

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function daysBetween(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

export function getDueDate(chore: Chore) {
  if (chore.postponedUntil) return new Date(chore.postponedUntil);
  if (chore.taskType === "deadline" && chore.dueAt) return new Date(chore.dueAt);
  return addDays(new Date(chore.lastCompleted), chore.intervalDays);
}

export function getChoreState(chore: Chore, now = new Date()): ChoreState {
  const remaining = daysBetween(now, getDueDate(chore));
  if (remaining < 0) return "overdue";
  if (remaining === 0) return "due";
  const window = Math.max(1, Math.min(3, Math.ceil(chore.intervalDays * 0.3)));
  return remaining <= window ? "soon" : "good";
}

export function stateLabel(chore: Chore, now = new Date()) {
  const delta = daysBetween(now, getDueDate(chore));
  if (delta < 0) return `已晚 ${Math.abs(delta)} 天`;
  if (delta === 0) return "今天建议做";
  if (delta === 1) return "明天到期";
  return `${delta} 天后`;
}

export function isThisWeek(date: Date, now = new Date()) {
  const day = now.getDay() || 7;
  const monday = startOfDay(addDays(now, 1 - day));
  const sunday = addDays(monday, 6);
  const value = startOfDay(date);
  return value >= monday && value <= sunday;
}
