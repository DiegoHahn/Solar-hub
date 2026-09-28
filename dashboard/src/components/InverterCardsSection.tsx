"use client";

import { useState } from "react";
import { InverterCard } from "@/components/InverterCard";
import type { InverterReading } from "@/lib/types";

interface InverterCardsSectionProps {
  inverters: InverterReading[];
}

export function InverterCardsSection({ inverters }: InverterCardsSectionProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {inverters.map((inv) => (
        <InverterCard
          key={inv.id}
          inverter={inv}
          detailed
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
        />
      ))}
    </div>
  );
}
