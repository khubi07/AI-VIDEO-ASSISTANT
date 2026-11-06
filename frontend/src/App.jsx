import { useEffect, useState } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

function App() {
  const [apiStatus, setApiStatus] = useState('Checking…')
  const [url, setUrl] = useState('')
  const [jobId, setJobId] = useState('')
  const [jobStatus, setJobStatus] = useState('')
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [isChatting, setIsChatting] = useState(false)
  const [chatError, setChatError] = useState('')

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then((response) => {
        if (!response.ok) throw new Error('Health check failed')
        return response.json()
      })
      .then((data) => setApiStatus(data.status))
      .catch(() => setApiStatus('Unavailable'))
  }, [])

  useEffect(() => {
    if (!jobId) return

    let cancelled = false
    let timeoutId

    async function checkJob() {
      try {
        const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.detail || 'Could not check job status.')
        }

        if (cancelled) return

        setJobStatus(data.status)

        if (data.status === 'completed') {
          setResult(data.result)
          return
        }

        if (data.status === 'failed') {
          setMessage(data.error || 'Video processing failed.')
          return
        }

        // Check again in two seconds while the job is queued or processing.
        timeoutId = setTimeout(checkJob, 2000)
      } catch (error) {
        if (!cancelled) setMessage(error.message)
      }
    }

    checkJob()

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [jobId])

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setJobId('')
    setJobStatus('')
    setResult(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_BASE_URL}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Could not start video processing.')
      }

      setJobId(data.job_id)
      setJobStatus(data.status)
      setUrl('')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpload(event) {
  event.preventDefault()

  if (!selectedFile) {
    setMessage('Choose an audio or video file first.')
    return
  }

  setMessage('')
  setJobId('')
  setJobStatus('')
  setResult(null)
  setIsSubmitting(true)

  try {
    const formData = new FormData()
    formData.append('file', selectedFile)

    const uploadResponse = await fetch(`${API_BASE_URL}/uploads`, {
      method: 'POST',
      body: formData,
    })
    const uploadData = await uploadResponse.json()

    if (!uploadResponse.ok) {
      throw new Error(uploadData.detail || 'File upload failed.')
    }

    const processResponse = await fetch(
      `${API_BASE_URL}/uploads/${uploadData.upload_id}/process`,
      { method: 'POST' },
    )
    const processData = await processResponse.json()

    if (!processResponse.ok) {
      throw new Error(processData.detail || 'Could not start processing.')
    }

    setJobId(processData.job_id)
    setJobStatus(processData.status)
    setSelectedFile(null)
  } catch (error) {
    setMessage(error.message)
  } finally {
    setIsSubmitting(false)
  }
}

async function handleChatSubmit(event) {
  event.preventDefault()

  const question = chatInput.trim()
  if (!question || !jobId) return

  setChatInput('')
  setChatError('')
  setChatMessages((messages) => [
    ...messages,
    { role: 'user', text: question },
  ])
  setIsChatting(true)

  try {
    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || 'Could not get an answer.')
    }

    setChatMessages((messages) => [
      ...messages,
      { role: 'assistant', text: data.answer },
    ])
  } catch (error) {
    setChatError(error.message)
  } finally {
    setIsChatting(false)
  }
}

  return (
    <main>
      <h1>Video Assistant</h1>
      <p>Backend status: {apiStatus}</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="video-url">Video URL</label>
        <input
          id="video-url"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Paste a video link"
          required
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Starting…' : 'Process video'}
        </button>
      </form>

      <form onSubmit={handleUpload}>
        <label htmlFor="media-file">Or choose an audio/video file</label>
        <input
          id="media-file"
          type="file"
          accept="audio/*,video/*"
          onChange={(event) => setSelectedFile(event.target.files[0] || null)}
        />
        <button type="submit" disabled={isSubmitting || !selectedFile}>
          {isSubmitting ? 'Uploading…' : 'Upload and process'}
        </button>
      </form>

<h3>Ask about this video</h3>

<div aria-live="polite">
  {chatMessages.map((message, index) => (
    <p key={`${message.role}-${index}`}>
      <strong>{message.role === 'user' ? 'You' : 'Assistant'}:</strong>{' '}
      {message.text}
    </p>
  ))}
</div>

<form onSubmit={handleChatSubmit}>
  <label htmlFor="chat-question">Your question</label>
  <input
    id="chat-question"
    value={chatInput}
    onChange={(event) => setChatInput(event.target.value)}
    placeholder="Ask something from the transcript"
    required
  />
  <button type="submit" disabled={isChatting || !chatInput.trim()}>
    {isChatting ? 'Thinking…' : 'Ask'}
  </button>
</form>

{chatError && <p role="alert">{chatError}</p>}

      {jobId && (
        <section aria-live="polite">
          <h2>Processing status</h2>
          <p>{jobStatus}</p>
          <p>Job ID: {jobId}</p>
        </section>
      )}

      {message && <p role="alert">{message}</p>}

      {result && (
        <section>
          <h2>{result.title}</h2>

          <h3>Summary</h3>
          <p>{result.summary}</p>

          <h3>Action items</h3>
          <p>{result.action_items}</p>

          <h3>Key decisions</h3>
          <p>{result.key_decisions}</p>

          <h3>Open questions</h3>
          <p>{result.open_questions}</p>
        </section>
      )}
    </main>
  )
}

export default App