// No-PHI client-side screening for case discussions (and any post body).
// This is a warning layer, not a guarantee — the consent gate + moderation
// queue are the policy backstops. Patterns target the identifiers most
// commonly pasted into clinical narratives.

export interface PhiFinding {
  label: string;
  match: string;
}

const PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'Possible date of birth', regex: /\b(dob|date of birth|d\.o\.b\.?)\b[:\s]*[\d/.-]*/i },
  { label: 'Possible medical record number', regex: /\b(mrn|medical record( number)?|record #)\b[:\s]*\S*/i },
  { label: 'Possible Social Security number', regex: /\b\d{3}-\d{2}-\d{4}\b/ },
  { label: 'Possible phone number', regex: /\b(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/ },
  { label: 'Possible full date (consider year-only)', regex: /\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])[/-](19|20)\d{2}\b/ },
  { label: 'Possible email address', regex: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/ },
  { label: 'Possible patient-name phrasing', regex: /\b(patient|pt\.?)\s+(name[d]?\s+)?(is\s+)?(mr\.?|mrs\.?|ms\.?|miss)\s+\w+/i },
  { label: 'Possible address', regex: /\b\d{1,5}\s+\w+\s+(street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|blvd\.?)\b/i },
];

export function screenForPhi(text: string): PhiFinding[] {
  const findings: PhiFinding[] = [];
  for (const { label, regex } of PATTERNS) {
    const match = regex.exec(text);
    if (match) findings.push({ label, match: match[0].slice(0, 40) });
  }
  return findings;
}

export const CASE_CONSENT_TEXT =
  'I attest that this case discussion contains no patient-identifiable health information. I have removed all names, ' +
  'initials, medical record numbers, dates of birth, exact dates of care, facility identifiers, photos showing faces or ' +
  'identifying features, and any other detail that could identify a patient. I understand GlobeMDs is a professional ' +
  'network, not a clinical system, and that posting PHI violates the terms of service and may violate the law.';
