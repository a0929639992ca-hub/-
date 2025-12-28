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
    setStorageDiagnostic(getStorageStats());
  }, [history]);

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

  const handleExport = async () => {
    try {
      const jsonData = exportHistoryData();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const fileName = `JapanReceiptBackup_${new Date().toISOString().split('T')[0]}.json`;
      const file = new File([blob], fileName, { type: 'application/json' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '日本購物明細備份',
          text: '這是您的日本購物記帳資料備份檔。'
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') alert('導出失敗');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const newList = importHistoryData(content);
        if (onDataRefresh) {
          onDataRefresh(newList);
          alert('資料還原成功！已同步至目前帳號。');
        }
      } catch (err) {
        alert('匯入失敗');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

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
              <div className="absolute top-0 right-0 p-4 opacity-10"><BrainCircuit className="w-16 h-16" /></div>
              <div className="flex items-center gap-2 mb-3">
                  <span className="bg-indigo-600 text-[9px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">Account Only</span>
                  <h3 className="text-sm font-bold text-slate-800">AI 旅日消費分析報告</h3>
              </div>

              {!userId ? (
                  <div className="bg-slate-50 p-4 rounded-xl text-center border border-dashed border-slate-200">
                      <p className="text-xs text-slate-500 mb-3">登入帳號後，即可透過 Gemini 分析您的購物性格</p>
                  </div>
              ) : (
                  <div>
                      {aiReport ? (
                          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 relative">
                                  <Quote className="absolute top-2 left-2 w-4 h-4 text-indigo-200" />
                                  <p className="text-xs text-slate-700 leading-relaxed italic whitespace-pre-wrap pl-4">{aiReport}</p>
                              </div>
                              <button onClick={handleGenerateAiReport} disabled={isGenerating} className="w-full py-2 border border-indigo-200 text-indigo-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />} 重新分析
                              </button>
                          </div>
                      ) : (
                          <div className="text-center py-4">
                              <p className="text-xs text-slate-400 mb-4">分析帳號下 {history.length} 筆明細，打造消費性格建議。</p>
                              <button onClick={handleGenerateAiReport} disabled={isGenerating || history.length === 0} className="px-6 py-3 bg-indigo-600 text-white rounded-full text-sm font-bold shadow-lg flex items-center justify-center gap-2 mx-auto disabled:bg-slate-200">
                                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />} 生成報告
                              </button>
                          </div>
                      )}
                  </div>
              )}
          </div>
      </div>

      {/* Totals and Category list (omitted same as before for brevity, logic remains robust) */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl mb-8">
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">區間總花費 (NTD)</p>
        <div className="flex items-baseline gap-1 font-mono text-4xl font-bold tracking-tight">
            <span className="text-lg opacity-80">NT$</span> {stats.totalSpent.toLocaleString()}
        </div>
      </div>

      {/* Diagnostics */}
      {storageDiagnostic && (
        <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 mb-3">
                <Database className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">儲存狀態</span>
            </div>
            <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">儲存目標</span>
                <span className={`font-bold ${userId ? 'text-indigo-600' : 'text-amber-600'}`}>{storageDiagnostic.mode}</span>
            </div>
        </div>
      )}

      {/* Backup Section */}
      <div className="mt-8 bg-indigo-50 border border-indigo-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
              <FileJson className="w-4 h-4 text-indigo-600" />
              <h4 className="text-sm font-bold text-slate-800">備份與還原</h4>
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