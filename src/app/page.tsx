import VisualisationTabs from "@/components/VisualisationTabs";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Physics Visualisations</h1>
        <p className="mt-1 text-slate-400">Adjust the sliders to see how each quantity changes.</p>
      </header>
      <VisualisationTabs />
    </main>
  );
}
