/** Missing measurements break a trace. A recorded zero remains a real point. */
export function recordedTrace(values: readonly (number | null)[], x: (index: number) => number, y: (value: number) => number) {
  let connected = false;
  return values.map((value,index)=>{
    if(value==null||!Number.isFinite(value)){connected=false;return '';}
    const command=connected?'L':'M';connected=true;
    return `${command}${x(index)},${y(value)}`;
  }).filter(Boolean).join(' ');
}
