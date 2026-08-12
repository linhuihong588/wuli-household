import { HouseholdApp } from "@/components/household-app";
import { AuthGate } from "@/components/auth-gate";

export default function HomePage() {
  return <AuthGate><HouseholdApp /></AuthGate>;
}
