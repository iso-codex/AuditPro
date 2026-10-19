// Procurement Form Constants
export const MANAGER_AUDITOR_VISIBLE_FORM_STATUSES = ['Saved', 'Updated', 'Completed'];

export const FORM_STAGES = {
  CREATED: 'Created',
  SAVED: 'Saved',
  UPDATED: 'Updated',
  COMPLETED: 'Completed'
};

export const FORM_TYPES = {
  MARKET: 'market',
  FROZEN_GOODS: 'frozen_goods'
};

export const formatFormType = (type) => {
  if (type === 'market') return 'Market Form';
  if (type === 'frozen_goods') return 'Frozen Goods Form';
  return type;
};
