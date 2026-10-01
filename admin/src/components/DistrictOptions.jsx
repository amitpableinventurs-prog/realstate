import PropTypes from 'prop-types';

// <option>s for a district <select>, grouped by state (districts come sorted
// by state, then name, from /api/admin/districts). Inactive districts are
// skipped unless `keepId` is one of them (the value currently selected).
const DistrictOptions = ({ districts, keepId }) => {
  const groups = new Map();
  districts
    .filter((d) => d.isActive !== false || d.id === keepId)
    .forEach((d) => {
      const state = d.state || 'Other';
      if (!groups.has(state)) groups.set(state, []);
      groups.get(state).push(d);
    });

  return [...groups.entries()].map(([state, list]) => (
    <optgroup key={state} label={state}>
      {list.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}{d.isActive === false ? ' (inactive)' : ''}
        </option>
      ))}
    </optgroup>
  ));
};

DistrictOptions.propTypes = {
  districts: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    state: PropTypes.string,
    isActive: PropTypes.bool,
  })).isRequired,
  keepId: PropTypes.string,
};

export default DistrictOptions;
