// 游戏元素
const gameContainer = document.getElementById('game-container');
const storyScreen = document.getElementById('story-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over');
const victoryScreen = document.getElementById('victory');
const startBtn = document.getElementById('start-btn');
const restartBtns = document.querySelectorAll('#restart-btn');
const scoreDisplay = document.getElementById('score');
const levelDisplay = document.getElementById('level');
const levelUpScreen = document.getElementById('level-up-screen');
const cardContainer = document.getElementById('card-container');
const energyBar = document.getElementById('energy-bar');
const energyText = document.getElementById('energy-text');
const fpsCounter = document.getElementById('fps-counter');
const finalScoreDisplay = document.getElementById('final-score');

// 游戏变量
const gameWidth = 800;
const gameHeight = 600;
let playerX = 400;
let playerY = 300;
let playerSpeed = 6;
let bulletSpeed = 8;
let bulletFireRate = 30; // 值越小发射越快
let score = 0;
let level = 1;
let energy = 100;
let fragments = [];
let enemies = [];
let enemyBaseSpeed = 1.0;
let enemySpawnRate = 150; // 值越小生成越快
let bullets = [];
let keys = {};
let gameRunning = false;
let gamePaused = false; // 新增游戏暂停状态
let fragmentSpawnTimer = 0;
let enemySpawnTimer = 0;
let bulletSpawnTimer = 0;
let lastFrameTime = 0;
let fps = 0;
let activeUpgrades = {}; // Global record of enabled buffs/debuffs

// Canvas element and context (for rendering)
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// 工具函数：圆形碰撞检测
function checkCollision(ax, ay, ar, bx, by, br) {
    const dx = ax - bx;
    const dy = ay - by;
    const r = ar + br;
    return (dx * dx + dy * dy) <= (r * r);
}

// UI 辅助函数
function updateEnergyBar() {
    if (!energyBar || !energyText) return;
    const val = Math.max(0, Math.min(100, Math.round(energy)));
    energyBar.style.width = `${val}%`;
    energyText.textContent = `能量: ${val}%`;
}

function updateBackground() {
    // 根据难度简单调节背景明暗与色相（视觉反馈）
    const intensity = Math.min(1, 0.15 + level * 0.03);
    const colorA = `hsl(${235 - Math.min(30, level * 3)}, 60%, ${25 - intensity * 10}%)`;
    const colorB = `hsl(${210 - Math.min(20, level * 2)}, 60%, ${15 - intensity * 8}%)`;
    gameContainer.style.background = `linear-gradient(to bottom, ${colorA}, ${colorB})`;
}

// 对象池
const fragmentPool = [];
const enemyPool = [];
const bulletPool = [];

// 初始化游戏
function initGame() {
    playerX = 400;
    playerY = 300;
    playerSpeed = 6;
    bulletSpeed = 8;
    bulletFireRate = 30;
    score = 0;
    level = 1;
    energy = 100;
    enemyBaseSpeed = 1.0;
    enemySpawnRate = 150;
    fragments = [];
    enemies = [];
    bullets = [];
    keys = {};
    bulletSpawnTimer = bulletFireRate + 1; // 让第一次 gameLoop 不会立即生成子弹
    enemySpawnTimer = 0;
    fragmentSpawnTimer = 0;
    lastFrameTime = 0;
    activeUpgrades = {};

    // 清空游戏元素
    clearGameElements();
    clearAllDomElementsByClass(['fragment', 'enemy', 'bullet']);

    // 更新UI
    scoreDisplay.textContent = `碎片: ${score}`;
    levelDisplay.textContent = `难度: ${level}`;
    updateEnergyBar();
    updateBackground();
}

function clearAllDomElementsByClass(classes) {
    classes.forEach(cls => {
        const els = gameScreen.querySelectorAll('.' + cls);
        els.forEach(el => el.remove());
    });
}

