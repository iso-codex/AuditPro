import React from 'react';
import { Package } from 'lucide-react';
import './StockCard.css';

const StockCard = ({ item }) => {

  return (
    <div className="card stock-card">
      <div className="stock-card-header">
        <div className="stock-icon-wrapper">
          <Package size={20} className="stock-icon" />
        </div>
      </div>
      
      <div className="stock-card-body">
        <h3 className="item-name">{item.name}</h3>
        <p className="item-category">{item.category}</p>
        
        <div className="stock-amount">
          <span className="amount">{item.quantity_in_store}</span>
          <span className="unit">{item.unit}</span>
        </div>
      </div>
    </div>
  );
};

export default StockCard;
