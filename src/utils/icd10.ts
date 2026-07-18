// ICD-10-CM quick reference — an in-app utility for case-discussion tagging,
// NOT for clinical documentation or billing.
// Live search uses the NLM Clinical Tables public API; a small built-in list
// keeps the tool useful offline.

export interface Icd10Entry {
  code: string;
  description: string;
}

const CLINICAL_TABLES_URL = 'https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search';

export async function searchIcd10(query: string): Promise<Icd10Entry[]> {
  const res = await fetch(
    `${CLINICAL_TABLES_URL}?sf=code,name&terms=${encodeURIComponent(query)}&maxList=25`,
  );
  if (!res.ok) throw new Error('ICD-10 search unavailable');
  const json = (await res.json()) as [number, string[], null, Array<[string, string]>];
  return (json[3] ?? []).map(([code, description]) => ({ code, description }));
}

export const COMMON_ICD10: Icd10Entry[] = [
  { code: 'I10', description: 'Essential (primary) hypertension' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
  { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia' },
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified' },
  { code: 'M54.50', description: 'Low back pain, unspecified' },
  { code: 'F41.1', description: 'Generalized anxiety disorder' },
  { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified' },
  { code: 'K21.9', description: 'Gastro-esophageal reflux disease without esophagitis' },
  { code: 'J45.909', description: 'Unspecified asthma, uncomplicated' },
  { code: 'N39.0', description: 'Urinary tract infection, site not specified' },
  { code: 'I25.10', description: 'Atherosclerotic heart disease of native coronary artery without angina pectoris' },
  { code: 'E78.5', description: 'Hyperlipidemia, unspecified' },
  { code: 'I48.91', description: 'Unspecified atrial fibrillation' },
  { code: 'J44.9', description: 'Chronic obstructive pulmonary disease, unspecified' },
  { code: 'N18.9', description: 'Chronic kidney disease, unspecified' },
  { code: 'E03.9', description: 'Hypothyroidism, unspecified' },
  { code: 'G43.909', description: 'Migraine, unspecified, not intractable' },
  { code: 'M17.9', description: 'Osteoarthritis of knee, unspecified' },
  { code: 'D64.9', description: 'Anemia, unspecified' },
  { code: 'R07.9', description: 'Chest pain, unspecified' },
];