// 清空游戏元素
function clearGameElements() {
    // 清空碎片
    for (let i = fragments.length - 1; i >= 0; i--) {
        const frag = fragments[i];
        if (frag.element.style.display !== 'none') {
            frag.element.style.display = 'none';
        }
        fragmentPool.push(frag);
    }
    fragments = [];

    // 清空敌人
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (enemy.element.style.display !== 'none') {
            enemy.element.style.display = 'none';
        }
        enemyPool.push(enemy);
    }
    enemies = [];

    // 清空子弹
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (bullet.element.style.display !== 'none') {
            bullet.element.style.display = 'none';
        }
        bulletPool.push(bullet);
    }
    bullets = [];
}

function spawnFragment() {
    let fragment;
    if (fragmentPool.length > 0) {
        fragment = fragmentPool.pop();
        fragment.element.style.display = 'block'; // 复用时显示
    } else {
        const element = document.createElement('div');
        element.className = 'fragment';
        gameScreen.appendChild(element);
        fragment = {
            element: element,
            x: 0,
            y: 0
        };
    }

    // 随机位置（确保不会太靠近玩家）
    let x, y;
    do {
        x = Math.random() * (gameWidth - 30);
        y = Math.random() * (gameHeight - 30);
    } while (Math.abs(x - playerX) < 100 && Math.abs(y - playerY) < 100);

    fragment.x = x;
    fragment.y = y;
    fragment.element.style.left = x + 'px';
    fragment.element.style.top = y + 'px';
    fragment.element.style.display = 'block';

    fragments.push(fragment);
}

// 生成敌人
function spawnEnemy() {
    let enemy;
    if (enemyPool.length > 0) {
        enemy = enemyPool.pop();
        enemy.element.style.display = 'block'; // 复用时显示
    } else {
        const element = document.createElement('div');
        element.className = 'enemy';
        gameScreen.appendChild(element);
        enemy = {
            element: element,
            x: 0,
            y: 0,
            speed: 1
        };
    }

    // 从屏幕边缘生成
    const side = Math.floor(Math.random() * 4);
    let x, y;

    switch (side) {
        case 0: // 上边
            x = Math.random() * gameWidth;
            y = -40;
            break;
        case 1: // 右边
            x = gameWidth + 40;
            y = Math.random() * gameHeight;
            break;
        case 2: // 下边
            x = Math.random() * gameWidth;
            y = gameHeight + 40;
            break;
        case 3: // 左边
            x = -40;
            y = Math.random() * gameHeight;
            break;
    }

    enemy.x = x;
    enemy.y = y;
    enemy.speed = enemyBaseSpeed; // 移除基于等级的速度加成
    enemy.element.style.left = x + 'px';
    enemy.element.style.top = y + 'px';
    enemy.element.style.display = 'block';

    enemies.push(enemy);
}

// 生成子弹
function spawnBullet() {
    if (energy < 15) return;
    let bullet;
    if (bulletPool.length > 0) {
        bullet = bulletPool.pop();
        bullet.element.style.display = 'block'; // 复用时显示
    } else {
        const element = document.createElement('div');
        element.className = 'bullet';
        gameScreen.appendChild(element);
        bullet = {
            element: element,
            x: playerX + 20,
            y: playerY + 20,
            dx: 0,
            dy: 0,
            speed: bulletSpeed,
            life: 0
        };
    }
    // 找到最近的敌人
    let closestEnemy = null;
    let minDistance = Infinity;
    let closestDx = 0;
    let closestDy = 0;
    for (const enemy of enemies) {
        const dx = enemy.x - playerX;
        const dy = enemy.y - playerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < minDistance) {
            minDistance = distance;
            closestEnemy = enemy;
            closestDx = dx;
            closestDy = dy;
        }
    }
    if (!closestEnemy) return;
    // 计算子弹方向
    const distance = minDistance;
    if (distance === 0) return; // 防止除零
    bullet.x = playerX + 20;
    bullet.y = playerY + 20;
    bullet.dx = closestDx / distance;
    bullet.dy = closestDy / distance;
    bullet.speed = bulletSpeed;
    bullet.life = 0;
    bullet.element.style.left = bullet.x + 'px';
    bullet.element.style.top = bullet.y + 'px';
    bullet.element.style.display = 'block';
    bullets.push(bullet);
    // 消耗能量
    energy -= 15;
    updateEnergyBar();
}

