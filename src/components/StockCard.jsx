import React, { useState } from 'react';
import { Package, AlertTriangle, Edit2, Check, X } from 'lucide-react';
import './StockCard.css';

const StockCard = ({ item, isStoreManager, onUpdateThreshold }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(item.low_stock_threshold);
  const [updating, setUpdating] = useState(false);

  const isLowStock = item.quantity_in_store <= item.low_stock_threshold;
  
  // To answer the open question, we'll dynamically use 2x the low stock threshold as the visual max, 
  // or the current stock if it's somehow higher.
  const referenceMax = Math.max(item.low_stock_threshold * 3, item.quantity_in_store, 100);
  const percent = Math.min((item.quantity_in_store / referenceMax) * 100, 100);

  return (
    <div className={`card stock-card ${isLowStock ? 'low-stock' : ''}`}>
      <div className="stock-card-header">
        <div className="stock-icon-wrapper">
          <Package size={20} className="stock-icon" />
        </div>
        {isLowStock && (
          <div className="warning-badge" title="Low Stock">
            <AlertTriangle size={16} />
            <span>Low Stock</span>
          </div>
        )}
      </div>
      
      <div className="stock-card-body">
        <h3 className="item-name">{item.name}</h3>
        <p className="item-category">{item.category}</p>
        
        <div className="stock-amount">
          <span className="amount">{item.quantity_in_store}</span>
          <span className="unit">{item.unit}</span>
        </div>
        
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className={`progress-fill ${isLowStock ? 'low' : ''}`}
              style={{ width: `${percent}%` }}
            ></div>
          </div>
          <div className="progress-labels flex justify-between items-center" style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>0</span>
            
            {isEditing ? (
              <div className="flex items-center gap-1">
                <span>Threshold:</span>
                <input 
                  type="number" 
                  className="form-input" 
                  style={{ width: '60px', padding: '0.1rem 0.2rem', height: '24px', fontSize: '0.75rem' }} 
                  value={thresholdInput}
                  onChange={e => setThresholdInput(e.target.value)}
                  disabled={updating}
                  min="0"
                />
                <button 
                  className="btn btn-outline p-0" 
                  style={{ width: '24px', height: '24px' }}
                  onClick={async () => {
                    setUpdating(true);
                    await onUpdateThreshold(item.id, parseFloat(thresholdInput));
                    setIsEditing(false);
                    setUpdating(false);
                  }}
                  disabled={updating}
                >
                  <Check size={14} className="text-green-500" />
                </button>
                <button 
                  className="btn btn-outline p-0" 
                  style={{ width: '24px', height: '24px' }}
                  onClick={() => {
                    setIsEditing(false);
                    setThresholdInput(item.low_stock_threshold);
                  }}
                  disabled={updating}
                >
                  <X size={14} className="text-red-500" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span title="Low Stock Threshold">Threshold: {item.low_stock_threshold}</span>
                {isStoreManager && (
                  <button 
                    className="btn btn-outline p-0 border-0 text-blue-500 hover:bg-blue-50"
                    style={{ width: '20px', height: '20px' }}
                    onClick={() => setIsEditing(true)}
                    title="Edit Threshold"
                  >
                    <Edit2 size={12} />
                  </button>
                )}
                <span style={{ marginLeft: '1rem' }}>{referenceMax} (Max)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockCard;
