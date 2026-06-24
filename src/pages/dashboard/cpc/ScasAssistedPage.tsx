import { useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { ScasFillView } from '@/features/scas/ScasFillView';
import { useScasFill } from '@/features/scas/useScasFill';

export default function ScasAssistedPage() {
  const navigate = useNavigate();
  const { migrantId } = useParams<{ migrantId: string }>();
  const { user } = useAuth();

  const fill = useScasFill({
    participantId: migrantId ?? null,
    mode: 'ASSISTIDO',
    assistedByUserId: user?.uid ?? null,
  });

  const back = () => navigate(`/dashboard/cpc/migrantes/${migrantId}/perfil`);

  return <ScasFillView fill={fill} onBack={back} onSubmitted={back} />;
}
