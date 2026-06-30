import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App_FINAL'
import ReplayLab from './ReplayLab'

const isReplayLab = new URLSearchParams(window.location.search).get('lab') === 'replay';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isReplayLab ? <ReplayLab /> : <App />}
  </StrictMode>,
)