// ------------------ 卡片系统（顶层） ------------------
const upgrades = [
    { id: 'playerSpeed', text: '提升移动速度 10%', apply: () => { playerSpeed *= 1.10; } },
    { id: 'fireRate', text: '提升攻击速度 15%', apply: () => { bulletFireRate = Math.max(5, Math.floor(bulletFireRate * 0.85)); } },
    { id: 'bulletSpeed', text: '提升子弹速度 15%', apply: () => { bulletSpeed *= 1.15; } },
    { id: 'energyOnKill', text: '击败敌人时恢复 5 点能量', apply: () => { /* 特殊逻辑在碰撞中处理 */ } },
    { id: 'fragmentValue', text: '每个碎片额外恢复 5 点能量', apply: () => { /* 特殊逻辑在碰撞中处理 */ } }
];

const downgrades = [
    { id: 'enemySpeed', text: '所有敌人移速提升 8%', apply: () => { enemyBaseSpeed *= 1.08; } },
    { id: 'enemySpawn', text: '敌人生成速度加快 10%', apply: () => { enemySpawnRate = Math.max(20, Math.floor(enemySpawnRate * 0.90)); } },
    { id: 'enemyHealth', text: '敌人变得更难被子弹击中', apply: () => { /* 占位符 */ } },
    { id: 'energyDrain', text: '能量消耗速度增加 15%', apply: () => { /* 占位符 */ } },
    { id: 'lessFragment', text: '碎片生成数量减少', apply: () => { /* 特殊逻辑在生成时处理 */ } }
];

function handleLevelUp() {
    gamePaused = true;
    level++;
    levelDisplay.textContent = `难度: ${level}`;
    updateBackground();
    generateCards();
    levelUpScreen.style.display = 'flex';
}

