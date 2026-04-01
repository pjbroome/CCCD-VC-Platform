import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Check, X, Edit2, Save, Trash2, Film, Eye, Star, Image, Plus, GripVertical, ZoomIn, ZoomOut, ChevronDown, ChevronUp, Layers, Play, Video, VideoOff, Maximize2, Minimize2, Move, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, FileText, Tag, FolderOpen, ClipboardList, Phone, Mail, DollarSign, Calendar, Users, Archive, Send, RefreshCw, Clock, Camera, MessageSquare, ExternalLink, UserPlus, LayoutDashboard, Settings, PanelLeftClose, PanelLeft, Undo2, Upload, ImagePlus } from 'lucide-react'
import { DndContext, closestCenter, pointerWithin, DragEndEvent, DragStartEvent, DragOverlay, useSensor, useSensors, PointerSensor, useDroppable } from '@dnd-kit/core'
import type { CollisionDetection } from '@dnd-kit/core'
import { SortableContext, useSortable, rectSortingStrategy, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './App.css'

const API = import.meta.env.VITE_API_URL || 'https://app-aegidish.fly.dev'

/* Custom collision detection: prioritize container droppables (dock, rows, delete zones)
   over individual sortable items so cross-container drag works reliably */
const containerFirstCollision: CollisionDetection = (args) => {
  const pw = pointerWithin(args)
  const containerHit = pw.find(
    c => typeof c.id === 'string' && (c.id === 'dock-drop-zone' || c.id.startsWith('row-drop-') || c.id === 'delete-left' || c.id === 'delete-right')
  )
  if (containerHit) return [containerHit]
  return closestCenter(args)
}

interface Slide {
  slide_number: number
  condition: string
  solution: string
  complexity: number | null
  tone: string[]
  duration: string
  cost_bracket: string
  cost_numeric: number | null
  treatments: string[]
  concerns: string[]
  gender: string
  is_celebrity_case: boolean
  slide_type: string
  image_count: number
  images: string[]
  full_slide_image?: string
  text_content: string[]
  custom_label?: string
  notes_raw?: string
  is_process_slide?: boolean
}

interface RecordingDeck {
  id: number
  name: string
  slide_numbers: number[]
  created_at: string
}

interface SavedPresentation {
  id: number
  name: string
  slide_numbers: number[]
  request_type: string
  procedures: string[]
  script: string
  notes: string
  created_at: string
  updated_at: string
}

interface VCRequest {
  id: number
  patient_name: string
  email: string
  phone: string
  message: string
  concerns: string[]
  photos: string[]
  status: string
  submitted_at: string
  updated_at: string
  notes: string
  consultation_id: number | null
}

interface Consultation {
  id: number
  request_id: number | null
  patient_name: string
  email: string
  phone: string
  concerns: string[]
  photos: string[]
  slide_numbers: number[]
  presentation_name: string
  script: string
  video_url: string
  summary_slide_data: Record<string, unknown> | null
  status: string
  watch_count: number
  last_watched_at: string | null
  sent_at: string
  created_at: string
  updated_at: string
  follow_up_dates: string[]
  notes: string
}

type ViewMode = 'grid' | 'sorter' | 'deck' | 'present' | 'presentations' | 'dashboard' | 'consult' | 'archive' | 'settings'

const SIZE_PRESETS = [
  { cols: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8', label: 'XS' },
  { cols: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6', label: 'S' },
  { cols: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5', label: 'M' },
  { cols: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3', label: 'L' },
  { cols: 'grid-cols-1 md:grid-cols-2', label: 'XL' },
]

const CAM_SIZES = [
  { w: 120, h: 120, label: 'S' },
  { w: 180, h: 180, label: 'M' },
  { w: 260, h: 260, label: 'L' },
  { w: 360, h: 360, label: 'XL' },
]

function getFullSlideUrl(slide: Slide) {
  const imgName = slide.full_slide_image || 'slide_' + String(slide.slide_number).padStart(3, '0') + '_full.jpg'
  return API + '/images/' + imgName
}

/* -- Sortable slide card for grid view -- */
function SortableSlideCard({ slide, size, selectedSlides, expandedSlide, toggleSlideSelection, startEdit, getSlideLabel, getSlideImage, formatTreatment, onRemove }: {
  slide: Slide; size: number; selectedSlides: Set<number>; expandedSlide: number | null
  toggleSlideSelection: (n: number) => void; startEdit: (s: Slide) => void
  getSlideLabel: (s: Slide) => string; getSlideImage: (s: Slide) => string | null
  formatTreatment: (t: string) => string; onRemove: (n: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.slide_number })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const isCompact = size <= 1

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={'bg-gray-900 rounded-lg border overflow-hidden transition-all hover:border-blue-500 cursor-grab active:cursor-grabbing ' +
      (selectedSlides.has(slide.slide_number) ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-800')
    } onClick={() => toggleSlideSelection(slide.slide_number)}>
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-800/50 border-b border-gray-800">
        <div className="flex items-center gap-1 min-w-0">
          <GripVertical size={isCompact ? 12 : 14} className="text-gray-500 flex-shrink-0" />
          <span className="text-xs font-mono text-gray-400 flex-shrink-0">#{slide.slide_number}</span>
          {!isCompact && <p className="text-xs text-white font-medium truncate">{getSlideLabel(slide)}</p>}
          {slide.is_celebrity_case && <Star size={12} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); toggleSlideSelection(slide.slide_number) }}
            className={'p-0.5 rounded ' + (selectedSlides.has(slide.slide_number) ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white')}>
            <Check size={isCompact ? 10 : 12} />
          </button>
          {!isCompact && (
            <>
              <button onClick={e => { e.stopPropagation(); startEdit(slide) }} className="p-0.5 rounded text-gray-500 hover:text-white"><Edit2 size={12} /></button>
              <button onClick={e => { e.stopPropagation(); onRemove(slide.slide_number) }} className="p-0.5 rounded text-gray-500 hover:text-red-400" title="Remove slide"><Trash2 size={12} /></button>
            </>
          )}
        </div>
      </div>
      <div className="bg-gray-800 relative">
        <img src={getFullSlideUrl(slide)} alt={'Slide ' + slide.slide_number} className="w-full object-contain" loading="lazy"
          onError={e => { const t = e.target as HTMLImageElement; t.onerror = null; t.src = getSlideImage(slide) || 'https://placehold.co/800x450/1f2937/6b7280?text=No+Slide' }} />
        {selectedSlides.has(slide.slide_number) && (
          <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />
        )}
      </div>
      {expandedSlide === slide.slide_number && slide.images.length > 0 && (
        <div className="border-t border-gray-700 p-2 bg-gray-800/80" onClick={e => e.stopPropagation()}>
          <p className="text-xs text-gray-400 mb-1">Individual images ({slide.images.length})</p>
          <div className="grid grid-cols-3 gap-1">
            {slide.images.map((img, i) => (
              <img key={i} src={API + '/images/' + img} alt="" className="w-full rounded object-contain bg-gray-900" style={{ maxHeight: '120px' }} loading="lazy"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ))}
          </div>
        </div>
      )}
      {!isCompact && (
        <div className="px-2 py-1.5 border-t border-gray-800">
          <div className="flex flex-wrap gap-0.5">
            {slide.treatments.slice(0, 2).map(t => (
              <button key={t} onClick={e => { e.stopPropagation(); startEdit(slide) }}
                className="text-xs bg-blue-900/50 text-blue-300 px-1 py-0.5 rounded hover:bg-blue-800/70 hover:ring-1 hover:ring-blue-400/50 cursor-pointer transition-colors" title="Click to edit">{formatTreatment(t)}</button>
            ))}
            {slide.concerns.slice(0, 2).map(c => (
              <button key={c} onClick={e => { e.stopPropagation(); startEdit(slide) }}
                className="text-xs bg-purple-900/50 text-purple-300 px-1 py-0.5 rounded hover:bg-purple-800/70 hover:ring-1 hover:ring-purple-400/50 cursor-pointer transition-colors" title="Click to edit">{formatTreatment(c)}</button>
            ))}
          </div>
          {slide.cost_bracket && <p className="text-xs text-green-400 mt-0.5">{slide.cost_bracket}</p>}
        </div>
      )}
    </div>
  )
}

/* -- Sortable thumbnail for presentation queue -- */
function SortableQueueThumb({ slide, index, total, isActive, onSelect, onMoveUp, onMoveDown, onRemove, getSlideLabel }: {
  slide: Slide; index: number; total: number; isActive: boolean; onSelect: () => void
  onMoveUp: () => void; onMoveDown: () => void; onRemove: () => void; getSlideLabel: (s: Slide) => string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.slide_number })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div ref={setNodeRef} style={style}
      className={'flex items-center gap-1.5 p-1.5 rounded-lg border-2 transition-all group ' +
        (isActive ? 'border-blue-500 bg-blue-500/10' : 'border-transparent hover:border-gray-600 hover:bg-gray-800/50') +
        (isDragging ? ' shadow-2xl' : '')
      }
    >
      <button {...attributes} {...listeners} className="p-0.5 text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" title="Drag to reorder">
        <GripVertical size={14} />
      </button>
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <button onClick={e => { e.stopPropagation(); onMoveUp() }} disabled={index === 0}
          className="p-0 text-gray-500 hover:text-blue-400 disabled:opacity-20 disabled:hover:text-gray-500" title="Move up">
          <ArrowUp size={11} />
        </button>
        <button onClick={e => { e.stopPropagation(); onMoveDown() }} disabled={index >= total - 1}
          className="p-0 text-gray-500 hover:text-blue-400 disabled:opacity-20 disabled:hover:text-gray-500" title="Move down">
          <ArrowDown size={11} />
        </button>
      </div>
      <span className="text-xs font-mono text-gray-500 w-5 text-center flex-shrink-0">{index + 1}</span>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onSelect}>
        <div className="flex items-center gap-1.5">
          <img src={getFullSlideUrl(slide)} alt="" className="w-20 h-11 object-contain rounded bg-gray-800 flex-shrink-0"
            onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/80x45/1f2937/6b7280?text=...' }} />
          <p className="text-xs text-gray-300 truncate">{getSlideLabel(slide)}</p>
        </div>
      </div>
      <button onClick={e => { e.stopPropagation(); onRemove() }}
        className="p-0.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Remove from queue">
        <X size={12} />
      </button>
    </div>
  )
}

/* -- Sortable card for list sorter view -- */
function SortableListCard({ slide, selectedSlides, toggleSlideSelection, startEdit, setConfirmRemove, getSlideLabel, getSlideImage, formatTreatment }: {
  slide: Slide; selectedSlides: Set<number>
  toggleSlideSelection: (n: number) => void; startEdit: (s: Slide) => void; setConfirmRemove: (n: number) => void
  getSlideLabel: (s: Slide) => string; getSlideImage: (s: Slide) => string | null; formatTreatment: (t: string) => string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.slide_number })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={'flex-shrink-0 w-56 bg-gray-800 rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing transition-all hover:border-blue-500 ' +
      (selectedSlides.has(slide.slide_number) ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-gray-700') +
      (isDragging ? ' shadow-2xl z-50' : '')
    } onClick={() => toggleSlideSelection(slide.slide_number)}>
      <div className="relative">
        <img src={getFullSlideUrl(slide)} alt={'Slide ' + slide.slide_number} className="w-full object-contain" loading="lazy"
          onError={e => { const t = e.target as HTMLImageElement; t.onerror = null; t.src = getSlideImage(slide) || 'https://placehold.co/224x126/1f2937/6b7280?text=No+Slide' }} />
        <div className="absolute top-1 left-1 flex items-center gap-1">
          <GripVertical size={12} className="text-gray-300" />
          <span className="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">#{slide.slide_number}</span>
        </div>
        {selectedSlides.has(slide.slide_number) && <div className="absolute top-1 right-1 bg-blue-600 rounded p-0.5"><Check size={10} /></div>}
        {slide.is_celebrity_case && <div className="absolute bottom-1 right-1"><Star size={12} className="text-yellow-400 fill-yellow-400" /></div>}
      </div>
      <div className="px-2 py-1.5">
        <p className="text-xs text-white font-medium truncate">{getSlideLabel(slide)}</p>
        <div className="flex items-center justify-between mt-1">
          <div className="flex flex-wrap gap-0.5">
            {slide.treatments.slice(0, 1).map(t => <button key={t} onClick={ev => { ev.stopPropagation(); startEdit(slide) }}
              className="text-xs bg-blue-900/50 text-blue-300 px-1 py-0.5 rounded hover:bg-blue-800/70 hover:ring-1 hover:ring-blue-400/50 cursor-pointer transition-colors" title="Click to edit">{formatTreatment(t)}</button>)}
            {slide.concerns.slice(0, 1).map(c => <button key={c} onClick={ev => { ev.stopPropagation(); startEdit(slide) }}
              className="text-xs bg-purple-900/50 text-purple-300 px-1 py-0.5 rounded hover:bg-purple-800/70 hover:ring-1 hover:ring-purple-400/50 cursor-pointer transition-colors" title="Click to edit">{formatTreatment(c)}</button>)}
          </div>
          <div className="flex gap-0.5">
            <button onClick={ev => { ev.stopPropagation(); startEdit(slide) }} className="p-0.5 text-gray-500 hover:text-white"><Edit2 size={10} /></button>
            <button onClick={ev => { ev.stopPropagation(); setConfirmRemove(slide.slide_number) }} className="p-0.5 text-gray-500 hover:text-red-400"><Trash2 size={10} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* -- Countdown overlay -- */
function CountdownOverlay({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(3)
  useEffect(() => {
    if (count <= 0) { onDone(); return }
    const timer = setTimeout(() => setCount(count - 1), 1000)
    return () => clearTimeout(timer)
  }, [count, onDone])

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
      <div className="text-center">
        <div className="text-9xl font-bold text-white animate-pulse" key={count}>
          {count > 0 ? count : ''}
        </div>
        <p className="text-gray-400 text-lg mt-4">Camera starting...</p>
      </div>
    </div>
  )
}

/* -- Droppable zone component for dock/delete targets -- */
function DroppableZone({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return <div ref={setNodeRef} className={className + (isOver ? ' ring-2 ring-amber-400 bg-amber-900/40' : '')}>{children}</div>
}

function DeleteDropZone({ id, side }: { id: string, side: 'left' | 'right' }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={'fixed top-0 z-50 h-full transition-all duration-200 flex items-center justify-center ' +
      (side === 'left' ? 'left-0 w-16' : 'right-0 w-16') + ' ' +
      (isOver ? 'bg-red-600/40 backdrop-blur-sm' : 'bg-transparent pointer-events-auto')}>
      {isOver && <Trash2 size={32} className="text-red-400 animate-pulse" />}
    </div>
  )
}

/* ====== MAIN APP ====== */
function App() {
  const [slides, setSlides] = useState<Slide[]>([])
  const [filteredSlides, setFilteredSlides] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTreatment, setFilterTreatment] = useState('')
  const [filterConcern, setFilterConcern] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedSlides, setSelectedSlides] = useState<Set<number>>(new Set())
  const [expandedSlide, _setExpandedSlide] = useState<number | null>(null)
  const [editingSlide, setEditingSlide] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<Slide>>({})
  const [decks, setDecks] = useState<RecordingDeck[]>([])
  const [deckName, setDeckName] = useState('')
  const [previewDeck, setPreviewDeck] = useState<RecordingDeck | null>(null)
  const [previewSlideIdx, setPreviewSlideIdx] = useState(0)
  const [stats, setStats] = useState<{ treatment_types: Record<string, number>, concern_types: Record<string, number> } | null>(null)
  const [slideSize, setSlideSize] = useState(3)
  const [dragActiveId, setDragActiveId] = useState<number | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null)
  const [sorterCollapsed, setSorterCollapsed] = useState<Record<string, boolean>>({})
  const [editingCategory, setEditingCategory] = useState<{ type: 'treatment' | 'concern', oldName: string, newName: string } | null>(null)
  const [newCategory, setNewCategory] = useState<{ type: 'treatment' | 'concern', name: string } | null>(null)

  // Undo stack for accidental deletions/removals
  const [undoStack, setUndoStack] = useState<Array<{ type: string, description: string, restore: () => void }>>([])
  const [showUndoToast, setShowUndoToast] = useState(false)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pushUndo = useCallback((action: { type: string, description: string, restore: () => void }) => {
    setUndoStack(prev => [...prev.slice(-19), action])
    setShowUndoToast(true)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setShowUndoToast(false), 5000)
  }, [])
  const performUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      last.restore()
      return prev.slice(0, -1)
    })
    setShowUndoToast(false)
  }, [])

  // Import slides state
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFiles, setImportFiles] = useState<File[]>([])
  const [importing, setImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  // Sorter drag source tracking
  const [sorterDragSource, setSorterDragSource] = useState<string | null>(null)

  // Sidebar state (Kleon-style)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('vc_sidebar_collapsed')
    return saved === 'true'
  })
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev
      localStorage.setItem('vc_sidebar_collapsed', String(next))
      return next
    })
  }, [])

  // Dock state — quick-selection area at top of List Sorter
  const [dockSlides, setDockSlides] = useState<number[]>(() => {
    const saved = localStorage.getItem('vc_dock_slides')
    return saved ? JSON.parse(saved) : []
  })
  // Row title renaming
  const [editingRowTitle, setEditingRowTitle] = useState<{ category: string, newName: string } | null>(null)
  const [customRowTitles, setCustomRowTitles] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('vc_custom_row_titles')
    return saved ? JSON.parse(saved) : {}
  })

  // Presentation mode state
  const [presentationSlides, setPresentationSlides] = useState<Slide[]>([])
  const [presentIdx, setPresentIdx] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Webcam state
  const [camOn, setCamOn] = useState(false)
  const [camSizeIdx, setCamSizeIdx] = useState(1)
  const [camPos, setCamPos] = useState({ x: 40, y: 40 })
  const [camCorner, setCamCorner] = useState<'br' | 'bl' | 'tr' | 'tl'>('br')
  const [camDragging, setCamDragging] = useState(false)
  const [camDragStart, setCamDragStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 })
  const [showCountdown, setShowCountdown] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const presentRef = useRef<HTMLDivElement>(null)

  // Summary slide state
  const [showSummaryBuilder, setShowSummaryBuilder] = useState(false)
  const [summaryForm, setSummaryForm] = useState({
    treatments: [{ name: 'New Patient Exam (NPE)', details: '', visits: '1 (1.5 hours reserved)', fee: '$500' }],
    treatmentHeader: 'Treatment Suggestions / Options',
    visitsHeader: 'Number of Visits',
    feeHeader: 'Fee for Tx Options',
    slideTitle: 'Treatment Summary',
  })
  const [summarySlideData, setSummarySlideData] = useState<{
    treatments: { name: string; details: string; visits: string; fee: string }[]; treatmentHeader: string;
    visitsHeader: string; feeHeader: string;
    slideTitle: string;
  } | null>(null)
  const [summaryInserted, setSummaryInserted] = useState(false)

  // Dropdown options for summary builder (editable by user)
  const [treatmentOptions, setTreatmentOptions] = useState<string[]>(() => {
    const saved = localStorage.getItem('vc_treatment_options')
    return saved ? JSON.parse(saved) : ['New Patient Exam (NPE)', 'No Prep Veneers', 'Minimal Prep Veneers', 'Porcelain Veneers', 'Invisalign', 'Teeth Whitening', 'Bonding', 'Full Mouth Rejuvenation', 'Gum Lift', 'Implant', 'Crown', 'Bridge', 'Maryland Bridge', 'Smile Project', 'Smile Design', 'Night Guard', 'Gum Sculpting', 'Post Op Visit']
  })
  const [visitsOptions, setVisitsOptions] = useState<string[]>(() => {
    const saved = localStorage.getItem('vc_visits_options')
    return saved ? JSON.parse(saved) : ['1 (1.5 hours reserved)', '2-3 visits', '3-4 visits', '4-6 visits', '6+ visits']
  })
  const [feeOptions, setFeeOptions] = useState<string[]>(() => {
    const saved = localStorage.getItem('vc_fee_options')
    return saved ? JSON.parse(saved) : ['$500', '$1,500 - $3,000', '$5,000 - $8,000', '$8,000 - $12,000', '$12,000 - $18,000', '$18,000 - $25,000', '$25,000 - $35,000', '$35,000 - $55,000', '$55,000 - $68,000']
  })
  const [editingDropdown, setEditingDropdown] = useState<{ type: 'treatment' | 'visits' | 'fee', action: 'add' | 'edit', index?: number, value: string } | null>(null)

  // Saved Presentations state
  const [savedPresentations, setSavedPresentations] = useState<SavedPresentation[]>([])
  const [showSavePresModal, setShowSavePresModal] = useState(false)
  const [savePresForm, setSavePresForm] = useState({ name: '', request_type: '', procedures: '', script: '', notes: '' })
  const [editingPresentation, setEditingPresentation] = useState<SavedPresentation | null>(null)
  const [presFilterType, setPresFilterType] = useState('')
  const [presFilterProc, setPresFilterProc] = useState('')
  const [presCats, setPresCats] = useState<{ request_types: Record<string, number>, procedures: Record<string, number> }>({ request_types: {}, procedures: {} })
  const [editingPresCat, setEditingPresCat] = useState<{ catType: string, oldName: string, newName: string } | null>(null)

  // VC CRM state
  const [vcRequests, setVcRequests] = useState<VCRequest[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [activeRequest, setActiveRequest] = useState<VCRequest | null>(null)
  const [dashboardFilter, setDashboardFilter] = useState<string>('pending')
  const [archiveFilter, setArchiveFilter] = useState<string>('')
  const [consultSlideSearch, setConsultSlideSearch] = useState('')
  const [consultTab, setConsultTab] = useState<'patient' | 'summary'>('patient')
  const [consultConcernFilter, setConsultConcernFilter] = useState<string>('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const consultVideoRef = useRef<HTMLVideoElement>(null)
  const consultStreamRef = useRef<MediaStream | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  /* -- Data fetching -- */
  const fetchSlides = useCallback(async () => {
    try {
      const res = await fetch(API + '/slides')
      if (!res.ok) { console.warn('Slides endpoint returned', res.status); return }
      const data = await res.json()
      setSlides(data.slides || [])
      setFilteredSlides(data.slides || [])
    } catch (err) { console.error('Failed to fetch slides:', err) }
    finally { setLoading(false) }
  }, [])

  const fetchDecks = useCallback(async () => {
    try { const res = await fetch(API + '/recording-decks'); if (!res.ok) return; const data = await res.json(); setDecks(data.decks || []) }
    catch (err) { console.error('Failed to fetch decks:', err) }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(API + '/stats')
      if (!res.ok) { console.warn('Stats endpoint returned', res.status); return }
      const data = await res.json()
      if (data.treatment_types && data.concern_types) setStats(data)
    } catch (err) { console.error('Failed to fetch stats:', err) }
  }, [])

  const fetchPresentations = useCallback(async () => {
    try { const res = await fetch(API + '/presentations'); if (!res.ok) return; const data = await res.json(); setSavedPresentations(data.presentations || []) }
    catch (err) { console.error('Failed to fetch presentations:', err) }
  }, [])

  const fetchPresCats = useCallback(async () => {
    try { const res = await fetch(API + '/presentation-categories'); if (!res.ok) return; const data = await res.json(); setPresCats(data) }
    catch (err) { console.error('Failed to fetch presentation categories:', err) }
  }, [])

  const fetchVcRequests = useCallback(async () => {
    try { const res = await fetch(API + '/vc/requests'); if (!res.ok) return; const data = await res.json(); setVcRequests(data.requests || []) }
    catch (err) { console.error('Failed to fetch VC requests:', err) }
  }, [])

  const fetchConsultations = useCallback(async () => {
    try { const res = await fetch(API + '/vc/consultations'); if (!res.ok) return; const data = await res.json(); setConsultations(data.consultations || []) }
    catch (err) { console.error('Failed to fetch consultations:', err) }
  }, [])

  useEffect(() => { fetchSlides(); fetchDecks(); fetchStats(); fetchPresentations(); fetchPresCats(); fetchVcRequests(); fetchConsultations() }, [fetchSlides, fetchDecks, fetchStats, fetchPresentations, fetchPresCats, fetchVcRequests, fetchConsultations])

  useEffect(() => {
    let result = slides
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(s =>
        s.condition?.toLowerCase().includes(q) || s.solution?.toLowerCase().includes(q) ||
        s.custom_label?.toLowerCase().includes(q) || s.treatments.some(t => t.toLowerCase().includes(q)) ||
        s.concerns.some(c => c.toLowerCase().includes(q)) || s.text_content.some(t => t.toLowerCase().includes(q)) ||
        ('slide ' + s.slide_number).includes(q)
      )
    }
    if (filterTreatment) result = result.filter(s => s.treatments.includes(filterTreatment))
    if (filterConcern) result = result.filter(s => s.concerns.includes(filterConcern))
    setFilteredSlides(result)
  }, [slides, searchQuery, filterTreatment, filterConcern])

  /* -- Keyboard nav for presentation mode -- */
  useEffect(() => {
    if (viewMode !== 'present') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        setPresentIdx(prev => Math.min(prev + 1, presentationSlides.length - 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setPresentIdx(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Escape') {
        if (isFullscreen && document.fullscreenElement) {
          document.exitFullscreen()
          setIsFullscreen(false)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [viewMode, presentationSlides.length, isFullscreen])

  /* -- Webcam mouse drag -- */
  useEffect(() => {
    if (!camDragging) return
    const onMove = (e: MouseEvent) => {
      setCamPos({ x: camDragStart.ox - (e.clientX - camDragStart.x), y: camDragStart.oy - (e.clientY - camDragStart.y) })
    }
    const onUp = () => setCamDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [camDragging, camDragStart])

  /* -- Slide selection & editing -- */
  const toggleSlideSelection = (slideNum: number) => {
    setSelectedSlides(prev => { const next = new Set(prev); if (next.has(slideNum)) next.delete(slideNum); else next.add(slideNum); return next })
  }
  const selectAll = () => {
    if (selectedSlides.size === filteredSlides.length) setSelectedSlides(new Set())
    else setSelectedSlides(new Set(filteredSlides.map(s => s.slide_number)))
  }
  const saveDeck = async () => {
    if (!deckName.trim() || selectedSlides.size === 0) return
    try {
      const res = await fetch(API + '/recording-decks', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deckName, slide_numbers: Array.from(selectedSlides) }) })
      if (res.ok) { setDeckName(''); setSelectedSlides(new Set()); fetchDecks() }
    } catch (err) { console.error('Failed to save deck:', err) }
  }
  const deleteDeck = async (deckId: number) => {
    try { await fetch(API + '/recording-decks/' + deckId, { method: 'DELETE' }); fetchDecks() }
    catch (err) { console.error('Failed to delete deck:', err) }
  }
  const startEdit = (slide: Slide) => {
    setEditingSlide(slide.slide_number)
    setEditForm({ condition: slide.condition, solution: slide.solution, custom_label: slide.custom_label || '',
      treatments: [...slide.treatments], concerns: [...slide.concerns] })
  }
  const saveEdit = async () => {
    if (editingSlide === null) return
    try {
      const body: Record<string, unknown> = {}
      if (editForm.condition !== undefined) body.condition = editForm.condition
      if (editForm.solution !== undefined) body.solution = editForm.solution
      if (editForm.custom_label !== undefined) body.custom_label = editForm.custom_label
      if (editForm.treatments !== undefined) body.treatments = editForm.treatments
      if (editForm.concerns !== undefined) body.concerns = editForm.concerns
      const res = await fetch(API + '/slides/' + editingSlide, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) { setEditingSlide(null); fetchSlides() }
    } catch (err) { console.error('Failed to save edit:', err) }
  }
  const removeSlide = (slideNum: number) => {
    const removedSlide = slides.find(s => s.slide_number === slideNum)
    const prevSlides = [...slides]
    setSlides(prev => prev.filter(s => s.slide_number !== slideNum))
    setConfirmRemove(null)
    if (removedSlide) {
      pushUndo({ type: 'remove_slide', description: `Removed slide #${slideNum}`, restore: () => setSlides(prevSlides) })
    }
  }

  /* -- Grid drag & drop -- */
  const handleDragStart = (event: DragStartEvent) => { setDragActiveId(event.active.id as number) }
  const handleDragEnd = (event: DragEndEvent) => {
    setDragActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = filteredSlides.findIndex(s => s.slide_number === active.id)
    const newIndex = filteredSlides.findIndex(s => s.slide_number === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(filteredSlides, oldIndex, newIndex)
    setFilteredSlides(reordered)
    const newOrder = reordered.map(s => s.slide_number)
    setSlides(prev => {
      const copy = [...prev]
      copy.sort((a, b) => {
        const ai = newOrder.indexOf(a.slide_number); const bi = newOrder.indexOf(b.slide_number)
        if (ai === -1 && bi === -1) return 0; if (ai === -1) return 1; if (bi === -1) return -1; return ai - bi
      })
      return copy
    })
  }

  /* -- Presentation queue drag & drop -- */
  const handlePresentDragEnd = (event: DragEndEvent) => {
    setDragActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = presentationSlides.findIndex(s => s.slide_number === active.id)
    const newIndex = presentationSlides.findIndex(s => s.slide_number === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(presentationSlides, oldIndex, newIndex)
    setPresentationSlides(reordered)
    if (oldIndex === presentIdx) setPresentIdx(newIndex)
    else if (oldIndex < presentIdx && newIndex >= presentIdx) setPresentIdx(presentIdx - 1)
    else if (oldIndex > presentIdx && newIndex <= presentIdx) setPresentIdx(presentIdx + 1)
  }

  /* -- Category management -- */
  const renameCategory = async (type: 'treatment' | 'concern', oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) { setEditingCategory(null); return }
    const formatted = newName.trim().toLowerCase().replace(/\s+/g, '_')
    const field = type === 'treatment' ? 'treatments' : 'concerns'
    const updatedSlides = slides.map(s => {
      if ((s[field] as string[]).includes(oldName)) return { ...s, [field]: (s[field] as string[]).map((c: string) => c === oldName ? formatted : c) }
      return s
    })
    setSlides(updatedSlides)
    for (const s of updatedSlides) {
      if ((s[field] as string[]).includes(formatted)) {
        try { await fetch(API + '/slides/' + s.slide_number, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: s[field] }) }) }
        catch (err) { console.error('Failed to update slide:', err) }
      }
    }
    setEditingCategory(null); fetchStats()
  }
  const removeCategory = async (type: 'treatment' | 'concern', name: string) => {
    const field = type === 'treatment' ? 'treatments' : 'concerns'
    const origSlides = [...slides]
    const updatedSlides = slides.map(s => {
      if ((s[field] as string[]).includes(name)) return { ...s, [field]: (s[field] as string[]).filter((c: string) => c !== name) }
      return s
    })
    setSlides(updatedSlides)
    for (const s of updatedSlides) {
      const orig = origSlides.find(o => o.slide_number === s.slide_number)
      if (orig && (orig[field] as string[]).includes(name)) {
        try { await fetch(API + '/slides/' + s.slide_number, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: s[field] }) }) }
        catch (err) { console.error('Failed to update slide:', err) }
      }
    }
    fetchStats()
  }

  /* -- Helpers -- */
  const getSlideLabel = (s: Slide) => {
    if (s.custom_label) return s.custom_label
    if (s.condition) return s.condition
    if (s.text_content.length > 0) return s.text_content[0].substring(0, 80)
    return 'Slide ' + s.slide_number
  }
  const getSlideImage = (s: Slide) => s.images.length === 0 ? null : API + '/images/' + s.images[0]
  const formatTreatment = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const formatConcern = (c: string) => c.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const buildGroupedSlides = () => {
    const groups: Record<string, Slide[]> = {}
    for (const slide of filteredSlides) {
      const cats = [...slide.concerns, ...slide.treatments.filter(t => !slide.concerns.includes(t))]
      if (cats.length === 0) { if (!groups['Uncategorized']) groups['Uncategorized'] = []; groups['Uncategorized'].push(slide) }
      else { for (const cat of cats) { if (!groups[cat]) groups[cat] = []; groups[cat].push(slide) } }
    }
    return groups
  }

  /* -- Dock helpers -- */
  const addToDock = (slideNum: number) => {
    setDockSlides(prev => {
      if (prev.includes(slideNum)) return prev
      const next = [...prev, slideNum]
      localStorage.setItem('vc_dock_slides', JSON.stringify(next))
      return next
    })
  }
  const removeFromDock = (slideNum: number) => {
    setDockSlides(prev => {
      const next = prev.filter(n => n !== slideNum)
      localStorage.setItem('vc_dock_slides', JSON.stringify(next))
      return next
    })
  }
  /* -- Unified sorter drag handler (cross-container: rows ↔ dock ↔ delete) -- */
  const handleUnifiedSorterDragStart = (event: DragStartEvent) => {
    setDragActiveId(event.active.id as number)
    const slideNum = event.active.id as number
    if (dockSlides.includes(slideNum)) {
      setSorterDragSource('dock')
    } else {
      setSorterDragSource('row')
    }
  }
  const handleUnifiedSorterDragEnd = (event: DragEndEvent) => {
    setDragActiveId(null)
    const { active, over } = event
    const slideNum = active.id as number

    // Dropped on delete zone (sides)
    if (over && (String(over.id) === 'delete-left' || String(over.id) === 'delete-right')) {
      const prevDock = [...dockSlides]
      const prevSlidesSnap = [...slides]
      if (dockSlides.includes(slideNum)) {
        removeFromDock(slideNum)
        pushUndo({ type: 'delete_from_dock', description: `Removed slide #${slideNum} from dock`, restore: () => {
          setDockSlides(prevDock); localStorage.setItem('vc_dock_slides', JSON.stringify(prevDock))
        }})
      } else {
        setSlides(prev => prev.filter(s => s.slide_number !== slideNum))
        pushUndo({ type: 'delete_slide', description: `Deleted slide #${slideNum}`, restore: () => setSlides(prevSlidesSnap) })
      }
      setSorterDragSource(null)
      return
    }

    // Dropped on dock zone
    if (over && String(over.id) === 'dock-drop-zone') {
      if (!dockSlides.includes(slideNum)) {
        addToDock(slideNum)
      }
      setSorterDragSource(null)
      return
    }

    // Dropped on a row zone (row-drop-{category}) — remove from dock back to row
    if (over && String(over.id).startsWith('row-drop-')) {
      if (dockSlides.includes(slideNum)) {
        removeFromDock(slideNum)
      }
      setSorterDragSource(null)
      return
    }

    // Dropped on a dock slide — if source is a row, add to dock; if source is dock, reorder
    if (over && typeof over.id === 'number' && dockSlides.includes(over.id)) {
      if (sorterDragSource === 'row' && !dockSlides.includes(slideNum)) {
        addToDock(slideNum)
        setSorterDragSource(null)
        return
      }
      // Reorder within dock
      const oldIndex = dockSlides.indexOf(slideNum)
      const newIndex = dockSlides.indexOf(over.id as number)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(dockSlides, oldIndex, newIndex)
        setDockSlides(reordered)
        localStorage.setItem('vc_dock_slides', JSON.stringify(reordered))
      }
      setSorterDragSource(null)
      return
    }

    // Dropped on a row slide — if source is dock, remove from dock
    if (over && typeof over.id === 'number' && sorterDragSource === 'dock' && !dockSlides.includes(over.id)) {
      removeFromDock(slideNum)
      setSorterDragSource(null)
      return
    }

    setSorterDragSource(null)
  }

  /* -- Import slides -- */
  const handleImportFiles = async () => {
    if (importFiles.length === 0) return
    setImporting(true)
    try {
      for (const file of importFiles) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch(API + '/slides/import', { method: 'POST', body: formData })
        if (!res.ok) {
          console.error('Import failed for', file.name, await res.text())
        }
      }
      await fetchSlides()
      await fetchStats()
      setImportFiles([])
      setShowImportModal(false)
    } catch (err) {
      console.error('Import error:', err)
      alert('Import failed. The backend may not support image uploads yet. Images can be added by placing them in the slide images directory on the server.')
    } finally {
      setImporting(false)
    }
  }

  /* -- Row title helpers -- */
  const getRowTitle = (category: string) => customRowTitles[category] || formatConcern(category)
  const saveRowTitle = (category: string, newTitle: string) => {
    if (!newTitle.trim()) { setEditingRowTitle(null); return }
    const updated = { ...customRowTitles, [category]: newTitle.trim() }
    setCustomRowTitles(updated)
    localStorage.setItem('vc_custom_row_titles', JSON.stringify(updated))
    setEditingRowTitle(null)
  }

  /* -- Presentation mode controls -- */
  const enterPresentation = (slideList: Slide[]) => {
    if (slideList.length === 0) return
    setPresentationSlides([...slideList])
    setPresentIdx(0)
    setViewMode('present')
  }
  const toggleFullscreen = () => {
    if (!document.fullscreenElement && presentRef.current) {
      presentRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else if (document.fullscreenElement) {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  /* -- Webcam controls with countdown -- */
  const startCamWithCountdown = () => { setShowCountdown(true) }
  const actuallyStartCam = async () => {
    setShowCountdown(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 640, facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream }
      setCamOn(true)
    } catch (err) {
      console.error('Camera access denied:', err)
      alert('Camera access denied. Please allow camera access in your browser settings.')
    }
  }
  const stopCam = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (videoRef.current) { videoRef.current.srcObject = null }
    setCamOn(false)
  }
  const cycleCamCorner = () => {
    const corners: Array<'br' | 'bl' | 'tr' | 'tl'> = ['br', 'bl', 'tl', 'tr']
    const idx = corners.indexOf(camCorner)
    setCamCorner(corners[(idx + 1) % 4])
    setCamPos({ x: 40, y: 40 })
  }

  /* -- Saved Presentations CRUD -- */
  const saveNewPresentation = async () => {
    if (!savePresForm.name.trim() || presentationSlides.length === 0) return
    try {
      const body = {
        name: savePresForm.name,
        slide_numbers: presentationSlides.map(s => s.slide_number),
        request_type: savePresForm.request_type,
        procedures: savePresForm.procedures ? savePresForm.procedures.split(',').map(p => p.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean) : [],
        script: savePresForm.script,
        notes: savePresForm.notes,
      }
      const res = await fetch(API + '/presentations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) {
        setSavePresForm({ name: '', request_type: '', procedures: '', script: '', notes: '' })
        setShowSavePresModal(false)
        fetchPresentations()
        fetchPresCats()
      }
    } catch (err) { console.error('Failed to save presentation:', err) }
  }
  const updateSavedPresentation = async () => {
    if (!editingPresentation) return
    try {
      const body: Record<string, unknown> = {}
      if (savePresForm.name) body.name = savePresForm.name
      if (savePresForm.request_type !== undefined) body.request_type = savePresForm.request_type
      if (savePresForm.procedures !== undefined) body.procedures = savePresForm.procedures ? savePresForm.procedures.split(',').map(p => p.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean) : []
      if (savePresForm.script !== undefined) body.script = savePresForm.script
      if (savePresForm.notes !== undefined) body.notes = savePresForm.notes
      const res = await fetch(API + '/presentations/' + editingPresentation.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) { setEditingPresentation(null); setShowSavePresModal(false); fetchPresentations(); fetchPresCats() }
    } catch (err) { console.error('Failed to update presentation:', err) }
  }
  const deleteSavedPresentation = async (id: number) => {
    try { await fetch(API + '/presentations/' + id, { method: 'DELETE' }); fetchPresentations(); fetchPresCats() }
    catch (err) { console.error('Failed to delete presentation:', err) }
  }
  const renamePresCat = async () => {
    if (!editingPresCat || !editingPresCat.newName.trim()) { setEditingPresCat(null); return }
    try {
      await fetch(API + '/presentation-categories/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cat_type: editingPresCat.catType, old_name: editingPresCat.oldName, new_name: editingPresCat.newName.trim().toLowerCase().replace(/\s+/g, '_') }) })
      setEditingPresCat(null); fetchPresentations(); fetchPresCats()
    } catch (err) { console.error('Failed to rename category:', err) }
  }
  const removePresCat = async (catType: string, name: string) => {
    try {
      await fetch(API + '/presentation-categories/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cat_type: catType, name }) })
      fetchPresentations(); fetchPresCats()
    } catch (err) { console.error('Failed to remove category:', err) }
  }

  // --- CRM Action Handlers ---
  // Persist dropdown options to localStorage
  const saveDropdownOptions = (type: 'treatment' | 'visits' | 'fee', options: string[]) => {
    if (type === 'treatment') { setTreatmentOptions(options); localStorage.setItem('vc_treatment_options', JSON.stringify(options)) }
    else if (type === 'visits') { setVisitsOptions(options); localStorage.setItem('vc_visits_options', JSON.stringify(options)) }
    else { setFeeOptions(options); localStorage.setItem('vc_fee_options', JSON.stringify(options)) }
  }

  const openConsultBuilder = (request: VCRequest) => {
    setActiveRequest(request)
    // Auto-load intro slide (#1)
    const introSlide = slides.find(s => s.slide_number === 1)
    const selected = introSlide ? new Set([introSlide.slide_number]) : new Set<number>()
    setSelectedSlides(selected)
    // Pre-fill summary form with NPE defaults
    setSummaryForm(prev => ({
      ...prev,
      treatments: [{ name: 'New Patient Exam (NPE)', details: '', visits: '1 (1.5 hours reserved)', fee: '$500' }],
    }))
    setRecordedVideoUrl(null)
    setConsultConcernFilter('')
    setConsultTab('patient')
    setViewMode('consult')
    // Mark request as in_progress
    fetch(API + '/vc/requests/' + request.id, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' })
    }).then(() => fetchVcRequests())
  }

  const startConsultRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      consultStreamRef.current = stream
      if (consultVideoRef.current) {
        consultVideoRef.current.srcObject = stream
        consultVideoRef.current.play()
      }
      recordedChunksRef.current = []
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        setRecordedVideoUrl(url)
        // Clean up camera
        if (consultStreamRef.current) {
          consultStreamRef.current.getTracks().forEach(t => t.stop())
          consultStreamRef.current = null
        }
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch (err) { console.error('Failed to start recording:', err) }
  }

  const stopConsultRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  const saveConsultation = async () => {
    if (!activeRequest) return
    // Auto-generate summary slide if not already generated
    if (!summarySlideData) setSummarySlideData({ ...summaryForm })
    const body = {
      request_id: activeRequest.id,
      patient_name: activeRequest.patient_name,
      email: activeRequest.email,
      phone: activeRequest.phone,
      concerns: activeRequest.concerns,
      photos: activeRequest.photos,
      slide_numbers: Array.from(selectedSlides),
      presentation_name: '',
      script: '',
      video_url: recordedVideoUrl || '',
      summary_slide_data: summarySlideData,
      notes: '',
    }
    try {
      await fetch(API + '/vc/consultations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      fetchVcRequests()
      fetchConsultations()
      setActiveRequest(null)
      setRecordedVideoUrl(null)
      setSelectedSlides(new Set())
      setViewMode('dashboard')
    } catch (err) { console.error('Failed to save consultation:', err) }
  }

  const resendConsultation = async (id: number) => {
    try {
      await fetch(API + '/vc/consultations/' + id + '/resend', { method: 'POST' })
      fetchConsultations()
    } catch (err) { console.error('Failed to resend:', err) }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'in_progress': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'sent': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'watched': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'follow_up_sent': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'archived': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={12} />
      case 'in_progress': return <Edit2 size={12} />
      case 'sent': return <Send size={12} />
      case 'watched': return <Eye size={12} />
      case 'follow_up_sent': return <RefreshCw size={12} />
      default: return <Archive size={12} />
    }
  }

  const dragActiveSlide = dragActiveId ? filteredSlides.find(s => s.slide_number === dragActiveId) : null
  const currentPresentSlide = presentationSlides[presentIdx] || null

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-white text-xl">Loading slides...</div></div>

  /* ====== PRESENTATION MODE ====== */
  if (viewMode === 'present') {
    const camSize = CAM_SIZES[camSizeIdx]
    const camStyle: React.CSSProperties = {
      width: camSize.w, height: camSize.h, position: 'absolute', zIndex: 50,
      ...(camCorner.includes('b') ? { bottom: camPos.y } : { top: camPos.y }),
      ...(camCorner.includes('r') ? { right: camPos.x } : { left: camPos.x }),
    }

    return (
      <div ref={presentRef} className="h-screen bg-black flex flex-col">
        {showCountdown && <CountdownOverlay onDone={actuallyStartCam} />}
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900/90 border-b border-gray-800 flex-shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => { stopCam(); setViewMode('grid') }}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 flex items-center gap-1">
              <X size={14} /> Exit
            </button>
            <h2 className="text-white font-semibold text-sm">Presentation Mode</h2>
            <span className="text-gray-500 text-xs">{presentIdx + 1} / {presentationSlides.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={camOn ? stopCam : startCamWithCountdown}
              className={'px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 ' +
                (camOn ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white')}>
              {camOn ? <VideoOff size={14} /> : <Video size={14} />}
              {camOn ? 'Stop Cam' : 'Start Cam'}
            </button>
            {camOn && (
              <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1">
                <span className="text-xs text-gray-400">Cam:</span>
                {CAM_SIZES.map((s, i) => (
                  <button key={s.label} onClick={() => setCamSizeIdx(i)}
                    className={'px-1.5 py-0.5 rounded text-xs ' + (camSizeIdx === i ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white')}>
                    {s.label}
                  </button>
                ))}
                <button onClick={cycleCamCorner} className="p-1 text-gray-400 hover:text-white" title="Move camera corner">
                  <Move size={12} />
                </button>
              </div>
            )}
            <button onClick={() => setShowSummaryBuilder(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-sm font-medium text-white flex items-center gap-1">
              <ClipboardList size={14} /> Summary Slide
            </button>
            <button onClick={() => setShowSavePresModal(true)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm font-medium text-white flex items-center gap-1">
              <Save size={14} /> Save Presentation
            </button>
            <button onClick={toggleFullscreen}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 flex items-center gap-1">
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
          </div>
        </div>

        {/* Main area */}
        <div className="flex flex-1 min-h-0">
          {/* Left: slide queue */}
          <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
            <div className="px-3 py-2 border-b border-gray-800 bg-gray-800/50">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Slide Queue</h3>
              <p className="text-xs text-gray-500 mt-0.5">{presentationSlides.length} slides &middot; drag to reorder</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handlePresentDragEnd}>
                <SortableContext items={presentationSlides.map(s => s.slide_number)} strategy={verticalListSortingStrategy}>
                  {presentationSlides.map((slide, idx) => (
                    <SortableQueueThumb key={slide.slide_number} slide={slide} index={idx} total={presentationSlides.length}
                      isActive={idx === presentIdx} onSelect={() => setPresentIdx(idx)} getSlideLabel={getSlideLabel}
                      onMoveUp={() => {
                        if (idx === 0) return
                        const reordered = arrayMove(presentationSlides, idx, idx - 1)
                        setPresentationSlides(reordered)
                        if (presentIdx === idx) setPresentIdx(idx - 1)
                        else if (presentIdx === idx - 1) setPresentIdx(idx)
                      }}
                      onMoveDown={() => {
                        if (idx >= presentationSlides.length - 1) return
                        const reordered = arrayMove(presentationSlides, idx, idx + 1)
                        setPresentationSlides(reordered)
                        if (presentIdx === idx) setPresentIdx(idx + 1)
                        else if (presentIdx === idx + 1) setPresentIdx(idx)
                      }}
                      onRemove={() => {
                        const updated = presentationSlides.filter((_, i) => i !== idx)
                        setPresentationSlides(updated)
                        if (updated.length === 0) { setViewMode('grid'); return }
                        if (presentIdx >= updated.length) setPresentIdx(updated.length - 1)
                        else if (presentIdx > idx) setPresentIdx(presentIdx - 1)
                      }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
            <div className="px-3 py-2 border-t border-gray-800 flex gap-1">
              <button onClick={() => { const nums = presentationSlides.map(s => s.slide_number); setSelectedSlides(new Set(nums)); setViewMode('grid') }}
                className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1.5 rounded text-gray-300">
                <Edit2 size={10} className="inline mr-1" /> Edit Selection
              </button>
            </div>
          </div>

          {/* Right: main slide display */}
          <div className="flex-1 flex flex-col relative min-w-0">
            <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
              {currentPresentSlide && currentPresentSlide.slide_number === -999 && summarySlideData ? (
                /* Summary Slide rendered as HTML */
                <div className="w-full max-w-4xl mx-auto rounded-2xl shadow-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  <div className="h-full bg-gradient-to-br from-[#0a1628] via-[#0f2340] to-[#162d50] flex flex-col justify-between relative" style={{ padding: '5% 6%' }}>
                    {/* Decorative accents */}
                    <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-blue-400/8 to-transparent rounded-full -translate-y-1/3 translate-x-1/3" />
                    <div className="absolute bottom-0 left-0 w-56 h-56 bg-gradient-to-tr from-amber-400/6 to-transparent rounded-full translate-y-1/3 -translate-x-1/3" />
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-blue-500" />
                    {/* Header */}
                    <div className="relative z-10">
                      <h1 className="text-3xl font-bold text-white tracking-tight">{summarySlideData.slideTitle}</h1>
                      <div className="w-16 h-0.5 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full mt-2" />
                    </div>
                    {/* Content */}
                    <div className="relative z-10 flex-1 flex flex-col justify-center gap-3" style={{ padding: '3% 0' }}>
                      {/* Treatment Options */}
                      <div className="bg-white/[0.04] backdrop-blur-sm rounded-xl border border-white/[0.08]" style={{ padding: '3.5% 4%' }}>
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0"><ClipboardList size={14} className="text-blue-400" /></div>
                          <h2 className="text-base font-semibold text-white">{summarySlideData.treatmentHeader}</h2>
                        </div>
                        <div className="space-y-2 pl-9">
                          {summarySlideData.treatments.map((tx, i) => (
                            <div key={i} className="flex items-baseline gap-2.5">
                              <span className="text-amber-400 font-bold text-xs w-4 flex-shrink-0">{i + 1}.</span>
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-white font-medium text-sm">{tx.name}</span>
                                {tx.details && <span className="text-blue-200/60 text-xs">&mdash; {tx.details}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        {/* Visits */}
                        <div className="flex-1 bg-white/[0.04] backdrop-blur-sm rounded-xl border border-white/[0.08]" style={{ padding: '3% 4%' }}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0"><Calendar size={14} className="text-emerald-400" /></div>
                            <h2 className="text-sm font-semibold text-white">{summarySlideData.visitsHeader}</h2>
                          </div>
                          <div className="pl-9 space-y-0.5">
                            {summarySlideData.treatments.filter(t => t.visits).map((t, i) => (
                              <p key={i} className="text-sm"><span className="text-emerald-400 font-bold">{t.visits}</span>{summarySlideData.treatments.length > 1 && <span className="text-white/50 text-xs ml-1">({t.name})</span>}</p>
                            ))}
                            {summarySlideData.treatments.every(t => !t.visits) && <p className="text-xl font-bold text-emerald-400">TBD</p>}
                          </div>
                        </div>
                        {/* Fee */}
                        <div className="flex-1 bg-white/[0.04] backdrop-blur-sm rounded-xl border border-white/[0.08]" style={{ padding: '3% 4%' }}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0"><DollarSign size={14} className="text-amber-400" /></div>
                            <h2 className="text-sm font-semibold text-white">{summarySlideData.feeHeader}</h2>
                          </div>
                          <div className="pl-9 space-y-0.5">
                            {summarySlideData.treatments.filter(t => t.fee).map((t, i) => (
                              <p key={i} className="text-sm"><span className="text-amber-400 font-bold">{t.fee}</span>{summarySlideData.treatments.length > 1 && <span className="text-white/50 text-xs ml-1">({t.name})</span>}</p>
                            ))}
                            {summarySlideData.treatments.every(t => !t.fee) && <p className="text-xl font-bold text-amber-400">TBD</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* CTA */}
                    <div className="relative z-10">
                      <div className="bg-gradient-to-r from-amber-500/[0.08] via-amber-400/[0.06] to-blue-500/[0.08] rounded-xl border border-amber-400/15" style={{ padding: '2.5% 4%' }}>
                        <p className="text-center text-white/90 font-semibold text-sm mb-2 tracking-wide">To Schedule Your In-Office Visit</p>
                        <div className="flex items-center justify-center gap-10">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-amber-400/10 flex items-center justify-center">
                              <Phone size={14} className="text-amber-400" />
                            </div>
                            <div>
                              <p className="text-[10px] text-blue-300/50 uppercase tracking-wider">Call Us</p>
                              <p className="text-white font-semibold text-sm">704-364-4711</p>
                            </div>
                          </div>
                          <div className="w-px h-8 bg-white/10" />
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-amber-400/10 flex items-center justify-center">
                              <Mail size={14} className="text-amber-400" />
                            </div>
                            <div>
                              <p className="text-[10px] text-blue-300/50 uppercase tracking-wider">Email Us</p>
                              <p className="text-white font-semibold text-sm">Info@DestinationSmile.com</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : currentPresentSlide?.slide_type === 'patient_info' && activeRequest ? (
                <div className="max-w-3xl w-full bg-gradient-to-br from-gray-900 via-gray-900 to-blue-950 rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-600/20 to-blue-600/20 px-8 py-5 border-b border-gray-700/50">
                    <h2 className="text-2xl font-bold text-white">{activeRequest.patient_name}</h2>
                    <p className="text-amber-400/80 text-sm mt-1">Virtual Consultation Request</p>
                  </div>
                  <div className="p-8">
                    <div className="flex gap-8">
                      {/* Photos */}
                      <div className="flex-shrink-0">
                        <div className="flex gap-3">
                          {activeRequest.photos.length > 0 ? activeRequest.photos.map((photo, i) => (
                            <img key={i} src={photo} alt="" className="w-44 h-44 rounded-xl object-cover bg-gray-800 border border-gray-600 shadow-lg" />
                          )) : (
                            <div className="w-44 h-44 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center">
                              <Camera size={40} className="text-gray-600" />
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Contact Info */}
                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-1 gap-3">
                          {activeRequest.email && (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                <Mail size={14} className="text-blue-400" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Email</p>
                                <p className="text-sm text-blue-400">{activeRequest.email}</p>
                              </div>
                            </div>
                          )}
                          {activeRequest.phone && (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                <Phone size={14} className="text-emerald-400" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Phone</p>
                                <p className="text-sm text-white">{activeRequest.phone}</p>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-500/10 flex items-center justify-center flex-shrink-0">
                              <Calendar size={14} className="text-gray-400" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Submitted</p>
                              <p className="text-sm text-gray-300">{formatDateTime(activeRequest.submitted_at)}</p>
                            </div>
                          </div>
                        </div>
                        {activeRequest.concerns.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1.5">Concerns</p>
                            <div className="flex flex-wrap gap-1.5">
                              {activeRequest.concerns.map(c => (
                                <span key={c} className="text-xs bg-blue-900/40 text-blue-300 px-2.5 py-1 rounded-full border border-blue-800/30">{formatConcern(c)}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Patient Message */}
                    {activeRequest.message && (
                      <div className="mt-6 bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
                        <p className="text-xs font-medium text-amber-400/70 mb-2 uppercase tracking-wider">What Matters Most to This Patient</p>
                        <p className="text-sm text-gray-200 leading-relaxed italic">&ldquo;{activeRequest.message}&rdquo;</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : currentPresentSlide ? (
                <img src={getFullSlideUrl(currentPresentSlide)} alt={'Slide ' + currentPresentSlide.slide_number}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  onError={e => { const t = e.target as HTMLImageElement; t.onerror = null; t.src = 'https://placehold.co/1920x1080/1f2937/6b7280?text=Slide+Not+Found' }} />
              ) : (
                <div className="text-gray-500 text-lg">No slide selected</div>
              )}
              {/* Webcam bubble */}
              {camOn && (
                <div style={camStyle}
                  className="rounded-full overflow-hidden border-4 border-white/20 shadow-2xl cursor-move select-none"
                  onMouseDown={e => {
                    e.preventDefault()
                    setCamDragging(true)
                    setCamDragStart({ x: e.clientX, y: e.clientY, ox: camPos.x, oy: camPos.y })
                  }}>
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                </div>
              )}
              {/* Prev/Next */}
              <button onClick={() => setPresentIdx(prev => Math.max(prev - 1, 0))} disabled={presentIdx === 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 disabled:opacity-20 text-white p-3 rounded-full transition-all">
                <ChevronLeft size={28} />
              </button>
              <button onClick={() => setPresentIdx(prev => Math.min(prev + 1, presentationSlides.length - 1))} disabled={presentIdx >= presentationSlides.length - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 disabled:opacity-20 text-white p-3 rounded-full transition-all">
                <ChevronRight size={28} />
              </button>
            </div>
            {/* Bottom info bar */}
            {currentPresentSlide && (
              <div className="px-6 py-3 bg-gray-900/90 border-t border-gray-800 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-mono text-gray-500">#{currentPresentSlide.slide_number}</span>
                  <h3 className="text-sm font-medium text-white truncate">{getSlideLabel(currentPresentSlide)}</h3>
                  {currentPresentSlide.is_celebrity_case && <Star size={14} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {currentPresentSlide.treatments.slice(0, 3).map(t => (
                    <span key={t} className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">{formatTreatment(t)}</span>
                  ))}
                  {currentPresentSlide.cost_bracket && <span className="text-xs text-green-400">{currentPresentSlide.cost_bracket}</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary Slide Builder Modal */}
        {showSummaryBuilder && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowSummaryBuilder(false)}>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><ClipboardList size={20} className="text-amber-400" /> Build Summary Slide</h3>
              <div className="space-y-4">
                {/* Slide Title */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Slide Title</label>
                  <input type="text" value={summaryForm.slideTitle} onChange={e => setSummaryForm(prev => ({ ...prev, slideTitle: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white font-semibold focus:outline-none focus:border-amber-500" />
                </div>
                {/* Treatment Options — editable header + dropdowns with per-treatment visits/fee */}
                <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <ClipboardList size={14} className="text-blue-400 flex-shrink-0" />
                      <input type="text" value={summaryForm.treatmentHeader} onChange={e => setSummaryForm(prev => ({ ...prev, treatmentHeader: e.target.value }))}
                        className="bg-transparent border-b border-gray-600 focus:border-blue-400 text-sm text-white font-medium px-0 py-0.5 w-full focus:outline-none" />
                    </div>
                    <button onClick={() => setSummaryForm(prev => ({ ...prev, treatments: [...prev.treatments, { name: '', details: '', visits: '', fee: '' }] }))}
                      className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded flex items-center gap-1 flex-shrink-0 ml-2"><Plus size={10} /> Add</button>
                  </div>
                  <div className="space-y-3">
                    {summaryForm.treatments.map((tx, i) => (
                      <div key={i} className="bg-gray-800/40 rounded-lg p-2.5 border border-gray-700/30">
                        <div className="flex gap-2 items-start">
                          <span className="text-amber-400 font-bold text-sm mt-2 w-4 flex-shrink-0">{i + 1}.</span>
                          <div className="flex-1 space-y-1.5">
                            <select value={treatmentOptions.includes(tx.name) ? tx.name : (tx.name || '')}
                              onChange={e => {
                                const updated = [...summaryForm.treatments]; updated[i] = { ...updated[i], name: e.target.value }
                                setSummaryForm(prev => ({ ...prev, treatments: updated }))
                              }}
                              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
                              <option value="">Select treatment...</option>
                              {treatmentOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              {tx.name && !treatmentOptions.includes(tx.name) && <option value={tx.name}>{tx.name} (custom)</option>}
                            </select>
                            <textarea value={tx.details} onChange={e => {
                              const updated = [...summaryForm.treatments]; updated[i] = { ...updated[i], details: e.target.value };
                              setSummaryForm(prev => ({ ...prev, treatments: updated }))
                            }} placeholder="Details (e.g. Upper 6-8 units, minimal prep)" rows={2}
                              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500 resize-y" />
                            {/* Per-treatment visits + fee */}
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-xs text-gray-500 mb-0.5 block flex items-center gap-1"><Calendar size={10} className="text-emerald-400" /> Visits</label>
                                <select value={visitsOptions.includes(tx.visits) ? tx.visits : (tx.visits || '')}
                                  onChange={e => {
                                    const updated = [...summaryForm.treatments]; updated[i] = { ...updated[i], visits: e.target.value }
                                    setSummaryForm(prev => ({ ...prev, treatments: updated }))
                                  }}
                                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500">
                                  <option value="">Select...</option>
                                  {visitsOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                  {tx.visits && !visitsOptions.includes(tx.visits) && <option value={tx.visits}>{tx.visits} (custom)</option>}
                                </select>
                              </div>
                              <div className="flex-1">
                                <label className="text-xs text-gray-500 mb-0.5 block flex items-center gap-1"><DollarSign size={10} className="text-amber-400" /> Fee</label>
                                <select value={feeOptions.includes(tx.fee) ? tx.fee : (tx.fee || '')}
                                  onChange={e => {
                                    const updated = [...summaryForm.treatments]; updated[i] = { ...updated[i], fee: e.target.value }
                                    setSummaryForm(prev => ({ ...prev, treatments: updated }))
                                  }}
                                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500">
                                  <option value="">Select...</option>
                                  {feeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                  {tx.fee && !feeOptions.includes(tx.fee) && <option value={tx.fee}>{tx.fee} (custom)</option>}
                                </select>
                              </div>
                            </div>
                          </div>
                          {summaryForm.treatments.length > 1 && (
                            <button onClick={() => setSummaryForm(prev => ({ ...prev, treatments: prev.treatments.filter((_, j) => j !== i) }))}
                              className="p-1 text-gray-500 hover:text-red-400 mt-1"><X size={14} /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Section headers for visits/fee columns */}
                <div className="flex gap-3">
                  <div className="flex-1 bg-gray-800/30 rounded-lg p-2 border border-gray-700/50">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-emerald-400 flex-shrink-0" />
                      <input type="text" value={summaryForm.visitsHeader} onChange={e => setSummaryForm(prev => ({ ...prev, visitsHeader: e.target.value }))}
                        className="bg-transparent border-b border-gray-600 focus:border-emerald-400 text-xs text-white font-medium px-0 py-0.5 w-full focus:outline-none" />
                    </div>
                  </div>
                  <div className="flex-1 bg-gray-800/30 rounded-lg p-2 border border-gray-700/50">
                    <div className="flex items-center gap-2">
                      <DollarSign size={14} className="text-amber-400 flex-shrink-0" />
                      <input type="text" value={summaryForm.feeHeader} onChange={e => setSummaryForm(prev => ({ ...prev, feeHeader: e.target.value }))}
                        className="bg-transparent border-b border-gray-600 focus:border-amber-400 text-xs text-white font-medium px-0 py-0.5 w-full focus:outline-none" />
                    </div>
                  </div>
                </div>
                {/* CTA Preview */}
                <div className="bg-gradient-to-r from-amber-900/20 to-blue-900/20 rounded-lg p-3 border border-amber-700/30">
                  <p className="text-xs text-amber-300/70 font-medium mb-1.5">CTA Section (always included on slide)</p>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="flex items-center gap-2 text-white">
                      <div className="w-6 h-6 rounded-full bg-amber-400/10 flex items-center justify-center"><Phone size={11} className="text-amber-400" /></div>
                      704-364-4711
                    </span>
                    <span className="flex items-center gap-2 text-white">
                      <div className="w-6 h-6 rounded-full bg-amber-400/10 flex items-center justify-center"><Mail size={11} className="text-amber-400" /></div>
                      Info@DestinationSmile.com
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowSummaryBuilder(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">Cancel</button>
                <button onClick={() => {
                  const validTx = summaryForm.treatments.filter(t => t.name.trim())
                  if (validTx.length === 0) return
                  const data = {
                    treatments: validTx,
                    treatmentHeader: summaryForm.treatmentHeader || 'Treatment Suggestions / Options',
                    visitsHeader: summaryForm.visitsHeader || 'Number of Visits',
                    feeHeader: summaryForm.feeHeader || 'Fee for Tx Options',
                    slideTitle: summaryForm.slideTitle || 'Treatment Summary',
                  }
                  setSummarySlideData(data)
                  const summarySlide: Slide = {
                    slide_number: -999, condition: data.slideTitle, solution: '', complexity: null, tone: [],
                    duration: '', cost_bracket: '', cost_numeric: null, treatments: validTx.map(t => t.name),
                    concerns: [], gender: '', is_celebrity_case: false, slide_type: 'summary',
                    image_count: 0, images: [], text_content: [], custom_label: data.slideTitle
                  }
                  if (summaryInserted) {
                    setPresentationSlides(prev => prev.map(s => s.slide_number === -999 ? summarySlide : s))
                  } else {
                    setPresentationSlides(prev => [...prev, summarySlide])
                    setSummaryInserted(true)
                    setPresentIdx(presentationSlides.length)
                  }
                  setShowSummaryBuilder(false)
                }} disabled={summaryForm.treatments.every(t => !t.name.trim())}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 rounded text-sm font-medium flex items-center gap-1">
                  <ClipboardList size={14} /> {summaryInserted ? 'Update Summary' : 'Add Summary Slide'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save Presentation Modal */}
        {showSavePresModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setShowSavePresModal(false); setEditingPresentation(null) }}>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4">{editingPresentation ? 'Edit Presentation' : 'Save Presentation'}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Presentation Name *</label>
                  <input type="text" value={savePresForm.name} onChange={e => setSavePresForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Veneer Consultation - Full Arch" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Request Type</label>
                  <input type="text" value={savePresForm.request_type} onChange={e => setSavePresForm(prev => ({ ...prev, request_type: e.target.value }))}
                    placeholder="e.g. cosmetic_consultation, smile_makeover" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Procedures (comma-separated)</label>
                  <input type="text" value={savePresForm.procedures} onChange={e => setSavePresForm(prev => ({ ...prev, procedures: e.target.value }))}
                    placeholder="e.g. veneers, whitening, invisalign" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Script / Talking Points</label>
                  <textarea value={savePresForm.script} onChange={e => setSavePresForm(prev => ({ ...prev, script: e.target.value }))}
                    rows={4} placeholder="Enter the narration script or talking points for this presentation..."
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Notes (HITL review notes)</label>
                  <textarea value={savePresForm.notes} onChange={e => setSavePresForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2} placeholder="Notes for AI clone or HITL review..."
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none" />
                </div>
                <p className="text-xs text-gray-500">{presentationSlides.length} slides in this presentation</p>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => { setShowSavePresModal(false); setEditingPresentation(null) }} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">Cancel</button>
                <button onClick={editingPresentation ? updateSavedPresentation : saveNewPresentation} disabled={!savePresForm.name.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 rounded text-sm font-medium">
                  <Save size={14} className="inline mr-1" /> {editingPresentation ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ====== DASHBOARD VIEW (CRM) — rendered inline below ====== */
  const pendingCount = vcRequests.filter(r => r.status === 'pending').length
  const inProgressCount = vcRequests.filter(r => r.status === 'in_progress').length
  const sentCount = vcRequests.filter(r => r.status === 'sent').length
  const dashboardFilteredRequests = dashboardFilter
    ? vcRequests.filter(r => r.status === dashboardFilter)
    : vcRequests

  const renderDashboardContent = () => {
    return (
        <div className="p-6">
          {/* Stats cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Pending</p>
                  <p className="text-3xl font-bold text-yellow-400 mt-1">{pendingCount}</p>
                </div>
                <Clock size={24} className="text-yellow-400/40" />
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">In Progress</p>
                  <p className="text-3xl font-bold text-blue-400 mt-1">{inProgressCount}</p>
                </div>
                <Edit2 size={24} className="text-blue-400/40" />
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Sent</p>
                  <p className="text-3xl font-bold text-green-400 mt-1">{sentCount}</p>
                </div>
                <Send size={24} className="text-green-400/40" />
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Archive</p>
                  <p className="text-3xl font-bold text-purple-400 mt-1">{consultations.length}</p>
                </div>
                <Archive size={24} className="text-purple-400/40" />
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-2 mb-4">
            {[
              { value: '', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'sent', label: 'Sent' },
            ].map(f => (
              <button key={f.value} onClick={() => setDashboardFilter(f.value)}
                className={'px-3 py-1.5 rounded text-sm font-medium border ' +
                  (dashboardFilter === f.value ? 'bg-amber-600/20 text-amber-400 border-amber-500/30' : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700')}>
                {f.label}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={() => fetchVcRequests()} className="px-3 py-1.5 rounded text-sm bg-gray-800 text-gray-400 hover:text-white flex items-center gap-1">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {/* Request list */}
          {dashboardFilteredRequests.length === 0 ? (
            <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-12 text-center">
              <UserPlus size={48} className="text-gray-700 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-400">No requests found</h3>
              <p className="text-sm text-gray-600 mt-1">
                {dashboardFilter === 'pending' ? 'No pending VC requests. New requests will appear here from the intake form.' : 'No requests match this filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {dashboardFilteredRequests.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()).map(req => (
                <div key={req.id} className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4 hover:border-gray-600 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Patient photos */}
                      <div className="flex gap-1 flex-shrink-0">
                        {req.photos.length > 0 ? req.photos.slice(0, 2).map((photo, i) => (
                          <img key={i} src={photo} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-800 border border-gray-700" />
                        )) : (
                          <div className="w-16 h-16 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
                            <Camera size={20} className="text-gray-600" />
                          </div>
                        )}
                      </div>
                      {/* Patient info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-white">{req.patient_name || 'Unknown Patient'}</h3>
                          <span className={'px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 ' + getStatusColor(req.status)}>
                            {getStatusIcon(req.status)} {req.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(req.submitted_at)}</span>
                          {req.email && <span className="flex items-center gap-1"><Mail size={11} /> {req.email}</span>}
                          {req.phone && <span className="flex items-center gap-1"><Phone size={11} /> {req.phone}</span>}
                        </div>
                        {req.message && (
                          <p className="text-sm text-gray-300 mt-2 line-clamp-2">
                            <MessageSquare size={12} className="inline mr-1 text-gray-500" />
                            {req.message}
                          </p>
                        )}
                        {req.concerns.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {req.concerns.map(c => (
                              <span key={c} className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">{c}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      {req.status === 'pending' || req.status === 'in_progress' ? (
                        <button onClick={() => openConsultBuilder(req)}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium flex items-center gap-1.5 whitespace-nowrap">
                          <Play size={14} /> Build Consult
                        </button>
                      ) : (
                        <button onClick={() => setViewMode('archive')}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm flex items-center gap-1">
                          <Eye size={12} /> View in Archive
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    )
  }

  /* ====== ARCHIVE VIEW — rendered inline below ====== */
  const archiveFilteredConsultations = archiveFilter
    ? consultations.filter(c => c.status === archiveFilter)
    : consultations

  /* ====== CONSULT BUILDER VIEW ====== */
  if (viewMode === 'consult' && activeRequest) {
    const consultFilteredSlides = slides.filter(s => {
      const matchesSearch = !consultSlideSearch || (() => {
        const q = consultSlideSearch.toLowerCase()
        return s.condition?.toLowerCase().includes(q) || s.solution?.toLowerCase().includes(q) ||
          s.custom_label?.toLowerCase().includes(q) || s.treatments.some(t => t.toLowerCase().includes(q)) ||
          s.concerns.some(c => c.toLowerCase().includes(q))
      })()
      const matchesConcern = !consultConcernFilter || s.concerns.some(c => c.toLowerCase().includes(consultConcernFilter.toLowerCase())) ||
        s.treatments.some(t => t.toLowerCase().includes(consultConcernFilter.toLowerCase()))
      return matchesSearch && matchesConcern
    })

    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        {/* Top bar */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => { setViewMode('dashboard'); setActiveRequest(null) }}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 flex items-center gap-1">
              <X size={14} /> Back to Dashboard
            </button>
            <h2 className="text-white font-semibold text-sm">Consult Builder</h2>
            <span className="text-amber-400 text-sm font-medium">{activeRequest.patient_name}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isRecording && !recordedVideoUrl && (
              <button onClick={startConsultRecording}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-sm font-medium text-white flex items-center gap-1.5">
                <Video size={14} /> Start Recording
              </button>
            )}
            {isRecording && (
              <button onClick={stopConsultRecording}
                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded text-sm font-medium text-white flex items-center gap-1.5 animate-pulse">
                <VideoOff size={14} /> Stop Recording
              </button>
            )}
            {recordedVideoUrl && (
              <span className="text-green-400 text-xs flex items-center gap-1"><Check size={12} /> Video recorded</span>
            )}
            <button onClick={() => {
              const list = slides.filter(s => selectedSlides.has(s.slide_number))
              if (list.length > 0 && activeRequest) {
                // Create patient info slide as first slide
                const patientInfoSlide: Slide = {
                  slide_number: -998, condition: 'Patient Information', solution: '', complexity: null, tone: [],
                  duration: '', cost_bracket: '', cost_numeric: null, treatments: [],
                  concerns: activeRequest.concerns, gender: '', is_celebrity_case: false, slide_type: 'patient_info',
                  image_count: activeRequest.photos.length, images: [], text_content: [activeRequest.message],
                  custom_label: activeRequest.patient_name + ' — Patient Info'
                }
                enterPresentation([patientInfoSlide, ...list])
              } else if (list.length > 0) {
                enterPresentation(list)
              }
            }}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm font-medium text-white flex items-center gap-1.5"
              disabled={selectedSlides.size === 0}>
              <Play size={14} /> Present ({selectedSlides.size})
            </button>
            <button onClick={saveConsultation}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm font-medium text-white flex items-center gap-1.5">
              <Save size={14} /> Save & Send
            </button>
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* Left panel: Tabbed — Patient / Summary */}
          <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
            {/* Tab bar */}
            <div className="flex border-b border-gray-800 flex-shrink-0">
              <button onClick={() => setConsultTab('patient')}
                className={'flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ' + (consultTab === 'patient' ? 'border-amber-500 text-amber-400 bg-gray-800/50' : 'border-transparent text-gray-500 hover:text-gray-300')}>
                <Users size={12} /> Patient
              </button>
              <button onClick={() => setConsultTab('summary')}
                className={'flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ' + (consultTab === 'summary' ? 'border-blue-500 text-blue-400 bg-gray-800/50' : 'border-transparent text-gray-500 hover:text-gray-300')}>
                <ClipboardList size={12} /> Summary
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
            {consultTab === 'patient' ? (
              <>
              {/* Compact patient info */}
              <div className="p-3">
                <div className="flex gap-3 mb-3">
                  {/* Compact photos */}
                  <div className="flex gap-1.5 flex-shrink-0">
                    {activeRequest.photos.length > 0 ? activeRequest.photos.map((photo, i) => (
                      <img key={i} src={photo} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-800 border border-gray-700" />
                    )) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
                        <Camera size={16} className="text-gray-600" />
                      </div>
                    )}
                  </div>
                  {/* Inline contact */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{activeRequest.patient_name}</p>
                    {activeRequest.email && <p className="text-xs text-blue-400 truncate flex items-center gap-1"><Mail size={10} />{activeRequest.email}</p>}
                    {activeRequest.phone && <p className="text-xs text-gray-300 flex items-center gap-1"><Phone size={10} />{activeRequest.phone}</p>}
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(activeRequest.submitted_at)}</p>
                  </div>
                </div>
                {/* Concerns as clickable filter chips */}
                {activeRequest.concerns.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {activeRequest.concerns.map(c => (
                      <button key={c} onClick={() => setConsultConcernFilter(prev => prev === c ? '' : c)}
                        className={'text-xs px-2 py-0.5 rounded-full border transition-colors ' + (consultConcernFilter === c ? 'bg-blue-600 text-white border-blue-500' : 'bg-blue-900/30 text-blue-400 border-blue-800/30 hover:bg-blue-800/40')}>
                        {c.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Patient message — collapsible */}
              {activeRequest.message && (
                <details className="border-t border-gray-800" open>
                  <summary className="px-3 py-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-300">What Matters Most</summary>
                  <div className="px-3 pb-3">
                    <p className="text-xs text-gray-300 bg-gray-800 rounded-lg p-2.5 italic leading-relaxed">&ldquo;{activeRequest.message}&rdquo;</p>
                  </div>
                </details>
              )}
              {/* Video — compact, collapsible */}
              <details className="border-t border-gray-800">
                <summary className="px-3 py-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-300 flex items-center gap-1.5">
                  <Video size={11} /> Recording {isRecording && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}{recordedVideoUrl && <Check size={10} className="text-green-400" />}
                </summary>
                <div className="px-3 pb-3">
                  {isRecording && (
                    <div className="relative">
                      <video ref={consultVideoRef} className="w-full rounded-lg bg-black" muted autoPlay playsInline />
                      <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                        <div className="w-2 h-2 bg-white rounded-full" /> REC
                      </div>
                    </div>
                  )}
                  {recordedVideoUrl && !isRecording && (
                    <video src={recordedVideoUrl} className="w-full rounded-lg bg-black" controls />
                  )}
                  {!isRecording && !recordedVideoUrl && (
                    <p className="text-xs text-gray-500 text-center py-2">Use top bar to start recording</p>
                  )}
                </div>
              </details>
              </>
            ) : (
              <>
              {/* SUMMARY TAB — per-treatment visits/fee */}
              <div className="p-3">
                <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5"><ClipboardList size={11} /> Treatment Summary</h4>
              <div className="space-y-2">
                {/* Treatment dropdown + manual entry with per-treatment visits/fee */}
                {summaryForm.treatments.map((tx, i) => (
                  <div key={i} className="bg-gray-800/30 rounded-lg p-2 border border-gray-700/30 space-y-1">
                    <div className="flex gap-1">
                      <select value={treatmentOptions.includes(tx.name) ? tx.name : (tx.name || '')}
                        onChange={e => {
                          const updated = [...summaryForm.treatments]; updated[i] = { ...updated[i], name: e.target.value }
                          setSummaryForm(prev => ({ ...prev, treatments: updated }))
                        }}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500">
                        <option value="">Select treatment...</option>
                        {treatmentOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        {tx.name && !treatmentOptions.includes(tx.name) && <option value={tx.name}>{tx.name} (custom)</option>}
                      </select>
                      {summaryForm.treatments.length > 1 && (
                        <button onClick={() => setSummaryForm(prev => ({ ...prev, treatments: prev.treatments.filter((_, j) => j !== i) }))}
                          className="p-1 text-gray-500 hover:text-red-400"><X size={12} /></button>
                      )}
                    </div>
                    <textarea value={tx.details} onChange={e => {
                      const updated = [...summaryForm.treatments]; updated[i] = { ...updated[i], details: e.target.value }
                      setSummaryForm(prev => ({ ...prev, treatments: updated }))
                    }} placeholder="Details / notes" rows={2} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500 resize-y" />
                    {/* Per-treatment visits + fee */}
                    <div className="flex gap-1.5">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 flex items-center gap-0.5"><Calendar size={8} className="text-emerald-400" /> Visits</label>
                        <select value={visitsOptions.includes(tx.visits) ? tx.visits : (tx.visits || '')}
                          onChange={e => {
                            const updated = [...summaryForm.treatments]; updated[i] = { ...updated[i], visits: e.target.value }
                            setSummaryForm(prev => ({ ...prev, treatments: updated }))
                          }}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-emerald-500">
                          <option value="">Select...</option>
                          {visitsOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          {tx.visits && !visitsOptions.includes(tx.visits) && <option value={tx.visits}>{tx.visits}</option>}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 flex items-center gap-0.5"><DollarSign size={8} className="text-amber-400" /> Fee</label>
                        <select value={feeOptions.includes(tx.fee) ? tx.fee : (tx.fee || '')}
                          onChange={e => {
                            const updated = [...summaryForm.treatments]; updated[i] = { ...updated[i], fee: e.target.value }
                            setSummaryForm(prev => ({ ...prev, treatments: updated }))
                          }}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-amber-500">
                          <option value="">Select...</option>
                          {feeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          {tx.fee && !feeOptions.includes(tx.fee) && <option value={tx.fee}>{tx.fee}</option>}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={() => setSummaryForm(prev => ({ ...prev, treatments: [...prev.treatments, { name: '', details: '', visits: '', fee: '' }] }))}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5"><Plus size={10} /> Add treatment</button>

                <button onClick={() => setSummarySlideData({ ...summaryForm })}
                  className="w-full bg-amber-600 hover:bg-amber-500 rounded px-2 py-1.5 text-xs font-medium flex items-center justify-center gap-1">
                  <ClipboardList size={12} /> Generate Summary Slide
                </button>

                {/* Manage dropdown lists */}
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">Manage Dropdown Lists</summary>
                  <div className="mt-2 space-y-3 bg-gray-800/50 rounded-lg p-2 border border-gray-700/50">
                    {/* Treatment options */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400 font-medium">Treatments ({treatmentOptions.length})</span>
                        <button onClick={() => setEditingDropdown({ type: 'treatment', action: 'add', value: '' })}
                          className="text-xs text-blue-400 hover:text-blue-300"><Plus size={10} className="inline" /> Add</button>
                      </div>
                      <div className="space-y-0.5 max-h-32 overflow-y-auto">
                        {treatmentOptions.map((opt, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-0.5 px-1 rounded hover:bg-gray-700 group">
                            {editingDropdown?.type === 'treatment' && editingDropdown?.action === 'edit' && editingDropdown?.index === i ? (
                              <input type="text" value={editingDropdown.value} autoFocus
                                onChange={e => setEditingDropdown({ ...editingDropdown, value: e.target.value })}
                                onBlur={() => {
                                  if (editingDropdown.value.trim()) {
                                    const updated = [...treatmentOptions]; updated[i] = editingDropdown.value.trim()
                                    saveDropdownOptions('treatment', updated)
                                  }
                                  setEditingDropdown(null)
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                className="flex-1 bg-gray-700 border border-blue-500 rounded px-1 py-0.5 text-xs text-white focus:outline-none" />
                            ) : (
                              <>
                                <span className="text-gray-300 truncate">{opt}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                  <button onClick={() => setEditingDropdown({ type: 'treatment', action: 'edit', index: i, value: opt })}
                                    className="text-gray-500 hover:text-blue-400"><Edit2 size={10} /></button>
                                  <button onClick={() => saveDropdownOptions('treatment', treatmentOptions.filter((_, j) => j !== i))}
                                    className="text-gray-500 hover:text-red-400"><Trash2 size={10} /></button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      {editingDropdown?.type === 'treatment' && editingDropdown?.action === 'add' && (
                        <input type="text" value={editingDropdown.value} autoFocus placeholder="New treatment option..."
                          onChange={e => setEditingDropdown({ ...editingDropdown, value: e.target.value })}
                          onBlur={() => {
                            if (editingDropdown.value.trim()) saveDropdownOptions('treatment', [...treatmentOptions, editingDropdown.value.trim()])
                            setEditingDropdown(null)
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          className="w-full bg-gray-700 border border-blue-500 rounded px-2 py-1 text-xs text-white mt-1 focus:outline-none" />
                      )}
                    </div>
                    {/* Visits options */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400 font-medium">Visits ({visitsOptions.length})</span>
                        <button onClick={() => setEditingDropdown({ type: 'visits', action: 'add', value: '' })}
                          className="text-xs text-blue-400 hover:text-blue-300"><Plus size={10} className="inline" /> Add</button>
                      </div>
                      <div className="space-y-0.5 max-h-24 overflow-y-auto">
                        {visitsOptions.map((opt, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-0.5 px-1 rounded hover:bg-gray-700 group">
                            {editingDropdown?.type === 'visits' && editingDropdown?.action === 'edit' && editingDropdown?.index === i ? (
                              <input type="text" value={editingDropdown.value} autoFocus
                                onChange={e => setEditingDropdown({ ...editingDropdown, value: e.target.value })}
                                onBlur={() => {
                                  if (editingDropdown.value.trim()) {
                                    const updated = [...visitsOptions]; updated[i] = editingDropdown.value.trim()
                                    saveDropdownOptions('visits', updated)
                                  }
                                  setEditingDropdown(null)
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                className="flex-1 bg-gray-700 border border-blue-500 rounded px-1 py-0.5 text-xs text-white focus:outline-none" />
                            ) : (
                              <>
                                <span className="text-gray-300 truncate">{opt}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                  <button onClick={() => setEditingDropdown({ type: 'visits', action: 'edit', index: i, value: opt })}
                                    className="text-gray-500 hover:text-blue-400"><Edit2 size={10} /></button>
                                  <button onClick={() => saveDropdownOptions('visits', visitsOptions.filter((_, j) => j !== i))}
                                    className="text-gray-500 hover:text-red-400"><Trash2 size={10} /></button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      {editingDropdown?.type === 'visits' && editingDropdown?.action === 'add' && (
                        <input type="text" value={editingDropdown.value} autoFocus placeholder="New visits option..."
                          onChange={e => setEditingDropdown({ ...editingDropdown, value: e.target.value })}
                          onBlur={() => {
                            if (editingDropdown.value.trim()) saveDropdownOptions('visits', [...visitsOptions, editingDropdown.value.trim()])
                            setEditingDropdown(null)
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          className="w-full bg-gray-700 border border-blue-500 rounded px-2 py-1 text-xs text-white mt-1 focus:outline-none" />
                      )}
                    </div>
                    {/* Fee options */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400 font-medium">Fees ({feeOptions.length})</span>
                        <button onClick={() => setEditingDropdown({ type: 'fee', action: 'add', value: '' })}
                          className="text-xs text-blue-400 hover:text-blue-300"><Plus size={10} className="inline" /> Add</button>
                      </div>
                      <div className="space-y-0.5 max-h-24 overflow-y-auto">
                        {feeOptions.map((opt, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-0.5 px-1 rounded hover:bg-gray-700 group">
                            {editingDropdown?.type === 'fee' && editingDropdown?.action === 'edit' && editingDropdown?.index === i ? (
                              <input type="text" value={editingDropdown.value} autoFocus
                                onChange={e => setEditingDropdown({ ...editingDropdown, value: e.target.value })}
                                onBlur={() => {
                                  if (editingDropdown.value.trim()) {
                                    const updated = [...feeOptions]; updated[i] = editingDropdown.value.trim()
                                    saveDropdownOptions('fee', updated)
                                  }
                                  setEditingDropdown(null)
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                className="flex-1 bg-gray-700 border border-blue-500 rounded px-1 py-0.5 text-xs text-white focus:outline-none" />
                            ) : (
                              <>
                                <span className="text-gray-300 truncate">{opt}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                  <button onClick={() => setEditingDropdown({ type: 'fee', action: 'edit', index: i, value: opt })}
                                    className="text-gray-500 hover:text-blue-400"><Edit2 size={10} /></button>
                                  <button onClick={() => saveDropdownOptions('fee', feeOptions.filter((_, j) => j !== i))}
                                    className="text-gray-500 hover:text-red-400"><Trash2 size={10} /></button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      {editingDropdown?.type === 'fee' && editingDropdown?.action === 'add' && (
                        <input type="text" value={editingDropdown.value} autoFocus placeholder="New fee option..."
                          onChange={e => setEditingDropdown({ ...editingDropdown, value: e.target.value })}
                          onBlur={() => {
                            if (editingDropdown.value.trim()) saveDropdownOptions('fee', [...feeOptions, editingDropdown.value.trim()])
                            setEditingDropdown(null)
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          className="w-full bg-gray-700 border border-blue-500 rounded px-2 py-1 text-xs text-white mt-1 focus:outline-none" />
                      )}
                    </div>
                  </div>
                </details>
              </div>
              </div>
              </>
            )}
            </div>
          </div>

          {/* Right panel: Slide picker + selected presentation */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Slide search */}
            <div className="p-3 border-b border-gray-800 bg-gray-900/50">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-2.5 top-2 text-gray-500" />
                  <input type="text" value={consultSlideSearch} onChange={e => setConsultSlideSearch(e.target.value)} placeholder="Search slides to add..."
                    className="w-full bg-gray-800 border border-gray-700 rounded px-8 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                  {consultSlideSearch && <button onClick={() => setConsultSlideSearch('')} className="absolute right-2.5 top-2 text-gray-500 hover:text-white"><X size={12} /></button>}
                </div>
                <span className="text-xs text-gray-500">{selectedSlides.size} slides selected</span>
              </div>
              {/* Active concern filter indicator */}
              {consultConcernFilter && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-gray-500">Filtering by:</span>
                  <button onClick={() => setConsultConcernFilter('')}
                    className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                    {consultConcernFilter.replace(/_/g, ' ')} <X size={10} />
                  </button>
                  <span className="text-xs text-gray-600">{consultFilteredSlides.length} matches</span>
                </div>
              )}
              {/* Selected slides strip */}
              {selectedSlides.size > 0 && (
                <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                  {Array.from(selectedSlides).map(num => {
                    const slide = slides.find(s => s.slide_number === num)
                    return slide ? (
                      <div key={num} className="flex-shrink-0 relative group">
                        <img src={getFullSlideUrl(slide)} alt="" className="w-20 h-11 rounded object-contain bg-gray-800 border border-blue-500/50" />
                        <span className="absolute bottom-0 left-0 bg-black/70 text-white text-xs px-1 rounded-tr">#{num}</span>
                        <button onClick={() => toggleSlideSelection(num)}
                          className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={8} />
                        </button>
                      </div>
                    ) : null
                  })}
                </div>
              )}
              {/* Saved presentations quick-load */}
              {savedPresentations.length > 0 && (
                <div className="mt-2">
                  <details>
                    <summary className="text-xs text-purple-400 cursor-pointer hover:text-purple-300">
                      <FolderOpen size={11} className="inline mr-1" /> Load Saved Presentation ({savedPresentations.length})
                    </summary>
                    <div className="mt-1 grid grid-cols-3 gap-1 max-h-32 overflow-y-auto">
                      {savedPresentations.map(pres => (
                        <button key={pres.id} onClick={() => {
                          const nums = new Set(pres.slide_numbers)
                          setSelectedSlides(nums)
                        }}
                          className="text-left bg-gray-800 hover:bg-gray-700 rounded p-1.5 text-xs border border-gray-700">
                          <p className="text-white font-medium truncate">{pres.name}</p>
                          <p className="text-gray-500">{pres.slide_numbers.length} slides</p>
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* Slide grid */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {consultFilteredSlides.map(slide => (
                  <div key={slide.slide_number}
                    className={'bg-gray-900 rounded-lg border overflow-hidden cursor-pointer transition-all hover:border-blue-500 ' +
                      (selectedSlides.has(slide.slide_number) ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-800')}
                    onClick={() => toggleSlideSelection(slide.slide_number)}>
                    <div className="relative">
                      <img src={getFullSlideUrl(slide)} alt={'Slide ' + slide.slide_number} className="w-full object-contain" loading="lazy" />
                      {selectedSlides.has(slide.slide_number) && (
                        <div className="absolute top-1 right-1 bg-blue-600 rounded-full p-0.5"><Check size={10} /></div>
                      )}
                      <span className="absolute bottom-0 left-0 bg-black/70 text-white text-xs px-1.5 py-0.5">#{slide.slide_number}</span>
                    </div>
                    <div className="px-2 py-1">
                      <p className="text-xs text-gray-300 truncate">{getSlideLabel(slide)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ====== ARCHIVE VIEW — rendered inline below ====== */
  const renderArchiveContent = () => {
    return (
        <div className="p-6">
          {/* Filter tabs */}
          <div className="flex items-center gap-2 mb-4">
            {[
              { value: '', label: 'All' },
              { value: 'sent', label: 'Sent' },
              { value: 'watched', label: 'Watched' },
              { value: 'follow_up_sent', label: 'Follow-up Sent' },
            ].map(f => (
              <button key={f.value} onClick={() => setArchiveFilter(f.value)}
                className={'px-3 py-1.5 rounded text-sm font-medium border ' +
                  (archiveFilter === f.value ? 'bg-purple-600/20 text-purple-400 border-purple-500/30' : 'bg-gray-900/80 text-gray-400 border-gray-800 hover:border-gray-700')}>
                {f.label}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={() => fetchConsultations()} className="px-3 py-1.5 rounded text-sm bg-gray-800 text-gray-400 hover:text-white flex items-center gap-1">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {/* Consultation list */}
          {archiveFilteredConsultations.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <Archive size={48} className="text-gray-700 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-400">No consultations yet</h3>
              <p className="text-sm text-gray-600 mt-1">Completed consultations will appear here with video, slides, and patient data.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {archiveFilteredConsultations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(consult => (
                <div key={consult.id} className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Patient photos */}
                        <div className="flex gap-1 flex-shrink-0">
                          {consult.photos.length > 0 ? consult.photos.slice(0, 2).map((photo, i) => (
                            <img key={i} src={photo} alt="" className="w-14 h-14 rounded-lg object-cover bg-gray-800 border border-gray-700" />
                          )) : (
                            <div className="w-14 h-14 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
                              <Camera size={16} className="text-gray-600" />
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-semibold text-white">{consult.patient_name || 'Unknown'}</h3>
                            <span className={'px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 ' + getStatusColor(consult.status)}>
                              {getStatusIcon(consult.status)} {consult.status.replace('_', ' ')}
                            </span>
                            {consult.watch_count > 0 && (
                              <span className="text-xs text-purple-400 flex items-center gap-1">
                                <Eye size={11} /> Watched {consult.watch_count}x
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><Calendar size={11} /> Sent {formatDate(consult.sent_at)}</span>
                            {consult.email && <span className="flex items-center gap-1"><Mail size={11} /> {consult.email}</span>}
                            {consult.phone && <span className="flex items-center gap-1"><Phone size={11} /> {consult.phone}</span>}
                            <span className="flex items-center gap-1"><Layers size={11} /> {consult.slide_numbers.length} slides</span>
                          </div>
                          {consult.last_watched_at && (
                            <p className="text-xs text-purple-400 mt-1">Last watched: {formatDateTime(consult.last_watched_at)}</p>
                          )}
                          {consult.follow_up_dates.length > 0 && (
                            <p className="text-xs text-orange-400 mt-1">
                              Follow-ups sent: {consult.follow_up_dates.map(d => formatDate(d)).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        <button onClick={() => resendConsultation(consult.id)}
                          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 rounded text-sm font-medium flex items-center gap-1">
                          <RefreshCw size={12} /> Resend
                        </button>
                        {consult.video_url && (
                          <a href={consult.video_url} target="_blank" rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm flex items-center gap-1">
                            <ExternalLink size={12} /> Video
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Slide thumbnails strip */}
                  {consult.slide_numbers.length > 0 && (
                    <div className="border-t border-gray-800 px-4 py-2 bg-gray-900/50">
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {consult.slide_numbers.map(num => {
                          const slide = slides.find(s => s.slide_number === num)
                          return slide ? (
                            <img key={num} src={getFullSlideUrl(slide)} alt={'Slide ' + num}
                              className="w-16 h-9 rounded object-contain bg-gray-800 border border-gray-700 flex-shrink-0" />
                          ) : (
                            <div key={num} className="w-16 h-9 rounded bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs text-gray-600">#{num}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Video player */}
                  {consult.video_url && consult.video_url.startsWith('blob:') && (
                    <div className="border-t border-gray-800 p-4">
                      <video src={consult.video_url} controls className="w-full max-w-lg rounded-lg" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
    )
  }

  /* ====== Navigation items for sidebar ====== */
  const navItems: { mode: ViewMode; icon: typeof Image; label: string; badge?: number }[] = [
    { mode: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', badge: pendingCount || undefined },
    { mode: 'grid', icon: Image, label: 'Slide Sorter' },
    { mode: 'sorter', icon: Layers, label: 'List Sorter' },
    { mode: 'deck', icon: Film, label: 'Decks' },
    { mode: 'presentations', icon: FolderOpen, label: 'Presentations' },
    { mode: 'archive', icon: Archive, label: 'Archive', badge: consultations.length || undefined },
  ]

  const viewTitles: Record<string, string> = {
    grid: 'Slide Sorter',
    sorter: 'List Sorter',
    deck: 'Recording Decks',
    presentations: 'Saved Presentations',
    dashboard: 'VC Dashboard',
    archive: 'Consultation Archive',
    settings: 'Settings',
  }

  const viewSubtitles: Record<string, string> = {
    grid: `${slides.length} slides · ${selectedSlides.size} selected`,
    sorter: `${slides.length} slides · grouped by condition`,
    deck: `${decks.length} recording decks`,
    presentations: `${savedPresentations.length} saved presentations`,
    dashboard: `${vcRequests.length} requests · ${pendingCount} pending`,
    archive: `${consultations.length} consultations sent`,
    settings: 'App configuration & data management',
  }

  /* ====== NORMAL MODE with Kleon Sidebar ====== */
  return (
    <div className="flex min-h-screen bg-[#0B1120] text-white">
      {/* ====== SIDEBAR (Kleon-style) ====== */}
      <aside className={'fixed left-0 top-0 z-40 h-screen border-r transition-all duration-300 ease-in-out bg-gray-950/80 backdrop-blur-xl border-gray-800/60 flex flex-col ' +
        (sidebarCollapsed ? 'w-[68px]' : 'w-[240px]')}>
        {/* Logo + collapse toggle */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-800/60 flex-shrink-0">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">VC</span>
              </div>
              <span className="text-sm font-semibold text-white truncate">Slide Manager</span>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-xs">VC</span>
            </div>
          )}
          <button onClick={toggleSidebar} className={'p-1.5 rounded-lg hover:bg-gray-800/70 text-gray-400 hover:text-white transition-colors ' + (sidebarCollapsed ? 'hidden' : '')}>
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {sidebarCollapsed && (
            <button onClick={toggleSidebar} className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-gray-800/70 text-gray-400 hover:text-white transition-colors mb-2">
              <PanelLeft size={18} />
            </button>
          )}
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = viewMode === item.mode
            return (
              <button key={item.mode} onClick={() => setViewMode(item.mode)}
                className={'w-full flex items-center gap-3 rounded-xl transition-all duration-200 ' +
                  (sidebarCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5') + ' ' +
                  (isActive
                    ? 'bg-blue-600/20 text-blue-400 shadow-sm shadow-blue-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50')}
                title={sidebarCollapsed ? item.label : undefined}>
                <Icon size={18} className={isActive ? 'text-blue-400' : ''} />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                )}
                {!sidebarCollapsed && item.badge && (
                  <span className={'text-xs px-1.5 py-0.5 rounded-full ' +
                    (isActive ? 'bg-blue-500/30 text-blue-300' : 'bg-gray-800 text-gray-400')}>
                    {item.badge}
                  </span>
                )}
                {sidebarCollapsed && item.badge && (
                  <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-800/60 px-2 py-3 space-y-1">
          {/* Present button — only enabled when slides are selected */}
          <button onClick={() => {
            if (selectedSlides.size === 0) return
            const list = filteredSlides.filter(s => selectedSlides.has(s.slide_number))
            enterPresentation(list)
          }}
            disabled={selectedSlides.size === 0}
            className={'w-full flex items-center gap-3 rounded-xl transition-all ' +
              (sidebarCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5') + ' ' +
              (selectedSlides.size > 0 ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-gray-800/30 text-gray-600 cursor-not-allowed')}
            title={sidebarCollapsed ? 'Present' : (selectedSlides.size === 0 ? 'Select slides first' : undefined)}>
            <Play size={18} />
            {!sidebarCollapsed && (
              <span className="text-sm font-medium">{selectedSlides.size > 0 ? `Present (${selectedSlides.size})` : 'Select slides to present'}</span>
            )}
          </button>
          {/* Settings */}
          <button onClick={() => setViewMode('settings')}
            className={'w-full flex items-center gap-3 rounded-xl transition-all ' +
            (sidebarCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5') + ' ' +
            (viewMode === 'settings' ? 'bg-blue-600/20 text-blue-400 shadow-sm shadow-blue-500/10' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50')}
            title={sidebarCollapsed ? 'Settings' : undefined}>
            <Settings size={18} />
            {!sidebarCollapsed && <span className="text-sm">Settings</span>}
          </button>
        </div>
      </aside>

      {/* ====== MAIN CONTENT AREA ====== */}
      <div className={'flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden transition-all duration-300 ' + (sidebarCollapsed ? 'ml-[68px]' : 'ml-[240px]')}>
        {/* Header bar (Kleon-style glassmorphism) */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 border-b border-gray-800/60 bg-gray-950/70 backdrop-blur-xl px-6">
          <div>
            <h2 className="text-lg font-semibold text-white">{viewTitles[viewMode] || 'VC Slide Manager'}</h2>
            <p className="text-xs text-gray-500">{viewSubtitles[viewMode] || ''}</p>
          </div>
          <div className="flex items-center gap-3">
            {viewMode === 'grid' && (
              <div className="flex items-center gap-2 bg-gray-800/60 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-gray-700/30">
                <ZoomOut size={14} className="text-gray-400" />
                <input type="range" min={0} max={SIZE_PRESETS.length - 1} value={slideSize} onChange={e => setSlideSize(parseInt(e.target.value))} className="w-24 accent-blue-500" />
                <ZoomIn size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500 w-6">{SIZE_PRESETS[slideSize].label}</span>
              </div>
            )}
            {(viewMode === 'grid' || viewMode === 'sorter') && (
              <button onClick={() => setShowImportModal(true)}
                className="px-3 py-1.5 rounded-xl text-sm font-medium bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-500/20 flex items-center gap-1.5">
                <Upload size={14} /> Import
              </button>
            )}
            {undoStack.length > 0 && (
              <button onClick={performUndo}
                className="px-3 py-1.5 rounded-xl text-sm font-medium bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 border border-amber-500/20 flex items-center gap-1.5">
                <Undo2 size={14} /> Undo
              </button>
            )}
            {(viewMode === 'grid' || viewMode === 'sorter') && selectedSlides.size > 0 && (
              <button onClick={() => {
                const list = filteredSlides.filter(s => selectedSlides.has(s.slide_number))
                enterPresentation(list)
              }}
                className="px-3 py-1.5 rounded-xl text-sm font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/20 flex items-center gap-1.5">
                <Play size={14} /> Present ({selectedSlides.size})
              </button>
            )}
          </div>
        </header>

        {/* View-specific content */}
        {viewMode === 'dashboard' && renderDashboardContent()}
        {viewMode === 'archive' && renderArchiveContent()}

        {/* SETTINGS VIEW */}
        {viewMode === 'settings' && (
          <div className="flex-1 p-6 overflow-auto">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* App Info */}
              <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Settings size={18} className="text-blue-400" /> App Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">App Name</span><p className="text-white font-medium">VC Slide Manager</p></div>
                  <div><span className="text-gray-500">Version</span><p className="text-white font-medium">2.0.0</p></div>
                  <div><span className="text-gray-500">API Endpoint</span><p className="text-white font-medium text-xs break-all">{API}</p></div>
                  <div><span className="text-gray-500">Total Slides</span><p className="text-white font-medium">{slides.length}</p></div>
                  <div><span className="text-gray-500">Saved Decks</span><p className="text-white font-medium">{decks.length}</p></div>
                  <div><span className="text-gray-500">Presentations</span><p className="text-white font-medium">{savedPresentations.length}</p></div>
                </div>
              </div>

              {/* Data Management */}
              <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Archive size={18} className="text-purple-400" /> Data Management</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-800/60 rounded-lg">
                    <div>
                      <p className="text-sm text-white font-medium">Export Slide Data</p>
                      <p className="text-xs text-gray-500">Download all slide metadata as JSON</p>
                    </div>
                    <button onClick={() => {
                      const blob = new Blob([JSON.stringify(slides, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a'); a.href = url; a.download = 'vc-slides-export.json'; a.click()
                      URL.revokeObjectURL(url)
                    }} className="px-3 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/20 rounded-lg text-sm flex items-center gap-1">
                      <ExternalLink size={14} /> Export JSON
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/60 rounded-lg">
                    <div>
                      <p className="text-sm text-white font-medium">Export Dock Configuration</p>
                      <p className="text-xs text-gray-500">Save current dock slide order</p>
                    </div>
                    <button onClick={() => {
                      const blob = new Blob([JSON.stringify({ dockSlides, customRowTitles }, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a'); a.href = url; a.download = 'vc-dock-config.json'; a.click()
                      URL.revokeObjectURL(url)
                    }} className="px-3 py-1.5 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-500/20 rounded-lg text-sm flex items-center gap-1">
                      <ExternalLink size={14} /> Export Config
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/60 rounded-lg">
                    <div>
                      <p className="text-sm text-white font-medium">Import Slides</p>
                      <p className="text-xs text-gray-500">Upload new slide images (JPG, PNG, WebP, GIF)</p>
                    </div>
                    <button onClick={() => setShowImportModal(true)}
                      className="px-3 py-1.5 bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/20 rounded-lg text-sm flex items-center gap-1">
                      <Upload size={14} /> Import
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/60 rounded-lg">
                    <div>
                      <p className="text-sm text-white font-medium">Clear Local Cache</p>
                      <p className="text-xs text-gray-500">Reset dock, row titles, and local preferences</p>
                    </div>
                    <button onClick={() => {
                      if (confirm('Clear all local data (dock, row titles, preferences)?')) {
                        localStorage.removeItem('vc_dock_slides')
                        localStorage.removeItem('vc_row_titles')
                        localStorage.removeItem('vc_sidebar_collapsed')
                        setDockSlides([])
                        setCustomRowTitles({})
                        setSidebarCollapsed(false)
                      }
                    }} className="px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/20 rounded-lg text-sm flex items-center gap-1">
                      <Trash2 size={14} /> Clear
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/60 rounded-lg">
                    <div>
                      <p className="text-sm text-white font-medium">Refresh All Data</p>
                      <p className="text-xs text-gray-500">Reload slides, decks, and stats from API</p>
                    </div>
                    <button onClick={() => { fetchSlides(); fetchDecks(); fetchStats(); fetchPresentations(); fetchPresCats() }}
                      className="px-3 py-1.5 bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 border border-amber-500/20 rounded-lg text-sm flex items-center gap-1">
                      <RefreshCw size={14} /> Refresh
                    </button>
                  </div>
                </div>
              </div>

              {/* Category Management */}
              <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Tag size={18} className="text-green-400" /> Category Management</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-blue-400 mb-2">Treatments ({stats ? Object.keys(stats.treatment_types).length : 0})</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {stats && Object.entries(stats.treatment_types).map(([t, count]) => (
                        <div key={t} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-gray-800/60 group">
                          <span className="text-gray-300">{formatTreatment(t)} <span className="text-gray-600">({count})</span></span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                            <button onClick={() => setEditingCategory({ type: 'treatment', oldName: t, newName: t })} className="text-blue-400 hover:text-blue-300"><Edit2 size={10} /></button>
                            <button onClick={() => removeCategory('treatment', t)} className="text-red-400 hover:text-red-300"><Trash2 size={10} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-purple-400 mb-2">Concerns ({stats ? Object.keys(stats.concern_types).length : 0})</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {stats && Object.entries(stats.concern_types).map(([c, count]) => (
                        <div key={c} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-gray-800/60 group">
                          <span className="text-gray-300">{formatConcern(c)} <span className="text-gray-600">({count})</span></span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                            <button onClick={() => setEditingCategory({ type: 'concern', oldName: c, newName: c })} className="text-purple-400 hover:text-purple-300"><Edit2 size={10} /></button>
                            <button onClick={() => removeCategory('concern', c)} className="text-red-400 hover:text-red-300"><Trash2 size={10} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Keyboard Shortcuts */}
              <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><LayoutDashboard size={18} className="text-amber-400" /> Quick Reference</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between p-2 bg-gray-800/40 rounded">
                    <span className="text-gray-400">Drag slide to dock</span>
                    <span className="text-gray-300">Adds to quick-selection area</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-800/40 rounded">
                    <span className="text-gray-400">Drag slide to sides</span>
                    <span className="text-gray-300">Deletes from dock</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-800/40 rounded">
                    <span className="text-gray-400">Drag dock slide to row</span>
                    <span className="text-gray-300">Removes from dock</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-800/40 rounded">
                    <span className="text-gray-400">Undo button</span>
                    <span className="text-gray-300">Restores last deletion (up to 20)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-800/40 rounded">
                    <span className="text-gray-400">Supported image formats</span>
                    <span className="text-gray-300">JPG, PNG, WebP, GIF (max 5MB)</span>
                  </div>
                </div>
              </div>

              {/* API Status */}
              <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><ExternalLink size={18} className="text-cyan-400" /> API Configuration</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-800/60 rounded-lg">
                    <div>
                      <p className="text-sm text-white font-medium">Backend API</p>
                      <p className="text-xs text-gray-500 break-all">{API}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      <span className="text-xs text-green-400">Connected</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/60 rounded-lg">
                    <div>
                      <p className="text-sm text-white font-medium">Available Endpoints</p>
                      <p className="text-xs text-gray-500">GET /slides, POST /slides, PUT /slides/:id, GET /stats</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {(viewMode === 'grid' || viewMode === 'sorter' || viewMode === 'deck' || viewMode === 'presentations') && (
        <div className="flex flex-1">
        {/* Filter sidebar (for slide views) */}
        {(viewMode === 'grid' || viewMode === 'sorter') && (
        <aside className="w-52 bg-gray-900/50 backdrop-blur-sm border-r border-gray-800/40 p-3 flex-shrink-0">
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-400 mb-1">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2 text-gray-500" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search slides..."
                className="w-full bg-gray-800 border border-gray-700 rounded px-8 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2 text-gray-500 hover:text-white"><X size={12} /></button>}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-400 mb-1">Treatment</label>
            <select value={filterTreatment} onChange={e => setFilterTreatment(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="">All Treatments</option>
              {stats && Object.entries(stats.treatment_types).map(([t, count]) => <option key={t} value={t}>{formatTreatment(t)} ({count})</option>)}
            </select>
            {filterTreatment && (
              <div className="flex gap-1 mt-1">
                <button onClick={() => setEditingCategory({ type: 'treatment', oldName: filterTreatment, newName: filterTreatment })}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5"><Edit2 size={10} /> Edit</button>
                <button onClick={() => { removeCategory('treatment', filterTreatment); setFilterTreatment('') }}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-0.5"><Trash2 size={10} /> Delete</button>
              </div>
            )}
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-400 mb-1">Concern</label>
            <select value={filterConcern} onChange={e => setFilterConcern(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="">All Concerns</option>
              {stats && Object.entries(stats.concern_types).map(([c, count]) => <option key={c} value={c}>{formatConcern(c)} ({count})</option>)}
            </select>
            {filterConcern && (
              <div className="flex gap-1 mt-1">
                <button onClick={() => setEditingCategory({ type: 'concern', oldName: filterConcern, newName: filterConcern })}
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-0.5"><Edit2 size={10} /> Edit</button>
                <button onClick={() => { removeCategory('concern', filterConcern); setFilterConcern('') }}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-0.5"><Trash2 size={10} /> Delete</button>
              </div>
            )}
          </div>
          <div className="mb-4">
            <button onClick={selectAll} className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300">
              {selectedSlides.size === filteredSlides.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          {selectedSlides.size > 0 && (
            <div className="bg-gray-800 rounded p-2 border border-gray-700 mb-4">
              <h3 className="text-xs font-medium text-gray-300 mb-1.5"><Film size={12} className="inline mr-1" /> Recording Deck</h3>
              <input type="text" value={deckName} onChange={e => setDeckName(e.target.value)} placeholder="Deck name..."
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-500 mb-1.5 focus:outline-none focus:border-blue-500" />
              <button onClick={saveDeck} disabled={!deckName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 rounded px-2 py-1 text-xs font-medium mb-1.5">
                <Save size={12} className="inline mr-1" /> Save ({selectedSlides.size})
              </button>
              <button onClick={() => {
                const list = filteredSlides.filter(s => selectedSlides.has(s.slide_number))
                enterPresentation(list)
              }}
                className="w-full bg-green-600 hover:bg-green-500 rounded px-2 py-1 text-xs font-medium flex items-center justify-center gap-1">
                <Play size={12} /> Present Selected
              </button>
            </div>
          )}
          <div className="border-t border-gray-800 pt-3 mt-3">
            <h3 className="text-xs font-medium text-gray-400 mb-2">Manage Categories</h3>
            <details className="mb-2">
              <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300">Treatments ({stats ? Object.keys(stats.treatment_types).length : 0})</summary>
              <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
                {stats && Object.keys(stats.treatment_types).map(t => (
                  <div key={t} className="flex items-center justify-between text-xs py-0.5 px-1 rounded hover:bg-gray-800 group">
                    {editingCategory?.oldName === t && editingCategory?.type === 'treatment' ? (
                      <input type="text" value={editingCategory.newName} onChange={e => setEditingCategory({ ...editingCategory, newName: e.target.value })}
                        onBlur={() => renameCategory('treatment', t, editingCategory.newName)}
                        onKeyDown={e => { if (e.key === 'Enter') renameCategory('treatment', t, editingCategory.newName); if (e.key === 'Escape') setEditingCategory(null) }}
                        className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-white w-full" autoFocus />
                    ) : (
                      <>
                        <span className="text-gray-300 truncate">{formatTreatment(t)}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                          <button onClick={() => setEditingCategory({ type: 'treatment', oldName: t, newName: t })} className="text-gray-500 hover:text-blue-400"><Edit2 size={10} /></button>
                          <button onClick={() => removeCategory('treatment', t)} className="text-gray-500 hover:text-red-400"><Trash2 size={10} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {newCategory?.type === 'treatment' ? (
                  <div className="flex gap-1 mt-1">
                    <input type="text" value={newCategory.name} onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') setNewCategory(null); if (e.key === 'Escape') setNewCategory(null) }}
                      placeholder="New treatment..." className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-white flex-1" autoFocus />
                  </div>
                ) : (
                  <button onClick={() => setNewCategory({ type: 'treatment', name: '' })} className="text-xs text-gray-500 hover:text-blue-400 mt-1 flex items-center gap-0.5"><Plus size={10} /> Add</button>
                )}
              </div>
            </details>
            <details className="mb-2">
              <summary className="text-xs text-purple-400 cursor-pointer hover:text-purple-300">Concerns ({stats ? Object.keys(stats.concern_types).length : 0})</summary>
              <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
                {stats && Object.keys(stats.concern_types).map(c => (
                  <div key={c} className="flex items-center justify-between text-xs py-0.5 px-1 rounded hover:bg-gray-800 group">
                    {editingCategory?.oldName === c && editingCategory?.type === 'concern' ? (
                      <input type="text" value={editingCategory.newName} onChange={e => setEditingCategory({ ...editingCategory, newName: e.target.value })}
                        onBlur={() => renameCategory('concern', c, editingCategory.newName)}
                        onKeyDown={e => { if (e.key === 'Enter') renameCategory('concern', c, editingCategory.newName); if (e.key === 'Escape') setEditingCategory(null) }}
                        className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-white w-full" autoFocus />
                    ) : (
                      <>
                        <span className="text-gray-300 truncate">{formatConcern(c)}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                          <button onClick={() => setEditingCategory({ type: 'concern', oldName: c, newName: c })} className="text-gray-500 hover:text-purple-400"><Edit2 size={10} /></button>
                          <button onClick={() => removeCategory('concern', c)} className="text-gray-500 hover:text-red-400"><Trash2 size={10} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {newCategory?.type === 'concern' ? (
                  <div className="flex gap-1 mt-1">
                    <input type="text" value={newCategory.name} onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') setNewCategory(null); if (e.key === 'Escape') setNewCategory(null) }}
                      placeholder="New concern..." className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-white flex-1" autoFocus />
                  </div>
                ) : (
                  <button onClick={() => setNewCategory({ type: 'concern', name: '' })} className="text-xs text-gray-500 hover:text-purple-400 mt-1 flex items-center gap-0.5"><Plus size={10} /> Add</button>
                )}
              </div>
            </details>
          </div>
          <div className="mt-4 text-xs text-gray-500"><p>Showing {filteredSlides.length} of {slides.length}</p></div>
          <div className="mt-2 text-xs text-gray-600 italic"><p>Supported image types: JPG, PNG, WebP, GIF (max 5MB)</p></div>
        </aside>
        )}

        <main className="flex-1 p-4 overflow-y-auto overflow-x-hidden min-w-0">
          {/* GRID VIEW */}
          {viewMode === 'grid' && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredSlides.map(s => s.slide_number)} strategy={rectSortingStrategy}>
                <div className={'grid ' + SIZE_PRESETS[slideSize].cols + ' gap-3'}>
                  {filteredSlides.map(slide => (
                    <SortableSlideCard key={slide.slide_number} slide={slide} size={slideSize} selectedSlides={selectedSlides}
                      expandedSlide={expandedSlide} toggleSlideSelection={toggleSlideSelection} startEdit={startEdit}
                      getSlideLabel={getSlideLabel} getSlideImage={getSlideImage}
                      formatTreatment={formatTreatment} onRemove={n => setConfirmRemove(n)} />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {dragActiveSlide && (
                  <div className="bg-gray-900 rounded-lg border border-blue-500 overflow-hidden shadow-2xl opacity-90 w-48">
                    <img src={getFullSlideUrl(dragActiveSlide)} alt="" className="w-full object-contain" />
                    <div className="px-2 py-1 text-xs text-white">#{dragActiveSlide.slide_number} {getSlideLabel(dragActiveSlide)}</div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}

          {/* LIST SORTER VIEW — Unified DnD for cross-container drag (dock ↔ rows ↔ delete) */}
          {viewMode === 'sorter' && (() => {
            const groups = buildGroupedSlides()
            const allSortableIds = [
              ...dockSlides,
              ...Object.values(groups).flatMap(slides => slides.map(s => s.slide_number))
            ]
            const dockSlideObjects = dockSlides.map(n => slides.find(s => s.slide_number === n)).filter(Boolean) as Slide[]
            return (
              <>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-lg font-bold">List Sorter &mdash; By Condition / Concern</h2>
                <div className="flex gap-2 flex-wrap">
                  {dockSlideObjects.length > 0 && (
                    <>
                      <span className="text-xs text-amber-400/70 bg-amber-900/40 px-2 py-1 rounded flex items-center gap-1"><Layers size={12} className="text-amber-400" /> Dock: {dockSlideObjects.length}</span>
                      <button onClick={() => { dockSlideObjects.forEach(s => { if (!selectedSlides.has(s.slide_number)) toggleSlideSelection(s.slide_number) }) }}
                        className="text-xs bg-amber-700/50 hover:bg-amber-600/50 px-2 py-1 rounded text-amber-200">Select All</button>
                      <button onClick={() => enterPresentation(dockSlideObjects)}
                        className="text-xs bg-green-700/50 hover:bg-green-600/50 px-2 py-1 rounded text-green-200 flex items-center gap-1"><Play size={10} /> Present</button>
                      <button onClick={() => {
                        const prevDock = [...dockSlides]
                        setDockSlides([]); localStorage.setItem('vc_dock_slides', '[]')
                        pushUndo({ type: 'clear_dock', description: 'Cleared dock', restore: () => { setDockSlides(prevDock); localStorage.setItem('vc_dock_slides', JSON.stringify(prevDock)) } })
                      }}
                        className="text-xs bg-red-700/30 hover:bg-red-600/30 px-2 py-1 rounded text-red-300">Clear Dock</button>
                    </>
                  )}
                  {undoStack.length > 0 && (
                    <button onClick={performUndo}
                      className="text-xs bg-amber-800/50 hover:bg-amber-700/50 px-2 py-1 rounded text-amber-300 flex items-center gap-1">
                      <Undo2 size={12} /> Undo ({undoStack.length})
                    </button>
                  )}
                  <button onClick={() => { const all: Record<string, boolean> = {}; Object.keys(groups).forEach(k => { all[k] = true }); setSorterCollapsed(all) }}
                    className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-gray-400">Collapse All</button>
                  <button onClick={() => setSorterCollapsed({})} className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-gray-400">Expand All</button>
                </div>
              </div>
              <DndContext sensors={sensors} collisionDetection={containerFirstCollision} onDragStart={handleUnifiedSorterDragStart} onDragEnd={handleUnifiedSorterDragEnd}>
              <SortableContext items={allSortableIds}>
              <div className="space-y-4">
                {/* Delete drop zones on sides */}
                {dragActiveId && (
                  <>
                    <DeleteDropZone id="delete-left" side="left" />
                    <DeleteDropZone id="delete-right" side="right" />
                  </>
                )}

                {/* DOCK — droppable zone, drag slides here from any row */}
                <DroppableZone id="dock-drop-zone" className="bg-gradient-to-r from-amber-900/30 to-blue-900/30 border-2 border-amber-500/40 rounded-lg overflow-hidden sticky top-0 z-10">
                  {dockSlideObjects.length === 0 ? (
                    <div className="p-4 text-center text-amber-400/50 text-sm">
                      Drag slides here from any row below, or click <Plus size={12} className="inline" /> on any slide. Drag to the sides to delete.
                    </div>
                  ) : (
                    <div className="flex gap-3 p-3 overflow-x-auto">
                      {dockSlideObjects.map(slide => (
                        <div key={slide.slide_number} className="relative group flex-shrink-0">
                          <SortableListCard slide={slide} selectedSlides={selectedSlides}
                            toggleSlideSelection={toggleSlideSelection} startEdit={startEdit} setConfirmRemove={n => setConfirmRemove(n)}
                            getSlideLabel={getSlideLabel} getSlideImage={getSlideImage} formatTreatment={formatTreatment} />
                          <button onClick={e => { e.stopPropagation(); removeFromDock(slide.slide_number) }}
                            className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10" title="Remove from dock">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </DroppableZone>

                {/* Category rows — each is a droppable zone, drag dock slides back here */}
                {Object.entries(groups).map(([category, categorySlides]) => (
                  <DroppableZone key={category} id={'row-drop-' + category} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-800/60 cursor-pointer"
                      onClick={() => setSorterCollapsed(prev => ({ ...prev, [category]: !prev[category] }))}>
                      <div className="flex items-center gap-2">
                        {sorterCollapsed[category] ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
                        {editingRowTitle?.category === category ? (
                          <input type="text" value={editingRowTitle.newName} autoFocus
                            onClick={e => e.stopPropagation()}
                            onChange={e => setEditingRowTitle({ ...editingRowTitle, newName: e.target.value })}
                            onBlur={() => saveRowTitle(category, editingRowTitle.newName)}
                            onKeyDown={e => { if (e.key === 'Enter') saveRowTitle(category, editingRowTitle.newName); if (e.key === 'Escape') setEditingRowTitle(null) }}
                            className="bg-gray-700 border border-blue-500 rounded px-2 py-0.5 text-sm text-white font-semibold focus:outline-none" />
                        ) : (
                          <h3 className="text-sm font-semibold text-white cursor-text" onClick={e => { e.stopPropagation(); setEditingRowTitle({ category, newName: getRowTitle(category) }) }}>
                            {getRowTitle(category)}
                          </h3>
                        )}
                        <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">{categorySlides.length} slides</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={e => { e.stopPropagation(); enterPresentation([...categorySlides]) }}
                          className="text-xs bg-green-700/50 hover:bg-green-600/50 px-2 py-0.5 rounded text-green-300 flex items-center gap-0.5" title="Send this row to Presentation view as a template"><Play size={10} /> Present Row</button>
                        <button onClick={e => { e.stopPropagation(); categorySlides.forEach(s => { if (!selectedSlides.has(s.slide_number)) toggleSlideSelection(s.slide_number) }) }}
                          className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded text-gray-300">Select Row</button>
                        <button onClick={e => { e.stopPropagation(); setEditingRowTitle({ category, newName: getRowTitle(category) }) }}
                          className="p-1 text-gray-500 hover:text-blue-400" title="Rename row"><Edit2 size={12} /></button>
                        <button onClick={e => { e.stopPropagation(); removeCategory('concern', category) }}
                          className="p-1 text-gray-500 hover:text-red-400"><Trash2 size={12} /></button>
                      </div>
                    </div>
                    {!sorterCollapsed[category] && (
                      <div className="flex gap-3 p-3 overflow-x-auto">
                        {categorySlides.map(slide => (
                          <div key={slide.slide_number} className="relative group flex-shrink-0">
                            <SortableListCard slide={slide} selectedSlides={selectedSlides}
                              toggleSlideSelection={toggleSlideSelection} startEdit={startEdit} setConfirmRemove={n => setConfirmRemove(n)}
                              getSlideLabel={getSlideLabel} getSlideImage={getSlideImage} formatTreatment={formatTreatment} />
                            {!dockSlides.includes(slide.slide_number) && (
                              <button onClick={e => { e.stopPropagation(); addToDock(slide.slide_number) }}
                                className="absolute -top-1.5 -right-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10" title="Add to Dock">
                                <Plus size={10} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </DroppableZone>
                ))}
              </div>
              </SortableContext>
              <DragOverlay>
                {dragActiveSlide && (
                  <div className="bg-gray-900 rounded-lg border border-amber-500 overflow-hidden shadow-2xl opacity-90 w-48">
                    <img src={getFullSlideUrl(dragActiveSlide)} alt="" className="w-full object-contain" />
                    <div className="px-2 py-1 text-xs text-white">#{dragActiveSlide.slide_number} {getSlideLabel(dragActiveSlide)}</div>
                  </div>
                )}
              </DragOverlay>
              </DndContext>
              </>
            )
          })()}

          {/* DECKS VIEW */}
          {viewMode === 'deck' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Recording Decks</h2>
              {decks.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
                  <Film size={48} className="text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg mb-2">No recording decks yet</p>
                  <p className="text-gray-500 text-sm">Select slides in Slide Sorter or List Sorter and save as a recording deck</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {decks.map(deck => (
                    <div key={deck.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                      <div className="p-4 flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{deck.name}</h3>
                          <p className="text-sm text-gray-400">{deck.slide_numbers.length} slides &middot; {new Date(deck.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            const deckSlides = deck.slide_numbers.map(n => slides.find(s => s.slide_number === n)).filter(Boolean) as Slide[]
                            enterPresentation(deckSlides)
                          }} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm font-medium text-white">
                            <Play size={14} /> Present
                          </button>
                          <button onClick={() => { setPreviewDeck(previewDeck?.id === deck.id ? null : deck); setPreviewSlideIdx(0) }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium">
                            <Eye size={14} /> {previewDeck?.id === deck.id ? 'Close' : 'Preview'}
                          </button>
                          <button onClick={() => { setSelectedSlides(new Set(deck.slide_numbers)); setViewMode('grid') }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300"><Edit2 size={14} /> Edit</button>
                          <button onClick={() => deleteDeck(deck.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 rounded text-sm text-red-300"><Trash2 size={14} /> Delete</button>
                        </div>
                      </div>
                      <div className="px-4 pb-4 flex gap-2 overflow-x-auto">
                        {deck.slide_numbers.map((num, idx) => {
                          const slide = slides.find(s => s.slide_number === num)
                          if (!slide) return null
                          return (
                            <div key={num} className={'flex-shrink-0 w-32 bg-gray-800 rounded overflow-hidden cursor-pointer border-2 transition-all ' +
                              (previewDeck?.id === deck.id && previewSlideIdx === idx ? 'border-blue-500' : 'border-transparent hover:border-gray-600')
                            } onClick={() => { setPreviewDeck(deck); setPreviewSlideIdx(idx) }}>
                              <img src={getFullSlideUrl(slide)} alt="" className="w-full object-contain" loading="lazy"
                                onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/128x72/1f2937/6b7280?text=No+Image' }} />
                              <div className="p-1"><p className="text-xs text-gray-300 truncate">#{num} {getSlideLabel(slide).substring(0, 30)}</p></div>
                            </div>
                          )
                        })}
                      </div>
                      {previewDeck?.id === deck.id && (() => {
                        const currentSlide = slides.find(s => s.slide_number === deck.slide_numbers[previewSlideIdx])
                        if (!currentSlide) return null
                        return (
                          <div className="border-t border-gray-800 p-6">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-lg font-medium">#{currentSlide.slide_number}: {getSlideLabel(currentSlide)}</h4>
                              <div className="flex items-center gap-2">
                                <button onClick={() => setPreviewSlideIdx(Math.max(0, previewSlideIdx - 1))} disabled={previewSlideIdx === 0}
                                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded text-sm">Prev</button>
                                <span className="text-sm text-gray-400">{previewSlideIdx + 1} / {deck.slide_numbers.length}</span>
                                <button onClick={() => setPreviewSlideIdx(Math.min(deck.slide_numbers.length - 1, previewSlideIdx + 1))}
                                  disabled={previewSlideIdx === deck.slide_numbers.length - 1}
                                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded text-sm">Next</button>
                              </div>
                            </div>
                            <img src={getFullSlideUrl(currentSlide)} alt="" className="w-full max-w-3xl mx-auto rounded object-contain"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          </div>
                        )
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PRESENTATIONS SORTER VIEW */}
          {viewMode === 'presentations' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Presentation Sorter</h2>
                <div className="flex items-center gap-2">
                  <select value={presFilterType} onChange={e => setPresFilterType(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white">
                    <option value="">All Request Types</option>
                    {Object.entries(presCats.request_types).map(([rt, count]) => (
                      <option key={rt} value={rt}>{formatTreatment(rt)} ({count})</option>
                    ))}
                  </select>
                  <select value={presFilterProc} onChange={e => setPresFilterProc(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white">
                    <option value="">All Procedures</option>
                    {Object.entries(presCats.procedures).map(([p, count]) => (
                      <option key={p} value={p}>{formatTreatment(p)} ({count})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category management */}
              <div className="flex gap-4 mb-4">
                <details className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex-1">
                  <summary className="text-xs font-semibold text-purple-400 cursor-pointer">Manage Request Types ({Object.keys(presCats.request_types).length})</summary>
                  <div className="mt-2 space-y-1">
                    {Object.entries(presCats.request_types).map(([rt, count]) => (
                      <div key={rt} className="flex items-center justify-between text-xs py-0.5 px-1 rounded hover:bg-gray-800 group">
                        <span className="text-gray-300">{formatTreatment(rt)} <span className="text-gray-600">({count})</span></span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                          <button onClick={() => setEditingPresCat({ catType: 'request_type', oldName: rt, newName: rt })} className="text-gray-500 hover:text-blue-400"><Edit2 size={10} /></button>
                          <button onClick={() => removePresCat('request_type', rt)} className="text-gray-500 hover:text-red-400"><Trash2 size={10} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
                <details className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex-1">
                  <summary className="text-xs font-semibold text-blue-400 cursor-pointer">Manage Procedures ({Object.keys(presCats.procedures).length})</summary>
                  <div className="mt-2 space-y-1">
                    {Object.entries(presCats.procedures).map(([p, count]) => (
                      <div key={p} className="flex items-center justify-between text-xs py-0.5 px-1 rounded hover:bg-gray-800 group">
                        <span className="text-gray-300">{formatTreatment(p)} <span className="text-gray-600">({count})</span></span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                          <button onClick={() => setEditingPresCat({ catType: 'procedure', oldName: p, newName: p })} className="text-gray-500 hover:text-blue-400"><Edit2 size={10} /></button>
                          <button onClick={() => removePresCat('procedure', p)} className="text-gray-500 hover:text-red-400"><Trash2 size={10} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>

              {/* Presentation cards */}
              {savedPresentations.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
                  <FolderOpen size={48} className="text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg mb-2">No saved presentations yet</p>
                  <p className="text-gray-500 text-sm">Select slides, enter Presentation Mode, and click "Save Presentation" to create one</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedPresentations
                    .filter(p => !presFilterType || p.request_type === presFilterType)
                    .filter(p => !presFilterProc || p.procedures.includes(presFilterProc))
                    .map(pres => (
                    <div key={pres.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <h3 className="text-lg font-semibold truncate">{pres.name}</h3>
                            {pres.request_type && (
                              <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded flex-shrink-0">
                                <Tag size={10} className="inline mr-1" />{formatTreatment(pres.request_type)}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => {
                              const presSlides = pres.slide_numbers.map(n => slides.find(s => s.slide_number === n)).filter(Boolean) as Slide[]
                              enterPresentation(presSlides)
                            }} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm font-medium text-white">
                              <Play size={14} /> Present
                            </button>
                            <button onClick={() => {
                              setEditingPresentation(pres)
                              setSavePresForm({
                                name: pres.name, request_type: pres.request_type,
                                procedures: pres.procedures.join(', '), script: pres.script, notes: pres.notes,
                              })
                              // Load the slides into presentation mode for editing
                              const presSlides = pres.slide_numbers.map(n => slides.find(s => s.slide_number === n)).filter(Boolean) as Slide[]
                              setPresentationSlides(presSlides)
                              setShowSavePresModal(true)
                            }} className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300">
                              <Edit2 size={14} /> Edit
                            </button>
                            <button onClick={() => deleteSavedPresentation(pres.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 rounded text-sm text-red-300">
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-500">{pres.slide_numbers.length} slides</span>
                          <span className="text-xs text-gray-600">&middot;</span>
                          <span className="text-xs text-gray-500">{new Date(pres.updated_at).toLocaleDateString()}</span>
                          {pres.procedures.length > 0 && (
                            <>
                              <span className="text-xs text-gray-600">&middot;</span>
                              {pres.procedures.map(p => (
                                <span key={p} className="text-xs bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">{formatTreatment(p)}</span>
                              ))}
                            </>
                          )}
                        </div>
                        {/* Script preview */}
                        {pres.script && (
                          <div className="bg-gray-800/50 rounded p-3 mb-2 border border-gray-700">
                            <div className="flex items-center gap-1 mb-1">
                              <FileText size={12} className="text-gray-400" />
                              <span className="text-xs font-medium text-gray-400">Script / Talking Points</span>
                            </div>
                            <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-3">{pres.script}</p>
                          </div>
                        )}
                        {pres.notes && (
                          <div className="bg-yellow-900/20 rounded p-2 border border-yellow-800/30">
                            <p className="text-xs text-yellow-300/70"><span className="font-medium">Notes:</span> {pres.notes}</p>
                          </div>
                        )}
                      </div>
                      {/* Slide thumbnails */}
                      <div className="px-4 pb-4 flex gap-2 overflow-x-auto">
                        {pres.slide_numbers.map(num => {
                          const slide = slides.find(s => s.slide_number === num)
                          if (!slide) return null
                          return (
                            <div key={num} className="flex-shrink-0 w-28 bg-gray-800 rounded overflow-hidden border border-gray-700">
                              <img src={getFullSlideUrl(slide)} alt="" className="w-full object-contain" loading="lazy"
                                onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/112x63/1f2937/6b7280?text=...' }} />
                              <div className="p-1"><p className="text-xs text-gray-400 truncate">#{num}</p></div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
        )}

      {/* Edit slide modal */}
      {editingSlide !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setEditingSlide(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Edit Slide #{editingSlide}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Custom Label</label>
                <input type="text" value={editForm.custom_label || ''} onChange={e => setEditForm(prev => ({ ...prev, custom_label: e.target.value }))}
                  placeholder="Enter a custom label..." className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Condition</label>
                <textarea value={editForm.condition || ''} onChange={e => setEditForm(prev => ({ ...prev, condition: e.target.value }))}
                  rows={3} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-y" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Solution</label>
                <textarea value={editForm.solution || ''} onChange={e => setEditForm(prev => ({ ...prev, solution: e.target.value }))}
                  rows={3} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-y" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Treatments (comma-separated)</label>
                <input type="text" value={(editForm.treatments || []).join(', ')}
                  onChange={e => setEditForm(prev => ({ ...prev, treatments: e.target.value.split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean) }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Concerns (comma-separated)</label>
                <input type="text" value={(editForm.concerns || []).join(', ')}
                  onChange={e => setEditForm(prev => ({ ...prev, concerns: e.target.value.split(',').map(c => c.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean) }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditingSlide(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium"><Save size={14} className="inline mr-1" /> Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm remove modal */}
      {confirmRemove !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setConfirmRemove(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
            <Trash2 size={32} className="text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-2">Remove Slide #{confirmRemove}?</h3>
            <p className="text-sm text-gray-400 mb-4">Removes from current view. Refresh to restore.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setConfirmRemove(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">Cancel</button>
              <button onClick={() => removeSlide(confirmRemove)} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-medium">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename category modal */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setEditingCategory(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Rename {editingCategory.type === 'treatment' ? 'Treatment' : 'Concern'}</h3>
            <input type="text" value={editingCategory.newName} onChange={e => setEditingCategory({ ...editingCategory, newName: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') renameCategory(editingCategory.type, editingCategory.oldName, editingCategory.newName) }}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" autoFocus />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditingCategory(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">Cancel</button>
              <button onClick={() => renameCategory(editingCategory.type, editingCategory.oldName, editingCategory.newName)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium">Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename presentation category modal */}
      {editingPresCat && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setEditingPresCat(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Rename {editingPresCat.catType === 'request_type' ? 'Request Type' : 'Procedure'}</h3>
            <input type="text" value={editingPresCat.newName} onChange={e => setEditingPresCat({ ...editingPresCat, newName: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') renamePresCat() }}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" autoFocus />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditingPresCat(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">Cancel</button>
              <button onClick={renamePresCat} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded text-sm font-medium">Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Undo toast notification */}
      {showUndoToast && undoStack.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-amber-500/40 rounded-xl px-5 py-3 shadow-2xl flex items-center gap-3 animate-pulse">
          <span className="text-sm text-gray-300">{undoStack[undoStack.length - 1].description}</span>
          <button onClick={performUndo} className="px-3 py-1 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium text-white flex items-center gap-1">
            <Undo2 size={14} /> Undo
          </button>
          <button onClick={() => setShowUndoToast(false)} className="text-gray-500 hover:text-gray-300"><X size={14} /></button>
        </div>
      )}

      {/* Import slides modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setShowImportModal(false); setImportFiles([]) }}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><ImagePlus size={20} className="text-purple-400" /> Import Slides</h3>
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-purple-500/50 transition-colors cursor-pointer"
              onClick={() => importInputRef.current?.click()}>
              <Upload size={32} className="text-gray-500 mx-auto mb-3" />
              <p className="text-sm text-gray-400 mb-1">Click to select images or drag & drop</p>
              <p className="text-xs text-gray-600">Supported: JPG, PNG, WebP, GIF (max 5MB each)</p>
              <input ref={importInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden" onChange={e => { if (e.target.files) setImportFiles(Array.from(e.target.files)) }} />
            </div>
            {importFiles.length > 0 && (
              <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                {importFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-gray-300 bg-gray-800 rounded px-2 py-1">
                    <span className="truncate">{f.name}</span>
                    <span className="text-gray-500 ml-2">{(f.size / 1024).toFixed(0)}KB</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowImportModal(false); setImportFiles([]) }} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">Cancel</button>
              <button onClick={handleImportFiles} disabled={importFiles.length === 0 || importing}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 rounded text-sm font-medium flex items-center gap-1">
                {importing ? <><RefreshCw size={14} className="animate-spin" /> Importing...</> : <><Upload size={14} /> Import ({importFiles.length})</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save/Edit presentation modal (from normal mode, e.g. editing from Presentations view) */}
      {showSavePresModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setShowSavePresModal(false); setEditingPresentation(null) }}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editingPresentation ? 'Edit Presentation' : 'Save Presentation'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Presentation Name *</label>
                <input type="text" value={savePresForm.name} onChange={e => setSavePresForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Veneer Consultation - Full Arch" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Request Type</label>
                <input type="text" value={savePresForm.request_type} onChange={e => setSavePresForm(prev => ({ ...prev, request_type: e.target.value }))}
                  placeholder="e.g. cosmetic_consultation" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Procedures (comma-separated)</label>
                <input type="text" value={savePresForm.procedures} onChange={e => setSavePresForm(prev => ({ ...prev, procedures: e.target.value }))}
                  placeholder="e.g. veneers, whitening" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Script / Talking Points</label>
                <textarea value={savePresForm.script} onChange={e => setSavePresForm(prev => ({ ...prev, script: e.target.value }))}
                  rows={4} placeholder="Enter the narration script..."
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea value={savePresForm.notes} onChange={e => setSavePresForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2} placeholder="HITL review notes..."
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowSavePresModal(false); setEditingPresentation(null) }} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">Cancel</button>
              <button onClick={editingPresentation ? updateSavedPresentation : saveNewPresentation} disabled={!savePresForm.name.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 rounded text-sm font-medium">
                <Save size={14} className="inline mr-1" /> {editingPresentation ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

export default App
