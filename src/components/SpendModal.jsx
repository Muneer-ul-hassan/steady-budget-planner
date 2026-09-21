import { useState } from 'react';
import { X } from 'lucide-react';
import { db } from '../lib/db';

export default function SpendModal({ onClose, profile }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  
  const currency = profile?.currency || '$';

  const handleAdd = async (amt) => {
    const val = parseFloat(amt || amount);
    if (isNaN(val) || val <= 0) return;

    await db.spends.add({
      amount: val,
      category: category || 'Uncategorized',
      note: note,
      date: new Date().toISOString(),
      account: 'Checking'
    });
    
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl">Log a spend</h2>
          <button onClick={onClose} className="btn-ghost rounded-full bg-[#f7f5ef] p-2">
            <X size={20} />
          </button>
        </div>

        <div className="mb-6">
          <label className="text-xs text-secondary uppercase tracking-widest font-medium mb-2 block">How much</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-secondary">{currency}</span>
            <input 
              type="number" 
              className="w-full text-2xl pl-10 py-4 bg-[#f7f5ef] border-none rounded-2xl" 
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-6">
          <button className="btn btn-secondary py-3 text-sm" onClick={() => handleAdd(1)}>+1</button>
          <button className="btn btn-secondary py-3 text-sm" onClick={() => handleAdd(5)}>+5</button>
          <button className="btn btn-secondary py-3 text-sm" onClick={() => handleAdd(10)}>+10</button>
          <button className="btn btn-secondary py-3 text-sm" onClick={() => handleAdd(20)}>+20</button>
        </div>

        <div className="mb-4">
          <label className="text-xs text-secondary uppercase tracking-widest font-medium mb-2 block">What kind</label>
          <select 
            className="w-full py-4 px-4 bg-[#f7f5ef] border-none rounded-2xl appearance-none"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Pick a category...</option>
            <option value="Groceries">Groceries</option>
            <option value="Eating Out">Eating Out</option>
            <option value="Transport">Transport</option>
            <option value="Fun">Fun</option>
          </select>
        </div>

        <div className="mb-8">
          <input 
            type="text" 
            className="w-full py-4 px-4 bg-[#f7f5ef] border-none rounded-2xl" 
            placeholder="Add a note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <button className="btn btn-primary w-full py-4 text-lg" onClick={() => handleAdd()}>
          Add to today
        </button>
      </div>
    </div>
  );
}
