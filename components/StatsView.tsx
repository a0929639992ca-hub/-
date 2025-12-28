import React, { useMemo, useState, useEffect } from 'react';
import { ReceiptAnalysis } from '../types';
import { PieChart, ShoppingBag, Gift, Shirt, Pill, Smartphone, Utensils, Sparkles, Package, Calendar as CalendarIcon, Filter, Database, ShieldCheck, AlertCircle, Download, Upload, FileJson, BrainCircuit, Loader2, Quote } from 'lucide-react';
import { getStorageStats, exportHistoryData, importHistoryData } from '../services/historyService';
import { generateShoppingReport } from '../services/geminiService';

interface StatsViewProps {
  history: ReceiptAnalysis[];
  userId?: string;
  onDataRefresh?: (newHistory: ReceiptAnalysis[]) => void;
}

export const StatsView: React.FC<StatsViewProps> = ({ history, userId, onDataRefresh }) => {
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [storageDiagnostic, setStorageDiagnostic] = useState<any>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setStorageDiagnostic(getStorageStats(userId));
  }, [history, userId]);

  const handleGenerateAiReport = async () => {
    if (history.length === 0) return;
    setIsGenerating(true);
    try {
      const report = await generateShoppingReport(history);
      setAiReport(report);
    } catch (err) {
      alert("生成報告失敗");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => { /* ... (同之前) ... */ };
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... (同之前) ... */ };

  const getCategoryStyle = (category: string) => {
    if (category.includes('精品') || category.includes('香氛')) return { icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-100', bar: 'bg-purple-500' };
    if (category.includes('伴手禮')) return { icon: Gift, color: 'text-pink-500', bg: 'bg-pink-100', bar: 'bg-pink-500' };
    if (category.includes('美妝') || category.includes('藥品') || category.includes('保健')) return { icon: Pill, color: 'text-red-500', bg: 'bg-red-100', bar: 'bg-red-500' };
    if (category.includes('食品') || category.includes('調味')) return { icon: Utensils, color: 'text-orange-500', bg: 'bg-orange-100', bar: 'bg-orange-500' };
    if (category.includes('零食')) return { icon: Package, color: 'text-amber-500', bg: 'bg-amber-100', bar: 'bg-amber-500' };
    if (category.includes('服飾') || category.includes('配件')) return { icon: Shirt, color: 'text-blue-500', bg: 'bg-blue-100', bar: 'bg-blue-500' };
    if (category.includes('3C') || category.includes('家電')) return { icon: Smartphone, color: 'text-cyan-500', bg: 'bg-cyan-100', bar: 'bg-cyan-500' };
    return { icon: ShoppingBag, color: 'text-slate-500', bg: 'bg-slate-100', bar: 'bg-slate-500' };
  };

  const stats = useMemo(() => {
    const filteredHistory = history.filter(receipt => {
      const receiptDate = receipt.date;
      return receiptDate >= startDate && receiptDate <= endDate;
    });
    const totalSpent = filteredHistory.reduce((sum, item) => sum + item.totalTwd, 0);
    const totalJpy = filteredHistory.reduce((sum, item) => sum + (item.totalJpy || 0), 0);
    const categoryMap: Record<string, number> = {};
    filteredHistory.forEach(receipt => {
      receipt.items.forEach(item => {
        const cat = item.category || '其他';
        categoryMap[cat] = (categoryMap[cat] || 0) + item.priceTwd;
      });
    });
    const categories = Object.entries(categoryMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
        ...getCategoryStyle(name)
      }))
      .sort((a, b) => b.amount - a.amount);
    return { totalSpent, totalJpy, categories, count: filteredHistory.length };
  }, [history, startDate, endDate]);

  return (
    <div className="w-full max-w-md mx-auto pb-24 px-4 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <PieChart className="w-6 h-6 text-indigo-600" />
            收支統計
        </h2>
      </div>

      {/* Member Exclusive AI Section */}
      <div className="mb-8 p-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl shadow-xl shadow-indigo-100">
          <div className="bg-white rounded-[22px] p-5 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                  <BrainCircuit className="w-16 h-16" />
              </div>
              
              <div className="flex items-center gap-2 mb-3">
                  <span className="bg-indigo-600 text-[9px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">Account Only</span>
                  <h3 className="text-sm font-bold text-slate-800">AI 旅日消費分析報告</h3>
              </div>

              {!userId ? (
                  <div className="bg-slate-50 p-4 rounded-xl text-center border border-dashed border-slate-200">
                      <p className="text-xs text-slate-500 mb-3">登入帳號後，即可透過 Gemini 分析您的購物性格</p>
                      <button disabled className="px-4 py-2 bg-slate-200 text-slate-400 rounded-full text-xs font-bold">登入後解鎖</button>
                  </div>
              ) : (
                  <div>
                      {aiReport ? (
                          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 relative">
                                  <Quote className="absolute top-2 left-2 w-4 h-4 text-indigo-200" />
                                  <p className="text-xs text-slate-700 leading-relaxed italic whitespace-pre-wrap pl-4">
                                      {aiReport}
                                  </p>
                              </div>
                              <button 
                                onClick={handleGenerateAiReport}
                                disabled={isGenerating}
                                className="w-full py-2 border border-indigo-200 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                              >
                                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
                                重新分析
                              </button>
                          </div>
                      ) : (
                          <div className="text-center py-4">
                              <p className="text-xs text-slate-400 mb-4">Gemini 將分析您帳號下的 {history.length} 筆明細，為您量身打造消費建議。</p>
                              <button 
                                onClick={handleGenerateAiReport}
                                disabled={isGenerating || history.length === 0}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-full text-sm font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2 mx-auto disabled:bg-slate-200 disabled:shadow-none"
                              >
                                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                                生成我的 AI 性格報告
                              </button>
                          </div>
                      )}
                  </div>
              )}
          </div>
      </div>

      {/* Grand Total Card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl mb-8">
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">區間總花費 (NTD)</p>
        <div className="flex items-baseline gap-1">
            <span className="text-lg opacity-80">NT$</span>
            <span className="text-4xl font-bold font-mono tracking-tight">{stats.totalSpent.toLocaleString()}</span>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-4 mb-12">
          {stats.categories.map((cat) => {
              const Icon = cat.icon;
              return (
                  <div key={cat.name} className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center`}>
                                  <Icon className={`w-4 h-4 ${cat.color}`} />
                              </div>
                              <span className="font-bold text-slate-700 text-sm">{cat.name}</span>
                          </div>
                          <span className="font-bold text-slate-800 text-sm">${cat.amount.toLocaleString()}</span>
                      </div>
                  </div>
              );
          })}
      </div>

      {/* Backup Section */}
      <div className="mt-8 bg-indigo-50 border border-indigo-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
              <FileJson className="w-4 h-4 text-indigo-600" />
              <h4 className="text-sm font-bold text-slate-800">iCloud 備份與還原</h4>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
              <button onClick={handleExport} className="flex items-center justify-center gap-2 bg-white border border-indigo-200 text-indigo-600 py-3 rounded-xl text-xs font-bold shadow-sm">
                  <Download className="w-3.5 h-3.5" /> 備份
              </button>
              <label className="flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl text-xs font-bold shadow-sm cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> 還原
                  <input type="file" accept=".json" className="hidden" onChange={handleImport} />
              </label>
          </div>
      </div>
    </div>
  );
};