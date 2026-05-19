// File purpose: Provides stores, devices, and stock data needed by the sale modal.
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  if (profile.role === "warehouse_manager") {
    return NextResponse.json({ error: "Warehouse managers cannot record sales" }, { status: 403 });
  }

  let storesQuery = supabase
    .from("stores")
    .select("id, name")
    .eq("is_warehouse", false)
    .eq("status", "active")
    .order("name");

  if (profile.role === "store_manager" && profile.store_id) {
    storesQuery = storesQuery.eq("id", profile.store_id);
  }

  const [{ data: stores }, { data: devices }] = await Promise.all([
    storesQuery,
    supabase
      .from("devices")
      .select("id, name, brand, sku, unit_price")
      .eq("status", "active")
      .order("brand")
      .order("name"),
  ]);

  const storeIds = (stores ?? []).map((store) => store.id as string);
  const { data: inventory } = storeIds.length > 0
    ? await supabase
        .from("current_inventory_view")
        .select("device_id, quantity, store_id")
        .in("store_id", storeIds)
    : { data: [] };

  const stockByDeviceStore: Record<string, Record<string, number>> = {};
  for (const row of inventory ?? []) {
    const deviceId = row.device_id as string;
    const storeId = row.store_id as string;
    stockByDeviceStore[deviceId] = {
      ...(stockByDeviceStore[deviceId] ?? {}),
      [storeId]: row.quantity as number,
    };
  }

  return NextResponse.json({
    stores: stores ?? [],
    defaultStoreId: (profile.store_id as string | null) ?? storeIds[0] ?? "",
    devices: (devices ?? []).map((device) => ({
      id: device.id as string,
      name: device.name as string,
      brand: device.brand as string,
      sku: device.sku as string,
      unit_price: Number(device.unit_price),
      stockByStore: stockByDeviceStore[device.id as string] ?? {},
    })),
  });
}
