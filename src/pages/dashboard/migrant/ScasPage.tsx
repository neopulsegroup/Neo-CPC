import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { ScasFillView } from '@/features/scas/ScasFillView';
import { useScasFill } from '@/features/scas/useScasFill';

export default function ScasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const fill = useScasFill({
    participantId: user?.uid ?? null,
    mode: 'AUTONOMO',
    assistedByUserId: null,
  });

  return (
    <ScasFillView
      fill={fill}
      onBack={() => navigate('/dashboard/migrante')}
      onSubmitted={() => navigate('/dashboard/migrante')}
    />
  );
}
