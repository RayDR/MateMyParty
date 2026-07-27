export const INVITATION_ACCESS_COOKIE = 'mmp_invitation_access';
export const LANGUAGE_COOKIE = 'mmp_locale';

export const invitationCookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 12 * 60,
};

export const languageCookieOptions = {
  httpOnly: false,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 365 * 24 * 60 * 60,
};
