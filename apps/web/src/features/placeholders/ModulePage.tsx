import { pluginsForSlot, type PluginSlot } from "@arcane-table/plugin-sdk";
import { corePlugins } from "../../plugins/registry.js";
import { EmptyState } from "../../presentation/states.js";
import type { ReactNode } from "react";

export const ModulePage = ({
  capabilities,
  description,
  permissions,
  slot,
  title,
}: {
  readonly capabilities: readonly string[];
  readonly description: string;
  readonly permissions: string;
  readonly slot?: PluginSlot;
  readonly title: string;
}): ReactNode => {
  const registered = slot === undefined ? [] : pluginsForSlot(corePlugins, slot);
  return (
    <article className="panel">
      <header>
        <p className="eyebrow">Planned module</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <EmptyState
        description="This route is reserved. It does not load or simulate game data."
        title="Nothing is stored here yet"
      />
      <section>
        <h2>Planned capabilities</h2>
        <ul>
          {capabilities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <p>Required access: {permissions}</p>
      {slot === undefined ? null : (
        <p>
          Extension slot <code>{slot}</code>:{" "}
          {registered.length === 0
            ? "no plugins registered"
            : registered.map((plugin) => plugin.id).join(", ")}
        </p>
      )}
    </article>
  );
};
