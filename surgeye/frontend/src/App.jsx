import { useEffect, useState, useRef, useCallback } from 'react'
import './App.css'

function App() {
  const [counts, setCounts] = useState({})
  const [alerts, setAlerts] = useState([])
  const [frame, setFrame] = useState('')
  const [connected, setConnected] = useState(false)
  const [procedureStarted, setProcedureStarted] = useState(false)
  const [procedureEnded, setProcedureEnded] = useState(false)
  const [checkResult, setCheckResult] = useState(null)
  const [baseline, setBaseline] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [screenshots, setScreenshots] = useState([])
  const [showTimeline, setShowTimeline] = useState(false)
  const [showScreenshots, setShowScreenshots] = useState(false)
  const [wsStatus, setWsStatus] = useState('connecting') // 'connected', 'reconnecting', 'offline'
  
  const wsRef = useRef(null)
  const audioRef = useRef(new Audio('/alert.mp3'))
  const timelineIntervalRef = useRef(null)
  const reconnectTimerRef = useRef(null)

  // Connect to WebSocket with auto-reconnect
  useEffect(() => {
    const connect = () => {
      console.log('[WS] Connecting...')
      setWsStatus('connecting')
      
      wsRef.current = new WebSocket('ws://localhost:8005/ws')
      
      wsRef.current.onopen = () => {
        console.log('[WS] Connected!')
        setWsStatus('connected')
        setConnected(true)
      }
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.error) {
            console.error('[WS] Error:', data.error)
            return
          }
          
          setFrame(data.frame)
          setCounts(data.counts)
          setProcedureStarted(data.procedure_started)
          setProcedureEnded(data.procedure_ended)
          
          if (data.baseline) {
            setBaseline(data.baseline)
          }
          
          if (data.alerts?.length > 0) {
            setAlerts(data.alerts)
            audioRef.current.play().catch(e => {})
          } else {
            setAlerts([])
          }
        } catch (e) {
          console.error('[WS] Parse error:', e)
        }
      }
      
      wsRef.current.onclose = () => {
        console.log('[WS] Disconnected, retrying in 2s...')
        setWsStatus('reconnecting')
        setConnected(false)
        reconnectTimerRef.current = setTimeout(connect, 2000)
      }
      
      wsRef.current.onerror = (error) => {
        console.log('[WS] Error:', error)
        wsRef.current?.close()
      }
    }
    
    connect()
    
    return () => {
      clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [])

  // Set baseline (pre-op)
  const setBaselineCount = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8005/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()
      
      if (data.status === 'baseline set') {
        setProcedureStarted(true)
        setBaseline(data.counts)
        alert(`✅ Baseline set: ${Object.entries(data.counts).map(([k, v]) => `${v}x ${k}`).join(', ')}`)
      } else {
        alert('⚠️ ' + data.message)
      }
    } catch (error) {
      console.error('Error setting baseline:', error)
      alert('❌ Failed to set baseline')
    }
  }, [])

  // Post-op check
  const performCheck = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8005/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()
      setCheckResult(data)
      setProcedureEnded(true)
    } catch (error) {
      console.error('Error performing check:', error)
      alert('❌ Failed to perform check')
    }
  }, [])

  // Reset for new procedure
  const resetProcedure = useCallback(async () => {
    try {
      await fetch('http://localhost:8005/reset', { method: 'POST' })
      setProcedureStarted(false)
      setProcedureEnded(false)
      setCheckResult(null)
      setBaseline(null)
      setAlerts([])
      setCounts({})
      setTimeline([])
      setScreenshots([])
    } catch (error) {
      console.error('Error resetting:', error)
    }
  }, [])

  // Fetch timeline periodically
  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const response = await fetch('http://localhost:8005/timeline')
        const data = await response.json()
        setTimeline(data.timeline || [])
      } catch (error) {
        console.error('Error fetching timeline:', error)
      }
    }

    const fetchScreenshots = async () => {
      try {
        const response = await fetch('http://localhost:8005/alerts/screenshots')
        const data = await response.json()
        setScreenshots(data.screenshots || [])
      } catch (error) {
        console.error('Error fetching screenshots:', error)
      }
    }

    if (procedureStarted) {
      fetchTimeline()
      fetchScreenshots()
      timelineIntervalRef.current = setInterval(() => {
        fetchTimeline()
        fetchScreenshots()
      }, 2000)
    }

    return () => {
      if (timelineIntervalRef.current) {
        clearInterval(timelineIntervalRef.current)
      }
    }
  }, [procedureStarted])

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1 className="logo">🔬 SurgEye</h1>
        <div className="status">
          {/* WebSocket Connection Status */}
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
            wsStatus === 'connected'    ? 'bg-green-500 text-white' :
            wsStatus === 'reconnecting' ? 'bg-yellow-500 text-black' : 
                                          'bg-red-500 text-white'
          }`}>
            {wsStatus === 'connected'    ? '🟢 Live' :
             wsStatus === 'reconnecting' ? '🟡 Reconnecting...' : 
                                           '🔴 Offline'}
          </span>
          
          {procedureStarted && (
            <span className="procedure-status">
              {procedureEnded ? '⏹️ Procedure Ended' : '🔴 Procedure Active'}
            </span>
          )}
        </div>
      </header>

      <div className="main-content">
        {/* Video Feed */}
        <div className="video-section">
          <div className="video-container">
            {frame ? (
              <img 
                src={`data:image/jpeg;base64,${frame}`} 
                alt="Surgical Feed" 
                className="video-feed"
              />
            ) : (
              <div className="no-feed">
                <p>Waiting for video feed...</p>
                <p className="subtext">Ensure camera is connected and server is running</p>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="controls">
            {!procedureStarted ? (
              <button 
                className="btn btn-primary"
                onClick={setBaselineCount}
                disabled={!connected}
              >
                🟢 Set Baseline (Pre-op)
              </button>
            ) : (
              <>
                {!procedureEnded ? (
                  <button 
                    className="btn btn-check"
                    onClick={performCheck}
                  >
                    🔍 End Procedure & Check
                  </button>
                ) : (
                  <button 
                    className="btn btn-reset"
                    onClick={resetProcedure}
                  >
                    🔄 New Procedure
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          {/* Instrument Count */}
          <div className="panel">
            <h2 className="panel-title">📊 Instrument Count</h2>
            {Object.keys(counts).length === 0 ? (
              <p className="no-data">No instruments detected</p>
            ) : (
              <div className="count-list">
                {Object.entries(counts).map(([cls, info]) => (
                  <div key={cls} className="count-item">
                    <div className="count-info">
                      <span className="count-name">{cls.replace('_', ' ')}</span>
                      {info.avg_confidence && (
                        <span className={`confidence-badge ${
                          info.avg_confidence >= 0.8 ? 'high' : 
                          info.avg_confidence >= 0.6 ? 'medium' : 'low'
                        }`}>
                          {(info.avg_confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <span className={`count-value ${
                      baseline && baseline[cls]?.count !== info.count ? 'mismatch' : ''
                    }`}>
                      {info.count}
                      {baseline && baseline[cls] && (
                        <span className="baseline"> / {baseline[cls].count}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="panel panel-alert">
              <h2 className="panel-title">🚨 Alerts</h2>
              {alerts.map((alert, i) => (
                <div key={i} className="alert-item">
                  {alert}
                </div>
              ))}
            </div>
          )}

          {/* Post-op Check Result */}
          {checkResult && (
            <div className={`panel ${checkResult.passed ? 'panel-success' : 'panel-fail'}`}>
              <h2 className="panel-title">
                {checkResult.passed ? '✅ PASS' : '❌ FAIL'}
              </h2>
              
              {checkResult.passed ? (
                <p>All instruments accounted for!</p>
              ) : (
                <>
                  <p className="fail-message">Instrument count mismatch detected</p>
                  {checkResult.mismatches?.length > 0 && (
                    <div className="mismatch-list">
                      {checkResult.mismatches.map((m, i) => (
                        <div key={i} className="mismatch-item">
                          <strong>{m.class}</strong>: 
                          Expected {m.expected}, Found {m.actual}
                          {m.difference > 0 ? ` (+${m.difference})` : ` (${m.difference})`}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Instrument Timeline */}
          {procedureStarted && timeline.length > 0 && (
            <div className="panel">
              <div className="panel-header" onClick={() => setShowTimeline(!showTimeline)}>
                <h2 className="panel-title">📜 Timeline ({timeline.length})</h2>
                <span className="toggle-icon">{showTimeline ? '▼' : '▶'}</span>
              </div>
              {showTimeline && (
                <div className="timeline">
                  {timeline.slice(-10).reverse().map((event, i) => (
                    <div key={i} className={`timeline-item ${event.action}`}>
                      <span className="timeline-time">{event.time}</span>
                      <span className="timeline-instrument">{event.instrument}</span>
                      <span className={`timeline-action ${event.action}`}>
                        {event.action === 'missing' && '⚠️ MISSING'}
                        {event.action === 'returned' && '✅ Returned'}
                        {event.action === 'detected' && '👁️ Detected'}
                        {event.action === 'baseline_set' && '📋 Baseline'}
                      </span>
                      {event.confidence && (
                        <span className="timeline-confidence">
                          {(event.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Alert Screenshots */}
          {screenshots.length > 0 && (
            <div className="panel">
              <div className="panel-header" onClick={() => setShowScreenshots(!showScreenshots)}>
                <h2 className="panel-title">📸 Alert Screenshots ({screenshots.length})</h2>
                <span className="toggle-icon">{showScreenshots ? '▼' : '▶'}</span>
              </div>
              {showScreenshots && (
                <div className="screenshots-list">
                  {screenshots.slice(0, 5).map((screenshot, i) => (
                    <div key={i} className="screenshot-item">
                      <span className="screenshot-name">{screenshot}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          {!procedureStarted && (
            <div className="panel panel-info">
              <h2 className="panel-title">📋 Instructions</h2>
              <ol className="instructions">
                <li>Ensure all surgical instruments are visible</li>
                <li>Click "Set Baseline" to record initial count</li>
                <li>Perform surgery - SurgEye will track instruments</li>
                <li>Click "End Procedure & Check" for final count</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
