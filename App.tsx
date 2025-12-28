import React, { useState, useCallback, useEffect } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { ResultView } from './components/ResultView';
import { LoadingScreen } from './components/LoadingScreen';
import { HistoryList } from './components/HistoryList';
import { StatsView } from './components/StatsView';
import { AuthView } from './components/AuthView';
import { translateReceipt } from './services/geminiService';
import { saveReceiptToHistory, getHistory, deleteFromHistory, syncLocalToCloud } from './services/historyService';
import { getCurrentUser, logout } from './services/authService';
import { AppState, ReceiptAnalysis, User } from './types';
import { AlertCircle, History, Calculator, PieChart, ScanLine, User as UserIcon, Check, RefreshCw, ArrowLeft } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<ReceiptAnalysis[]>([]);
  const [customRate, setCustomRate] = useState<string>('');

  const initializeApp = useCallback(async () => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    if (currentUser) {
      setIsSyncing(true);
      try {
        await syncLocalToCloud(currentUser.id);
      } catch (e) {}
      setIsSyncing(false);
    }
    setHistoryList(getHistory());
  }, []);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  const triggerToast = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleCapture = useCallback(async (imageData: string) => {
    setCapturedImage(imageData);
    setAppState(AppState.ANALYZING);
    setErrorMsg(null);

    try {
      const base64Data = imageData.split(',')[1];
      let rateToSend: number | undefined = undefined;
      const parsedRate = parseFloat(customRate);
      if (!isNaN(parsedRate) && parsedRate > 0) rateToSend = parsedRate;

      const result = await translateReceipt(base64Data, 'image/jpeg', rateToSend);
      
      if (!result || !result.items || result.items.length === 0) {
        throw new Error("AI 未能辨識出商品內容，請確保收據清晰且光線充足。");
      }

      const savedRecord = saveReceiptToHistory(result);
      setHistoryList(getHistory());
      setReceiptData(savedRecord);
      setAppState(AppState.RESULT);
      triggerToast();
      
    } catch (err) {
      console.error("Analysis Failed:", err);
      setErrorMsg(err instanceof Error ? err.message : "辨識發生異常，請重試");
      setAppState(AppState.ERROR);
    }
  }, [customRate]);

  const handleLogout = () => {
    if (confirm('確定要登出嗎？資料將保留於雲端。')) {
      logout();
      initializeApp();
      setAppState(AppState.IDLE);
    }
  };

  const showBottomNav = [AppState.IDLE, AppState.HISTORY, AppState.STATS].includes(appState);
  const totalSpent = (historyList || []).reduce((sum, item) => sum + (item.totalTwd || 0), 0);

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans relative overflow-x-hidden">
      <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
          backgroundSize: '24px 24px'
      }}></div>

      {showToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-top duration-300">
            <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-slate-700">
                <Check className="w-5 h-5 text-green-400" />
                <span className="font-bold text-sm">已存入紀錄</span>
            </div>
        </div>
      )}

      {showBottomNav && (
        <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#FDFDFD]/80 border-b border-slate-100">
            <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2" onClick={() => setAppState(AppState.IDLE)}>
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
                        <span className="font-bold text-lg">J</span>
                    </div>
                    <div className="flex flex-col leading-none">
                        <h1 className="text-sm font-bold text-slate-800">日本購物記帳</h1>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                            {user ? user.name : 'LOCAL MODE'}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {user ? (
                        <button onClick={handleLogout} className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-slate-200 text-slate-500 shadow-sm">
                            <UserIcon className="w-4 h-4" />
                        </button>
                    ) : (
                        <button onClick={() => setAppState(AppState.AUTH)} className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-600">
                            <span className="text-[10px] font-bold">登入</span>
                        </button>
                    )}
                    <div className="bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                        <span className="text-xs font-bold text-slate-700 font-mono">NT$ {totalSpent.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </header>
      )}

      <main className="max-w-md mx-auto relative z-10 pb-24">
        {appState === AppState.AUTH && (
          <AuthView 
            onLoginSuccess={(u) => {
              setUser(u);
              syncLocalToCloud(u.id).then(() => {
                  setHistoryList(getHistory());
                  setAppState(AppState.IDLE);
              });
            }} 
            onBack={() => setAppState(AppState.IDLE)} 
          />
        )}

        {appState === AppState.IDLE && (
          <div className="px-4 py-6 flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Calculator className="w-5 h-5" /></div>
                <div className="flex-1">
                    <label className="text-xs font-bold text-slate-500 block mb-0.5 uppercase tracking-wider">自訂今日匯率</label>
                    <input type="number" step="0.001" placeholder="0.25" value={customRate} onChange={(e) => setCustomRate(e.target.value)} className="w-full text-lg font-mono font-bold text-slate-800 bg-transparent focus:outline-none" />
                </div>
            </div>
            <div className="relative shadow-2xl rounded-3xl overflow-hidden ring-4 ring-white ring-opacity-50">
                <CameraCapture onCapture={handleCapture} />
            </div>
            <p className="text-[10px] text-center text-slate-400 px-8 leading-relaxed">
                拍攝日本收據，Gemini 會為您自動翻譯並分類記帳。
            </p>
          </div>
        )}

        {appState === AppState.ERROR && (
            <div className="px-6 py-12 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                    <AlertCircle className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-3">辨識失敗</h2>
                <div className="bg-red-50/50 border border-red-100 p-5 rounded-2xl mb-8 w-full">
                    <p className="text-sm text-red-600 font-medium">{errorMsg}</p>
                </div>
                <button onClick={() => setAppState(AppState.IDLE)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform">
                    <RefreshCw className="w-5 h-5" /> 重新拍攝
                </button>
            </div>
        )}

        {appState === AppState.HISTORY && (
            <div className="py-6 px-2">
                <HistoryList 
                    history={historyList}
                    onSelect={(item) => { setReceiptData(item); setAppState(AppState.RESULT); }}
                    onUpdateHistory={(newList) => { setHistoryList(newList); }}
                    onBack={() => setAppState(AppState.IDLE)}
                    isSyncing={isSyncing}
                />
            </div>
        )}

        {appState === AppState.STATS && (
            <div className="py-6">
                <StatsView history={historyList} />
            </div>
        )}

        {appState === AppState.ANALYZING && <LoadingScreen />}

        {appState === AppState.RESULT && receiptData && (
            <div className="fixed inset-0 z-50 bg-[#FDFDFD] overflow-y-auto animate-in fade-in slide-in-from-right duration-500">
                 <div className="max-w-md mx-auto pt-2 px-4">
                    <ResultView 
                        originalImage={capturedImage}
                        data={receiptData} 
                        onRetake={() => { setAppState(AppState.IDLE); setCapturedImage(null); setReceiptData(null); }}
                        onDelete={(id) => { const updated = deleteFromHistory(id); setHistoryList(updated); setAppState(AppState.HISTORY); }}
                    />
                </div>
            </div>
        )}
      </main>

      {showBottomNav && (
        <div className="fixed bottom-0 left-0 w-full z-40 bg-white border-t border-slate-100 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
            <div className="max-w-md mx-auto flex justify-around items-center h-20">
                <NavButton active={appState === AppState.IDLE} onClick={() => setAppState(AppState.IDLE)} icon={ScanLine} label="掃描" />
                <NavButton active={appState === AppState.HISTORY} onClick={() => setAppState(AppState.HISTORY)} icon={History} label="歷史" />
                <NavButton active={appState === AppState.STATS} onClick={() => setAppState(AppState.STATS)} icon={PieChart} label="統計" />
            </div>
        </div>
      )}
    </div>
  );
};

const NavButton = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
        <div className={`p-2 rounded-xl transition-all duration-300 ${active ? 'bg-indigo-50 scale-110 shadow-sm' : 'bg-transparent'}`}>
            <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5px]' : 'stroke-2'}`} />
        </div>
        <span className="text-[10px] font-bold tracking-widest">{label}</span>
    </button>
);

export default App;