import { PASSWORD_MIN_LENGTH, registerInputSchema } from "@ebook/shared";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { useAuth } from "../features/auth/auth-context";
import { AuthLayout } from "../features/auth/AuthLayout";
import { errorMessage, fieldErrorsFrom, type FieldErrors } from "../lib/form-errors";

export function SignupPage() {
  const { register } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = registerInputSchema.safeParse({
      name: form.get("name"),
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
      // RedirectIfAuthenticated takes the new user to their books
      await register(parsed.data);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        <>
          Already have one?{" "}
          <Link to="/login" className="font-medium text-violet-600 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField label="Name" name="name" autoComplete="name" error={fieldErrors.name} />
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
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters`}
          error={fieldErrors.password}
        />
        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
        <Button type="submit" loading={submitting} className="w-full justify-center">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
