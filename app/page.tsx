"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Upload,
  RotateCw,
  Crop,
  Pen,
  Type,
  RotateCcw,
  Redo,
  Download,
  ImageIcon,
  Settings2,
  Copy,
  Trash2,
  ZoomIn,
  ZoomOut,
  Check,
  X,
} from "lucide-react"

const MODES = {
  free: null,
  "1:1": 1,
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "9:16": 9 / 16,
}

const FONTS = ["Arial", "Georgia", "Times New Roman", "Comic Sans MS", "Courier New", "Trebuchet MS", "Verdana"]

interface TextElement {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  font: string
}

interface HistoryState {
  image: string | null
  imageSize: { width: number; height: number } | null
  rotation: number
  drawing?: string
  texts?: TextElement[]
}

export default function ImageEditor() {
  const [zoom, setZoom] = useState(100)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const [mode, setMode] = useState<keyof typeof MODES>("free")
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(5)
  const [brushColor, setBrushColor] = useState("#ffffff")
  const [isDrawMode, setIsDrawMode] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [isCropMode, setIsCropMode] = useState(false)
  const [cropArea, setCropArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [croppedImage, setCroppedImage] = useState<string | null>(null)
  const [isDraggingCrop, setIsDraggingCrop] = useState(false)
  const [dragHandle, setDragHandle] = useState<string | null>(null)

  const [isTextMode, setIsTextMode] = useState(false)
  const [textElements, setTextElements] = useState<TextElement[]>([])
  const [textFontSize, setTextFontSize] = useState(24)
  const [textColor, setTextColor] = useState("#ffffff")
  const [textFont, setTextFont] = useState("Arial") // Added font selection
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null) // Track which text is selected
  const [editingTextId, setEditingTextId] = useState<string | null>(null) // Track which text is being edited inline
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null) // Track dragging text
  const [addingTextAt, setAddingTextAt] = useState<{ x: number; y: number } | null>(null) // Position to add new text
  const [newTextInput, setNewTextInput] = useState("") // Input for new text being added

  const [history, setHistory] = useState<HistoryState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const cropDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const textDragStartRef = useRef<{ x: number; y: number } | null>(null) // For text dragging
  const canvasWrapperRef = useRef<HTMLDivElement>(null) // For accurate crop coordinates on rotated images

  const addToHistory = (
    newImage: string | null,
    newImageSize: { width: number; height: number } | null,
    newRotation: number,
    newTexts?: TextElement[],
  ) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({
      image: newImage,
      imageSize: newImageSize,
      rotation: newRotation,
      texts: newTexts || [],
    })
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      const state = history[newIndex]
      setUploadedImage(state.image)
      setImageSize(state.imageSize)
      setRotation(state.rotation)
      setTextElements(state.texts || [])
      setHistoryIndex(newIndex)
      setIsDrawMode(false)
      setIsTextMode(false)
      setIsCropMode(false)
      setCropArea(null)
      if (drawingCanvasRef.current) {
        const ctx = drawingCanvasRef.current.getContext("2d")
        ctx?.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height)
      }
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      const state = history[newIndex]
      setUploadedImage(state.image)
      setImageSize(state.imageSize)
      setRotation(state.rotation)
      setTextElements(state.texts || [])
      setHistoryIndex(newIndex)
      setIsDrawMode(false)
      setIsTextMode(false)
      setIsCropMode(false)
      setCropArea(null)
      if (drawingCanvasRef.current) {
        const ctx = drawingCanvasRef.current.getContext("2d")
        ctx?.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height)
      }
    }
  }

  const handleExport = async () => {
    if (!uploadedImage) return

    try {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        // Adjust canvas dimensions based on rotation
        // For 90° and 270° rotations, swap width and height
        const isRotated90or270 = rotation % 180 === 90
        canvas.width = isRotated90or270 ? img.height : img.width
        canvas.height = isRotated90or270 ? img.width : img.height

        // Draw rotated image at full resolution
        ctx.save()
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate((rotation * Math.PI) / 180)
        ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height)
        ctx.restore()

        // Scale drawing canvas to match export resolution
        if (drawingCanvasRef.current) {
          const canvasDims = getCanvasDimensions()
          const scaleX = canvas.width / canvasDims.width
          const scaleY = canvas.height / canvasDims.height
          
          ctx.save()
          ctx.translate(canvas.width / 2, canvas.height / 2)
          ctx.rotate((rotation * Math.PI) / 180)
          
          const drawingWidth = isRotated90or270 ? drawingCanvasRef.current.height : drawingCanvasRef.current.width
          const drawingHeight = isRotated90or270 ? drawingCanvasRef.current.width : drawingCanvasRef.current.height
          
          ctx.drawImage(
            drawingCanvasRef.current,
            -drawingWidth * scaleX / 2,
            -drawingHeight * scaleY / 2,
            drawingWidth * scaleX,
            drawingHeight * scaleY,
          )
          ctx.restore()
        }

        // Draw text elements scaled to original size
        const canvasDims = getCanvasDimensions()
        const scaleX = canvas.width / canvasDims.width
        const scaleY = canvas.height / canvasDims.height
        
        ctx.save()
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate((rotation * Math.PI) / 180)
        
        textElements.forEach((textEl) => {
          ctx.fillStyle = textEl.color
          ctx.font = `${textEl.fontSize * scaleX}px ${textEl.font}`
          // Adjust text position relative to rotated canvas
          const adjustedX = (textEl.x - canvasDims.width / 2) * scaleX
          const adjustedY = (textEl.y - canvasDims.height / 2) * scaleY
          ctx.fillText(textEl.text, adjustedX, adjustedY)
        })
        ctx.restore()

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = `edited-image-${Date.now()}.png`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
          }
        })
      }
      img.src = uploadedImage
    } catch (error) {
      console.error("Export failed:", error)
    }
  }

  useEffect(() => {
    if (uploadedImage && drawingCanvasRef.current) {
      const canvas = drawingCanvasRef.current
      const ctx = canvas.getContext("2d")
      const dimensions = getCanvasDimensions()
      canvas.width = dimensions.width
      canvas.height = dimensions.height
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [uploadedImage, mode, rotation])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
          const imageData = event.target?.result as string
          setUploadedImage(imageData)
          const newImageSize = { width: img.width, height: img.height }
          setImageSize(newImageSize)
          addToHistory(imageData, newImageSize, 0, [])
          setIsDrawMode(false)
          setIsTextMode(false)
          setIsCropMode(false)
          setCropArea(null)
          setRotation(0)
          setCroppedImage(null)
          setTextElements([])
        }
        img.src = event.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  const getCanvasDimensions = () => {
    if (!uploadedImage || !imageSize) {
      return { width: 384, height: 256 }
    }

    const maxWidth = 800
    const maxHeight = 600
    const aspectRatio = MODES[mode] || imageSize.width / imageSize.height

    let width = imageSize.width
    let height = imageSize.height

    if (mode !== "free") {
      const targetAspect = aspectRatio
      if (imageSize.width / imageSize.height > targetAspect) {
        height = imageSize.width / targetAspect
      } else {
        width = imageSize.height * targetAspect
      }
    }

    if (width > maxWidth) {
      const scale = maxWidth / width
      width = maxWidth
      height = height * scale
    }
    if (height > maxHeight) {
      const scale = maxHeight / height
      height = maxHeight
      width = width * scale
    }

    return { width, height }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawMode) return
    setIsDrawing(true)
    const canvas = drawingCanvasRef.current
    if (!canvas) return

    // Get the wrapper rect for accurate coordinates
    const wrapper = canvasWrapperRef.current
    if (!wrapper) return
    
    const wrapperRect = wrapper.getBoundingClientRect()
    const dimensions = getCanvasDimensions()
    
    let x = e.clientX - wrapperRect.left
    let y = e.clientY - wrapperRect.top
    
    // Apply coordinate transformation for rotation
    if (rotation !== 0) {
      const wrapperCenterX = wrapperRect.width / 2
      const wrapperCenterY = wrapperRect.height / 2
      const canvasCenterX = dimensions.width / 2
      const canvasCenterY = dimensions.height / 2
      
      // Translate to wrapper center
      const dx = x - wrapperCenterX
      const dy = y - wrapperCenterY
      
      // Apply inverse rotation transformation
      const angleRad = (-rotation * Math.PI) / 180
      const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad)
      const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad)
      
      // Translate to canvas space
      x = rotatedX + canvasCenterX
      y = rotatedY + canvasCenterY
    }

    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawMode) return
    const canvas = drawingCanvasRef.current
    if (!canvas) return

    // Get the wrapper rect for accurate coordinates
    const wrapper = canvasWrapperRef.current
    if (!wrapper) return
    
    const wrapperRect = wrapper.getBoundingClientRect()
    const dimensions = getCanvasDimensions()
    
    let x = e.clientX - wrapperRect.left
    let y = e.clientY - wrapperRect.top
    
    // Apply coordinate transformation for rotation
    if (rotation !== 0) {
      const wrapperCenterX = wrapperRect.width / 2
      const wrapperCenterY = wrapperRect.height / 2
      const canvasCenterX = dimensions.width / 2
      const canvasCenterY = dimensions.height / 2
      
      // Translate to wrapper center
      const dx = x - wrapperCenterX
      const dy = y - wrapperCenterY
      
      // Apply inverse rotation transformation
      const angleRad = (-rotation * Math.PI) / 180
      const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad)
      const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad)
      
      // Translate to canvas space
      x = rotatedX + canvasCenterX
      y = rotatedY + canvasCenterY
    }

    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.strokeStyle = brushColor
      ctx.lineWidth = brushSize
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isTextMode || addingTextAt) return // Don't create new input if one already exists
    
    e.stopPropagation() // Prevent event bubbling
    
    // Get the wrapper rect for accurate coordinates
    const wrapper = canvasWrapperRef.current
    if (!wrapper) return
    
    const wrapperRect = wrapper.getBoundingClientRect()
    const dimensions = getCanvasDimensions()
    
    let x = e.clientX - wrapperRect.left
    let y = e.clientY - wrapperRect.top
    
    // Apply coordinate transformation for rotation
    if (rotation !== 0) {
      const wrapperCenterX = wrapperRect.width / 2
      const wrapperCenterY = wrapperRect.height / 2
      const canvasCenterX = dimensions.width / 2
      const canvasCenterY = dimensions.height / 2
      
      // Translate to wrapper center
      const dx = x - wrapperCenterX
      const dy = y - wrapperCenterY
      
      // Apply inverse rotation transformation
      const angleRad = (-rotation * Math.PI) / 180
      const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad)
      const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad)
      
      // Translate to canvas space
      x = rotatedX + canvasCenterX
      y = rotatedY + canvasCenterY
    }

    // Start adding text at this position
    setAddingTextAt({ x, y })
    setNewTextInput("")
    setSelectedTextId(null)
  }

  const confirmAddText = () => {
    if (!uploadedImage || !newTextInput.trim() || !addingTextAt) return

    const newText: TextElement = {
      id: Date.now().toString(),
      text: newTextInput,
      x: addingTextAt.x,
      y: addingTextAt.y,
      fontSize: textFontSize,
      color: textColor,
      font: textFont,
    }

    const newTexts = [...textElements, newText]
    setTextElements(newTexts)
    setNewTextInput("")
    setAddingTextAt(null)
    addToHistory(uploadedImage, imageSize, rotation, newTexts)
  }

  const cancelAddText = () => {
    setAddingTextAt(null)
    setNewTextInput("")
  }

  const handleTextClick = (e: React.MouseEvent, textId: string) => {
    e.stopPropagation()
    if (draggingTextId) return // Don't select if we're dragging
    
    setSelectedTextId(textId)
    setAddingTextAt(null) // Cancel any text being added
    
    // Load the selected text properties into the toolbar
    const selectedText = textElements.find((t) => t.id === textId)
    if (selectedText) {
      setTextFontSize(selectedText.fontSize)
      setTextColor(selectedText.color)
      setTextFont(selectedText.font)
    }
  }

  const handleTextMouseDown = (e: React.MouseEvent, textId: string) => {
    e.stopPropagation()
    setDraggingTextId(textId)
    setSelectedTextId(null) // Deselect while dragging
    textDragStartRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleTextMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingTextId || !textDragStartRef.current) return

    let deltaX = e.clientX - textDragStartRef.current.x
    let deltaY = e.clientY - textDragStartRef.current.y
    
    // Apply rotation transformation to deltas if image is rotated
    if (rotation !== 0) {
      const angleRad = (-rotation * Math.PI) / 180
      const rotatedDeltaX = deltaX * Math.cos(angleRad) - deltaY * Math.sin(angleRad)
      const rotatedDeltaY = deltaX * Math.sin(angleRad) + deltaY * Math.cos(angleRad)
      deltaX = rotatedDeltaX
      deltaY = rotatedDeltaY
    }

    setTextElements(
      textElements.map((t) => {
        if (t.id === draggingTextId) {
          return {
            ...t,
            x: Math.max(0, t.x + deltaX),
            y: Math.max(0, t.y + deltaY),
          }
        }
        return t
      }),
    )

    textDragStartRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleTextMouseUp = () => {
    if (draggingTextId && uploadedImage) {
      addToHistory(uploadedImage, imageSize, rotation, textElements)
    }
    setDraggingTextId(null)
    textDragStartRef.current = null
  }

  const deleteTextElement = (id: string) => {
    const newTexts = textElements.filter((t) => t.id !== id)
    setTextElements(newTexts)
    setSelectedTextId(null)
    addToHistory(uploadedImage, imageSize, rotation, newTexts)
  }

  const updateSelectedTextProperties = () => {
    if (!selectedTextId) return

    const newTexts = textElements.map((t) => {
      if (t.id === selectedTextId) {
        return {
          ...t,
          fontSize: textFontSize,
          color: textColor,
          font: textFont,
        }
      }
      return t
    })

    setTextElements(newTexts)
    addToHistory(uploadedImage, imageSize, rotation, newTexts)
  }

  const clearDrawing = () => {
    if (drawingCanvasRef.current) {
      const ctx = drawingCanvasRef.current.getContext("2d")
      ctx?.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height)
    }
  }

  const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>, handle?: string) => {
    if (!isCropMode) return
    e.preventDefault()
    setIsDraggingCrop(true)
    setDragHandle(handle || "move")
    cropDragStartRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleCropMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCropMode || !isDraggingCrop || !cropArea || !dragHandle) return

    e.preventDefault()
    
    // Use the outer wrapper ref for accurate coordinates with rotated images
    const wrapper = canvasWrapperRef.current
    if (!wrapper) return
    
    const rect = wrapper.getBoundingClientRect()
    const dimensions = getCanvasDimensions()
    
    // Get mouse position relative to the wrapper (accounts for rotation layout)
    let x = e.clientX - rect.left
    let y = e.clientY - rect.top
    
    // Apply coordinate transformation for any rotation
    if (rotation !== 0) {
      const wrapperCenterX = rect.width / 2
      const wrapperCenterY = rect.height / 2
      const canvasCenterX = dimensions.width / 2
      const canvasCenterY = dimensions.height / 2
      
      // Translate to wrapper center
      const dx = x - wrapperCenterX
      const dy = y - wrapperCenterY
      
      // Apply inverse rotation transformation
      const angleRad = (-rotation * Math.PI) / 180
      const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad)
      const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad)
      
      // Translate to canvas space
      x = rotatedX + canvasCenterX
      y = rotatedY + canvasCenterY
    }

    const newCropArea = { ...cropArea }
    const minSize = 30

    if (dragHandle === "move") {
      const deltaX = x - (cropArea.x + cropArea.width / 2)
      const deltaY = y - (cropArea.y + cropArea.height / 2)
      newCropArea.x = Math.max(0, Math.min(cropArea.x + deltaX, dimensions.width - cropArea.width))
      newCropArea.y = Math.max(0, Math.min(cropArea.y + deltaY, dimensions.height - cropArea.height))
    } else if (dragHandle === "nw") {
      newCropArea.x = Math.max(0, Math.min(x, cropArea.x + cropArea.width - minSize))
      newCropArea.y = Math.max(0, Math.min(y, cropArea.y + cropArea.height - minSize))
      newCropArea.width = Math.max(minSize, cropArea.x + cropArea.width - newCropArea.x)
      newCropArea.height = Math.max(minSize, cropArea.y + cropArea.height - newCropArea.y)
    } else if (dragHandle === "ne") {
      newCropArea.x = Math.max(0, Math.min(cropArea.x, x - minSize))
      newCropArea.y = Math.max(0, Math.min(y, cropArea.y + cropArea.height - minSize))
      newCropArea.width = Math.max(minSize, x - newCropArea.x)
      newCropArea.height = Math.max(minSize, cropArea.y + cropArea.height - newCropArea.y)
    } else if (dragHandle === "sw") {
      newCropArea.x = Math.max(0, Math.min(x, cropArea.x + cropArea.width - minSize))
      newCropArea.y = Math.max(0, Math.min(cropArea.y, y - minSize))
      newCropArea.width = Math.max(minSize, cropArea.x + cropArea.width - newCropArea.x)
      newCropArea.height = Math.max(minSize, y - newCropArea.y)
    } else if (dragHandle === "se") {
      newCropArea.width = Math.max(minSize, x - cropArea.x)
      newCropArea.height = Math.max(minSize, y - cropArea.y)
    }

    newCropArea.x = Math.max(0, Math.min(newCropArea.x, dimensions.width - minSize))
    newCropArea.y = Math.max(0, Math.min(newCropArea.y, dimensions.height - minSize))
    newCropArea.width = Math.min(newCropArea.width, dimensions.width - newCropArea.x)
    newCropArea.height = Math.min(newCropArea.height, dimensions.height - newCropArea.y)

    setCropArea(newCropArea)
  }

  const handleCropMouseUp = () => {
    setIsDraggingCrop(false)
    setDragHandle(null)
    cropDragStartRef.current = null
  }

  const initiateCrop = () => {
    if (!uploadedImage) return
    const dimensions = getCanvasDimensions()
    setCropArea({
      x: dimensions.width * 0.1,
      y: dimensions.height * 0.1,
      width: dimensions.width * 0.8,
      height: dimensions.height * 0.8,
    })
    setIsCropMode(true)
  }

  const applyCrop = () => {
    if (!cropArea || !uploadedImage) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const dimensions = getCanvasDimensions()

      const scaleX = img.width / dimensions.width
      const scaleY = img.height / dimensions.height

      canvas.width = cropArea.width * scaleX
      canvas.height = cropArea.height * scaleY

      if (ctx) {
        ctx.drawImage(
          img,
          cropArea.x * scaleX,
          cropArea.y * scaleY,
          cropArea.width * scaleX,
          cropArea.height * scaleY,
          0,
          0,
          cropArea.width * scaleX,
          cropArea.height * scaleY,
        )
        const croppedImageData = canvas.toDataURL()
        setCroppedImage(croppedImageData)
        setUploadedImage(croppedImageData)
        const newImg = new Image()
        newImg.onload = () => {
          const newImageSize = { width: newImg.width, height: newImg.height }
          setImageSize(newImageSize)
          addToHistory(croppedImageData, newImageSize, rotation, textElements)
        }
        newImg.src = croppedImageData
      }
    }
    img.src = uploadedImage
    setIsCropMode(false)
    setCropArea(null)
  }

  const cancelCrop = () => {
    setIsCropMode(false)
    setCropArea(null)
  }

  const rotateImage = (angle: number) => {
    const newRotation = (rotation + angle) % 360
    setRotation(newRotation)
    addToHistory(uploadedImage, imageSize, newRotation, textElements)
  }

  const handleReset = () => {
    if (uploadedImage) {
      setRotation(0)
      setMode("free")
      setIsDrawMode(false)
      setIsTextMode(false)
      setIsCropMode(false)
      setCropArea(null)
      clearDrawing()
    }
  }

  const handleClearCanvas = () => {
    setUploadedImage(null)
    setImageSize(null)
    setMode("free")
    setIsDrawMode(false)
    setIsTextMode(false)
    setIsCropMode(false)
    setCropArea(null)
    setCroppedImage(null)
    setRotation(0)
    setHistory([])
    setHistoryIndex(-1)
    setTextElements([])
    clearDrawing()
  }

  const canvasDimensions = getCanvasDimensions()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-sidebar/50 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Image Editor</h1>
              <p className="text-xs text-muted-foreground">
                {uploadedImage
                  ? `${Math.round(imageSize?.width || 0)} × ${Math.round(imageSize?.height || 0)}px`
                  : "Untitled Project"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Copy className="w-4 h-4" />
              Save Draft
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90"
              disabled={!uploadedImage}
              onClick={handleExport}
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Sidebar - Tools */}
        <div className="w-20 border-r border-border bg-sidebar/30 flex flex-col items-center py-4 gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 group relative text-muted-foreground hover:bg-card hover:text-foreground"
            title="Upload"
          >
            <Upload className="w-5 h-5" />
            <span className="absolute left-full ml-2 px-2 py-1 bg-card text-foreground text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Upload
            </span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          <ToolButton
            icon={RotateCw}
            label="Rotate"
            active={false}
            onClick={() => {
              if (uploadedImage) {
                setAddingTextAt(null) // Clear any pending text input
                setSelectedTextId(null)
                rotateImage(90)
              }
            }}
          />
          <ToolButton
            icon={Crop}
            label="Crop"
            active={isCropMode && uploadedImage !== null}
            onClick={() => {
              if (uploadedImage && !isCropMode) {
                // Turn off other modes when activating crop
                setIsDrawMode(false)
                setIsTextMode(false)
                setAddingTextAt(null) // Clear any pending text input
                setSelectedTextId(null)
                initiateCrop()
              } else if (isCropMode) {
                cancelCrop()
              }
            }}
          />
          <ToolButton
            icon={Pen}
            label="Draw"
            active={isDrawMode && uploadedImage !== null}
            onClick={() => {
              if (uploadedImage) {
                setIsDrawMode(!isDrawMode)
                setIsTextMode(false)
                setIsCropMode(false)
                setAddingTextAt(null) // Clear any pending text input
                setSelectedTextId(null)
                if (isCropMode) {
                  cancelCrop()
                }
              }
            }}
          />
          <ToolButton
            icon={Type}
            label="Text"
            active={isTextMode && uploadedImage !== null}
            onClick={() => {
              if (uploadedImage) {
                setIsTextMode(!isTextMode)
                setIsDrawMode(false)
                setIsCropMode(false)
                setAddingTextAt(null) // Clear any pending text input
                if (isCropMode) {
                  cancelCrop()
                }
              }
            }}
          />
          <div className="w-12 h-px bg-border my-2" />
          <ToolButton icon={RotateCcw} label="Undo" active={false} onClick={handleUndo} />
          <ToolButton icon={Redo} label="Redo" active={false} onClick={handleRedo} />
          <ToolButton icon={Trash2} label="Delete" active={false} onClick={handleClearCanvas} />
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col bg-gradient-to-b from-background to-sidebar/20">
          {/* Toolbar */}
          <div className="border-b border-border bg-sidebar/50 backdrop-blur-sm px-6 py-4 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-muted-foreground">
                {uploadedImage
                  ? isCropMode
                    ? "Crop Mode"
                    : isDrawMode
                      ? "Drawing Mode"
                      : isTextMode
                        ? "Text Mode"
                        : "Canvas Mode"
                  : "No image selected"}
              </span>
              <div className="h-6 w-px bg-border" />
              {isCropMode && uploadedImage && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Drag corners to resize, drag center to move</span>
                  </div>
                  <div className="h-6 w-px bg-border" />
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={applyCrop}>
                    <Check className="w-4 h-4 mr-1" />
                    Apply
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelCrop}>
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </>
              )}
              {isDrawMode && uploadedImage && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Brush Size:</span>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-xs text-muted-foreground">{brushSize}px</span>
                  </div>
                  <div className="h-6 w-px bg-border" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Color:</span>
                    <input
                      type="color"
                      value={brushColor}
                      onChange={(e) => setBrushColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-border"
                    />
                  </div>
                  <div className="h-6 w-px bg-border" />
                  <Button variant="outline" size="sm" onClick={clearDrawing}>
                    Clear Drawing
                  </Button>
                </>
              )}
              {isTextMode && uploadedImage && (
                <>
                  {selectedTextId ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium">Editing Text:</span>
                      </div>
                      <div className="h-6 w-px bg-border" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Font:</span>
                        <select
                          value={textFont}
                          onChange={(e) => {
                            setTextFont(e.target.value)
                            setTimeout(updateSelectedTextProperties, 0)
                          }}
                          className="text-xs bg-card border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {FONTS.map((font) => (
                            <option key={font} value={font}>
                              {font}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="h-6 w-px bg-border" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Size:</span>
                        <input
                          type="range"
                          min="8"
                          max="72"
                          value={textFontSize}
                          onChange={(e) => {
                            setTextFontSize(Number(e.target.value))
                            setTimeout(updateSelectedTextProperties, 0)
                          }}
                          className="w-24"
                        />
                        <span className="text-xs text-muted-foreground">{textFontSize}px</span>
                      </div>
                      <div className="h-6 w-px bg-border" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Color:</span>
                        <input
                          type="color"
                          value={textColor}
                          onChange={(e) => {
                            setTextColor(e.target.value)
                            setTimeout(updateSelectedTextProperties, 0)
                          }}
                          className="w-8 h-8 rounded cursor-pointer border border-border"
                        />
                      </div>
                      <div className="h-6 w-px bg-border" />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (selectedTextId) deleteTextElement(selectedTextId)
                        }}
                      >
                        Delete Text
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Click on canvas to add text, or click existing text to edit it</span>
                      </div>
                      <div className="h-6 w-px bg-border" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Font:</span>
                        <select
                          value={textFont}
                          onChange={(e) => setTextFont(e.target.value)}
                          className="text-xs bg-card border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {FONTS.map((font) => (
                            <option key={font} value={font}>
                              {font}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="h-6 w-px bg-border" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Size:</span>
                        <input
                          type="range"
                          min="8"
                          max="72"
                          value={textFontSize}
                          onChange={(e) => setTextFontSize(Number(e.target.value))}
                          className="w-24"
                        />
                        <span className="text-xs text-muted-foreground">{textFontSize}px</span>
                      </div>
                      <div className="h-6 w-px bg-border" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Color:</span>
                        <input
                          type="color"
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border border-border"
                        />
                      </div>
                    </>
                  )}
                </>
              )}
              {!isDrawMode && !isCropMode && !isTextMode && uploadedImage && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Rotation:</span>
                    <span className="text-sm font-medium text-foreground w-12">{rotation}°</span>
                    <Button size="sm" variant="outline" onClick={() => rotateImage(90)}>
                      Rotate 90°
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRotation(0)}>
                      Reset
                    </Button>
                  </div>
                  <div className="h-6 w-px bg-border" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Mode:</span>
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as keyof typeof MODES)}
                      className="text-xs bg-card border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {Object.keys(MODES).map((m) => (
                        <option key={m} value={m}>
                          {m === "free" ? "Free" : m}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setZoom(Math.max(25, zoom - 10))}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <div className="px-3 py-1 bg-card border border-border rounded text-xs font-medium text-foreground w-16 text-center">
                  {zoom}%
                </div>
                <Button variant="ghost" size="sm" onClick={() => setZoom(Math.min(200, zoom + 10))}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setZoom(100)} className="text-xs">
                  Reset
                </Button>
              </div>
              <div className="h-6 w-px bg-border" />
              <Button variant="ghost" size="sm">
                <Settings2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div
            className="flex-1 overflow-auto p-8"
            ref={containerRef}
            onMouseMove={isTextMode ? handleTextMouseMove : undefined}
            onMouseUp={isTextMode ? handleTextMouseUp : undefined}
            onMouseLeave={isTextMode ? handleTextMouseUp : undefined}
          >
            <div className="relative flex-shrink-0 min-h-full flex items-center justify-center">
              <div className="relative flex-shrink-0">
              {/* Grid Background */}
              <div
                className="absolute inset-0 opacity-5 pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(0deg, transparent 24%, rgba(255, 255, 255, 0.05) 25%, rgba(255, 255, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, 0.05) 75%, rgba(255, 255, 255, 0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255, 255, 255, 0.05) 25%, rgba(255, 255, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, 0.05) 75%, rgba(255, 255, 255, 0.05) 76%, transparent 77%, transparent)",
                  backgroundSize: "50px 50px",
                }}
              />

              {/* Image Canvas */}
              {uploadedImage ? (
                <div
                  ref={canvasWrapperRef}
                  className="relative flex-shrink-0"
                  style={{
                    // Calculate dimensions that account for rotation
                    width:
                      rotation % 180 === 90
                        ? `${canvasDimensions.height}px`
                        : `${canvasDimensions.width}px`,
                    height:
                      rotation % 180 === 90
                        ? `${canvasDimensions.width}px`
                        : `${canvasDimensions.height}px`,
                  }}
                  onMouseMove={isCropMode ? handleCropMouseMove : undefined}
                  onMouseUp={isCropMode ? handleCropMouseUp : undefined}
                  onMouseLeave={isCropMode ? handleCropMouseUp : undefined}
                  onClick={isTextMode ? handleCanvasClick : undefined}
                >
                  <div
                    className={`absolute border-2 ${
                      isCropMode
                        ? "border-yellow-500"
                        : isDrawMode
                          ? "border-blue-500"
                          : isTextMode
                            ? "border-purple-500"
                            : "border-primary/40"
                    } rounded-lg bg-card shadow-lg`}
                    style={{
                      width: `${canvasDimensions.width}px`,
                      height: `${canvasDimensions.height}px`,
                      cursor: isDrawMode ? "crosshair" : isCropMode ? "move" : isTextMode ? "text" : "default",
                      transform: `rotate(${rotation}deg)`,
                      transformOrigin: "center",
                      left: "50%",
                      top: "50%",
                      marginLeft: `-${canvasDimensions.width / 2}px`,
                      marginTop: `-${canvasDimensions.height / 2}px`,
                      pointerEvents: isTextMode ? "none" : "auto",
                    }}
                  >
                  <img
                    src={uploadedImage || "/placeholder.svg"}
                    alt="Uploaded"
                    className="w-full h-full object-cover pointer-events-none"
                  />
                  <canvas
                    ref={drawingCanvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className={`absolute inset-0 ${isDrawMode ? "block" : "hidden"}`}
                    style={{
                      cursor: isDrawMode ? "crosshair" : "default",
                      pointerEvents: isDrawMode ? "auto" : "none",
                    }}
                  />

                  {textElements.map((textEl) => (
                    <div
                      key={textEl.id}
                      className={`absolute group ${selectedTextId === textEl.id ? "ring-2 ring-primary rounded" : ""}`}
                      style={{
                        left: `${textEl.x}px`,
                        top: `${textEl.y}px`,
                        cursor: isTextMode ? (draggingTextId === textEl.id ? "grabbing" : "pointer") : "default",
                        padding: "2px",
                        pointerEvents: "auto",
                        // Counter-rotate text to keep it upright when in text mode
                        transform: isTextMode ? `rotate(${-rotation}deg)` : "none",
                        transformOrigin: "center",
                      }}
                      onClick={(e) => {
                        if (isTextMode && !draggingTextId) {
                          handleTextClick(e, textEl.id)
                        }
                      }}
                      onMouseDown={(e) => {
                        if (isTextMode && selectedTextId === textEl.id) {
                          handleTextMouseDown(e, textEl.id)
                        }
                      }}
                      onMouseUp={isTextMode ? handleTextMouseUp : undefined}
                    >
                      <div
                        style={{
                          color: textEl.color,
                          fontSize: `${textEl.fontSize}px`,
                          fontFamily: textEl.font,
                          whiteSpace: "nowrap",
                          textShadow: "0 0 2px rgba(0,0,0,0.8)",
                        }}
                      >
                        {textEl.text}
                      </div>
                    </div>
                  ))}

                  {/* Inline text input when adding new text */}
                  {isTextMode && addingTextAt && (
                    <div
                      className="absolute z-10"
                      style={{
                        left: `${addingTextAt.x}px`,
                        top: `${addingTextAt.y}px`,
                        pointerEvents: "auto",
                        // Counter-rotate to keep input upright when image is rotated
                        transform: `rotate(${-rotation}deg)`,
                        transformOrigin: "center",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2 bg-card border-2 border-primary rounded px-2 py-1 shadow-lg">
                        <input
                          type="text"
                          value={newTextInput}
                          onChange={(e) => setNewTextInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newTextInput.trim()) {
                              confirmAddText()
                            } else if (e.key === "Escape") {
                              cancelAddText()
                            }
                          }}
                          placeholder="Type text..."
                          autoFocus
                          className="text-xs bg-transparent border-none outline-none text-foreground w-48"
                          style={{
                            fontSize: `${textFontSize}px`,
                            fontFamily: textFont,
                            color: textColor,
                          }}
                        />
                        <Button size="sm" className="h-6 px-2 text-xs" onClick={confirmAddText}>
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={cancelAddText}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {isCropMode && cropArea && (
                    <>
                      <div className="absolute inset-0 bg-black/40" />
                      <div
                        className="absolute bg-transparent border-2 border-yellow-400 shadow-lg"
                        style={{
                          left: `${cropArea.x}px`,
                          top: `${cropArea.y}px`,
                          width: `${cropArea.width}px`,
                          height: `${cropArea.height}px`,
                          cursor: "move",
                        }}
                        onMouseDown={(e) => handleCropMouseDown(e, "move")}
                      >
                        {/* NW Corner */}
                        <div
                          className="absolute w-3 h-3 bg-yellow-400 rounded-full -top-1.5 -left-1.5 cursor-nwse-resize hover:scale-125 transition-transform"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleCropMouseDown(e, "nw")
                          }}
                        />
                        {/* NE Corner */}
                        <div
                          className="absolute w-3 h-3 bg-yellow-400 rounded-full -top-1.5 -right-1.5 cursor-nesw-resize hover:scale-125 transition-transform"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleCropMouseDown(e, "ne")
                          }}
                        />
                        {/* SW Corner */}
                        <div
                          className="absolute w-3 h-3 bg-yellow-400 rounded-full -bottom-1.5 -left-1.5 cursor-nesw-resize hover:scale-125 transition-transform"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleCropMouseDown(e, "sw")
                          }}
                        />
                        {/* SE Corner */}
                        <div
                          className="absolute w-3 h-3 bg-yellow-400 rounded-full -bottom-1.5 -right-1.5 cursor-nwse-resize hover:scale-125 transition-transform"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleCropMouseDown(e, "se")
                          }}
                        />
                      </div>
                    </>
                  )}

                  {/* Mode Indicator Overlay */}
                  <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground px-2 py-1 rounded text-xs font-medium">
                    {isCropMode
                      ? "Cropping"
                      : isDrawMode
                        ? "Drawing"
                        : isTextMode
                          ? "Text"
                          : mode === "free"
                            ? "Free Canvas"
                            : mode}
                  </div>
                  </div>
                </div>
              ) : (
                <div
                  className="w-96 h-64 bg-card border-2 border-dashed border-primary/40 rounded-lg flex flex-col items-center justify-center relative overflow-hidden cursor-pointer hover:border-primary/60 hover:bg-card/50 transition-all flex-shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div
                    className="absolute inset-0 opacity-5"
                    style={{
                      backgroundImage:
                        "linear-gradient(0deg, transparent 24%, rgba(255, 255, 255, 0.05) 25%, rgba(255, 255, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, 0.05) 75%, rgba(255, 255, 255, 0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255, 255, 255, 0.05) 25%, rgba(255, 255, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, 0.05) 75%, rgba(255, 255, 255, 0.05) 76%, transparent 77%, transparent)",
                      backgroundSize: "50px 50px",
                    }}
                  />
                  <div className="relative z-10 text-center">
                    <Upload className="w-12 h-12 text-primary/60 mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">Upload an image</p>
                    <p className="text-xs text-muted-foreground">Click or drag to upload</p>
                  </div>
                </div>
              )}

              {/* Coordinates Display */}
              <div className="absolute -bottom-12 left-0 right-0 flex justify-between text-xs text-muted-foreground pointer-events-none">
                <span>0, 0</span>
                <span>
                  {Math.round(canvasDimensions.width)} × {Math.round(canvasDimensions.height)}
                </span>
              </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Properties */}
        <div className="w-72 border-l border-border bg-sidebar/30 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Properties Title */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">
                {isCropMode
                  ? "Crop Tool"
                  : isDrawMode
                    ? "Drawing Tools"
                    : isTextMode
                      ? "Text Tool"
                      : uploadedImage
                        ? "Image Properties"
                        : "Image Info"}
              </h3>
            </div>

            {/* Crop Properties */}
            {isCropMode && cropArea && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Crop Area</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">X:</span> {Math.round(cropArea.x)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Y:</span> {Math.round(cropArea.y)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">W:</span> {Math.round(cropArea.width)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">H:</span> {Math.round(cropArea.height)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Drag corners to resize. Drag center to move. Click Apply to save.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={applyCrop}>
                    Apply Crop
                  </Button>
                  <Button variant="outline" className="flex-1 bg-transparent" onClick={cancelCrop}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Drawing Properties */}
            {isDrawMode && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Brush Size
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium text-foreground w-12">{brushSize}px</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Brush Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brushColor}
                      onChange={(e) => setBrushColor(e.target.value)}
                      className="w-12 h-12 rounded cursor-pointer border-2 border-border"
                    />
                    <span className="text-sm font-mono text-foreground">{brushColor}</span>
                  </div>
                </div>

                <Button variant="outline" className="w-full bg-transparent" onClick={clearDrawing}>
                  Clear Drawing
                </Button>

                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Draw on the canvas using your selected brush. Click on the Draw tool again to exit drawing mode.
                  </p>
                </div>
              </div>
            )}

            {isTextMode && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">How to Use</label>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Click anywhere on canvas to add text</li>
                    <li>Type and press Enter to confirm</li>
                    <li>Click on text to select and edit properties</li>
                    <li>Drag selected text to reposition</li>
                  </ul>
                </div>

                {selectedTextId && (
                  <div className="space-y-2 p-3 bg-primary/10 border border-primary/30 rounded">
                    <label className="text-xs font-medium text-primary uppercase tracking-wide">
                      Selected Text
                    </label>
                    <p className="text-xs text-foreground">
                      {textElements.find((t) => t.id === selectedTextId)?.text}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Use toolbar to change font, size, and color
                    </p>
                  </div>
                )}

                {textElements.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Text Elements ({textElements.length})
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {textElements.map((textEl) => (
                        <div
                          key={textEl.id}
                          className={`flex items-center justify-between gap-2 p-2 rounded border cursor-pointer hover:bg-card/50 transition-colors ${
                            selectedTextId === textEl.id
                              ? "bg-primary/10 border-primary"
                              : "bg-card border-border"
                          }`}
                          onClick={() => handleTextClick({ stopPropagation: () => {} } as any, textEl.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground truncate font-medium">{textEl.text}</p>
                            <p className="text-xs text-muted-foreground">
                              {textEl.font} • {textEl.fontSize}px
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteTextElement(textEl.id)
                            }}
                            className="text-xs text-red-500 hover:text-red-600 flex-shrink-0"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Image Dimensions */}
            {uploadedImage && imageSize && !isDrawMode && !isCropMode && !isTextMode && (
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Original Dimensions
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Width</label>
                    <input
                      type="number"
                      value={Math.round(imageSize.width)}
                      readOnly
                      className="w-full px-3 py-2 bg-card border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Height</label>
                    <input
                      type="number"
                      value={Math.round(imageSize.height)}
                      readOnly
                      className="w-full px-3 py-2 bg-card border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Canvas Dimensions */}
            {uploadedImage && !isDrawMode && !isCropMode && !isTextMode && (
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Canvas Dimensions
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Width</label>
                    <input
                      type="number"
                      value={Math.round(canvasDimensions.width)}
                      readOnly
                      className="w-full px-3 py-2 bg-card border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Height</label>
                    <input
                      type="number"
                      value={Math.round(canvasDimensions.height)}
                      readOnly
                      className="w-full px-3 py-2 bg-card border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Rotation Info */}
            {uploadedImage && !isDrawMode && !isCropMode && !isTextMode && (
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rotation</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => rotateImage(90)}>
                    Rotate 90°
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setRotation(0)}>
                    Reset
                  </Button>
                </div>
                <div className="px-3 py-2 rounded text-sm bg-primary/20 text-primary border border-primary/30">
                  {rotation}° rotation
                </div>
              </div>
            )}

            {/* Mode Info */}
            {!isDrawMode && !isCropMode && !isTextMode && uploadedImage && (
              <div className="pt-4 border-t border-border space-y-3">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Current Mode
                </label>
                <div className="px-3 py-2 rounded text-sm bg-primary/20 text-primary border border-primary/30">
                  {mode === "free" ? "Free Canvas - Any Aspect Ratio" : `${mode} Aspect Ratio`}
                </div>
              </div>
            )}

            {/* Info Text */}
            {!uploadedImage && (
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Click the upload button or select an image to get started. You can then choose different canvas modes
                  to adjust the aspect ratio.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            {uploadedImage && !isDrawMode && !isCropMode && !isTextMode && (
              <div className="pt-4 border-t border-border space-y-2">
                <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => fileInputRef.current?.click()}>
                  Change Image
                </Button>
                <Button variant="outline" className="w-full bg-transparent" onClick={handleClearCanvas}>
                  Clear All
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
}: { icon: any; label: string; active: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 group relative ${
        active
          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
          : "text-muted-foreground hover:bg-card hover:text-foreground"
      }`}
      title={label}
    >
      <Icon className="w-5 h-5" />
      <span className="absolute left-full ml-2 px-2 py-1 bg-card text-foreground text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
        {label}
      </span>
    </button>
  )
}
