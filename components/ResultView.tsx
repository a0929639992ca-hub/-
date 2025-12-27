import React, { useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, Receipt, Calendar, Download, Loader2, Trash2, Clock } from 'lucide-react';
import { ReceiptAnalysis, ReceiptItem } from '../types';
import { toBlob } from 'html-to-image';

interface ResultViewProps {
  originalImage?: string | null;
  data: ReceiptAnalysis;
  onRetake: () => void;
  onDelete?: (id: string) => void;
}

export const ResultView: React.FC<ResultViewProps> = ({ originalImage, data, onRetake, onDelete }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  
  // Extract Store Name logic
  const storeName = useMemo(() => {
    // Find the first valid store name that isn't "Unknown" or generic
    const validItem = data.items.find(i => i.store && i.store !== '未知' && i.store !== 'Store');
    return validItem ? validItem.store : 'JAPAN SHOPPING';
  }, [data.items]);

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
      await new Promise(resolve => setTimeout(resolve, 100));

      const options: any = {
        cacheBust: true,
        // Using a solid visible gray background to ensure contrast against the white receipt paper
        backgroundColor: '#cbd5e1', 
        // Add padding so the receipt sits nicely "on the table" (the gray background)
        style: {
           margin: '0',
           padding: '40px', 
           transform: 'none' 
        },
        // Adjust width/height to account for the padding added above
        width: contentRef.current.scrollWidth + 80, 
        height: contentRef.current.scrollHeight + 80, 

        filter: (node: any) => {
          if (node instanceof HTMLElement && node.hasAttribute('data-hide-on-save')) {
            return false;
          }
          return true;
        },
        onClone: (clonedNode: any) => {
          const node = clonedNode as HTMLElement;
          // Ensure the receipt paper itself stays white
          node.style.backgroundColor = '#ffffff';
          node.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.2)'; // Add a baked-in shadow for depth
          
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

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `${storeName} 購物明細`,
            text: `消費日期: ${data.date} - 總金額: NT$${data.totalTwd}`
          });
        } catch (err) {
          if ((err as Error).name !== 'AbortError') {
             downloadBlob(blob, fileName);
          }
        }
      } else {
        downloadBlob(blob, fileName);
      }
    } catch (err) {
      console.error('Failed to save image', err);
      alert('儲存圖片失敗，請重試');
    } finally {
      setIsSaving(false);
    }
  }, [data.date, data.totalTwd, storeName]);

  const handleDeleteCurrent = () => {
    if (data.id && onDelete) {
      if(confirm("確定要刪除此筆紀錄嗎？")) {
        onDelete(data.id);
      }
    }
  };

  const formattedTimestamp = data.timestamp 
    ? new Date(data.timestamp).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  return (
    <div className="flex flex-col w-full max-w-md mx-auto animate-fade-in pb-24 md:pb-10">
      
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between py-4 px-2 mb-2">
        <button
          onClick={onRetake}
          className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 bg-white/80 border border-slate-200/60 backdrop-blur px-4 py-2 rounded-full text-sm font-medium transition shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回</span>
        </button>
        
        {data.id && onDelete && (
            <button
            onClick={handleDeleteCurrent}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
            title="刪除紀錄"
            >
            <Trash2 className="w-5 h-5" />
            </button>
        )}
      </div>

      {/* Main Receipt Content */}
      <div className="relative drop-shadow-xl px-2">
        <div ref={contentRef} className="bg-white relative overflow-hidden text-slate-800 receipt-paper">
          
          {/* Receipt Top Decoration */}
          <div className="h-2 bg-indigo-600 w-full absolute top-0 left-0"></div>
          
          {/* Header Section */}
          <div className="pt-8 pb-6 px-6 text-center border-b-2 border-dashed border-slate-200">
            <div className="inline-flex items-center justify-center p-3 bg-indigo-50 text-indigo-600 rounded-full mb-4">
               <Receipt className="w-6 h-6" />
            </div>
            {/* Dynamic Store Name */}
            <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-1 line-clamp-2 uppercase">
                {storeName}
            </h2>
            <p className="text-xs text-slate-400 tracking-widest uppercase mb-4">Shopping List</p>
            
            <div className="flex justify-center gap-4 text-xs text-slate-500 font-mono">
                <span className="flex items-center gap-1">
                   <Calendar className="w-3 h-3" /> {data.date}
                </span>
                {data.time && (
                    <span className="flex items-center gap-1">
                       <Clock className="w-3 h-3" /> {data.time}
                    </span>
                )}
            </div>
          </div>

          {/* Total Section */}
          <div className="bg-slate-50 p-6 text-center border-b-2 border-dashed border-slate-200">
             <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Total Amount</p>
             <div className="flex items-baseline justify-center gap-1 text-slate-900 mb-2">
                <span className="text-xl font-medium">NT$</span>
                <span className="text-5xl font-bold font-mono tracking-tighter">{data.totalTwd.toLocaleString()}</span>
             </div>
             
             {data.totalJpy && (
                <div className="inline-block bg-white border border-slate-200 px-3 py-1 rounded-md">
                    <p className="text-xs text-slate-500 font-mono flex items-center gap-2">
                        <span>JPY Total: ¥{data.totalJpy.toLocaleString()}</span>
                        <span className="text-slate-300">|</span>
                        <span>Rate: {data.exchangeRate}</span>
                    </p>
                </div>
             )}
          </div>

          {/* Items List */}
          <div className="p-6 space-y-8">
             {categories.map((category) => (
                <div key={category}>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                        {category}
                    </h3>
                    <div className="space-y-3">
                        {groupedItems[category].map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start group">
                                <div className="flex-1 pr-4">
                                    <div className="text-sm font-bold text-slate-800 leading-tight">
                                        {item.name}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5 font-light">
                                        {item.originalName}
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {item.store !== storeName && (
                                             <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                {item.store}
                                             </span>
                                        )}
                                        {item.note && (
                                            <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                                {item.note}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold text-slate-700 font-mono">
                                        ${item.priceTwd.toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                        ¥{item.originalPriceJpy.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
             ))}
          </div>

          {/* Footer Info */}
          <div className="bg-slate-50 p-6 pt-8 text-center relative">
             {/* Receipt Sawtooth Bottom Visual inside the container (for image save) */}
             <div className="absolute top-0 left-0 w-full h-4 -mt-2 bg-transparent" style={{
                 background: 'radial-gradient(circle, transparent 0.25rem, #f8fafc 0.25rem)',
                 backgroundSize: '0.75rem 0.75rem',
                 backgroundPosition: '0 0.25rem'
             }}></div>

             <div className="space-y-4">
                 <div className="flex justify-between text-xs text-slate-500 border-b border-slate-200 pb-4">
                     <span>Items Count</span>
                     <span className="font-mono font-bold">{data.items.length}</span>
                 </div>
                 
                 <div className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">
                     Thank you for visiting Japan
                 </div>

                 <div className="barcode-font text-3xl text-slate-800 opacity-20 tracking-[0.5em] overflow-hidden whitespace-nowrap">
                    ||||| |||| || ||| |||||
                 </div>
                 
                 {formattedTimestamp && (
                    <div className="text-[10px] text-slate-300">
                        Scan Time: {formattedTimestamp}
                    </div>
                )}
             </div>

             {/* Footer Image (Hidden unless saving) */}
             {originalImage && (
                <div 
                id="receipt-footer-image" 
                className="hidden flex-col items-center gap-3 mt-6 pt-6 border-t border-slate-200"
                >
                    <div className="text-xs text-slate-500 font-bold tracking-widest uppercase mb-1">Original Receipt</div>
                    <img 
                        src={originalImage} 
                        alt="Original Receipt" 
                        className="w-full max-w-[80%] h-auto rounded grayscale opacity-80" 
                    />
                    <p className="text-[10px] text-slate-300 mt-2">Generated by Japan Shopping Organizer</p>
                </div>
            )}
          </div>
          
          {/* Jagged Edge Bottom (CSS Mask) */}
          <div className="w-full h-4 bg-white absolute bottom-0 left-0" style={{
              maskImage: 'radial-gradient(circle at 10px bottom, transparent 10px, black 10.5px)',
              maskSize: '20px 20px',
              maskPosition: 'bottom',
              maskRepeat: 'repeat-x',
              WebkitMaskImage: 'radial-gradient(circle at 10px bottom, transparent 10px, black 10.5px)',
              WebkitMaskSize: '20px 15px',
              WebkitMaskPosition: 'bottom',
              WebkitMaskRepeat: 'repeat-x'
          }}></div>

        </div>
      </div>

      {/* View Original Image Toggle */}
      {originalImage && (
        <div className="mt-8 px-4 flex justify-center" data-hide-on-save="true">
          <details className="group w-full text-center">
            <summary className="list-none cursor-pointer inline-flex items-center justify-center gap-2 text-slate-400 hover:text-indigo-600 transition text-sm py-2 px-4 rounded-full border border-dashed border-slate-300 hover:border-indigo-300 hover:bg-white">
              <Receipt className="w-4 h-4" />
              <span>查看原始照片</span>
            </summary>
            <div className="mt-4 p-2 bg-slate-900/5 rounded-xl">
              <img src={originalImage} alt="Original Receipt" className="w-full h-auto rounded-lg shadow-inner" />
            </div>
          </details>
        </div>
      )}

      {/* Sticky Bottom Action Bar */}
      <div 
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center w-max max-w-[90vw]" 
        data-hide-on-save="true"
      >
        <button
            onClick={handleSaveImage}
            disabled={isSaving}
            className="flex items-center gap-3 bg-slate-900 text-white pl-6 pr-8 py-4 rounded-full hover:bg-slate-800 transition shadow-2xl shadow-slate-900/30 active:scale-95 disabled:opacity-80 border border-slate-700"
        >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            <span className="font-bold tracking-wide">儲存明細圖</span>
        </button>
      </div>

      <style>{`
        .receipt-paper {
            background-color: #fff;
            /* Jagged top (simple clip-path approach for visual flair) */
            clip-path: polygon(
                0% 10px, 
                2% 0%, 4% 10px, 
                6% 0%, 8% 10px, 
                10% 0%, 12% 10px, 
                14% 0%, 16% 10px, 
                18% 0%, 20% 10px, 
                22% 0%, 24% 10px, 
                26% 0%, 28% 10px, 
                30% 0%, 32% 10px, 
                34% 0%, 36% 10px, 
                38% 0%, 40% 10px, 
                42% 0%, 44% 10px, 
                46% 0%, 48% 10px, 
                50% 0%, 52% 10px, 
                54% 0%, 56% 10px, 
                58% 0%, 60% 10px, 
                62% 0%, 64% 10px, 
                66% 0%, 68% 10px, 
                70% 0%, 72% 10px, 
                74% 0%, 76% 10px, 
                78% 0%, 80% 10px, 
                82% 0%, 84% 10px, 
                86% 0%, 88% 10px, 
                90% 0%, 92% 10px, 
                94% 0%, 96% 10px, 
                98% 0%, 100% 10px, 
                100% 100%, 0% 100%
            );
        }
      `}</style>
    </div>
  );
};