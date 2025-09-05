import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import App from './App.jsx'

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
