import { useCallback, useEffect, useRef, useState } from 'react';
import AudioInput from './components/AudioInput';
import ChatBox from './components/ChatBox';
import Header from './components/Header';
import ImageUpload from './components/ImageUpload';
import './styles.css';

const API_BASE = 'http://localhost:5000';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [useTools, setUseTools] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  // Debug: Log messages state changes
  useEffect(() => {
    console.log('🔄 Messages state changed:', messages.length, messages.slice(-1));
  }, [messages]);

  const socketRef = useRef(null);
  const streamingMessageRef = useRef(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      setConnectionStatus('connecting');
      socketRef.current = new WebSocket('ws://localhost:5000');

      socketRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
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
        setIsConnected(false);
        setConnectionStatus('disconnected');

        // Attempt reconnection after 3 seconds
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

  // Handle incoming WebSocket messages
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
        console.log('📦 WS stream_chunk:', data.content.length, 'chars');
        if (streamingMessageRef.current) {
          streamingMessageRef.current.text += data.content;
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = streamingMessageRef.current;
            console.log('📝 Messages after chunk:', newMessages.length);
            return newMessages;
          });
        }
        break;

      case 'stream_end':
        setIsStreaming(false);
        streamingMessageRef.current = null;
        break;

      case 'function_calls':
        // Display function calls
        setMessages((prev) => [
          ...prev,
          {
            sender: 'system',
            text: `🔧 Function calls: ${data.calls.map((c) => c.name).join(', ')}`,
            timestamp: Date.now(),
          },
        ]);
        // Display results
        data.results.forEach((result) => {
          setMessages((prev) => [
            ...prev,
            {
              sender: 'system',
              text: `📊 ${result.name}: ${JSON.stringify(result.result)}`,
              timestamp: Date.now(),
            },
          ]);
        });
        break;

      case 'response':
        console.log('📨 WS RESPONSE received, adding AI message');
        setMessages((prev) => {
          const newMsgs = [...prev, { sender: 'ai', text: data.response, timestamp: Date.now() }];
          console.log('📝 Messages after response:', newMsgs.length, newMsgs[newMsgs.length - 1]);
          return newMsgs;
        });
        break;

      case 'audio_processing':
        setMessages((prev) => [
          ...prev,
          { sender: 'system', text: '🎤 Processing audio...', timestamp: Date.now() },
        ]);
        break;

      case 'audio_response':
        setMessages((prev) => [
          ...prev,
          { sender: 'ai', text: data.response, timestamp: Date.now() },
        ]);
        break;

      case 'image_processing':
        setMessages((prev) => [
          ...prev,
          { sender: 'system', text: '🖼️ Processing image...', timestamp: Date.now() },
        ]);
        break;

      case 'image_response':
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
            text: `❌ Error: ${data.error}${data.details ? ` (${data.details})` : ''}`,
            timestamp: Date.now(),
          },
        ]);
        break;

      case 'session_cleared':
        setMessages((prev) => [
          ...prev,
          { sender: 'system', text: '🗑️ Session cleared', timestamp: Date.now() },
        ]);
        break;

      default:
        // Fix: Handle backend sending plain {response: "..."} without type
        if (data.response && !data.type) {
          console.log('📨 WS PLAIN RESPONSE detected, treating as "response"');
          setMessages((prev) => {
            const newMsgs = [...prev, { sender: 'ai', text: data.response, timestamp: Date.now() }];
            console.log('📝 Messages after plain response:', newMsgs.length);
            return newMsgs;
          });
          break;
        }
        console.log('Unknown message type:', data);
    }
  };

  // Send text message via WebSocket
  const sendMessage = useCallback(() => {
    if (!input.trim() && !image) return;
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'system',
          text: '❌ Error: Not connected to server. Please ensure the backend is running.',
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    // Create image preview URL for display (dataURL)
    const preview = image ? `data:image/jpeg;base64,${image}` : null;
    const userText = input.trim() || '[Image uploaded]';

    // Add user message with image if present
    setMessages((prev) => [
      ...prev,
      {
        sender: 'user',
        text: userText,
        image: preview,
        timestamp: Date.now(),
      },
    ]);

    // Unified image payload (backend recognizes 'image')
    let payload;
    if (image) {
      payload = {
        type: 'image',
        image: image,
        text: input.trim() || null,
        useTools: useTools,
      };
    } else {
      payload = {
        type: useTools ? 'tools' : 'text',
        text: input,
        useTools: useTools,
      };
    }

    console.log('📤 Sending WS payload:', payload.type, 'with image:', !!image);
    socketRef.current.send(JSON.stringify(payload));

    setInput('');
    setImage(null);
  }, [input, image, useTools]);

  // Send message via REST API (streaming)
  const sendStreamingMessage = async () => {
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { sender: 'user', text: input, timestamp: Date.now() }]);
    setIsStreaming(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input, sessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to stream message');
      }

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
              if (data.type === 'chunk' && streamingMessageRef.current) {
                streamingMessageRef.current = {
                  ...streamingMessageRef.current,
                  text: streamingMessageRef.current.text + data.content,
                };
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = streamingMessageRef.current;
                  return newMessages;
                });
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      setMessages((prev) => [
        ...prev,
        { sender: 'system', text: `❌ Error: ${error.message}`, timestamp: Date.now() },
      ]);
    } finally {
      setIsStreaming(false);
      streamingMessageRef.current = null;
      setInput('');
    }
  };

  // Handle audio recording and send
  const handleAudioSend = async (file) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Audio = reader.result.split(',')[1];
      socketRef.current.send(
        JSON.stringify({
          type: 'audio',
          audio: base64Audio,
          mimeType: 'audio/webm',
        })
      );
      setMessages((prev) => [
        ...prev,
        { sender: 'user', text: '🎤 [Audio message]', timestamp: Date.now() },
      ]);
    };
    reader.readAsDataURL(file);
  };

  // Send audio via REST API
  const handleAudioSendREST = async (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Audio = reader.result.split(',')[1];

      setMessages((prev) => [
        ...prev,
        { sender: 'user', text: '🎤 [Audio message]', timestamp: Date.now() },
        { sender: 'system', text: '🎤 Processing audio...', timestamp: Date.now() },
      ]);

      try {
        const response = await fetch(`${API_BASE}/api/audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: base64Audio, mimeType: file.type, sessionId }),
        });

        const data = await response.json();

        setMessages((prev) => [
          ...prev,
          { sender: 'ai', text: data.response, timestamp: Date.now() },
        ]);
      } catch (error) {
        console.error('Audio error:', error);
        setMessages((prev) => [
          ...prev,
          { sender: 'system', text: `❌ Error: ${error.message}`, timestamp: Date.now() },
        ]);
      }
    };
    reader.readAsDataURL(file);
  };

  // Clear session
  const clearSession = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'clear' }));
    }
    setMessages([]);
  };

  // Get session info
  const getSessionInfo = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`${API_BASE}/api/session/info?sessionId=${sessionId}`);
      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          sender: 'system',
          text: `📊 Session Info: ${JSON.stringify(data.info, null, 2)}`,
          timestamp: Date.now(),
        },
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
          placeholder="Ask a question..."
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
          title="Stream response"
        >
          ⏩
        </button>

        <button
          onClick={() => setUseTools(!useTools)}
          className={useTools ? 'tools-active' : ''}
          title="Toggle AI tools"
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
        <span className="session-info">
          {sessionId ? `Session: ${sessionId.slice(0, 15)}...` : 'No session'}
        </span>
        <span className="tools-indicator">
          {useTools ? '🔧 Tools Enabled' : '🔧 Tools Disabled'}
        </span>
      </div>
    </div>
  );
}

export default App;
