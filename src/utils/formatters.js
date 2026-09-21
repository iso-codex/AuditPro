export const formatRole = (role) => {
  if (!role) return '';
  if (role.toLowerCase() === 'mis') return 'MIS';
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
