import apiClient from '../services/apiClient';

/**
 * All districts (including inactive) for the district pickers, sorted by state
 * then name — the shape <DistrictOptions> expects: { id, name, state, isActive }
 * (plus stateId and the pending property / district admin counts).
 */
export async function fetchDistricts() {
  const { data } = await apiClient.get('/api/v1/admin/districts');
  return (data.data || [])
    .map((d) => ({
      id: d.id, name: d.name, state: d.state?.name || '', stateId: d.state_id, isActive: d.is_active,
      pending: d.pending_count ?? 0, admins: d.admin_count ?? 0,
    }))
    .sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
}
