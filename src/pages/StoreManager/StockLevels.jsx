import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import StockCard from '../../components/StockCard';
import { RefreshCw } from 'lucide-react';

const StockLevels = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

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

      {loading ? (
        <div className="flex justify-center mt-10">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {items.map(item => (
            <StockCard key={item.id} item={item} />
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
