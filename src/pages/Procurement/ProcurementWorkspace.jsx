import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ShoppingCart, TrendingUp, TrendingDown, AlertTriangle, Package, Truck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const ProcurementWorkspace = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activePOs: 0,
    itemsToReorder: 0,
    suppliersCount: 0
  });
  
  const [priceMovements, setPriceMovements] = useState([]);
  const [reorderItems, setReorderItems] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Stats
      const { count: poCount } = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).in('status', ['Pending', 'Approved']);
      const { count: supplierCount } = await supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('is_active', true);
      
      // 2. Central Store Reorder Items
      const { data: invData } = await supabase.from('items').select('id, name, quantity_in_store, unit');
      const { data: thresholds } = await supabase.from('department_thresholds').select('*').is('department_id', null);
      
      const thresholdMap = {};
      if (thresholds) {
        thresholds.forEach(t => { thresholdMap[t.item_id] = t.low_threshold || 0; });
      }
      
      const needsReorder = (invData || [])
        .filter(i => i.quantity_in_store <= (thresholdMap[i.id] || 0))
        .map(i => ({ ...i, threshold: thresholdMap[i.id] || 0 }));
        
      setReorderItems(needsReorder.slice(0, 5));

      setStats({
        activePOs: poCount || 0,
        itemsToReorder: needsReorder.length,
        suppliersCount: supplierCount || 0
      });

      // 3. Price History / Movements
      const { data: history } = await supabase
        .from('purchase_price_history')
        .select(`
          id, unit_cost, created_at,
          item:items(name, unit, unit_cost),
          supplier:suppliers(name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);
        
      setPriceMovements(history || []);
      
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page-content flex items-center justify-center"><div className="spinner"></div></div>;

  return (
    <div className="page-content">
      <div className="mb-6">
        <h2>Procurement Workspace</h2>
        <p>Manage purchasing, suppliers, and market prices.</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card flex items-center gap-4">
          <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--accent-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCart size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Active Purchase Orders</p>
            <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{stats.activePOs}</h3>
          </div>
        </div>
        
        <div className="card flex items-center gap-4">
          <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Central Items Below Par</p>
            <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{stats.itemsToReorder}</h3>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Truck size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Active Suppliers</p>
            <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{stats.suppliersCount}</h3>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        
        {/* Reorder Alerts */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={18} style={{ color: 'var(--text-secondary)' }} />
              Reorder Alerts (Central Store)
            </h3>
            <Link to="/procurement/purchase-orders" style={{ fontSize: '0.875rem', color: 'var(--accent-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', fontWeight: 500 }}>
              Create PO <ArrowRight size={16} style={{ marginLeft: '4px' }} />
            </Link>
          </div>
          <div style={{ flex: 1 }}>
            {reorderItems.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p>All central store items are above par levels.</p>
              </div>
            ) : (
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>Current Stock</th>
                    <th style={{ textAlign: 'right' }}>Par Level</th>
                  </tr>
                </thead>
                <tbody>
                  {reorderItems.map((item, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.unit}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--danger-color)' }}>
                        {item.quantity_in_store}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {item.threshold}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Purchases & Price Movements */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} style={{ color: 'var(--text-secondary)' }} />
              Recent Market Prices
            </h3>
            <Link to="/shared/history" style={{ fontSize: '0.875rem', color: 'var(--accent-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', fontWeight: 500 }}>
              View History <ArrowRight size={16} style={{ marginLeft: '4px' }} />
            </Link>
          </div>
          <div style={{ flex: 1 }}>
            {priceMovements.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p>No recent purchases recorded.</p>
              </div>
            ) : (
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Item & Date</th>
                    <th style={{ textAlign: 'right' }}>Price & Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {priceMovements.map((move, i) => {
                    const avgCost = move.item?.unit_cost || 0;
                    const variance = move.unit_cost - avgCost;
                    const isUp = variance > 0;
                    const isDown = variance < 0;
                    
                    return (
                      <tr key={i}>
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{move.item?.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {new Date(move.created_at).toLocaleDateString()} • {move.supplier?.name || 'Unknown Supplier'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>GHS {move.unit_cost?.toFixed(2)}</div>
                          <div style={{ 
                            fontSize: '0.75rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'flex-end',
                            color: isUp ? 'var(--danger-color)' : isDown ? 'var(--success-color)' : 'var(--text-secondary)'
                          }}>
                            {isUp ? <TrendingUp size={12} style={{ marginRight: '4px' }} /> : isDown ? <TrendingDown size={12} style={{ marginRight: '4px' }} /> : null}
                            {isUp || isDown ? `${Math.abs((variance / avgCost) * 100).toFixed(1)}% vs avg` : 'At average'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProcurementWorkspace;