function generateCards() {
    cardContainer.innerHTML = '';
    const usedUpgradeIds = new Set();
    const usedDowngradeIds = new Set();

    for (let i = 0; i < 3; i++) {
        let upgrade, downgrade;

        // 选择不重复的增益
        do {
            upgrade = upgrades[Math.floor(Math.random() * upgrades.length)];
        } while (usedUpgradeIds.has(upgrade.id));
        usedUpgradeIds.add(upgrade.id);

        // 选择不重复的减益
        do {
            downgrade = downgrades[Math.floor(Math.random() * downgrades.length)];
        } while (usedDowngradeIds.has(downgrade.id));
        usedDowngradeIds.add(downgrade.id);

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <h3>进化路线 ${i + 1}</h3>
            <div class="upgrade"><strong>增益:</strong> ${upgrade.text}</div>
            <div class="card-divider"></div>
            <div class="downgrade"><strong>代价:</strong> ${downgrade.text}</div>
        `;

        card.addEventListener('click', () => selectCard(upgrade, downgrade));
        cardContainer.appendChild(card);
    }
}

function selectCard(upgrade, downgrade) {
    // 应用效果
    upgrade.apply();
    downgrade.apply();

    // 记录特殊效果
    if (upgrade.id === 'energyOnKill' || upgrade.id === 'fragmentValue') {
        activeUpgrades[upgrade.id] = true;
    }
    if (downgrade.id === 'lessFragment') {
        activeUpgrades[downgrade.id] = true;
    }

    // 关闭选择界面并继续游戏
    levelUpScreen.style.display = 'none';
    gamePaused = false;
    requestAnimationFrame(gameLoop);
}

// ------------ 渲染（顶层） ------------
function drawPlayer() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(playerX + 20, playerY + 20, 20, 0, Math.PI * 2);
    const gradient = ctx.createLinearGradient(playerX, playerY, playerX + 40, playerY + 40);
    gradient.addColorStop(0, '#4361ee');
    gradient.addColorStop(1, '#3a0ca3');
    ctx.fillStyle = gradient;
    ctx.shadowColor = 'rgba(67,97,238,0.8)';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.restore();
}

function drawFragments() {
    fragments.forEach(frag => {
        ctx.beginPath();
        ctx.arc(frag.x + 12.5, frag.y + 12.5, 12.5, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(frag.x + 12.5, frag.y + 12.5, 5, frag.x + 12.5, frag.y + 12.5, 12.5);
        gradient.addColorStop(0, '#ffd166');
        gradient.addColorStop(1, '#ff9e00');
        ctx.fillStyle = gradient;
        ctx.shadowColor = 'rgba(255,209,102,0.8)';
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.restore();
    });
}

function drawEnemies() {
    enemies.forEach(enemy => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(enemy.x, enemy.y, 35, 35);
        const gradient = ctx.createLinearGradient(enemy.x, enemy.y, enemy.x + 35, enemy.y + 35);
        gradient.addColorStop(0, '#f72585');
        gradient.addColorStop(1, '#7209b7');
        ctx.fillStyle = gradient;
        ctx.shadowColor = 'rgba(247,37,133,0.7)';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
    });
}

function drawBullets() {
    bullets.forEach(bullet => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#4cc9f0';
        ctx.shadowColor = 'rgba(76,201,240,0.8)';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
    });
}

// ------------ 主循环（顶层） ------------
function gameLoop(timestamp) {
    if (!gameRunning || gamePaused) { // 检查暂停状态
        // 游戏结束时清空所有按键状态
        if (!gameRunning) keys = {};
        return;
    }

    // 计算FPS
    if (lastFrameTime > 0) {
        const deltaTime = timestamp - lastFrameTime;
        fps = Math.round(1000 / deltaTime);
        fpsCounter.textContent = `FPS: ${fps}`;
    }
    lastFrameTime = timestamp;

    // 移动玩家
    if (keys['ArrowUp'] && playerY > 0) playerY -= playerSpeed;
    if (keys['ArrowDown'] && playerY < gameHeight - 40) playerY += playerSpeed;
    if (keys['ArrowLeft'] && playerX > 0) playerX -= playerSpeed;
    if (keys['ArrowRight'] && playerX < gameWidth - 40) playerX += playerSpeed;
    bulletSpawnTimer++;
    if (bulletSpawnTimer > bulletFireRate) { // 使用变量控制发射速率
        spawnBullet();
        bulletSpawnTimer = 0;
    }
    for (let i = fragments.length - 1; i >= 0; i--) {
        const frag = fragments[i];

        // 检测碰撞（玩家-碎片）
        if (checkCollision(playerX + 20, playerY + 20, 20,
            frag.x + 12.5, frag.y + 12.5, 12.5)) {
            // 收集碎片
            frag.element.style.display = 'none';
            fragments.splice(i, 1);
            fragmentPool.push(frag);

            score++;
            scoreDisplay.textContent = `碎片: ${score}`;

            // 恢复能量
            let energyGain = activeUpgrades['fragmentValue'] ? 15 : 10;
            energy = Math.min(100, energy + energyGain);
            updateEnergyBar();

            // 每10个碎片提升难度
            if (score > 0 && score % 10 === 0) {
                handleLevelUp();
                return; // 暂停游戏循环，等待玩家选择
            }

            // 检查胜利条件
            if (score >= 100) {
                gameRunning = false;
                finalScoreDisplay.textContent = `收集碎片: ${score}`;
                victoryScreen.style.display = 'flex';
                return;
            }
        }
    }

    // 更新敌人
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        // 向玩家移动
        const dx = playerX - enemy.x;
        const dy = playerY - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        enemy.x += (dx / distance) * enemy.speed;
        enemy.y += (dy / distance) * enemy.speed;

        enemy.element.style.left = enemy.x + 'px';
        enemy.element.style.top = enemy.y + 'px';

        // 检测碰撞（玩家-敌人）
        if (checkCollision(playerX + 20, playerY + 20, 20,
            enemy.x + 17.5, enemy.y + 17.5, 17.5)) {
            // 游戏结束
            gameRunning = false;
            finalScoreDisplay.textContent = `收集碎片: ${score}`;
            gameOverScreen.style.display = 'flex';
            return;
        }

        // 移除屏幕外的敌人
        if (enemy.x < -50 || enemy.x > gameWidth + 50 ||
            enemy.y < -50 || enemy.y > gameHeight + 50) {
            enemy.element.style.display = 'none';
            enemies.splice(i, 1);
            enemyPool.push(enemy);
        }
    }

    // 更新子弹
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        // 移动子弹
        bullet.x += bullet.dx * bullet.speed;
        bullet.y += bullet.dy * bullet.speed;
        bullet.life++;

        bullet.element.style.left = bullet.x + 'px';
        bullet.element.style.top = bullet.y + 'px';

        // 检测子弹与敌人碰撞
        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (checkCollision(bullet.x, bullet.y, 5,
                enemy.x + 17.5, enemy.y + 17.5, 17.5)) {
                // 移除敌人
                enemy.element.style.display = 'none';
                enemies.splice(j, 1);
                enemyPool.push(enemy);

                // 如果有 "击败回能" 升级
                if (activeUpgrades['energyOnKill']) {
                    energy = Math.min(100, energy + 5);
                    updateEnergyBar();
                }

                hit = true;
                break;
            }
        }

        // 移除飞出屏幕或击中敌人的子弹
        if (hit || bullet.x < -20 || bullet.x > gameWidth + 20 ||
            bullet.y < -20 || bullet.y > gameHeight + 20 || bullet.life > 300) {
            bullet.element.style.display = 'none';
            bullets.splice(i, 1);
            bulletPool.push(bullet);
        }
    }

    // 保证碎片数量
    let minFragments = Math.min(3 + Math.floor(level / 2), 10);
    if (activeUpgrades['lessFragment']) {
        minFragments = Math.max(1, minFragments - 2);
    }
    while (fragments.length < minFragments) {
        spawnFragment();
    }

    // 生成新敌人（根据难度）
    enemySpawnTimer++;
    if (enemySpawnTimer > enemySpawnRate && enemies.length < 5 + level) {
        spawnEnemy();
        enemySpawnTimer = 0;
    }

    // Canvas清屏
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFragments();
    drawEnemies();
    drawBullets();
    drawPlayer();

    requestAnimationFrame(gameLoop);
}

// ------------ 事件绑定（顶层） ------------
let eventsBound = false; // 标记事件是否已绑定
function bindEventsOnce() {
    if (eventsBound) return;
    document.addEventListener('keydown', (e) => {
        if (!gameRunning || gamePaused) return; // 暂停时不允许操作
        keys[e.key] = true;
        // 支持WASD（小写和大写）
        if (e.key === 'W' || e.key === 'w') keys['ArrowUp'] = true;
        if (e.key === 'A' || e.key === 'a') keys['ArrowLeft'] = true;
        if (e.key === 'S' || e.key === 's') keys['ArrowDown'] = true;
        if (e.key === 'D' || e.key === 'd') keys['ArrowRight'] = true;
    });
    document.addEventListener('keyup', (e) => {
        // keyup事件在暂停时也应该响应，以防止按键状态卡住
        keys[e.key] = false;
        // 支持WASD（小写和大写）
        if (e.key === 'W' || e.key === 'w') keys['ArrowUp'] = false;
        if (e.key === 'A' || e.key === 'a') keys['ArrowLeft'] = false;
        if (e.key === 'S' || e.key === 's') keys['ArrowDown'] = false;
        if (e.key === 'D' || e.key === 'd') keys['ArrowRight'] = false;
    });
    eventsBound = true;
}

// 点击开始/重开
startBtn.addEventListener('click', () => {
    storyScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    bindEventsOnce(); // 只绑定一次事件
    initGame();
    gameRunning = true;
    gamePaused = false;
    requestAnimationFrame(gameLoop);
});

restartBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        gameOverScreen.style.display = 'none';
        victoryScreen.style.display = 'none';
        gameScreen.style.display = 'block';
        bindEventsOnce(); // 只绑定一次事件
        initGame();
        gameRunning = true;
        gamePaused = false;
        requestAnimationFrame(gameLoop);
    });
});
