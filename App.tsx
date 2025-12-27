import React, { useState, useCallback, useEffect } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { ResultView } from './components/ResultView';
import { LoadingScreen } from './components/LoadingScreen';
import { HistoryList } from './components/HistoryList';
import { translateReceipt } from './services/geminiService';
import { saveReceiptToHistory, getHistory, deleteFromHistory } from './services/historyService';
import { AppState, ReceiptAnalysis } from './types';
import { ScrollText, Sparkles, History, Receipt, Calculator } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<ReceiptAnalysis[]>([]);
  
  // Manual Exchange Rate State (Default empty, logic will default to 0.25)
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
      
      // Parse custom rate, default to undefined (service will handle 0.25 default)
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

  const openHistory = () => {
    setHistoryList(getHistory());
    setAppState(AppState.HISTORY);
  };

  const selectHistoryItem = (item: ReceiptAnalysis) => {
    setReceiptData(item);
    setCapturedImage(null);
    setAppState(AppState.RESULT);
  };

  const deleteHistoryItem = (id: string) => {
    const updated = deleteFromHistory(id);
    setHistoryList(updated);
    if (receiptData && receiptData.id === id) {
        setAppState(AppState.HISTORY);
    }
  };

  // Calculate total spent for IDLE screen
  const totalSpent = historyList.reduce((sum, item) => sum + item.totalTwd, 0);

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 pb-10 font-sans relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
          backgroundSize: '24px 24px'
      }}></div>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-sm bg-[#FDFDFD]/80 border-b border-slate-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer group" 
            onClick={() => setAppState(AppState.IDLE)}
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-200">
               <span className="font-bold text-lg">J</span>
            </div>
            <div className="flex flex-col leading-none">
              <h1 className="text-base font-bold text-slate-800">
                日本購物<span className="text-indigo-600">記帳</span>
              </h1>
            </div>
          </div>
          
          <button 
              onClick={openHistory}
              className="p-2 text-slate-500 hover:text-indigo-600 transition-colors relative"
          >
              <History className="w-5 h-5" />
              {historyList.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md mx-auto px-4 py-6 relative z-10">
        
        {/* State: IDLE or ERROR (Show Camera) */}
        {(appState === AppState.IDLE || appState === AppState.ERROR) && (
          <div className="flex flex-col gap-5 animate-in fade-in duration-500">
            
            {/* Summary Mini Card */}
            {historyList.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Current Trip Total</p>
                        <p className="text-2xl font-bold text-slate-800 font-mono mt-0.5">NT$ {totalSpent.toLocaleString()}</p>
                    </div>
                    <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500">
                        <Receipt className="w-5 h-5" />
                    </div>
                </div>
            )}

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
            <HistoryList 
                history={historyList}
                onSelect={selectHistoryItem}
                onUpdateHistory={setHistoryList}
                onBack={() => setAppState(AppState.IDLE)}
            />
        )}

        {/* State: ANALYZING */}
        {appState === AppState.ANALYZING && (
          <LoadingScreen />
        )}

        {/* State: RESULT */}
        {appState === AppState.RESULT && receiptData && (
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
        )}
      </main>
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

export default App;