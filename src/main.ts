import './style.css'

// Types
interface Lesson {
  id: string
  date: string
  words: string[]
  conversation: string | null
  sentence: string | null
}

// State
let lessons: Lesson[] = []
let currentLessonId: string | null = null
let isGenerating = false

// Initialize
function init() {
  // Load lessons from local storage
  const savedLessons = localStorage.getItem('german-study-lessons')
  if (savedLessons) {
    lessons = JSON.parse(savedLessons)
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
  const wordsInput = document.getElementById('words-input') as HTMLTextAreaElement
  const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement

  wordsInput?.addEventListener('input', () => {
    updateWordsPreview(wordsInput.value)
  })

  generateBtn?.addEventListener('click', () => {
    const words = wordsInput.value.trim()
    if (words) {
      createNewLesson(words)
    }
  })

  // Lesson Details View
  document.getElementById('delete-lesson-btn')?.addEventListener('click', () => {
    if (currentLessonId) {
      deleteLesson(currentLessonId)
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
  updateWordsPreview('')
  
  // Update active state in sidebar
  document.querySelectorAll('.lesson-item').forEach(el => {
    el.classList.remove('bg-accent', 'text-accent-foreground')
    el.classList.add('text-muted-foreground')
  })
}

function showLessonDetailsView(lessonId: string) {
  const lesson = lessons.find(l => l.id === lessonId)
  if (!lesson) return

  currentLessonId = lessonId
  document.getElementById('view-new-lesson')?.classList.add('hidden')
  document.getElementById('view-lesson-details')?.classList.remove('hidden')

  // Update UI
  const titleEl = document.getElementById('lesson-title')
  const dateEl = document.getElementById('lesson-date')
  const wordsDisplay = document.getElementById('lesson-words-display')
  
  if (titleEl) titleEl.textContent = `Lesson #${lessons.indexOf(lesson) + 1}`
  if (dateEl) dateEl.textContent = `Created on ${new Date(lesson.date).toLocaleDateString()}`
  
  if (wordsDisplay) {
    wordsDisplay.innerHTML = lesson.words.map(w => 
      `<div class="p-2 m-2 rounded-lg text-sm">${w}</div>`
    ).join('')
  }

  // Render content or generate if missing
  if (lesson.conversation) {
    renderConversation(lesson.conversation)
  } else {
    generateConversationForLesson(lesson)
  }

  if (lesson.sentence) {
    renderSentence(lesson.sentence)
  } else {
    generateSentenceForLesson(lesson)
  }

  // Update sidebar active state
  renderLessonsList()
}

// --- Logic ---

function updateWordsPreview(text: string) {
  const preview = document.getElementById('words-preview')!
  const lines = text.split('\n').filter(line => line.trim())
  
  if (lines.length > 0) {
    preview.innerHTML = `Words ready: <strong class="text-foreground">${lines.length}</strong>`
  } else {
    preview.innerHTML = ''
  }
}

async function createNewLesson(wordsText: string) {
  if (isGenerating) return
  
  const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement
  generateBtn.disabled = true
  generateBtn.textContent = 'Creating...'
  isGenerating = true

  const words = wordsText.split('\n').filter(line => line.trim())
  
  const newLesson: Lesson = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    words: words,
    conversation: null,
    sentence: null
  }

  lessons.unshift(newLesson) // Add to top
  saveLessons()
  renderLessonsList()
  
  // Switch to details view
  showLessonDetailsView(newLesson.id)
  
  generateBtn.disabled = false
  generateBtn.textContent = 'Generate Lesson'
  isGenerating = false
}

function deleteLesson(id: string) {
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
    // Calculate reverse index (Lesson #1 is the oldest)
    const lessonNumber = lessons.length - index
    const isActive = lesson.id === currentLessonId
    const activeClass = isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
    const previewWords = lesson.words.map(w => w.split('-')[0].trim()).join(', ')
    
    return `
      <button 
        onclick="window.dispatchEvent(new CustomEvent('select-lesson', { detail: '${lesson.id}' }))"
        class="lesson-item w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeClass}"
      >
        <div class="font-medium">Lesson #${lessonNumber}</div>
        <div class="text-xs opacity-70 truncate" title="${previewWords}">${previewWords}</div>
      </button>
    `
  }).join('')

  // Re-attach listeners (since we used innerHTML)
  // We use a custom event pattern here for simplicity with innerHTML
}

// Listen for custom selection event
window.addEventListener('select-lesson', ((e: CustomEvent) => {
  showLessonDetailsView(e.detail)
}) as EventListener)


// --- Generators ---

async function generateConversationForLesson(lesson: Lesson) {
  const container = document.getElementById('lesson-conversation-content')
  if (!container) return
  
  container.innerHTML = '<div class="flex h-[100px] items-center justify-center text-sm text-muted-foreground animate-pulse">Generating conversation...</div>'

  try {
    const response = await fetch('http://localhost:8080/api/generate-conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words: lesson.words })
    })

    if (!response.ok) throw new Error('Failed')
    const data = await response.json()
    
    // Update lesson
    lesson.conversation = data.conversation
    saveLessons()
    renderConversation(lesson.conversation!)
    
  } catch (error) {
    const mock = generateMockConversation(lesson.words)
    lesson.conversation = mock
    saveLessons()
    renderConversation(mock)
  }
}

