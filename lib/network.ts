interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

export function isConstrainedConnection(connection?: NetworkInformationLike | null) {
  if (!connection) return false;
  return Boolean(connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');
}

export function shouldSaveData(preference: boolean) {
  const connection =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { connection?: NetworkInformationLike }).connection
      : undefined;
  return preference || isConstrainedConnection(connection);
}
