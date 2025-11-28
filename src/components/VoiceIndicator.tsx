import React from 'react';
import { Mic } from 'lucide-react';

interface VoiceIndicatorProps {
  status: 'listening' | 'speaking' | 'processing' | 'idle';
}

const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({ status }) => {
  return (
    <div className="flex flex-col items-center justify-center h-48 w-full">
      {status === 'speaking' && (
        <div className="flex space-x-2 items-end h-16">
           {/* Simulate Speaking Waveform (TTS active) */}
          <div className="w-3 bg-blue-500 animate-wave" style={{ animationDelay: '0s' }}></div>
          <div className="w-3 bg-blue-500 animate-wave" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-3 bg-blue-500 animate-wave" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-3 bg-blue-500 animate-wave" style={{ animationDelay: '0.3s' }}></div>
          <div className="w-3 bg-blue-500 animate-wave" style={{ animationDelay: '0.4s' }}></div>
        </div>
      )}

      {status === 'listening' && (
        <div className="relative">
          <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-75"></div>
          <div className="relative bg-red-500 text-white p-6 rounded-full shadow-lg">
            <Mic className="w-12 h-12" />
          </div>
        </div>
      )}

      {status === 'processing' && (
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      )}

      {status === 'idle' && (
        <div className="bg-slate-200 p-6 rounded-full text-slate-400">
          <Mic className="w-12 h-12" />
        </div>
      )}

      <div className="mt-6 text-xl font-medium text-slate-600">
        {status === 'speaking' && "말씀드리는 중..."}
        {status === 'listening' && "듣고 있어요. 말씀해주세요."}
        {status === 'processing' && "생각하고 있어요..."}
        {status === 'idle' && "버튼을 눌러 대답해주세요."}
      </div>
    </div>
  );
};

export default VoiceIndicator;