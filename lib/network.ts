interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

export function isConstrainedConnection(connection?: NetworkInformationLike | null) {
  if (!connection) return false;
  return Boolean(connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');
}

export function shouldSaveData(preference: boolean) {
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  return preference || isConstrainedConnection(connection);
}
