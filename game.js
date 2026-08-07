// ==========================================
// SECTION 1: CANVAS, INPUT, & LEVEL SECTOR CONFIG
// ==========================================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const keys = {};
window.addEventListener("keydown", (e) => keys[e.key] = true);
window.addEventListener("keyup", (e) => keys[e.key] = false);

// Global Progression State (Starts at Level 1, progresses to Level 5+ Infinite Chaos)
let currentLevel = 1; 

const LEVEL_MATRIX = {
    1: { name: "LEVEL 1: EASY",       rows: 30, cols: 40, tileSize: 40, teachers: 5,  hasFlashlight: false, radius: 9999 },
    2: { name: "LEVEL 2: HARD",       rows: 40, cols: 52, tileSize: 30, teachers: 10, hasFlashlight: true,  radius: 200 },
    3: { name: "LEVEL 3: VERY HARD",  rows: 48, cols: 64, tileSize: 25, teachers: 30, hasFlashlight: true,  radius: 130 },
    4: { name: "LEVEL 4: IMPOSSIBLE", rows: 56, cols: 76, tileSize: 21, teachers: 60, hasFlashlight: true,  radius: 65 }
};

let activeLevel = LEVEL_MATRIX[currentLevel];

// Player configuration
const player = {
    x: 50, y: 50, size: 16, baseSpeed: 6.0, speed: 6.0, color: "#00ffcc",
    bananas: 3, sodas: 1, hasKeycard: false, isHiding: false, sprintTimer: 0
};

// School bus config
const schoolBus = {
    x: 0, y: 0, width: 80, height: 40, color: "#ffcc00",
    alarmActive: false, alarmTimer: 0
};

// Keycard & Gate configurations
const keycardItem = { x: 0, y: 0, size: 14, collected: false };
let fireDoors = []; 

// ==========================================
// SECTION 2: DYNAMIC LEVEL MAP FACTORY
// ==========================================
let MAP_GRID = [];

function generateMap() {
    MAP_GRID = [];
    fireDoors = [];
    
    // INFINITE RANDOM MODE ARCHITECTURE (Level 5+)
    if (currentLevel >= 5) {
        let randRows = 36 + Math.floor(Math.random() * 24); 
        let randCols = 48 + Math.floor(Math.random() * 32); 
        let calculatedTileSize = Math.floor(1200 / randRows); 
        
        // WEATHER RULE: 35% chance to toggle the flashlight on massive floors!
        let flashlightRoll = Math.random();
        let hasFog = flashlightRoll <= 0.35; 

        activeLevel = {
            name: `FLOOR ${currentLevel}: INFINITE CHAOS 🌀`,
            rows: randRows,
            cols: randCols,
            tileSize: calculatedTileSize,
            teachers: 1 + Math.floor(Math.random() * 20), 
            hasFlashlight: hasFog, 
            radius: 50 + Math.floor(Math.random() * 150) 
        };
    }

    let rows = activeLevel.rows;
    let cols = activeLevel.cols;

    for (let r = 0; r < rows; r++) {
        MAP_GRID[r] = [];
        for (let c = 0; c < cols; c++) {
            if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
                MAP_GRID[r][c] = 1;
            } 
            else if ((r === 2 && c === 2) || (r === 2 && c === cols - 3) || (r === rows - 3 && c === 2) || (r === rows - 3 && c === cols - 3)) {
                MAP_GRID[r][c] = 2; 
            }
            else if (r >= Math.floor(rows*0.38) && r <= Math.floor(rows*0.62) && c >= Math.floor(cols*0.34) && c <= Math.floor(cols*0.66)) {
                MAP_GRID[r][c] = 3; 
            }
            else if ((c >= Math.floor(cols*0.46) && c <= Math.floor(cols*0.51)) || (r >= Math.floor(rows*0.45) && r <= Math.floor(rows*0.53))) {
                MAP_GRID[r][c] = 0; 
            }
            else if (r % 10 === 0 && (c < cols*0.31 || c > cols*0.68)) {
                MAP_GRID[r][c] = 1; 
            }
            else if (c % 12 === 0 && (r < rows*0.33 || r > rows*0.66)) {
                MAP_GRID[r][c] = 1; 
            }
            else {
                MAP_GRID[r][c] = 0;
            }
        }
    }

    for(let r = 1; r < rows - 1; r++) {
        for(let c = 1; c < cols - 1; c++) {
            if (MAP_GRID[r][c] === 1 && (r % 10 === 5 || c % 12 === 6)) {
                MAP_GRID[r][c] = 0;
            }
        }
    }

    let midC = Math.floor(cols * 0.48);
    let midR = Math.floor(rows * 0.49);
    fireDoors.push({ r: midR - 6, c: midC, w: activeLevel.tileSize * 4, h: 10, unlocked: false });
    fireDoors.push({ r: midR + 7, c: midC, w: activeLevel.tileSize * 4, h: 10, unlocked: false });

    schoolBus.x = Math.floor(cols * 0.46) * activeLevel.tileSize;
    schoolBus.y = Math.floor(rows * 0.47) * activeLevel.tileSize;
}
// ==========================================
// SECTION 3: GAMEPLAY INTERACTIVES & COLLISIONS
// ==========================================
let trashCans = [];
let vendingMachines = [];
const droppedTraps = [];
let hunters = [];

