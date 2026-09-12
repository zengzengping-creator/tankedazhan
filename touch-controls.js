// 手机版触控操作与PWA安装入口。
(function initTouchControls(){
  const coarse = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

  const keyMap = {
    up:    { code:"ArrowUp", key:"ArrowUp" },
    down:  { code:"ArrowDown", key:"ArrowDown" },
    left:  { code:"ArrowLeft", key:"ArrowLeft" },
    right: { code:"ArrowRight", key:"ArrowRight" },
    fire:  { code:"Space", key:" " },
    skill: { code:"KeyQ", key:"q" },
    item:  { code:"KeyF", key:"f" },
    jump:  { code:"KeyJ", key:"j" },
    enter: { code:"KeyE", key:"e" },
    mount: { code:"KeyB", key:"b" }
  };

  function emit(action, down){
    const k = keyMap[action];
    if(!k) return;
    window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", {
      code:k.code, key:k.key, bubbles:true, cancelable:true
    }));
  }

  function makeButton(action,label){
    const b=document.createElement("button");
    b.type="button";
    b.className="touch-btn";
    b.dataset.touchAction=action;
    b.textContent=label;
    const press=(e)=>{e.preventDefault();e.stopPropagation();emit(action,true);b.classList.add("pressed");};
    const release=(e)=>{e.preventDefault();e.stopPropagation();emit(action,false);b.classList.remove("pressed");};
    b.addEventListener("pointerdown",press);
    b.addEventListener("pointerup",release);
    b.addEventListener("pointercancel",release);
    b.addEventListener("pointerleave",(e)=>{ if(e.buttons) release(e); });
    return b;
  }

  const wrap=document.getElementById("canvas-wrap");
  if(!wrap) return;

  const controls=document.createElement("div");
  controls.id="mobile-controls";
  controls.innerHTML=`
    <div class="mobile-dpad">
      <div></div><div class="slot-up"></div><div></div>
      <div class="slot-left"></div><div class="dpad-center"></div><div class="slot-right"></div>
      <div></div><div class="slot-down"></div><div></div>
    </div>
    <div class="mobile-actions">
      <div class="mobile-actions-top"></div>
      <div class="mobile-actions-bottom"></div>
    </div>`;
  wrap.appendChild(controls);

  controls.querySelector(".slot-up").appendChild(makeButton("up","▲"));
  controls.querySelector(".slot-down").appendChild(makeButton("down","▼"));
  controls.querySelector(".slot-left").appendChild(makeButton("left","◀"));
  controls.querySelector(".slot-right").appendChild(makeButton("right","▶"));

  const top=controls.querySelector(".mobile-actions-top");
  const bottom=controls.querySelector(".mobile-actions-bottom");
  top.append(makeButton("skill","Q 技能"),makeButton("item","F 道具"),makeButton("jump","J 跳"));
  bottom.append(makeButton("enter","E 互动"),makeButton("mount","B 下车"),makeButton("fire","● 开火"));

  if(coarse) document.body.classList.add("touch-device");

  // 安装APP
  let deferredPrompt=null;
  const install=document.createElement("button");
  install.id="install-app-btn";
  install.type="button";
  install.textContent="📲 安装APP";
  install.className="install-app-btn hidden";
  document.body.appendChild(install);

  window.addEventListener("beforeinstallprompt",(e)=>{
    e.preventDefault();
    deferredPrompt=e;
    install.classList.remove("hidden");
  });

  install.addEventListener("click",async()=>{
    if(deferredPrompt){
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt=null;
      install.classList.add("hidden");
      return;
    }
    const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
    alert(ios
      ? "iPhone：点击Safari底部“分享”按钮，再选择“添加到主屏幕”。"
      : "请使用浏览器菜单中的“安装应用”或“添加到主屏幕”。");
  });

  window.addEventListener("appinstalled",()=>install.classList.add("hidden"));

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>{
      navigator.serviceWorker.register("./service-worker.js").catch(console.error);
    });
  }
})();