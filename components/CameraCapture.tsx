import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, Upload, RefreshCw } from 'lucide-react';

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
    <div className="flex flex-col items-center justify-center w-full min-h-[500px] bg-slate-900 rounded-2xl overflow-hidden relative shadow-xl">
      {/* Video Preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${!isStreaming ? 'hidden' : 'block'}`}
      />

      {/* Placeholder / Error State */}
      {!isStreaming && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
          {error ? (
            <div className="flex flex-col items-center">
                <p className="text-red-400 mb-4">{error}</p>
                <button
                    onClick={startCamera}
                    className="flex items-center gap-2 text-white bg-indigo-600 px-4 py-2 rounded-full hover:bg-indigo-700 transition"
                >
                    <RefreshCw className="w-4 h-4" />
                    <span>重試相機</span>
                </button>
            </div>
          ) : (
            <div className="animate-pulse flex flex-col items-center">
              <Camera className="w-12 h-12 mb-2 opacity-50" />
              <p>啟動相機中...</p>
            </div>
          )}
        </div>
      )}

      {/* Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-4">
        
        {/* Shutter Button */}
        {isStreaming && (
          <button
            onClick={capturePhoto}
            className="w-20 h-20 rounded-full border-4 border-white bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-all active:scale-95 shadow-lg"
            aria-label="Take photo"
          >
            <div className="w-16 h-16 bg-white rounded-full" />
          </button>
        )}

        <div className="flex items-center gap-6 mt-2">
           {/* File Upload Alternative */}
          <label className="flex items-center gap-2 text-white cursor-pointer bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition backdrop-blur-md">
            <Upload className="w-5 h-5" />
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
    </div>
  );
};