async function generateSentenceForLesson(lesson: Lesson) {
  const container = document.getElementById('lesson-sentence-content')
  if (!container) return
  
  container.innerHTML = '<div class="flex h-[100px] items-center justify-center text-sm text-muted-foreground animate-pulse">Generating sentence...</div>'

  try {
    const response = await fetch('http://localhost:8080/api/generate-sentence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words: lesson.words })
    })

    if (!response.ok) throw new Error('Failed')
    const data = await response.json()
    
    // Update lesson
    lesson.sentence = data.sentence
    saveLessons()
    renderSentence(lesson.sentence!)
    
  } catch (error) {
    const mock = generateMockSentence(lesson.words)
    lesson.sentence = mock
    saveLessons()
    renderSentence(mock)
  }
}

function renderConversation(text: string) {
  const container = document.getElementById('lesson-conversation-content')
  if (container) {
    container.innerHTML = `<div class="space-y-3">${formatConversation(text)}</div>`
  }
}

function renderSentence(text: string) {
  const container = document.getElementById('lesson-sentence-content')
  if (container) {
    container.innerHTML = `<div class="flex flex-col items-center justify-center py-2">${formatSentence(text)}</div>`
  }
}

// --- Formatters (Reused) ---

function formatConversation(text: string): string {
  return text
    .split('\n')
    .map(line => {
      if (line.trim().startsWith('A:') || line.trim().startsWith('B:')) {
        const speaker = line.substring(0, 2)
        const content = line.substring(2)
        const isA = speaker === 'A:'
        return `
          <div class="flex gap-3 ${isA ? '' : 'flex-row-reverse'}">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isA ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} font-bold text-xs">
              ${speaker.replace(':', '')}
            </div>
            <div class="rounded-lg px-4 py-2 text-sm ${isA ? 'bg-primary/10 text-foreground' : 'bg-muted text-muted-foreground'} max-w-[80%]">
              ${content}
            </div>
          </div>
        `
      }
      return `<div class="text-sm text-muted-foreground italic text-center py-2">${line}</div>`
    })
    .join('')
}

function formatSentence(text: string): string {
  const [german, english] = text.split('|').map(s => s.trim())
  return `
    <div class="text-xl font-semibold text-foreground text-center mb-2">${german}</div>
    <div class="text-sm text-muted-foreground italic text-center">${english || ''}</div>
  `
}

function generateMockConversation(words: string[]): string {
  console.log('Generating mock conversation for words:', words);
  // const sampleWords = words.slice(0, 3).map(w => w.split('-')[0].trim()).join(', ')
  return ``;
  /* return `
    <div class="flex gap-3">
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">A</div>
      <div class="rounded-lg px-4 py-2 text-sm bg-primary/10 text-foreground max-w-[80%]">Hallo! Wie geht es dir heute?</div>
    </div>
    <div class="flex gap-3 flex-row-reverse">
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground font-bold text-xs">B</div>
      <div class="rounded-lg px-4 py-2 text-sm bg-muted text-muted-foreground max-w-[80%]">Mir geht es gut, danke! Ich übe gerade neue Wörter.</div>
    </div>
    <div class="flex gap-3">
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">A</div>
      <div class="rounded-lg px-4 py-2 text-sm bg-primary/10 text-foreground max-w-[80%]">Das ist toll! Welche Wörter lernst du?</div>
    </div>
    <div class="flex gap-3 flex-row-reverse">
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground font-bold text-xs">B</div>
      <div class="rounded-lg px-4 py-2 text-sm bg-muted text-muted-foreground max-w-[80%]">Ich lerne: ${sampleWords}</div>
    </div>
    <div class="mt-4 p-3 bg-yellow-500/10 rounded-md text-yellow-600 text-xs text-center">
      Note: Connect your backend API to get AI-generated conversations using your specific words.
    </div>
 */  
}

function generateMockSentence(words: string[]): string {
  const firstWord = words[0]?.split('-')[0].trim() || 'das Wort'
  return `
    <div class="text-xl font-semibold text-foreground text-center mb-2">Heute lerne ich ${firstWord} und benutze es jeden Tag.</div>
    <div class="text-sm text-muted-foreground italic text-center">Today I'm learning ${firstWord} and using it every day.</div>
    <div class="mt-4 p-3 bg-yellow-500/10 rounded-md text-yellow-600 text-xs text-center w-full">
      Note: Connect your backend API to get AI-generated sentences using your specific words.
    </div>
  `
}

// Start
init()
