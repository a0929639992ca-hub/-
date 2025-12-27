import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, Upload, RefreshCw, ScanLine } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStream = (stream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(e => console.error("Play error:", e));
        setIsStreaming(true);
      };
    }
  };

  const startCamera = useCallback(async () => {
    setError(null);
    setIsStreaming(false);

    // Stop any existing tracks
    if (videoRef.current && videoRef.current.srcObject) {
       const oldStream = videoRef.current.srcObject as MediaStream;
       oldStream.getTracks().forEach(track => track.stop());
    }

    try {
      // Attempt 1: Try High Resolution (Best for OCR)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        handleStream(stream);
        return;
      } catch (err) {
        console.warn("High-res camera failed, trying standard...", err);
      }

      // Attempt 2: Try Standard Environment Camera (Most phones support this)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        handleStream(stream);
        return;
      } catch (err) {
        console.warn("Environment facing failed, trying fallback...", err);
      }

      // Attempt 3: Fallback to any available video source
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true
      });
      handleStream(stream);

    } catch (err) {
      console.error("All camera attempts failed:", err);
      setError("無法啟動相機。請確認瀏覽器已允許相機權限，或改用「上傳照片」功能。");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  }, []);

  useEffect(() => {
    // Add a small delay to ensure DOM is ready and prevent race conditions on some mobile browsers
    const timer = setTimeout(() => {
      startCamera();
    }, 200);
    
    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Image resizing logic to speed up API processing
  const processAndCaptureImage = (source: HTMLVideoElement | HTMLImageElement) => {
    // Maintain high resolution for OCR
    const MAX_DIMENSION = 1600; 
    let width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
    let height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;

    // Sanity check for dimensions
    if (width === 0 || height === 0) {
        // Fallback dimensions if video isn't ready
        width = 1280;
        height = 720;
    }

    // Calculate new dimensions
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width *= ratio;
      height *= ratio;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(source, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      stopCamera();
      onCapture(dataUrl);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      processAndCaptureImage(videoRef.current);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          processAndCaptureImage(img);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full aspect-[3/4] max-h-[500px] bg-slate-900 rounded-3xl overflow-hidden relative shadow-2xl ring-1 ring-slate-900/5">
      {/* Video Preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${!isStreaming ? 'hidden' : 'block'}`}
      />

      {/* Scanning Frame Overlay */}
      {isStreaming && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
            <div className="w-full h-3/4 max-w-sm border-2 border-white/50 rounded-2xl relative">
                {/* Corners */}
                <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-xl"></div>
                <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-xl"></div>
                <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-xl"></div>
                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-xl"></div>
                
                {/* Scan Line Animation */}
                <div className="absolute left-0 right-0 h-0.5 bg-indigo-500/80 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-scan-line top-1/2"></div>
                
                <div className="absolute bottom-4 left-0 right-0 text-center">
                    <span className="bg-black/40 text-white/90 text-xs px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                        對準收據自動對焦
                    </span>
                </div>
            </div>
        </div>
      )}

      {/* Placeholder / Error State */}
      {!isStreaming && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-6 text-center bg-slate-800">
          {error ? (
            <div className="flex flex-col items-center">
                <p className="text-red-400 mb-4 bg-red-900/20 px-4 py-2 rounded-lg border border-red-900/30">{error}</p>
                <button
                    onClick={startCamera}
                    className="flex items-center gap-2 text-white bg-indigo-600 px-6 py-2.5 rounded-full hover:bg-indigo-700 transition font-medium shadow-lg shadow-indigo-900/20"
                >
                    <RefreshCw className="w-4 h-4" />
                    <span>重試相機</span>
                </button>
            </div>
          ) : (
            <div className="animate-pulse flex flex-col items-center">
              <div className="p-4 bg-slate-700/50 rounded-full mb-4">
                  <Camera className="w-8 h-8 opacity-70" />
              </div>
              <p className="font-medium">啟動相機中...</p>
            </div>
          )}
        </div>
      )}

      {/* Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col items-center gap-6">
        
        {/* Shutter Button */}
        {isStreaming && (
          <button
            onClick={capturePhoto}
            className="group relative w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95"
            aria-label="Take photo"
          >
            <div className="absolute inset-0 rounded-full border-4 border-white/30 group-hover:border-white/50 transition-colors"></div>
            <div className="w-16 h-16 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)] group-hover:scale-90 transition-transform duration-200" />
          </button>
        )}

        <div className="flex items-center gap-6 mt-2">
           {/* File Upload Alternative */}
          <label className="flex items-center gap-2 text-white/90 cursor-pointer bg-white/10 px-5 py-2.5 rounded-full hover:bg-white/20 transition backdrop-blur-md border border-white/10 active:scale-95">
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">上傳照片</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>
      
      <style>{`
        @keyframes scan-line {
            0% { top: 10%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 90%; opacity: 0; }
        }
        .animate-scan-line {
            animation: scan-line 2.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};