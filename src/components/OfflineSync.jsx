import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, CloudOff, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getOfflineSales, dequeueOfflineSale } from '../lib/offlineQueue';

const OfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Network status listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync logic
  useEffect(() => {
    const syncOfflineData = async () => {
      try {
        const queue = await getOfflineSales();
        setPendingCount(queue.length);

        if (queue.length === 0 || !isOnline || syncing) return;

        setSyncing(true);
        for (const record of queue) {
          // Attempt to send to Supabase
          const { error } = await supabase.rpc('process_sales_entry_rpc', {
            p_client_uuid: record.id, // client_uuid acts as idempotency key
            p_department_id: record.department_id,
            p_sales: record.sales_payload
          });

          // If the error is a unique constraint violation (code 23505), it means the transaction 
          // already exists (idempotency caught it), so we safely remove it from the queue.
          // Otherwise, if it's a real network error, it will throw and stop the loop.
          if (error && error.code !== '23505') {
            throw error;
          }

          // Successfully synced or duplicate handled, remove from local queue
          await dequeueOfflineSale(record.id);
          setPendingCount(prev => prev - 1);
        }
      } catch (err) {
        console.error("Offline sync interrupted:", err);
      } finally {
        setSyncing(false);
      }
    };

    // Run immediately when coming online
    if (isOnline) {
      syncOfflineData();
    }

    // Poll every 10 seconds just in case
    const interval = setInterval(syncOfflineData, 10000);
    return () => clearInterval(interval);
  }, [isOnline, syncing]);

  if (!isOnline || pendingCount > 0) {
    return (
      <div className={`fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border z-50 transition-all ${isOnline ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
        {isOnline ? (
          syncing ? <Loader2 size={20} className="animate-spin text-amber-600" /> : <CloudOff size={20} className="text-amber-600" />
        ) : (
          <WifiOff size={20} className="text-red-600" />
        )}
        <div className="flex flex-col">
          <span className="font-bold text-sm">
            {!isOnline ? 'Offline Mode Active' : syncing ? 'Syncing to Server...' : 'Pending Offline Data'}
          </span>
          <span className="text-xs opacity-80">
            {pendingCount} record{pendingCount !== 1 ? 's' : ''} waiting to sync
          </span>
        </div>
      </div>
    );
  }

  return null;
};

export default OfflineSync;
