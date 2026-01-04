import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { DateFormatProvider } from './context/DateFormatContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <DateFormatProvider>
        <App />
      </DateFormatProvider>
    </AuthProvider>
  </StrictMode>,
)
