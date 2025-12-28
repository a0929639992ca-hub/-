import React, { useMemo, useState, useEffect } from 'react';
import { ReceiptAnalysis } from '../types';
import { PieChart, ShoppingBag, Gift, Shirt, Pill, Smartphone, Utensils, Sparkles, Package, Calendar as CalendarIcon, Filter, Database, Download, Upload, FileJson, BrainCircuit, Loader2, Quote, ChevronRight } from 'lucide-react';
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
      alert("生成報告失敗，請稍後再試。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    try {
      const jsonData = exportHistoryData();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const fileName = `JapanBackup_${new Date().toISOString().split('T')[0]}.json`;
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
        alert('匯入失敗，請檢查檔案格式。');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const getCategoryStyle = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes('精品') || c.includes('香氛')) return { icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-50', bar: 'bg-purple-500' };
    if (c.includes('伴手禮')) return { icon: Gift, color: 'text-pink-500', bg: 'bg-pink-50', bar: 'bg-pink-500' };
    if (c.includes('美妝') || c.includes('藥妝') || c.includes('保養')) return { icon: Pill, color: 'text-rose-500', bg: 'bg-rose-50', bar: 'bg-rose-500' };
    if (c.includes('藥品') || c.includes('保健')) return { icon: Pill, color: 'text-red-500', bg: 'bg-red-50', bar: 'bg-red-500' };
    if (c.includes('食品') || c.includes('調味') || c.includes('美食')) return { icon: Utensils, color: 'text-orange-500', bg: 'bg-orange-50', bar: 'bg-orange-500' };
    if (c.includes('零食')) return { icon: Package, color: 'text-amber-500', bg: 'bg-amber-50', bar: 'bg-amber-500' };
    if (c.includes('服飾') || c.includes('配件')) return { icon: Shirt, color: 'text-blue-500', bg: 'bg-blue-50', bar: 'bg-blue-500' };
    if (c.includes('3c') || c.includes('家電')) return { icon: Smartphone, color: 'text-cyan-500', bg: 'bg-cyan-50', bar: 'bg-cyan-500' };
    return { icon: ShoppingBag, color: 'text-slate-500', bg: 'bg-slate-50', bar: 'bg-slate-400' };
  };

  const stats = useMemo(() => {
    const filteredHistory = history.filter(receipt => {
      const receiptDate = receipt.date;
      return receiptDate >= startDate && receiptDate <= endDate;
    });

    const totalSpent = filteredHistory.reduce((sum, item) => sum + (item.totalTwd || 0), 0);
    const totalJpy = filteredHistory.reduce((sum, item) => sum + (item.totalJpy || 0), 0);
    
    const categoryMap: Record<string, number> = {};
    filteredHistory.forEach(receipt => {
      receipt.items.forEach(item => {
        const cat = item.category || '其他';
        categoryMap[cat] = (categoryMap[cat] || 0) + (item.priceTwd || 0);
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
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
            <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="text-[10px] font-bold text-slate-600 focus:outline-none bg-transparent"
            />
            <span className="text-slate-300 text-[10px]">-</span>
            <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="text-[10px] font-bold text-slate-600 focus:outline-none bg-transparent"
            />
        </div>
      </div>

      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">區間消費總額</p>
        <div className="flex items-baseline gap-1 font-mono text-4xl font-bold tracking-tight mb-2">
            <span className="text-lg opacity-80 text-indigo-400">NT$</span> {stats.totalSpent.toLocaleString()}
        </div>
        <div className="flex justify-between items-center pt-4 border-t border-white/10">
            <div className="text-xs text-slate-400 font-mono">¥ {stats.totalJpy.toLocaleString()}</div>
            <div className="text-xs text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md">{stats.count} 筆交易</div>
        </div>
      </div>

      {/* AI Analysis Section */}
      <div className="mb-8 p-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl shadow-xl shadow-indigo-100">
          <div className="bg-white rounded-[22px] p-5">
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-800">AI 旅日消費分析</h3>
                  </div>
                  {!userId && (
                      <span className="bg-amber-100 text-amber-600 text-[8px] font-bold px-2 py-0.5 rounded-full">需登入使用</span>
                  )}
              </div>

              {userId ? (
                  aiReport ? (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 relative">
                              <Quote className="absolute top-2 left-2 w-4 h-4 text-indigo-200" />
                              <p className="text-xs text-slate-700 leading-relaxed italic whitespace-pre-wrap pl-4">{aiReport}</p>
                          </div>
                          <button onClick={handleGenerateAiReport} disabled={isGenerating} className="w-full py-2.5 border border-indigo-200 text-indigo-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:bg-indigo-50 transition-colors">
                            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} 重新分析
                          </button>
                      </div>
                  ) : (
                      <div className="text-center py-4">
                          <p className="text-xs text-slate-400 mb-4 px-4 leading-relaxed">Gemini 將根據您的購物清單，分析您的消費傾向並提供幽默建議。</p>
                          <button onClick={handleGenerateAiReport} disabled={isGenerating || history.length === 0} className="px-8 py-3 bg-indigo-600 text-white rounded-full text-sm font-bold shadow-lg flex items-center justify-center gap-2 mx-auto disabled:bg-slate-200 active:scale-95 transition-transform">
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} 生成性格分析
                          </button>
                      </div>
                  )
              ) : (
                  <div className="bg-slate-50 p-6 rounded-xl text-center border border-dashed border-slate-200">
                      <p className="text-xs text-slate-500">登入帳號後，即可透過 Gemini 進行進階消費性格分析。</p>
                  </div>
              )}
          </div>
      </div>

      {/* Category List and Bars */}
      <div className="space-y-6 mb-8">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 px-1">
            <Filter className="w-4 h-4 text-slate-400" /> 消費類別佔比
        </h3>
        
        {stats.categories.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-400">目前選擇的區間內沒有消費資料</p>
            </div>
        ) : (
            <div className="space-y-4">
                {stats.categories.map((cat, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-center mb-2.5">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${cat.bg}`}>
                                    <cat.icon className={`w-4 h-4 ${cat.color}`} />
                                </div>
                                <span className="text-sm font-bold text-slate-700">{cat.name}</span>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold text-slate-800 font-mono">NT$ {cat.amount.toLocaleString()}</div>
                                <div className="text-[10px] text-slate-400 font-bold">{cat.percentage.toFixed(1)}%</div>
                            </div>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className={`h-full ${cat.bar} rounded-full transition-all duration-1000`} 
                                style={{ width: `${cat.percentage}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Diagnostics and Backup */}
      <div className="grid grid-cols-1 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                  <Database className="w-4 h-4 text-slate-400" />
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">系統儲存診斷</h4>
              </div>
              <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                      <span className="text-slate-400">模式</span>
                      <span className="font-bold text-slate-700">{storageDiagnostic?.mode}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                      <span className="text-slate-400">資料版本</span>
                      <span className="font-bold text-slate-700">{storageDiagnostic?.version}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                      <span className="text-slate-400">佔用空間</span>
                      <span className="font-bold text-slate-700">{storageDiagnostic?.sizeKb} KB</span>
                  </div>
              </div>
          </div>

          <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-bold text-slate-800">資料備份與還原</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleExport} className="flex items-center justify-center gap-2 bg-white border border-indigo-200 text-indigo-600 py-3 rounded-xl text-xs font-bold active:bg-indigo-100 transition-colors">
                      <Download className="w-3.5 h-3.5" /> 匯出備份
                  </button>
                  <label className="flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl text-xs font-bold shadow-md cursor-pointer active:bg-indigo-700">
                      <Upload className="w-3.5 h-3.5" /> 匯入還原
                      <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                  </label>
              </div>
          </div>
      </div>
    </div>
  );
};

const RefreshCw = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
);
