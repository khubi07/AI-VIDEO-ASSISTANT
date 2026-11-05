import { useEffect, useState } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

function App() {
  const [apiStatus, setApiStatus] = useState('Checking…')
  const [url, setUrl] = useState('')
  const [jobId, setJobId] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then((response) => {
        if (!response.ok) throw new Error('Health check failed')
        return response.json()
      })
      .then((data) => setApiStatus(data.status))
      .catch(() => setApiStatus('Unavailable'))
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setJobId('')
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
      setMessage(`Processing started (${data.status}).`)
      setUrl('')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsSubmitting(false)
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

      {message && <p role="status">{message}</p>}
      {jobId && <p>Job ID: {jobId}</p>}
    </main>
  )
}

export default App