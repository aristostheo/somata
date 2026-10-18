import { TaskPage } from "@/components/somata/TaskUI";
import { SharedSummary } from "@/components/friends/SharedSummary";
import { useAuth } from "@/content/AuthContext";
import { useRouter } from "expo-router";
export default function FriendPreviewPage() {
  const { user } = useAuth(); const router = useRouter();
  return <TaskPage title="Through a friend’s eyes" section="Sharing preview" onBack={() => router.back()}>
    <SharedSummary friendUid={user?.uid || ""} name="You" />
  </TaskPage>;
}
