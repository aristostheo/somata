import React from "react";
import { useRouter } from "expo-router";
import { Button, Empty, TaskPage } from "@/components/somata/TaskUI";

export default function NotFound() {
  const router = useRouter();
  const home = () => router.replace("/(tabs)");
  return <TaskPage title="Let’s get you back." section="Somata" onBack={() => router.canGoBack() ? router.back() : home()}>
    <Empty title="This screen isn’t available" detail="The link may be old. Your account and saved records are unchanged." />
    <Button primary label="Go to Home" icon="home-outline" onPress={home} />
  </TaskPage>;
}
