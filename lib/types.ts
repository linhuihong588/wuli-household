export type Member = {
  id: string;
  name: string;
  initials: string;
  color: string;
  role?: "owner" | "member";
  joinedAt?: string;
};

export type Household = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
};

export type HouseholdMember = {
  householdId: string;
  memberId: string;
  role: "owner" | "member";
  joinedAt: string;
};

export type Chore = {
  id: string;
  householdId?: string;
  name: string;
  ownerId: string;
  intervalDays: number;
  duration: number;
  lastCompleted: string;
  preferred?: "weekend" | "evening" | "any";
  paused?: boolean;
  category?: "cleaning" | "linen" | "device" | "supply" | "pet" | "plant" | "safety" | "other";
  taskType?: "cycle" | "time" | "deadline" | "quantity" | "battery" | "usage";
  reminderTime?: string;
  dueAt?: string;
  currentValue?: number;
  targetValue?: number;
  space?: "living" | "bedroom" | "kitchen" | "bathroom" | "balcony" | "entry" | "pet" | "other";
  unit?: string;
  archived?: boolean;
  snoozedUntil?: string;
  postponedUntil?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Completion = {
  id: string;
  householdId?: string;
  choreId: string;
  memberId: string;
  completedAt: string;
};

export type TaskEvent = {
  id: string;
  householdId?: string;
  choreId: string;
  memberId: string;
  type: "completed" | "fed" | "charged" | "refilled" | "maintained" | "skipped" | "snoozed" | "postponed" | "transferred" | "archived" | "restored" | "updated";
  createdAt: string;
  value?: number;
  note?: string;
};

export type HouseholdState = {
  version: number;
  currentMemberId: string;
  household: Household;
  members: Member[];
  memberships: HouseholdMember[];
  chores: Chore[];
  completions: Completion[];
  events: TaskEvent[];
};
