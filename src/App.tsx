import { useState } from 'react'
import './App.css'

export function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="app-container">
      <h1>CSE 110 - Team 25</h1>
      <div className="card">
        <button onClick={() => setCount((c) => c + 1)}>
          count is {count}
        </button>
      </div>
    </main>
  )
}

export default App
