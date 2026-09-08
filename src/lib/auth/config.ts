function readEnv(key: string): string | undefined {
  const fromProcess =
    typeof process !== 'undefined' ? process.env[key] : undefined
  if (fromProcess) return fromProcess

  const fromImportMeta = import.meta.env?.[key]
  if (typeof fromImportMeta === 'string' && fromImportMeta.length > 0) {
    return fromImportMeta
  }

  return undefined
}

export function getAdminEmail(): string {
  return readEnv('VITE_ADMIN_EMAIL') ?? readEnv('ADMIN_EMAIL') ?? ''
}

export function getAdminUsername(): string {
  return readEnv('VITE_ADMIN_USERNAME') ?? readEnv('ADMIN_USERNAME') ?? ''
}

export function usernameToEmail(username: string): string {
  const trimmed = username.trim()
  if (trimmed.includes('@')) return trimmed

  const adminUsername = getAdminUsername()
  const adminEmail = getAdminEmail()
  if (adminUsername && adminEmail && trimmed === adminUsername) {
    return adminEmail
  }

  return `${trimmed}@ocpdc.local`
}
