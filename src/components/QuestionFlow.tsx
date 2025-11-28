'use client';

import { useState, useRef } from 'react';
import { QUESTIONS } from '@/constants/questions';

interface QuestionFlowProps {
  onAnswer: (questionIndex: number, answer: string) => void;
  onFinished: () => void;
}

const ProgressBar = ({ current, total }: { current: number; total: number }) => {
  const progressPercentage = (current / total) * 100;
  return (
    <div style={{ width: '100%', backgroundColor: '#E2E2E2', borderRadius: '4px', overflow: 'hidden' }}>
      <div
        style={{
          width: `${progressPercentage}%`,
          height: '8px',
          backgroundColor: 'var(--primary-color)',
          transition: 'width 0.3s ease-in-out',
        }}
      />
    </div>
  );
};

export default function QuestionFlow({ onAnswer, onFinished }: QuestionFlowProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('버튼을 눌러 녹음을 시작하세요.');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);

  const handleNextQuestion = () => {
    if (currentQuestionIndex < QUESTIONS.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      onFinished();
    }
  };
  
  const handleTranscription = async (blob: Blob) => {
    setIsTranscribing(true);
    setStatusMessage('음성을 텍스트로 변환 중입니다...');
    try {
      const formData = new FormData();
      formData.append('file', blob, 'answer.webm');

      const res = await fetch('/api/stt', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'STT API 호출에 실패했습니다.');
      }

      const text = data.text || '(인식된 내용 없음)';
      onAnswer(currentQuestionIndex, text);
      setStatusMessage('답변이 저장되었습니다. 다음 질문으로 넘어갑니다.');
      
      setTimeout(() => {
        handleNextQuestion();
        setStatusMessage('버튼을 눌러 녹음을 시작하세요.');
      }, 1500);

    } catch (error) {
      console.error(error);
      setStatusMessage('음성 변환에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(mediaChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        handleTranscription(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatusMessage('녹음 중입니다. 답변을 마치고 버튼을 다시 누르세요.');
    } catch (error) {
      console.error('마이크 접근 오류:', error);
      setStatusMessage('마이크에 접근할 수 없습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // onstop 핸들러가 handleTranscription을 호출합니다.
    }
  };

  const question = QUESTIONS[currentQuestionIndex];
  const buttonDisabled = isRecording || isTranscribing;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px' }}>
      <ProgressBar current={currentQuestionIndex + 1} total={QUESTIONS.length} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '24px' }}>{question}</h2>
        <p style={{ color: 'var(--text-secondary-color)', minHeight: '20px' }}>{statusMessage}</p>
      </div>
      <button 
        onClick={isRecording ? stopRecording : startRecording} 
        disabled={isTranscribing} 
        className="primary-button" 
        style={{ 
            width: '100%',
            backgroundColor: isRecording ? '#F45D5D' : 'var(--primary-color)',
        }}
      >
        {isTranscribing ? '처리 중...' : (isRecording ? '🎙️ 녹음 중단' : '🎙️ 녹음하며 답변하기')}
      </button>
    </div>
  );
}
