import React, { useState, useCallback, useEffect } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { ResultView } from './components/ResultView';
import { LoadingScreen } from './components/LoadingScreen';
import { HistoryList } from './components/HistoryList';
import { StatsView } from './components/StatsView'; // Import StatsView
import { translateReceipt } from './services/geminiService';
import { saveReceiptToHistory, getHistory, deleteFromHistory } from './services/historyService';
import { AppState, ReceiptAnalysis } from './types';
import { ScrollText, Sparkles, History, Receipt, Calculator, PieChart, ScanLine, ShoppingBag } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<ReceiptAnalysis[]>([]);
  
  // Manual Exchange Rate State
  const [customRate, setCustomRate] = useState<string>('');

  useEffect(() => {
    setHistoryList(getHistory());
  }, []);

  const handleCapture = useCallback(async (imageData: string) => {
    setCapturedImage(imageData);
    setAppState(AppState.ANALYZING);
    setErrorMsg(null);

    try {
      const base64Data = imageData.split(',')[1];
      
      let rateToSend: number | undefined = undefined;
      const parsedRate = parseFloat(customRate);
      if (!isNaN(parsedRate) && parsedRate > 0) {
        rateToSend = parsedRate;
      }

      const result = await translateReceipt(base64Data, 'image/jpeg', rateToSend);
      
      if (!result || result.items.length === 0) {
        throw new Error("無法辨識任何商品，請靠近一點拍攝。");
      }

      const savedRecord = saveReceiptToHistory(result);
      setHistoryList(prev => [savedRecord, ...prev]);

      setReceiptData(savedRecord);
      setAppState(AppState.RESULT);
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "發生未知錯誤，請重試");
      setAppState(AppState.ERROR);
    }
  }, [customRate]);

  const selectHistoryItem = (item: ReceiptAnalysis) => {
    setReceiptData(item);
    setCapturedImage(null);
    setAppState(AppState.RESULT);
  };

  const deleteHistoryItem = (id: string) => {
    const updated = deleteFromHistory(id);
    setHistoryList(updated);
    if (receiptData && receiptData.id === id) {
        // If deleting from result view, go back to history
        setAppState(AppState.HISTORY);
    }
  };

  // Check if we should show the bottom nav
  const showBottomNav = [AppState.IDLE, AppState.HISTORY, AppState.STATS, AppState.ERROR].includes(appState);

  // Calculate current trip total for header
  const totalSpent = historyList.reduce((sum, item) => sum + item.totalTwd, 0);

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
          backgroundSize: '24px 24px'
      }}></div>

      {/* Header (Only show on Main Tabs) */}
      {showBottomNav && (
        <header className="sticky top-0 z-40 w-full backdrop-blur-sm bg-[#FDFDFD]/80 border-b border-slate-100">
            <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-200">
                    <span className="font-bold text-lg">J</span>
                </div>
                <div className="flex flex-col leading-none">
                    <h1 className="text-base font-bold text-slate-800">
                        日本購物<span className="text-indigo-600">記帳</span>
                    </h1>
                </div>
            </div>
            
            {/* Total Budget Pill */}
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                <ShoppingBag className="w-3 h-3 text-slate-500" />
                <span className="text-xs font-bold text-slate-700 font-mono">NT$ {totalSpent.toLocaleString()}</span>
            </div>
            </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="max-w-md mx-auto relative z-10 pb-24">
        
        {/* State: IDLE / ERROR (Scan Tab) */}
        {(appState === AppState.IDLE || appState === AppState.ERROR) && (
          <div className="px-4 py-6 flex flex-col gap-5 animate-in fade-in duration-300">
            
            {/* Exchange Rate Setting */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                    <Calculator className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <label className="text-xs font-bold text-slate-500 block mb-0.5">匯率設定 (Leave empty for 0.25)</label>
                    <input 
                        type="number" 
                        step="0.001" 
                        placeholder="預設 0.25"
                        value={customRate}
                        onChange={(e) => setCustomRate(e.target.value)}
                        className="w-full text-lg font-mono font-bold text-slate-800 bg-transparent placeholder-slate-300 focus:outline-none"
                    />
                </div>
            </div>

            <div className="relative shadow-2xl rounded-3xl overflow-hidden ring-4 ring-white">
                <CameraCapture onCapture={handleCapture} />
            </div>

            {appState === AppState.ERROR && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-center text-sm font-medium">
                <p className="mb-2">{errorMsg}</p>
                <button 
                  onClick={() => setAppState(AppState.IDLE)}
                  className="px-4 py-1.5 bg-white border border-red-200 rounded-lg text-red-700 text-xs font-bold shadow-sm"
                >
                  重試
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3 mt-1">
               <FeatureCard 
                 icon={<ScrollText className="w-4 h-4 text-indigo-500" />}
                 title="指定匯率"
                 desc="手動輸入或預設0.25"
               />
               <FeatureCard 
                 icon={<Sparkles className="w-4 h-4 text-pink-500" />}
                 title="自動翻譯"
                 desc="日文品名轉繁體中文"
               />
            </div>
          </div>
        )}

        {/* State: HISTORY */}
        {appState === AppState.HISTORY && (
            <div className="py-6 px-2">
                <HistoryList 
                    history={historyList}
                    onSelect={selectHistoryItem}
                    onUpdateHistory={setHistoryList}
                    onBack={() => setAppState(AppState.IDLE)}
                />
            </div>
        )}

        {/* State: STATS (New) */}
        {appState === AppState.STATS && (
            <div className="py-6">
                <StatsView history={historyList} />
            </div>
        )}

        {/* State: ANALYZING (Overlay) */}
        {appState === AppState.ANALYZING && (
          <LoadingScreen />
        )}

        {/* State: RESULT (Overlay) */}
        {appState === AppState.RESULT && receiptData && (
            <div className="fixed inset-0 z-50 bg-[#FDFDFD] overflow-y-auto">
                 <div className="max-w-md mx-auto pt-2 px-4">
                    <ResultView 
                        originalImage={capturedImage}
                        data={receiptData} 
                        onRetake={() => {
                            if (capturedImage) {
                                if(confirm("返回後將清除本次掃描畫面（資料已自動儲存）。確定返回嗎？")) {
                                    setAppState(AppState.IDLE);
                                    setCapturedImage(null);
                                    setReceiptData(null);
                                }
                            } else {
                                setAppState(AppState.HISTORY);
                            }
                        }}
                        onDelete={deleteHistoryItem}
                    />
                </div>
            </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      {showBottomNav && (
        <div className="fixed bottom-0 left-0 w-full z-40 bg-white border-t border-slate-200 pb-safe">
            <div className="max-w-md mx-auto flex justify-around items-center">
                <NavButton 
                    active={appState === AppState.IDLE || appState === AppState.ERROR} 
                    onClick={() => setAppState(AppState.IDLE)} 
                    icon={ScanLine} 
                    label="掃描" 
                />
                <NavButton 
                    active={appState === AppState.HISTORY} 
                    onClick={() => setAppState(AppState.HISTORY)} 
                    icon={History} 
                    label="紀錄" 
                />
                <NavButton 
                    active={appState === AppState.STATS} 
                    onClick={() => setAppState(AppState.STATS)} 
                    icon={PieChart} 
                    label="統計" 
                />
            </div>
        </div>
      )}
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-2">
        <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
            {icon}
            {title}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
    </div>
);

const NavButton = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
    <button 
        onClick={onClick}
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
            active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
        }`}
    >
        <div className={`p-1 rounded-full ${active ? 'bg-indigo-50' : 'bg-transparent'}`}>
            <Icon className={`w-6 h-6 ${active ? 'fill-current' : 'stroke-current'}`} strokeWidth={active ? 0 : 2} />
        </div>
        <span className="text-[10px] font-bold tracking-wide">{label}</span>
    </button>
);

export default App;