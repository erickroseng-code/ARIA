import React, { useRef, useState } from 'react';

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

/**
 * AudioRecorder Component
 * - Records audio using Web Audio API
 * - Encodes to WAV format
 * - Sends to API for transcription
 * - Shows loading state during processing
 */
export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscription,
  onError,
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = 'audio/webm;codecs=opus';
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'audio/webm',
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to access microphone';
      onError?.(errorMsg);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('format', 'webm');

      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await response.json();
      onTranscription(data.text);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Transcription error';
      onError?.(errorMsg);
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="audio-recorder">
      {isTranscribing && (
        <div className="transcribing-indicator">
          <span className="spinner">🎙️</span>
          <span>Transcrevendo...</span>
        </div>
      )}

      {!isRecording && !isTranscribing && (
        <button
          onClick={startRecording}
          disabled={disabled}
          className="btn-record"
          title="Click to start recording"
        >
          🎤 Gravar
        </button>
      )}

      {isRecording && (
        <button
          onClick={stopRecording}
          className="btn-stop recording"
          title="Click to stop recording"
        >
          ⏹️ Parar
        </button>
      )}

      <style jsx>{`
        .audio-recorder {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 8px;
          background-color: #f5f5f5;
        }

        .btn-record,
        .btn-stop {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          background-color: #4a90e2;
          color: white;
        }

        .btn-record:hover:not(:disabled) {
          background-color: #357abd;
          transform: scale(1.05);
        }

        .btn-record:disabled {
          background-color: #ccc;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .btn-stop {
          background-color: #e24a4a;
          animation: pulse 1s infinite;
        }

        .btn-stop:hover {
          background-color: #bd3535;
        }

        .btn-stop.recording {
          background-color: #ff6b6b;
        }

        .transcribing-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #4a90e2;
          font-weight: 500;
        }

        .spinner {
          font-size: 18px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
};
