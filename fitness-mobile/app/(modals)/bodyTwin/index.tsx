import { Redirect, useLocalSearchParams } from "expo-router";
/** Retired presentation; keep existing deep links on the supported destination. */
export default function LegacyRedirect() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: "/(modals)/body-metrics", params } as never} />;
}
