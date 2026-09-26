// 原创“坦克派对”背景音乐系统。
// 使用 Web Audio API 实时合成，不依赖外部音乐文件；坦克岛/战斗/派对模式自动切歌。
(function initTankPartyMusic(){
  const MUSIC_KEY = "tankPartyMusic_v1";
  let ctx = null;
  let master = null;
  let limiter = null;
  let musicOn = true;
  let unlocked = false;
  let currentTheme = "";
  let nextNoteTime = 0;
  let step = 0;
  let schedulerTimer = 0;

  try {
    const saved = JSON.parse(localStorage.getItem(MUSIC_KEY) || "null");
    if (saved && typeof saved.on === "boolean") musicOn = saved.on;
  } catch (_) {}

  const THEMES = {
    island: {
      bpm: 116,
      lead: [72,76,79,76,74,77,81,77,72,76,79,83,81,79,77,74],
      bass: [48,48,53,53,45,45,50,50],
      chords: [[60,64,67],[65,69,72],[57,60,64],[62,65,69]],
      wave: "triangle",
      gain: 0.058,
    },
    battle: {
      bpm: 142,
      lead: [64,67,71,67,64,69,72,69,62,65,69,65,62,67,71,74],
      bass: [40,40,43,43,38,38,45,45],
      chords: [[52,55,59],[50,55,59],[50,53,57],[55,59,62]],
      wave: "sawtooth",
      gain: 0.050,
    },
    party: {
      bpm: 132,
      lead: [74,78,81,86,81,78,76,79,83,88,83,79,74,78,81,83],
      bass: [50,50,55,55,47,47,52,52],
      chords: [[62,66,69],[67,71,74],[59,62,66],[64,67,71]],
      wave: "square",
      gain: 0.047,
    }
  };

  function midi(n){ return 440 * Math.pow(2,(n-69)/12); }

  function save(){
    try { localStorage.setItem(MUSIC_KEY, JSON.stringify({on:musicOn})); } catch (_) {}
  }

  function desiredTheme(){
    try {
      if (typeof partySpecialActive !== "undefined" && partySpecialActive) return "party";
      if (typeof islandGameActive !== "undefined" && islandGameActive) return "party";
      if (typeof tankTowerActive !== "undefined" && tankTowerActive) return "island";
      if (typeof islandWorldActive !== "undefined" && islandWorldActive) return "island";
      if (typeof state !== "undefined" && (state === "playing" || state === "paused" || state === "levelclear")) return "battle";
    } catch (_) {}
    return "island";
  }

  function ensureAudio(){
    if (ctx) return true;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    ctx = new AudioCtx();
    master = ctx.createGain();
    limiter = ctx.createDynamicsCompressor();
    master.gain.value = musicOn ? 0.78 : 0.0001;
    limiter.threshold.value = -8;
    limiter.knee.value = 12;
    limiter.ratio.value = 4;
    limiter.attack.value = 0.006;
    limiter.release.value = 0.18;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    nextNoteTime = ctx.currentTime + 0.08;
    return true;
  }

  async function unlock(){
    if (!ensureAudio()) return;
    try { if (ctx.state !== "running") await ctx.resume(); } catch (_) {}
    unlocked = ctx.state === "running";
    if (unlocked && !schedulerTimer) schedulerTimer = setInterval(schedule, 55);
  }

  function tone(freq,start,dur,type,gain,pan=0){
    if (!ctx || !master || !musicOn) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.type = type;
    osc.frequency.setValueAtTime(freq,start);
    g.gain.setValueAtTime(0.0001,start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002,gain),start+0.018);
    g.gain.exponentialRampToValueAtTime(0.0001,start+dur);
    osc.connect(g);
    if (p) {
      p.pan.setValueAtTime(pan,start);
      g.connect(p); p.connect(master);
    } else {
      g.connect(master);
    }
    osc.start(start);
    osc.stop(start+dur+0.03);
  }

  function kick(start,gain){
    if (!ctx || !master || !musicOn) return;
    const osc=ctx.createOscillator(), g=ctx.createGain();
    osc.type="sine";
    osc.frequency.setValueAtTime(120,start);
    osc.frequency.exponentialRampToValueAtTime(52,start+.12);
    g.gain.setValueAtTime(gain,start);
    g.gain.exponentialRampToValueAtTime(.0001,start+.15);
    osc.connect(g);g.connect(master);osc.start(start);osc.stop(start+.17);
  }

  function hat(start,gain){
    if (!ctx || !master || !musicOn) return;
    const len=Math.floor(ctx.sampleRate*.035);
    const buffer=ctx.createBuffer(1,len,ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<len;i++) data[i]=(Math.random()*2-1)*(1-i/len);
    const src=ctx.createBufferSource(), hp=ctx.createBiquadFilter(), g=ctx.createGain();
    src.buffer=buffer;hp.type="highpass";hp.frequency.value=6500;g.gain.value=gain;
    src.connect(hp);hp.connect(g);g.connect(master);src.start(start);
  }

  function scheduleStep(themeName, when, index){
    const t=THEMES[themeName];
    const beat=60/t.bpm;
    const lead=t.lead[index % t.lead.length];
    const bass=t.bass[Math.floor(index/2) % t.bass.length];
    const chord=t.chords[Math.floor(index/4) % t.chords.length];

    // 8分音符主旋律。
    tone(midi(lead),when,beat*.38,t.wave,t.gain,index%2?.18:-.18);

    // 每拍低音。
    if(index%2===0) tone(midi(bass),when,beat*.72,"triangle",t.gain*.82,-.28);

    // 每两拍轻铺和弦。
    if(index%4===0) {
      chord.forEach((n,i)=>tone(midi(n),when,beat*1.65,"sine",t.gain*.26,(i-1)*.24));
    }

    // 简单鼓组。
    if(index%2===0) kick(when,t.gain*.75);
    if(index%2===1) hat(when,t.gain*.48);
  }

  function schedule(){
    if (!ctx || !unlocked || !musicOn) return;
    const wanted=desiredTheme();
    if (wanted !== currentTheme) {
      currentTheme=wanted;
      step=0;
      nextNoteTime=Math.max(ctx.currentTime+.04,nextNoteTime);
      updateButton();
    }
    const t=THEMES[currentTheme || "island"];
    const stepDur=(60/t.bpm)/2;
    while(nextNoteTime < ctx.currentTime + .26) {
      scheduleStep(currentTheme || "island",nextNoteTime,step++);
      nextNoteTime += stepDur;
    }
  }

  function toggle(){
    musicOn=!musicOn;
    save();
    if (musicOn) {
      unlock();
      if (master && ctx) master.gain.setTargetAtTime(.78,ctx.currentTime,.04);
      nextNoteTime=ctx ? ctx.currentTime+.05 : 0;
    } else if (master && ctx) {
      master.gain.setTargetAtTime(.0001,ctx.currentTime,.03);
    }
    updateButton();
  }

  function updateButton(){
    const btn=document.getElementById("music-toggle-btn");
    if(!btn)return;
    const labels={island:"坦克岛",battle:"战斗",party:"派对"};
    btn.textContent=musicOn ? "🔊" : "🔇";
    btn.title=musicOn ? `音乐开启 · ${labels[currentTheme]||"坦克岛"}` : "音乐关闭";
    btn.setAttribute("aria-label",btn.title);
  }

  const btn=document.createElement("button");
  btn.id="music-toggle-btn";
  btn.className="music-toggle-btn";
  btn.type="button";
  btn.addEventListener("click",(e)=>{e.preventDefault();e.stopPropagation();toggle();});
  document.getElementById("canvas-wrap")?.appendChild(btn);
  updateButton();

  // 浏览器禁止无交互自动播放，因此第一次点击/触摸/按键时启动。
  const firstUnlock=()=>{
    if (musicOn) unlock();
    window.removeEventListener("pointerdown",firstUnlock,true);
    window.removeEventListener("keydown",firstUnlock,true);
  };
  window.addEventListener("pointerdown",firstUnlock,true);
  window.addEventListener("keydown",firstUnlock,true);

  window.addEventListener("keydown",(e)=>{
    if(e.code==="KeyM"&&!e.repeat){
      e.preventDefault();
      toggle();
    }
  });

  setInterval(()=>{
    const wanted=desiredTheme();
    if(wanted!==currentTheme && unlocked){
      currentTheme=wanted;step=0;nextNoteTime=ctx.currentTime+.06;updateButton();
    }
  },300);
})();