import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

const email = z.email("Enter a valid email address").trim().toLowerCase().max(254);

export const registerInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email,
  // bcrypt only uses the first 72 bytes, so longer passwords give a false sense of security
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(72, "Password must be at most 72 characters"),
});

export const loginInputSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(72),
});

export const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  createdAt: z.iso.datetime(),
});

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: userSchema,
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type User = z.infer<typeof userSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
