class App {
  constructor(container, db) {
    this.opts = { 
      requiredCorrect: 4,
      maxErrors: 3,
      learningWindow: 4,
      hintDelay: 10000,
    };
    this.db = db;
    this.useDB = true;
    this.username = localStorage.username || "Anonymous";
    this.lessons = {};
    this.currentLesson = null;
    this.globalStyle = localStorage.getItem('qattType') || "-1";
    this.maxEnergy = 5; 
    this.currentEnergy = 5;
    this.parser = new VietnameseParser();
    this.renderer = new SvgGlyphRenderer({});
    this.stats = JSON.parse(localStorage.getItem('qatt_stats')) || { _score: 0 };
    this.hintInterval = null;
    this.activeQuizWord = null;
    this.lastQuizWord = null; 
    this.categories = [];
    this.bottomBar = document.getElementById("fixed-bottom-controls");
    
    container.innerHTML = `
<header class="fixed-header-container">
    <div class="container d-flex align-items-center w-100">
      <div id="library-btn" class="nav-icon-btn" title="Trang chủ">🏠</div>

      <div class="status-group">
        <div id="badge-total" class="score-badge badge-total" title="Tổng điểm">🏆 <span id="val-total">0</span></div>
        <div id="badge-sunflower" class="score-badge badge-sunflower" title="Hoa">🌻 <span id="val-sunflower">0</span></div>
        <div id="badge-coin" class="score-badge badge-coin" title="Vàng">🪙 <span id="val-coin">0</span></div>
      </div>
      
      <div class="style-selector-wrap">
        <select id="global-style-select">
          <option selected value="-1">Chính thể</option>
          <option value="1">Giản thể</option>
        </select>
      </div>
    </div>
  </header>

  <div class="container qatt-container">
    <div id="app-container"></div>
  </div>

  <div id="fixed-bottom-controls" class="fixed-bottom-bar">
    <div class="d-grid">
      <button id="main-action-btn"
        class="btn btn-info btn-lg shadow-lg fw-bold py-3"
        >
        Bắt đầu học
      </button>
    </div>
  </div>`;
    this.mainContainer = container.getElementById("app-container");
    document.getElementById("main-action-btn").addEventListener("click", this.startLessonDirectly);
    document.getElementById("library-btn").addEventListener("click", this.renderLibrary);

    this.setupStyleSelector();
    this.setupAudio();
    this.setupNavigation();
    this.updateGlobalCounters();
  }
  
  static async init(container) {
    const db = new SupabaseService();
    await db.init();
    //db.signInWithGoogle()
    const int = setInterval(() => {
    	if (db.user) {
    		clearInterval(int);
    	}
    }, 500);
  	return new App(container, db);
  }
  
  refreshCurrentView(state = null) {
    const currentState = state || history.state || { view: 'library' };
    const view = currentState.view || 'library';
    
    if (view === 'library') this.renderLibrary(true);
    else if (view === 'preview') this.renderLessonPreview(currentState.lessonId, true);
    else if (view === 'quiz') this.renderQuiz(true);
    else if (view === 'full') this.renderFullView(true);
    else if (view === 'leaderboard') this.renderLeaderboard(true);
  }

  // --- VIEWS ---
  renderLibrary(isPop = false) {
    if (!isPop) history.pushState({ view: 'library' }, '');
    this.currentLesson = null;
    this.bottomBar.style.display = "none";
    this.clearHintTimer();

    let html = "";
    
    if (this.useDB) html += `
      <div class="fade-in alert py-0 shadow">
       		<div class="text-center mb-3">
		         <div class="me-2 btn btn-sm btn-outline-warning" onclick="app.renderLeaderboard()">Bảng xếp hạng</div>
         		<button class="btn btn-sm btn-outline-light" onclick="app.renderFullView()">
           			Mục lục
         		</button>
        </div>
      	</div>
        `;

    this.categories.forEach(category => {
      html += `
        <div class="category-title">${category}</div>
        <div class="row g-3">`;

      Object.values(this.lessons)
        .filter(lesson => lesson.category === category)
        .forEach(lesson => {
          const progress = this.getLessonProgress(lesson.id);
          html += `
            <div class="col-12 lesson-${lesson.id}">
              <div class="card p-3 lesson-card" onclick="app.renderLessonPreview('${lesson.id}')">
                <div class="d-flex justify-content-between align-items-center">
                  <div class="flex-grow-1 me-3">
                    <h5 class="fw-bold mb-1">${lesson.name}</h5>
                    
                    <small class="opacity-50 mt-1 d-block">${lesson.symbols.length} chữ</small>
                  </div>
                  <div class="d-flex flex-column align-items-stretch">
                  <div id="thumb-${lesson.id}" class="lesson-thumbnail"></div>
                  <div class="progress mt-1">
                    <div class="progress-bar bg-info" role="progressbar" style="width: ${progress}%;" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></div>
                  </div>
                  </div>
                </div>
              </div>
            </div>`;
        });
      html += `
      	</div>`;
    });

    this.mainContainer.innerHTML = html + `</div>`;

    Object.values(this.lessons).forEach(lesson => { 
      const thumbElement = document.getElementById(`thumb-${lesson.id}`);
      if (thumbElement) {
        this.renderToElement(lesson.symbols[1], this.getActiveStyle(lesson), thumbElement, true); 
      }
    });

    this.updateGlobalCounters();
  }

