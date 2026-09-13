// 手机版触控操作、低延迟虚拟摇杆与PWA安装入口。
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
    const press=(e)=>{
      e.preventDefault();e.stopPropagation();
      if(b.hasPointerCapture?.(e.pointerId)===false){
        try{b.setPointerCapture(e.pointerId);}catch(_){}
      }
      emit(action,true);b.classList.add("pressed");
    };
    const release=(e)=>{
      e.preventDefault();e.stopPropagation();
      emit(action,false);b.classList.remove("pressed");
      try{if(b.hasPointerCapture?.(e.pointerId))b.releasePointerCapture(e.pointerId);}catch(_){}
    };
    b.addEventListener("pointerdown",press,{passive:false});
    b.addEventListener("pointerup",release,{passive:false});
    b.addEventListener("pointercancel",release,{passive:false});
    return b;
  }

  const wrap=document.getElementById("canvas-wrap");
  if(!wrap) return;

  // 全局只保存一个很小的摇杆状态；游戏循环每帧直接读取，不需要高频派发键盘事件。
  const joystickState={
    x:0,y:0,magnitude:0,active:false,
    digital:{up:false,down:false,left:false,right:false}
  };
  globalThis.mobileJoystickState=joystickState;

  const controls=document.createElement("div");
  controls.id="mobile-controls";
  controls.innerHTML=`
    <div class="mobile-joystick" aria-label="移动摇杆">
      <div class="mobile-joystick-ring"></div>
      <div class="mobile-joystick-knob"></div>
    </div>
    <div class="mobile-actions">
      <div class="mobile-actions-top"></div>
      <div class="mobile-actions-bottom"></div>
    </div>`;
  wrap.appendChild(controls);

  const joystick=controls.querySelector(".mobile-joystick");
  const knob=controls.querySelector(".mobile-joystick-knob");
  let joyPointer=null;
  let targetKnobX=0,targetKnobY=0;
  let renderedKnobX=999,renderedKnobY=999;
  let centerX=0,centerY=0,radius=48;

  const digitalNames=["up","down","left","right"];
  function syncDigitalDirections(){
    // 仅给仍依赖键盘事件的旧小游戏做兼容，只有跨过阈值时才发送一次事件。
    const x=joystickState.x,y=joystickState.y;
    const next={
      up:y < -0.30,
      down:y > 0.30,
      left:x < -0.30,
      right:x > 0.30
    };
    for(const name of digitalNames){
      if(next[name]!==joystickState.digital[name]){
        joystickState.digital[name]=next[name];
        emit(name,next[name]);
      }
    }
  }

  function updateJoystickFromPointer(e){
    const dx=e.clientX-centerX;
    const dy=e.clientY-centerY;
    const dist=Math.hypot(dx,dy);
    const clamped=Math.min(radius,dist);
    const nx=dist>0 ? dx/dist : 0;
    const ny=dist>0 ? dy/dist : 0;
    targetKnobX=nx*clamped;
    targetKnobY=ny*clamped;

    // 约14%死区，避免手指轻微抖动导致坦克自己走。
    const raw=Math.min(1,dist/radius);
    const dead=0.14;
    const mag=raw<=dead ? 0 : (raw-dead)/(1-dead);
    joystickState.x=mag ? nx*mag : 0;
    joystickState.y=mag ? ny*mag : 0;
    joystickState.magnitude=mag;
    syncDigitalDirections();
  }

  function resetJoystick(){
    joystickState.x=0;
    joystickState.y=0;
    joystickState.magnitude=0;
    joystickState.active=false;
    targetKnobX=0;targetKnobY=0;
    syncDigitalDirections();
  }

  joystick.addEventListener("pointerdown",(e)=>{
    e.preventDefault();e.stopPropagation();
    joyPointer=e.pointerId;
    const rect=joystick.getBoundingClientRect();
    centerX=rect.left+rect.width/2;
    centerY=rect.top+rect.height/2;
    radius=Math.max(34,Math.min(rect.width,rect.height)*0.36);
    joystickState.active=true;
    try{joystick.setPointerCapture(e.pointerId);}catch(_){}
    updateJoystickFromPointer(e);
  },{passive:false});

  joystick.addEventListener("pointermove",(e)=>{
    if(e.pointerId!==joyPointer)return;
    e.preventDefault();e.stopPropagation();
    updateJoystickFromPointer(e);
  },{passive:false});

  const endJoystick=(e)=>{
    if(joyPointer!==null && e.pointerId!==joyPointer)return;
    e.preventDefault();e.stopPropagation();
    try{if(joystick.hasPointerCapture?.(e.pointerId))joystick.releasePointerCapture(e.pointerId);}catch(_){}
    joyPointer=null;
    resetJoystick();
  };
  joystick.addEventListener("pointerup",endJoystick,{passive:false});
  joystick.addEventListener("pointercancel",endJoystick,{passive:false});

  // 摇杆视觉更新独立放在RAF里；pointermove只做少量数字计算，不反复改DOM。
  function renderJoystick(){
    if(Math.abs(renderedKnobX-targetKnobX)>.15 || Math.abs(renderedKnobY-targetKnobY)>.15){
      renderedKnobX=targetKnobX;
      renderedKnobY=targetKnobY;
      knob.style.transform=`translate3d(${renderedKnobX}px,${renderedKnobY}px,0)`;
    }
    requestAnimationFrame(renderJoystick);
  }
  requestAnimationFrame(renderJoystick);

  const top=controls.querySelector(".mobile-actions-top");
  const bottom=controls.querySelector(".mobile-actions-bottom");
  top.append(makeButton("skill","Q 技能"),makeButton("item","F 道具"),makeButton("jump","J 跳"));
  bottom.append(makeButton("enter","E 互动"),makeButton("mount","B 下车"),makeButton("fire","● 开火"));

  if(coarse) document.body.classList.add("touch-device");

  // 页面失焦或切后台时立刻清零，防止摇杆“粘住”。
  window.addEventListener("blur",resetJoystick);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)resetJoystick();});

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