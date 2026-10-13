"use client";

import { useState } from "react";
import { visualisations } from "@/visualisations";

export default function VisualisationTabs() {
  const [id, setId] = useState(visualisations[0].id);
  const current = visualisations.find((v) => v.id === id) ?? visualisations[0];

  return (
    <div className="flex flex-col gap-4">
      {visualisations.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label="Visualisations">
          {visualisations.map((v) => (
            <button
              key={v.id}
              onClick={() => setId(v.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                v.id === id ? "bg-sky-500 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {v.title}
            </button>
          ))}
        </nav>
      )}
      <section>
        <h2 className="text-lg font-semibold text-slate-100">{current.title}</h2>
        <p className="mt-1 text-slate-400">{current.description}</p>
      </section>
      <current.Component key={current.id} />
    </div>
  );
}
