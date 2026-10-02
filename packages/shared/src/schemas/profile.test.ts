import { describe, expect, it } from 'vitest';

import { nicknameSchema, profileFormSchema, signInSchema, signUpSchema } from './profile.ts';

describe('nickname (D-048)', () => {
  it('is stored trimmed and lowercase', () => {
    expect(nicknameSchema.parse('  Nina_Walks ')).toBe('nina_walks');
  });

  it('takes 3 to 20 letters, digits or underscores, nothing else', () => {
    expect(nicknameSchema.safeParse('abc').success).toBe(true);
    expect(nicknameSchema.safeParse('a'.repeat(20)).success).toBe(true);
    for (const bad of ['ab', 'a'.repeat(21), 'nina walks', 'nina@walks', 'niña', 'nina-walks']) {
      expect(nicknameSchema.safeParse(bad).error?.issues[0]?.message, bad).toBe(
        'validation.nickname',
      );
    }
  });

  it('is required at sign-up and in the profile', () => {
    const signUp = {
      displayName: 'Nina',
      nickname: 'nina_walks',
      email: 'n@x.io',
      password: '12345678',
    };
    expect(signUpSchema.safeParse(signUp).success).toBe(true);
    expect(signUpSchema.safeParse({ ...signUp, nickname: '' }).success).toBe(false);
    expect(profileFormSchema.shape.nickname).toBe(nicknameSchema);
  });
});

describe('sign-in', () => {
  it('takes an email or a nickname, trimmed', () => {
    expect(signInSchema.parse({ login: ' nina_walks ', password: 'x' }).login).toBe('nina_walks');
    expect(signInSchema.parse({ login: 'n@x.io', password: 'x' }).login).toBe('n@x.io');
    expect(signInSchema.safeParse({ login: '  ', password: 'x' }).success).toBe(false);
  });
});
