(() => {
  'use strict';
  const {RaidBattle,HEROES,K,T}=(window as any).RaidEngine;
  let partyIds=['knight','rogue','mage'];
  let game=new RaidBattle(Math.random,{partyIds});
  let selectedSlotId=game.allies[0].slots[0].id;
  let toastTimeout: ReturnType<typeof setTimeout> | undefined;
  const $=(id:string)=>document.getElementById(id)! as HTMLElement & {disabled:boolean};
  const escapeHTML=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const typeGlyph: Record<string,string>={ATTACK:'◆',GUARD:'⬡',EVADE:'◌',COUNTER:'↶',SPECIAL:'✦'};
  const classForK=(id:string)=>['VULNERABLE','BIND','ATTACK_DOWN','POWER_DOWN','DEFENSE_DOWN'].includes(id)?'bad':['HASTE','ATTACK_UP','DEFENSE_UP','POWER_UP','PROTECTION','SHIELD','EVADE'].includes(id)?'good':'';
  function statuses(u: any){
    const items=Object.entries(u.keywords as Record<string, KeywordInstance>).map(([id,v])=>`<span class="keyword ${classForK(id)}" title="위력 / 횟수">${escapeHTML(K[id]||id)} ${v.potency}${v.count==null?'':` · ${v.count}회`}</span>`);
    for(const p of u.pending)items.push(`<span class="keyword pending">${escapeHTML(K[p.id])} ${p.potency} 예약</span>`);
    if(u.counter?.remaining>0)items.push('<span class="keyword good">반격 대기</span>');
    return items.length?items.join(''):'<span class="muted small">활성 키워드 없음</span>';
  }
  function allSlots(){return game.allies.flatMap(u=>u.slots);}
  function selected(){return allSlots().find(s=>s.id===selectedSlotId)||null;}
  function selectionHero(){return selected()?game.getUnit(selected().ownerId):game.allies.find(u=>u.hp>0)||game.allies[0];}
  function toast(message: string){const el=$('toast');el.textContent=message;el.classList.remove('hidden');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.add('hidden'),3100);}
  function render(): void{
    const isPlanning=game.status==='PLANNING';
    $('turnBadge').textContent=`TURN ${game.turn}`;
    $('partyPicker').innerHTML=HEROES.map((h:any,i:number)=>`<button type="button" class="party-choice ${partyIds.includes(h.id)?'active':''}" data-party="${escapeHTML(h.id)}" title="${escapeHTML(h.role)}">${h.symbol} ${escapeHTML(h.name)}</button>`).join('');
    $('partyCount').textContent=`${partyIds.length} / 6 출전 · 전체 6슬롯`;
    $('applyParty').textContent='선택한 편성으로 새 전투';
    $('phaseBadge').textContent=`PHASE ${game.phase}`;
    $('bossHpText').textContent=`${game.boss.hp} / ${game.boss.maxHp}`;
    $('bossHpBar').style.width=`${Math.max(0,100*game.boss.hp/game.boss.maxHp)}%`;
    $('bossStatus').innerHTML=statuses(game.boss);
    const intentLinks: Map<string, any>=new Map(allSlots().filter(s=>s.targetIntentId).map(s=>[s.targetIntentId,s]));
    $('intents').innerHTML=game.boss.intents.map((x,i)=>{
      const linked=intentLinks.get(x.id);
      return `<button class="intent ${linked?'linked':''}" data-intent="${escapeHTML(x.id)}" ${!isPlanning?'disabled':''}>
      <div class="top"><span class="speed">SPD ${x.speed}</span><span>${typeGlyph[x.card.type]||'◈'} ${T[x.card.type]}</span></div>
      <div class="intent-title">${escapeHTML(x.card.name)} <span class="muted">${game.finalPower(game.boss,x.card)}</span></div>
      <div class="intent-target">대상: ${escapeHTML(game.getUnit(x.targetId)?.name||'보스 본체')}</div>
      ${linked?`<div class="intent-link">↳ ${escapeHTML(game.getUnit(linked.ownerId).name)} 대응</div>`:''}</button>`;
    }).join('');
    $('targetBody').disabled=!isPlanning;
    $('heroes').innerHTML=game.allies.map(u=>`<article class="hero ${selected()?.ownerId===u.id?'selected':''}">
      <div class="hero-head"><div class="hero-name"><div class="avatar">${u.symbol}</div><div><h3>${escapeHTML(u.name)}</h3><p>${escapeHTML(u.role)} · 속도 ${u.speed.join('~')}</p></div></div>
      <div class="hero-hp"><span>HP ${u.hp}/${u.maxHp}</span><span>MP ${u.mana}/${u.maxMana} · 회복 +${u.manaRegen}/턴</span></div>
      <div class="hp-track"><div class="hp-fill" style="width:${100*u.hp/u.maxHp}%"></div></div><div class="hero-status">${statuses(u)}</div><div class="muted small" title="캐릭터 고유 패시브">✦ ${escapeHTML(u.passive.name)} — ${escapeHTML(u.passive.description)}</div></div>
      <div class="hero-slots">${u.slots.length?u.slots.map((s,i)=>{
        const c=game.cardForSlot(s),intent=game.boss.intents.find(it=>it.id===s.targetIntentId);
        return `<button class="slot ${selectedSlotId===s.id?'selected':''} ${c?'':'empty'}" data-slot="${s.id}" ${!isPlanning?'disabled':''}>
        <div class="top"><span>슬롯 ${i+1}</span><span class="speed">SPD ${s.speed}</span></div>
        <div class="slot-card">${c?`${typeGlyph[c.type]} ${escapeHTML(c.name)} (${game.finalPower(u,c)}) · MP ${c.manaCost??0}`:'+ 카드 배치'}</div>
        <div class="slot-target">${c?(intent?`↔ ${escapeHTML(intent.card.name)} SPD ${intent.speed}`:c.type==='ATTACK'?'→ 보스 본체':'→ 자신에게 발동'):'선택하여 손패에서 배치'}</div></button>`;}).join(''):'<div class="muted small">행동할 수 없습니다</div>'}</div></article>`).join('');
    const hero=selectionHero();
    $('handTitle').textContent=`${hero.symbol} ${hero.name}의 손패`;
    $('deckMeta').innerHTML=`덱 ${hero.deck.length}장 · 버림 ${hero.discard.length}장<br>손패 ${hero.hand.length}장 · 이전 사용 ${hero.lastTurnUsed}장<br>예정 MP ${game.totalPlannedMana(hero)} / 현재 ${hero.mana}`;
    $('hand').innerHTML=hero.hand.length?hero.hand.map(c=>{
      const used=hero.slots.some(s=>s.cardUid===c.uid);
      return `<button class="hand-card ${used?'assigned':''}" data-card="${escapeHTML(c.uid)}" ${!isPlanning||hero.hp<=0?'disabled':''}>
      <div class="card-head"><span class="power">${game.finalPower(hero,c)}</span><span class="type">${typeGlyph[c.type]} ${T[c.type]} · MP ${c.manaCost??0}</span></div>
      <div class="name">${escapeHTML(c.name)}</div><div class="desc">${escapeHTML(c.description||'기본 행동')}</div>
      <div class="assigned-label">${used?'✓ 배치됨 · 선택 시 이동':'클릭하여 슬롯 배치'}</div></button>`;
    }).join(''):'<p class="muted">손패가 없습니다.</p>';
    const done=['WON','LOST'].includes(game.status);
    $('battleStage').innerHTML=game.status==='PLANNING'?'행동 지정 단계':game.status==='REVIEW'?'턴 전투 결과':game.status==='WON'?'<span class="win">레이드 성공!</span>':'<span class="lose">레이드 실패</span>';
    $('stageHelp').textContent=isPlanning?'슬롯 → 카드 → 보스 행동을 클릭해 합으로 연결 (방어·회피·반격도 연결 가능)':game.status==='REVIEW'?'전투 기록을 확인한 뒤 다음 턴으로 진행하세요.':done?'새 전투로 다시 도전할 수 있습니다.':'';
    $('execute').classList.toggle('hidden',!isPlanning);$('nextTurn').classList.toggle('hidden',game.status!=='REVIEW');
    $('clearSlot').disabled=!isPlanning||!selected()?.cardUid;
    $('combatLog').innerHTML=game.log.slice(-105).map(x=>`<div class="log-entry ${/합 |전투 |레이드 |턴 시작|턴 종료|회피 실패/.test(x.text)?'important':''}"><span class="stamp">T${x.turn}</span>${escapeHTML(x.text)}</div>`).join('');
    $('combatLog').scrollTop=$('combatLog').scrollHeight;
  }
  document.addEventListener('click',ev=>{
    const partyEl=(ev.target as HTMLElement).closest<HTMLButtonElement>('[data-party]');
    if(partyEl){
      const id=partyEl.dataset.party!;
      if(partyIds.includes(id)){
        if(partyIds.length===1)return toast('최소 1명을 출전시켜야 합니다.');
        partyIds=partyIds.filter(x=>x!==id);
      } else {
        if(partyIds.length>=6)return toast('최대 출전 인원은 6명입니다.');
        // The selected order determines which heroes receive leftover slots.
        partyIds=[...partyIds,id];
      }
      render();return;
    }
    const slotEl=(ev.target as HTMLElement).closest<HTMLButtonElement>('[data-slot]');
    if(slotEl){selectedSlotId=slotEl.dataset.slot;render();return;}
    const cardEl=(ev.target as HTMLElement).closest<HTMLButtonElement>('[data-card]');
    if(cardEl){const s=selected();if(!s){toast('아군의 행동 슬롯을 먼저 선택하세요.');return;}
      const result=game.assignCard(s.id,cardEl.dataset.card);if(!result.ok)toast(result.reason);render();return;}
    const intentEl=(ev.target as HTMLElement).closest<HTMLButtonElement>('[data-intent]');
    if(intentEl){const s=selected();if(!s){toast('먼저 아군 슬롯을 선택하세요.');return;}
      const result=game.linkIntent(s.id,intentEl.dataset.intent);if(!result.ok)toast(result.reason);render();return;}
  });
  $('targetBody').addEventListener('click',()=>{const s=selected();if(!s||!s.cardUid)return toast('먼저 카드를 배치하세요.');game.unlink(s.id);render();});
  $('clearSlot').addEventListener('click',()=>{if(selected()){game.unassign(selectedSlotId);render();}});
  $('execute').addEventListener('click',()=>{game.resolveTurn();selectedSlotId=null;render();});
  $('nextTurn').addEventListener('click',()=>{game.nextTurn();selectedSlotId=game.allies.find(u=>u.slots.length)?.slots[0]?.id||null;render();});
  function restart(){game=new RaidBattle(Math.random,{partyIds});selectedSlotId=game.allies[0].slots[0].id;render();toast('선택한 편성으로 새 레이드를 시작했습니다.');}
  $('reset').addEventListener('click',restart);
  $('applyParty').addEventListener('click',restart);
  $('copyLog').addEventListener('click',()=>{
    const value=game.log.map(l=>`[턴 ${l.turn}] ${l.text}`).join('\n');
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).then(()=>toast('전투 기록을 복사했습니다.')).catch(()=>toast('클립보드 접근이 허용되지 않았습니다.'));
    else toast('이 브라우저에서는 클립보드 복사를 지원하지 않습니다.');
  });
  render();
})();
