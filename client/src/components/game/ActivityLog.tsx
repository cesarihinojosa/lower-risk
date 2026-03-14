import { useRef, useEffect } from "react";
import type { GameLogEntry } from "@shared/types";

interface ActivityLogProps {
  log: GameLogEntry[];
}

export default function ActivityLog({ log }: ActivityLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log.length]);

  if (log.length === 0) return null;

  // Show last 20 entries
  const recent = log.slice(-20);

  return (
    <div className="mt-2 border-t border-gray-700 pt-2">
      <div className="text-xs text-gray-500 mb-1 font-medium">Activity</div>
      <div className="max-h-32 overflow-y-auto text-xs space-y-0.5">
        {recent.map((entry, i) => (
          <div key={i} className="text-gray-400">
            {entry.action}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
