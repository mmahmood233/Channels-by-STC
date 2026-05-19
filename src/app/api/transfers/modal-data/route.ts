// File purpose: Provides stores and source inventory data needed by the transfer modal.
import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

// Handles a backend API request, checks access, and returns JSON to the frontend.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const serviceClient = await createServiceRoleClient();
  const { data: allStoresRaw } = await serviceClient
    .from("stores")
    .select("id, name, is_warehouse")
    .eq("status", "active")
    .order("name");

  const allStores = allStoresRaw ?? [];
  const warehouseStoreId = allStores.find((store) => store.is_warehouse)?.id as string | undefined;
  const assignedStoreId = profile.store_id as string | null;

  const visibleStores = profile.role === "store_manager"
    ? allStores.filter((store) => store.id === assignedStoreId || store.id === warehouseStoreId)
    : allStores;

  const allowedSourceIds = profile.role === "store_manager" && warehouseStoreId
    ? [warehouseStoreId]
    : visibleStores.map((store) => store.id as string);

  const { data: sourceInventory } = allowedSourceIds.length > 0
    ? await serviceClient
        .from("current_inventory_view")
        .select("device_id, device_name, brand, sku, quantity, store_id")
        .gt("quantity", 0)
        .in("store_id", allowedSourceIds)
        .order("device_name")
    : { data: [] };

  const inventoryByStore: Record<string, Array<{
    id: string;
    name: string;
    brand: string;
    sku: string;
    quantity: number;
  }>> = {};

  for (const row of sourceInventory ?? []) {
    const storeId = row.store_id as string;
    inventoryByStore[storeId] = [
      ...(inventoryByStore[storeId] ?? []),
      {
        id: row.device_id as string,
        name: row.device_name as string,
        brand: row.brand as string,
        sku: row.sku as string,
        quantity: row.quantity as number,
      },
    ];
  }

  return NextResponse.json({
    stores: visibleStores,
    currentStoreId: assignedStoreId ?? warehouseStoreId ?? visibleStores[0]?.id ?? "",
    defaultSourceId: profile.role === "store_manager"
      ? warehouseStoreId ?? ""
      : assignedStoreId ?? warehouseStoreId ?? visibleStores[0]?.id ?? "",
    inventoryByStore,
  });
}
