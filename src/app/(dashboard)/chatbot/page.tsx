import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { ChatInterface } from "@/features/chatbot/ChatInterface";

export default async function ChatbotPage() {
  await getCurrentUserProfile();

  return <ChatInterface />;
}
