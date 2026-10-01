import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import apiClient from '../services/apiClient';
import DistrictOptions from './DistrictOptions';

// District picker for the admin property forms, grouped by state. "" = unassigned.
// Inactive districts are hidden unless the property already uses one.
const DistrictSelect = ({ id, name, value, onChange, className }) => {
  const [districts, setDistricts] = useState([]);

  useEffect(() => {
    apiClient.get('/api/admin/districts')
      .then(({ data }) => setDistricts(data.districts || []))
      .catch(() => setDistricts([]));
  }, []);

  return (
    <select id={id} name={name} value={value} onChange={onChange} className={className}>
      <option value="">Unassigned</option>
      <DistrictOptions districts={districts} keepId={value} />
    </select>
  );
};

DistrictSelect.propTypes = {
  id: PropTypes.string,
  name: PropTypes.string,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
};

export default DistrictSelect;
