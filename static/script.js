(function(){
    "use strict";

    // Состояние
    let sessionId = localStorage.getItem('oge_session') || generateUUID();
    localStorage.setItem('oge_session', sessionId);
    
    let currentTask = null;
    let examMode = false;
    let timerInterval = null;
    let secondsLeft = 0;
    let answerSubmitted = false;
    let correctCount = 0;
    let answeredCount = 0;
    let currentTopic = 'all';

    // DOM
    const questionEl = document.getElementById('questionText');
    const answerInput = document.getElementById('answerInput');
    const checkBtn = document.getElementById('checkBtn');
    const nextBtn = document.getElementById('nextBtn');
    const resetBtn = document.getElementById('resetBtn');
    const feedbackEl = document.getElementById('feedbackArea');
    const taskNumberBadge = document.getElementById('taskNumberBadge');
    const timerDisplay = document.getElementById('timerDisplay');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const totalDisplay = document.getElementById('totalDisplay');
    const topicSelector = document.getElementById('topicSelector');

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    // Загрузка тем
    async function loadTopics() {
        const res = await fetch('/api/topics');
        const topics = await res.json();
        renderTopicButtons(topics);
    }

    function renderTopicButtons(topics) {
        topicSelector.innerHTML = '';
        const allBtn = document.createElement('button');
        allBtn.className = 'topic-btn active';
        allBtn.textContent = `📚 Все (${topics.reduce((s,t)=>s+t.count,0)})`;
        allBtn.dataset.topic = 'all';
        allBtn.addEventListener('click', () => selectTopic('all'));
        topicSelector.appendChild(allBtn);
        
        topics.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'topic-btn';
            btn.textContent = `${t.name} (${t.count})`;
            btn.dataset.topic = t.id;
            btn.addEventListener('click', () => selectTopic(t.id));
            topicSelector.appendChild(btn);
        });
    }

    function selectTopic(topicId) {
        currentTopic = topicId;
        document.querySelectorAll('.topic-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-topic="${topicId}"]`).classList.add('active');
        resetProgress();
        loadTask();
    }

    async function loadTask() {
        stopTimer();
        const url = `/api/task?topic=${currentTopic}`;
        const res = await fetch(url);
        currentTask = await res.json();
        
        if (currentTask.error) {
            questionEl.textContent = 'Нет заданий по выбранной теме';
            return;
        }
        
        questionEl.textContent = currentTask.text;
        taskNumberBadge.textContent = `Задание ${currentTask.task_num} · ${currentTask.topic}`;
        answerInput.value = '';
        answerInput.disabled = false;
        checkBtn.disabled = false;
        answerSubmitted = false;
        feedbackEl.textContent = '✏️ Введите ответ';
        feedbackEl.className = 'feedback';
        
        if (examMode) {
            startTimer(150);
        }
    }

    async function checkAnswer() {
        if (answerSubmitted || !currentTask) return;
        
        const userAnswer = answerInput.value;
        const res = await fetch('/api/check', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                task_id: currentTask.id,
                answer: userAnswer,
                session_id: sessionId
            })
        });
        const result = await res.json();
        
        answerSubmitted = true;
        answeredCount++;
        if (result.correct) correctCount++;
        updateStats();
        
        feedbackEl.textContent = result.correct 
            ? `✅ Верно! ${result.explanation || ''}` 
            : `❌ Ошибка. Правильный ответ: ${result.right_answer}`;
        feedbackEl.className = `feedback ${result.correct ? 'correct' : 'wrong'}`;
        
        answerInput.disabled = true;
        checkBtn.disabled = true;
        stopTimer();
    }

    function nextTask() {
        loadTask();
    }

    async function resetProgress() {
        correctCount = 0;
        answeredCount = 0;
        updateStats();
        loadTask();
    }

    function updateStats() {
        scoreDisplay.textContent = correctCount;
        totalDisplay.textContent = answeredCount;
    }

    function stopTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
    }

    function startTimer(sec) {
        stopTimer();
        secondsLeft = sec;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            secondsLeft--;
            updateTimerDisplay();
            if (secondsLeft <= 0) {
                stopTimer();
                if (!answerSubmitted) {
                    answerSubmitted = true;
                    answeredCount++;
                    updateStats();
                    feedbackEl.textContent = `⏰ Время вышло!`;
                    feedbackEl.className = 'feedback wrong';
                }
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const m = Math.floor(secondsLeft / 60);
        const s = secondsLeft % 60;
        timerDisplay.textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        timerDisplay.classList.toggle('warning', secondsLeft < 60);
        timerDisplay.classList.toggle('danger', secondsLeft < 30);
    }

    // Режимы
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            examMode = btn.dataset.mode === 'exam';
            if (!examMode) {
                stopTimer();
                timerDisplay.textContent = '--:--';
                timerDisplay.classList.remove('warning', 'danger');
            }
            resetProgress();
        });
    });

    // Обработчики
    checkBtn.addEventListener('click', checkAnswer);
    nextBtn.addEventListener('click', nextTask);
    resetBtn.addEventListener('click', resetProgress);
    answerInput.addEventListener('keypress', e => {
        if (e.key === 'Enter' && !answerSubmitted) checkAnswer();
    });

    // Старт
    loadTopics();
    loadTask();
})();
