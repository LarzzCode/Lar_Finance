import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// HAPUS IMPORT BROWSERROUTER DARI SINI
// import { BrowserRouter } from 'react-router-dom' <--- Hapus ini jika ada

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* HAPUS <BrowserRouter> PEMBUNGKUS APP */}
    <App />
    {/* HAPUS PENUTUP </BrowserRouter> */}
  </React.StrictMode>,
)