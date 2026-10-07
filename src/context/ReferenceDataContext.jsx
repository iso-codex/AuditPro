import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const ReferenceDataContext = createContext();

export const useReferenceData = () => {
  return useContext(ReferenceDataContext);
};

export const ReferenceDataProvider = ({ children }) => {
  const [departments, setDepartments] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReferenceData = async () => {
    setLoading(true);
    try {
      const [deptRes, itemRes] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('items').select('id, name, unit, category_id, low_stock_threshold').order('name')
      ]);

      if (deptRes.error) console.error("Error fetching departments", deptRes.error);
      else setDepartments(deptRes.data || []);

      if (itemRes.error) console.error("Error fetching items", itemRes.error);
      else setItems(itemRes.data || []);
    } catch (error) {
      console.error("Failed to load reference data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferenceData();
  }, []);

  return (
    <ReferenceDataContext.Provider value={{ departments, items, loading, refreshData: fetchReferenceData }}>
      {children}
    </ReferenceDataContext.Provider>
  );
};
