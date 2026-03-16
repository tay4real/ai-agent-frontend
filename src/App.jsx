import { useCallback, useEffect, useRef, useState } from 'react';
import AudioInput from './components/AudioInput';
import ChatBox from './components/ChatBox';
import Header from './components/Header';
import ImageUpload from './components/ImageUpload';
import './styles.css';

const apiBase = import.meta.env.DEV
  ? 'http://localhost:5000'
  : 'https://mathtutor-agent-backend-1087118236338.us-central1.run.app';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [useTools, setUseTools] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  const socketRef = useRef(null);
  const streamingMessageRef = useRef(null);

  useEffect(() => {
    console.log('🔄 Messages state changed:', messages.length, messages.slice(-1));
  }, [messages]);

  useEffect(() => {
    const connectWebSocket = () => {
      setConnectionStatus('connecting');
      const wsProtocol = apiBase.startsWith('https') ? 'wss://' : 'ws://';
      const wsUrl = apiBase.replace(/^https?:\/\//, wsProtocol);
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        console.log('WebSocket connected to', wsUrl);
        setConnectionStatus('connected');
      };

      socketRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };

      socketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };

      socketRef.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        setTimeout(() => {
          if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
            connectWebSocket();
          }
        }, 3000);
      };
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const handleWebSocketMessage = (data) => {
    console.log('🛰️ WS Message received:', data);
    switch (data.type) {
      case 'session_init':
        setSessionId(data.sessionId);
        setMessages((prev) => [
          ...prev,
          {
            sender: 'system',
            text: `Connected to Live Agent. Session ID: ${data.sessionId}`,
            timestamp: Date.now(),
          },
        ]);
        break;
      case 'stream_start':
        setIsStreaming(true);
        streamingMessageRef.current = { sender: 'ai', text: '', timestamp: Date.now() };
        setMessages((prev) => [...prev, streamingMessageRef.current]);
        break;
      case 'stream_chunk':
        if (streamingMessageRef.current) {
          streamingMessageRef.current.text += data.content;
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = streamingMessageRef.current;
            return newMessages;
          });
        }
        break;
      case 'stream_end':
        setIsStreaming(false);
        streamingMessageRef.current = null;
        break;
      case 'response':
        setMessages((prev) => [
          ...prev,
          { sender: 'ai', text: data.response, timestamp: Date.now() },
        ]);
        break;
      case 'error':
        setMessages((prev) => [
          ...prev,
          {
            sender: 'system',
            text: `❌ Error: ${data.error}`,
            timestamp: Date.now(),
          },
        ]);
        break;
      default:
        if (data.response && !data.type) {
          setMessages((prev) => [
            ...prev,
            { sender: 'ai', text: data.response, timestamp: Date.now() },
          ]);
        }
    }
  };

  const sendMessage = useCallback(() => {
    if (!input.trim() && !image) return;
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setMessages((prev) => [
        ...prev,
        { sender: 'system', text: '❌ Not connected. Backend running?', timestamp: Date.now() },
      ]);
      return;
    }

    const preview = image ? `data:image/jpeg;base64,${image}` : null;
    const userText = input.trim() || '[Image]';
    setMessages((prev) => [
      ...prev,
      { sender: 'user', text: userText, image: preview, timestamp: Date.now() },
    ]);

    const payload = image
      ? { type: 'image', image, text: input.trim() || null, useTools }
      : { type: useTools ? 'tools' : 'text', text: input, useTools };

    socketRef.current.send(JSON.stringify(payload));
    setInput('');
    setImage(null);
  }, [input, image, useTools]);

  const sendStreamingMessage = async () => {
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { sender: 'user', text: input, timestamp: Date.now() }]);
    setIsStreaming(true);

    try {
      const response = await fetch(`${apiBase}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input, sessionId }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      streamingMessageRef.current = { sender: 'ai', text: '', timestamp: Date.now() };
      setMessages((prev) => [...prev, streamingMessageRef.current]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk') {
                streamingMessageRef.current.text += data.content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = streamingMessageRef.current;
                  return newMessages;
                });
              }
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      setMessages((prev) => [
        ...prev,
        { sender: 'system', text: `❌ ${error.message}`, timestamp: Date.now() },
      ]);
    } finally {
      setIsStreaming(false);
      streamingMessageRef.current = null;
      setInput('');
    }
  };

  const handleAudioSend = async (file) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Audio = reader.result.split(',')[1];
      socketRef.current.send(
        JSON.stringify({ type: 'audio', audio: base64Audio, mimeType: 'audio/webm' })
      );
      setMessages((prev) => [...prev, { sender: 'user', text: '🎤 Audio', timestamp: Date.now() }]);
    };
    reader.readAsDataURL(file);
  };

  const clearSession = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'clear' }));
    }
    setMessages([]);
  };

  const getSessionInfo = async () => {
    try {
      const response = await fetch(`${apiBase}/api/session/info?sessionId=${sessionId}`);
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { sender: 'system', text: JSON.stringify(data.info, null, 2), timestamp: Date.now() },
      ]);
    } catch (error) {
      console.error('Session info error:', error);
    }
  };

  return (
    <div className="app">
      <Header
        connectionStatus={connectionStatus}
        sessionId={sessionId}
        onClearSession={clearSession}
        onGetInfo={getSessionInfo}
      />
      <ChatBox
        key={`chat-${messages.length}-${isStreaming}`}
        messages={messages}
        isStreaming={isStreaming}
      />
      <div className="image-upload">
        <ImageUpload setImage={setImage} image={image} />
      </div>
      <div className="input-area">
        <AudioInput onSend={handleAudioSend} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a math question..."
          disabled={isStreaming}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <button
          onClick={sendMessage}
          disabled={isStreaming || (!input.trim() && !image)}
          className={useTools ? 'tools-active' : ''}
        >
          Send
        </button>
        <button
          onClick={sendStreamingMessage}
          disabled={isStreaming || !input.trim()}
          title="Stream"
        >
          ⏩
        </button>
        <button
          onClick={() => setUseTools(!useTools)}
          className={useTools ? 'tools-active' : ''}
          title="Tools"
        >
          🔧
        </button>
      </div>
      <div className="status-bar">
        <span className={`connection-indicator ${connectionStatus}`}>
          {connectionStatus === 'connected'
            ? '🟢'
            : connectionStatus === 'connecting'
              ? '🟡'
              : '🔴'}
        </span>
        <span>{sessionId ? `Session: ${sessionId.slice(0, 15)}...` : 'No session'}</span>
        <span>{useTools ? '🔧 Tools ON' : '🔧 Tools OFF'}</span>
      </div>
    </div>
  );
}

export default App;
