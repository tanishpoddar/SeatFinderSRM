/**
 * Admin configuration utility
 * Reads admin emails from environment variable
 */

export function getAdminEmails(): string[] {
  const adminEmailsEnv = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
  
  if (!adminEmailsEnv) {
    console.warn('NEXT_PUBLIC_ADMIN_EMAILS not configured in environment');
    return [];
  }
  
  return adminEmailsEnv
    .split(',')
    .map(email => email.trim())
    .filter(email => email.length > 0);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email);
}
