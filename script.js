// Get DOM elements
const balanceDisplay = document.getElementById('balance');
const statusDisplay = document.getElementById('status');
const multiplierDisplay = document.getElementById('multiplier');
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const betAmountInput = document.getElementById('betAmount');
const autoCashOutInput = document.getElementById('autoCashOut');
const placeBetBtn = document.getElementById('placeBetBtn');
const cashOutBtn = document.getElementById('cashOutBtn');
const messageBox = document.getElementById('messageBox');
const betHistoryList = document.getElementById('betHistoryList');
const crashHistoryList = document.getElementById('crashHistoryList');

// --- Bet Section Styling ---
betAmountInput.classList.add(
    'rounded-lg', 'p-2', 'border', 'border-gray-400', 'bg-gray-800', 'text-white',
    'focus:outline-none', 'focus:ring-2', 'focus:ring-blue-400', 'mb-2'
);
autoCashOutInput.classList.add(
    'rounded-lg', 'p-2', 'border', 'border-gray-400', 'bg-gray-800', 'text-white',
    'focus:outline-none', 'focus:ring-2', 'focus:ring-blue-400', 'mb-2'
);
// Center the Place Bet and Cash Out buttons
placeBetBtn.classList.add('mx-auto', 'block', 'my-2');
cashOutBtn.classList.add('mx-auto', 'block', 'my-2');


function getMultiplier(elapsed) {
    const speed = 0.08;
    return Math.pow(elapsed * speed + 1, 2);
}

// Game variables
let balance = 1000.00;
let currentBet = 0;
let autoCashOut = 0;
let gameActive = false;
let currentMultiplier = 1.00;
let crashPoint = 0;
let hasBet = false;
let hasCashedOut = false;
let animationFrameId;
let gameStartTime;
let betHistory = [];
let crashHistory = [];
let cashedOutMultiplier = null;

// For auto rounds
let countdown = 0;
let countdownInterval = null;
const ROUND_WAIT_TIME = 5; // seconds before each round

// Auto bet variables
let autoBetRounds = 0;
let autoBetRoundsLeft = 0;
let autoBetAmount = 0;
let autoBetAutoCashOut = 2.00; // Default for auto bet

// --- Auto Bet UI ---
const autoBetRoundsInput = document.getElementById('autoBetRoundsInput');
const autoBetAmountInput = document.getElementById('autoBetAmountInput');
const autoBetAutoCashOutInput = document.getElementById('autoBetAutoCashOutInput');
const autoBetBtn = document.getElementById('autoBetBtn');
const stopAutoBetBtn = document.getElementById('stopAutoBetBtn');
const autoBetStatus = document.getElementById('autoBetStatus');

// --- Auto Bet Logic ---
autoBetBtn.addEventListener('click', () => {
    const rounds = parseInt(autoBetRoundsInput.value, 10);
    const amount = parseFloat(autoBetAmountInput.value);
    const autoCO = parseFloat(autoBetAutoCashOutInput.value);

    if (isNaN(rounds) || rounds < 1) {
        showMessage('Enter a valid number of rounds for auto bet.', 'error');
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        showMessage('Enter a valid bet amount for auto bet.', 'error');
        return;
    }
    if (amount > balance) {
        showMessage('Insufficient balance for auto bet.', 'error');
        return;
    }
    if (isNaN(autoCO) || autoCO < 1.01) {
        showMessage('Enter a valid Auto Cash Out (min 1.01x) for auto bet.', 'error');
        return;
    }
    autoBetRounds = rounds;
    autoBetRoundsLeft = rounds;
    autoBetAmount = amount;
    autoBetAutoCashOut = autoCO;
    autoBetBtn.disabled = true;
    stopAutoBetBtn.disabled = false;
    autoBetRoundsInput.disabled = true;
    autoBetAmountInput.disabled = true;
    autoBetAutoCashOutInput.disabled = true;
    autoBetStatus.textContent = `Auto betting: ${autoBetRoundsLeft} rounds left`;
    showMessage(`Auto bet started for ${autoBetRounds} rounds at $${autoBetAmount.toFixed(2)} per round.`, 'success');
});

