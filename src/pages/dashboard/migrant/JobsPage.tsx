import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getDocument } from '@/integrations/firebase/firestore';
import { useLanguage } from '@/contexts/LanguageContext';
import { loadActiveJobOfferRows } from '@/features/jobs/loadActiveJobOffers';
import { createdAtToIso } from '@/lib/firestoreTimestamps';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Briefcase,
  MapPin,
  Clock,
  Search,
  Building,
  ChevronRight,
  Euro,
} from 'lucide-react';

interface JobOfferRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  sector: string | null;
  contract_type: string | null;
  work_mode?: string | null;
  salary_range: string | null;
  created_at: unknown;
  company_id?: string | null;
}

interface JobOffer extends Omit<JobOfferRow, 'created_at'> {
  created_at: string;
  company: {
    company_name: string;
  } | null;
}

export default function JobsPage() {
  const { t } = useLanguage();
  const mj = t.dashboard.migrant_jobs;
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await loadActiveJobOfferRows<JobOfferRow>();
      const companyIds = Array.from(new Set(data.map((j) => j.company_id).filter(Boolean))) as string[];
      const companyDocs = await Promise.all(
        companyIds.map((id) => getDocument<{ company_name: string }>('companies', id))
      );
      const companiesById = new Map<string, { company_name: string }>();
      companyIds.forEach((id, idx) => {
        const doc = companyDocs[idx];
        if (doc) companiesById.set(id, doc);
      });

      const jobsWithCompanies: JobOffer[] = data.map((job) => {
        const created = createdAtToIso(job.created_at);
        return {
          ...job,
          created_at: created || new Date(0).toISOString(),
          company: job.company_id ? companiesById.get(job.company_id) || null : null,
        };
      });

      setJobs(jobsWithCompanies);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
      setLoadError(t.get('dashboard.migrant_jobs.load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const allJobs = jobs;
  const sectors = ['all', ...new Set(allJobs.map((j) => j.sector).filter(Boolean))] as string[];
  const locations = ['all', ...new Set(allJobs.map((j) => j.location).filter(Boolean))] as string[];

  const filteredJobs = allJobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.description?.toLowerCase().includes(search.toLowerCase()) ||
      job.company?.company_name.toLowerCase().includes(search.toLowerCase());
    const matchesSector = selectedSector === 'all' || job.sector === selectedSector;
    const matchesLocation = selectedLocation === 'all' || job.location === selectedLocation;
    return matchesSearch && matchesSector && matchesLocation;
  });

  const getContractLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      full_time: mj.contract_full_time,
      part_time: mj.contract_part_time,
      temporary: mj.contract_temporary,
      internship: mj.contract_internship,
    };
    return type ? labels[type] || type : null;
  };

  const normalizeWorkMode = (wm: string | null | undefined): 'on_site' | 'hybrid' | 'remote' => {
    if (wm === 'hybrid' || wm === 'remote' || wm === 'on_site') return wm;
    return 'on_site';
  };

  const getWorkModeLabel = (wm: string | null | undefined) => {
    const labels: Record<string, string> = {
      on_site: mj.work_on_site,
      hybrid: mj.work_hybrid,
      remote: mj.work_remote,
    };
    return labels[normalizeWorkMode(wm)];
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const posted = new Date(date);
    const diffDays = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return mj.time_today;
    if (diffDays === 1) return mj.time_yesterday;
    if (diffDays < 7) return t.get('dashboard.migrant_jobs.time_days_ago', { count: diffDays });
    if (diffDays < 30) return t.get('dashboard.migrant_jobs.time_weeks_ago', { count: Math.floor(diffDays / 7) });
    return t.get('dashboard.migrant_jobs.time_months_ago', { count: Math.floor(diffDays / 30) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <Briefcase className="h-8 w-8 text-primary" />
          {mj.title}
        </h1>
        <p className="text-muted-foreground mt-1">{mj.subtitle}</p>
      </div>

      {loadError && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => fetchJobs()}>
            {mj.retry}
          </Button>
        </div>
      )}

      <div className="bg-card rounded-xl border p-4 mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={mj.search_placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="px-4 py-2 rounded-lg border border-input bg-background text-sm"
          >
            <option value="all">{mj.all_sectors}</option>
            {sectors
              .filter((s) => s !== 'all')
              .map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
          </select>

          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="px-4 py-2 rounded-lg border border-input bg-background text-sm"
          >
            <option value="all">{mj.all_locations}</option>
            {locations
              .filter((l) => l !== 'all')
              .map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {t.get('dashboard.migrant_jobs.offers_found', { count: filteredJobs.length })}
      </p>

      {!loadError && allJobs.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">{mj.empty_active_title}</h3>
          <p className="text-muted-foreground">{mj.empty_active_hint}</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">{mj.empty_filtered_title}</h3>
          <p className="text-muted-foreground">{mj.empty_filtered_hint}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <Link
              key={job.id}
              to={`/dashboard/migrante/emprego/${job.id}`}
              className="bg-card rounded-xl border p-6 block hover:border-primary/50 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{job.title}</h3>
                    {job.contract_type && (
                      <Badge variant="secondary" className="text-xs">
                        {getContractLabel(job.contract_type)}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {getWorkModeLabel(job.work_mode)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3 flex-wrap">
                    {job.company && (
                      <span className="flex items-center gap-1">
                        <Building className="h-4 w-4" />
                        {job.company.company_name}
                      </span>
                    )}
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {job.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {getTimeAgo(job.created_at)}
                    </span>
                  </div>

                  {job.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{job.description}</p>
                  )}

                  {job.salary_range && (
                    <p className="text-sm font-medium text-primary flex items-center gap-1">
                      <Euro className="h-4 w-4" />
                      {job.salary_range}
                    </p>
                  )}
                </div>

                <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 flex-shrink-0 group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
