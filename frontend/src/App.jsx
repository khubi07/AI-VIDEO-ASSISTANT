import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  const paths = {
    spark: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l2-2A5 5 0 0 0 12 3.9l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    play: <><path d="m8 5 12 7-12 7V5Z" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    pulse: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    video: <><rect x="3" y="5" width="13" height="14" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  }

  return <svg {...common}>{paths[name] || paths.spark}</svg>
}

function App() {
  const [apiStatus, setApiStatus] = useState('checking')
  const [mode, setMode] = useState('link')
  const [url, setUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [jobId, setJobId] = useState('')
  const [jobStatus, setJobStatus] = useState('')
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [isChatting, setIsChatting] = useState(false)
  const [chatError, setChatError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()

    fetch(`${API_BASE_URL}/health`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Health check failed')
        return response.json()
      })
      .then((data) => setApiStatus(data.status === 'ok' ? 'online' : 'offline'))
      .catch((error) => {
        if (error.name !== 'AbortError') setApiStatus('offline')
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!jobId) return undefined

    let cancelled = false
    let timeoutId

    async function checkJob() {
      try {
        const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.detail || 'Could not check job status.')
        if (cancelled) return

        setJobStatus(data.status)
        if (data.status === 'completed') {
          setResult(data.result)
          return
        }
        if (data.status === 'failed') {
          setMessage(data.error || 'Processing failed. Please try again.')
          return
        }

        timeoutId = window.setTimeout(checkJob, 2200)
      } catch (error) {
        if (!cancelled) setMessage(error.message)
      }
    }

    checkJob()
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [jobId])

  function resetForNewJob() {
    setMessage('')
    setChatError('')
    setJobId('')
    setJobStatus('')
    setResult(null)
    setChatMessages([])
  }

  async function readResponse(response, fallback) {
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.detail || fallback)
    return data
  }

  async function startUrlJob(event) {
    event.preventDefault()
    resetForNewJob()
    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_BASE_URL}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await readResponse(response, 'Could not start processing.')
      setJobId(data.job_id)
      setJobStatus(data.status)
      setUrl('')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function startUploadJob(file) {
    if (!file) return
    resetForNewJob()
    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadResponse = await fetch(`${API_BASE_URL}/uploads`, {
        method: 'POST',
        body: formData,
      })
      const uploadData = await readResponse(uploadResponse, 'File upload failed.')

      const processResponse = await fetch(
        `${API_BASE_URL}/uploads/${uploadData.upload_id}/process`,
        { method: 'POST' },
      )
      const processData = await readResponse(processResponse, 'Could not start processing.')
      setJobId(processData.job_id)
      setJobStatus(processData.status)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function sendChat(event) {
    event.preventDefault()
    const question = chatInput.trim()
    if (!question || !jobId || !result) return

    setChatInput('')
    setChatError('')
    setChatMessages((messages) => [...messages, { role: 'user', text: question }])
    setIsChatting(true)

    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await readResponse(response, 'Could not get an answer.')
      setChatMessages((messages) => [...messages, { role: 'assistant', text: data.answer }])
    } catch (error) {
      setChatError(error.message)
    } finally {
      setIsChatting(false)
    }
  }

  const busy = isSubmitting || ['queued', 'processing'].includes(jobStatus)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#workspace" aria-label="Framewise home">
          <span className="brand-mark"><Icon name="spark" size={21} /></span>
          <span>framewise<span className="brand-period">.</span></span>
        </a>

        <div className="side-label">WORKSPACE</div>
        <a className="nav-item nav-item-active" href="#workspace">
          <Icon name="video" /><span>New analysis</span><span className="nav-key">↵</span>
        </a>
        <div className="side-label side-label-spaced">YOUR TOOLKIT</div>
        <div className="tool-card">
          <div className="tool-icon"><Icon name="pulse" /></div>
          <div><strong>Video intelligence</strong><span>Transcribe · understand · ask</span></div>
        </div>

        <div className="sidebar-bottom">
          <div className="side-note-icon"><Icon name="spark" size={16} /></div>
          <p>From long videos<br />to clear next steps.</p>
          <span>AI VIDEO WORKSPACE · V2</span>
        </div>
      </aside>

      <main className="main-content" id="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>New analysis</strong></div>
          <div className={`api-indicator api-${apiStatus}`}>
            <span className="api-dot" />
            <span>{apiStatus === 'online' ? 'API connected' : apiStatus === 'checking' ? 'Connecting…' : 'API offline'}</span>
          </div>
        </header>

        <div className="workspace-content">
          {!result && !busy && (
            <section className="welcome-block">
              <div className="eyebrow"><span className="eyebrow-line" /> YOUR VIDEO, DECODED</div>
              <h1>Make every minute<br /><em>mean something.</em></h1>
              <p className="welcome-copy">Turn a video or recording into a searchable, useful brief.<br className="desktop-break" /> Drop in a link or a file to get started.</p>
            </section>
          )}

          <section className={`ingest-card ${busy ? 'ingest-card-compact' : ''}`}>
            <div className="card-heading">
              <div>
                <span className="step-number">01</span>
                <h2>{busy ? 'Analysis in progress' : 'Bring in your source'}</h2>
              </div>
              {!busy && <span className="time-hint"><Icon name="clock" size={15} /> Takes a few minutes</span>}
            </div>

            {busy ? (
              <div className="processing-panel" aria-live="polite">
                <div className="processing-orbit"><span /><i /><b /></div>
                <div className="processing-copy">
                  <strong>{jobStatus === 'queued' ? 'In the queue' : 'Finding the signal'}</strong>
                  <span>{jobStatus === 'queued' ? 'Your job is getting ready.' : 'Transcribing and building your video brief.'}</span>
                </div>
                <div className="processing-status"><span className="api-dot" />{jobStatus}</div>
              </div>
            ) : (
              <>
                <div className="source-tabs" role="tablist" aria-label="Choose a source type">
                  <button className={mode === 'link' ? 'source-tab active' : 'source-tab'} onClick={() => setMode('link')} type="button" role="tab" aria-selected={mode === 'link'}>
                    <Icon name="link" size={16} /> Video link
                  </button>
                  <button className={mode === 'file' ? 'source-tab active' : 'source-tab'} onClick={() => setMode('file')} type="button" role="tab" aria-selected={mode === 'file'}>
                    <Icon name="upload" size={16} /> Upload a file
                  </button>
                </div>

                {mode === 'link' ? (
                  <form className="link-form" onSubmit={startUrlJob}>
                    <label className="sr-only" htmlFor="video-url">Video URL</label>
                    <div className="url-input-wrap">
                      <Icon name="link" size={18} />
                      <input
                        id="video-url"
                        type="url"
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="Paste a YouTube or video link…"
                        required
                        disabled={isSubmitting || apiStatus !== 'online'}
                      />
                      <span className="url-protocol">HTTPS</span>
                    </div>
                    <button className="primary-button" type="submit" disabled={isSubmitting || !url.trim() || apiStatus !== 'online'}>
                      {isSubmitting ? 'Starting…' : <>Analyze video <Icon name="arrow" size={17} /></>}
                    </button>
                  </form>
                ) : (
                  <div
                    className={`dropzone ${isDragging ? 'dropzone-active' : ''} ${selectedFile ? 'dropzone-selected' : ''}`}
                    onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault()
                      setIsDragging(false)
                      setSelectedFile(event.dataTransfer.files[0] || null)
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      className="file-input"
                      id="media-file"
                      type="file"
                      accept="audio/*,video/*"
                      onChange={(event) => setSelectedFile(event.target.files[0] || null)}
                    />
                    <div className="drop-icon"><Icon name={selectedFile ? 'file' : 'upload'} size={21} /></div>
                    <div className="drop-copy">
                      <strong>{selectedFile ? selectedFile.name : 'Drop a recording here'}</strong>
                      <span>{selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB · Ready to analyze` : 'Audio or video · Up to 200 MB'}</span>
                    </div>
                    <label className="browse-button" htmlFor="media-file">Browse files</label>
                    {selectedFile && (
                      <button className="primary-button upload-button" type="button" disabled={isSubmitting || apiStatus !== 'online'} onClick={() => startUploadJob(selectedFile)}>
                        {isSubmitting ? 'Uploading…' : <>Analyze file <Icon name="arrow" size={17} /></>}
                      </button>
                    )}
                  </div>
                )}
                <div className="privacy-note"><span className="privacy-spark">✳</span> Your source is processed by your local assistant.</div>
              </>
            )}

            {message && <div className="error-banner" role="alert"><span>!</span>{message}</div>}
          </section>

          {result && (
            <section className="results-layout" aria-live="polite">
              <div className="results-column">
                <div className="result-title-row">
                  <div>
                    <div className="eyebrow"><span className="eyebrow-line" /> VIDEO BRIEF</div>
                    <h2>{result.title || 'Untitled video'}</h2>
                  </div>
                  <div className="complete-pill"><Icon name="check" size={15} /> Complete</div>
                </div>

                <article className="brief-card summary-card">
                  <div className="section-label"><span className="section-icon lime"><Icon name="spark" size={16} /></span><span>THE OVERVIEW</span><span className="section-index">01</span></div>
                  <p className="brief-text">{result.summary || 'No summary was returned.'}</p>
                </article>

                <div className="brief-grid">
                  <article className="brief-card">
                    <div className="section-label"><span className="section-icon coral"><Icon name="check" size={16} /></span><span>ACTION ITEMS</span><span className="section-index">02</span></div>
                    <p className="brief-text">{result.action_items || 'No action items found.'}</p>
                  </article>
                  <article className="brief-card">
                    <div className="section-label"><span className="section-icon blue"><Icon name="pulse" size={16} /></span><span>KEY DECISIONS</span><span className="section-index">03</span></div>
                    <p className="brief-text">{result.key_decisions || 'No key decisions found.'}</p>
                  </article>
                </div>

                <article className="brief-card questions-card">
                  <div className="section-label"><span className="section-icon violet"><Icon name="message" size={16} /></span><span>OPEN QUESTIONS</span><span className="section-index">04</span></div>
                  <p className="brief-text">{result.open_questions || 'No open questions found.'}</p>
                </article>

                {result.transcript && (
                  <details className="transcript-details">
                    <summary><Icon name="file" size={16} /> View full transcript</summary>
                    <p>{result.transcript}</p>
                  </details>
                )}
              </div>

              <aside className="chat-panel">
                <div className="chat-panel-head">
                  <div className="chat-avatar"><Icon name="spark" size={18} /></div>
                  <div><span className="chat-kicker">YOUR VIDEO, ON CALL</span><h3>Ask anything</h3></div>
                  <span className="online-mini" title="Ready"><i /></span>
                </div>
                <div className="chat-intro">
                  <span className="chat-time">READY WHEN YOU ARE</span>
                  <p>Ask a question about this video. Answers are grounded in its transcript.</p>
                  <div className="suggestion-label">TRY ASKING</div>
                  {['What are the key takeaways?', 'Who owns the next steps?'].map((prompt) => (
                    <button className="suggestion-chip" key={prompt} type="button" onClick={() => setChatInput(prompt)}>{prompt}<Icon name="arrow" size={14} /></button>
                  ))}
                </div>
                <div className="chat-messages" aria-live="polite">
                  {chatMessages.map((item, index) => (
                    <div className={`chat-message ${item.role}`} key={`${item.role}-${index}`}>
                      <span className="message-role">{item.role === 'user' ? 'YOU' : 'ASSISTANT'}</span>
                      <p>{item.text}</p>
                    </div>
                  ))}
                  {isChatting && <div className="thinking-line"><span /><span /><span /> Thinking through the transcript…</div>}
                </div>
                {chatError && <p className="chat-error" role="alert">{chatError}</p>}
                <form className="chat-form" onSubmit={sendChat}>
                  <label className="sr-only" htmlFor="chat-question">Ask a question about the video</label>
                  <textarea
                    id="chat-question"
                    rows="2"
                    maxLength="2000"
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="Ask about this video…"
                    disabled={isChatting}
                  />
                  <div className="chat-form-foot"><span>Answers use this transcript</span><button className="send-button" type="submit" aria-label="Send question" disabled={isChatting || !chatInput.trim()}><Icon name="arrow" size={18} /></button></div>
                </form>
                <div className="chat-disclaimer">AI can miss details. Check the transcript for context.</div>
              </aside>
            </section>
          )}

          {!result && !busy && (
            <section className="process-strip">
              <div className="process-step"><span className="process-number">01</span><div><strong>Transcribe</strong><span>Speech becomes searchable text</span></div></div>
              <span className="process-connector" />
              <div className="process-step"><span className="process-number">02</span><div><strong>Understand</strong><span>AI finds the useful bits</span></div></div>
              <span className="process-connector" />
              <div className="process-step"><span className="process-number">03</span><div><strong>Ask</strong><span>Explore the video in a chat</span></div></div>
            </section>
          )}

          <footer className="page-footer"><span>FRAMEWISE <b>·</b> VIDEO INTELLIGENCE</span><span>BUILT TO FIND THE SIGNAL</span></footer>
        </div>
      </main>
    </div>
  )
}

export default App
