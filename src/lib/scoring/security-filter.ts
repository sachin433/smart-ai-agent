/** Reject pure security / AppSec / GRC roles — not target SRE/platform infra. */
const SECURITY_TITLE_PATTERNS = [
  /\bsecurity engineer\b/i,
  /\bsecurity architect\b/i,
  /\bsecurity software engineer\b/i,
  /\bcloud security\b/i,
  /\binfrastructure security\b/i,
  /\bplatform security\b/i,
  /\bapplication security\b/i,
  /\bappsec\b/i,
  /\bproduct security\b/i,
  /\bcyber\s*security\b/i,
  /\bcybersecurity\b/i,
  /\binfosec\b/i,
  /\boffensive security\b/i,
  /\bsecurity analyst\b/i,
  /\bsecurity researcher\b/i,
  /\bgrc\b/i,
  /\bthreat detection\b/i,
  /\bincident response\b/i,
  /\bpenetration test/i,
  /\bpen tester\b/i,
];

export function isSecurityRole(title: string): boolean {
  const t = title.trim();
  return SECURITY_TITLE_PATTERNS.some((p) => p.test(t));
}

export function getSecurityRejectReason(title: string): string | null {
  if (isSecurityRole(title)) {
    return `Security-focused role excluded: ${title}`;
  }
  return null;
}