  renderLessonPreview(lessonId, isPop = false) {
    history[isPop?'replaceState':'pushState']({ view: 'preview', lessonId: lessonId }, '');
    this.currentLesson = this.lessons[lessonId];
    this.bottomBar.style.display = "block";

    const lessonClass = `lesson-${lessonId}`;
    this.mainContainer.innerHTML = `
      <div class="fade-in ${lessonClass}">
        <button onclick="app.renderLibrary()" class="btn btn-link text-white-50 text-decoration-none mb-2 p-0">
          ← Quay lại
        </button>
        <div class="card p-4 preview-container">
          <div class="mb-4">
            <h3 class="fw-bold">${this.currentLesson.name}</h3>
            <div class="progress">
              <div class="progress-bar bg-info"></div>
            </div>
          </div>
          <div class="row g-3" id="words-grid"></div>
        </div>
      </div>`;

    this.renderStatus(document.querySelector(".preview-container"));
    
    const activeStyle = this.getActiveStyle(this.currentLesson);
    const gridElement = document.getElementById("words-grid");

    this.currentLesson.symbols.forEach(word => {
        const column = document.createElement("div"); 
        column.className = "col-6 col-sm-4";
        
        const card = document.createElement("div"); 
        card.className = "word-grid-item";
        
        if (this.stats[word].c >= 3) {
          card.style.borderColor = "rgba(74, 222, 128, 0.4)";
        }

        this.renderToElement(word, activeStyle, card);
        card.innerHTML += this.getProgressEmoji(word, false, 'grid');
        gridElement.appendChild(column).appendChild(card);
    });
  }


  renderQuiz(isPop = false, keepWord = false) {
    if (this.currentEnergy <= 0) {
      this.mainContainer.innerHTML = `
        <div class="card p-5 text-center">
          <h2>Hết năng lượng!</h2>
          <button class="btn btn-primary mt-3" onclick="app.startLessonDirectly()"> Thử lại </button>
        </div>`;
      return;
    }
    if (!this.currentLesson) return;
    let unfinishedSymbols = this.currentLesson.symbols.filter(symbol => this.stats[symbol].c < this.opts.requiredCorrect);
    if (unfinishedSymbols.length === 0) {
      if ((this.currentLesson.practiceModeItems||[]).length == 0) {
        this.renderLessonPreview(this.currentLesson.id, true);
        return;
      }
      else unfinishedSymbols = this.currentLesson.practiceModeItems;
    }

    if (!isPop) history.pushState({ view: 'quiz' }, '');
    this.bottomBar.style.display = "none";
    
    if (!keepWord) {
      const poolLimit = Math.min(unfinishedSymbols.length, this.opts.learningWindow);
      let selectedWord;
      
      if (unfinishedSymbols.length > 1) {
        let tries = 0;
        do {
          tries++;
          selectedWord = unfinishedSymbols[Math.floor(Math.random() * poolLimit)];
        } while (tries < 20 && selectedWord === this.lastQuizWord);
      } else {
        selectedWord = unfinishedSymbols[0];
      }
      
      this.activeQuizWord = selectedWord;
      this.lastQuizWord = selectedWord;
	}
	  
    const correctWord = this.activeQuizWord;
    const showSvgAsQuestion = Math.random() < 0.5;
    const activeStyle = this.getActiveStyle(this.currentLesson);
    const lessonClass = `lesson-${this.currentLesson.id}`;

    this.mainContainer.innerHTML = `
      <div class="fade-in ${lessonClass}">
        <button onclick="app.renderLibrary()" class="btn btn-link text-white-50 text-decoration-none mb-2 p-0">
          ← Quay lại
        </button>
        <div class="card p-4 quiz-container overflow-hidden">
          <div class="d-flex justify-content-between mb-1">
            <h5 class="fw-bold opacity-50">${this.currentLesson.name}</h5>
            
            <div class="energy-display d-flex align-items-center"></div>
          </div>
          <div class="progress mb-4">
            <div class="progress-bar bg-info"></div>
          </div>
          <div class="symbol-card mb-4" id="q-box">
            <button class="reload-quiz-btn" onclick="app.renderQuiz(true)">↻</button>
            <div id="emoji-c">${this.getProgressEmoji(correctWord, false, 'quiz')}</div>
            <div id="feedback" class="feedback-area"></div>
          </div>
          <div class="options" id="opts"></div>
        </div>
      </div>`;

    this.renderStatus(document.querySelector(".quiz-container"));
    
    const questionBox = document.getElementById("q-box");
    const questionWrapper = document.createElement("div");

    if (showSvgAsQuestion) {
      this.renderToElement(correctWord, activeStyle, questionWrapper, false, false); 
    } else {
      questionWrapper.innerHTML = `<h1 class="display-1 fw-bold">${correctWord}</h1>`; 
    }

    questionBox.prepend(questionWrapper);
    this.renderOptions(correctWord, showSvgAsQuestion, activeStyle);
    this.startHintTimer(correctWord);
  }

