import { loginRequestSchema, sessionResponseSchema } from "@arcane-table/protocol";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import type { ReactNode } from "react";
import { apiRequest, setCsrfToken } from "../../infrastructure/http.js";
import { ErrorState } from "../../presentation/states.js";
import { Field } from "../../presentation/ui.js";

export const LoginPage = (): ReactNode => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: { password: "", username: "" },
    resolver: zodResolver(loginRequestSchema),
  });
  const login = useMutation({
    mutationFn: async (values: { password: string; username: string }) => {
      const result = await apiRequest("/v1/auth/login", sessionResponseSchema, {
        body: JSON.stringify(values),
        method: "POST",
      });
      if (!result.ok) throw new Error(result.message);
      setCsrfToken(result.data.csrfToken);
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      await navigate({ to: "/" });
    },
  });
  return (
    // biome-ignore lint/correctness/useUniqueElementIds: skip-link target for this page
    <main className="auth-page" id="content">
      <form className="panel" onSubmit={form.handleSubmit((values) => login.mutate(values))}>
        <p className="eyebrow">Local account</p>
        <h1>Sign in</h1>
        <Field label="Username">
          <input autoComplete="username" {...form.register("username")} />
        </Field>
        <Field label="Password">
          <input autoComplete="current-password" type="password" {...form.register("password")} />
        </Field>
        <button className="button" disabled={login.isPending} type="submit">
          {login.isPending ? "Signing in" : "Sign in"}
        </button>
        {login.error instanceof Error ? <ErrorState message={login.error.message} /> : null}
      </form>
    </main>
  );
};

export const UnauthorizedPage = (): ReactNode => (
  // biome-ignore lint/correctness/useUniqueElementIds: skip-link target for this page
  <main className="auth-page" id="content">
    <section className="panel">
      <h1>Unauthorized</h1>
      <p>
        This page is outside your role. Return to the dashboard or sign in with another account.
      </p>
      <a href="/">Dashboard</a>
    </section>
  </main>
);
