import './style.css'

// Types
interface Lesson {
  id: number
  date: string
  title: string
  sentences: string[]
}

// State
let lessons: Lesson[] = []
let currentLessonId: number | null = null

// Initialize
function init() {
  // Load lessons from local storage
  const savedLessons = localStorage.getItem('german-study-lessons')
  if (savedLessons) {
    try {
      lessons = JSON.parse(savedLessons)
      // Migration/Cleanup for old ID format if necessary
      if (lessons.length > 0 && typeof lessons[0].id === 'string') {
        lessons = []
        localStorage.removeItem('german-study-lessons')
      }

      // Migration for missing titles
      let migrated = false
      lessons.forEach((l, idx) => {
        if (!l.title) {
          l.title = `Lesson #${lessons.length - idx}`
          migrated = true
        }
      })
      if (migrated) saveLessons()
    } catch (e) {
      lessons = []
    }
    renderLessonsList()
  }

  setupEventListeners()
  
  // Show new lesson view by default
  showNewLessonView()
}

function setupEventListeners() {
  // Navigation
  document.getElementById('new-lesson-btn')?.addEventListener('click', showNewLessonView)

  // New Lesson View
  const textarea = document.getElementById('words-input') as HTMLTextAreaElement
  const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement

  textarea?.addEventListener('input', () => {
    const lines = textarea.value.split('\n').filter(line => line.trim())
    const preview = document.getElementById('words-preview')!
    if (lines.length > 0) {
      preview.innerHTML = `Sentences ready: <strong class="text-foreground">${lines.length}</strong>`
    } else {
      preview.innerHTML = ''
    }
  })

  generateBtn?.addEventListener('click', () => {
    const text = textarea.value.trim()
    if (text) {
      createNewLesson(text)
    }
  })

  // Lesson Details View
  document.getElementById('delete-lesson-btn')?.addEventListener('click', () => {
    if (currentLessonId !== null) {
      deleteLesson(currentLessonId)
    }
  })

  const lessonTitle = document.getElementById('lesson-title')
  lessonTitle?.addEventListener('blur', () => {
    if (currentLessonId !== null && lessonTitle) {
      updateLessonTitle(currentLessonId, lessonTitle.innerText)
    }
  })

  lessonTitle?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      lessonTitle.blur()
    }
  })

  // Event delegation for sentence editing and deleting
  const display = document.getElementById('lesson-words-display')
  display?.addEventListener('blur', (e) => {
    const target = e.target as HTMLElement
    if (target.classList.contains('sentence-edit')) {
      const index = parseInt(target.getAttribute('data-index') || '0')
      updateSentence(index, target.innerText)
    }
  }, true)

  display?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const deleteBtn = target.closest('.delete-sentence-btn')
    if (deleteBtn) {
      const index = parseInt(deleteBtn.getAttribute('data-index') || '0')
      deleteSentence(index)
    }

    const addBtn = target.closest('#add-sentence-btn')
    if (addBtn) {
      addSentenceToCurrentLesson()
    }
  })
}

// --- Views ---

function showNewLessonView() {
  currentLessonId = null
  document.getElementById('view-new-lesson')?.classList.remove('hidden')
  document.getElementById('view-lesson-details')?.classList.add('hidden')
  
  // Reset input
  const input = document.getElementById('words-input') as HTMLTextAreaElement
  if (input) input.value = ''
  const preview = document.getElementById('words-preview')
  if (preview) preview.innerHTML = ''
  
  // Update active state in sidebar
  document.querySelectorAll('.lesson-item').forEach(el => {
    el.classList.remove('bg-accent', 'text-accent-foreground')
    el.classList.add('text-muted-foreground')
  })
}

