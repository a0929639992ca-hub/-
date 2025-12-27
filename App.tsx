import React, { useState, useCallback, useEffect } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { ResultView } from './components/ResultView';
import { LoadingScreen } from './components/LoadingScreen';
import { HistoryList } from './components/HistoryList';
import { translateReceipt } from './services/geminiService';
import { saveReceiptToHistory, getHistory, deleteFromHistory } from './services/historyService';
import { AppState, ReceiptAnalysis } from './types';
import { ScrollText, Sparkles, Plane, History } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<ReceiptAnalysis[]>([]);

  // Load history initially for count or future use
  useEffect(() => {
    setHistoryList(getHistory());
  }, []);

  const handleCapture = useCallback(async (imageData: string) => {
    setCapturedImage(imageData);
    setAppState(AppState.ANALYZING);
    setErrorMsg(null);

    try {
      // Remove data URL prefix to get pure base64
      const base64Data = imageData.split(',')[1];
      const result = await translateReceipt(base64Data);
      
      if (!result || result.items.length === 0) {
        throw new Error("無法辨識任何商品，請靠近一點拍攝。");
      }

      // Automatically save successful result
      const savedRecord = saveReceiptToHistory(result);
      // Update local history state
      setHistoryList(prev => [savedRecord, ...prev]);

      setReceiptData(savedRecord);
      setAppState(AppState.RESULT);
    } catch (err) {
      console.error(err);
      // Show the actual error message from the service
      setErrorMsg(err instanceof Error ? err.message : "發生未知錯誤，請重試");
      setAppState(AppState.ERROR);
    }
  }, []);

  const handleRetake = () => {
    setCapturedImage(null);
    setReceiptData(null);
    setErrorMsg(null);
    // If we were viewing history, go back to history list, else go to idle
    if (appState === AppState.RESULT && !capturedImage) { 
        // Logic check: if capturedImage is null, it implies we are viewing a history item (no image stored)
        // OR we need a separate flag. Simpler: If we have an ID and no image, it's history.
        setAppState(AppState.HISTORY);
    } else {
        setAppState(AppState.IDLE);
    }
  };

  const openHistory = () => {
    setHistoryList(getHistory()); // Refresh list
    setAppState(AppState.HISTORY);
  };

  const selectHistoryItem = (item: ReceiptAnalysis) => {
    setReceiptData(item);
    setCapturedImage(null); // History items don't have the image stored
    setAppState(AppState.RESULT);
  };

  const deleteHistoryItem = (id: string) => {
    const updated = deleteFromHistory(id);
    setHistoryList(updated);
    if (receiptData && receiptData.id === id) {
        setAppState(AppState.HISTORY); // Go back to list if current item deleted
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-10">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-lg bg-white/80 border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => setAppState(AppState.IDLE)}
          >
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <ScrollText className="w-5 h-5" />
            </div>
            <div className="flex flex-col leading-none">
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                日本購物 <span className="text-indigo-600">記帳助手</span>
              </h1>
              <span className="text-[10px] text-slate-500 font-medium">Japan Receipt Organizer</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
                onClick={openHistory}
                className="flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
            >
                <History className="w-5 h-5" />
                <span className="text-sm font-medium hidden sm:inline">歷史紀錄</span>
            </button>
            <div className="hidden sm:flex text-xs text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3" />
                <span>AI 匯率換算</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {/* State: IDLE or ERROR (Show Camera) */}
        {(appState === AppState.IDLE || appState === AppState.ERROR) && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-full mb-4 text-indigo-600">
                 <Plane className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">生成分類消費明細</h2>
              <p className="text-slate-500 max-w-md mx-auto">
                自動分類藥妝、食品、精品，並依當日匯率換算台幣，
                幫您輕鬆整理日本旅遊戰利品。
              </p>
            </div>

            <CameraCapture onCapture={handleCapture} />

            {appState === AppState.ERROR && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-center text-sm font-medium">
                {errorMsg}
                <button 
                  onClick={() => setAppState(AppState.IDLE)}
                  className="block mx-auto mt-2 text-red-700 underline font-bold hover:text-red-800"
                >
                  再試一次
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
               <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center text-center gap-2">
                 <h3 className="font-semibold text-slate-700">自動匯率換算</h3>
                 <p className="text-xs text-slate-500">抓取收據日期，自動估算當時匯率計算台幣成本</p>
               </div>
               <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center text-center gap-2">
                 <h3 className="font-semibold text-slate-700">智慧商品分類</h3>
                 <p className="text-xs text-slate-500">自動歸類藥品、美妝、零食等不同類別</p>
               </div>
               <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center text-center gap-2">
                 <h3 className="font-semibold text-slate-700">自動存檔</h3>
                 <p className="text-xs text-slate-500">分析成功的明細將自動儲存至歷史紀錄中</p>
               </div>
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
            originalImage={capturedImage} // This will be null if coming from History
            data={receiptData} 
            onRetake={() => {
                // Determine where to go back to
                if (capturedImage) {
                    // It was a new capture, confirm before losing state or just go home
                    if(confirm("返回後將清除本次掃描畫面（資料已自動儲存）。確定返回嗎？")) {
                        setAppState(AppState.IDLE);
                        setCapturedImage(null);
                        setReceiptData(null);
                    }
                } else {
                    // It was from history, go back to list
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

export default App;