// EmoTune - Emotion Based Music Recommender Frontend
// Main Application Logic

const API_BASE_URL = "http://127.0.0.1:8000" // Ensure this matches your running Backend URL

class EmoTuneApp {
  constructor() {
    this.currentPage = "auth"
    this.user = null
    this.token = localStorage.getItem("emotune_token") // Load token
    this.recommendations = []
    this.history = []
    this.cameraStream = null
    this.activeTab = 'camera'
    this.lastCapturedImage = null
    this.selectedEmotion = null

    // --- Global music player state ---
    this.audioPlayer = new Audio()
    this.currentTrack = null
    this.isPlaying = false
    this._bindAudioEvents()

    this.init()
  }

  // ==================== TOASTS ====================
  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container')
    if (!container) {
      container = document.createElement('div')
      container.id = 'toast-container'
      container.className = 'toast-container'
      document.body.appendChild(container)
    }
    const toast = document.createElement('div')
    toast.className = `toast toast-${type}`
    toast.textContent = message
    container.appendChild(toast)
    setTimeout(() => {
      toast.classList.add('toast-hide')
      setTimeout(() => toast.remove(), 300)
    }, 3500)
  }

  // ==================== GLOBAL MUSIC PLAYER ====================
  _bindAudioEvents() {
    this.audioPlayer.addEventListener('play', () => { this.isPlaying = true; this._syncPlayButton() })
    this.audioPlayer.addEventListener('pause', () => { this.isPlaying = false; this._syncPlayButton() })
    this.audioPlayer.addEventListener('timeupdate', () => this._syncProgress())
    this.audioPlayer.addEventListener('loadedmetadata', () => this._syncProgress())
    this.audioPlayer.addEventListener('ended', () => { this.isPlaying = false; this._syncPlayButton() })
    this.audioPlayer.addEventListener('error', () => {
      if (this.currentTrack) this.showToast('This track could not be played.', 'error')
    })
  }

  playTrack(song) {
    if (!song || !song.stream_url) {
      this.showToast('No preview available for this track.', 'error')
      return
    }
    const isSameTrack = this.currentTrack && this.currentTrack.stream_url === song.stream_url
    if (isSameTrack) {
      if (this.audioPlayer.paused) this.audioPlayer.play().catch(() => {})
      else this.audioPlayer.pause()
      return
    }
    this.currentTrack = song
    this.audioPlayer.src = song.stream_url
    this.audioPlayer.play().catch((err) => {
      console.warn('Playback failed', err)
      this.showToast('Playback failed for this track.', 'error')
    })
    this.render()
  }

  closePlayer() {
    this.audioPlayer.pause()
    this.currentTrack = null
    this.render()
  }

  _formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  _syncPlayButton() {
    const btn = document.getElementById('gp-playpause')
    if (btn) btn.textContent = this.isPlaying ? '⏸' : '▶'
    document.querySelectorAll('.mini-play').forEach((btn) => {
      const isCurrent = this.currentTrack && btn.dataset.src === this.currentTrack.stream_url
      btn.textContent = isCurrent && this.isPlaying ? '⏸' : '▶'
    })
  }

  _syncProgress() {
    const cur = document.getElementById('gp-current')
    const dur = document.getElementById('gp-duration')
    const seek = document.getElementById('gp-seek')
    if (!this.audioPlayer.duration || !isFinite(this.audioPlayer.duration)) return
    if (cur) cur.textContent = this._formatTime(this.audioPlayer.currentTime)
    if (dur) dur.textContent = this._formatTime(this.audioPlayer.duration)
    if (seek) seek.value = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100
  }

  renderGlobalPlayer() {
    if (!this.currentTrack) return ''
    const t = this.currentTrack
    return `
      <div class="global-player" id="global-player">
        <img class="gp-thumb" src="${t.image || ''}" alt="cover" onerror="this.style.visibility='hidden'">
        <div class="gp-info">
          <p class="gp-title">${t.title || t.name || 'Unknown title'}</p>
          <p class="gp-artist">${t.artist || 'Unknown artist'}</p>
        </div>
        <div class="gp-controls">
          <button id="gp-playpause" class="gp-btn" title="Play/Pause">${this.isPlaying ? '⏸' : '▶'}</button>
          <div class="gp-progress-wrap">
            <span id="gp-current" class="gp-time">0:00</span>
            <input type="range" id="gp-seek" class="gp-seek" min="0" max="100" value="0">
            <span id="gp-duration" class="gp-time">0:00</span>
          </div>
        </div>
        <button id="gp-close" class="gp-btn gp-close" title="Close player">✕</button>
      </div>
    `
  }

  init() {
    this.checkUserLogin()
    this.render()
  }

  checkUserLogin() {
    const storedUser = localStorage.getItem("emotuneUser")
    const storedToken = localStorage.getItem("emotune_token")
    
    if (storedUser && storedToken) {
      this.user = JSON.parse(storedUser)
      this.token = storedToken
      this.currentPage = "dashboard"
      this.loadHistory()
    } else {
        // If data is missing/corrupted, clear everything
        this.logout() 
    }
  }

  loadHistory() {
    const storedHistory = localStorage.getItem("emotuneHistory")
    if (storedHistory) {
      this.history = JSON.parse(storedHistory)
    }
  }

  // --- NEW: Real Login Function ---
  async login(username, password) {
    const submitBtn = document.getElementById("submit-btn")
    submitBtn.textContent = "Authenticating..."
    submitBtn.disabled = true

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        })

        if (response.ok) {
            const data = await response.json()
            // Save Token and User Info
            localStorage.setItem("emotune_token", data.access_token)
            localStorage.setItem("emotuneUser", JSON.stringify({ 
                username: data.username, 
                name: data.name 
            }))
            
            this.user = { username: data.username, name: data.name }
            this.token = data.access_token
            this.currentPage = "dashboard"
            this.render()
        } else {
            const err = await response.json()
            this.showToast("Login failed: " + (err.detail || "Invalid credentials"), "error")
        }
    } catch (error) {
        console.error("Login Error:", error)
        this.showToast("Cannot connect to server. Is the backend running?", "error")
    } finally {
        submitBtn.textContent = "Login"
        submitBtn.disabled = false
    }
  }

  // --- NEW: Real Register Function ---
  async register(username, name, password) {
    const submitBtn = document.getElementById("submit-btn")
    submitBtn.textContent = "Creating Account..."
    submitBtn.disabled = true

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, name, password })
        })

        if (response.status === 201) {
            this.showToast("Account created! Please log in.", "success")
            // Switch to login view automatically
            document.getElementById("toggle-btn").click() 
        } else {
            const err = await response.json()
            this.showToast("Registration failed: " + (err.detail || "Error creating account"), "error")
        }
    } catch (error) {
        console.error("Register Error:", error)
        this.showToast("Cannot connect to server.", "error")
    } finally {
        submitBtn.textContent = "Create Account"
        submitBtn.disabled = false
    }
  }

  logout() {
    this.user = null
    this.token = null
    this.recommendations = []
    localStorage.removeItem("emotuneUser")
    localStorage.removeItem("emotune_token")
    this.currentPage = "auth"
    this.render()
  }

  addToHistory(emotion, songs) {
    const entry = {
      id: Date.now(),
      emotion: emotion,
      timestamp: new Date().toLocaleString(),
      songs: songs,
    }
    this.history.unshift(entry)
    if (this.history.length > 20) {
      this.history.pop()
    }
    localStorage.setItem("emotuneHistory", JSON.stringify(this.history))
  }

  render() {
    const app = document.getElementById("app")

    if (this.currentPage === "auth") {
      app.innerHTML = this.renderAuth()
      this.setupAuthListeners()
    } else if (this.currentPage === "dashboard") {
      app.innerHTML = this.renderDashboard()
      this.setupDashboardListeners()
    }
  }

  renderAuth() {
    return `
        <div class="auth-container">
          <div class="auth-card">
            <div class="auth-header">
              <h1 class="emotune-logo">
                <span class="logo-icon">🎵</span> EmoTune
              </h1>
              <p class="auth-subtitle" id="auth-subtitle">Feel the Music. Emotion by Emotion.</p>
            </div>

            <form id="auth-form" class="auth-form">
              <div id="name-group" class="form-input" style="display: none;">
                <span class="input-icon">👤</span>
                <input id="name" type="text" placeholder="Full name">
              </div>

              <div class="form-input">
                <span class="input-icon">👤</span>
                <input id="username" type="text" placeholder="Username" required>
              </div>

              <div class="form-input">
                <span class="input-icon">🔒</span>
                <input id="password" type="password" placeholder="Password" required>
              </div>

              <div class="remember-row">
                <label class="remember">
                  <input type="checkbox" id="remember-me">
                  <span>Remember me</span>
                </label>
              </div>

              <button type="submit" class="btn btn-primary" id="submit-btn">Login</button>
            </form>

            <div class="auth-footer">
              <p>
                <span id="toggle-text">Don't have an account?</span>
                <button type="button" class="auth-toggle" id="toggle-btn">Register</button>
              </p>
            </div>
          </div>
        </div>
      `
  }

  renderDashboard() {
    // determine active classes and tab visibility from this.activeTab
    const tabActive = (name) => name === this.activeTab ? 'active' : ''
    const tabDisplay = (name) => name === this.activeTab ? 'block' : 'none'

    return `
            <div class="dashboard-container">
                <header class="dashboard-header">
                    <div class="header-content">
                        <h1>🎵 EmoTune - AI Music Recommender</h1>
                        <div class="user-info">
                            <span>Welcome, ${this.user.name || this.user.username}</span>
                            <button class="btn btn-small" id="logout-btn">Logout</button>
                        </div>
                    </div>
                </header>

                <nav class="dashboard-nav">
            <button class="nav-tab ${tabActive('camera')}" data-tab="camera">📷 Live Camera</button>
            <button class="nav-tab ${tabActive('upload')}" data-tab="upload">📁 Upload Image</button>
            <button class="nav-tab ${tabActive('manual')}" data-tab="manual">😊 Select Emotion</button>
            <button class="nav-tab ${tabActive('history')}" data-tab="history">📜 History</button>
                </nav>

                <main class="dashboard-content with-music-bottom">
            <div id="camera-tab" class="tab-content" style="display: ${tabDisplay('camera')};">
                        ${this.renderCameraFeature()}
                    </div>
            <div id="upload-tab" class="tab-content" style="display: ${tabDisplay('upload')};">
                        ${this.renderUploadFeature()}
                    </div>
            <div id="manual-tab" class="tab-content" style="display: ${tabDisplay('manual')};">
                        ${this.renderManualEmotionFeature()}
                    </div>
            <div id="history-tab" class="tab-content" style="display: ${tabDisplay('history')};">
                        ${this.renderHistoryFeature()}
                    </div>
                </main>

                <aside class="recommendations-sidebar" id="recommendations" style="display: ${this.recommendations.length > 0 ? "block" : "none"};">
                  <div style="display:flex; justify-content:space-between; align-items:center;margin-bottom:8px;">
                    <h2>🎵 Recommended Songs</h2>
                    <button id="close-recommendations" class="btn-small" style="background:transparent;color:var(--text-secondary);border:none;">✕</button>
                  </div>
                  <div class="recommendations-list" id="recommendations-list">
                      ${this.recommendations.map((song, idx) => `
                        <div class="recommendation-item" data-idx="${idx}">
                          <img class="song-thumb" src="${song.image || ''}" alt="cover">
                          <div class="song-info">
                            <p class="song-name">${song.name || song.title}</p>
                            <p class="song-artist">${song.artist}</p>
                                    ${song.duration ? `<small class="song-duration">${Math.floor(song.duration/60)}:${String(song.duration%60).padStart(2,'0')}</small>` : ''}
                          </div>
                          <div class="song-actions">
                            ${song.stream_url ? `<button class="mini-play" data-src="${song.stream_url}" data-idx="${idx}" data-source="recommendations">▶</button>` : ''}
                          </div>
                        </div>
                      `).join("")}
                    </div>
                </aside>
                ${this.renderGlobalPlayer()}
            </div>
        `
  }

  renderCameraFeature() {
    return `
            <div class="feature-section">
                <h2>📷 Live Camera Monitoring</h2>
                <div class="camera-container">
                    <video id="camera-video" class="camera-feed" autoplay playsinline></video>
                    <canvas id="camera-canvas" style="display: none;" width="640" height="480"></canvas>
                    <div id="captured-preview" style="display: none;">
                        <div class="captured-preview">
                            <img id="captured-img" src="" alt="Captured">
                <p class="processing" id="processing-text" style="display:none">Analyzing emotion...</p>
                        </div>
                    </div>
                    <div class="camera-controls">
                        <button class="btn btn-primary" id="start-camera-btn">Start Camera</button>
                        <button class="btn btn-secondary" id="capture-btn" disabled>Capture Photo</button>
                        <button class="btn btn-danger" id="stop-camera-btn" disabled>Stop Camera</button>
                    </div>
                </div>
            </div>
        `
  }

    renderUploadFeature() {
    // Show detected emotion and emoji if available
    const detectedEmotion = this.selectedEmotion;
    const emotionEmojis = {
      angry: "😠", happy: "😊", sad: "😢",
      neutral: "😐", surprised: "😮", fear: "😨",
    };
    const emotionHtml = detectedEmotion
      ? `<div class="selected-display" style="margin-top:10px;text-align:center;">
        <span class="selected-emoji" style="font-size:2rem;">${emotionEmojis[detectedEmotion] || ''}</span>
        <span class="selected-label" style="margin-left:8px;font-weight:600;">${detectedEmotion.charAt(0).toUpperCase() + detectedEmotion.slice(1)}</span>
       </div>`
      : '';
    return `
        <div class="feature-section">
          <h2>📁 Upload Image</h2>
          <div class="upload-container">
            <div class="upload-area">
              <input type="file" accept="image/*" id="image-upload" class="file-input">
              <label for="image-upload" class="upload-label">
                <span class="upload-icon">📤</span>
                <span>Drag and drop or click to upload</span>
              </label>
            </div>
            <div id="upload-preview" style="display: none;">
              <div class="upload-preview">
                <img id="uploaded-img" src="" alt="Uploaded">
                <p class="processing" id="processing-text">Analyzing emotion...</p>
                <div id="emotion-result">${emotionHtml}</div>
              </div>
            </div>
          </div>
        </div>
      `
    }

  renderManualEmotionFeature() {
    const emotions = ["angry", "happy", "sad", "neutral", "surprised", "fear"]
    const emotionEmojis = {
      angry: "😠", happy: "😊", sad: "😢",
      neutral: "😐", surprised: "😮", fear: "😨",
    }
    const selected = this.selectedEmotion
    const selectedHtml = selected ? `
      <div class="selected-display">
        <div class="selected-emoji">${emotionEmojis[selected]}</div>
        <div class="selected-label">${selected.charAt(0).toUpperCase() + selected.slice(1)}</div>
      </div>
      ` : `<div class="selected-placeholder">No emotion selected</div>`

    return `
        <div class="feature-section">
          <h2>😊 Select Your Emotion</h2>
          <p class="section-subtitle">Choose how you're feeling right now</p>
          <div class="selected-area">${selectedHtml}</div>
          <div class="emotion-grid">
            ${emotions.map(emotion => `
              <button class="emotion-card emotion-${emotion} ${selected === emotion ? 'selected' : ''}" data-emotion="${emotion}">
                <span class="emotion-emoji">${emotionEmojis[emotion]}</span>
                <span class="emotion-label">${emotion.charAt(0).toUpperCase() + emotion.slice(1)}</span>
              </button>
            `).join("")}
          </div>
        </div>
      `
  }

  renderHistoryFeature() {
    if (this.history.length === 0) {
      return `
                <div class="feature-section">
                    <h2>📜 Your History</h2>
                    <p class="empty-message">No history yet. Start detecting emotions!</p>
                </div>
            `
    }

    return `
            <div class="feature-section">
                <h2>📜 Your History</h2>
                <div class="history-list">
                    ${this.history.map((entry, eidx) => `
                        <div class="history-item">
                            <div class="history-header">
                                <span class="emotion-badge emotion-${entry.emotion}">
                                    ${entry.emotion.charAt(0).toUpperCase() + entry.emotion.slice(1)}
                                </span>
                                <span class="history-time">${entry.timestamp}</span>
                            </div>
                            <div class="history-songs">
                                ${entry.songs.map((song, sidx) => `
                    <div class="history-song-row" style="display:flex;align-items:center;gap:8px;">
                      ${song.stream_url ? `<button class="mini-play history-play" data-src="${song.stream_url}" data-entry-idx="${eidx}" data-song-idx="${sidx}">▶</button>` : ''}
                      <p class="history-song" style="margin:0;">🎵 ${song.name || song.title} - ${song.artist}</p>
                    </div>
                                `).join("")}
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `
  }

  setupAuthListeners() {
    const form = document.getElementById("auth-form")
    const toggleBtn = document.getElementById("toggle-btn")
    const submitBtn = document.getElementById("submit-btn")
    const nameGroup = document.getElementById("name-group")
    const nameInput = document.getElementById("name")
    const authSubtitle = document.getElementById("auth-subtitle")
    const toggleText = document.getElementById("toggle-text")
    let isLogin = true

    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault()
      isLogin = !isLogin
      if (isLogin) {
        // Switch to Login Mode
        nameGroup.style.display = "none"
        nameInput.removeAttribute("required")
        submitBtn.textContent = "Login"
        authSubtitle.textContent = "Feel the Music. Emotion by Emotion."
        toggleText.textContent = "Don't have an account?"
        toggleBtn.textContent = "Sign up"
      } else {
        // Switch to Signup Mode
        nameGroup.style.display = "flex"
        nameInput.setAttribute("required", "true")
        submitBtn.textContent = "Create Account"
        authSubtitle.textContent = "Join EmoTune Today"
        toggleText.textContent = "Already have an account?"
        toggleBtn.textContent = "Login"
      }
    })

    form.addEventListener("submit", async (e) => {
      e.preventDefault()
      
      const username = document.getElementById("username").value
      const password = document.getElementById("password").value
      const name = document.getElementById("name").value

      if (isLogin) {
        await this.login(username, password)
      } else {
        await this.register(username, name, password)
      }
    })
  }

  setupDashboardListeners() {
    // Tab switching
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const tabName = e.target.dataset.tab
        // remember active tab so re-renders keep the same view
        this.activeTab = tabName
        document.querySelectorAll(".nav-tab").forEach((t) => t.classList.remove("active"))
        e.target.classList.add("active")
        document.querySelectorAll(".tab-content").forEach((t) => (t.style.display = "none"))
        document.getElementById(tabName + "-tab").style.display = "block"
      })
    })

    // Logout button
    document.getElementById("logout-btn").addEventListener("click", () => {
      this.logout()
    })

    // Camera feature listeners (attach once)
    const startBtnEl = document.getElementById("start-camera-btn")
    const captureBtnEl = document.getElementById("capture-btn")
    const stopBtnEl = document.getElementById("stop-camera-btn")
    if (startBtnEl && !startBtnEl.dataset.listener) {
      startBtnEl.addEventListener("click", () => this.startCamera())
      startBtnEl.dataset.listener = 'true'
    }
    if (captureBtnEl && !captureBtnEl.dataset.listener) {
      captureBtnEl.addEventListener("click", () => this.capturePhoto())
      captureBtnEl.dataset.listener = 'true'
    }
    if (stopBtnEl && !stopBtnEl.dataset.listener) {
      stopBtnEl.addEventListener("click", () => this.stopCamera())
      stopBtnEl.dataset.listener = 'true'
    }

    // Image upload listeners
    if (document.getElementById("image-upload")) {
      document.getElementById("image-upload").addEventListener("change", (e) => this.handleFileUpload(e))
    }

    // Manual emotion selection listeners
    document.querySelectorAll(".emotion-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        const emotion = e.currentTarget.dataset.emotion
        // store selection and re-render so user sees the chosen emotion immediately
        this.selectedEmotion = emotion
        this.render()
        // then fetch recommendations
        this.getRecommendations(emotion)
      })
    })

    // Reattach camera stream and restore preview after render (if present)
    if (this.cameraStream) {
      const video = document.getElementById("camera-video")
      if (video) {
        try { video.srcObject = this.cameraStream } catch (e) { console.warn('Could not reattach stream', e) }
      }
      this._updateCameraControls({start:false,capture:true,stop:true})
    } else {
      this._updateCameraControls({start:true,capture:false,stop:false})
    }

    // Restore captured preview if we have one
    if (this.lastCapturedImage) {
      const imgEl = document.getElementById("captured-img")
      const previewEl = document.getElementById("captured-preview")
      if (imgEl) imgEl.src = this.lastCapturedImage
      if (previewEl) previewEl.style.display = 'block'
    }

    // Recommendation play buttons -> global player
    document.querySelectorAll('.mini-play[data-source="recommendations"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = e.currentTarget.dataset.idx
        const song = this.recommendations[idx]
        this.playTrack(song)
      })
    })

    // History play buttons -> global player
    document.querySelectorAll('.history-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const eidx = e.currentTarget.dataset.entryIdx
        const sidx = e.currentTarget.dataset.songIdx
        const song = this.history?.[eidx]?.songs?.[sidx]
        this.playTrack(song)
      })
    })

    // Global player controls
    const gpPlay = document.getElementById('gp-playpause')
    if (gpPlay) {
      gpPlay.addEventListener('click', () => {
        if (this.audioPlayer.paused) this.audioPlayer.play().catch(() => {})
        else this.audioPlayer.pause()
      })
    }
    const gpSeek = document.getElementById('gp-seek')
    if (gpSeek) {
      gpSeek.addEventListener('input', (e) => {
        if (this.audioPlayer.duration) {
          this.audioPlayer.currentTime = (e.target.value / 100) * this.audioPlayer.duration
        }
      })
    }
    const gpClose = document.getElementById('gp-close')
    if (gpClose) gpClose.addEventListener('click', () => this.closePlayer())
  }

  async startCamera() {
    // Prevent multiple concurrent start attempts
    if (this._startingCamera) return
    if (this.cameraStream) {
      // already running
      this._updateCameraControls({start:false,capture:true,stop:true})
      return
    }
    this._startingCamera = true
    try {
      // clear any leftover srcObject tracks from previous element to avoid conflicts
      const existingVideo = document.getElementById("camera-video")
      try {
        const existingStream = existingVideo && existingVideo.srcObject
        if (existingStream && typeof existingStream.getTracks === 'function') {
          existingStream.getTracks().forEach(t => { try { t.stop() } catch(e){} })
          try { existingVideo.srcObject = null } catch(e){}
        }
      } catch(e) { /* ignore */ }

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      const video = document.getElementById("camera-video")
      if (video) {
        // set muted to improve autoplay/start behavior in some browsers
        try { video.muted = true } catch(e) {}
        video.srcObject = stream
        // attempt to play (may be blocked by autoplay policies)
        try { await video.play() } catch (e) { console.warn('video.play failed', e) }
      }
      this.cameraStream = stream
      this._updateCameraControls({start:false,capture:true,stop:true})
    } catch (error) {
      console.error("Camera access denied:", error)
      this.showToast("Camera access denied. Please allow camera permissions.", "error")
      this._updateCameraControls({start:true,capture:false,stop:false})
    } finally {
      this._startingCamera = false
    }
  }

  capturePhoto() {
    const video = document.getElementById("camera-video")
    const canvas = document.getElementById("camera-canvas")
    const ctx = canvas.getContext("2d")

    // ensure video is ready (videoWidth/videoHeight may be 0 if stream is not yet settled)
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      this.showToast("Camera not ready yet. Please wait a moment and try again.", "info")
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = canvas.toDataURL("image/jpeg")

    // persist last captured image so it survives re-renders
    this.lastCapturedImage = imageData
    const imgEl = document.getElementById("captured-img")
    if (imgEl) imgEl.src = imageData
    const previewEl = document.getElementById("captured-preview")
    if (previewEl) previewEl.style.display = "block"

    // stop the live camera but keep the captured preview visible
    // ensure camera is stopped and controls updated
    this.stopCamera(true)

    // show processing indicator if available
    const procEl = document.getElementById('processing-text')
    if (procEl) {
      procEl.style.display = 'block'
      procEl.innerText = 'Analyzing emotion...'
    }

    this.sendImageForEmotionDetection(imageData)
  }

  stopCamera(keepPreview = false) {
    // Stop any active MediaStream tracks from stored stream or from the video element
    try {
      const videoEl = document.getElementById("camera-video")
      const activeStream = this.cameraStream || (videoEl && videoEl.srcObject)
      if (activeStream && typeof activeStream.getTracks === 'function') {
        activeStream.getTracks().forEach((track) => {
          try { track.stop() } catch (e) { /* ignore */ }
        })
      }
      // Pause and clear video element
      if (videoEl) {
        try { videoEl.pause() } catch (e) {}
        try { videoEl.srcObject = null } catch (e) {}
        try { videoEl.removeAttribute('src') } catch (e) {}
        try { videoEl.load() } catch (e) {}
      }
    } catch (e) { console.warn('Error stopping camera stream', e) }

    this.cameraStream = null

    // If caller doesn't want to keep the preview, clear persisted image
    if (!keepPreview) this.lastCapturedImage = null

    const previewEl = document.getElementById("captured-preview")
    if (previewEl) previewEl.style.display = keepPreview ? 'block' : 'none'

    // Ensure UI returns to initial state: show start enabled, capture/stop disabled
    this._updateCameraControls({start:true,capture:false,stop:false})
  }

  handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const imageData = event.target.result
      document.getElementById("uploaded-img").src = imageData
      document.getElementById("upload-preview").style.display = "block"
      this.sendImageForEmotionDetection(imageData)
    }
    reader.readAsDataURL(file)
  }

  async sendImageForEmotionDetection(imageData) {
    if (!this.token) {
        this.showToast("Session expired. Please log in again.", "error")
        this.logout()
        return
    }

    try {
      const base64 = (typeof imageData === 'string') ? imageData.split(',')[1] : null
      console.log('Sending image for detection, base64 length:', base64 ? base64.length : 'null')

      const response = await fetch(`${API_BASE_URL}/emotion/detect`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.token}`,
        },
        body: JSON.stringify({ image_base64: base64 }), 
      })

      if (response.status === 401) {
        this.showToast("Session expired. Please log in again.", "error")
        this.logout()
        return
      }

      // Try to parse response body for debugging
      const text = await response.text()
      let json = null
      try { json = text ? JSON.parse(text) : null } catch (e) { json = null }

      if (response.ok) {
        const data = json || {}
        // Store detected emotion for UI rendering
        this.selectedEmotion = data.emotion || null
        // Update emotion result in upload preview
        setTimeout(() => {
          const emotionResult = document.getElementById("emotion-result")
          if (emotionResult && this.selectedEmotion) {
            const emotionEmojis = {
              angry: "😠", happy: "😊", sad: "😢",
              neutral: "😐", surprised: "😮", fear: "😨",
            };
            emotionResult.innerHTML = `<span class='selected-emoji' style='font-size:2rem;'>${emotionEmojis[this.selectedEmotion] || ''}</span> <span class='selected-label' style='margin-left:8px;font-weight:600;'>${this.selectedEmotion.charAt(0).toUpperCase() + this.selectedEmotion.slice(1)}</span>`;
          }
        }, 100);
        const procEl2 = document.getElementById("processing-text")
        if (procEl2) procEl2.innerText = `Detected: ${data.emotion ? data.emotion.toUpperCase() : 'UNKNOWN'}`
        this.getRecommendations(data.emotion)
      } else {
        console.error('Emotion detect failed', response.status, text)
        const procEl3 = document.getElementById("processing-text")
        if (procEl3) procEl3.innerText = 'Detection failed'
        this.showToast("Error detecting emotion: " + (json?.detail || "Please try again."), "error")
      }
    } catch (error) {
      console.error("Error sending image:", error)
      const procEl4 = document.getElementById("processing-text")
      if (procEl4) procEl4.innerText = 'Error'
      this.showToast("Error detecting emotion. Make sure the backend is running and CORS is configured.", "error")
    }
  }

  // Internal helper: update camera control button states
  _updateCameraControls({start = true, capture = false, stop = false} = {}) {
    const startBtn = document.getElementById("start-camera-btn")
    const captureBtn = document.getElementById("capture-btn")
    const stopBtn = document.getElementById("stop-camera-btn")
    if (startBtn) startBtn.disabled = !start
    if (captureBtn) captureBtn.disabled = !capture
    if (stopBtn) stopBtn.disabled = !stop
  }

  async getRecommendations(emotion) {
    // If emotion is missing, show error and don't call music API
    if (!emotion) {
      console.warn('No emotion provided to getRecommendations')
      const procElErr = document.getElementById('processing-text')
      if (procElErr) {
        procElErr.style.display = 'block'
        procElErr.innerText = 'Could not detect emotion.'
      }
      return
    }
    try {
      const response = await fetch(`${API_BASE_URL}/music/recommend`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.token}`,
        },
        body: JSON.stringify({ 
            emotion: emotion, 
            limit: 10 
        }),
      })

      if (response.status === 401) {
        this.showToast("Session expired. Please log in again.", "error")
        this.logout()
        return
      }

      if (response.ok) {
        const data = await response.json()
        this.recommendations = data.songs || []
        this.addToHistory(emotion, this.recommendations)
        this.render()
        // Ensure captured preview remains visible after recommendations render
        if (this.lastCapturedImage) {
          const imgEl = document.getElementById('captured-img')
          const previewEl = document.getElementById('captured-preview')
          if (imgEl) imgEl.src = this.lastCapturedImage
          if (previewEl) previewEl.style.display = 'block'
        }
        // Restore detected emotion text after render so it doesn't get hidden
        const procElFinal = document.getElementById('processing-text')
        if (procElFinal) {
          procElFinal.style.display = 'block'
          procElFinal.innerText = `Detected: ${emotion.toUpperCase()}`
        }
        
        // Auto open recommendations if on mobile
        if(window.innerWidth <= 768) {
            document.getElementById("recommendations").style.display = "block"
        }

        // close recommendations button handler
        const closeBtn = document.getElementById('close-recommendations')
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            const rec = document.getElementById('recommendations')
            if (rec) rec.style.display = 'none'
            const main = document.querySelector('.dashboard-content')
            if (main) main.classList.remove('with-music-bottom')
          })
        }
      } else {
        this.showToast("Error getting recommendations.", "error")
      }
    } catch (error) {
      console.error("Error getting recommendations:", error)
      this.showToast("Error getting recommendations.", "error")
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new EmoTuneApp()
})