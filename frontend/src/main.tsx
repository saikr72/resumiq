import React from 'react'
import ReactDOM from 'react-dom/client'
import AuthGate from './components/AuthGate.tsx'
import './index.css'
import './workspace.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>,
)
