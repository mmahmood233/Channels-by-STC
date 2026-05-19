import { requireWarehouseOrAdminProfile } from "@/lib/auth/current-user";
import { RestockSuggestions } from "@/features/restock/RestockSuggestions";

export default async function RestockPage() {
  await requireWarehouseOrAdminProfile();

  return <RestockSuggestions />;
}
