import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { RefreshCw, Layers } from 'lucide-react';

const DepartmentInventory = () => {
  const { profile } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInventory = async () => {
    if (!profile?.department) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('department_inventory')
        .select('*, items(name, category, unit)')
        .eq('department', profile.department)
        .order('last_updated', { ascending: false });

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      alert('Failed to fetch inventory: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [profile]);

  return (
    <div className="page-content">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2>{profile?.department} Inventory</h2>
          <p className="text-gray-500">Current stock levels for your department.</p>
        </div>
        <button className="btn btn-outline" onClick={fetchInventory} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spinner border-0' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th>Quantity Available</th>
              <th>Unit</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading && inventory.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-4">
                  <div className="spinner mx-auto"></div>
                </td>
              </tr>
            ) : inventory.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-8 text-gray-500 flex flex-col items-center">
                  <Layers size={48} className="mb-2 text-gray-300" />
                  No inventory records found.
                </td>
              </tr>
            ) : inventory.map(item => (
              <tr key={item.id}>
                <td className="font-medium">{item.items?.name || 'Unknown Item'}</td>
                <td>{item.items?.category}</td>
                <td className="font-semibold text-lg">{item.quantity}</td>
                <td className="text-gray-500">{item.items?.unit}</td>
                <td className="text-sm text-gray-500">
                  {new Date(item.last_updated).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DepartmentInventory;
