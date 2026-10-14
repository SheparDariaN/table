import { pluginsForSlot } from "@arcane-table/plugin-sdk";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sessionQuery } from "../../application/session.js";
import { corePlugins } from "../../plugins/registry.js";
import { LoadingState } from "../../presentation/states.js";

export const ProfilePage = (): ReactNode => {
  const session = useQuery(sessionQuery);
  const user = session.data?.user;
  if (user === undefined || user === null) return <LoadingState label="Loading profile" />;
  const sections = pluginsForSlot(corePlugins, "settings.sections");
  return (
    <article className="panel">
      <h1>Profile</h1>
      <p>{user.username}</p>
      <p>Roles: {user.roles.join(", ")}</p>
      <p>
        Settings slots:{" "}
        {sections.length === 0 ? "none registered" : sections.map((plugin) => plugin.id).join(", ")}
      </p>
    </article>
  );
};
