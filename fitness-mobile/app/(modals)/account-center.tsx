import { Redirect } from "expo-router";

// Preserve existing deep links while routing to the supported destination.
export default function LegacyRedirect() {
  return <Redirect href="/account" />;
}
