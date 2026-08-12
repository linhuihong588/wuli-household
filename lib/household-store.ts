import type { Chore, Completion, Household, HouseholdMember, HouseholdState, Member, TaskEvent } from "./types";

const STORAGE_KEY = "wuli-state";
export const DATA_VERSION = 5;

export type HouseholdSeed = {
  currentMemberId: string;
  household: Household;
  members: Member[];
  chores: Chore[];
};

function membershipsFor(household: Household, members: Member[]): HouseholdMember[] {
  return members.map((member) => ({
    householdId: household.id,
    memberId: member.id,
    role: member.role ?? "member",
    joinedAt: member.joinedAt ?? household.createdAt,
  }));
}

function normalizeChore(chore: Chore, householdId: string): Chore {
  const createdAt = chore.createdAt ?? chore.lastCompleted;
  return {
    ...chore,
    householdId: chore.householdId ?? householdId,
    createdAt,
    updatedAt: chore.updatedAt ?? createdAt,
  };
}

export function createInitialState(seed: HouseholdSeed): HouseholdState {
  return {
    version: DATA_VERSION,
    currentMemberId: seed.currentMemberId,
    household: seed.household,
    members: seed.members,
    memberships: membershipsFor(seed.household, seed.members),
    chores: seed.chores.map((chore) => normalizeChore(chore, seed.household.id)),
    completions: [],
    events: [],
  };
}

export function loadHouseholdState(seed: HouseholdSeed): HouseholdState {
  const fallback = createInitialState(seed);
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;

  try {
    const saved = JSON.parse(raw) as Partial<HouseholdState>;
    const household = saved.household ?? seed.household;
    const members = saved.members?.length ? saved.members : seed.members;
    return {
      version: DATA_VERSION,
      currentMemberId: saved.currentMemberId ?? seed.currentMemberId,
      household,
      members,
      memberships: saved.memberships?.length ? saved.memberships : membershipsFor(household, members),
      chores: (saved.chores ?? seed.chores).map((chore) => normalizeChore(chore, household.id)),
      completions: (saved.completions ?? []).map((item) => ({ ...item, householdId: item.householdId ?? household.id })),
      events: (saved.events ?? []).map((item) => ({ ...item, householdId: item.householdId ?? household.id })),
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return fallback;
  }
}

export function saveHouseholdState(state: HouseholdState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: DATA_VERSION }));
}