stopAutoBetBtn.addEventListener('click', () => {
    autoBetRoundsLeft = 0;
    autoBetBtn.disabled = false;
    stopAutoBetBtn.disabled = true;
    autoBetRoundsInput.disabled = false;
    autoBetAmountInput.disabled = false;
    autoBetAutoCashOutInput.disabled = false;
    autoBetStatus.textContent = '';
    showMessage('Auto bet stopped.', 'info');
});

// --- End Auto Bet UI ---

// Canvas drawing parameters
const CANVAS_WIDTH = gameCanvas.width;
const CANVAS_HEIGHT = gameCanvas.height;
const PADDING = 20;
const MAX_X_DISPLAY = 10;
const MAX_Y_DISPLAY = 10;

function updateBalanceDisplay() {
    balanceDisplay.textContent = balance.toFixed(2);
}

// --- Animations for win/loss ---
function showMessage(message, type = 'info') {
    messageBox.textContent = message;
    messageBox.classList.remove('hidden', 'animate-win', 'animate-loss');
    if (type === 'error') {
        messageBox.style.backgroundColor = '#e53e3e';
        messageBox.classList.add('animate-loss');
    } else if (type === 'success') {
        messageBox.style.backgroundColor = '#48bb78';
        messageBox.classList.add('animate-win');
    } else {
        messageBox.style.backgroundColor = '#2d3748';
    }
    setTimeout(() => {
        messageBox.classList.add('hidden');
        messageBox.style.backgroundColor = '';
        messageBox.classList.remove('animate-win', 'animate-loss');
    }, 3000);
}

// Animate canvas for win/loss
function animateCanvasFlash(color) {
    const original = gameCanvas.style.boxShadow;
    gameCanvas.style.boxShadow = `0 0 40px 10px ${color}`;
    setTimeout(() => {
        gameCanvas.style.boxShadow = original;
    }, 600);
}

function renderBetHistory() {
    betHistoryList.innerHTML = '';
    if (betHistory.length === 0) {
        betHistoryList.innerHTML = '<div class="text-center text-sm text-gray-400">No recent bets.</div>';
    } else {
        const displayHistory = betHistory.slice(-10).reverse();
        displayHistory.forEach(record => {
            const item = document.createElement('div');
            item.classList.add('bet-history-item');
            let outcomeText = '';
            let outcomeClass = '';
            if (record.outcome === 'win') {
                outcomeText = `+ $${record.winnings.toFixed(2)}`;
                outcomeClass = 'outcome-win';
            } else {
                outcomeText = `- $${record.betAmount.toFixed(2)}`;
                outcomeClass = 'outcome-loss';
            }
            item.innerHTML = `
                <span>Bet: $${record.betAmount.toFixed(2)}</span>
                <span>Crashed: ${record.crashPoint.toFixed(2)}x</span>
                <span>${record.cashedOutAt ? `Cashed Out: ${record.cashedOutAt.toFixed(2)}x` : 'Lost'}</span>
                <span class="${outcomeClass}">${outcomeText}</span>
            `;
            betHistoryList.appendChild(item);
        });
    }

    // Render crash history horizontally
    if (crashHistoryList) {
        crashHistoryList.innerHTML = '';
        if (crashHistory.length === 0) {
            crashHistoryList.innerHTML = '<div class="text-center text-sm text-gray-400">No crash history.</div>';
        } else {
            const displayCrashes = crashHistory.slice(-20).reverse();
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.flexWrap = 'wrap';
            row.style.gap = '0.5rem';
            row.style.justifyContent = 'center';
            displayCrashes.forEach(point => {
                const item = document.createElement('div');
                item.classList.add('text-center', 'text-sm', 'py-0.5');
                item.textContent = `${point.toFixed(2)}x`;
                item.style.background = '#232b3a';
                item.style.borderRadius = '0.375rem';
                item.style.padding = '0.25rem 0.5rem';
                item.style.minWidth = '2.5rem';
                row.appendChild(item);
            });
            crashHistoryList.appendChild(row);
        }
    }
}