  renderOptions(correctWord, questionWasSvg, activeStyle) {
    const optionsContainer = document.getElementById("opts");
    
    let unfinishedSymbols = this.currentLesson.symbols.filter(s => this.stats[s].c < 3);
    (this.currentLesson.practiceModeItems||[]).forEach(itm => {
        if (unfinishedSymbols.length < this.opts.learningWindow && itm != correctWord) unfinishedSymbols.push(itm);
    });
    const windowPool = unfinishedSymbols.slice(0, this.opts.learningWindow);
    
    const windowDistractors = windowPool
      .filter(s => s !== correctWord)
      .sort(() => 0.5 - Math.random())
      .slice(0, 2);
    
    const fullPool = this.currentLesson.symbols
      .filter(s => s !== correctWord && !windowDistractors.includes(s))
      .sort(() => 0.5 - Math.random());
    
    const globalDistractor = fullPool.length > 0 ? [fullPool[0]] : [];
    
    let selectedOptions = [correctWord, ...windowDistractors, ...globalDistractor];
    if (selectedOptions.length < 4) {
      const remaining = this.currentLesson.symbols
        .filter(s => !selectedOptions.includes(s))
        .sort(() => 0.5 - Math.random());
      selectedOptions = [...selectedOptions, ...remaining.slice(0, 4 - selectedOptions.length)];
    }

    selectedOptions.sort(() => 0.5 - Math.random());

    selectedOptions.forEach(option => {
      const button = document.createElement("button"); 
      button.className = "btn"; 
      button.dataset.word = option;
      
      const wrapper = document.createElement("div");
      if (questionWasSvg) {
        wrapper.textContent = option; 
      } else {
        this.renderToElement(option, activeStyle, wrapper, true, false);
      }
      
      button.appendChild(wrapper);
      button.onclick = () => {
        this.clearHintTimer(); 
        const isCorrect = option === correctWord; 
        this.playTone(isCorrect ? 'success' : 'error');
        let isMilestone = false;
        
        if ((this.currentLesson.practiceModeItems||[]).includes(correctWord)){
          // Remove from list of words to test
          if (isCorrect || Math.random() < .5) {
            this.currentLesson.practiceModeItems = this.currentLesson.practiceModeItems.filter(itm => itm != correctWord);
          }
        }

		const animations = {};
        if (isCorrect) {
            const prevCorrectCount = this.stats[correctWord].c || 0; 
            this.stats[correctWord].c++;
			animations.total = true;
            if (prevCorrectCount === 0) { 
			  animations.drop = true;
              this.stats._score += 10; 
            }
			else if (prevCorrectCount === 1) {
			  animations.seedling = true;
              this.stats._score += 15;
			}
			else if (prevCorrectCount === 2) { 
			  animations.plant = true;
              this.stats._score += 25;
			}
            else if (prevCorrectCount === 3) { 
			  animations.sunflower = true;
              this.stats._score += 200; 
              isMilestone = true;
              if (this.currentEnergy < 5) this.currentEnergy++; 
            } else if (prevCorrectCount < 10) {
			  animations.coin = true;
              this.stats._score += 20;
            }
			else {
			  animations.gem = true;
			  this.stats._score += 20;
			}
            this.syncScore();
            document.getElementById("emoji-c").innerHTML = this.getProgressEmoji(correctWord, true, 'quiz');
        } else { 
            this.stats[correctWord].w++; 
            this.stats._score = Math.max(0, this.stats._score - 1); 
            this.currentEnergy--; 
            this.triggerHeartLossAnimation(); 
        }

        localStorage.setItem('qatt_stats', JSON.stringify(this.stats)); 
        this.renderStatus(document.querySelector(".quiz-container"), animations);
        
        document.querySelectorAll("#opts .btn").forEach(btn => { 
          btn.disabled = true; 
          if (btn.dataset.word === correctWord) {
            btn.style.backgroundColor = "#82e99e";
            btn.style.borderColor = "#4ade80";
          } else if (btn.dataset.word === option) {
            btn.style.backgroundColor = "#ff8e8e";
            btn.style.borderColor = "#f87171";
          }
        });

        const feedbackArea = document.getElementById("feedback"); 
        let feedbackHtml = `<h2 class="fw-bold" style="color:${isCorrect ? '#82e99e' : '#ff8e8e'}">
            ${isCorrect ? 'Đúng! ✨' : 'Sai 😅'}
          </h2>`;
        
        if (isMilestone) {
          feedbackHtml += `<div class="plus-one-heart">+1 ❤️</div>`;
        }

        feedbackArea.innerHTML = feedbackHtml;
        feedbackArea.classList.add("float-up-fade");
        
        setTimeout(() => this.renderQuiz(true), isMilestone ? 1800 : 1200);
      };
      optionsContainer.appendChild(button);
    });
      }
