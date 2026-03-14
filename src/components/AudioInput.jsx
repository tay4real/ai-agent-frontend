import { useEffect, useRef, useState } from 'react';

const AudioInput = ({ onSend }) => {
  const [recording, setRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);

  const startRecording = async () => {
    try {
      setRecording(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio analysis for visual feedback
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      const updateAudioLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 255);
        animationRef.current = requestAnimationFrame(updateAudioLevel);
      };
      updateAudioLevel();

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'audio.webm');
        onSend(file);

        // Cleanup
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        stream.getTracks().forEach((track) => track.stop());
        setAudioLevel(0);
      };

      mediaRecorderRef.current.start(100); // Collect data every 100ms
    } catch (error) {
      console.error('Error starting recording:', error);
      setRecording(false);
    }
  };

  const stopRecording = () => {
    setRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="audio-input-container">
      <button
        onClick={recording ? stopRecording : startRecording}
        className={`record-btn ${recording ? 'recording' : ''}`}
        title={recording ? 'Stop Recording' : 'Start Recording'}
      >
        <span className="mic-icon">🎤</span>
        {recording ? 'Stop' : 'Record'}
      </button>

      {recording && (
        <div className="audio-level-indicator">
          <div className="audio-level-bar" style={{ width: `${audioLevel * 100}%` }} />
        </div>
      )}
    </div>
  );
};

export default AudioInput;
