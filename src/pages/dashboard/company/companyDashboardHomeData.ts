import type { User } from 'firebase/auth';
import { countDocuments, getDocument, queryDocuments, setDocument } from '@/integrations/firebase/firestore';

export type CompanyJobOfferScope = {
  companyId: string | null;
  jobOfferCompanyIds: string[];
};

type AuthProfile = { role?: string | null; name?: string | null } | null | undefined;
type AuthProfileData = { name?: string | null } | null | undefined;

interface CompanyRow {
  id: string;
  company_name?: string;
  verified?: boolean;
}

/** Todos os `company_id` possíveis em `job_offers` para este utilizador (doc canónico + docs legados com o mesmo user_id). */
export async function resolveJobOfferCompanyIds(uid: string): Promise<string[]> {
  const ids = new Set<string>();
  ids.add(uid);
  const byUserId = await queryDocuments<CompanyRow>(
    'companies',
    [{ field: 'user_id', operator: '==', value: uid }],
    undefined,
    50
  );
  for (const r of byUserId) {
    if (r.id) ids.add(r.id);
  }
  try {
    const byUserIdAlt = await queryDocuments<CompanyRow>(
      'companies',
      [{ field: 'userId', operator: '==', value: uid }],
      undefined,
      50
    );
    for (const r of byUserIdAlt) {
      if (r.id) ids.add(r.id);
    }
  } catch {
    /* Campo userId pode não existir em todos os projetos / índice em falta */
  }
  return Array.from(ids);
}

function isOfferOpenPipeline(status: string): boolean {
  if (status === 'closed' || status === 'rejected') return false;
  return true;
}

const CATALOG_LIMIT = 500;
const APPLICATIONS_PER_JOB_LIMIT = 300;

export async function bootstrapCompanyJobOfferScope(
  user: User,
  profile: AuthProfile,
  profileData: AuthProfileData
): Promise<CompanyJobOfferScope> {
  const uid = user.uid;

  const direct = await getDocument<CompanyRow>('companies', uid);
  if (direct) {
    const patch: Record<string, unknown> = {};
    if (!direct.company_name || !direct.company_name.trim()) {
      patch.company_name =
        (profileData?.name && profileData.name.trim() ? profileData.name.trim() : null) ??
        (profile?.name && profile.name.trim() ? profile.name.trim() : null) ??
        (user.displayName && user.displayName.trim() ? user.displayName.trim() : null) ??
        user.email ??
        'Empresa';
    }
    if (typeof direct.verified !== 'boolean') patch.verified = false;
    if (Object.keys(patch).length > 0) await setDocument('companies', uid, patch, true);
    return { companyId: uid, jobOfferCompanyIds: await resolveJobOfferCompanyIds(uid) };
  }

  const legacyRows = await queryDocuments<CompanyRow>(
    'companies',
    [{ field: 'user_id', operator: '==', value: uid }],
    undefined,
    1
  );
  const legacy = legacyRows[0];
  if (legacy) {
    const baseName =
      (typeof legacy.company_name === 'string' && legacy.company_name.trim() ? legacy.company_name.trim() : null) ??
      (profileData?.name && profileData.name.trim() ? profileData.name.trim() : null) ??
      (profile?.name && profile.name.trim() ? profile.name.trim() : null) ??
      (user.displayName && user.displayName.trim() ? user.displayName.trim() : null) ??
      user.email ??
      'Empresa';
    await setDocument(
      'companies',
      uid,
      {
        user_id: uid,
        company_name: baseName,
        verified: typeof legacy.verified === 'boolean' ? legacy.verified : false,
        createdAt: new Date().toISOString(),
      },
      true
    );
    return { companyId: uid, jobOfferCompanyIds: await resolveJobOfferCompanyIds(uid) };
  }

  if (profile?.role === 'company') {
    await setDocument(
      'companies',
      uid,
      {
        user_id: uid,
        company_name:
          (profileData?.name && profileData.name.trim() ? profileData.name.trim() : null) ??
          (profile?.name && profile.name.trim() ? profile.name.trim() : null) ??
          (user.displayName && user.displayName.trim() ? user.displayName.trim() : null) ??
          user.email ??
          'Empresa',
        verified: false,
        createdAt: new Date().toISOString(),
      },
      true
    );
    return { companyId: uid, jobOfferCompanyIds: await resolveJobOfferCompanyIds(uid) };
  }

  return { companyId: null, jobOfferCompanyIds: [] };
}

interface JobOfferDoc {
  id: string;
  title?: string;
  location?: string | null;
  status?: string | null;
  created_at?: unknown;
}

interface ApplicationDoc {
  id: string;
  applicant_id?: string | null;
  job_id?: string | null;
  status?: string | null;
  created_at?: unknown;
}

function createdAtToIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return '';
}

function normalizeApplicationStatus(value: string | null | undefined): 'submitted' | 'reviewing' | 'interview' | 'accepted' | 'rejected' {
  if (value === 'reviewing') return 'reviewing';
  if (value === 'interview') return 'interview';
  if (value === 'accepted') return 'accepted';
  if (value === 'rejected') return 'rejected';
  return 'submitted';
}

export type CompanyHomeJobRow = {
  id: string;
  title: string;
  location: string;
  applications: number;
  status: string;
};

export type CompanyHomeApplicationRow = {
  id: string;
  applicantName: string;
  jobTitle: string;
  jobId: string;
  createdAt: string;
  status: 'submitted' | 'reviewing' | 'interview' | 'accepted' | 'rejected';
};

export type CompanyHomeSnapshot = {
  stats: {
    activeOffers: number;
    receivedApplications: number;
    viewedCandidates: number;
    hires: number;
  };
  activeJobs: CompanyHomeJobRow[];
  recentApplications: CompanyHomeApplicationRow[];
};

