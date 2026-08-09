import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App_FINAL'
import ReplayLab from './ReplayLab'
import WebARRocksLab from './WebARRocksLab'
import DeepARLab from './DeepARLab'
import TasksWristLab from './labs/tasks-wrist/TasksWristLab'
import GLBValidationLab from './labs/GLBValidationLab'
import ProductCalibrationLab from './labs/ProductCalibrationLab'
import MaterialABLab from './labs/MaterialABLab'

const lab = new URLSearchParams(window.location.search).get('lab');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {lab === 'replay'            ? <ReplayLab />             :
     lab === 'webarrocks'        ? <WebARRocksLab />         :
     lab === 'deepar'            ? <DeepARLab />             :
     lab === 'tasks-wrist'       ? <TasksWristLab />         :
     lab === 'validate-glb'      ? <GLBValidationLab />      :
     lab === 'calibrate-product' ? <ProductCalibrationLab /> :
     lab === 'material-ab'       ? <MaterialABLab />         :
     <App />}
  </StrictMode>,
)
