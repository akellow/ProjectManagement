type ProfileUser = {
  email?: string;
  user_metadata?: Record<string, unknown>;
  identities?: Array<{
    provider: string;
    identity_data?: Record<string, unknown> | null;
  }>;
};

function metadataString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getProfilePictureUrl(user: ProfileUser | null | undefined) {
  const metadata = user?.user_metadata;
  const savedPhoto = metadataString(metadata?.avatar_url)
    ?? metadataString(metadata?.picture)
    ?? metadataString(metadata?.avatar);
  if (savedPhoto) return savedPhoto;

  const googleIdentity = user?.identities?.find((identity) => identity.provider === "google");
  return metadataString(googleIdentity?.identity_data?.avatar_url)
    ?? metadataString(googleIdentity?.identity_data?.picture);
}

export function getDashboardUserName(user: ProfileUser | null | undefined) {
  const metadata = user?.user_metadata;
  const name = metadataString(metadata?.username)
    ?? metadataString(metadata?.user_name)
    ?? metadataString(metadata?.preferred_username)
    ?? metadataString(metadata?.full_name)
    ?? metadataString(metadata?.name)
    ?? metadataString(user?.email?.split("@")[0]);

  if (!name) return "Your";
  return name.charAt(0).toLocaleUpperCase() + name.slice(1);
}
