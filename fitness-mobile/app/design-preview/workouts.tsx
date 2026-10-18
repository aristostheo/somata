import { Redirect, useLocalSearchParams } from "expo-router";
export default function RedirectToSomata() { const params = useLocalSearchParams(); return <Redirect href={{ pathname: "/(tabs)/workouts", params } as never} />; }
