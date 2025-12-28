import React from 'react';
import { ReceiptAnalysis } from '../types';
import { Trash2, ShoppingBag, Clock, Cloud, Check, Loader2 } from 'lucide-react';
import { deleteFromHistory } from '../services/historyService';

interface HistoryListProps {
  history: ReceiptAnalysis[];
  onSelect: (item: ReceiptAnalysis) => void;
  onUpdateHistory: (newHistory: ReceiptAnalysis[]) => void;
  onBack: () => void;
  isSyncing?: boolean;
}

export const HistoryList: React.FC<HistoryListProps> = ({ history, onSelect, onUpdateHistory, onBack, isSyncing }) => {
  
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('確定要刪除這筆紀錄嗎？雲端備份也將同步刪除。')) {
      const updated = deleteFromHistory(id);
      onUpdateHistory(updated);
    }
  };

  const getStoreName = (item: ReceiptAnalysis) => {
    const firstItem = item.items.find(i => i.store && i.store !== '未知');
    return firstItem ? firstItem.store : 'Store';
  };

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-6 px-2">
        <h2 className="text-xl font-bold text-slate-800">歷史消費紀錄</h2>
        <div className="flex items-center gap-2">
            {isSyncing && <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />}
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">共 {history.length} 筆</span>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
            <ShoppingBag className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-base font-bold text-slate-700 mb-1">目前沒有紀錄</h3>
          <button onClick={onBack} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-full text-sm font-bold shadow-lg">去掃描</button>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((record) => (
            <div 
              key={record.id}
              onClick={() => onSelect(record)}
              className="group bg-white rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 hover:border-indigo-300 transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white bg-indigo-500 px-1.5 py-0.5 rounded-md font-mono">
                              {record.date.slice(5)}
                          </span>
                           {record.time && (
                            <span className="text-xs font-medium text-slate-500 font-mono flex items-center gap-0.5">
                                <Clock className="w-3 h-3" /> {record.time}
                            </span>
                          )}
                          {record.userId && (
                              <div className="flex items-center text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                <Cloud className="w-2.5 h-2.5 mr-1" />
                                雲端同步
                              </div>
                          )}
                      </div>
                      <div className="text-sm font-bold text-slate-700 truncate max-w-[140px]">{getStoreName(record)}</div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3" /> {record.items.length} 筆商品
                      </span>
                  </div>

                  <div className="flex flex-col items-end">
                      <div className="text-lg font-bold text-slate-800 font-mono">NT$ {record.totalTwd.toLocaleString()}</div>
                      {record.totalJpy && <div className="text-[10px] text-slate-400 font-mono">¥{record.totalJpy.toLocaleString()}</div>}
                  </div>
              </div>
                
              <button
                  onClick={(e) => handleDelete(e, record.id!)}
                  className="absolute bottom-2 right-2 p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                  <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};