function showLessonDetailsView(lessonId: number) {
  const lesson = lessons.find(l => l.id === lessonId)
  if (!lesson) return

  currentLessonId = lessonId
  document.getElementById('view-new-lesson')?.classList.add('hidden')
  document.getElementById('view-lesson-details')?.classList.remove('hidden')

  // Update UI
  const titleEl = document.getElementById('lesson-title')
  const dateEl = document.getElementById('lesson-date')
  const display = document.getElementById('lesson-words-display')
  
  if (titleEl) titleEl.textContent = lesson.title
  if (dateEl) dateEl.textContent = `Created on ${new Date(lesson.date).toLocaleDateString()}`
  
  if (display) {
    display.innerHTML = lesson.sentences.map((s, idx) => 
      `<div class="relative group mb-2">
        <div 
          contenteditable="true" 
          data-index="${idx}"
          class="sentence-edit p-3 pr-10 rounded-lg bg-muted/50 text-sm border border-border/50 focus:outline-none focus:ring-1 focus:ring-ring"
        >${s}</div>
        <button 
          data-index="${idx}"
          class="delete-sentence-btn absolute right-1 top-1.5 opacity-0 hover:opacity-100 p-2 text-muted-foreground hover:text-destructive transition-opacity"
          title="Delete sentence"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="14" y1="11" y2="17"/><line x1="14" x2="10" y1="11" y2="17"/></svg>
        </button>
      </div>`
    ).join('')

    // Add "Add Sentence" button
    const addBtn = document.createElement('button')
    addBtn.id = 'add-sentence-btn'
    addBtn.className = 'mt-2 inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-border/50 bg-muted/50 hover:bg-muted/80 text-muted-foreground hover:text-foreground h-11 px-4 py-2 w-full'
    addBtn.innerHTML = `
      <svg class="mr-2" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
      Add More
    `
    display.appendChild(addBtn)
  }

  // Update sidebar active state
  renderLessonsList()
}

// --- Logic ---

function updateLessonTitle(id: number, title: string) {
  const lesson = lessons.find(l => l.id === id)
  if (lesson) {
    // Strip newlines and trim
    lesson.title = title.replace(/[\r\n]+/gm, " ").trim() || `Lesson #${lessons.length - lessons.indexOf(lesson)}`
    saveLessons()
    renderLessonsList()
  }
}

function updateSentence(index: number, value: string) {
  if (currentLessonId === null) return
  const lesson = lessons.find(l => l.id === currentLessonId)
  if (lesson) {
    lesson.sentences[index] = value.trim()
    saveLessons()
    renderLessonsList() // Update sidebar preview
  }
}

function deleteSentence(index: number) {
  if (currentLessonId === null) return
  const lesson = lessons.find(l => l.id === currentLessonId)
  if (lesson) {
    lesson.sentences.splice(index, 1)
    saveLessons()
    showLessonDetailsView(currentLessonId)
  }
}

function addSentenceToCurrentLesson() {
  if (currentLessonId === null) return
  const lesson = lessons.find(l => l.id === currentLessonId)
  if (lesson) {
    lesson.sentences.push('New sentence')
    saveLessons()
    showLessonDetailsView(currentLessonId)
    
    // Focus the new sentence
    const display = document.getElementById('lesson-words-display')
    if (display) {
      const edits = display.querySelectorAll('.sentence-edit')
      const lastEdit = edits[edits.length - 1] as HTMLDivElement
      if (lastEdit) {
        lastEdit.focus()
        const range = document.createRange()
        range.selectNodeContents(lastEdit)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }
  }
}

function createNewLesson(text: string) {
  const sentences = text.split('\n').filter(line => line.trim())
  
  const newLesson: Lesson = {
    id: Date.now(),
    date: new Date().toISOString(),
    title: `Lesson #${lessons.length + 1}`,
    sentences: sentences
  }

  lessons.unshift(newLesson)
  saveLessons()
  renderLessonsList()
  showLessonDetailsView(newLesson.id)
}

function deleteLesson(id: number) {
  if (!confirm('Are you sure you want to delete this lesson?')) return
  
  lessons = lessons.filter(l => l.id !== id)
  saveLessons()
  renderLessonsList()
  showNewLessonView()
}

function saveLessons() {
  localStorage.setItem('german-study-lessons', JSON.stringify(lessons))
}

function renderLessonsList() {
  const list = document.getElementById('lessons-list')
  if (!list) return

  if (lessons.length === 0) {
    list.innerHTML = '<div class="text-xs text-muted-foreground p-2 italic">No lessons yet</div>'
    return
  }

  list.innerHTML = lessons.map((lesson, index) => {
    const isActive = lesson.id === currentLessonId
    const activeClass = isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
    const preview = lesson.sentences[0] || 'Empty'
    
    // Ensure title exists for older lessons if any
    const title = lesson.title || `Lesson #${lessons.length - index}`

    return `
      <button 
        data-id="${lesson.id}"
        class="lesson-item w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeClass}"
      >
        <div class="font-medium truncate">${title}</div>
        <div class="text-xs opacity-70 truncate">${preview}</div>
      </button>
    `
  }).join('')

  // Add click listeners to buttons
  list.querySelectorAll('.lesson-item').forEach(button => {
    button.addEventListener('click', () => {
      const id = parseInt(button.getAttribute('data-id') || '0')
      showLessonDetailsView(id)
    })
  })
}

// Start
init()
