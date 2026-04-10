import { useEffect, useRef, useState } from 'react'
import './App.css'

const palette = [
  '#0f172a',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f8fafc',
]

const paperPalette = ['#fff8ef', '#f6f7fb', '#101826', '#fdf2f8']

const shortcuts = [
  ['B', 'brush'],
  ['E', 'eraser'],
  ['Ctrl + Z', 'undo'],
  ['Ctrl + Shift + Z', 'redo'],
  ['Ctrl + S', 'export'],
]

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function getPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect()

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function drawStroke(ctx, stroke, paperColor) {
  if (!stroke.points.length) {
    return
  }

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = stroke.size
  ctx.globalCompositeOperation = 'source-over'
  const effectiveColor = stroke.tool === 'eraser' ? '#ffffff' : stroke.color
  ctx.strokeStyle = effectiveColor
  ctx.fillStyle = effectiveColor

  if (stroke.points.length === 1) {
    const [point] = stroke.points
    ctx.beginPath()
    ctx.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  ctx.beginPath()
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y)

  for (let index = 1; index < stroke.points.length; index += 1) {
    ctx.lineTo(stroke.points[index].x, stroke.points[index].y)
  }

  ctx.stroke()
  ctx.restore()
}

function App() {
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const activeStrokeRef = useRef(null)
  const isDrawingRef = useRef(false)
  const redrawCanvasRef = useRef(() => {})

  const [tool, setTool] = useState('brush')
  const [color, setColor] = useState('#3b82f6')
  const [brushSize, setBrushSize] = useState(14)
  const [paperColor, setPaperColor] = useState('#fff8ef')
  const [strokes, setStrokes] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const [status, setStatus] = useState('Pronto para desenhar')

  useEffect(() => {
    redrawCanvasRef.current = () => {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) {
        return
      }

      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, rect.width, rect.height)
      ctx.fillStyle = paperColor
      ctx.fillRect(0, 0, rect.width, rect.height)

      ctx.save()
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.04)'
      ctx.lineWidth = 1

      for (let x = 24; x < rect.width; x += 24) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, rect.height)
        ctx.stroke()
      }

      for (let y = 24; y < rect.height; y += 24) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(rect.width, y)
        ctx.stroke()
      }

      ctx.restore()

      strokes.forEach((stroke) => drawStroke(ctx, stroke, paperColor))

      if (activeStrokeRef.current) {
        drawStroke(ctx, activeStrokeRef.current, paperColor)
      }
    }

    redrawCanvasRef.current()
  }, [strokes, paperColor])

  useEffect(() => {
    const onResize = () => {
      redrawCanvasRef.current()
    }

    const observer = new ResizeObserver(onResize)

    if (stageRef.current) {
      observer.observe(stageRef.current)
    }

    window.addEventListener('resize', onResize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase()
      const isMeta = event.metaKey || event.ctrlKey

      if (isMeta && key === 's') {
        event.preventDefault()
        const canvas = canvasRef.current
        if (canvas) {
          const link = document.createElement('a')
          link.download = 'meu-paint.png'
          link.href = canvas.toDataURL('image/png')
          link.click()
          setStatus('Imagem exportada')
        }
        return
      }

      if (isMeta && key === 'z' && event.shiftKey) {
        event.preventDefault()
        setRedoStack((current) => {
          if (!current.length) {
            return current
          }

          const [nextStroke, ...remaining] = current
          setStrokes((existing) => [...existing, nextStroke])
          setStatus('Traço restaurado')
          return remaining
        })
        return
      }

      if (isMeta && key === 'z') {
        event.preventDefault()
        setStrokes((current) => {
          if (!current.length) {
            return current
          }

          const next = current.slice(0, -1)
          setRedoStack((future) => [current[current.length - 1], ...future])
          setStatus('Último traço removido')
          return next
        })
        return
      }

      if (!isMeta && key === 'b') {
        setTool('brush')
      }

      if (!isMeta && key === 'e') {
        setTool('eraser')
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const commitStroke = () => {
    const stroke = activeStrokeRef.current

    if (!stroke) {
      return
    }

    activeStrokeRef.current = null
    isDrawingRef.current = false

    if (stroke.points.length > 0) {
      setStrokes((current) => [...current, stroke])
      setRedoStack([])
      setStatus('Traço salvo no canvas')
    }

    redrawCanvasRef.current()
  }

  const handlePointerDown = (event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') {
      return
    }

    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    canvas.setPointerCapture(event.pointerId)
    const point = getPoint(event, canvas)

    activeStrokeRef.current = {
      id: createId(),
      tool,
      color,
      size: brushSize,
      points: [point],
    }

    isDrawingRef.current = true
    setStatus(tool === 'eraser' ? 'Apagando' : 'Desenhando')
    redrawCanvasRef.current()
  }

  const handlePointerMove = (event) => {
    if (!isDrawingRef.current || !activeStrokeRef.current) {
      return
    }

    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const point = getPoint(event, canvas)
    const stroke = activeStrokeRef.current
    const previousPoint = stroke.points[stroke.points.length - 1]

    stroke.points.push(point)

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = stroke.size
    ctx.globalCompositeOperation = 'source-over'
    const effectiveColor = stroke.tool === 'eraser' ? '#ffffff' : stroke.color
    ctx.strokeStyle = effectiveColor
    ctx.fillStyle = effectiveColor

    if (stroke.points.length === 2) {
      ctx.beginPath()
      ctx.moveTo(previousPoint.x, previousPoint.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
      return
    }

    ctx.beginPath()
    ctx.moveTo(previousPoint.x, previousPoint.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
  }

  const handlePointerUp = (event) => {
    const canvas = canvasRef.current

    if (canvas) {
      canvas.releasePointerCapture?.(event.pointerId)
    }

    if (isDrawingRef.current) {
      commitStroke()
    }
  }

  const handleClear = () => {
    activeStrokeRef.current = null
    isDrawingRef.current = false
    setStrokes([])
    setRedoStack([])
    setStatus('Canvas limpo')
  }

  const handleUndo = () => {
    setStrokes((current) => {
      if (!current.length) {
        return current
      }

      const next = current.slice(0, -1)
      setRedoStack((future) => [current[current.length - 1], ...future])
      setStatus('Último traço removido')
      return next
    })
  }

  const handleRedo = () => {
    setRedoStack((current) => {
      if (!current.length) {
        return current
      }

      const [nextStroke, ...remaining] = current
      setStrokes((existing) => [...existing, nextStroke])
      setStatus('Traço restaurado')
      return remaining
    })
  }

  const handleExport = () => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const link = document.createElement('a')
    link.download = 'meu-paint.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
    setStatus('Imagem exportada')
  }

  const handleToolChange = (nextTool) => {
    setTool(nextTool)
    setStatus(nextTool === 'eraser' ? 'Borracha ativa' : 'Pincel ativo')
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Portfolio project</p>
          <h1>Paint Studio</h1>
          
        </div>

        <div className="hero-stats">
          <div>
            <span className="stat-label">Ferramenta</span>
            <strong>{tool === 'brush' ? 'Pincel' : 'Borracha'}</strong>
          </div>
          <div>
            <span className="stat-label">Status</span>
            <strong>{status}</strong>
          </div>
        </div>
      </section>

      <section className="workspace">
        <aside className="controls-panel">
          <section className="control-block">
            <div className="block-title">
              <h2>Tools</h2>
              <p>Escolha o comportamento do traço.</p>
            </div>

            <div className="tool-row">
              <button
                type="button"
                className={tool === 'brush' ? 'tool-button is-active' : 'tool-button'}
                onClick={() => handleToolChange('brush')}
              >
                Pincel
              </button>
              <button
                type="button"
                className={tool === 'eraser' ? 'tool-button is-active' : 'tool-button'}
                onClick={() => handleToolChange('eraser')}
              >
                Borracha
              </button>
            </div>
          </section>

          <section className="control-block">
            <div className="block-title">
              <h2>Color</h2>
              <p>Cores do traço.</p>
            </div>
            <div className="swatches" aria-label="Paleta de cores">
              {palette.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className={color === swatch ? 'swatch is-active' : 'swatch'}
                  style={{ backgroundColor: swatch }}
                  onClick={() => {
                    setColor(swatch)
                    setTool('brush')
                    setStatus('Cor atualizada')
                  }}
                  aria-label={`Selecionar cor ${swatch}`}
                />
              ))}
            </div>
          </section>

          <section className="control-block">
            <div className="block-title">
              <h2>Brush</h2>
              <p>{brushSize}px de espessura.</p>
            </div>

            <label className="slider-field">
              <span>Size</span>
              <input
                type="range"
                min="2"
                max="44"
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
              />
            </label>
          </section>

          <section className="control-block">
            <div className="block-title">
              <h2>Paper</h2>
              <p>Define o fundo do canvas.</p>
            </div>
            <div className="paper-swatches" aria-label="Cores de fundo">
              {paperPalette.map((shade) => (
                <button
                  key={shade}
                  type="button"
                  className={paperColor === shade ? 'paper-swatch is-active' : 'paper-swatch'}
                  style={{ backgroundColor: shade }}
                  onClick={() => {
                    setPaperColor(shade)
                    setStatus('Fundo alterado')
                  }}
                  aria-label={`Selecionar fundo ${shade}`}
                />
              ))}
            </div>
          </section>

          <section className="control-block">
            <div className="block-title">
              <h2>Actions</h2>
              <p>Atalhos e comandos rápidos.</p>
            </div>

            <div className="action-row">
              <button type="button" className="action-button" onClick={handleUndo}>
                Undo
              </button>
              <button type="button" className="action-button" onClick={handleRedo}>
                Redo
              </button>
              <button type="button" className="action-button" onClick={handleClear}>
                Limpar
              </button>
              <button type="button" className="action-button action-button-primary" onClick={handleExport}>
                Export
              </button>
            </div>
          </section>

          
        </aside>

        <section className="canvas-shell">
          <div className="canvas-frame">
            <div className="canvas-topbar">
             
              <span>{status}</span>
            </div>
            <div className="canvas-stage" ref={stageRef}>
              <canvas
                ref={canvasRef}
                className="paint-canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerUp}
                aria-label="Canvas de desenho"
              />
              
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
