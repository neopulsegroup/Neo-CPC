import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/firebase/firestore', () => ({
  getDocument: vi.fn(),
  queryDocuments: vi.fn(),
}));

import { getDocument, queryDocuments } from '@/integrations/firebase/firestore';
import { loadCpcTeamSpecialists, loadCpcTeamSpecialistsForSupport } from './cpcSpecialists';

const mockGetDocument = getDocument as unknown as ReturnType<typeof vi.fn>;
const mockQueryDocuments = queryDocuments as unknown as ReturnType<typeof vi.fn>;

describe('cpcSpecialists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa responsáveis da área de serviço mesmo quando o perfil não é lawyer/psychologist/mediator', async () => {
    mockGetDocument.mockResolvedValue({
      id: 'legal',
      is_active: true,
      responsible_uids: ['consultant-1', 'lawyer-1'],
      responsible_names: ['Consultor CPC', 'Dr. Legal'],
    });
    mockQueryDocuments.mockResolvedValue([
      { id: 'consultant-1', role: 'consultant', name: 'Consultor CPC', active: true },
      { id: 'lawyer-1', role: 'lawyer', name: 'Dr. Legal', active: true },
      { id: 'other-lawyer', role: 'lawyer', name: 'Outro Jurista', active: true },
    ]);

    const rows = await loadCpcTeamSpecialists('legal');
    expect(rows.map((row) => row.id)).toEqual(['consultant-1', 'lawyer-1']);
    expect(rows.map((row) => row.name)).toEqual(['Consultor CPC', 'Dr. Legal']);
  });

  it('faz fallback para roles da categoria quando a área não tem responsáveis', async () => {
    mockGetDocument.mockResolvedValue({
      id: 'psychology',
      is_active: true,
      responsible_uids: [],
      responsible_names: [],
    });
    mockQueryDocuments.mockResolvedValue([
      { id: 'psy-1', role: 'psychologist', name: 'Dra. Ana', active: true },
      { id: 'consultant-1', role: 'consultant', name: 'Consultor', active: true },
    ]);

    const rows = await loadCpcTeamSpecialists('psychology');
    expect(rows).toEqual([{ id: 'psy-1', name: 'Dra. Ana', role: 'psychologist' }]);
  });

  it('ignora responsáveis inativos e áreas inativas', async () => {
    mockGetDocument.mockResolvedValue({
      id: 'mediation',
      is_active: false,
      responsible_uids: ['med-1'],
      responsible_names: ['Mediador'],
    });
    mockQueryDocuments.mockResolvedValue([{ id: 'med-1', role: 'mediator', name: 'Mediador', active: true }]);

    const inactiveArea = await loadCpcTeamSpecialists('mediation');
    expect(inactiveArea).toEqual([{ id: 'med-1', name: 'Mediador', role: 'mediator' }]);

    mockGetDocument.mockResolvedValue({
      id: 'mediation',
      is_active: true,
      responsible_uids: ['med-1', 'med-2'],
      responsible_names: ['Ativo', 'Inativo'],
    });
    mockQueryDocuments.mockResolvedValue([
      { id: 'med-1', role: 'mediator', name: 'Ativo', active: true },
      { id: 'med-2', role: 'mediator', name: 'Inativo', active: false },
    ]);

    const rows = await loadCpcTeamSpecialists('mediation');
    expect(rows.map((row) => row.id)).toEqual(['med-1']);
  });

  it('em suporte usa a área quando existe; senão inclui roles de fallback', async () => {
    mockGetDocument.mockResolvedValue({
      id: 'legal',
      is_active: true,
      responsible_uids: [],
      responsible_names: [],
    });
    mockQueryDocuments.mockResolvedValue([
      { id: 'c1', role: 'consultant', name: 'Consultor', active: true },
      { id: 'l1', role: 'lawyer', name: 'Jurista', active: true },
    ]);

    const rows = await loadCpcTeamSpecialistsForSupport('legal');
    expect(rows.map((row) => row.id).sort()).toEqual(['c1', 'l1']);
  });
});