const teacherNames = ["Gym Coach", "Librarian", "Math Teacher", "Science Teacher", "Art Teacher", "History Guard", "English Proctor", "Music Inspector"];
const directionsList = [{x:1, y:0}, {x:-1, y:0}, {x:0, y:1}, {x:0, y:-1}];

function isWallCollision(x, y, size) {
    const corners = [
        {x: x, y: y}, {x: x + size - 1, y: y},
        {x: x, y: y + size - 1}, {x: x + size - 1, y: y + size - 1}
    ];
    for (let corner of corners) {
        let col = Math.floor(corner.x / activeLevel.tileSize);
        let row = Math.floor(corner.y / activeLevel.tileSize);
        if (row < 0 || row >= activeLevel.rows || col < 0 || col >= activeLevel.cols) return true; 
        if (MAP_GRID[row][col] === 1) return true; 
    }
    
    if (!player.hasKeycard) {
        for (let door of fireDoors) {
            let dx = door.c * activeLevel.tileSize;
            let dy = door.r * activeLevel.tileSize;
            if (x < dx + door.w && x + size > dx && y < dy + door.h && y + size > dy) return true; 
        }
    }
    return false;
}

function initLevelEntities() {
    if (currentLevel < 5) {
        activeLevel = LEVEL_MATRIX[currentLevel];
    }
    generateMap();
    
    player.x = activeLevel.tileSize * 2; 
    player.y = activeLevel.tileSize * 2; 
    player.bananas = 3; player.sodas = 1;
    player.hasKeycard = false; player.isHiding = false; player.sprintTimer = 0;
    schoolBus.alarmActive = false; schoolBus.alarmTimer = 0;
    droppedTraps.length = 0;

    vendingMachines = [
        { x: activeLevel.tileSize * 15, y: activeLevel.tileSize * 3, stocked: true },
        { x: activeLevel.tileSize * (activeLevel.cols - 16), y: activeLevel.tileSize * (activeLevel.rows - 4), stocked: true }
    ];

    keycardItem.x = activeLevel.tileSize * (activeLevel.cols - 5);
    keycardItem.y = activeLevel.tileSize * 5;
    keycardItem.collected = false;

    trashCans = [
        { x: activeLevel.tileSize * 6,  y: activeLevel.tileSize * 5,  size: 15, kicked: false, noiseTimer: 0 },
        { x: activeLevel.tileSize * (activeLevel.cols - 7), y: activeLevel.tileSize * 5, size: 15, kicked: false, noiseTimer: 0 },
        { x: activeLevel.tileSize * 6,  y: activeLevel.tileSize * (activeLevel.rows - 6), size: 15, kicked: false, noiseTimer: 0 },
        { x: activeLevel.tileSize * (activeLevel.cols - 7), y: activeLevel.tileSize * (activeLevel.rows - 6), size: 15, kicked: false, noiseTimer: 0 }
    ];

    hunters = [];
    
    hunters.push({
        name: "Principal", x: activeLevel.tileSize * 5, y: activeLevel.tileSize * 4, size: 18,
        baseSpeed: 1.8, speed: 1.8, color: "#9900ff", dirX: 1, dirY: 0, stunTimer: 0, targetX: null, targetY: null
    });

    for (let i = 1; i < activeLevel.teachers; i++) {
        let randName = teacherNames[(i - 1) % teacherNames.length] + ` #${Math.ceil(i/teacherNames.length)}`;
        let randomDir = directionsList[Math.floor(Math.random() * directionsList.length)];
        let randSpeed = 2.0 + (Math.random() * 1.3);
        
        let spawnX, spawnY;
        let protectionAttempts = 0;
        
        do {
            spawnX = (activeLevel.tileSize * 3) + (Math.random() * (activeLevel.tileSize * (activeLevel.cols - 8)));
            spawnY = (activeLevel.tileSize * 3) + (Math.random() * (activeLevel.tileSize * (activeLevel.rows - 8)));
            protectionAttempts++;
        } while (isWallCollision(spawnX, spawnY, 18) && protectionAttempts < 100);

        hunters.push({
            name: randName, x: spawnX, y: spawnY, size: 16, baseSpeed: randSpeed, speed: randSpeed,
            color: `hsl(${Math.random() * 360}, 85%, 50%)`, dirX: randomDir.x, dirY: randomDir.y,
            stunTimer: 0, targetX: null, targetY: null
        });
    }
}

