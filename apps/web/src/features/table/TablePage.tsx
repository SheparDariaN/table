import { pluginsForSlot } from "@arcane-table/plugin-sdk";
import { useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { corePlugins } from "../../plugins/registry.js";
import { EmptyState } from "../../presentation/states.js";

export const TablePage = (): ReactNode => {
  const params = useParams({ strict: false });
  const sceneId = params.sceneId ?? "unknown";
  const worldId = params.worldId ?? "unknown";
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    setMounted(sceneId !== "" && worldId !== "");
    return () => setMounted(false);
  }, [sceneId, worldId]);
  return (
    <div className="table-layout">
      <header className="table-toolbar">
        <a href={`/worlds/${worldId}`}>Back to world</a>
        <strong>
          {worldId} / {sceneId}
        </strong>
        <div>
          {pluginsForSlot(corePlugins, "table.toolbar").map((plugin) => (
            <span key={plugin.id}>{plugin.name}</span>
          ))}
        </div>
      </header>
      <aside>{pluginsForSlot(corePlugins, "table.sidebar").length} tool slots</aside>
      <section>
        {mounted ? (
          <EmptyState
            description="The scene renderer lifecycle is mounted and will tear down when you leave. No map, fog, or tokens are loaded."
            title="Empty scene"
          />
        ) : null}
      </section>
      <aside>Inspector slot</aside>
      <footer>{pluginsForSlot(corePlugins, "table.dock").length} dock slots</footer>
    </div>
  );
};
