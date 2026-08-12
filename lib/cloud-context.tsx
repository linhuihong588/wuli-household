"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CloudHousehold, CloudSession } from "./supabase-rest";

type CloudContextValue = { session: CloudSession; household: CloudHousehold } | null;
const CloudContext = createContext<CloudContextValue>(null);

export function CloudProvider({ session, household, children }: { session: CloudSession; household: CloudHousehold; children: ReactNode }) {
  return <CloudContext.Provider value={{ session, household }}>{children}</CloudContext.Provider>;
}

export function useCloud() { return useContext(CloudContext); }
