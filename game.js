// ==========================================
// 1. 基本設定とシーンの初期化
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // マイクラの爽やかな青空色
scene.fog = new THREE.FogExp2(0x87CEEB, 0.03); // 遠くを霞ませて描画負荷を軽減

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false }); // Chromebook用にアンチエイリアスをオフにして高速化！
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false; // シャドウ（影）を無効化してFPSを爆上げ
document.body.appendChild(renderer.domElement);

// ==========================================
// 2. 光源（ライト）の設定
// ==========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // 全体を均一に照らす
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5); // 太陽光（立体感を出す）
directionalLight.position.set(10, 20, 7);
scene.add(directionalLight);

// ==========================================
// 3. ブロックと地形の生成（低スペック最適化）
// ==========================================
const blockGeometry = new THREE.BoxGeometry(1, 1, 1);

// マテリアル（色）の設定。画像を読み込まないため軽量
const materials = {
    grass: new THREE.MeshLambertMaterial({ color: 0x5a9e32 }), // 草
    dirt: new THREE.MeshLambertMaterial({ color: 0x866043 })   // 土
};

const worldSize = 14; // Chromebookで最も安定するサイズ（14×14マス）
const blocks = [];

// 地形の自動生成ループ
for (let x = -worldSize / 2; x < worldSize / 2; x++) {
    for (let z = -worldSize / 2; z < worldSize / 2; z++) {
        createBlock(x, 0, z, 'grass');  // 表面は草ブロック
        createBlock(x, -1, z, 'dirt'); // 1マス下は土ブロック
    }
}

function createBlock(x, y, z, type) {
    const mesh = new THREE.Mesh(blockGeometry, materials[type]);
    mesh.position.set(x, y, z);
    mesh.name = type;
    scene.add(mesh);
    blocks.push(mesh);
    return mesh;
}

// プレイヤーの初期位置（地上 y=2 の位置）
camera.position.set(0, 2, 4);

// ==========================================
// 4. 操作システム（ポインターロック＆キーボード）
// ==========================================
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let canJump = false;
let prevTime = performance.now();

const instructions = document.getElementById('instructions');

// クリックしたら画面をロックしてゲーム開始
// ==========================================
// 4. 操作システム（ポインターロック＆キーボード）改良版
// ==========================================
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let canJump = false;
let prevTime = performance.now();

const instructions = document.getElementById('instructions');

// 【改良】ボタンだけでなく、画面全体どこをクリックしても起動するように強化
document.body.addEventListener('click', () => {
    document.body.requestPointerLock();
});

// 【改良】ロック状態を確実に検知して画面を切り替える
document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === document.body) {
        instructions.style.display = 'none'; // スタート画面を消す
    } else {
        instructions.style.display = 'flex'; // ESCを押したらスタート画面に戻す
    }
});

// マウス移動による視点変更（カメラ回転）
let pitch = 0, yaw = 0;
document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== document.body) return;
    
    yaw -= event.movementX * 0.0025;
    pitch -= event.movementY * 0.0025;
    pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch)); // 真上・真下を向けない制限
    
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
});

// キーボードが押されたとき
document.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'KeyW': case 'ArrowUp': moveForward = true; break;
        case 'KeyS': case 'ArrowDown': moveBackward = true; break;
        case 'KeyA': case 'ArrowLeft': moveLeft = true; break;
        case 'KeyD': case 'ArrowRight': moveRight = true; break;
        case 'Space': if (canJump) velocity.y += 7.5; canJump = false; break; // ジャンプ力
    }
});

// キーボードが離されたとき
document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyW': case 'ArrowUp': moveForward = false; break;
        case 'KeyS': case 'ArrowDown': moveBackward = false; break;
        case 'KeyA': case 'ArrowLeft': moveLeft = false; break;
        case 'KeyD': case 'ArrowRight': moveRight = false; break;
    }
});

// ==========================================
// 5. マイクラの核：ブロック破壊と設置（レイキャスト）
// ==========================================
const raycaster = new THREE.Raycaster();
const centerMouse = new THREE.Vector2(0, 0); // 画面の中央（クロスヘアの位置）

document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== document.body) return;
    
    // カメラの正面（クロスヘアの先）にあるオブジェクトを検知
    raycaster.setFromCamera(centerMouse, camera);
    const intersects = raycaster.intersectObjects(blocks);
    
    // 距離が5マス以内のブロックのみ操作可能（本家準拠）
    if (intersects.length > 0 && intersects[0].distance < 5) {
        const intersect = intersects[0];
        
        if (e.button === 0) { 
            // 左クリック：ブロック破壊
            scene.remove(intersect.object);
            const index = blocks.indexOf(intersect.object);
            if (index > -1) blocks.splice(index, 1);
        } 
        else if (e.button === 2) { 
            // 右クリック：ブロック設置
            const normal = intersect.face.normal; // クリックされた面の向きを取得
            const targetPos = intersect.object.position.clone().add(normal);
            
            // 新しく土ブロックを設置
            createBlock(Math.round(targetPos.x), Math.round(targetPos.y), Math.round(targetPos.z), 'dirt');
        }
    }
});

// 右クリック時のブラウザメニューを禁止する（必須）
document.addEventListener('contextmenu', e => e.preventDefault());

// 画面リサイズ対応
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==========================================
// 6. メインループ（ゲームの実行と物理演算）
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    
    if (document.pointerLockElement === document.body) {
        const time = performance.now();
        const delta = (time - prevTime) / 1000;

        // 減速（空気抵抗・摩擦）
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 2.2 * delta; // 重力加速度

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        // 視点の向き（yaw）に合わせて移動の向きを計算
        if (moveForward || moveBackward) {
            velocity.z -= direction.z * 45.0 * delta * Math.cos(yaw);
            velocity.x -= direction.z * 45.0 * delta * Math.sin(yaw);
        }
        if (moveLeft || moveRight) {
            velocity.z -= direction.x * 45.0 * delta * Math.sin(yaw);
            velocity.x += direction.x * 45.0 * delta * Math.cos(yaw);
        }

        // 移動をプレイヤー（カメラ）に適用
        camera.position.x += velocity.x * delta;
        camera.position.z += velocity.z * delta;
        camera.position.y += velocity.y * delta;

        // 簡易的な地面の判定（落下防止）
        // ※ y=1.8（目の高さ）以下にならないように固定
        if (camera.position.y < 1.8) {
            velocity.y = 0;
            camera.position.y = 1.8;
            canJump = true;
        }

        prevTime = time;
    }
    
    // 描画実行
    renderer.render(scene, camera);
}

// ゲームスタート！
animate();
