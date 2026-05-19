// File purpose: Redirects users from the root URL to the correct starting page.
import { redirect } from "next/navigation";

// Supports the application by connecting UI, data, or shared business logic.
export default function HomePage() {
  redirect("/login");
}
