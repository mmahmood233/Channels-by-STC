// File purpose: Loads data for a protected dashboard module and renders its page UI.
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { ChatInterface } from "@/features/chatbot/ChatInterface";

// Loads data for this dashboard page and renders the matching feature UI.
export default async function ChatbotPage() {
  await getCurrentUserProfile();

  return <ChatInterface />;
}
