const Header = ({ connectionStatus, sessionId, onClearSession, onGetInfo }) => {
  const statusText = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    error: 'Error',
  };

  return (
    <div className="header">
      <div className="header-title">
        <span className="header-icon">🤖</span>
        <span>Live Agent</span>
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
