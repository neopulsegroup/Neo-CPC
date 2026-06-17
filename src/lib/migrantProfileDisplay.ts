/** Nome registado do migrante — mesma prioridade que /dashboard/migrante/perfil. */
export function resolveMigrantRegisteredName(args: {
  profileDocName?: string | null;
  userProfileName?: string | null;
}): string {
  const fromProfileDoc = typeof args.profileDocName === 'string' ? args.profileDocName.trim() : '';
  if (fromProfileDoc) return fromProfileDoc;
  const fromUserProfile = typeof args.userProfileName === 'string' ? args.userProfileName.trim() : '';
  return fromUserProfile;
}
