export function isAuthorized(userId: number | undefined, authorizedUserIds: string): boolean {
  if (userId === undefined) {
    return false;
  }

  const ids = authorizedUserIds
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  return ids.includes(String(userId));
}
