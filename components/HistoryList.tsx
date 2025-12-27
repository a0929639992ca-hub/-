import React from 'react';
import { ReceiptAnalysis } from '../types';
import { Calendar, Trash2, ArrowRight, ShoppingBag, Store, Clock } from 'lucide-react';
import { deleteFromHistory } from '../services/historyService';

interface HistoryListProps {
  history: ReceiptAnalysis[];
  onSelect: (item: ReceiptAnalysis) => void;
  onUpdateHistory: (newHistory: ReceiptAnalysis[]) => void;
  onBack: () => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({ history, onSelect, onUpdateHistory, onBack }) => {
  
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('確定要刪除這筆紀錄嗎？')) {
      const updated = deleteFromHistory(id);
      onUpdateHistory(updated);
    }
  };

  // Group items just for display logic (e.g. get unique store names)
  const getStoreName = (item: ReceiptAnalysis) => {
    // Find the most frequent store name or just pick the first valid one
    const firstItem = item.items.find(i => i.store && i.store !== '未知');
    return firstItem ? firstItem.store : '日本商店';
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-indigo-600" />
          <span>歷史消費紀錄</span>
        </h2>
        <button 
          onClick={onBack}
          className="text-sm font-medium text-slate-500 hover:text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"
        >
          返回首頁
        </button>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
          <div className="bg-slate-50 p-4 rounded-full mb-4">
            <ShoppingBag className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">目前沒有歷史紀錄</p>
          <p className="text-xs text-slate-400 mt-1">分析完成的收據會自動儲存於此</p>
          <button 
             onClick={onBack}
             className="mt-6 text-indigo-600 font-medium hover:underline"
          >
             去掃描第一張收據
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {history.map((record) => (
            <div 
              key={record.id}
              onClick={() => onSelect(record)}
              className="group bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    {/* Receipt Date Tag */}
                    <div className="flex items-center gap-1.5 text-slate-600 text-xs font-bold bg-slate-100 px-2 py-1 rounded">
                        <Calendar className="w-3 h-3" />
                        {record.date}
                    </div>
                    {/* Scan Time - Only show if available */}
                    {record.timestamp && (
                        <div className="flex items-center gap-1 text-slate-400 text-[10px] font-medium">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(record.timestamp)}
                        </div>
                    )}
                </div>
                
                <button
                  onClick={(e) => handleDelete(e, record.id!)}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 text-slate-700 font-medium mb-1">
                   <Store className="w-4 h-4 text-indigo-400" />
                   {getStoreName(record)}
                </div>
                <div className="text-2xl font-bold text-slate-900 font-mono">
                  NT$ {record.totalTwd.toLocaleString()}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 group-hover:border-indigo-50 transition-colors">
                <span>{record.items.length} 筆商品</span>
                <div className="flex items-center gap-1 text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                   查看明細 <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};