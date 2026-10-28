import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(10, '密码至少需要 10 个字符')
  .max(128)
  .regex(/[a-zA-Z]/, '密码必须包含字母')
  .regex(/[0-9]/, '密码必须包含数字');

export const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_\-]+$/, '用户名只能包含字母、数字、下划线和短横线');

export const loginSchema = z.object({
  identifier: z.string().min(1, '请输入用户名或邮箱'),
  password: z.string().min(1, '请输入密码'),
  remember: z.boolean().optional().default(false),
});

export const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().email('邮箱格式不正确'),
  password: passwordSchema,
  claimToken: z.string().max(200).optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().max(40).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
