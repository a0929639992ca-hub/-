import React, { useMemo, useState } from 'react';
import { ReceiptAnalysis } from '../types';
import { PieChart, ShoppingBag, Gift, Shirt, Pill, Smartphone, Utensils, Sparkles, Package, Calendar as CalendarIcon, Filter } from 'lucide-react';

interface StatsViewProps {
  history: ReceiptAnalysis[];
}

export const StatsView: React.FC<StatsViewProps> = ({ history }) => {
  // Date Range State
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);

  // Helper to map category names to Icons and Colors
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

  // Aggregation Logic with Filter
  const stats = useMemo(() => {
    const filteredHistory = history.filter(receipt => {
      const receiptDate = receipt.date; // YYYY-MM-DD
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
        <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full uppercase tracking-wider">
            {stats.count} 筆明細
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-500">日期區間篩選</span>
        </div>
        <div className="flex items-center gap-3">
            <div className="flex-1">
                <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 outline-none"
                />
            </div>
            <div className="text-slate-300">至</div>
            <div className="flex-1">
                <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 outline-none"
                />
            </div>
        </div>
      </div>

      {/* Grand Total Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
            <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-1">區間總花費 (NTD)</p>
            <div className="flex items-baseline gap-1">
                <span className="text-lg opacity-80">NT$</span>
                <span className="text-4xl font-bold font-mono tracking-tight">{stats.totalSpent.toLocaleString()}</span>
            </div>
            <p className="text-indigo-200 text-xs mt-2 font-mono">
                約 ¥{stats.totalJpy.toLocaleString()}
            </p>
        </div>
      </div>

      {/* Category Breakdown */}
      {stats.categories.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
             <CalendarIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
             <p className="text-sm">此日期區間尚無紀錄</p>
          </div>
      ) : (
        <div className="space-y-6">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">分類消費佔比</h3>
            <div className="space-y-4">
                {stats.categories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                        <div key={cat.name} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center`}>
                                        <Icon className={`w-4 h-4 ${cat.color}`} />
                                    </div>
                                    <span className="font-bold text-slate-700 text-sm">{cat.name}</span>
                                </div>
                                <div className="text-right">
                                    <span className="block font-bold text-slate-800 text-sm">
                                        ${cat.amount.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        {cat.percentage.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full ${cat.bar}`} 
                                    style={{ width: `${cat.percentage}%` }}
                                ></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      )}
    </div>
  );
};