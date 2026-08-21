import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { useTemaStore } from './store/tema'
import { useDensidadeStore } from './store/densidade'

// Aplica tema/dark mode e densidade antes do primeiro render (evita "flash" de
// cor errada e de as linhas pularem de altura ao hidratar)
useTemaStore.getState().aplicar()
useDensidadeStore.getState().aplicar()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
