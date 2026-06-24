import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Package, ArrowDownToLine, FileText, AlertTriangle } from 'lucide-react';

const Overview = () => {
  const [stats, setStats] = useState({
    totalItems: 0,
    totalReceived: 0,
    pendingReqs: 0,
    discrepancies: 0
  });
  const [stockData, setStockData] = useState([]);
  const [receivedData, setReceivedData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // 1. Stats
        const { count: totalItems } = await supabase.from('items').select('*', { count: 'exact', head: true });
        
        const { data: receipts } = await supabase.from('goods_receipts').select('quantity_received');
        const totalReceived = receipts?.reduce((acc, curr) => acc + parseFloat(curr.quantity_received), 0) || 0;

        const { count: pendingReqs } = await supabase.from('requisitions').select('*', { count: 'exact', head: true }).eq('status', 'Pending');
        
        const { data: reqItems } = await supabase.from('requisition_items').select('quantity_dispatched, quantity_confirmed').not('quantity_confirmed', 'is', null);
        const discrepancies = reqItems?.filter(i => parseFloat(i.quantity_dispatched) !== parseFloat(i.quantity_confirmed)).length || 0;

        setStats({ totalItems, totalReceived, pendingReqs, discrepancies });

        // 2. Stock Bar Chart
        const { data: items } = await supabase.from('items').select('name, quantity_in_store');
        setStockData(items || []);

        // 3. Line Chart (Goods received last 8 weeks)
        // For simplicity in this demo, we'll group receipts by date_received
        const { data: recentReceipts } = await supabase
          .from('goods_receipts')
          .select('date_received, quantity_received')
          .order('date_received', { ascending: true });
          
        const grouped = {};
        recentReceipts?.forEach(r => {
          const date = r.date_received;
          grouped[date] = (grouped[date] || 0) + parseFloat(r.quantity_received);
        });
        
        const lineData = Object.keys(grouped).map(date => ({
          date,
          amount: grouped[date]
        }));
        setReceivedData(lineData);

      } catch (error) {
        console.error('Error fetching auditor overview:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  if (loading) return <div className="spinner mt-10 mx-auto"></div>;

  return (
    <div className="auditor-overview-page">
      <div className="mb-6">
        <h2>Dashboard Overview</h2>
        <p>High-level metrics and inventory tracking.</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-full" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-color)' }}>
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Items</p>
            <h3 className="text-2xl font-bold m-0">{stats.totalItems}</h3>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-full" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)' }}>
            <ArrowDownToLine size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Goods Received</p>
            <h3 className="text-2xl font-bold m-0">{stats.totalReceived.toLocaleString()}</h3>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-full" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning-color)' }}>
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Pending Reqs</p>
            <h3 className="text-2xl font-bold m-0">{stats.pendingReqs}</h3>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-full" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Discrepancies</p>
            <h3 className="text-2xl font-bold m-0">{stats.discrepancies}</h3>
          </div>
        </div>
      </div>

      <div className="grid gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <h3 className="mb-4">Current Stock Levels</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)' }} />
                <Bar dataKey="quantity_in_store" fill="var(--accent-color)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4">Goods Received Trend</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={receivedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)' }} />
                <Line type="monotone" dataKey="amount" stroke="var(--success-color)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
