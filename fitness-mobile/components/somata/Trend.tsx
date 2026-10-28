import { useTaskPresentation } from "@/components/designPreview/Appearance";
import { useSomataTheme } from "@/components/somata/theme";
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { recordedTrace } from "./trendGeometry";
/** Presentation only: null points break the line; values are never fabricated. */
export function Trend({ values, labels, unit = '', second, goal, premiumProfile = false }: { values: (number | null)[]; labels?: string[]; unit?: string; second?: (number | null)[]; goal?: number; premiumProfile?: boolean; }) {
  const base = useSomataTheme();
  const appearance = useTaskPresentation();
  const { D, F } = premiumProfile ? appearance : base;

  const finite = [...values, ...(second || [])].filter((n): n is number => n != null && Number.isFinite(n));
  if (finite.length < 2) return <Text style={F.caption}>More recorded values are needed to show a trend.</Text>;
  const lo = Math.min(...finite, ...(goal != null ? [goal] : [])), hi = Math.max(...finite, ...(goal != null ? [goal] : []));
  const x = (i: number) => 12 + i / Math.max(1, values.length - 1) * 296, y = (n: number) => 110 - (n - lo) / Math.max(1, hi - lo) * 90;
  const path = (a: (number | null)[]) => recordedTrace(a, x, y);
  return <View style={{ gap: 8 }} accessibilityLabel={`Recorded trend: ${values.map(v => v == null ? 'missing' : `${v} ${unit}`).join(', ')}`}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={F.caption}>{lo.toFixed(1)} {unit}</Text>
      <Text style={F.caption}>{hi.toFixed(1)} {unit}</Text>
    </View>
    <Svg width="100%" height={124} viewBox="0 0 320 124">
      <Line x1={12} x2={308} y1={110} y2={110} stroke={D.line} />
      {goal != null && <Line x1={12} x2={308} y1={y(goal)} y2={y(goal)} stroke={D.muted} strokeDasharray="4 6" />}
      <Path d={path(values)} stroke={D.teal} strokeWidth={3} strokeLinecap="round" fill="none" />
      {second && <Path d={path(second)} stroke={premiumProfile ? appearance.t.status.info : D.lime} strokeWidth={2} fill="none" />}
      {values.map((v, i) => v != null && Number.isFinite(v) ? <Circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={D.lime} /> : null)}
    </Svg>
    {labels?.length ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={F.caption}>{labels[0]}</Text>
      <Text style={F.caption}>{labels[labels.length - 1]}</Text>
    </View> : null}
    {goal != null && <Text style={F.caption}>Current saved goal · {goal} {unit}</Text>}
  </View>;
}
