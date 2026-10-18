import { TaskPage } from "@/components/somata/TaskUI";
import { SharedSummary } from "@/components/friends/SharedSummary";
import { useLocalSearchParams, useRouter } from "expo-router";
export default function FriendPage() {
  const params = useLocalSearchParams<{ id?: string; uid?: string; name?: string }>();
  const friendUid = String(params.id ?? params.uid ?? "");
  const name = String(params.name || "Friend");
  const router = useRouter();
  return <TaskPage title={`${name}’s profile`} section="Shared activity" onBack={() => router.back()}>
    <SharedSummary friendUid={friendUid} name={name} mode="profile" />
  </TaskPage>;
}
