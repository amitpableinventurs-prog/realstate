import { useEffect, useState } from 'react';
import { masterAPI } from '../services/api';

// States and the districts of one state (GET /v1/master/...), for dropdowns

export interface Option { id: string; name: string }

export const useStates = (): Option[] => {
  const [states, setStates] = useState<Option[]>([]);
  useEffect(() => {
    masterAPI.states().then(({ data }) => setStates(data.data)).catch(() => setStates([]));
  }, []);
  return states;
};

export const useDistricts = (stateId: string | null | undefined): { districts: Option[]; loading: boolean } => {
  const [districts, setDistricts] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!stateId) {
      setDistricts([]);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    masterAPI.districts(stateId)
      .then(({ data }) => { if (!cancelled) setDistricts(data.data); })
      .catch(() => { if (!cancelled) setDistricts([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [stateId]);
  return { districts, loading };
};
