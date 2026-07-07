import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import StockCard from '../../components/StockCard';
import { RefreshCw, AlertTriangle } from 'lucide-react';

const StockLevels = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const isStoreManager = profile?.role === 'store_manager';

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleUpdateThreshold = async (id, newThreshold) => {
    try {
      const { error } = await supabase
        .from('items')
        .update({ low_stock_threshold: newThreshold })
        .eq('id', id);
        
      if (error) throw error;
      
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, low_stock_threshold: newThreshold } : item
      ));
    } catch (error) {
      console.error('Error updating threshold:', error);
      alert('Failed to update threshold: ' + error.message);
    }
  };

  const lowStockItems = items.filter(item => item.quantity_in_store <= item.low_stock_threshold);

  return (
    <div className="stock-levels-page">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2>Stock Levels</h2>
          <p>Current inventory in the company store</p>
        </div>
        <button className="btn btn-outline" onClick={fetchItems} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spinner border-0' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {!loading && lowStockItems.length > 0 && (
        <div className="card mb-6" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--danger-color)' }}>
            <AlertTriangle size={20} />
            <h3 className="m-0" style={{ color: 'inherit' }}>Low Stock Alerts</h3>
          </div>
          <p className="text-sm mb-3">The following items have fallen below their reorder threshold:</p>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map(item => (
              <div key={item.id} className="badge badge-rejected" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                {item.name} ({item.quantity_in_store} / {item.low_stock_threshold})
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center mt-10">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {items.map(item => (
            <StockCard 
              key={item.id} 
              item={item} 
              isStoreManager={isStoreManager}
              onUpdateThreshold={handleUpdateThreshold}
            />
          ))}
          {items.length === 0 && (
            <div className="col-span-full text-center py-10" style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)' }}>
              No items found in the store.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StockLevels;
