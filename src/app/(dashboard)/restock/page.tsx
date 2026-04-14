import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { RestockSuggestions } from "@/features/restock/RestockSuggestions";

export default async function RestockPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "admin" && profile?.role !== "warehouse_manager") {
    redirect("/dashboard");
  }

  return <RestockSuggestions />;
}
