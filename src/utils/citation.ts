// PubMed citation lookup for journal-club posts.
// Uses the public NCBI E-utilities esummary endpoint. Only metadata (title,
// authors, journal, year) is attached — never article full text, respecting
// copyright.

import { LinkMeta } from '@/types/database';

const ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';

export function extractPmid(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d{4,9}$/.test(trimmed)) return trimmed;
  const urlMatch = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d{4,9})/.exec(trimmed);
  return urlMatch ? urlMatch[1] : null;
}

export async function fetchPubMedCitation(pmid: string): Promise<LinkMeta> {
  const res = await fetch(`${ESUMMARY}?db=pubmed&id=${pmid}&retmode=json`);
  if (!res.ok) throw new Error('PubMed lookup failed');
  const json = await res.json();
  const doc = json.result?.[pmid];
  if (!doc || doc.error) throw new Error('PMID not found');

  const authors: Array<{ name: string }> = doc.authors ?? [];
  const authorText =
    authors.length === 0
      ? ''
      : authors.length <= 3
        ? authors.map((a) => a.name).join(', ')
        : `${authors[0].name} et al.`;
  const year = (doc.pubdate ?? '').split(' ')[0];

  return {
    pmid,
    title: doc.title,
    authors: authorText,
    journal: doc.source,
    year,
  };
}

/** AMA-style short citation string. */
export function formatCitation(meta: LinkMeta): string {
  const parts = [meta.authors, meta.title, meta.journal, meta.year].filter(Boolean);
  return `${parts.join('. ')}. PMID: ${meta.pmid}`;
}

export function pubmedUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}
