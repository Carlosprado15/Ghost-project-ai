import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App_FINAL'
import ReplayLab from './ReplayLab'
import WebARRocksLab from './WebARRocksLab'

const lab = new URLSearchParams(window.location.search).get('lab');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {lab === 'replay'     ? <ReplayLab />     :
     lab === 'webarrocks' ? <WebARRocksLab /> :
     <App />}
  </StrictMode>,
)
