// 真正的 Three.js / WebGL 3D 渲染层。
// 保留原游戏逻辑，主战斗和坦克岛都由 PerspectiveCamera + OrbitControls 实时呈现。
// 鼠标左键旋转、滚轮缩放、右键平移，C键重置相机。

(async function initReal3D() {
  const THREE_URL = "https://esm.sh/three@0.180.0";
  const ORBIT_URL = "https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js";

  let THREE, OrbitControls;
  try {
    THREE = await import(THREE_URL);
    ({ OrbitControls } = await import(ORBIT_URL));
  } catch (err) {
    console.error("真实3D引擎加载失败，保留2D回退画面。", err);
    document.body.classList.add("real3d-failed");
    return;
  }

  document.body.classList.add("real3d-ready");

  const mainWrap = document.getElementById("canvas-wrap");
  const gameCanvas2D = document.getElementById("game");

  // ---------- 通用 ----------
  const TILE3 = 1;
  const WORLD_SIZE = GRID * TILE3;
  const centerOffset = WORLD_SIZE / 2;

  function colorValue(hex, fallback = 0x999999) {
    try { return new THREE.Color(hex || fallback); } catch (_) { return new THREE.Color(fallback); }
  }

  function addLights(scene) {
    scene.add(new THREE.HemisphereLight(0xdaf3ff, 0x34452f, 1.95));
    const sun = new THREE.DirectionalLight(0xffffff, 2.35);
    sun.position.set(8, 15, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    scene.add(sun);
  }

  function makeRenderer(parent, className) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.75));
    renderer.setSize(520, 520, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.className = className;
    renderer.domElement.tabIndex = 0;
    parent.appendChild(renderer.domElement);
    return renderer;
  }

  function makeCamera(renderer, defaultPos, target) {
    const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 120);
    camera.position.copy(defaultPos);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 26;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minPolarAngle = 0.15;
    controls.screenSpacePanning = false;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.update();

    function reset() {
      camera.position.copy(defaultPos);
      controls.target.copy(target);
      controls.update();
    }
    return { camera, controls, reset };
  }

  function setMeshShadow(obj) {
    obj.traverse?.((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  function makeTankMesh(color, scale = 1) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: colorValue(color), roughness: 0.72, metalness: 0.18 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x20262a, roughness: 0.86 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x3b4348, roughness: 0.55, metalness: 0.45 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.34, 0.88), bodyMat);
    body.position.y = 0.30;
    group.add(body);

    const trackGeo = new THREE.BoxGeometry(0.16, 0.25, 0.94);
    const leftTrack = new THREE.Mesh(trackGeo, darkMat);
    leftTrack.position.set(-0.43, 0.22, 0);
    group.add(leftTrack);
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = 0.43;
    group.add(rightTrack);

    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.29, 0.18, 16), steelMat);
    turret.position.y = 0.55;
    group.add(turret);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.68, 10), steelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.58, -0.43);
    group.add(barrel);

    group.scale.setScalar(scale);
    setMeshShadow(group);
    return group;
  }

  function makeHumanMesh(clothesColor = "#56c271") {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe2aa82, roughness: 0.75 });
    const clothesMat = new THREE.MeshStandardMaterial({ color: colorValue(clothesColor), roughness: 0.78 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x262b32, roughness: 0.9 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.20), clothesMat);
    body.position.y = 0.43;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 12), skinMat);
    head.position.y = 0.78;
    group.add(head);

    const legGeo = new THREE.BoxGeometry(0.10, 0.28, 0.12);
    const l = new THREE.Mesh(legGeo, darkMat);
    l.position.set(-0.08, 0.15, 0);
    group.add(l);
    const r = l.clone();
    r.position.x = 0.08;
    group.add(r);

    setMeshShadow(group);
    return group;
  }

  function mapTo3D(x, y, height = 0) {
    return new THREE.Vector3(
      x / TILE - centerOffset + 0.5,
      height,
      y / TILE - centerOffset + 0.5
    );
  }

  function dirRotation(dir) {
    // 模型炮管默认朝 -Z
    if (dir === DIR.UP) return 0;
    if (dir === DIR.RIGHT) return -Math.PI / 2;
    if (dir === DIR.DOWN) return Math.PI;
    return Math.PI / 2;
  }

  // ---------- 主战斗真正3D ----------
  const mainHost = document.createElement("div");
  mainHost.id = "real3d-main";
  mainHost.className = "real3d-host real3d-main-host";
  mainWrap.insertBefore(mainHost, mainWrap.firstChild);

  const mainRenderer = makeRenderer(mainHost, "real3d-canvas");
  mainRenderer.setClearColor(0x101c24, 1);

  const mainScene = new THREE.Scene();
  mainScene.background = new THREE.Color(0x101c24);
  mainScene.fog = new THREE.Fog(0x101c24, 15, 30);
  addLights(mainScene);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE + 2, WORLD_SIZE + 2),
    new THREE.MeshStandardMaterial({ color: 0x38463d, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  mainScene.add(ground);

  const grid = new THREE.GridHelper(WORLD_SIZE, GRID, 0x718b7b, 0x4b5b50);
  grid.position.y = 0.008;
  mainScene.add(grid);

  const mainCameraSetup = makeCamera(
    mainRenderer,
    new THREE.Vector3(5.2, 5.6, 6.8),
    new THREE.Vector3(0, 0.8, 0)
  );
  const mainFollowTarget = new THREE.Vector3(0, 0.8, 0);
  const mainFollowPrev = new THREE.Vector3(0, 0.8, 0);

  const staticGroup = new THREE.Group();
  const dynamicGroup = new THREE.Group();
  mainScene.add(staticGroup, dynamicGroup);

  let lastMapSignature = "";
  let playerMesh = null;
  const enemyMeshes = new Map();
  const bulletMeshes = new Map();
  const powerMeshes = new Map();

  function clearGroup(group) {
    while (group.children.length) {
      const obj = group.children.pop();
      obj.traverse?.((o) => {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material?.dispose?.();
      });
    }
  }

  function obstacleHeightAt(r, c) {
    try {
      if (typeof getObstacleHeight3D === "function") return Math.max(1, getObstacleHeight3D(r, c));
    } catch (_) {}
    return 1;
  }

  function buildMainStaticScene() {
    const sig = map.map((row) => row.join("")).join("|") +
      "|" + (typeof obstacleHeights3D !== "undefined" ? JSON.stringify(obstacleHeights3D) : "");
    if (sig === lastMapSignature) return;
    lastMapSignature = sig;
    clearGroup(staticGroup);

    const brickMat = new THREE.MeshStandardMaterial({ color: 0x9b4b23, roughness: 0.92 });
    const brickTopMat = new THREE.MeshStandardMaterial({ color: 0xc9743f, roughness: 0.82 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x8d9ba3, roughness: 0.48, metalness: 0.55 });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x31546c, roughness: 0.62, metalness: 0.22 });

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const t = map[r]?.[c];
        if (t === T.EMPTY) continue;

        const worldX = c - centerOffset + 0.5;
        const worldZ = r - centerOffset + 0.5;

        if (t === T.BRICK || t === T.STEEL) {
          const layers = obstacleHeightAt(r, c);
          for (let layer = 0; layer < layers; layer++) {
            const geo = new THREE.BoxGeometry(0.92, 0.92, 0.92);
            const mesh = new THREE.Mesh(geo, t === T.BRICK ? brickMat : steelMat);
            mesh.position.set(worldX, 0.46 + layer * 0.92, worldZ);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            staticGroup.add(mesh);

            if (t === T.BRICK) {
              const cap = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.05, 0.82), brickTopMat);
              cap.position.set(worldX, 0.94 + layer * 0.92, worldZ);
              cap.castShadow = true;
              staticGroup.add(cap);
            }
          }
        } else if (t === T.BASE) {
          const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.45, 0.88), baseMat);
          plinth.position.set(worldX, 0.23, worldZ);
          plinth.castShadow = true;
          plinth.receiveShadow = true;
          staticGroup.add(plinth);

          const eagle = new THREE.Mesh(
            new THREE.ConeGeometry(0.28, 0.62, 5),
            new THREE.MeshStandardMaterial({ color: baseAlive ? 0xe1c15a : 0x5d5d5d, metalness: 0.25, roughness: 0.65 })
          );
          eagle.position.set(worldX, 0.72, worldZ);
          staticGroup.add(eagle);
        }
      }
    }
  }

  function syncTankMesh(mesh, tank, isPlayerTank) {
    const pos = mapTo3D(tank.x + tank.size / 2, tank.y + tank.size / 2);
    const flying = !!(tank.isFlying && tank.flightTimer > 0);
    pos.y = flying ? 3.25 : 0.02;
    mesh.position.copy(pos);
    mesh.rotation.y = dirRotation(tank.dir);

    if (flying) {
      mesh.rotation.z = Math.sin(performance.now() / 250) * 0.03;
    } else {
      mesh.rotation.z = 0;
    }

    if (isPlayerTank && tank.shieldTimer > 0) {
      mesh.scale.setScalar(1.04);
    } else {
      mesh.scale.setScalar(1);
    }
  }

  function followCameraWithTarget(setup, desiredTarget, prevTarget, smoothing = 0.16) {
    if (!setup || !desiredTarget || !prevTarget) return;

    // 让相机和观察点一起移动，保留玩家鼠标手动调整后的相机角度与距离。
    const smoothed = prevTarget.clone().lerp(desiredTarget, smoothing);
    const delta = smoothed.clone().sub(prevTarget);
    setup.camera.position.add(delta);
    setup.controls.target.add(delta);
    prevTarget.copy(smoothed);
  }

  function syncMainDynamics() {
    if (player && player.alive) {
      if (!playerMesh) {
        playerMesh = makeTankMesh(player.color || "#f1c40f");
        dynamicGroup.add(playerMesh);
      }
      syncTankMesh(playerMesh, player, true);
      const bodyColor = player.color || "#f1c40f";
      playerMesh.children.forEach((child, idx) => {
        if (idx === 0 && child.material?.color) child.material.color.set(bodyColor);
      });
      playerMesh.visible = true;
      mainFollowTarget.copy(playerMesh.position);
      mainFollowTarget.y += player.isFlying ? 0.8 : 0.7;
    } else if (playerMesh) {
      playerMesh.visible = false;
    }

    const liveEnemies = new Set();
    for (const enemy of enemies) {
      if (!enemy?.alive) continue;
      liveEnemies.add(enemy);
      let mesh = enemyMeshes.get(enemy);
      if (!mesh) {
        const scale = enemy.type === "boss10" ? 1.55 : enemy.type === "boss6" ? 1.35 : 1;
        mesh = makeTankMesh(enemy.color || "#e74c3c", scale);
        enemyMeshes.set(enemy, mesh);
        dynamicGroup.add(mesh);
      }
      syncTankMesh(mesh, enemy, false);
      mesh.visible = true;
    }
    for (const [enemy, mesh] of enemyMeshes) {
      if (!liveEnemies.has(enemy)) {
        dynamicGroup.remove(mesh);
        enemyMeshes.delete(enemy);
      }
    }

    const liveBullets = new Set();
    for (const b of bullets) {
      if (!b?.alive) continue;
      liveBullets.add(b);
      let mesh = bulletMeshes.get(b);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 10, 8),
          new THREE.MeshStandardMaterial({
            color: b.fromPlayer ? 0xfff1a8 : 0xff6d5f,
            emissive: b.fromPlayer ? 0x553e00 : 0x4a0900,
            emissiveIntensity: 0.7,
          })
        );
        mesh.castShadow = true;
        bulletMeshes.set(b, mesh);
        dynamicGroup.add(mesh);
      }
      const p = mapTo3D(b.x, b.y, b.highShot ? 1.55 : 0.48);
      mesh.position.copy(p);
    }
    for (const [b, mesh] of bulletMeshes) {
      if (!liveBullets.has(b)) {
        dynamicGroup.remove(mesh);
        bulletMeshes.delete(b);
      }
    }

    const livePower = new Set();
    for (const p of powerUps) {
      if (!p?.alive) continue;
      livePower.add(p);
      let mesh = powerMeshes.get(p);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.24, 0),
          new THREE.MeshStandardMaterial({ color: 0x55e0ff, emissive: 0x164a59, emissiveIntensity: 0.8 })
        );
        mesh.castShadow = true;
        powerMeshes.set(p, mesh);
        dynamicGroup.add(mesh);
      }
      const pos = mapTo3D(p.x + p.size / 2, p.y + p.size / 2, 0.36);
      mesh.position.copy(pos);
      mesh.rotation.y += 0.025;
    }
    for (const [p, mesh] of powerMeshes) {
      if (!livePower.has(p)) {
        dynamicGroup.remove(mesh);
        powerMeshes.delete(p);
      }
    }
  }

  // ---------- 坦克岛真正3D ----------
  let islandRenderer = null;
  let islandScene = null;
  let islandCameraSetup = null;
  let islandHost = null;
  let islandStaticBuilt = false;
  let islandTankMesh = null;
  let islandHumanMesh = null;
  let islandEmoteSprite = null;
  let islandEmoteTexture = null;
  let islandPetMesh = null;
  let islandPetId = "";
  const islandBulletMeshes = new Map();

  function islandCoord(x, y, height = 0) {
    return new THREE.Vector3((x - 250) / 26, height, (y - 250) / 26);
  }

  function makeIslandPetMesh(pet) {
    const group = new THREE.Group();
    const colors = {
      scout:0xf0a14b, drone:0x5fcfff, bot:0x9aa8b2, fox:0xe88347, dragon:0x63c477
    };
    const mat = new THREE.MeshStandardMaterial({color:colors[pet?.id]||0xf0a14b,roughness:.58,metalness:(pet?.id==="drone"||pet?.id==="bot") ? .18 : 0});
    const dark = new THREE.MeshStandardMaterial({color:0x263039,roughness:.75});
    const body = new THREE.Mesh(new THREE.SphereGeometry(.26,16,12),mat);
    body.position.y=.28;group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.20,16,12),mat);
    head.position.set(0,.52,-.12);group.add(head);
    const eye1=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),dark);
    eye1.position.set(-.07,.57,-.29);group.add(eye1);
    const eye2=eye1.clone();eye2.position.x=.07;group.add(eye2);
    if(pet?.id==="drone"){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.36,.035,8,20),dark);
      ring.rotation.x=Math.PI/2;ring.position.y=.32;group.add(ring);
    }
    group.scale.setScalar(.95);
    setMeshShadow(group);
    return group;
  }

  function buildingHeight(id) {
    if (id === "tower") return 5.4;
    if (id === "parkour") return 5.5;
    if (id === "mall" || id === "blindbox") return 2.5;
    if (id === "range") return 1.2;
    if (id === "soccer") return 0.18;
    if (["modehall","rankhall","seasonhall","eventhall","onlinehub","backpackhub","scenic","rechargehall"].includes(id)) return 2.35;
    if (id === "carousel") return 2.2;
    if (id === "slidepark") return 2.8;
    if (id === "photozone") return 2.4;
    return 2.0;
  }

  function makeBuildingMesh(b) {
    if (b.id === "wheel") {
      const group = new THREE.Group();
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(1.15, 0.08, 12, 40),
        new THREE.MeshStandardMaterial({ color: 0xf4c542, metalness: 0.55, roughness: 0.4 })
      );
      rim.rotation.y = Math.PI / 2;
      rim.position.y = 1.45;
      group.add(rim);
      const standMat = new THREE.MeshStandardMaterial({ color: 0x6b737b, metalness: 0.5, roughness: 0.55 });
      for (const x of [-0.5, 0.5]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.4, 0.10), standMat);
        leg.position.set(x, 0.65, 0);
        leg.rotation.z = x < 0 ? -0.2 : 0.2;
        group.add(leg);
      }
      setMeshShadow(group);
      return group;
    }

    const h = buildingHeight(b.id);
    const w = Math.max(0.9, b.w / 38);
    const d = Math.max(0.9, b.h / 38);
    const group = new THREE.Group();

    if (b.id === "soccer") {
      const field = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.12, d),
        new THREE.MeshStandardMaterial({ color: 0x2d904e, roughness: 1 })
      );
      field.position.y = 0.06;
      field.receiveShadow = true;
      group.add(field);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xdfffe9 });
      const mid = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, d * 0.92), lineMat);
      mid.position.y = 0.13;
      group.add(mid);
      return group;
    }

    // 派对主城功能建筑改成更圆润、鲜艳的原创3D造型。
    if (["modehall","rankhall","seasonhall","eventhall","onlinehub","backpackhub","scenic","rechargehall"].includes(b.id)) {
      const baseMat = new THREE.MeshStandardMaterial({ color: colorValue(b.color), roughness: .48, metalness: .06 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0xf7e38b, roughness: .42, metalness: .10 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0xa7e8ff, emissive: 0x164659, emissiveIntensity: .22, roughness: .22 });

      const base = new THREE.Mesh(new THREE.CylinderGeometry(w * .56, w * .62, h * .78, 24), baseMat);
      base.position.y = h * .39;
      group.add(base);

      const dome = new THREE.Mesh(new THREE.SphereGeometry(w * .54, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), baseMat);
      dome.scale.z = Math.max(.72, d / w);
      dome.position.y = h * .78;
      group.add(dome);

      const trim = new THREE.Mesh(new THREE.TorusGeometry(w * .48, .07, 10, 32), trimMat);
      trim.rotation.x = Math.PI / 2;
      trim.position.y = h * .74;
      group.add(trim);

      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const win = new THREE.Mesh(new THREE.BoxGeometry(.30,.34,.05), glassMat);
        win.position.set(Math.cos(a) * w * .47, h * .42, Math.sin(a) * Math.max(.45,d * .44));
        win.rotation.y = -a;
        group.add(win);
      }

      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(.24,16,12),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: colorValue(b.color), emissiveIntensity: .7, roughness: .18 })
      );
      orb.position.y = h + .42;
      group.add(orb);

      setMeshShadow(group);
      return group;
    }

    if (b.id === "carousel") {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.55,1.7,.30,36),
        new THREE.MeshStandardMaterial({color:0xf0c35d,roughness:.6})
      );
      base.position.y=.18; group.add(base);

      const poleMat = new THREE.MeshStandardMaterial({color:0xf5e8cf,roughness:.45});
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,2.7,14),poleMat);
      pole.position.y=1.55; group.add(pole);

      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(1.75,.72,32),
        new THREE.MeshStandardMaterial({color:0xff7f9c,roughness:.5})
      );
      canopy.position.y=2.55; group.add(canopy);

      const seatColors=[0x65d8ff,0xffd75e,0x75e89a,0xb18cff];
      for(let i=0;i<8;i++){
        const a=i/8*Math.PI*2;
        const arm=new THREE.Mesh(new THREE.BoxGeometry(.05,1.1,.05),poleMat);
        arm.position.set(Math.cos(a)*1.1,1.55,Math.sin(a)*1.1);
        group.add(arm);
        const seat=makeTankMesh("#ffd23f",.38);
        seat.position.set(Math.cos(a)*1.1,.82,Math.sin(a)*1.1);
        seat.rotation.y=-a;
        seat.children?.[0]?.material?.color?.setHex?.(seatColors[i%seatColors.length]);
        group.add(seat);
      }
      setMeshShadow(group);
      return group;
    }

    if (b.id === "slidepark") {
      const pink=new THREE.MeshStandardMaterial({color:0xff7f9a,roughness:.58});
      const cyan=new THREE.MeshStandardMaterial({color:0x64d8ff,roughness:.58});
      const yellow=new THREE.MeshStandardMaterial({color:0xffd75e,roughness:.58});
      const tower=new THREE.Mesh(new THREE.CylinderGeometry(.72,.82,2.6,20),cyan);
      tower.position.set(-1.05,1.45,0); group.add(tower);
      const top=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,.18,24),yellow);
      top.position.set(-1.05,2.82,0); group.add(top);
      const ramp1=new THREE.Mesh(new THREE.BoxGeometry(2.4,.18,.88),pink);
      ramp1.position.set(.15,2.0,0); ramp1.rotation.z=-.34; group.add(ramp1);
      const ramp2=new THREE.Mesh(new THREE.BoxGeometry(2.5,.18,.88),cyan);
      ramp2.position.set(2.0,1.15,0); ramp2.rotation.z=-.34; group.add(ramp2);
      const landing=new THREE.Mesh(new THREE.CylinderGeometry(.95,1.08,.18,24),yellow);
      landing.position.set(3.25,.34,0); group.add(landing);
      setMeshShadow(group);
      return group;
    }

    if (b.id === "photozone") {
      const cyan=new THREE.MeshStandardMaterial({color:0x62d8ff,roughness:.48});
      const gold=new THREE.MeshStandardMaterial({color:0xffd35d,roughness:.45,metalness:.12});
      const left=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,2.5,12),cyan);
      const right=left.clone();
      left.position.set(-1.55,1.4,0); right.position.set(1.55,1.4,0);
      const arch=new THREE.Mesh(new THREE.TorusGeometry(1.55,.13,10,32,Math.PI),cyan);
      arch.rotation.z=Math.PI; arch.position.y=2.65;
      group.add(left,right,arch);
      const cannon=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,3.4,16),gold);
      cannon.rotation.z=Math.PI/2;
      cannon.position.set(0,1.25,0);
      group.add(cannon);
      const tank=makeTankMesh("#f6b82e",1.45);
      tank.position.set(0,.36,.15);
      tank.rotation.y=Math.PI/2;
      group.add(tank);
      setMeshShadow(group);
      return group;
    }

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: colorValue(b.color), roughness: 0.75, metalness: b.id === "tower" ? 0.12 : 0.03 })
    );
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.06, 0.16, d * 1.06),
      new THREE.MeshStandardMaterial({ color: 0xd3dde3, roughness: 0.55 })
    );
    roof.position.y = h + 0.08;
    roof.castShadow = true;
    group.add(roof);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(0.55, w * 0.35), 0.9, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x26343c, roughness: 0.85 })
    );
    door.position.set(0, 0.45, d / 2 + 0.035);
    group.add(door);

    if (b.id === "tower") {
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x80c9ef, emissive: 0x163a50, emissiveIntensity: 0.25, roughness: 0.25 });
      for (let floor = 0; floor < 6; floor++) {
        for (const side of [-1, 1]) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.30, 0.05), glassMat);
          win.position.set(side * 0.62, 1.0 + floor * 0.67, d / 2 + 0.04);
          group.add(win);
        }
      }

      // 原创派对主城风格：彩色环形屋檐 + 巨型坦克屋顶地标。
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xf0c94d, roughness: 0.45, metalness: 0.18 });
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.62, w * 0.62, 0.22, 24), crownMat);
      crown.position.y = h + 0.28;
      crown.castShadow = true;
      group.add(crown);

      const giantTank = makeTankMesh("#f5b82e", 4.7);
      giantTank.position.set(0, h + 0.72, 0);
      giantTank.rotation.y = Math.PI / 2;
      giantTank.userData.giantRooftopTank = true;
      group.add(giantTank);

      const beaconMat = new THREE.MeshStandardMaterial({ color: 0x66e0ff, emissive: 0x164f68, emissiveIntensity: 0.75 });
      const beacon = new THREE.Mesh(new THREE.TorusGeometry(w * 0.72, 0.07, 10, 36), beaconMat);
      beacon.rotation.x = Math.PI / 2;
      beacon.position.y = h + 0.72;
      group.add(beacon);
    }
    return group;
  }

  function ensureIsland3D() {
    const worldScreen = document.getElementById("island-world-screen");
    if (!worldScreen) return false;

    if (!islandHost) {
      islandHost = document.createElement("div");
      islandHost.id = "real3d-island";
      islandHost.className = "real3d-host real3d-island-host";
      const canvas2d = document.getElementById("island-world-canvas");
      worldScreen.insertBefore(islandHost, canvas2d);

      islandRenderer = makeRenderer(islandHost, "real3d-canvas");
      islandRenderer.setClearColor(0x5da8cf, 1);

      islandScene = new THREE.Scene();
      islandScene.background = new THREE.Color(0x6eb5d9);
      islandScene.fog = new THREE.FogExp2(0x83c4df, 0.022);
      addLights(islandScene);

      const sea = new THREE.Mesh(
        new THREE.PlaneGeometry(150, 78),
        new THREE.MeshStandardMaterial({ color: 0x176d91, roughness: 0.55, metalness: 0.08 })
      );
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(24, -0.16, 4);
      sea.receiveShadow = true;
      islandScene.add(sea);

      const landMat = new THREE.MeshStandardMaterial({ color: 0x55a653, roughness: 0.98 });
      const sandMat = new THREE.MeshStandardMaterial({ color: 0xe2cf89, roughness: 1 });

      // 下方旧岛保留。
      const smallCenter = islandCoord(250, 300, 0);
      const smallIsland = new THREE.Mesh(
        new THREE.CylinderGeometry(10.0, 10.35, 0.42, 72),
        landMat
      );
      smallIsland.position.set(smallCenter.x, 0, smallCenter.z);
      smallIsland.receiveShadow = true;
      smallIsland.castShadow = true;
      islandScene.add(smallIsland);

      const smallBeach = new THREE.Mesh(
        new THREE.TorusGeometry(10.2, 0.38, 10, 72),
        sandMat
      );
      smallBeach.rotation.x = Math.PI / 2;
      smallBeach.position.set(smallCenter.x, 0.17, smallCenter.z);
      islandScene.add(smallBeach);

      // 第二个大型主岛已删除，只保留原始岛主路。
      const roadMat = new THREE.MeshStandardMaterial({ color: 0xc6b483, roughness: 1 });
      const road1 = new THREE.Mesh(new THREE.BoxGeometry(17.2, 0.05, 0.78), roadMat);
      road1.position.set(smallCenter.x, 0.25, smallCenter.z);
      islandScene.add(road1);
      const road2 = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.05, 17.2), roadMat);
      road2.position.set(smallCenter.x, 0.25, smallCenter.z);
      islandScene.add(road2);

      islandCameraSetup = makeCamera(
        islandRenderer,
        new THREE.Vector3(5.2, 5.6, 7.2),
        new THREE.Vector3(0, 1.1, 0)
      );
      islandCameraSetup.followPrev = new THREE.Vector3(0, 1.1, 0);
    }

    if (!islandStaticBuilt) {
      for (const b of ISLAND_WORLD_BUILDINGS) {
        const mesh = makeBuildingMesh(b);
        const pos = islandCoord(b.x, b.y, 0.22);
        mesh.position.set(pos.x, 0.22, pos.z);
        mesh.userData.buildingId = b.id;
        setMeshShadow(mesh);
        islandScene.add(mesh);
      }

      // 跑酷塔平台真实高度
      ISLAND_PARKOUR_PADS.forEach((pad, i) => {
        const p = islandCoord(pad.x, pad.y, 0);
        const platform = new THREE.Mesh(
          new THREE.CylinderGeometry(0.34, 0.34, 0.14, 16),
          new THREE.MeshStandardMaterial({ color: i === 0 ? 0xffd23f : 0xbcc6cb, roughness: 0.7 })
        );
        platform.position.set(p.x, 0.55 + i * 0.62, p.z);
        platform.castShadow = true;
        islandScene.add(platform);
      });

      // 原始坦克岛保留少量草坪、灌木和树木；第二大岛的广场和派对装饰全部删除。
      const grassMat = new THREE.MeshStandardMaterial({ color: 0x3f8f45, roughness: 1 });
      const bushMat = new THREE.MeshStandardMaterial({ color: 0x2f7339, roughness: 1 });
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x725239, roughness: 1 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f8e45, roughness: .92 });
      [
        [-7.5,-4.5,2.3,1.5],[-5.5,5.8,2.6,1.7],[5.8,-5.5,2.4,1.6],
        [7.2,4.6,2.1,1.5],[-1.6,6.6,2.8,1.5],[2.4,-6.8,2.5,1.4]
      ].forEach(([x,z,w,d])=>{
        const patch=new THREE.Mesh(new THREE.BoxGeometry(w,.05,d),grassMat);
        patch.position.set(x,.24,z);patch.receiveShadow=true;islandScene.add(patch);
      });
      [
        [-8,-1.5],[-7,3.8],[-3.5,-7],[6.8,-2],[7,6],[1.5,7.5]
      ].forEach(([x,z])=>{
        const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,.9,10),trunkMat);
        trunk.position.set(x,.68,z);trunk.castShadow=true;islandScene.add(trunk);
        const crown=new THREE.Mesh(new THREE.SphereGeometry(.55,14,10),leafMat);
        crown.position.set(x,1.35,z);crown.castShadow=true;islandScene.add(crown);
        const bush=new THREE.Mesh(new THREE.SphereGeometry(.28,12,8),bushMat);
        bush.position.set(x+.55,.46,z+.35);bush.castShadow=true;islandScene.add(bush);
      });

      // 坦克大厦附近增加大型迎宾拱门，让楼顶巨型坦克从远处就能看到。
      const towerCenter=islandCoord(250,135,0);
      const gateMat=new THREE.MeshStandardMaterial({color:0x55d0ff,roughness:.45,metalness:.06});
      const gateLeft=new THREE.Mesh(new THREE.CylinderGeometry(.16,.20,3.2,14),gateMat);
      const gateRight=gateLeft.clone();
      gateLeft.position.set(towerCenter.x-1.7,1.85,towerCenter.z+3.0);
      gateRight.position.set(towerCenter.x+1.7,1.85,towerCenter.z+3.0);
      const gateTop=new THREE.Mesh(new THREE.TorusGeometry(1.7,.16,12,36,Math.PI),gateMat);
      gateTop.rotation.z=Math.PI;
      gateTop.position.set(towerCenter.x,3.45,towerCenter.z+3.0);
      islandScene.add(gateLeft,gateRight,gateTop);

      // 大型“游乐园游乐区”：独立半岛 + 8个可驾驶游乐设施。
      if (typeof AMUSEMENT_ZONE !== "undefined") {
        const funCenter = islandCoord(AMUSEMENT_ZONE.center.x, AMUSEMENT_ZONE.center.y, 0);
        const funLand = new THREE.Mesh(
          new THREE.CylinderGeometry(9.35,9.65,.46,72),
          new THREE.MeshStandardMaterial({color:0x68b75c,roughness:.96})
        );
        funLand.position.set(funCenter.x,0,funCenter.z);
        funLand.castShadow=true; funLand.receiveShadow=true; islandScene.add(funLand);

        const funBeach = new THREE.Mesh(
          new THREE.TorusGeometry(9.5,.38,10,72),
          new THREE.MeshStandardMaterial({color:0xe5cd82,roughness:1})
        );
        funBeach.rotation.x=Math.PI/2;
        funBeach.position.set(funCenter.x,.18,funCenter.z);
        islandScene.add(funBeach);

        const funRoad = new THREE.Mesh(
          new THREE.BoxGeometry(7.0,.08,2.0),
          new THREE.MeshStandardMaterial({color:0xe0c78f,roughness:.9})
        );
        const funEntrance = islandCoord(990,470,0);
        funRoad.position.set(funEntrance.x,.28,funEntrance.z);
        funRoad.rotation.y=-.33;
        islandScene.add(funRoad);

        // 入口大牌“游乐园游乐区”。
        const signCanvas=document.createElement("canvas");
        signCanvas.width=512;signCanvas.height=128;
        const signCtx=signCanvas.getContext("2d");
        signCtx.fillStyle="#f6c84f";signCtx.fillRect(0,0,512,128);
        signCtx.strokeStyle="#ffffff";signCtx.lineWidth=12;signCtx.strokeRect(7,7,498,114);
        signCtx.fillStyle="#24303a";signCtx.font="bold 56px Microsoft YaHei,sans-serif";
        signCtx.textAlign="center";signCtx.textBaseline="middle";
        signCtx.fillText("游乐园游乐区",256,66);
        const signTexture=new THREE.CanvasTexture(signCanvas);
        signTexture.colorSpace=THREE.SRGBColorSpace;
        const signMat=new THREE.MeshBasicMaterial({map:signTexture});
        const gatePos=islandCoord(1000,452,0);
        const sign=new THREE.Mesh(new THREE.PlaneGeometry(4.6,1.15),signMat);
        sign.position.set(gatePos.x,3.15,gatePos.z);
        islandScene.add(sign);
        const gatePoleMat=new THREE.MeshStandardMaterial({color:0x52cbe8,roughness:.45});
        [-1.95,1.95].forEach(dx=>{
          const pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,3.8,14),gatePoleMat);
          pole.position.set(gatePos.x+dx,1.9,gatePos.z);
          islandScene.add(pole);
        });

        const rideColor={
          slide:0xff7996,swing:0x62d6ff,trampoline:0x9b79ff,spinner:0xffd65e,
          seesaw:0x72df8b,rainbow:0xff8bcf,moving:0x60d0da,maze:0xf0a35d
        };
        const posOf=(id)=>{
          const r=AMUSEMENT_ZONE.rides.find(x=>x.id===id);
          return r ? islandCoord(r.x,r.y,0) : new THREE.Vector3();
        };

        // 1 大型滑梯
        {
          const p=posOf("slide");
          const g=new THREE.Group(); g.position.copy(p);
          const tower=new THREE.Mesh(new THREE.CylinderGeometry(.65,.78,2.8,20),new THREE.MeshStandardMaterial({color:0x63d6ff,roughness:.55}));
          tower.position.set(-1.0,1.55,0);g.add(tower);
          const ramp=new THREE.Mesh(new THREE.BoxGeometry(4.0,.22,1.0),new THREE.MeshStandardMaterial({color:rideColor.slide,roughness:.55}));
          ramp.position.set(.65,1.45,0);ramp.rotation.z=-.42;g.add(ramp);
          const landing=new THREE.Mesh(new THREE.CylinderGeometry(.9,1.0,.18,24),new THREE.MeshStandardMaterial({color:0xffd65e,roughness:.55}));
          landing.position.set(2.4,.35,0);g.add(landing);
          g.userData.amusementRide="slide";setMeshShadow(g);islandScene.add(g);
        }

        // 2 坦克秋千
        {
          const p=posOf("swing");
          const g=new THREE.Group();g.position.copy(p);g.userData.amusementRide="swing";
          const mat=new THREE.MeshStandardMaterial({color:rideColor.swing,roughness:.52});
          [-1.1,1.1].forEach(x=>{
            const leg=new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,3.0,12),mat);
            leg.position.set(x,1.55,0);g.add(leg);
          });
          const top=new THREE.Mesh(new THREE.BoxGeometry(2.5,.16,.16),mat);top.position.y=3.0;g.add(top);
          const seat=new THREE.Mesh(new THREE.BoxGeometry(1.25,.18,.95),new THREE.MeshStandardMaterial({color:0xffd65e,roughness:.6}));
          seat.position.y=.75;g.add(seat);
          [-.45,.45].forEach(x=>{
            const rope=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,2.1,8),new THREE.MeshStandardMaterial({color:0xf4f0e5}));
            rope.position.set(x,1.8,0);g.add(rope);
          });
          setMeshShadow(g);islandScene.add(g);
        }

        // 3 蹦床区
        {
          const p=posOf("trampoline");
          const g=new THREE.Group();g.position.copy(p);g.userData.amusementRide="trampoline";
          [[0,0],[-1.1,.65],[1.1,.65],[-1.0,-.75],[1.0,-.75]].forEach((q,i)=>{
            const pad=new THREE.Mesh(new THREE.CylinderGeometry(.65,.72,.18,28),new THREE.MeshStandardMaterial({color:[0x9b79ff,0xff7996,0x62d6ff,0xffd65e,0x72df8b][i],roughness:.45}));
            pad.position.set(q[0],.3,q[1]);g.add(pad);
          });
          setMeshShadow(g);islandScene.add(g);
        }

        // 4 旋转娱乐盘
        {
          const p=posOf("spinner");
          const g=new THREE.Group();g.position.copy(p);g.userData.amusementRide="spinner";
          const disc=new THREE.Mesh(new THREE.CylinderGeometry(1.75,1.85,.24,40),new THREE.MeshStandardMaterial({color:rideColor.spinner,roughness:.5}));
          disc.position.y=.32;g.add(disc);
          const hub=new THREE.Mesh(new THREE.CylinderGeometry(.35,.45,.7,20),new THREE.MeshStandardMaterial({color:0xff7f9a,roughness:.5}));
          hub.position.y=.75;g.add(hub);
          setMeshShadow(g);islandScene.add(g);
        }

        // 5 跷跷板
        {
          const p=posOf("seesaw");
          const g=new THREE.Group();g.position.copy(p);g.userData.amusementRide="seesaw";
          const pivot=new THREE.Mesh(new THREE.CylinderGeometry(.28,.5,.75,18),new THREE.MeshStandardMaterial({color:0x7b8cff,roughness:.58}));
          pivot.position.y=.55;g.add(pivot);
          const board=new THREE.Mesh(new THREE.BoxGeometry(3.5,.22,.82),new THREE.MeshStandardMaterial({color:rideColor.seesaw,roughness:.55}));
          board.position.y=1.05;board.rotation.z=.12;g.add(board);
          setMeshShadow(g);islandScene.add(g);
        }

        // 6 彩虹跳台
        {
          const pads=[[1118,620],[1135,603],[1153,588],[1172,575],[1190,562],[1208,548]];
          const colors=[0xff6f86,0xffa84d,0xffe05b,0x6edb8a,0x61cfff,0x9a78ff];
          pads.forEach((q,i)=>{
            const p=islandCoord(q[0],q[1],0);
            const pad=new THREE.Mesh(new THREE.CylinderGeometry(.48,.55,.18,24),new THREE.MeshStandardMaterial({color:colors[i],roughness:.52}));
            pad.position.set(p.x,.32+i*.12,p.z);pad.userData.amusementRide="rainbow";islandScene.add(pad);
          });
        }

        // 7 移动平台区
        {
          const p=posOf("moving");
          const g=new THREE.Group();g.position.copy(p);g.userData.amusementRide="moving";
          const rail=new THREE.Mesh(new THREE.BoxGeometry(4.8,.10,.18),new THREE.MeshStandardMaterial({color:0xdbe7ea,roughness:.6}));
          rail.position.y=.3;g.add(rail);
          const platform=new THREE.Mesh(new THREE.BoxGeometry(1.8,.22,1.15),new THREE.MeshStandardMaterial({color:rideColor.moving,roughness:.5}));
          platform.position.y=.48;platform.userData.movingPlatform=true;g.add(platform);
          setMeshShadow(g);islandScene.add(g);
        }

        // 8 小型迷宫
        if (Array.isArray(AMUSEMENT_ZONE.mazeWalls)) {
          const wallMat=new THREE.MeshStandardMaterial({color:0x7b5942,roughness:.82});
          AMUSEMENT_ZONE.mazeWalls.forEach(w=>{
            const center=islandCoord(w.x+w.w/2,w.y+w.h/2,0);
            const wall=new THREE.Mesh(new THREE.BoxGeometry(w.w/26,.85,w.h/26),wallMat);
            wall.position.set(center.x,.68,center.z);wall.userData.amusementRide="maze";setMeshShadow(wall);islandScene.add(wall);
          });
          const goal=islandCoord(1168,728,0);
          const chest=new THREE.Mesh(new THREE.BoxGeometry(.65,.5,.55),new THREE.MeshStandardMaterial({color:0xffd65e,metalness:.08,roughness:.55}));
          chest.position.set(goal.x,.55,goal.z);islandScene.add(chest);
        }
      }

      // 超巨型剧情迷宫区：独立大平台、跳台、高墙、剧情节点和出口门。
      {
        const mazeCfg = globalThis.GIANT_STORY_MAZE;
        if (mazeCfg) {
          const b = mazeCfg.bounds;
          const cx = (b.x1 + b.x2) / 2;
          const cy = (b.y1 + b.y2) / 2;
          const center = islandCoord(cx, cy, 0);

          const beach = new THREE.Mesh(
            new THREE.BoxGeometry((b.x2-b.x1)/26 + 1.1, .34, (b.y2-b.y1)/26 + 1.1),
            new THREE.MeshStandardMaterial({color:0xe5cd82,roughness:1})
          );
          beach.position.set(center.x,.02,center.z);
          beach.receiveShadow=true;
          islandScene.add(beach);

          const platform = new THREE.Mesh(
            new THREE.BoxGeometry((b.x2-b.x1)/26, .42, (b.y2-b.y1)/26),
            new THREE.MeshStandardMaterial({color:0x557f49,roughness:.95})
          );
          platform.position.set(center.x,.18,center.z);
          platform.castShadow=true; platform.receiveShadow=true;
          islandScene.add(platform);

          // 跨海跳台。
          (mazeCfg.jumpPads||[]).forEach((q,i)=>{
            const p=islandCoord(q.x,q.y,0);
            const pad=new THREE.Mesh(
              new THREE.CylinderGeometry(.7,.78,.22,24),
              new THREE.MeshStandardMaterial({color:i===0?0xffd65e:0x61cfff,roughness:.48})
            );
            pad.position.set(p.x,.34,p.z);
            pad.castShadow=true;islandScene.add(pad);
          });

          // 入口招牌。
          const signCanvas=document.createElement("canvas");
          signCanvas.width=512;signCanvas.height=128;
          const sctx=signCanvas.getContext("2d");
          sctx.fillStyle="#f6c84f";sctx.fillRect(0,0,512,128);
          sctx.strokeStyle="#fff";sctx.lineWidth=10;sctx.strokeRect(6,6,500,116);
          sctx.fillStyle="#25313a";sctx.font="bold 52px Microsoft YaHei,sans-serif";
          sctx.textAlign="center";sctx.textBaseline="middle";sctx.fillText("巨型剧情迷宫",256,66);
          const st=new THREE.CanvasTexture(signCanvas);st.colorSpace=THREE.SRGBColorSpace;
          const sp=islandCoord(1425,540,0);
          const sign=new THREE.Mesh(new THREE.PlaneGeometry(4.5,1.1),new THREE.MeshBasicMaterial({map:st}));
          sign.position.set(sp.x,3.2,sp.z);islandScene.add(sign);
          const poleMat=new THREE.MeshStandardMaterial({color:0x55d6ef,roughness:.45});
          [-1.85,1.85].forEach(dx=>{
            const pole=new THREE.Mesh(new THREE.CylinderGeometry(.11,.15,3.7,12),poleMat);
            pole.position.set(sp.x+dx,1.85,sp.z);islandScene.add(pole);
          });

          // 迷宫高墙。
          const wallMat=new THREE.MeshStandardMaterial({color:0x3f4c52,roughness:.78,metalness:.08});
          (mazeCfg.walls||[]).forEach(w=>{
            const p=islandCoord(w.x+w.w/2,w.y+w.h/2,0);
            const wall=new THREE.Mesh(new THREE.BoxGeometry(w.w/26,1.75,w.h/26),wallMat);
            wall.position.set(p.x,1.1,p.z);
            wall.castShadow=true;wall.receiveShadow=true;
            wall.userData.giantMazeWall=true;
            islandScene.add(wall);
          });

          // 跳跃断层。
          const pitMat=new THREE.MeshStandardMaterial({color:0x101820,emissive:0x062030,emissiveIntensity:.45,roughness:.65});
          (mazeCfg.pits||[]).forEach(q=>{
            const p=islandCoord(q.x+q.w/2,q.y+q.h/2,0);
            const pit=new THREE.Mesh(new THREE.BoxGeometry(q.w/26,.05,q.h/26),pitMat);
            pit.position.set(p.x,.42,p.z);
            islandScene.add(pit);
          });

          // 三个剧情信标。
          (mazeCfg.storyNodes||[]).forEach((n,i)=>{
            const p=islandCoord(n.x,n.y,0);
            const beacon=new THREE.Group();
            beacon.position.set(p.x,.42,p.z);
            beacon.userData.giantMazeNode=i;
            const base=new THREE.Mesh(new THREE.CylinderGeometry(.5,.58,.18,24),
              new THREE.MeshStandardMaterial({color:0x6f7b84,roughness:.55}));
            base.position.y=.1;beacon.add(base);
            const orb=new THREE.Mesh(new THREE.SphereGeometry(.28,18,12),
              new THREE.MeshStandardMaterial({color:0xffd65e,emissive:0x6e5000,emissiveIntensity:.75}));
            orb.position.y=.78;beacon.add(orb);
            islandScene.add(beacon);
          });

          // 出口门。
          const ep=islandCoord(mazeCfg.exit.x,mazeCfg.exit.y,0);
          const exitGroup=new THREE.Group();
          exitGroup.position.set(ep.x,.4,ep.z);
          exitGroup.userData.giantMazeExit=true;
          const exitMat=new THREE.MeshStandardMaterial({color:0x68727a,emissive:0x101820,emissiveIntensity:.25,roughness:.45});
          [-.75,.75].forEach(x=>{
            const pole=new THREE.Mesh(new THREE.BoxGeometry(.22,2.8,.22),exitMat);
            pole.position.set(x,1.4,0);exitGroup.add(pole);
          });
          const top=new THREE.Mesh(new THREE.BoxGeometry(1.72,.25,.25),exitMat);
          top.position.set(0,2.72,0);exitGroup.add(top);
          const portal=new THREE.Mesh(new THREE.PlaneGeometry(1.3,2.15),
            new THREE.MeshBasicMaterial({color:0x66e28a,transparent:true,opacity:.22,side:THREE.DoubleSide}));
          portal.position.set(0,1.4,.03);exitGroup.add(portal);
          islandScene.add(exitGroup);
        }
      }

      islandStaticBuilt = true;
    }

    return true;
  }

  function ensureEmoteSprite() {
    if (islandEmoteSprite) return islandEmoteSprite;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    islandEmoteSprite = new THREE.Sprite(material);
    islandEmoteSprite.scale.set(1.4, 1.4, 1.4);
    islandEmoteSprite.visible = false;
    islandEmoteTexture = { canvas, texture };
    islandScene.add(islandEmoteSprite);
    return islandEmoteSprite;
  }

  function updateIslandSocial3D(s) {
    const social = window.islandSocialState || {};
    const now = performance.now();

    // 表情：人和坦克都可用，始终显示在当前控制对象头顶。
    const sprite = ensureEmoteSprite();
    if (social.emote && social.emoteUntil > now) {
      const ctx2 = islandEmoteTexture.canvas.getContext("2d");
      ctx2.clearRect(0,0,128,128);
      ctx2.font = "86px sans-serif";
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.fillText(social.emote,64,66);
      islandEmoteTexture.texture.needsUpdate = true;

      if (s.mounted) {
        const p = islandCoord(s.player.x, s.player.y, 0);
        sprite.position.set(p.x, 2.05 + (s.player.z || 0)/24, p.z);
      } else {
        const p = islandCoord(s.human.x, s.human.y, 0);
        sprite.position.set(p.x, 1.72 + (s.human.z || 0)/24, p.z);
      }
      sprite.visible = true;
    } else {
      sprite.visible = false;
    }

    // 动作只作用于下车人物。
    if (islandHumanMesh) {
      islandHumanMesh.rotation.set(0,0,0);
      islandHumanMesh.scale.set(1,1,1);
      if (!s.mounted && social.action && social.actionUntil > now) {
        const t = now / 250;
        if (social.action === "挥手") {
          islandHumanMesh.rotation.z = Math.sin(t*2) * 0.18;
        } else if (social.action === "跳舞") {
          islandHumanMesh.rotation.y = Math.sin(t) * 0.75;
          islandHumanMesh.position.y += Math.abs(Math.sin(t*2))*0.12;
        } else if (social.action === "敬礼") {
          islandHumanMesh.rotation.z = -0.12;
          islandHumanMesh.rotation.x = 0.06;
        } else if (social.action === "鼓掌") {
          const s2 = 1 + Math.abs(Math.sin(t*3))*0.05;
          islandHumanMesh.scale.set(s2,1,s2);
        } else if (social.action === "坐下") {
          islandHumanMesh.scale.y = 0.72;
          islandHumanMesh.position.y -= 0.12;
        }
      }
    }
  }

  function syncIsland3D() {
    if (!islandWorldActive || !islandWorldState) return;
    if (!ensureIsland3D()) return;

    const s = islandWorldState;
    const tankColor = typeof activeIslandSkin === "function" && activeIslandSkin()
      ? activeIslandSkin().color
      : (PLAYER_TANK_CLASSES[islandWorldTankType]?.color || "#ffd23f");

    if (!islandTankMesh) {
      islandTankMesh = makeTankMesh(tankColor, 0.82);
      islandScene.add(islandTankMesh);
    }
    islandTankMesh.children.forEach((child, idx) => {
      if (idx === 0 && child.material?.color) child.material.color.set(tankColor);
    });

    const tp = islandCoord(s.player.x, s.player.y, 0);
    islandTankMesh.position.set(tp.x, 0.22 + (s.player.z || 0) / 24, tp.z);
    const dirX = s.tankDirX || 0;
    const dirY = s.tankDirY || -1;
    islandTankMesh.rotation.y = Math.atan2(-dirX, -dirY);

    if (!s.mounted) {
      if (!islandHumanMesh) {
        const clothes = typeof activeIslandClothes === "function" ? activeIslandClothes() : { color: "#56c271" };
        islandHumanMesh = makeHumanMesh(clothes.color);
        islandScene.add(islandHumanMesh);
      }
      const hp = islandCoord(s.human.x, s.human.y, 0);
      islandHumanMesh.position.set(hp.x, 0.22 + (s.human.z || 0) / 24, hp.z);
      islandHumanMesh.visible = true;
    } else if (islandHumanMesh) {
      islandHumanMesh.visible = false;
    }

    const pet = typeof activeIslandPet === "function" ? activeIslandPet() : null;
    if (pet) {
      if (!islandPetMesh || islandPetId !== pet.id) {
        if (islandPetMesh) islandScene.remove(islandPetMesh);
        islandPetMesh = makeIslandPetMesh(pet);
        islandPetId = pet.id;
        islandScene.add(islandPetMesh);
      }
      const mover = s.mounted ? s.player : s.human;
      const follow = islandCoord(mover.x - 22, mover.y + 20, 0);
      islandPetMesh.position.set(follow.x, .25 + (mover.z||0)/24 + Math.abs(Math.sin(performance.now()/260))*.12, follow.z);
      islandPetMesh.rotation.y = performance.now()/900;
      islandPetMesh.visible = true;
    } else if (islandPetMesh) {
      islandPetMesh.visible = false;
    }

    const live = new Set();
    for (const b of s.islandBullets || []) {
      live.add(b);
      let mesh = islandBulletMeshes.get(b);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0xffe36b, emissive: 0x6a4f00, emissiveIntensity: 0.9 })
        );
        islandBulletMeshes.set(b, mesh);
        islandScene.add(mesh);
      }
      const p = islandCoord(b.x, b.y);
      mesh.position.set(p.x, 0.65, p.z);
    }
    for (const [b, mesh] of islandBulletMeshes) {
      if (!live.has(b)) {
        islandScene.remove(mesh);
        islandBulletMeshes.delete(b);
      }
    }

    updateIslandSocial3D(s);
  }

  function resizeRenderer(renderer, camera, host) {
    if (!renderer || !camera || !host) return;
    const rect = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function updateVisibility() {
    // 主战场始终由WebGL呈现，菜单overlay仍在最上层。
    gameCanvas2D.classList.add("real3d-source-hidden");
    mainHost.classList.toggle("real3d-hidden", !!islandWorldActive);

    const islandCanvas = document.getElementById("island-world-canvas");
    if (islandCanvas && islandWorldActive) {
      islandCanvas.classList.add("real3d-source-hidden");
      ensureIsland3D();
      islandHost?.classList.remove("real3d-hidden");
    } else {
      islandHost?.classList.add("real3d-hidden");
    }
  }

  function render3DLoop() {
    updateVisibility();

    if (!islandWorldActive) {
      buildMainStaticScene();
      syncMainDynamics();
      resizeRenderer(mainRenderer, mainCameraSetup.camera, mainHost);
      if (player && player.alive && playerMesh) {
        followCameraWithTarget(mainCameraSetup, mainFollowTarget, mainFollowPrev, 0.18);
      }
      mainCameraSetup.controls.update();
      mainRenderer.render(mainScene, mainCameraSetup.camera);
    } else if (ensureIsland3D()) {
      syncIsland3D();
      resizeRenderer(islandRenderer, islandCameraSetup.camera, islandHost);
      if (islandWorldState) {
        const s = islandWorldState;
        const mover = s.mounted ? s.player : s.human;
        if (mover) {
          const followPos = islandCoord(mover.x, mover.y, 0);
          followPos.y = s.mounted ? 0.95 + (mover.z || 0) / 24 : 1.15 + (mover.z || 0) / 24;
          followCameraWithTarget(
            islandCameraSetup,
            followPos,
            islandCameraSetup.followPrev || (islandCameraSetup.followPrev = followPos.clone()),
            0.16
          );
        }
      }
      islandCameraSetup.controls.update();

      // 摩天轮真正3D旋转
      const wheel = islandScene.children.find((o) => o.userData?.buildingId === "wheel");
      if (wheel) wheel.rotation.z += 0.0035;

      // 游乐园动态设施。
      const funState=islandWorldState?.amusement;
      const spinner=islandScene.children.find(o=>o.userData?.amusementRide==="spinner");
      if(spinner)spinner.rotation.y+=0.018;
      const swing=islandScene.children.find(o=>o.userData?.amusementRide==="swing");
      if(swing)swing.rotation.x=Math.sin(performance.now()/430)*0.08;
      const movingRide=islandScene.children.find(o=>o.userData?.amusementRide==="moving");
      const movingPlatform=movingRide?.children?.find(o=>o.userData?.movingPlatform);
      if(movingPlatform)movingPlatform.position.x=Math.sin((funState?.phase||performance.now()/1000)*1.5)*1.62;
      const seesaw=islandScene.children.find(o=>o.userData?.amusementRide==="seesaw");
      if(seesaw)seesaw.rotation.z=Math.sin(performance.now()/520)*0.07;

      // 剧情迷宫信标和出口随进度变化。
      const mazeStage=islandWorldState?.giantMaze?.stage||0;
      islandScene.children.forEach(o=>{
        if(Number.isInteger(o.userData?.giantMazeNode)){
          const idx=o.userData.giantMazeNode;
          const orb=o.children?.[1];
          if(orb?.material?.color){
            orb.material.color.setHex(idx<mazeStage?0x68e58a:(idx===mazeStage?0xffd65e:0x78838b));
            orb.rotation.y+=0.025;
          }
        }
      });
      const mazeExit=islandScene.children.find(o=>o.userData?.giantMazeExit);
      if(mazeExit){
        const unlocked=mazeStage>=3;
        mazeExit.children?.forEach(ch=>{
          if(ch.material?.color && !ch.material.transparent) ch.material.color.setHex(unlocked?0x66e28a:0x68727a);
        });
      }

      islandRenderer.render(islandScene, islandCameraSetup.camera);
    }

    requestAnimationFrame(render3DLoop);
  }

  window.addEventListener("keydown", (e) => {
    if (e.code !== "KeyC" || e.repeat) return;
    if (islandWorldActive && islandCameraSetup) {
      const s = islandWorldState;
      const mover = s ? (s.mounted ? s.player : s.human) : null;
      if (mover) {
        const p = islandCoord(mover.x, mover.y, 0);
        p.y = s.mounted ? 0.95 : 1.15;
        islandCameraSetup.controls.target.copy(p);
        islandCameraSetup.camera.position.set(p.x + 4.4, p.y + 4.6, p.z + 5.6);
        islandCameraSetup.followPrev = p.clone();
        islandCameraSetup.controls.update();
      } else {
        islandCameraSetup.reset();
      }
    } else if (player && player.alive && playerMesh) {
      const p = playerMesh.position.clone();
      p.y += player.isFlying ? 0.8 : 0.7;
      mainCameraSetup.controls.target.copy(p);
      mainCameraSetup.camera.position.set(p.x + 4.0, p.y + 4.3, p.z + 5.2);
      mainFollowPrev.copy(p);
      mainCameraSetup.controls.update();
    } else {
      mainCameraSetup.reset();
    }
  }, true);

  // 阻止右键菜单，右键拖动专门用于相机平移。
  [mainRenderer.domElement].forEach((el) => {
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  });

  // 岛屿渲染器可能稍后才创建。
  document.addEventListener("contextmenu", (e) => {
    if (e.target?.classList?.contains("real3d-canvas")) e.preventDefault();
  });

  requestAnimationFrame(render3DLoop);
})();
