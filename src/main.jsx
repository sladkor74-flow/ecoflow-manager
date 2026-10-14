import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { base44 } from '@/api/base44Client'
import { installaRegistroErrori } from '@/lib/registroErrori'

// Il registro degli errori del sito (14/10/2026): prima della prima pagina, cosi'
// anche un errore all'avvio arriva all'amministratore. Aggancia gli errori non
// presi e le chiamate fallite del client; la guardia delle scritture
// (proteggiScritture, in Layout) si mette dopo e passa da qui senza avvolgere
// due volte. Se non si installa, il gestionale va avanti com'era.
installaRegistroErrori(base44)

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
