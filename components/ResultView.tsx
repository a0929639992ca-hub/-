import React, { useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, Receipt, Calculator, Calendar, TrendingUp, Download, Loader2, Share2 } from 'lucide-react';
import { ReceiptAnalysis, ReceiptItem } from '../types';
import { toBlob } from 'html-to-image';

interface ResultViewProps {
  originalImage: string;
  data: ReceiptAnalysis;
  onRetake: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({ originalImage, data, onRetake }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  
  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, ReceiptItem[]> = {};
    data.items.forEach(item => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [data.items]);

  const categories = Object.keys(groupedItems);

  // Helper to trigger download for desktop
  const downloadBlob = (blob: Blob, fileName: string) => {
    const dataUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
    URL.revokeObjectURL(dataUrl);
  };

  const handleSaveImage = useCallback(async () => {
    if (!contentRef.current) return;
    
    try {
      setIsSaving(true);
      // Create a small delay to ensure UI updates are processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cast options to any to avoid TypeScript error with onClone which is supported but sometimes missing in types
      const options: any = {
        cacheBust: true,
        backgroundColor: '#f8fafc', // slate-50
        filter: (node: any) => {
          // Exclude elements marked with data-hide-on-save (like buttons)
          if (node instanceof HTMLElement && node.hasAttribute('data-hide-on-save')) {
            return false;
          }
          return true;
        },
        // IMPORTANT: Reveal the hidden footer in the generated image
        onClone: (clonedNode: any) => {
          const node = clonedNode as HTMLElement;
          const footer = node.querySelector('#receipt-footer-image') as HTMLElement;
          if (footer) {
             footer.style.display = 'flex';
             footer.classList.remove('hidden');
          }
        }
      };

      const blob = await toBlob(contentRef.current, options);

      if (!blob) throw new Error('Image generation failed');

      const fileName = `japan-shopping-${data.date}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // Support native sharing (iOS "Save Image" to Photos)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: '日本購物明細',
            text: `消費日期: ${data.date} - 總金額: NT$${data.totalTwd}`
          });
        } catch (err) {
          // If user cancels share (AbortError), do nothing. 
          // If other error, fallback to download.
          if ((err as Error).name !== 'AbortError') {
             console.error('Share failed', err);
             downloadBlob(blob, fileName);
          }
        }
      } else {
        // Fallback for desktop
        downloadBlob(blob, fileName);
      }
    } catch (err) {
      console.error('Failed to save image', err);
      alert('儲存圖片失敗，請重試');
    } finally {
      setIsSaving(false);
    }
  }, [data.date, data.totalTwd]);

  return (
    <div ref={contentRef} className="w-full max-w-4xl mx-auto p-4 animate-fade-in pb-20 bg-slate-50 relative">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onRetake}
          data-hide-on-save="true"
          className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 transition font-medium px-3 py-2 rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回</span>
        </button>
        
        {/* Title Center */}
        <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
          <Receipt className="w-6 h-6" />
          <span>消費明細表</span>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSaveImage}
          disabled={isSaving}
          data-hide-on-save="true"
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition font-medium disabled:opacity-70 shadow-sm shadow-indigo-200"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden sm:inline">儲存圖片</span>
          <span className="sm:hidden">儲存</span>
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-indigo-100 mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1">
           <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">總金額 (TWD)</span>
           <span className="text-2xl font-bold text-slate-900">NT$ {data.totalTwd.toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-1">
           <span className="text-xs text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
             <Calendar className="w-3 h-3" /> 消費日期
           </span>
           <span className="text-lg font-medium text-slate-700">{data.date}</span>
        </div>
        <div className="flex flex-col gap-1">
           <span className="text-xs text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
             <TrendingUp className="w-3 h-3" /> 匯率
           </span>
           <span className="text-lg font-medium text-slate-700">{data.exchangeRate}</span>
        </div>
        <div className="flex flex-col gap-1">
           <span className="text-xs text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
             <Calculator className="w-3 h-3" /> 商品項目
           </span>
           <span className="text-lg font-medium text-slate-700">{data.items.length} 筆</span>
        </div>
      </div>

      {/* Categorized Lists */}
      <div className="space-y-6">
        {categories.map((category) => (
          <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Category Header */}
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                {category}
              </h3>
              <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                {groupedItems[category].length} 項
              </span>
            </div>
            
            {/* Desktop Table View (Hidden on Mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 min-w-[120px]">商店/品牌</th>
                    <th className="px-4 py-3 min-w-[200px]">中文品名</th>
                    <th className="px-4 py-3 text-right">日幣原價</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-700">台幣金額</th>
                    <th className="px-4 py-3 min-w-[200px]">備註</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupedItems[category].map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3 text-slate-600">{item.store}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{item.originalName}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 font-mono">¥{item.originalPriceJpy.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-600 font-mono">NT${item.priceTwd.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{item.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (Hidden on Desktop) */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100">
              {groupedItems[category].map((item, idx) => (
                <div key={idx} className="p-4 bg-white flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold tracking-wide text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-full">
                      {item.store}
                    </span>
                    <span className="text-lg font-bold text-indigo-600 font-mono">
                      NT$ {item.priceTwd.toLocaleString()}
                    </span>
                  </div>
                  
                  <div>
                    <div className="text-base font-medium text-slate-900 leading-snug">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 font-light">
                      {item.originalName}
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50">
                    <span className="text-xs text-slate-400 font-mono">
                       原價 ¥{item.originalPriceJpy.toLocaleString()}
                    </span>
                    {item.note && (
                      <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded max-w-[60%] text-right truncate">
                        {item.note}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Original Image Toggle - For UI viewing only (Hidden in saved image) */}
      <div className="mt-8 flex justify-center" data-hide-on-save="true">
        <details className="group w-full max-w-sm">
          <summary className="list-none cursor-pointer flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 transition text-sm py-2">
             <span>查看原始收據</span>
             <div className="w-12 h-px bg-slate-200"></div>
          </summary>
          <div className="mt-2 p-2 bg-slate-100 rounded-lg border border-slate-200">
             <img src={originalImage} alt="Original Receipt" className="w-full h-auto opacity-90 rounded" />
          </div>
        </details>
      </div>

      {/* Footer Image - Hidden in UI, Visible ONLY in Saved Image (Bottom Right) */}
      <div 
        id="receipt-footer-image" 
        className="hidden mt-8 border-t border-slate-200 pt-6 flex-col items-end gap-2"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-slate-500 font-medium">原始收據備份</span>
        </div>
        <img 
          src={originalImage} 
          alt="Original Receipt" 
          className="w-48 max-w-[40%] h-auto rounded-lg border border-slate-200 shadow-sm opacity-95" 
        />
        <p className="text-[10px] text-slate-300 mt-2">Generated by Japan Receipt Organizer</p>
      </div>
    </div>
  );
};