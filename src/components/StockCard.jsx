import React from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import './StockCard.css';

const StockCard = ({ item }) => {
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
          <div className="progress-labels">
            <span>0</span>
            <span>{referenceMax} (Max)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockCard;