function checkCaught() {
    if (player.isHiding) return; 
    for (let h of hunters) {
        if (h.stunTimer > 0) continue; 
        let dx = h.x - player.x;
        let dy = h.y - player.y;
        if (Math.sqrt(dx * dx + dy * dy) < h.size) {
            initLevelEntities(); 
        }
    }
}

initLevelEntities();

// ==========================================
// SECTION 4: ACTION INTERACT CONTROLS
// ==========================================
window.addEventListener("keydown", (e) => {
    if (e.key === "q" || e.key === "Q") {
        let pCol = Math.floor((player.x + player.size/2) / activeLevel.tileSize);
        let pRow = Math.floor((player.y + player.size/2) / activeLevel.tileSize);
        if (MAP_GRID[pRow] && MAP_GRID[pRow][pCol] === 2) {
            player.isHiding = !player.isHiding;
        }
    }

    if (e.key === "Shift" && player.sodas > 0 && player.sprintTimer <= 0 && !player.isHiding) {
        e.preventDefault();
        player.sodas--;
        player.sprintTimer = 120; 
        player.speed = 9.5; 
    }

    if (player.isHiding) return; 

    if (e.key === "e" || e.key === "E") {
        let touchingBus = (
            player.x < schoolBus.x + schoolBus.width &&
            player.x + player.size > schoolBus.x &&
            player.y < schoolBus.y + schoolBus.height &&
            player.y + player.size > schoolBus.y
        );

        if (touchingBus && !schoolBus.alarmActive) {
            if (Math.random() <= 0.25) {
                currentLevel++; 
                initLevelEntities();
            } else {
                schoolBus.alarmActive = true;
                schoolBus.alarmTimer = 600; 
                for (let h of hunters) h.speed = 4.2; 
            }
        }
        
        for (let vm of vendingMachines) {
            let dx = player.x - vm.x;
            let dy = player.y - vm.y;
            if (Math.sqrt(dx*dx + dy*dy) < 40 && vm.stocked) {
                vm.stocked = false;
                player.sodas++;
            }
        }
    }

    if (e.key === " ") {
        e.preventDefault();
        if (player.bananas > 0) {
            droppedTraps.push({ x: player.x + 2, y: player.y + 2, size: 12 });
            player.bananas--;
        }
    }

    if (e.key === "f" || e.key === "F") {
        for (let can of trashCans) {
            let dx = player.x - can.x;
            let dy = player.y - can.y;
            if (Math.sqrt(dx*dx + dy*dy) < 40 && !can.kicked) {
                can.kicked = true;
                can.noiseTimer = 180; 
                for (let h of hunters) {
                    let hdx = h.x - can.x;
                    let hdy = h.y - can.y;
                    if (Math.sqrt(hdx*hdx + hdy*hdy) < 400) {
                        h.targetX = can.x; h.targetY = can.y;
                    }
                }
            }
        }
    }
});
// ==========================================
// SECTION 5: ENGINE UPDATE ROUTINES
// ==========================================
function update() {
    if (!player.isHiding) {
        if (player.sprintTimer > 0) {
            player.sprintTimer--;
            if (player.sprintTimer <= 0) player.speed = player.baseSpeed; 
        }

        let nextX = player.x;
        let nextY = player.y;

        if (keys["ArrowUp"] || keys["w"]) nextY -= player.speed;
        if (keys["ArrowDown"] || keys["s"]) nextY += player.speed;
        if (keys["ArrowLeft"] || keys["a"]) nextX -= player.speed;
        if (keys["ArrowRight"] || keys["d"]) nextX += player.speed;

        if (!isWallCollision(nextX, player.y, player.size)) player.x = nextX;
        if (!isWallCollision(player.x, nextY, player.size)) player.y = nextY;

        if (!keycardItem.collected) {
            let kdx = player.x - keycardItem.x;
            let kdy = player.y - keycardItem.y;
            if (Math.sqrt(kdx*kdx + kdy*kdy) < 25) {
                keycardItem.collected = true;
                player.hasKeycard = true;
            }
        }
    }

    if (schoolBus.alarmActive) {
        schoolBus.alarmTimer--;
        if (schoolBus.alarmTimer <= 0) {
            schoolBus.alarmActive = false;
            for (let h of hunters) h.speed = h.baseSpeed; 
        }
    }

    for (let can of trashCans) {
        if (can.noiseTimer > 0) {
            can.noiseTimer--;
            if (can.noiseTimer <= 0) can.kicked = false; 
        }
    }

    for (let h of hunters) {
        if (h.stunTimer > 0) {
            h.stunTimer--;
            continue; 
        }

        for (let i = droppedTraps.length - 1; i >= 0; i--) {
            let t = droppedTraps[i];
            let tdx = h.x - t.x;
            let tdy = h.y - t.y;
            if (Math.sqrt(tdx*tdx + tdy*tdy) < h.size) {
                h.stunTimer = 180; 
                droppedTraps.splice(i, 1); 
                break;
            }
        }

        if (schoolBus.alarmActive) {
            let dx = player.x - h.x;
            let dy = player.y - h.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0) { h.x += (dx / dist) * h.speed; h.y += (dy / dist) * h.speed; }
        } 
        else if (h.targetX !== null && h.targetY !== null) {
            let dx = h.targetX - h.x;
            let dy = h.targetY - h.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 15) { h.x += (dx / dist) * h.speed; h.y += (dy / dist) * h.speed; } 
            else { h.targetX = null; h.targetY = null; }
        } 
        else {
            let nextHX = h.x + (h.dirX * h.speed);
            let nextHY = h.y + (h.dirY * h.speed);

            if (isWallCollision(nextHX, nextHY, h.size)) {
                h.dirX *= -1; h.dirY *= -1;
                let validDir = directionsList[Math.floor(Math.random() * directionsList.length)];
                h.dirX = validDir.x; h.dirY = validDir.y;
            } else {
                h.x = nextHX; h.y = nextHY;
            }
        }
    }
    checkCaught();
}

