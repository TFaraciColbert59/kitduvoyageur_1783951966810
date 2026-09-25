export function getAuditCredentials(env = process.env) {
  const email = typeof env?.AUDIT_EMAIL === 'string' ? env.AUDIT_EMAIL.trim() : '';
  const password = typeof env?.AUDIT_PASSWORD === 'string' ? env.AUDIT_PASSWORD : '';
  if (!email) throw new Error('AUDIT_EMAIL est requis');
  if (!password) throw new Error('AUDIT_PASSWORD est requis');
  return { email, password };
}
