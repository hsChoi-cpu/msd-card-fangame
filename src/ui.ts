(() => {
  'use strict';
  const { RaidBattle, HEROES, K, T } = (window as any).RaidEngine;
  let partyIds: string[] = ['knight', 'rogue', 'mage'];
  let game: any = null;
  let selectedSlotId: string | null = null;
  let screen: 'formation'|'battle' = 'formation';
  let toastTimeout: ReturnType<typeof setTimeout> | undefined;
  let dragSlotId: string | null = null;
  const $ = (id: string) => document.getElementById(id)! as HTMLElement & {disabled:boolean};
  const esc = (s:unknown) => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));
  const glyph: Record<string,string> = { ATTACK:'◆', GUARD:'⬡', EVADE:'◌', COUNTER:'↶', SPECIAL:'✦' };
  function toast(msg:string) { const t=$('toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.classList.add('hidden'),3200); }
  function allSlots(){return game?game.allies.flatMap((u:any)=>u.slots):[];}
  function selectedSlot():any{return allSlots().find((s:any)=>s.id===selectedSlotId)||null;}
  function selectedHero():any{const s=selectedSlot();return s?game.getUnit(s.ownerId):game.allies.find((u:any)=>u.hp>0)||game.allies[0];}
  function statuses(u:any):string {
    const items=Object.entries(u.keywords as Record<string,{potency:number;count:number|null}>).map(([id,v])=>`<span class="keyword" title="키워드 위력과 횟수">${esc(K[id]||id)} ${v.potency}${v.count===null?'':` · ${v.count}회`}</span>`);
    for(const p of u.pending)items.push(`<span class="keyword pending">${esc(K[p.id]||p.id)} ${p.potency} 예약</span>`);
    if(u.counter?.remaining>0)items.push('<span class="keyword">반격 대기</span>');
    return items.join('')||'<span class="muted small">상태이상 없음</span>';
  }
  function distribute(n:number):number[]{return Array.from({length:n},(_,i)=>Math.floor(6/n)+(i<6%n?1:0));}

  // The card illustrations are intentionally empty until custom assets are supplied.
  // CardDefinition.image: "assets/cards/example.png" (relative path only).
  function cardIllustration(card:any):string {
    const path=typeof card?.image==='string'?card.image.trim():'';
    const safe=path && !/^(?:[a-z]+:|\/\/)/i.test(path) && !path.includes('..') && /^[\w\u3131-\uD7A3/ .-]+$/.test(path);
    return safe
      ? `<img src="${esc(path)}" alt="${esc(card.name)} 카드 일러스트" loading="lazy" />`
      : `<span class="card-art-placeholder" aria-label="이미지 미등록">일러스트 영역</span>`;
  }
  function renderClashLines():void {
    const arena=$('battleArena');
    const svg=$('clashConnections') as unknown as SVGSVGElement;
    if(!game || screen!=='battle' || !arena || !svg)return;
    const bounds=arena.getBoundingClientRect();
    svg.setAttribute('width',String(arena.clientWidth));
    svg.setAttribute('height',String(arena.clientHeight));
    svg.setAttribute('viewBox',`0 0 ${arena.clientWidth} ${arena.clientHeight}`);
    const lines:string[]=[];
    for(const slot of allSlots()) {
      if(!slot.cardUid || !slot.targetIntentId)continue;
      const from=Array.from(arena.querySelectorAll<HTMLElement>('[data-slot]')).find(el=>el.dataset.slot===slot.id);
      const to=Array.from(arena.querySelectorAll<HTMLElement>('[data-intent]')).find(el=>el.dataset.intent===slot.targetIntentId);
      if(!from||!to)continue;
      const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
      const horizontal=a.right<=b.left;
      const x1=(horizontal?a.right:a.left+a.width/2)-bounds.left;
      const y1=a.top+a.height/2-bounds.top;
      const x2=(horizontal?b.left:b.left+b.width/2)-bounds.left;
      const y2=b.top+b.height/2-bounds.top;
      const cx=(x1+x2)/2;
      const d=horizontal
        ? `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
        : `M ${x1} ${y1} C ${x1+48} ${y1}, ${x2-48} ${y2}, ${x2} ${y2}`;
      const selected=slot.id===selectedSlotId;
      lines.push(`<path d="${d}" class="clash-line-glow"/><path d="${d}" class="clash-line ${selected?'highlight':''}"/><circle cx="${x1}" cy="${y1}" r="4" class="clash-endpoint"/><circle cx="${x2}" cy="${y2}" r="4" class="clash-endpoint"/>`);
    }
    svg.innerHTML=lines.join('');
  }
  let linesFrame=0;
  function scheduleClashLines():void {
    cancelAnimationFrame(linesFrame);
    linesFrame=requestAnimationFrame(renderClashLines);
  }

  function renderFormation(){
    $('partyCount').textContent=`${partyIds.length} / 6명 출전`;
    $('partyPicker').innerHTML=HEROES.map((h:any)=>{
      const idx=partyIds.indexOf(h.id);
      return `<button type="button" class="roster-item ${idx>=0?'active':''}" data-party="${esc(h.id)}"><span class="roster-symbol">${h.symbol}</span><span class="roster-copy"><strong>${esc(h.name)}</strong><small>${esc(h.role)} · 속도 ${h.speed.join('~')}</small></span><span class="roster-action">${idx>=0?`<b class="order-marker">${idx+1}</b> 편성됨`:'+ 추가'}</span></button>`;
    }).join('');
    const slotCounts=distribute(partyIds.length);
    $('partyOrder').innerHTML=partyIds.map((id,i)=>{
      const h=HEROES.find((c:any)=>c.id===id);
      return `<div class="order-item"><div class="order-number">${i+1}</div><div class="order-copy"><strong>${h.symbol} ${esc(h.name)}</strong><small>행동 슬롯 ${slotCounts[i]}개 · 첫 턴 ${slotCounts[i]+2}장</small></div><div class="order-buttons"><button data-move="${esc(id)}" data-direction="up" title="앞으로" ${i===0?'disabled':''}>↑</button><button data-move="${esc(id)}" data-direction="down" title="뒤로" ${i===partyIds.length-1?'disabled':''}>↓</button><button data-party="${esc(id)}" title="편성 제외">×</button></div></div>`;
    }).join('');
  }
  function showScreen(next:'formation'|'battle'){
    screen=next;$('formationScreen').classList.toggle('hidden',next!=='formation');$('battleScreen').classList.toggle('hidden',next!=='battle');$('turnBadge').classList.toggle('hidden',next!=='battle');$('backToParty').classList.toggle('hidden',next!=='battle');
    if(next==='formation')renderFormation();else renderBattle();
  }
  function beginBattle(){
    game=new RaidBattle(Math.random,{partyIds:[...partyIds]});
    selectedSlotId=game.allies[0]?.slots[0]?.id||null;
    showScreen('battle');
  }
  function renderBattle(){
    if(!game)return;
    const planning=game.status==='PLANNING';
    const selected=selectedSlot();
    $('turnBadge').textContent=`TURN ${game.turn}`;
    $('phaseBadge').textContent=`PHASE ${game.phase}`;
    $('bossHpText').textContent=`${game.boss.hp} / ${game.boss.maxHp}`;
    $('bossHpBar').style.width=`${Math.max(0,100*game.boss.hp/game.boss.maxHp)}%`;
    $('bossStatus').innerHTML=statuses(game.boss);
    const linked=new Map(allSlots().filter((s:any)=>s.targetIntentId).map((s:any)=>[s.targetIntentId,s]));
    $('intents').innerHTML=game.boss.intents.map((x:any,i:number)=>{
      const pair:any=linked.get(x.id);
      return `<div class="intent drop-intent ${pair?'linked':''}" role="button" tabindex="${planning?'0':'-1'}" data-intent="${esc(x.id)}" aria-label="${esc(x.card.name)}에 합 연결"><div class="top"><span class="speed">SPD ${x.speed}</span><span>적 슬롯 ${i+1}</span></div><div class="intent-title">${glyph[x.card.type]} ${esc(x.card.name)} <strong>${game.finalPower(game.boss,x.card)}</strong></div><div class="intent-target">대상 ${esc(game.getUnit(x.targetId)?.name||'자신')}</div><div class="intent-tooltip" role="tooltip"><div class="intent-tooltip-heading">${esc(x.card.name)}</div><div class="intent-tooltip-stats"><span>${esc(T[x.card.type]||x.card.type)}</span><span>위력 ${game.finalPower(game.boss,x.card)}</span><span>속도 ${x.speed}</span></div><p>${esc(x.card.description||'별도의 추가 효과가 없는 기본 행동')}</p><div class="intent-tooltip-target">공격 대상: ${esc(game.getUnit(x.targetId)?.name||'자신')}</div></div>${pair?`<div class="intent-link">↔ ${esc(game.getUnit(pair.ownerId).name)}의 슬롯 연결됨</div>`:'<div class="intent-link hint">여기에 아군 슬롯을 드롭</div>'}</div>`;
    }).join('');
    $('heroes').innerHTML=game.allies.map((u:any,position:number)=>`<article class="battle-hero ${selected?.ownerId===u.id?'selected':''}"><div class="battle-hero-top"><span class="hero-symbol">${u.symbol}</span><div class="hero-basic"><strong>${position+1}. ${esc(u.name)}</strong><small>${esc(u.role)} · SPD ${u.speed.join('~')}</small></div><div class="hero-hp-number">${u.hp}/${u.maxHp} HP</div></div><div class="hp-track"><div class="hp-fill" style="width:${Math.max(0,100*u.hp/u.maxHp)}%"></div></div><div class="hero-status">${statuses(u)}</div><div class="hero-slots">${u.slots.map((s:any,i:number)=>{
      const c=game.cardForSlot(s),intent=game.boss.intents.find((it:any)=>it.id===s.targetIntentId);
      return `<button type="button" class="slot ${selectedSlotId===s.id?'selected':''} ${c?'equipped':'empty'}" data-slot="${esc(s.id)}" draggable="${planning&&!!c}" ${!planning?'disabled':''} title="${c?'적 슬롯까지 드래그하면 합 연결':'클릭하여 해당 캐릭터의 손패 표시'}"><div class="top"><span>행동 ${i+1}</span><span class="speed">SPD ${s.speed}</span></div><div class="slot-card">${c?`${glyph[c.type]} ${esc(c.name)} · ${game.finalPower(u,c)}`:'+ 카드 선택'}</div><div class="slot-target">${c?(intent?`⚔ 합: ${esc(intent.card.name)}`:c.type==='ATTACK'?'→ 보스 본체':'→ 수비 발동'):'클릭하여 손패 열기'}</div>${c?'<div class="slot-drag-hint">⠿ 드래그하여 합 연결</div>':''}</button>`;
    }).join('')||'<span class="small muted">행동 불가</span>'}</div></article>`).join('');
    const hero=selectedHero();
    $('manaTitle').textContent=`${hero.symbol} ${hero.name}`;
    $('manaDisplay').innerHTML=`<div class="mana-large"><span>마력</span><strong>${hero.mana} <small>/ ${hero.maxMana}</small></strong></div><div class="mana-track"><span style="width:${hero.maxMana?Math.max(0,100*hero.mana/hero.maxMana):0}%"></span></div><div class="mana-note">턴당 자연 회복 <b>+${hero.manaRegen}</b><br>장착 카드 비용 <b>${game.totalPlannedMana(hero)}</b></div>`;
    $('deckMeta').innerHTML=`덱 ${hero.deck.length}장 · 버림 ${hero.discard.length}장<br>손패 ${hero.hand.length}장 · 이전 턴 사용 ${hero.lastTurnUsed}장`;
    $('passiveDisplay').innerHTML=`<div class="eyebrow">PASSIVE</div><strong>${esc(hero.passive.name)}</strong><p>${esc(hero.passive.description)}</p>`;
    $('handTitle').textContent=`${hero.name}의 손패`;
    $('hand').innerHTML=hero.hand.length?hero.hand.map((c:any)=>{
      const used=hero.slots.some((s:any)=>s.cardUid===c.uid);
      return `<button class="hand-card ${used?'assigned':''} card-type-${c.type.toLowerCase()}" data-card="${esc(c.uid)}" ${!planning||hero.hp<=0?'disabled':''} aria-label="${esc(c.name)}, 위력 ${game.finalPower(hero,c)}, 마력 ${c.manaCost??0}"><div class="card-title">${esc(c.name)}</div><div class="card-power" title="최종 카드 위력">${game.finalPower(hero,c)}</div><div class="card-mana" title="소모 마력">${c.manaCost??0}</div><div class="card-art">${cardIllustration(c)}</div><div class="card-type-label">${glyph[c.type]} ${esc(T[c.type]||c.type)}</div><div class="card-effect-text">${esc(c.description||'추가 효과 없음')}</div><div class="card-assignment">${used?'장착됨 · 다른 슬롯으로 이동 가능':'클릭하여 장착'}</div></button>`;
    }).join(''):'<p class="muted">현재 손패가 없습니다.</p>';
    $('battleStage').textContent=planning?'행동 지정 단계':game.status==='REVIEW'?'턴 전투 결과':game.status==='WON'?'레이드 성공!':'레이드 실패';
    $('stageHelp').textContent=planning?'① 왼쪽 아군 슬롯 선택 → ② 중앙 하단에서 카드 클릭 → ③ 장착된 슬롯을 오른쪽 보스 슬롯으로 드래그해 합 연결':game.status==='REVIEW'?'전투 기록을 확인하고 다음 턴을 진행하세요.':'편성 화면에서 새 전투를 시작할 수 있습니다.';
    $('execute').classList.toggle('hidden',!planning);$('nextTurn').classList.toggle('hidden',game.status!=='REVIEW');
    $('clearSlot').disabled=!planning||!selected?.cardUid;
    $('targetBody').classList.toggle('hidden',!planning);
    $('combatLog').innerHTML=game.log.slice(-120).map((l:any)=>`<div class="log-entry"><span class="stamp">T${l.turn}</span> ${esc(l.text)}</div>`).join('');
    scheduleClashLines();
  }
  document.addEventListener('click',ev=>{
    const target=ev.target as HTMLElement;
    if(screen==='formation'){
      const move=target.closest<HTMLElement>('[data-move]');
      if(move){const idx=partyIds.indexOf(move.dataset.move!);const other=idx+(move.dataset.direction==='up'?-1:1);if(idx>=0&&other>=0&&other<partyIds.length){[partyIds[idx],partyIds[other]]=[partyIds[other],partyIds[idx]];renderFormation();}return;}
      const pick=target.closest<HTMLElement>('[data-party]');
      if(pick){const id=pick.dataset.party!;if(partyIds.includes(id)){if(partyIds.length===1)return toast('출전 캐릭터는 최소 1명이 필요합니다.');partyIds=partyIds.filter(x=>x!==id);}else{if(partyIds.length>=6)return toast('최대 6명까지 출전할 수 있습니다.');partyIds.push(id);}renderFormation();return;}
      return;
    }
    if(game.status!=='PLANNING')return;
    const slotEl=target.closest<HTMLElement>('[data-slot]');
    if(slotEl){selectedSlotId=slotEl.dataset.slot!;renderBattle();return;}
    const cardEl=target.closest<HTMLElement>('[data-card]');
    if(cardEl){if(!selectedSlotId)return toast('먼저 아군 행동 슬롯을 선택해 주세요.');const result=game.assignCard(selectedSlotId,cardEl.dataset.card);if(!result.ok)toast(result.reason);renderBattle();return;}
    // Mouse/touch fallback: choose an enemy intent by click after slot selection.
    const intentEl=target.closest<HTMLElement>('[data-intent]');
    if(intentEl){connectToIntent(selectedSlotId,intentEl.dataset.intent!);return;}
  });
  function connectToIntent(slotId:string|null,intentId:string){
    if(!slotId)return toast('먼저 아군 행동 슬롯을 선택해 주세요.');
    const res=game.linkIntent(slotId,intentId);
    if(!res.ok)toast(res.reason);else {selectedSlotId=slotId;toast('보스 행동 슬롯에 합을 연결했습니다.');}
    renderBattle();
  }
  document.addEventListener('keydown', ev=>{
    const intent=(ev.target as HTMLElement).closest<HTMLElement>('[data-intent]');
    if(intent && screen==='battle' && game.status==='PLANNING' && (ev.key==='Enter'||ev.key===' ')){
      ev.preventDefault();connectToIntent(selectedSlotId,intent.dataset.intent!);
    }
  });
  // Native drag & drop of an equipped allied action slot onto a boss action slot.
  document.addEventListener('dragstart',ev=>{
    const slot=(ev.target as HTMLElement).closest<HTMLElement>('[data-slot]');
    if(screen!=='battle'||game.status!=='PLANNING'||!slot)return;
    const battleSlot=allSlots().find((s:any)=>s.id===slot.dataset.slot);
    if(!battleSlot?.cardUid){ev.preventDefault();return;}
    dragSlotId=battleSlot.id;
    ev.dataTransfer?.setData('text/plain',battleSlot.id);
    if(ev.dataTransfer)ev.dataTransfer.effectAllowed='link';
    slot.classList.add('dragging');
  });
  document.addEventListener('dragover',ev=>{
    const intent=(ev.target as HTMLElement).closest<HTMLElement>('[data-intent]');
    if(screen==='battle'&&game.status==='PLANNING'&&intent){ev.preventDefault();if(ev.dataTransfer)ev.dataTransfer.dropEffect='link';intent.classList.add('drag-over');}
  });
  document.addEventListener('dragleave',ev=>{
    const intent=(ev.target as HTMLElement).closest<HTMLElement>('[data-intent]');
    if(intent&&!intent.contains(ev.relatedTarget as Node))intent.classList.remove('drag-over');
  });
  document.addEventListener('drop',ev=>{
    const intent=(ev.target as HTMLElement).closest<HTMLElement>('[data-intent]');
    if(!intent||screen!=='battle'||game.status!=='PLANNING')return;
    ev.preventDefault();const slotId=ev.dataTransfer?.getData('text/plain')||dragSlotId;
    document.querySelectorAll('.drag-over,.dragging').forEach(el=>el.classList.remove('drag-over','dragging'));
    dragSlotId=null;connectToIntent(slotId,intent.dataset.intent!);
  });
  document.addEventListener('dragend',()=>{dragSlotId=null;document.querySelectorAll('.drag-over,.dragging').forEach(el=>el.classList.remove('drag-over','dragging'));});
  window.addEventListener('resize',scheduleClashLines);
  window.addEventListener('scroll',scheduleClashLines,{passive:true});
  if(typeof ResizeObserver!=='undefined'){new ResizeObserver(scheduleClashLines).observe($('battleArena'));}
  $('applyParty').addEventListener('click',beginBattle);
  $('backToParty').addEventListener('click',()=>showScreen('formation'));
  $('reset').addEventListener('click',()=>{if(confirm('현재 전투를 초기화하고 같은 편성으로 다시 시작할까요?'))beginBattle();});
  $('clearSlot').addEventListener('click',()=>{if(selectedSlotId){game.unassign(selectedSlotId);renderBattle();}});
  $('targetBody').addEventListener('click',()=>{if(selectedSlotId){game.unlink(selectedSlotId);renderBattle();toast('합 연결을 해제했습니다.');}});
  $('execute').addEventListener('click',()=>{game.resolveTurn();selectedSlotId=null;renderBattle();});
  $('nextTurn').addEventListener('click',()=>{game.nextTurn();selectedSlotId=game.allies.find((u:any)=>u.slots.length)?.slots[0]?.id||null;renderBattle();});
  $('copyLog').addEventListener('click',()=>{const value=game.log.map((l:any)=>`[턴 ${l.turn}] ${l.text}`).join('\n');if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).then(()=>toast('전투 기록을 복사했습니다.')).catch(()=>toast('복사에 실패했습니다.'));else toast('클립보드를 지원하지 않습니다.');});
  renderFormation();showScreen('formation');
})();
