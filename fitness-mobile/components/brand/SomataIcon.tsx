import React from "react";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

interface Props {
  size?: number;
}

export function SomataIcon({ size = 64 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
          <Stop offset="100%" stopColor="#7b6fff" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="vgrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#c4b5fd" />
          <Stop offset="50%" stopColor="#7b6fff" />
          <Stop offset="100%" stopColor="#4f46e5" />
        </LinearGradient>
        <LinearGradient id="bggrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#13101e" />
          <Stop offset="100%" stopColor="#0a0812" />
        </LinearGradient>
        <ClipPath id="rounded">
          <Rect width="1024" height="1024" rx="230" />
        </ClipPath>
      </Defs>

      <Rect width="1024" height="1024" rx="230" fill="url(#bggrad)" />
      <G clipPath="url(#rounded)">
        <Circle cx="512" cy="512" r="360" fill="url(#glow)" />
        <Circle
          cx="512"
          cy="512"
          r="340"
          fill="none"
          stroke="url(#vgrad)"
          strokeWidth="18"
        />
        <Circle
          cx="512"
          cy="512"
          r="268"
          fill="none"
          stroke="rgba(167,139,250,0.18)"
          strokeWidth="6"
        />
        <Circle cx="512" cy="512" r="240" fill="rgba(123,111,255,0.06)" />
        <Line
          x1="512"
          y1="196"
          x2="512"
          y2="828"
          stroke="url(#vgrad)"
          strokeWidth="22"
          strokeLinecap="round"
        />
        <Rect
          x="390"
          y="204"
          width="244"
          height="72"
          rx="22"
          fill="rgba(196,181,253,0.16)"
          stroke="#c4b5fd"
          strokeWidth="10"
        />
        <Rect
          x="390"
          y="308"
          width="244"
          height="72"
          rx="22"
          fill="rgba(123,111,255,0.42)"
          stroke="#7b6fff"
          strokeWidth="10"
        />
        <Rect
          x="390"
          y="412"
          width="244"
          height="72"
          rx="22"
          fill="rgba(196,181,253,0.16)"
          stroke="#c4b5fd"
          strokeWidth="10"
        />
        <Rect
          x="390"
          y="516"
          width="244"
          height="72"
          rx="22"
          fill="rgba(123,111,255,0.42)"
          stroke="#7b6fff"
          strokeWidth="10"
        />
        <Rect
          x="390"
          y="620"
          width="244"
          height="72"
          rx="22"
          fill="rgba(196,181,253,0.16)"
          stroke="#c4b5fd"
          strokeWidth="10"
        />
        <Rect
          x="390"
          y="724"
          width="244"
          height="72"
          rx="22"
          fill="rgba(123,111,255,0.42)"
          stroke="#7b6fff"
          strokeWidth="10"
        />
      </G>
    </Svg>
  );
}
