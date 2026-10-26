import { loginInputSchema } from "@ebook/shared";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { useAuth } from "../features/auth/auth-context";
import { AuthLayout } from "../features/auth/AuthLayout";
import { errorMessage, fieldErrorsFrom, type FieldErrors } from "../lib/form-errors";

/** Only follow same-site paths after login, never a full URL (open redirect). */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/books";
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = loginInputSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });

    setFormError(null);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    try {
      await login(parsed.data);
      navigate(safeNext(searchParams.get("next")), { replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={
        <>
          New here?{" "}
          <Link to="/signup" className="font-medium text-violet-600 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          error={fieldErrors.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          error={fieldErrors.password}
        />
        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
        <Button type="submit" loading={submitting} className="w-full justify-center">
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
