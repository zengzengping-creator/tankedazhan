// 真正的 Three.js / WebGL 3D 渲染层。
// 保留原游戏逻辑，主战斗和坦克岛都由 PerspectiveCamera + OrbitControls 实时呈现。
// 鼠标左键旋转、滚轮缩放、右键平移，C键重置相机。

(async function initReal3D() {
  const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
  const ORBIT_URL = "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";

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
    scene.add(new THREE.HemisphereLight(0xcfefff, 0x34452f, 1.75));
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(8, 15, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    scene.add(sun);
  }

  function makeRenderer(parent, className) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(520, 520, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
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
    controls.minDistance = 5;
    controls.maxDistance = 34;
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
    new THREE.Vector3(10.5, 11.5, 13.5),
    new THREE.Vector3(0, 0.8, 0)
  );

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
  const islandBulletMeshes = new Map();

  function islandCoord(x, y, height = 0) {
    return new THREE.Vector3((x - 250) / 26, height, (y - 250) / 26);
  }

  function buildingHeight(id) {
    if (id === "tower") return 4.2;
    if (id === "parkour") return 5.5;
    if (id === "mall" || id === "blindbox") return 2.5;
    if (id === "range") return 1.2;
    if (id === "soccer") return 0.18;
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
      for (let floor = 0; floor < 4; floor++) {
        for (const side of [-1, 1]) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.04), glassMat);
          win.position.set(side * 0.55, 1.15 + floor * 0.68, d / 2 + 0.04);
          group.add(win);
        }
      }
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
        new THREE.PlaneGeometry(26, 26),
        new THREE.MeshStandardMaterial({ color: 0x176d91, roughness: 0.55, metalness: 0.08 })
      );
      sea.rotation.x = -Math.PI / 2;
      sea.position.y = -0.16;
      sea.receiveShadow = true;
      islandScene.add(sea);

      const island = new THREE.Mesh(
        new THREE.CylinderGeometry(8.7, 9.0, 0.42, 64),
        new THREE.MeshStandardMaterial({ color: 0x55a653, roughness: 0.98 })
      );
      island.position.y = 0;
      island.receiveShadow = true;
      island.castShadow = true;
      islandScene.add(island);

      const beach = new THREE.Mesh(
        new THREE.TorusGeometry(8.86, 0.34, 10, 64),
        new THREE.MeshStandardMaterial({ color: 0xe2cf89, roughness: 1 })
      );
      beach.rotation.x = Math.PI / 2;
      beach.position.y = 0.17;
      islandScene.add(beach);

      // 十字道路
      const roadMat = new THREE.MeshStandardMaterial({ color: 0xc6b483, roughness: 1 });
      const road1 = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.05, 0.72), roadMat);
      road1.position.y = 0.25;
      islandScene.add(road1);
      const road2 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 12.8), roadMat);
      road2.position.y = 0.25;
      islandScene.add(road2);

      islandCameraSetup = makeCamera(
        islandRenderer,
        new THREE.Vector3(12, 12, 15),
        new THREE.Vector3(0, 1.1, 0)
      );
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

      islandStaticBuilt = true;
    }

    return true;
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
      mainCameraSetup.controls.update();
      mainRenderer.render(mainScene, mainCameraSetup.camera);
    } else if (ensureIsland3D()) {
      syncIsland3D();
      resizeRenderer(islandRenderer, islandCameraSetup.camera, islandHost);
      islandCameraSetup.controls.update();

      // 摩天轮真正3D旋转
      const wheel = islandScene.children.find((o) => o.userData?.buildingId === "wheel");
      if (wheel) wheel.rotation.z += 0.0035;

      islandRenderer.render(islandScene, islandCameraSetup.camera);
    }

    requestAnimationFrame(render3DLoop);
  }

  window.addEventListener("keydown", (e) => {
    if (e.code !== "KeyC" || e.repeat) return;
    if (islandWorldActive && islandCameraSetup) islandCameraSetup.reset();
    else mainCameraSetup.reset();
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
