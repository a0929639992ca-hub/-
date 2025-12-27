import React, { useState, useCallback } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { ResultView } from './components/ResultView';
import { LoadingScreen } from './components/LoadingScreen';
import { translateReceipt } from './services/geminiService';
import { AppState, ReceiptAnalysis } from './types';
import { ScrollText, Sparkles, Plane } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

      setReceiptData(result);
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
    setAppState(AppState.IDLE);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-10">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-lg bg-white/80 border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
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
          <div className="hidden sm:flex text-xs text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full items-center gap-1 font-medium">
            <Sparkles className="w-3 h-3" />
            <span>Gemini AI 匯率換算</span>
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
                 <h3 className="font-semibold text-slate-700">折扣與均價</h3>
                 <p className="text-xs text-slate-500">自動計算免稅價、折扣後金額與多入組單價</p>
               </div>
            </div>
          </div>
        )}

        {/* State: ANALYZING */}
        {appState === AppState.ANALYZING && (
          <LoadingScreen />
        )}

        {/* State: RESULT */}
        {appState === AppState.RESULT && capturedImage && receiptData && (
          <ResultView 
            originalImage={capturedImage} 
            data={receiptData} 
            onRetake={handleRetake} 
          />
        )}
      </main>
    </div>
  );
};

export default App;