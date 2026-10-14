import {
  adminHealthSchema,
  auditPageSchema,
  publicUserSchema,
  userPageSchema,
  type Role,
} from "@arcane-table/protocol";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { apiRequest } from "../../infrastructure/http.js";
import { corePlugins } from "../../plugins/registry.js";
import { ErrorState, LoadingState } from "../../presentation/states.js";
import { Badge, ConfirmDialog, Field } from "../../presentation/ui.js";
import { z } from "zod";

const pluginListSchema = z.object({
  contractVersion: z.literal("1"),
  plugins: z.array(z.unknown()),
});

export const AdminHomePage = (): ReactNode => {
  const health = useQuery({
    queryFn: async () => {
      const result = await apiRequest("/v1/admin/health", adminHealthSchema);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    queryKey: ["admin", "health"],
  });
  if (health.isPending) return <LoadingState label="Loading system summary" />;
  if (health.isError || health.data === undefined)
    return <ErrorState message="System summary is unavailable." />;
  const data = health.data;
  return (
    <article className="panel">
      <h1>Administration</h1>
      <dl className="metrics">
        <div>
          <dt>API</dt>
          <dd>
            {data.service} {data.version}
          </dd>
        </div>
        <div>
          <dt>Database</dt>
          <dd>{data.database}</dd>
        </div>
        <div>
          <dt>Users</dt>
          <dd>{data.userCount}</dd>
        </div>
        <div>
          <dt>Sessions</dt>
          <dd>{data.sessionCount}</dd>
        </div>
        <div>
          <dt>Plugins</dt>
          <dd>{data.pluginCount}</dd>
        </div>
      </dl>
    </article>
  );
};

export const UsersPage = (): ReactNode => {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const users = useQuery({
    queryFn: async () => {
      const result = await apiRequest(
        `/v1/admin/users?page=${page}&query=${encodeURIComponent(query)}`,
        userPageSchema,
      );
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    queryKey: ["admin", "users", page, query],
  });
  const createUser = useMutation({
    mutationFn: async (body: { password: string; roles: Role[]; username: string }) => {
      const result = await apiRequest("/v1/admin/users", publicUserSchema, {
        body: JSON.stringify(body),
        method: "POST",
      });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
  const updateUser = useMutation({
    mutationFn: async (input: {
      disabled?: boolean;
      id: string;
      password?: string;
      roles?: Role[];
    }) => {
      const { id, ...body } = input;
      const result = await apiRequest(`/v1/admin/users/${id}`, publicUserSchema, {
        body: JSON.stringify(body),
        method: "PATCH",
      });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiRequest(
        `/v1/admin/users/${id}/sessions/revoke`,
        z.object({ revoked: z.number() }),
        { method: "POST" },
      );
      if (!result.ok) throw new Error(result.message);
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const role = data.get("role");
    const password = data.get("password");
    const username = data.get("username");
    if (typeof role !== "string" || typeof password !== "string" || typeof username !== "string")
      return;
    if (role !== "admin" && role !== "gm" && role !== "player") return;
    createUser.mutate({ password, roles: [role], username });
    event.currentTarget.reset();
  };
  return (
    <article className="panel">
      <h1>Users</h1>
      <form className="actions" onSubmit={submit}>
        <Field label="Username">
          <input name="username" required />
        </Field>
        <Field label="Password">
          <input minLength={12} name="password" required type="password" />
        </Field>
        <Field label="Role">
          <select name="role">
            <option value="player">player</option>
            <option value="gm">gm</option>
            <option value="admin">admin</option>
          </select>
        </Field>
        <button className="button" type="submit">
          Create user
        </button>
      </form>
      <Field label="Search">
        <input
          onChange={(event) => {
            setPage(1);
            setQuery(event.target.value);
          }}
          value={query}
        />
      </Field>
      {users.isPending ? <LoadingState label="Loading users" /> : null}
      {users.isError ? <ErrorState message="Users could not be loaded." /> : null}
      {users.data === undefined ? null : (
        <>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.data.items.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>
                    {user.roles.map((role) => (
                      <Badge key={role}>{role}</Badge>
                    ))}
                  </td>
                  <td>{user.disabled ? "disabled" : "active"}</td>
                  <td className="actions">
                    <button
                      className="button ghost"
                      onClick={() => updateUser.mutate({ disabled: !user.disabled, id: user.id })}
                      type="button"
                    >
                      {user.disabled ? "Enable" : "Disable"}
                    </button>
                    <button
                      className="button ghost"
                      onClick={() => {
                        const password = window.prompt("New password, at least 12 characters");
                        if (password !== null && password.length >= 12)
                          updateUser.mutate({ id: user.id, password });
                      }}
                      type="button"
                    >
                      Reset password
                    </button>
                    <button
                      className="button danger"
                      onClick={() => setPendingUser(user.id)}
                      type="button"
                    >
                      Revoke sessions
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="actions">
            <button
              className="button ghost"
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              type="button"
            >
              Previous
            </button>
            <span>
              Page {users.data.page} of{" "}
              {Math.max(1, Math.ceil(users.data.total / users.data.pageSize))}
            </span>
            <button
              className="button ghost"
              disabled={page * users.data.pageSize >= users.data.total}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </>
      )}
      <ConfirmDialog
        confirmLabel="Revoke"
        description="Existing sessions for this user will stop working."
        onConfirm={() => {
          if (pendingUser !== null) revoke.mutate(pendingUser);
          setPendingUser(null);
        }}
        open={pendingUser !== null}
        setOpen={(open) => {
          if (!open) setPendingUser(null);
        }}
        title="Revoke sessions"
      />
    </article>
  );
};

export const AuditPage = (): ReactNode => {
  const [action, setAction] = useState("");
  const audit = useQuery({
    queryFn: async () => {
      const result = await apiRequest(
        `/v1/admin/audit?action=${encodeURIComponent(action)}`,
        auditPageSchema,
      );
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    queryKey: ["admin", "audit", action],
  });
  return (
    <article className="panel">
      <h1>Audit</h1>
      <Field label="Action filter">
        <input onChange={(event) => setAction(event.target.value)} value={action} />
      </Field>
      {audit.isPending ? <LoadingState label="Loading audit" /> : null}
      {audit.isError ? <ErrorState message="Audit log is unavailable." /> : null}
      <ul>
        {audit.data?.items.map((event) => (
          <li key={event.id}>
            {event.createdAt} · {event.actorUsername ?? "system"} · {event.action} ·{" "}
            {JSON.stringify(event.details)}
          </li>
        ))}
      </ul>
    </article>
  );
};

export const PluginsPage = (): ReactNode => (
  <article className="panel">
    <h1>Plugins</h1>
    <p>Compile-time plugins are read-only. Remote code is not loaded.</p>
    <ul>
      {corePlugins.map((plugin) => (
        <li key={plugin.id}>
          <strong>{plugin.name}</strong> {plugin.version} · {plugin.status}
          <div>{plugin.capabilities.join(", ") || "no capabilities"}</div>
          <div>Slots: {plugin.slots.join(", ") || "none"}</div>
        </li>
      ))}
    </ul>
  </article>
);

export const SystemPage = (): ReactNode => {
  const health = useQuery({
    queryFn: async () => {
      const result = await apiRequest("/v1/admin/plugins", pluginListSchema);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    queryKey: ["admin", "plugins"],
  });
  return (
    <article className="panel">
      <h1>System</h1>
      <p>Foundry converter target: v14 / dnd5e 6.0.6 / PC 2014.</p>
      <p>Browser actions cannot run migrations or backups.</p>
      {health.isPending ? <LoadingState label="Loading plugin registry" /> : null}
      {health.isError ? (
        <ErrorState message="Plugin registry is unavailable." />
      ) : (
        <p>Registered manifests: {health.data?.plugins.length ?? 0}</p>
      )}
    </article>
  );
};
