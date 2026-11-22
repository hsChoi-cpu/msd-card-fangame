(() => {
  'use strict';
  const { RaidBattle, HEROES, PASSIVES, K, T, actionSlotCounts, passiveList, sortSlotsBySpeed } = (window as any).RaidEngine;
  let partyIds: string[] = ['knight', 'rogue', 'mage'];
  let game: any = null;
  let selectedSlotId: string | null = null;
  type Screen = 'home'|'collection'|'raid'|'formation'|'battle';
  let screen:Screen='home';
  const campaign=(window as any).RaidCampaign;
  const raidBosses:readonly (RaidBossEntry|null)[]=campaign.bosses;
  const raidDifficulties:readonly RaidDifficulty[]=campaign.difficulties;
  const RAID_SAVE='magical-girls-city:raid-progress:v1';
  let raidProgress:RaidProgress=campaign.readProgress(null);
  try { raidProgress=campaign.readProgress(JSON.parse(localStorage.getItem(RAID_SAVE)||'null')); } catch {}
  let bossIndex=Math.min(raidBosses.length-1, Math.floor(raidProgress.regularClears/2));
  let difficulty:RaidDifficulty=raidProgress.regularClears===campaign.regularClearCount
    ?raidProgress.announcedClears===raidProgress.regularClears?'OBLIVION':'CALAMITY'
    :raidProgress.regularClears%2===1?'CALAMITY':'OMEN';
  let raidRoute:{index:number;difficulty:RaidDifficulty}|null=null;
  let handledVictory=false;
  let revealTimer:ReturnType<typeof setTimeout>|undefined;
  let audioContext:AudioContext|undefined;
  let raidAnnouncement='';
  const TOTAL_ROSTER=27;
  const PROGRESS_KEY='magical-girls-city:unlocked:v1';
  const originalHeroes=HEROES as any[];
  const collectionRoster=Array.from({length:TOTAL_ROSTER},(_,i)=>originalHeroes[i] || {id:`future-${i+1}`,name:`미공개 캐릭터 ${String(i+1).padStart(2,'0')}`,symbol:'?',role:'상세 정보 준비 중',unreleased:true});
  function loadUnlocks():string[]{try{const saved=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'null');if(Array.isArray(saved))return saved.filter((id:string)=>originalHeroes.some((h:any)=>h.id===id));}catch{}return originalHeroes.slice(0,3).map((h:any)=>h.id);}
  let unlockedIds=loadUnlocks();
  const isOwned=(id:string)=>unlockedIds.includes(id);
  function saveUnlocks(){try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(unlockedIds));}catch{}}
  function unlockAfterWin(){const next=originalHeroes.find((h:any)=>!isOwned(h.id));if(!next)return;unlockedIds.push(next.id);saveUnlocks();toast(`승리 보상: ${next.name} 해금!`);}
  let toastTimeout: ReturnType<typeof setTimeout> | undefined;
  let dragSlotId: string | null = null;
  let pendingSpecial: {ownerId:string;cardUid:string} | null = null;
  const $ = (id: string) => document.getElementById(id)! as HTMLElement & {disabled:boolean};
  const esc = (s:unknown) => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));
  const glyph: Record<string,string> = { ATTACK:'◆', GUARD:'⬡', EVADE:'◌', COUNTER:'↶', SPECIAL:'✦', MULTI_ATTACK:'⚔' };
  function toast(msg:string) { const t=$('toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.classList.add('hidden'),3200); }
  function allSlots(){return game?game.allies.flatMap((u:any)=>u.slots):[];}
  function selectedSlot():any{return allSlots().find((s:any)=>s.id===selectedSlotId)||null;}
  function selectedHero():any{const s=selectedSlot();return s?game.getUnit(s.ownerId):game.allies.find((u:any)=>u.hp>0)||game.allies[0];}
  function statuses(u:Combatant, includePending=true):string {
    const items=Object.entries(u.keywords).map(([id,v])=>{
      const resource=game.bossResource(u,id);
      const label=id.startsWith('MARK:')?'표식-'+(game.getUnit(v.sourceId)?.name||v.sourceId||'알 수 없음'):(resource?.name??K[id]??id);
      return `<span class="keyword" title="${esc(resource?.tooltip??'키워드 위력과 횟수')}">${esc(label)} ${v.potency}${v.count===null?'':` · ${v.count}회`}</span>`;
    });
    if(includePending)for(const p of u.pending)items.push(`<span class="keyword pending">${esc(K[p.id]||p.id)} ${p.potency} 예약${p.id==='TAUNT'?' · '+esc(game.getUnit(p.sourceId)?.name||'부여자 없음'):''}</span>`);
    if(u.counter?.remaining>0)items.push('<span class="keyword">반격 대기</span>');
    return items.join('')||'<span class="muted small">상태이상 없음</span>';
  }

  function battleVitals(unit:Combatant):string {
    const hp=Math.max(0,Math.min(unit.hp,unit.maxHp));
    const percent=unit.maxHp>0?hp/unit.maxHp*100:0;
    return `<div class="battle-unit-vitals">
      <div class="unit-health-bar" role="meter" aria-label="${esc(unit.name)} 체력" aria-valuemin="0" aria-valuenow="${hp}" aria-valuemax="${unit.maxHp}">
        <span class="unit-health-fill" style="width:${percent}%"></span><span class="unit-health-value" aria-hidden="true">${hp}/${unit.maxHp}</span>
      </div>
      <div class="unit-keywords" aria-label="${esc(unit.name)} 현재 키워드">${statuses(unit,false)}</div>
    </div>`;
  }

  function effectDescription(description?:string, fallback='추가 효과 없음'):string {
    const lines=(description?.trim()||fallback)
      .split(/\r?\n|[ \t]+(?=\[[^\]\n]+\])/)
      .map(line=>line.trim()).filter(Boolean);
    return `<div class="effect-copy">${lines.map(line=>{
      const trigger=line.match(/^(\[[^\]]+\])\s*(.+)$/);
      return trigger
        ?`<p class="effect-line"><strong class="effect-trigger">${esc(trigger[1])}</strong> ${esc(trigger[2])}</p>`
        :`<p class="effect-line">${esc(line)}</p>`;
    }).join('')}</div>`;
  }

  // The card illustrations are intentionally empty until custom assets are supplied.
  // CardDefinition.image: "assets/cards/example.png" (relative path only).
  function cardIllustration(card:any):string {
    const path=typeof card?.image==='string'?card.image.trim():'';
    const safe=path && !/^(?:[a-z]+:|\/\/)/i.test(path) && !path.includes('..') && /^[\w\u3131-\uD7A3/ .-]+$/.test(path);
    return safe
      ? `<img src="${esc(path)}" alt="${esc(card.name)} 카드 일러스트" loading="lazy" />`
      : `<span class="card-art-placeholder" aria-label="이미지 미등록">일러스트 영역</span>`;
  }
  // Small action slots display only their illustration. Full card details live in
  // two fixed panels in the arena (never inside another slot or clipping parent).
  function slotIllustration(card:any, fallback:string):string {
    const path=typeof card?.image==='string'?card.image.trim():'';
    const safe=path && !/^(?:[a-z]+:|\/\/)/i.test(path) && !path.includes('..') && /^[\w\u3131-\uD7A3/ .-]+$/.test(path);
    return safe
      ? `<img class="action-art-image" src="${esc(path)}" alt="" draggable="false" loading="lazy" />`
      : `<span class="action-art-empty" aria-hidden="true">${fallback}</span>`;
  }
  function showSlotInfo(target:HTMLElement):void {
    if(!game || screen!=='battle')return;
    const allyId=target.dataset.slot;
    const intentId=target.dataset.intent;
    const panelId=allyId?'allySkillInfo':intentId?'enemySkillInfo':null;
    if(!panelId)return;
    const slot=allyId?allSlots().find((x:any)=>x.id===allyId):null;
    const intent=intentId?game.boss.intents.find((x:any)=>x.id===intentId):null;
    const owner=allyId?game.getUnit(slot?.ownerId):game.boss;
    const card=slot?game.cardForSlot(slot):intent?.card;
    const panel=$(panelId);
    if(!card){
      panel.innerHTML=`<div class="skill-info-label">아군 행동 슬롯</div><strong>빈 슬롯</strong><p>손패에서 카드를 선택해 장착할 수 있습니다.</p>`;
    }else{
      const value=game.finalPower(owner,card);
      const speed=slot?.speed??intent?.speed;
      const cost=allyId?`<span>마력 ${game.manaCost(owner,card)}</span>`:'';
      const type=`${esc(T[card.type]||card.type)}${card.type==='MULTI_ATTACK'?` · ${Number(card.hitCount)||1}타`:''}`;
      const link=slot?.targetIntentId?' · 합 연결됨':'';
      const targetName=intent&&['ATTACK','MULTI_ATTACK'].includes(card.type)?game.getUnit(intent.targetId)?.name:null;
      panel.innerHTML=`<div class="skill-info-label">${allyId?'아군 카드':'보스 카드'} · ${esc(owner.name)}${link}</div><strong>${card.enhanced?'강화 ':''}${esc(card.name)}</strong><div class="skill-info-stats"><span>${type}</span><span>위력 ${value}</span><span>속도 ${speed}</span>${cost}</div>${effectDescription(card.description)}${targetName?`<div class="skill-info-target">공격 대상: ${esc(targetName)}</div>`:''}`;
    }
    panel.classList.add('visible');panel.setAttribute('aria-hidden','false');
  }
  function hideSlotInfo(side:'ally'|'enemy'):void {
    const panel=$(side==='ally'?'allySkillInfo':'enemySkillInfo');
    panel.classList.remove('visible');panel.setAttribute('aria-hidden','true');
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

  const abilityKeywords=(hero:any):string[]=> {
    if(!hero?.deck)return [];
    const keys=new Set<string>();
    for(const card of [...hero.deck,...passiveList(PASSIVES[hero.id])]){
      for(const effect of card.effects||[]){
        if(effect.keyword)keys.add(effect.keyword);
        for(const action of effect.actions??[])if(action.keyword)keys.add(action.keyword);
      }
    }
    return [...keys];
  };
  function unitImage(path:unknown):string {
    if(typeof path!=='string')return '';
    const value=path.trim();
    return value && !value.startsWith('/') && !value.includes('..') && /^[\w\u3131-\uD7A3/ .-]+$/.test(value) ? value : '';
  }
  function spriteMarkup(unit:Combatant):string {
    const path=unitImage(unit.sprite)||unitImage(unit.portrait);
    return path
      ? `<img class="unit-sprite-image" src="${esc(path)}" alt="" draggable="false"/>`
      : `<span class="hero-body-symbol" aria-hidden="true">${esc(unit.symbol||'◈')}</span><strong>${esc(unit.name)}</strong>`;
  }
  function passiveDescriptions(definition?:CardDefinition|CardDefinition[]):string {
    const cards:CardDefinition[]=passiveList(definition);
    return cards.length
      ? cards.map(card=>`<div class="passive-entry"><strong>${esc(card.name)}</strong>${effectDescription(card.description,'효과 설명 없음')}</div>`).join('')
      : '<p>등록된 패시브가 없습니다.</p>';
  }
  // Optional roster portrait: the actual artwork is supplied later.
  // For a playable hero, set hero.portrait = "assets/characters/example.png".
  function portraitMarkup(hero:any, fallback:string):string{
    const path=unitImage(hero?.portrait);
    if(path)
      return `<img class="character-portrait-img" src="${esc(path)}" alt="${esc(hero.name)}" loading="lazy"/>`;
    return `<span class="portrait-symbol">${fallback}</span><span class="collection-art-hint">이미지 준비 중</span>`;
  }
  const unitDialog=document.getElementById('battleUnitDetail') as HTMLDialogElement;
  const reportBody=$('unitReportBody');
  let inspectedUnit:Combatant|null=null;
  let inspectionOrigin:HTMLButtonElement|null=null;

  function inspectionCards(unit:Combatant):CardDefinition[] {
    return unit.id==='boss' ? game.encounter.moves : [...(unit.deck??[]), ...(unit.hand??[]), ...(unit.discard??[])];
  }
  function cardTypeLabel(card:CardDefinition):string {
    return `${esc(T[card.type]||card.type)}${card.type==='MULTI_ATTACK'?` · ${card.hitCount}타`:''}`;
  }
  function showReportCard(button:HTMLButtonElement):void {
    if(!inspectedUnit)return;
    const card=inspectionCards(inspectedUnit)[Number(button.dataset.reportCard)];
    const detail=$('unitReportCardEffect');
    if(!card||!detail)return;
    const active=reportBody.querySelector('[aria-pressed="true"]');
    if(active===button)return;
    active?.setAttribute('aria-pressed','false');
    button.setAttribute('aria-pressed','true');
    const cost=inspectedUnit.id==='boss'?'':` · 마력 ${game.manaCost(inspectedUnit,card)}`;
    detail.innerHTML=`<h3>${esc(card.name)}</h3><small>${cardTypeLabel(card)} · 위력 ${game.finalPower(inspectedUnit,card)}${cost}</small>${effectDescription(card.description)}`;
  }
  function renderUnitReportTab(tab:string):void {
    if(!inspectedUnit)return;
    unitDialog.querySelectorAll<HTMLButtonElement>('[data-report-tab]').forEach(button=>{
      button.setAttribute('aria-pressed',String(button.dataset.reportTab===tab));
    });
    reportBody.scrollTop=0;
    if(tab==='passives'){
      reportBody.innerHTML=`<div class="report-passives">${passiveDescriptions(inspectedUnit.passives??inspectedUnit.passive)}</div>`;
      return;
    }
    const cards=inspectionCards(inspectedUnit);
    const boss=inspectedUnit.id==='boss';
    if(!cards.length){
      reportBody.innerHTML='<p>보유한 카드가 없습니다.</p>';
      return;
    }
    if(tab==='deck'){
      reportBody.innerHTML=`<div class="report-deck">
        <div class="report-deck-list" aria-label="${boss?'보스 기술':'보유 카드'}">${cards.map((card,index)=>`
          <button type="button" class="report-deck-card" data-report-card="${index}" aria-pressed="false">
            <span class="report-card-art">${cardIllustration(card)}</span><span><strong>${esc(card.name)}</strong><small>${cardTypeLabel(card)}</small></span>
          </button>`).join('')}</div>
        <div id="unitReportCardEffect" class="report-card-effect" aria-live="polite"></div>
      </div>`;
      showReportCard(reportBody.querySelector<HTMLButtonElement>('[data-report-card]')!);
      return;
    }
    const groups=new Map<string,{card:CardDefinition;count:number}>();
    for(const card of cards){
      const group=groups.get(card.id);
      if(group)group.count++;
      else groups.set(card.id,{card,count:1});
    }
    reportBody.innerHTML=`<div class="report-summary" aria-label="${boss?'보스 기술':'보유 카드 수량'}">${[...groups.values()].map(({card,count})=>`
      <div class="report-summary-entry"><div class="report-summary-card">
        <span class="report-card-art">${cardIllustration(card)}</span><strong>${esc(card.name)}</strong>
      </div>${boss?'':`<span class="report-card-count" aria-label="${count}장">×${count}</span>`}</div>`).join('')}</div>`;
  }
  function showUnitDetail(unit:Combatant, origin:HTMLButtonElement):void {
    if(unitDialog.open)return;
    const from=origin.getBoundingClientRect();
    inspectedUnit=unit;
    inspectionOrigin=origin;
    unitDialog.classList.toggle('enemy-inspection',unit.id==='boss');
    $('unitFocusSprite').innerHTML=spriteMarkup(unit);
    const portrait=unitImage(unit.portrait)||unitImage(unit.sprite);
    $('unitReportPortrait').innerHTML=portrait
      ? `<img class="character-portrait-img" src="${esc(portrait)}" alt=""/>`
      : `<span>${esc(unit.symbol||'◈')}</span>`;
    $('unitReportName').textContent=unit.name;
    const mana=unit.mana===undefined||unit.maxMana===undefined
      ? '<div class="report-resource"><span>마력</span><span>— / —</span></div>'
      : `<div class="report-resource report-mana"><span>마력</span><b>${unit.mana} / ${unit.maxMana}</b><meter min="0" max="${unit.maxMana||1}" value="${unit.mana}" aria-label="마력"></meter></div>`;
    const condition=Object.keys(unit.keywords).length||unit.pending.length||unit.counter?.remaining>0
      ? `<div class="report-status" aria-label="상태 효과">${statuses(unit)}</div>` : '';
    $('unitReportVitals').innerHTML=`<div class="report-resource report-hp"><span>체력</span><b>${unit.hp} / ${unit.maxHp}</b><meter min="0" max="${unit.maxHp}" value="${unit.hp}" aria-label="체력"></meter></div>
      <div class="report-resource"><span>속도 범위</span><b>${unit.speed.join('~')}</b></div>
      ${mana}
      <div class="report-regen" title="다음 턴 시작에 적용되는 자연 회복량"><span>턴 종료 후 자연 마력 회복</span><b>${unit.manaRegen===undefined?'—':`+${unit.manaRegen}`}</b></div>
      ${condition}`;
    renderUnitReportTab('summary');
    hideSlotInfo('ally');
    hideSlotInfo('enemy');
    unitDialog.showModal();
    const focusSprite=$('unitFocusSprite');
    const to=focusSprite.getBoundingClientRect();
    if(to.width&&to.height&&typeof focusSprite.animate==='function'&&
      !document.documentElement.classList.contains('reduced-motion')&&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      focusSprite.animate([
        {transform:`translate(${from.left-to.left}px, ${from.top-to.top}px) scale(${from.width/to.width}, ${from.height/to.height})`},
        {transform:'none'}
      ],{duration:280,easing:'cubic-bezier(.2,.65,.25,1)'});
    }
  }
  unitDialog.addEventListener('click',ev=>{
    const target=ev.target as HTMLElement;
    if(!target.closest('.unit-clipboard')||target.closest('#closeUnitDetail')){
      unitDialog.close();
      return;
    }
    const tab=target.closest<HTMLButtonElement>('[data-report-tab]');
    if(tab)renderUnitReportTab(tab.dataset.reportTab!);
    const card=target.closest<HTMLButtonElement>('[data-report-card]');
    if(card)showReportCard(card);
  });
  unitDialog.addEventListener('close',()=>{
    inspectedUnit=null;
    inspectionOrigin?.focus();
    inspectionOrigin=null;
  });
  for(const event of ['pointerover','focusin']){
    reportBody.addEventListener(event,ev=>{
      const card=(ev.target as HTMLElement).closest<HTMLButtonElement>('[data-report-card]');
      if(card)showReportCard(card);
    });
  }
  function renderCollection(){
    const search=($('characterSearch') as HTMLInputElement).value.trim().toLocaleLowerCase();
    const owned=($('ownershipFilter') as HTMLSelectElement).value;
    const key=($('keywordFilter') as HTMLSelectElement).value;
    const visible=collectionRoster.filter((h:any)=>
      (!search||h.name.toLocaleLowerCase().includes(search)) &&
      (owned==='all'||(owned==='owned'?isOwned(h.id):!isOwned(h.id))) &&
      (key==='all'||abilityKeywords(h).includes(key))
    );
    $('collectionCount').textContent=`검색 결과 ${visible.length}명 / 전체 27명`;
    $('unlockProgress').textContent=`보유 캐릭터 ${unlockedIds.length} / 27명 · 현재 구현 ${originalHeroes.length}명`;
    $('collectionGrid').innerHTML=visible.map((h:any)=>`<button type="button" class="collection-tile ${isOwned(h.id)?'owned':'locked'}" data-detail="${esc(h.id)}" aria-label="${esc(h.name)} 상세 정보"><div class="collection-art">${portraitMarkup(h,isOwned(h.id)?esc(h.symbol):'🔒')}</div><div class="collection-tile-foot"><strong>${esc(h.name)}</strong><span>${isOwned(h.id)?'보유':'미보유'}</span></div></button>`).join('')||'<p class="muted collection-empty">일치하는 캐릭터가 없습니다.</p>';
  }
  function showCharacterDetail(id:string){
    const h=collectionRoster.find((x:any)=>x.id===id);if(!h)return;
    const owned=isOwned(id);const implemented=!!h.deck;
    $('characterDetailTitle').textContent=h.name;
    const passives=PASSIVES[h.id];
    const deck=implemented?h.deck:[];
    $('characterDetailContent').innerHTML=`<div class="detail-head"><div class="detail-portrait">${portraitMarkup(h,owned?esc(h.symbol):'🔒')}</div><div><span class="pill">${owned?'보유':'미보유'}</span><h3>${esc(h.name)}</h3><p>${esc(h.role)}</p>${implemented?`<div class="detail-stats"><span>체력 <b>${h.maxHp}</b></span><span>속도 <b>${h.speed[0]}~${h.speed[1]}</b></span></div>`:'<p class="muted">해당 캐릭터의 상세 데이터와 덱은 추후 추가될 예정입니다.</p>'}</div></div>${implemented?`<div class="detail-block"><h3>전투 패시브</h3>${passiveDescriptions(passives)}</div><div class="detail-block"><h3>고정 덱 · ${deck.length}장</h3><div class="detail-deck">${deck.map((c:any)=>`<div class="detail-card"><span>${esc(c.name)}</span><small>${esc(T[c.type]||c.type)} · 위력 ${c.power} · 마력 ${c.manaCost}</small>${effectDescription(c.description,'효과 없음')}</div>`).join('')}</div></div>`:''}`;
    $('characterDetailPanel').classList.remove('hidden');
  }
  function renderFormation(){
    partyIds=partyIds.filter(id=>isOwned(id));
    if(partyIds.length===0){const first=originalHeroes.find((h:any)=>isOwned(h.id));if(first)partyIds=[first.id];}
    $('partyCount').textContent=`${partyIds.length} / 6명 출전`;
    $('partyPicker').innerHTML=originalHeroes.filter((h:any)=>isOwned(h.id)).map((h:any)=>{
      const idx=partyIds.indexOf(h.id);
      return `<button type="button" class="roster-item ${idx>=0?'active':''}" data-party="${esc(h.id)}"><span class="roster-symbol">${esc(h.symbol)}</span><span class="roster-copy"><strong>${esc(h.name)}</strong><small>${esc(h.role)} · 속도 ${h.speed.join('~')}</small></span><span class="roster-action">${idx>=0?`<b class="order-marker">${idx+1}</b> 편성됨`:'+ 추가'}</span></button>`;
    }).join('');
    const slotCounts=actionSlotCounts(partyIds.length,1);
    $('partyOrder').innerHTML=partyIds.map((id,i)=>{
      const h=originalHeroes.find((c:any)=>c.id===id);
      return `<div class="order-item"><div class="order-number">${i+1}</div><div class="order-copy"><strong>${esc(h.symbol)} ${esc(h.name)}</strong><small>첫 턴 슬롯 ${slotCounts[i]}개 · 첫 턴 ${slotCounts[i]+2}장</small></div><div class="order-buttons"><button data-move="${esc(id)}" data-direction="up" title="앞으로" ${i===0?'disabled':''}>↑</button><button data-move="${esc(id)}" data-direction="down" title="뒤로" ${i===partyIds.length-1?'disabled':''}>↓</button><button data-party="${esc(id)}" title="편성 제외">×</button></div></div>`;
    }).join('');
  }
  function saveRaidProgress():void {
    try { localStorage.setItem(RAID_SAVE,JSON.stringify(raidProgress)); } catch {}
  }
  function visibleRaidProgress() {
    if(raidProgress.regularClears===campaign.regularClearCount && raidProgress.announcedClears<raidProgress.regularClears){
      return {...raidProgress,regularClears:campaign.regularClearCount-1};
    }
    return raidProgress;
  }
  function renderRaidSelection():void {
    const progress=visibleRaidProgress();
    $('raidBosses').innerHTML=raidBosses.map((entry,index)=>{
      const angle=(index+1)*Math.PI/6;
      const x=50+40*Math.sin(angle), y=50-40*Math.cos(angle);
      const unlocked=campaign.isUnlocked(progress,index,'OMEN');
      const cleared=campaign.isCleared(progress,index,'CALAMITY');
      const label=entry?.name??`보스 ${index+1}`;
      return `<button class="raid-node ${unlocked?'':'locked'} ${cleared?'cleared':''}" type="button" data-raid-boss="${index}" style="--x:${x.toFixed(3)}%;--y:${y.toFixed(3)}%" aria-pressed="${index===bossIndex}" aria-label="${esc(label)}, ${cleared?'CALAMITY 클리어':unlocked?'개방':'잠김'}"><span>${String(index+1).padStart(2,'0')}</span>${cleared?'<span class="raid-node-dot" aria-hidden="true"></span>':''}</button>`;
    }).join('');
    const entry=raidBosses[bossIndex];
    const portrait=unitImage(entry?.portrait);
    $('raidPortrait').innerHTML=portrait?`<img src="${esc(portrait)}" alt=""/>`:'<span></span>';
    $('raidBossName').textContent=entry?.name??`보스 ${bossIndex+1}`;
    $('raidBossStatus').textContent=!campaign.isUnlocked(progress,bossIndex,'OMEN')
      ?'잠김':entry?'개방':'전투 준비 중';
    $('raidDifficulties').innerHTML=raidDifficulties.filter(level=>level!=='OBLIVION'||campaign.isUnlocked(progress,bossIndex,level)).map(level=>{
      const unlocked=campaign.isUnlocked(progress,bossIndex,level);
      const status=campaign.isCleared(progress,bossIndex,level)?'클리어':!unlocked?'잠김':entry?.encounters[level]?'도전 가능':'개방 · 준비 중';
      return `<button type="button" data-difficulty="${level}" aria-pressed="${level===difficulty}"><strong>${level}</strong><span>${status}</span></button>`;
    }).join('');
    const unlocked=campaign.isUnlocked(progress,bossIndex,difficulty);
    const configured=!!entry?.encounters[difficulty];
    $('chooseRaid').disabled=!unlocked||!configured;
    $('chooseRaid').textContent=!unlocked?'잠김':configured?'출전 편성 →':'전투 준비 중';
    $('raidNotice').textContent=raidAnnouncement || (unlocked?'':!campaign.isUnlocked(progress,bossIndex,'OMEN')
      ?'이전 보스의 CALAMITY를 클리어하면 개방됩니다.'
      :'이 보스의 OMEN을 클리어하면 개방됩니다.');
  }
  function raidMusic():HTMLAudioElement {
    return document.getElementById('raidBgm') as HTMLAudioElement;
  }
  function playRaidMusic():void {
    const music=raidMusic();
    if(music.getAttribute('src'))void music.play().catch(()=>{});
  }
  function playRaidTick():void {
    const context=audioContext;
    if(!context||context.state!=='running')return;
    const oscillator=context.createOscillator();
    const gain=context.createGain();
    const at=context.currentTime;
    oscillator.type='triangle';
    oscillator.frequency.setValueAtTime(880,at);
    oscillator.frequency.exponentialRampToValueAtTime(360,at+.07);
    gain.gain.setValueAtTime(.06,at);
    gain.gain.exponentialRampToValueAtTime(.001,at+.09);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at+.1);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
  function enterRaidScreen():void {
    const marker=$('raidMarker');
    const before=raidProgress.announcedClears;
    const after=raidProgress.regularClears;
    marker.style.setProperty('--marker-angle',`${before-campaign.regularClearCount}deg`);
    renderRaidSelection();
    const oblivionCount=raidProgress.oblivionClears.length;
    const newOblivion=oblivionCount>raidProgress.announcedOblivion;
    if(after<=before&&!newOblivion){
      playRaidMusic();
      return;
    }
    const final=after>before&&after===campaign.regularClearCount;
    if(final){
      raidMusic().pause();
      try {
        if(typeof AudioContext!=='undefined'){
          audioContext??=new AudioContext();
          void audioContext.resume().catch(()=>{});
        }
      } catch {}
    }
    const finish=()=>{
      revealTimer=undefined;
      raidProgress={...raidProgress,announcedClears:after,announcedOblivion:oblivionCount};
      saveRaidProgress();
      if(!final)return;
      raidAnnouncement='모든 보스의 OBLIVION 난이도가 개방되었습니다.';
      const active=document.activeElement as HTMLElement|null;
      renderRaidSelection();
      if(active?.dataset.raidBoss!==undefined)$('raidBosses').querySelector<HTMLElement>(`[data-raid-boss="${active.dataset.raidBoss}"]`)?.focus();
      if(active?.dataset.difficulty!==undefined)$('raidDifficulties').querySelector<HTMLElement>(`[data-difficulty="${active.dataset.difficulty}"]`)?.focus();
      playRaidMusic();
    };
    revealTimer=setTimeout(()=>{
      marker.style.setProperty('--marker-angle',`${after-campaign.regularClearCount}deg`);
      if(newOblivion&&typeof marker.animate==='function'&&
        !document.documentElement.classList.contains('reduced-motion')&&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
        marker.animate([{opacity:1},{opacity:.35},{opacity:1}],{duration:420});
      }
      if(final){
        playRaidTick();
        revealTimer=setTimeout(finish,380);
      }else finish();
    },final?190:70);
    if(!final)playRaidMusic();
  }
  function showScreen(next:Screen){
    if(screen==='raid'&&next!=='raid'){
      clearTimeout(revealTimer);
      revealTimer=undefined;
      raidAnnouncement='';
    }
    if(next==='home'&&raidMusic().getAttribute('src'))raidMusic().pause();
    if(next!=='battle'&&unitDialog.open)unitDialog.close();
    if(next!=='battle'){pendingSpecial=null;$('specialTargetPanel').classList.add('hidden');$('discardChoicePanel').classList.add('hidden');}
    screen=next;
    document.body.classList.toggle('battle-active',next==='battle');
    for(const [type,id] of [['home','homeScreen'],['collection','collectionScreen'],['raid','raidScreen'],['formation','formationScreen'],['battle','battleScreen']])$(id).classList.toggle('hidden',type!==next);
    $('turnBadge').classList.toggle('hidden',next!=='battle');$('backToParty').classList.toggle('hidden',next!=='battle');$('toHome').classList.toggle('hidden',next==='home');
    if(next==='formation'){
      const encounter=raidRoute&&raidBosses[raidRoute.index]?.encounters[raidRoute.difficulty];
      $('formationRaid').textContent=encounter&&raidRoute?`${encounter.name} · ${raidRoute.difficulty}`:'연습 전투 · 심연의 군주';
      renderFormation();
    }else if(next==='collection')renderCollection();
    else if(next==='battle')renderBattle();
    else if(next==='raid'){
      enterRaidScreen();
      $('raidTitle').focus();
    }
    window.scrollTo(0,0);
  }
  function beginBattle(){
    const encounter=raidRoute ? raidBosses[raidRoute.index]?.encounters[raidRoute.difficulty] : undefined;
    if(raidRoute&&(!encounter||!campaign.isUnlocked(raidProgress,raidRoute.index,raidRoute.difficulty))){
      showScreen('raid');
      return;
    }
    game=new RaidBattle(Math.random,{partyIds:[...partyIds],encounter});
    handledVictory=false;
    selectedSlotId=game.allies[0]?.slots[0]?.id||null;
    showScreen('battle');
  }
  function renderBattle(){
    if(!game)return;
    if(game.status==='WON'&&!handledVictory){
      handledVictory=true;
      if(raidRoute){
        raidProgress=campaign.recordClear(raidProgress,raidRoute.index,raidRoute.difficulty);
        saveRaidProgress();
      }
      unlockAfterWin();
    }
    $('returnToRaid').classList.toggle('hidden',game.status!=='WON'&&game.status!=='LOST');
    const planning=game.status==='PLANNING';
    const selected=selectedSlot();
    $('turnBadge').textContent=`TURN ${game.turn}`;
    $('phaseBadge').textContent=`PHASE ${game.phase}`;
    $('bossVitals').innerHTML=battleVitals(game.boss);
    $('bossSprite').innerHTML=spriteMarkup(game.boss);
    $('bossSprite').setAttribute('aria-label',`${game.boss.name} 전투 정보`);
    const linked=new Map(allSlots().filter((s:any)=>s.targetIntentId).map((s:any)=>[s.targetIntentId,s]));
    // UI-only sort: never mutate intent IDs, linked slot IDs or execution order.
    $('intents').innerHTML=sortSlotsBySpeed(game.boss.intents).map((x:any,i:number)=>{
      const pair:any=linked.get(x.id);
      return `<div class="boss-action-wrap"><span class="hex-speed enemy-hex">${x.speed}</span><div class="intent drop-intent ${pair?'linked':''}" role="button" tabindex="${planning?'0':'-1'}" data-intent="${esc(x.id)}" aria-label="적 슬롯 ${i+1}: ${x.card.enhanced?'강화 ':''}${esc(x.card.name)}, ${cardTypeLabel(x.card)}, 속도 ${x.speed}, 위력 ${game.finalPower(game.boss,x.card)}"><span class="action-art">${slotIllustration(x.card,'✦')}</span></div></div>`;
    }).join('');
    $('heroes').innerHTML=game.allies.map((u:Combatant)=>`<article class="battle-hero ${selected?.ownerId===u.id?'selected':''} ${u.hp<=0?'fallen':''}">
      <div class="hero-slots">${sortSlotsBySpeed(u.slots).map((s:any,i:number)=>{
        const c=game.cardForSlot(s),intent=game.boss.intents.find((it:any)=>it.id===s.targetIntentId);
        return `<div class="ally-action-wrap"><span class="hex-speed ally-hex">${s.speed}</span><button type="button" class="slot ${selectedSlotId===s.id?'selected':''} ${c?'equipped':'empty'}" data-slot="${esc(s.id)}" draggable="${planning&&!!c}" ${!planning?'disabled':''} aria-label="${esc(u.name)} 슬롯 ${i+1}, 속도 ${s.speed}${c?`, ${esc(c.name)}, 위력 ${game.finalPower(u,c)}`:', 카드 미장착'}${intent?', 합 연결됨':''}" title="${c?'보스 슬롯으로 드래그하여 합 연결':'클릭하여 손패 표시'}"><span class="action-art">${c?slotIllustration(c,'◆'):'<span class="action-art-empty" aria-hidden="true">＋</span>'}</span></button></div>`;
      }).join('')}</div>
      <button type="button" class="hero-body unit-sprite" data-unit="${esc(u.id)}" aria-haspopup="dialog" aria-label="${esc(u.name)} 전투 정보">${spriteMarkup(u)}</button>
      ${battleVitals(u)}
    </article>`).join('');
    const hero=selectedHero();
    $('manaDisplay').innerHTML=`<div class="mana-large"><span>마력</span><strong>${hero.mana} <small>/ ${hero.maxMana}</small></strong></div><div class="mana-track"><span style="width:${hero.maxMana?Math.max(0,100*hero.mana/hero.maxMana):0}%"></span></div>`;
    $('hand').innerHTML=hero.hand.length?hero.hand.map((c:CardDefinition,index:number)=>{
      const used=hero.slots.some((s:any)=>s.cardUid===c.uid);
      const offset=hero.hand.length>1 ? index*2/(hero.hand.length-1)-1 : 0;
      return `<button class="hand-card ${used?'assigned':''} card-type-${c.type.toLowerCase()}" data-card="${esc(c.uid)}" style="--fan-angle:${(offset*4).toFixed(2)}deg;--fan-drop:${(offset*offset*10).toFixed(2)}px" ${!planning||hero.hp<=0?'disabled':''} aria-label="${esc(c.name)}, 위력 ${game.finalPower(hero,c)}, 마력 ${game.manaCost(hero,c)}"><div class="card-title">${esc(c.name)}</div><div class="card-power" title="최종 카드 위력">${game.finalPower(hero,c)}</div><div class="card-mana" title="소모 마력">${game.manaCost(hero,c)}</div><div class="card-art">${cardIllustration(c)}</div><div class="card-type-label">${glyph[c.type]} ${esc(T[c.type]||c.type)}${c.type==='MULTI_ATTACK'?` · ${c.hitCount}타`:''}</div><div class="card-effect-text">${esc(c.description||'추가 효과 없음')}</div><div class="card-assignment">${used?'장착됨 · 다른 슬롯으로 이동 가능':c.type==='SPECIAL'?'클릭하면 즉시 사용':'클릭하여 장착'}</div></button>`;
    }).join(''):'<p class="muted">현재 손패가 없습니다.</p>';
    $('battleStage').textContent=planning?'행동 지정 단계':game.status==='REVIEW'?'턴 전투 결과':game.status==='WON'?'레이드 성공!':'레이드 실패';
    $('stageHelp').textContent=planning?'① 아군 슬롯 선택 → ② 일반 카드 장착 또는 특수 카드 즉시 발동 → ③ 적 슬롯으로 드래그해 합 연결':game.status==='REVIEW'?'전투 기록을 확인하고 다음 턴을 진행하세요.':'편성 화면에서 새 전투를 시작할 수 있습니다.';
    $('execute').classList.toggle('hidden',!planning);$('execute').disabled=!!game.pendingDiscards?.length;$('nextTurn').classList.toggle('hidden',game.status!=='REVIEW');$('nextTurn').disabled=!!game.pendingDiscards?.length;
    $('clearSlot').disabled=!planning||!selected?.cardUid;
    $('targetBody').classList.toggle('hidden',!planning);
    $('combatLog').innerHTML=game.log.slice(-120).map((l:any)=>`<div class="log-entry"><span class="stamp">T${l.turn}</span> ${esc(l.text)}</div>`).join('');
    renderDiscardChoice();
    for(const side of ['ally','enemy'] as const)hideSlotInfo(side);
    const focused=document.activeElement as HTMLElement;
    if(focused?.matches?.('[data-slot],[data-intent]'))showSlotInfo(focused);
    scheduleClashLines();
  }
  function renderDiscardChoice():void {
    const panel=$('discardChoicePanel');
    const req=game?.pendingDiscards?.[0];
    if(!req){panel.classList.add('hidden');return;}
    const owner=game.getUnit(req.ownerId);
    $('discardChoiceTitle').textContent=`${owner.name}: 버릴 카드 ${req.remaining}장 선택`;
    $('discardChoiceList').innerHTML=owner.hand.filter((c:any)=>!owner.slots.some((slot:any)=>slot.cardUid===c.uid))
      .map((c:any)=>`<button class="ghost" data-discard-uid="${esc(c.uid)}">${esc(c.name)} (${esc(T[c.type]||c.type)})</button>`).join('');
    panel.classList.remove('hidden');
  }
  $('discardChoiceList').addEventListener('click',ev=>{
    const el=(ev.target as HTMLElement).closest<HTMLElement>('[data-discard-uid]');
    if(!el)return;
    const req=game.pendingDiscards[0];
    if(!req)return;
    const result=game.chooseDiscard(req.ownerId,el.dataset.discardUid);
    if(!result.ok)toast(result.reason);renderBattle();
  });
  document.addEventListener('click',ev=>{
    const target=ev.target as HTMLElement;
    if(screen==='collection'){const detail=target.closest<HTMLElement>('[data-detail]');if(detail)showCharacterDetail(detail.dataset.detail!);return;}
    if(screen==='home'||screen==='raid')return;
    if(screen==='formation'){
      const move=target.closest<HTMLElement>('[data-move]');
      if(move){const idx=partyIds.indexOf(move.dataset.move!);const other=idx+(move.dataset.direction==='up'?-1:1);if(idx>=0&&other>=0&&other<partyIds.length){[partyIds[idx],partyIds[other]]=[partyIds[other],partyIds[idx]];renderFormation();}return;}
      const pick=target.closest<HTMLElement>('[data-party]');
      if(pick){const id=pick.dataset.party!;if(partyIds.includes(id)){if(partyIds.length===1)return toast('출전 캐릭터는 최소 1명이 필요합니다.');partyIds=partyIds.filter(x=>x!==id);}else{if(partyIds.length>=6)return toast('최대 6명까지 출전할 수 있습니다.');partyIds.push(id);}renderFormation();return;}
      return;
    }
    const sprite=target.closest<HTMLButtonElement>('.unit-sprite[data-unit]');
    if(sprite){
      const unit=game.getUnit(sprite.dataset.unit);
      if(unit)showUnitDetail(unit,sprite);
      return;
    }
    if(game.status!=='PLANNING')return;
    const slotEl=target.closest<HTMLElement>('[data-slot]');
    if(slotEl){selectedSlotId=slotEl.dataset.slot!;renderBattle();return;}
    const cardEl=target.closest<HTMLElement>('[data-card]');
    if(cardEl){
      if(!selectedSlotId)return toast('먼저 아군 행동 슬롯을 선택해 주세요.');
      const owner=selectedHero();
      const card=owner.hand.find((c:any)=>c.uid===cardEl.dataset.card);
      if(card?.type==='SPECIAL'){
        if((card.specialTarget??'SELF')==='SELF')useSpecial(owner.id,card.uid,owner.id);
        else showSpecialTargets(owner.id,card.uid);
        return;
      }
      const result=game.assignCard(selectedSlotId,cardEl.dataset.card);
      if(!result.ok)toast(result.reason);
      renderBattle();return;
    }
    // Mouse/touch fallback: choose an enemy intent by click after slot selection.
    const intentEl=target.closest<HTMLElement>('[data-intent]');
    if(intentEl){connectToIntent(selectedSlotId,intentEl.dataset.intent!);return;}
  });
  function useSpecial(ownerId:string,cardUid:string,targetId:string){
    const result=game.playSpecial(ownerId,cardUid,targetId);
    if(!result.ok)toast(result.reason);else toast('특수 카드가 즉시 발동했습니다.');
    pendingSpecial=null;
    $('specialTargetPanel').classList.add('hidden');
    renderBattle();
  }
  function showSpecialTargets(ownerId:string,cardUid:string){
    const owner=game.getUnit(ownerId);
    const card=owner.hand.find((c:any)=>c.uid===cardUid);
    if(!card)return;
    pendingSpecial={ownerId,cardUid};
    const scope=card.specialTarget??'SELF';
    const choices=[...game.allies.filter((u:any)=>u.hp>0),game.boss].filter((u:any)=>
      scope==='ANY'||(scope==='ALLY'&&u.id!=='boss')||(scope==='ENEMY'&&u.id==='boss'));
    $('specialTargetTitle').textContent=`[${card.name}] 효과 대상 선택`;
    $('specialTargetChoices').innerHTML=choices.map((u:any)=>`<button type="button" class="ghost special-target-choice" data-special-target="${esc(u.id)}">${esc(u.symbol||'◈')} ${esc(u.name)} (${u.hp}/${u.maxHp} HP)</button>`).join('');
    $('specialTargetPanel').classList.remove('hidden');
  }
  $('specialTargetPanel').addEventListener('click',ev=>{
    const el=(ev.target as HTMLElement).closest<HTMLElement>('[data-special-target]');
    if(!el||!pendingSpecial)return;
    useSpecial(pendingSpecial.ownerId,pendingSpecial.cardUid,el.dataset.specialTarget!);
  });
  $('cancelSpecialTarget').addEventListener('click',()=>{pendingSpecial=null;$('specialTargetPanel').classList.add('hidden');});
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
  const arenaEl=$('battleArena');
  arenaEl.addEventListener('pointerover',ev=>{
    const card=(ev.target as HTMLElement).closest<HTMLElement>('[data-slot],[data-intent]');
    if(card)showSlotInfo(card);
  });
  arenaEl.addEventListener('pointerout',ev=>{
    const card=(ev.target as HTMLElement).closest<HTMLElement>('[data-slot],[data-intent]');
    if(!card || card.contains(ev.relatedTarget as Node))return;
    const other=(ev.relatedTarget as HTMLElement|null)?.closest?.('[data-slot],[data-intent]');
    if(other && arenaEl.contains(other))return;
    hideSlotInfo(card.hasAttribute('data-slot')?'ally':'enemy');
  });
  arenaEl.addEventListener('focusin',ev=>{
    const card=(ev.target as HTMLElement).closest<HTMLElement>('[data-slot],[data-intent]');
    if(card)showSlotInfo(card);
  });
  arenaEl.addEventListener('focusout',ev=>{
    const card=(ev.target as HTMLElement).closest<HTMLElement>('[data-slot],[data-intent]');
    if(card)hideSlotInfo(card.hasAttribute('data-slot')?'ally':'enemy');
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
  $('openCollection').addEventListener('click',()=>showScreen('collection'));
  $('openFormation').addEventListener('click',()=>showScreen('raid'));
  $('formationToRaid').addEventListener('click',()=>showScreen('raid'));
  $('returnToRaid').addEventListener('click',()=>showScreen('raid'));
  $('practiceRaid').addEventListener('click',()=>{
    raidRoute=null;
    showScreen('formation');
  });
  $('chooseRaid').addEventListener('click',()=>{
    if(!campaign.isUnlocked(visibleRaidProgress(),bossIndex,difficulty)||
      !raidBosses[bossIndex]?.encounters[difficulty])return;
    raidRoute={index:bossIndex,difficulty};
    showScreen('formation');
  });
  $('raidBosses').addEventListener('click',ev=>{
    const button=(ev.target as HTMLElement).closest<HTMLElement>('[data-raid-boss]');
    if(!button)return;
    bossIndex=Number(button.dataset.raidBoss);
    const progress=visibleRaidProgress();
    difficulty=raidDifficulties.find(level=>campaign.isUnlocked(progress,bossIndex,level)&&!campaign.isCleared(progress,bossIndex,level))??'OMEN';
    renderRaidSelection();
    $('raidBosses').querySelector<HTMLElement>(`[data-raid-boss="${bossIndex}"]`)?.focus();
  });
  $('raidDifficulties').addEventListener('click',ev=>{
    const button=(ev.target as HTMLElement).closest<HTMLElement>('[data-difficulty]');
    if(!button)return;
    difficulty=button.dataset.difficulty as RaidDifficulty;
    renderRaidSelection();
    $('raidDifficulties').querySelector<HTMLElement>(`[data-difficulty="${difficulty}"]`)?.focus();
  });
  $('collectionBack').addEventListener('click',()=>showScreen('home'));
  $('toHome').addEventListener('click',()=>showScreen('home'));
  $('homeSettings').addEventListener('click',()=>$('settingsPanel').classList.remove('hidden'));
  $('closeSettings').addEventListener('click',()=>$('settingsPanel').classList.add('hidden'));
  $('animationsToggle').addEventListener('change',ev=>document.documentElement.classList.toggle('reduced-motion',!(ev.target as HTMLInputElement).checked));
  $('closeCharacterDetail').addEventListener('click',()=>$('characterDetailPanel').classList.add('hidden'));
  for(const overlay of ['settingsPanel','characterDetailPanel'])$(overlay).addEventListener('click',ev=>{if(ev.target===$(overlay))$(overlay).classList.add('hidden');});
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){for(const overlay of ['settingsPanel','characterDetailPanel'])$(overlay).classList.add('hidden');}});
  const keywordList=Array.from(new Set(originalHeroes.flatMap((h:any)=>abilityKeywords(h)))).sort();
  $('keywordFilter').innerHTML='<option value="all">모든 키워드</option>'+keywordList.map(k=>`<option value="${esc(k)}">${esc(K[k]||k)}</option>`).join('');
  for(const id of ['characterSearch','ownershipFilter','keywordFilter'])$(id).addEventListener('input',renderCollection);
  $('clearFilters').addEventListener('click',()=>{($('characterSearch') as HTMLInputElement).value='';($('ownershipFilter') as HTMLSelectElement).value='all';($('keywordFilter') as HTMLSelectElement).value='all';renderCollection();});
  $('applyParty').addEventListener('click',beginBattle);
  $('backToParty').addEventListener('click',()=>showScreen('formation'));
  $('reset').addEventListener('click',()=>{if(confirm('현재 전투를 초기화하고 같은 편성으로 다시 시작할까요?'))beginBattle();});
  $('clearSlot').addEventListener('click',()=>{if(selectedSlotId){game.unassign(selectedSlotId);renderBattle();}});
  $('targetBody').addEventListener('click',()=>{if(selectedSlotId){game.unlink(selectedSlotId);renderBattle();toast('합 연결을 해제했습니다.');}});
  $('execute').addEventListener('click',()=>{game.resolveTurn();selectedSlotId=null;renderBattle();});
  $('nextTurn').addEventListener('click',()=>{game.nextTurn();selectedSlotId=game.allies.find((u:any)=>u.slots.length)?.slots[0]?.id||null;renderBattle();});
  $('copyLog').addEventListener('click',()=>{const value=game.log.map((l:any)=>`[턴 ${l.turn}] ${l.text}`).join('\n');if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).then(()=>toast('전투 기록을 복사했습니다.')).catch(()=>toast('복사에 실패했습니다.'));else toast('클립보드를 지원하지 않습니다.');});
  showScreen('home');
})();
