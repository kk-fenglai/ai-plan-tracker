import type { Capability } from "@/data/types";
import { capabilityLabel } from "@/lib/pricing";

/** 能力标签只占一行：超出 max 个时折叠成「+N」，悬停可看全部。 */
export function CapPills({ caps, max = 3 }: { caps: Capability[]; max?: number }) {
  const shown = caps.slice(0, max);
  const rest = caps.slice(max);
  return (
    <span className="pills">
      {shown.map((c) => (
        <span key={c} className="pill">
          {capabilityLabel(c)}
        </span>
      ))}
      {rest.length > 0 && (
        <span className="pill more" title={rest.map(capabilityLabel).join("、")}>
          +{rest.length}
        </span>
      )}
    </span>
  );
}
