
import { useEffect, useState } from 'react'
import { SceneController } from './ui_behavior/SceneController.ts'
import { LevelScreen } from './ui/LevelScreen.ts'
import './App.css'

export function App() {
  const [showLevel1, setShowLevel1] = useState(false)

  useEffect(() => {
    const scene = new SceneController(() => setShowLevel1(true))

    return () => {
      scene.destroy()
    }
  }, [])

  useEffect(() => {
    if (!showLevel1) return

    const level = new LevelScreen()

    return () => {
      level.destroy()
    }
  }, [showLevel1])

  return (
    <>
      <div
        id="container"
        style={{ display: showLevel1 ? 'none' : 'block' }}
      />

      {showLevel1 && (
        <main className="level-screen">
          <h1>Level 1: The OR Gate</h1>

          <div id="progress-dots"></div>

          <div id="konva-container"></div>

          <div id="palette-grid"></div>

          <button id="reset-btn" type="button">
            Reset
          </button>
        </main>
      )}
    </>
  )
}

export default App
