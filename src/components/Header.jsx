const Header = ({ connectionStatus, /* sessionId, */ onClearSession, onGetInfo }) => {
  const statusText = {
    connected: '✅ Ready to solve',
    connecting: '🔄 Loading math engine...',
    disconnected: '❌ Disconnected',
    error: '❌ Error',
  };

  return (
    <div className="header">
      <div className="header-title">
        <span className="header-icon">📐</span>
        <span>Math Tutor AI Agent</span>
      </div>
      <div className="header-actions">
        <button className="header-btn" onClick={onGetInfo} title="Session Info">
          ℹ️
        </button>
        <button className="header-btn" onClick={onClearSession} title="Clear Session">
          🗑️
        </button>
        <span className={`status-badge ${connectionStatus}`}>
          {statusText[connectionStatus] || 'Unknown'}
        </span>
      </div>
    </div>
  );
};

export default Header;
