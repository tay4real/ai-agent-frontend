import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

const ChatBox = ({ messages, isStreaming }) => {
  const chatBoxRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  return (
    <div className="chatbox" ref={chatBoxRef}>
      {messages.length === 0 && (
        <div className="welcome-message">
          <p>📐 Welcome to Math Tutor AI Agent!</p>
          <p>
            Your multimodal math tutor. Ask math questions, upload images of problems, or speak
            equations:
          </p>
          <ul>
            <li>📝 "Solve x² + 5x + 6 = 0"</li>
            <li>📷 Upload handwritten math problems</li>
            <li>🎤 Speak equations or proofs</li>
            <li>🔧 Advanced tools for step-by-step solutions</li>
          </ul>
        </div>
      )}

      {messages.map((msg, index) => (
        <div
          key={index}
          className={`message ${msg.sender} ${isStreaming && msg.sender === 'ai' && index === messages.length - 1 ? 'streaming' : ''}`}
        >
          {msg.sender === 'system' ? (
            <div className="system-message">{msg.text}</div>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {msg.text}
            </ReactMarkdown>
          )}

          {/* Render uploaded image if present */}
          {msg.image && (
            <img
              src={msg.image}
              alt="Uploaded image"
              className="chat-image"
              style={{ maxWidth: '300px', borderRadius: '8px', marginTop: '8px' }}
            />
          )}

          {isStreaming && msg.sender === 'ai' && index === messages.length - 1 && (
            <span className="typing-indicator">▊</span>
          )}
        </div>
      ))}
    </div>
  );
};

export default ChatBox;
