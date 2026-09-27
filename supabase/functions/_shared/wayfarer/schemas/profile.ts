import { z } from 'zod';

import { MAX_NATIONALITIES } from '../constants/index.ts';
import { countryCodeSchema, isoDateSchema, languageSchema, unitsSchema } from './common.ts';

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, { message: 'validation.required' })
  .max(80, { message: 'validation.tooLong' });

export const emailSchema = z.email({ message: 'validation.email' });
export const passwordSchema = z.string().min(8, { message: 'validation.passwordLength' });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'validation.required' }),
});
export const signUpSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export const magicLinkSchema = z.object({ email: emailSchema });
export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, { message: 'validation.otp' }),
});

export const nationalitiesSchema = z
  .array(countryCodeSchema)
  .min(1, { message: 'validation.nationalityRequired' })
  .max(MAX_NATIONALITIES, { message: 'validation.tooManyNationalities' })
  .refine((a) => new Set(a).size === a.length, { message: 'validation.duplicate' });

/** Profile as edited in onboarding / profile screen. */
export const profileFormSchema = z.object({
  displayName: displayNameSchema,
  language: languageSchema,
  units: unitsSchema,
  homeCountry: countryCodeSchema,
  nationalities: nationalitiesSchema,
  passportExpiry: isoDateSchema.nullable(),
});
export type ProfileForm = z.infer<typeof profileFormSchema>;

/** Onboarding steps validate subsets of the profile. */
export const onboardingStepSchemas = [
  profileFormSchema.pick({ displayName: true, language: true, units: true }),
  profileFormSchema.pick({ homeCountry: true, nationalities: true }),
  profileFormSchema.pick({ passportExpiry: true }),
] as const;