// ==========================================
// SECTION 6: CANVAS RENDERING ENGINE
// ==========================================
function draw() {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < activeLevel.rows; row++) {
        for (let col = 0; col < activeLevel.cols; col++) {
            let tile = MAP_GRID[row][col];
            if (tile === 1) ctx.fillStyle = "#3a3a42";      
            else if (tile === 2) ctx.fillStyle = "#1d5c56"; 
            else if (tile === 3) ctx.fillStyle = "#223a22"; 
            else continue;
            ctx.fillRect(col * activeLevel.tileSize, row * activeLevel.tileSize, activeLevel.tileSize, activeLevel.tileSize);
        }
    }

    if (!player.hasKeycard) {
        ctx.fillStyle = "#ff1111";
        for (let door of fireDoors) {
            ctx.fillRect(door.c * activeLevel.tileSize, door.r * activeLevel.tileSize, door.w, door.h);
        }
    }

    for (let vm of vendingMachines) {
        ctx.fillStyle = vm.stocked ? "#0066ff" : "#223355"; 
        ctx.fillRect(vm.x, vm.y, activeLevel.tileSize, activeLevel.tileSize);
    }

    if (!keycardItem.collected) {
        ctx.fillStyle = "#ffd700";
        ctx.fillRect(keycardItem.x, keycardItem.y, keycardItem.size, keycardItem.size - 4);
    }

    ctx.fillStyle = "#ffff00";
    for (let t of droppedTraps) ctx.fillRect(t.x, t.y, t.size, t.size);

    for (let can of trashCans) {
        ctx.fillStyle = can.noiseTimer > 0 ? "#ff8800" : "#777788"; 
        ctx.fillRect(can.x - 7, can.y - 7, can.size, can.size);
    }

    ctx.fillStyle = schoolBus.alarmActive && Math.floor(Date.now() / 200) % 2 === 0 ? "#ff0000" : schoolBus.color;
    ctx.fillRect(schoolBus.x, schoolBus.y, schoolBus.width, schoolBus.height);

    for (let h of hunters) {
        ctx.fillStyle = h.stunTimer > 0 ? "#ffff44" : h.color; 
        ctx.fillRect(h.x, h.y, h.size, h.size);
    }

    if (!player.isHiding) {
        ctx.fillStyle = player.sprintTimer > 0 ? "#ffffff" : player.color; 
        ctx.fillRect(player.x, player.y, player.size, player.size);
    }

    if (activeLevel.hasFlashlight) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        let maskCanvas = document.createElement('canvas');
        maskCanvas.width = canvas.width; maskCanvas.height = canvas.height;
        let mctx = maskCanvas.getContext('2d');
        mctx.fillStyle = "#0d0d1a"; mctx.fillRect(0, 0, canvas.width, canvas.height);
        mctx.globalCompositeOperation = 'destination-out';
        
        let radGrd = mctx.createRadialGradient(
            player.x + player.size/2, player.y + player.size/2, 15, 
            player.x + player.size/2, player.y + player.size/2, activeLevel.radius
        );
        radGrd.addColorStop(0, 'rgba(0,0,0,1)'); radGrd.addColorStop(0.7, 'rgba(0,0,0,0.4)'); radGrd.addColorStop(1, 'rgba(0,0,0,0)');      
        mctx.fillStyle = radGrd; mctx.beginPath(); mctx.arc(player.x + player.size/2, player.y + player.size/2, activeLevel.radius, 0, Math.PI*2); mctx.fill();

        for (let h of hunters) {
            let hunterRadius = 60;
            let hGrd = mctx.createRadialGradient(h.x + h.size/2, h.y + h.size/2, 5, h.x + h.size/2, h.y + h.size/2, hunterRadius);
            hGrd.addColorStop(0, 'rgba(0,0,0,1)'); hGrd.addColorStop(0.8, 'rgba(0,0,0,0.3)'); hGrd.addColorStop(1, 'rgba(0,0,0,0)');
            mctx.fillStyle = hGrd; mctx.beginPath(); mctx.arc(h.x + h.size/2, h.y + h.size/2, hunterRadius, 0, Math.PI*2); mctx.fill();
        }
        ctx.restore(); ctx.drawImage(maskCanvas, 0, 0);
    }

    ctx.fillStyle = "#00ffcc";
    ctx.font = "bold 13px Courier New";
    let keyStatus = player.hasKeycard ? "🎯 READY" : "❌ NEEDED";
    ctx.fillText(`🍌 TRAPS: ${player.bananas} [SPACE] | 🧃 SODAS: ${player.sodas} [SHIFT] | 🔑 KEYCARD: ${keyStatus} | ${activeLevel.name}`, 30, 40);
    
    if (player.isHiding) {
        ctx.fillStyle = "#00ffcc";
        ctx.font = "bold 28px Courier New";
        ctx.fillText("🔒 HIDDEN INSIDE LOCKER [Q TO EXIT]", 500, 300);
    }

    if (schoolBus.alarmActive) {
        ctx.fillStyle = "#ff0000";
        ctx.font = "bold 20px Arial";
        ctx.fillText(`⚠️ ALARM ACTIVE! ENRAGED CHASE! (${Math.ceil(schoolBus.alarmTimer / 60)}s)`, 550, 40);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
