import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { TaskPage } from "@/components/somata/TaskUI";
import { SharedSummary } from "@/components/friends/SharedSummary";
import { useLocalSearchParams, useRouter } from "expo-router";
function FriendPage() {
  const params = useLocalSearchParams<{ id?: string; uid?: string; name?: string }>();
  const friendUid = String(params.id ?? params.uid ?? "");
  const name = String(params.name || "Friend");
  const router = useRouter();
  return <TaskPage title={`${name}’s progress`} section="Shared activity" onBack={() => router.back()}>
    <SharedSummary friendUid={friendUid} name={name} mode="progress" />
  </TaskPage>;
}

export default function PremiumFriendPage() {
  return <SomataTaskAppearance><FriendPage /></SomataTaskAppearance>;
}