export async function fetchCompanyHomeSnapshot(jobOfferCompanyIds: string[], unknownApplicantLabel: string): Promise<CompanyHomeSnapshot> {
  const empty: CompanyHomeSnapshot = {
    stats: { activeOffers: 0, receivedApplications: 0, viewedCandidates: 0, hires: 0 },
    activeJobs: [],
    recentApplications: [],
  };

  const ids = Array.from(new Set(jobOfferCompanyIds.filter(Boolean)));
  if (ids.length === 0) return empty;

  const offersById = new Map<string, { title: string; location: string; status: string; created_at: string }>();
  await Promise.all(
    ids.map(async (cid) => {
      const offers = await queryDocuments<JobOfferDoc>(
        'job_offers',
        [{ field: 'company_id', operator: '==', value: cid }],
        undefined,
        CATALOG_LIMIT
      );
      for (const offer of offers) {
        const createdAt = createdAtToIso(offer.created_at);
        offersById.set(offer.id, {
          title: offer.title?.trim() || '—',
          location: typeof offer.location === 'string' ? offer.location : offer.location === null ? '' : '',
          status: typeof offer.status === 'string' ? offer.status : '',
          created_at: createdAt,
        });
      }
    })
  );

  const offerIds = Array.from(offersById.keys());
  if (offerIds.length === 0) return empty;

  const applicationCountByJob = new Map<string, number>();
  const acceptedCountByJob = new Map<string, number>();
  let receivedApplications = 0;
  let hiresFromApplications = 0;

  await Promise.all(
    offerIds.map(async (jobId) => {
      const [total, accepted] = await Promise.all([
        countDocuments('job_applications', [{ field: 'job_id', operator: '==', value: jobId }]),
        countDocuments('job_applications', [
          { field: 'job_id', operator: '==', value: jobId },
          { field: 'status', operator: '==', value: 'accepted' },
        ]),
      ]);
      applicationCountByJob.set(jobId, total);
      acceptedCountByJob.set(jobId, accepted);
      receivedApplications += total;
      hiresFromApplications += accepted;
    })
  );

  /* Sem orderBy: evita índice composto (job_id + created_at) em projetos sem deploy de índices */
  const appsNested = await Promise.all(
    offerIds.map((jobId) =>
      queryDocuments<ApplicationDoc>(
        'job_applications',
        [{ field: 'job_id', operator: '==', value: jobId }],
        undefined,
        APPLICATIONS_PER_JOB_LIMIT
      )
    )
  );
  const flatApps = appsNested.flat().sort((a, b) => {
    const ta = new Date(createdAtToIso(a.created_at)).getTime();
    const tb = new Date(createdAtToIso(b.created_at)).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });

  const viewedApplicantIds = new Set<string>();
  for (const app of flatApps) {
    const st = normalizeApplicationStatus(app.status);
    if (st !== 'submitted' && app.applicant_id) viewedApplicantIds.add(app.applicant_id);
  }

  let hiresFromPool = 0;
  await Promise.all(
    ids.map(async (cid) => {
      try {
        const hired = await queryDocuments<{ id: string }>(
          'company_candidates',
          [
            { field: 'company_id', operator: '==', value: cid },
            { field: 'stage', operator: '==', value: 'hired' },
          ],
          undefined,
          500
        );
        hiresFromPool += hired.length;
      } catch {
        /* Índice composto em falta ou permissões — ignora bolsa interna */
      }
    })
  );

  /* Inclui p.ex. pending_review e paused — vagas novas ficam em revisão CPC até ficarem active */
  const activeOffers = [...offersById.entries()].filter(([, o]) => isOfferOpenPipeline(o.status)).length;

  const activeJobRows: CompanyHomeJobRow[] = [...offersById.entries()]
    .filter(([, o]) => isOfferOpenPipeline(o.status))
    .map(([id, o]) => ({
      id,
      title: o.title,
      location: o.location || '—',
      applications: applicationCountByJob.get(id) ?? 0,
      status: o.status,
    }))
    .sort((a, b) => {
      const ta = new Date(offersById.get(a.id)?.created_at || '').getTime();
      const tb = new Date(offersById.get(b.id)?.created_at || '').getTime();
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    })
    .slice(0, 5);

  const applicantIds = Array.from(new Set(flatApps.map((a) => a.applicant_id).filter((id): id is string => Boolean(id))));
  const profileDocs = await Promise.all(
    applicantIds.map((id) => getDocument<{ name?: string | null; email?: string | null }>('profiles', id))
  );
  const profileById = new Map<string, { name: string }>();
  applicantIds.forEach((id, idx) => {
    const p = profileDocs[idx];
    profileById.set(id, {
      name: p?.name?.trim() || unknownApplicantLabel,
    });
  });

  const mappedApps = flatApps
    .map((app) => {
      const jobId = app.job_id || '';
      if (!jobId || !offersById.has(jobId)) return null;
      const profileRow = profileById.get(app.applicant_id || '') ?? { name: unknownApplicantLabel };
      return {
        id: app.id,
        applicantName: profileRow.name,
        jobTitle: offersById.get(jobId)?.title || '—',
        jobId,
        createdAt: createdAtToIso(app.created_at),
        status: normalizeApplicationStatus(app.status),
      } as CompanyHomeApplicationRow;
    })
    .filter((row): row is CompanyHomeApplicationRow => row !== null);

  mappedApps.sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });

  return {
    stats: {
      activeOffers,
      receivedApplications,
      viewedCandidates: viewedApplicantIds.size,
      hires: hiresFromApplications + hiresFromPool,
    },
    activeJobs: activeJobRows,
    recentApplications: mappedApps.slice(0, 5),
  };
}
