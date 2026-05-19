// File purpose: Loads data for a protected dashboard module and renders its page UI.
import { requireWarehouseOrAdminProfile } from "@/lib/auth/current-user";
import { RestockSuggestions } from "@/features/restock/RestockSuggestions";

// Loads data for this dashboard page and renders the matching feature UI.
export default async function RestockPage() {
  await requireWarehouseOrAdminProfile();

  return <RestockSuggestions />;
}
