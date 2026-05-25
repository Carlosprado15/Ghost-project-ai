import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App_FINAL.jsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