function initializeGame() {
    balance = 1000.00;
    currentBet = 0;
    gameActive = false;
    currentMultiplier = 1.00;
    hasBet = false;
    hasCashedOut = false;
    betHistory = [];
    crashHistory = [];
    cashedOutMultiplier = null;
    updateBalanceDisplay();
    statusDisplay.textContent = 'Waiting for next round...';
    multiplierDisplay.textContent = '1.00x';
    placeBetBtn.disabled = false;
    cashOutBtn.disabled = true;
    betAmountInput.disabled = false;
    autoCashOutInput.disabled = false;
    drawGraph();
    renderBetHistory();
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    startCountdown();
}

function drawGraph() {
    const canvasFontSize = Math.max(10, Math.min(16, Math.floor(gameCanvas.height * 0.05)));
    ctx.font = `${canvasFontSize}px Inter`;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const timeElapsed = gameActive ? (performance.now() - gameStartTime) / 1000 : 0;
    const displayMaxX = timeElapsed + 1;
    const displayMaxY = currentMultiplier + 1;

    // Draw dynamic X (time) axis
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING, CANVAS_HEIGHT - PADDING);
    ctx.lineTo(CANVAS_WIDTH - PADDING, CANVAS_HEIGHT - PADDING);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a0aec0';
    for (let i = 0; i <= displayMaxX; i += 2) {
        const x = PADDING + (i / displayMaxX) * (CANVAS_WIDTH - 2 * PADDING);
        ctx.fillText(i.toString() + 's', x, CANVAS_HEIGHT - 5);
    }

    // Draw dynamic Y (multiplier) axis
    ctx.beginPath();
    ctx.moveTo(PADDING, CANVAS_HEIGHT - PADDING);
    ctx.lineTo(PADDING, PADDING);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#a0aec0';
    for (let i = 1; i <= displayMaxY; i++) {
        const y = CANVAS_HEIGHT - PADDING - (i / displayMaxY) * (CANVAS_HEIGHT - 2 * PADDING);
        ctx.fillText(i.toFixed(0) + 'x', PADDING - 5, y + 4);
    }


    
    ctx.textAlign = 'center';
    for (let i = 0; i <= displayMaxX; i += 2) {
        const x = PADDING + (i / displayMaxX) * (CANVAS_WIDTH - 2 * PADDING);
        
    }

    ctx.textAlign = 'right';
    for (let i = 1; i <= displayMaxY; i++) {
        const y = CANVAS_HEIGHT - PADDING - (i / displayMaxY) * (CANVAS_HEIGHT - 2 * PADDING);
        
    }

    // Game Curve
    ctx.strokeStyle = '#63b3ed';
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (let t = 0; t <= timeElapsed + 0.1; t += 0.05) {
        const m = getMultiplier(t);
        if (m > crashPoint && crashPoint !== 0) break;

        const x = PADDING + (t / displayMaxX) * (CANVAS_WIDTH - 2 * PADDING);
        const y = CANVAS_HEIGHT - PADDING - (m / displayMaxY) * (CANVAS_HEIGHT - 2 * PADDING);
        if (t === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();

    // Crash Point Indicator
    if (!gameActive && crashPoint > 1) {
        const crashTime = (Math.sqrt(crashPoint) - 1) / 0.08;
        const x = PADDING + (crashTime / displayMaxX) * (CANVAS_WIDTH - 2 * PADDING);
        const y = CANVAS_HEIGHT - PADDING - (crashPoint / displayMaxY) * (CANVAS_HEIGHT - 2 * PADDING);

        ctx.fillStyle = '#e53e3e';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#e53e3e';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, CANVAS_HEIGHT - PADDING);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(PADDING, y);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function gameLoop(timestamp) {
    if (!gameStartTime) {
        gameStartTime = timestamp;
    }
    const elapsed = (timestamp - gameStartTime) / 1000;
    currentMultiplier = getMultiplier(elapsed);

    if (currentMultiplier >= crashPoint) {
        currentMultiplier = crashPoint;
        endRound();
        return;
    }

    let displayText = `${currentMultiplier.toFixed(2)}x`;
    if (hasBet && !hasCashedOut) {
        const potentialCashOut = currentBet * currentMultiplier;
        displayText += ` ($${potentialCashOut.toFixed(2)})`;
    }
    multiplierDisplay.textContent = displayText;
    drawGraph();

    if (hasBet && !hasCashedOut && autoCashOut > 1.00 && currentMultiplier >= autoCashOut) {
        cashOut();
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

function startCountdown() {
    countdown = ROUND_WAIT_TIME;
    statusDisplay.textContent = `Next round in ${countdown}... Place your bet!`;
    multiplierDisplay.textContent = '1.00x';
    placeBetBtn.disabled = false;
    betAmountInput.disabled = false;
    autoCashOutInput.disabled = false;
    cashOutBtn.disabled = true;
    drawGraph();

    // Auto bet logic: place bet at start of countdown if needed
    if (autoBetRoundsLeft > 0 && !hasBet) {
        if (autoBetAmount > balance) {
            showMessage('Auto bet stopped: insufficient balance.', 'error');
            autoBetRoundsLeft = 0;
            autoBetBtn.disabled = false;
            stopAutoBetBtn.disabled = true;
            autoBetRoundsInput.disabled = false;
            autoBetAmountInput.disabled = false;
            autoBetAutoCashOutInput.disabled = false;
            autoBetStatus.textContent = '';
        } else {
            currentBet = autoBetAmount;
            // Use the independent auto cash out for auto bet
            autoCashOut = autoBetAutoCashOut;
            balance -= currentBet;
            hasBet = true;
            updateBalanceDisplay();
            placeBetBtn.disabled = true;
            cashOutBtn.disabled = false;
            betAmountInput.disabled = true;
            autoCashOutInput.disabled = true;
            statusDisplay.textContent = 'Auto bet placed! Waiting for game to start...';
            showMessage(`Auto bet placed: $${currentBet.toFixed(2)} at Auto Cash Out: ${autoCashOut.toFixed(2)}x`, 'success');
            autoBetRoundsLeft--;
            autoBetStatus.textContent = `Auto betting: ${autoBetRoundsLeft} rounds left`;
            if (autoBetRoundsLeft === 0) {
                autoBetBtn.disabled = false;
                stopAutoBetBtn.disabled = true;
                autoBetRoundsInput.disabled = false;
                autoBetAmountInput.disabled = false;
                autoBetAutoCashOutInput.disabled = false;
                autoBetStatus.textContent = '';
            }
        }
    }

    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            statusDisplay.textContent = `Next round in ${countdown}... Place your bet!`;
        } else {
            clearInterval(countdownInterval);
            startRound();
        }
    }, 1000);
}

function startRound() {
    gameActive = true;
    hasCashedOut = false;
    cashedOutMultiplier = null;
    currentMultiplier = 1.00;
    crashPoint = Math.max(1.01, Math.pow(Math.random(), 2) * 10 + 1);
    crashPoint = parseFloat(crashPoint.toFixed(2));

    statusDisplay.textContent = 'Game in progress...';
    multiplierDisplay.textContent = '1.00x';
    placeBetBtn.disabled = true;
    cashOutBtn.disabled = !hasBet ? true : false;
    betAmountInput.disabled = true;
    autoCashOutInput.disabled = true;

    gameStartTime = null;
    animationFrameId = requestAnimationFrame(gameLoop);
}

function endRound() {
    gameActive = false;
    cancelAnimationFrame(animationFrameId);

    let outcome = 'loss';
    let winnings = 0;
    let cashedOutAt = null;

    if (!hasCashedOut && hasBet) {
        statusDisplay.textContent = `CRASHED at ${crashPoint.toFixed(2)}x! You lost.`;
        showMessage(`Game crashed at ${crashPoint.toFixed(2)}x. You lost $${currentBet.toFixed(2)}.`, 'error');
        animateCanvasFlash('#e53e3e');
        outcome = 'loss';
    } else if (hasCashedOut) {
        statusDisplay.textContent = `CASHED OUT at ${cashedOutMultiplier.toFixed(2)}x!`;
        outcome = 'win';
        winnings = currentBet * cashedOutMultiplier;
        cashedOutAt = cashedOutMultiplier;
        animateCanvasFlash('#48bb78');
    } else {
        statusDisplay.textContent = `Game ended at ${crashPoint.toFixed(2)}x. Place your bet for the next round!`;
    }

    // Record the round in history if a bet was placed
    if (hasBet) {
        betHistory.push({
            betAmount: currentBet,
            crashPoint: crashPoint,
            cashedOutAt: cashedOutAt,
            outcome: outcome,
            winnings: winnings
        });
    }
    // Always record crash point
    crashHistory.push(crashPoint);
    renderBetHistory();

    setTimeout(() => {
        multiplierDisplay.textContent = crashPoint.toFixed(2) + 'x';
        drawGraph();
        placeBetBtn.disabled = false;
        cashOutBtn.disabled = true;
        betAmountInput.disabled = false;
        autoCashOutInput.disabled = false;
        statusDisplay.textContent = 'Waiting for next round...';
        currentBet = 0;
        hasBet = false;
        hasCashedOut = false;
        cashedOutMultiplier = null;
        startCountdown();
    }, 1000);
}

placeBetBtn.addEventListener('click', () => {
    const bet = parseFloat(betAmountInput.value);
    const autoCO = parseFloat(autoCashOutInput.value);

    if (isNaN(bet) || bet <= 0) {
        showMessage('Please enter a valid bet amount.', 'error');
        return;
    }
    if (bet > balance) {
        showMessage('Insufficient balance!', 'error');
        return;
    }
    if (isNaN(autoCO) || autoCO < 1.01) {
        showMessage('Auto Cash Out must be at least 1.01x.', 'error');
        return;
    }

    currentBet = bet;
    autoCashOut = autoCO;
    balance -= currentBet;
    hasBet = true;
    updateBalanceDisplay();

    placeBetBtn.disabled = true;
    cashOutBtn.disabled = false;
    betAmountInput.disabled = true;
    autoCashOutInput.disabled = true;
    statusDisplay.textContent = 'Bet placed! Waiting for game to start...';
    showMessage(`Bet placed: $${currentBet.toFixed(2)} at Auto Cash Out: ${autoCashOut.toFixed(2)}x`, 'success');
});

cashOutBtn.addEventListener('click', cashOut);

function cashOut() {
    if (!gameActive || !hasBet || hasCashedOut) {
        return;
    }
    hasCashedOut = true;
    cashOutBtn.disabled = true;
    cashedOutMultiplier = currentMultiplier; // Store the multiplier at cash out
    const winnings = currentBet * currentMultiplier;
    balance += winnings;
    updateBalanceDisplay();
    showMessage(`Cashed out at ${currentMultiplier.toFixed(2)}x! Won $${winnings.toFixed(2)}.`, 'success');
    // Do not end the round here; let it finish naturally.
}

window.onload = function() {
    initializeGame();
    
    const resizeCanvas = () => {
        const container = gameCanvas.parentElement;
        const containerWidth = container.clientWidth;
        const aspectRatio = 2; // width:height

        // Set canvas dimensions dynamically
        gameCanvas.width = containerWidth;
        gameCanvas.height = containerWidth / aspectRatio;

        drawGraph(); // Redraw with new dimensions
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);
    resizeCanvas();
};