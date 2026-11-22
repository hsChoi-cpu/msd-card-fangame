declare const module: any;
// Raid Card Engine V5: TypeScript source (compiled into dist/engine.js).
// See src/types.ts for public combat model.
/* Raid Card Prototype - standalone deterministic-ish turn battle engine.
   No dependencies. CommonJS export for tests and browser global for UI. */
(function (root: any) {
  'use strict';
  const K: Record<string,string> = {
    ATTACK_UP:'공격력 증가', ATTACK_DOWN:'공격력 감소', DEFENSE_UP:'방어력 증가', DEFENSE_DOWN:'방어력 감소',
    POWER_UP:'위력 증가', POWER_DOWN:'위력 감소', HASTE:'신속', BIND:'속박',
    PROTECTION:'보호', VULNERABLE:'취약', EVADE:'회피', SHIELD:'방어막',BURN:'화상',BLEED:'출혈',RUPTURE:'파열',POISON:'독',CORROSION:'부식',PARALYSIS:'마비',TAUNT:'도발',DISTRACTION:'사고 분산',DAMAGE_DOWN:'피해량 감소',LOCKDOWN:'봉쇄',MANA_BACKFLOW:'마력 역류',MANA_LEAK:'마력 누출',MARK:'표식',BREATH:'호흡',REGEN:'재생',FOCUS:'집중',DAMAGE_UP:'피해량 증가',MANA_EFFICIENCY:'마력 효율',BLESSING:'가호',LIFESTEAL:'흡혈'
  };
  const T: Record<string,string> = { ATTACK:'공격', GUARD:'방어', EVADE:'회피', COUNTER:'반격', SPECIAL:'특수', MULTI_ATTACK:'연속 공격' };
  const eff = (trigger: EffectTrigger, keyword: KeywordId, potency?: number, count?: number, target: EffectTarget='SELF') => ({trigger,action:'APPLY_KEYWORD',keyword,potency,count,target});
  // Optional illustration path: set the returned card's image field to 'assets/cards/filename.png'.
  const card = (id,name,type,power,description='',effects=[]) => ({id,name,type,power,description,effects,image:null as string | null,manaCost: type==='ATTACK'?(power>=15?3:2):type==='EVADE'?(power>=15?3:2):type==='COUNTER'?(power>=15?3:2):type==='GUARD'?(power>=15?2:1):0});
  const HEROES: HeroTemplate[] = [
    {id:'knight',name:'수호기사',role:'방어 · 가로채기',symbol:'🛡️',maxHp:108,speed:[2,6],color:'#6f9ed9',deck:[
      card('k1','수호의 일격','ATTACK',12,'합 승리 시 공격력 증가 2 · 횟수 2',[eff('ON_CLASH_WIN','ATTACK_UP',2,2)]),
      card('k2','균열 베기','ATTACK',10,'적중 시 대상에게 취약 2 · 횟수 2',[eff('ON_HIT','VULNERABLE',2,2,'TARGET')]),
      card('k3','철벽','GUARD',17,'사용 시 방어막 17 생성'),
      card('k4','방패 들기','GUARD',12,'사용 시 보호 1 · 횟수 2',[eff('ON_USE','PROTECTION',1,2)]),
      card('k5','단죄','ATTACK',16,'높은 위력의 공격'),
      card('k6','응징의 자세','COUNTER',14,'피격 후 공격자에게 반격 · 턴당 1회'),
      card('k7','집중 방호','GUARD',10,'사용 시 방어력 증가 3',[eff('ON_USE','DEFENSE_UP',3)]),
      card('k8','협공 타격','ATTACK',11,'적중 시 대상에게 공격력 감소 2',[eff('ON_HIT','ATTACK_DOWN',2,undefined,'TARGET')])
    ]},
    {id:'rogue',name:'그림자 검객',role:'회피 · 신속',symbol:'🗡️',maxHp:76,speed:[5,9],color:'#9f8bd5',deck:[
      card('r1','그림자 걸음','EVADE',14,'발동 시 회피 14 획득 · 실패 시 소멸'),
      card('r2','잔영','EVADE',17,'높은 위력의 회피'),
      card('r3','기습','ATTACK',11,'합 승리 시 자신에게 신속 2 예약',[eff('ON_CLASH_WIN','HASTE',2)]),
      {...card('r4','급소 절단','MULTI_ATTACK',16,'3연속 공격: 타격마다 개별 피해·적중 효과'),hitCount:3},
      card('r5','허점 찌르기','ATTACK',9,'적중 시 취약 3 및 파열 3 · 횟수 3',[eff('ON_HIT','VULNERABLE',3,undefined,'TARGET'),eff('ON_HIT','RUPTURE',3,3,'TARGET')]),
      {...card('r6','교란 봉인','SPECIAL',0,'즉시 사용: 보스에게 다음 턴 속박 2 예약',[eff('ON_USE','BIND',2,undefined,'TARGET')]),specialTarget:'ENEMY',manaCost:1},
      card('r7','반격 자세','COUNTER',13,'피격 시 반격'),
      card('r8','집중 검무','ATTACK',12,'사용 시 공격력 증가 2',[eff('ON_USE','ATTACK_UP',2)])
    ]},
    {id:'mage',name:'비전술사',role:'약화 · 공격',symbol:'🔮',maxHp:82,speed:[3,7],color:'#e7a46e',deck:[
      card('m1','비전 화살','ATTACK',14,'적중 시 화상 3 · 횟수 2',[eff('ON_HIT','BURN',3,2,'TARGET')]),
      card('m2','마력 집중','ATTACK',9,'사용 시 위력 증가 3',[eff('ON_USE','POWER_UP',3)]),
      card('m3','봉인술','ATTACK',10,'적중 시 공격력 감소 3 · 횟수 2 및 독 2 · 횟수 2',[eff('ON_HIT','ATTACK_DOWN',3,2,'TARGET'),eff('ON_HIT','POISON',2,2,'TARGET')]),
      card('m4','마력 파장','ATTACK',13,'합 승리 시 대상에게 취약 2 · 횟수 2',[eff('ON_CLASH_WIN','VULNERABLE',2,2,'TARGET')]),
      card('m5','비전 장벽','GUARD',13,'사용 시 자신에게 방어막 부여'),
      {...card('m6','마력 공급','SPECIAL',0,'즉시 사용: 선택한 아군의 마력 3 회복',[{trigger:'ON_USE',action:'RESTORE_MANA',value:3,target:'TARGET'}]),specialTarget:'ALLY',manaCost:1},
      card('m7','역류 반격','COUNTER',16,'피격 시 마법 반격'),
      card('m8','쇠약의 파동','ATTACK',11,'적중 시 대상에게 위력 감소 2',[eff('ON_HIT','POWER_DOWN',2,undefined,'TARGET')])
    ]}
  ];
  const copy = <A>(x: A): A => JSON.parse(JSON.stringify(x));
  // Every character has 10 physical cards spanning 6 fixed definitions.
  // Four definitions occur twice, and two definitions occur once (4*2+2=10).
  function fixedDeck(seed: CardDefinition[]): CardDefinition[] {
    const selected=seed.slice(0,6);
    return [...selected.slice(0,4),...selected.slice(0,4),...selected.slice(4,6)].map(c=>copy(c));
  }
  for(const h of HEROES) h.deck=fixedDeck(h.deck);
  const expansion: Array<{id:string;name:string;role:string;symbol:string;maxHp:number;speed:number[];color:string;from:number}> = [
    {id:'priest',name:'별빛 사제',role:'치유 · 수비',symbol:'✨',maxHp:88,speed:[2,6],color:'#a6cf98',from:0},
    {id:'ranger',name:'황혼 사수',role:'집중 공격',symbol:'🏹',maxHp:80,speed:[4,8],color:'#d8b472',from:1},
    {id:'scholar',name:'룬 연구가',role:'마력 · 지원',symbol:'📜',maxHp:84,speed:[3,7],color:'#8dc6cc',from:2}
  ];
  for(const h of expansion){
    const src=HEROES[h.from];
    HEROES.push({id:h.id,name:h.name,role:h.role,symbol:h.symbol,maxHp:h.maxHp,speed:h.speed,color:h.color,
      deck:src.deck.map(c=>({...copy(c),id:c.id+'_'+h.id}))});
  }
  const MANA: Record<string,{max:number;regen:number}> = {
    knight:{max:12,regen:3}, rogue:{max:11,regen:4}, mage:{max:14,regen:4},
    priest:{max:13,regen:4}, ranger:{max:12,regen:3}, scholar:{max:15,regen:5}
  };
  const PASSIVES: Record<string,CardDefinition|CardDefinition[]> = {
    knight: card('passive-knight','수호의 맹세','SPECIAL',0,'합 패배 시 마력 1 회복',[
      {trigger:'ON_CLASH_LOSE',action:'RESTORE_MANA',value:1}]),
    rogue: card('passive-rogue','민첩한 발놀림','SPECIAL',0,'회피 성공 시 다음 턴 신속 1 예약',[
      {trigger:'ON_EVADE_SUCCESS',action:'APPLY_KEYWORD',keyword:'HASTE',potency:1}]),
    mage: card('passive-mage','마력 순환','SPECIAL',0,'합 승리 시 마력 1 회복',[
      {trigger:'ON_CLASH_WIN',action:'RESTORE_MANA',value:1}]),
    priest: card('passive-priest','별의 가호','SPECIAL',0,'턴 시작 시 체력 2 회복',[
      {trigger:'ON_TURN_START',action:'HEAL',value:2}]),
    ranger: card('passive-ranger','집중 사격','SPECIAL',0,'합 승리 시 다음 턴 신속 1 예약',[
      {trigger:'ON_CLASH_WIN',action:'APPLY_KEYWORD',keyword:'HASTE',potency:1}]),
    scholar: card('passive-scholar','마력 재활용','SPECIAL',0,'턴 시작 시 추가 마력 1 회복',[
      {trigger:'ON_TURN_START',action:'RESTORE_MANA',value:1}])
  };
  function passiveList(definition?:CardDefinition|CardDefinition[]):CardDefinition[] {
    return Array.isArray(definition)?definition:definition?[definition]:[];
  }
  const BOSS_MOVES: CardDefinition[] = [
    card('b1','심연의 참격','ATTACK',15,'단일 공격'),
    {...card('b2','파쇄 일격','MULTI_ATTACK',19,'3연속 공격'),hitCount:3},
    card('b3','침식의 발톱','ATTACK',12,'적중 시 취약 1 · 횟수 2 및 출혈 2 · 횟수 2',[eff('ON_HIT','VULNERABLE',1,2,'TARGET'),eff('ON_HIT','BLEED',2,2,'TARGET')]),
    card('b4','압도적인 일격','ATTACK',23,'강력한 단일 공격'),
    card('b5','심연의 가호','GUARD',12,'방어막을 생성하고 보호 1 획득',[eff('ON_USE','PROTECTION',1)]),
    card('b6','파멸의 일격','ATTACK',26,'2페이즈 강공격')
  ];
  const PRACTICE_ENCOUNTER: BossEncounter = {
    name:'심연의 군주', maxHp:260, speed:[3,8], symbol:'👁️', moves:BOSS_MOVES,
    phaseFor:battle=>battle.boss.hp<=130?2:1,
    slotCount:battle=>battle.phase===1?3:4,
    pickMove:battle=>{
      const pool=battle.phase===1?[0,0,1,2,2,4]:[0,1,1,2,3,3,4,5];
      return BOSS_MOVES[pool[battle.randint(0,pool.length-1)]];
    }
  };
  const clamp = (n: number,min: number,max: number): number => Math.min(max,Math.max(min,n));
  const boundedKeyword = (n: number): number => clamp(Math.trunc(Number.isFinite(n)?n:0),0,99);
  const SINGLE=new Set(['CORROSION','PARALYSIS','DISTRACTION','MANA_BACKFLOW','MANA_LEAK','MANA_EFFICIENCY','REGEN','FOCUS','BLESSING','LIFESTEAL','LOCKDOWN','TAUNT']);
  const NO_DECAY=new Set(['BLEED','RUPTURE']);
  const sortSlotsBySpeed = <S extends {speed:number}>(slots:S[]):S[] => slots.map((slot,index)=>({slot,index})).sort((a,b)=>b.slot.speed-a.slot.speed || a.index-b.index).map(x=>x.slot);
  class RaidBattle {
    rng: () => number;
    turn!: number;
    serial!: number;
    log!: Array<{turn:number;text:string}>;
    events!: BattleEvent[];
    status!: BattleStatus;
    phase!: number;
    effectDepth!: number;
    effectBudget!: number;
    uidCounter!: number;
    pendingDiscards!: Array<{ownerId:string;remaining:number}>;
    allies!: Combatant[];
    boss!: Combatant;
    partyIds: string[];
    maxPartySize: number;
    encounter: BossEncounter;

    constructor(rng:()=>number=Math.random, options: {partyIds?:string[];maxPartySize?:number;encounter?:BossEncounter}={}) {
      this.rng=rng;
      this.encounter=options.encounter??PRACTICE_ENCOUNTER;
      this.maxPartySize=options.maxPartySize??6;
      this.partyIds=options.partyIds??['knight','rogue','mage'];
      this.reset();
    }
    passive(owner:Combatant,trigger:EffectTrigger,target:Combatant=owner,extra:any={}) {
      if(owner?.hp>0) {
        for(const card of passiveList(owner.passives??owner.passive)) {
          if(owner.hp<=0)break;
          this.runEffects(card,trigger,owner,target,extra);
        }
      }
    }
    restoreMana(unit:Combatant, amount:number):number {
      if(unit.id==='boss'||unit.hp<=0||this.kw(unit,'MANA_BACKFLOW')>0)return 0;
      const before=unit.mana;
      unit.mana=clamp(unit.mana+Math.max(0,Math.floor(amount)),0,unit.maxMana);
      return unit.mana-before;
    }
    totalPlannedMana(hero:Combatant,excludedSlotId?:string):number {
      return (hero.slots||[]).reduce((sum,s)=>{
        if(s.id===excludedSlotId)return sum;
        const c=this.cardForSlot(s);
        return sum+(c?this.manaCost(hero,c):0);
      },0);
    }
    // The reservation is checked at planning; payment occurs only upon execution.
    consumeAction(slot:any):boolean {
      const hero=this.getUnit(slot.ownerId);
      const c=this.cardForSlot(slot);
      if(!hero||!c||hero.hp<=0)return false;
      const cost=this.manaCost(hero,c);
      if(hero.mana<cost){this.note(`${hero.name}: [${c.name}] 마력 부족으로 사용 취소`);return false;}
      hero.mana-=cost;
      hero.usedThisTurn=(hero.usedThisTurn??0)+1;
      // Keep card in hand during resolution so cardForSlot can resolve it;
      // commit the move to discard when the action resolves.
      slot._executingCard=c;
      this.note(`${hero.name}: 마력 -${cost} (${hero.mana}/${hero.maxMana})`);
      return true;
    }
    randint(min,max) { return Math.floor(this.rng()*(max-min+1))+min; }
    shuffle(arr) { for(let i=arr.length-1;i>0;i--){let j=this.randint(0,i);[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
    reset() {
      this.turn=0;this.serial=0;this.log=[];this.events=[];this.status='PLANNING';this.phase=1;this.effectDepth=0;this.effectBudget=0;this.uidCounter=0;this.pendingDiscards=[];
      if(!Number.isInteger(this.maxPartySize)||this.maxPartySize<1||this.maxPartySize>6)throw new Error('최대 출전 수는 1~6이어야 합니다.');
      if(!this.partyIds.length||this.partyIds.length>this.maxPartySize||new Set(this.partyIds).size!==this.partyIds.length)throw new Error('출전 인원/중복 편성이 올바르지 않습니다.');
      const selected=this.partyIds.map(id=>{
        const found=HEROES.find(h=>h.id===id);
        if(!found)throw new Error(`알 수 없는 캐릭터: ${id}`);
        return found;
      });
      this.allies=selected.map(h=>{
        const defined=PASSIVES[h.id];
        const passives=defined?Array.isArray(defined)?{passives:copy(defined)}:{passive:copy(defined)}:{};
        return {id:h.id,name:h.name,role:h.role,symbol:h.symbol,color:h.color,portrait:h.portrait,sprite:h.sprite,hp:h.maxHp,maxHp:h.maxHp,speed:[...h.speed],keywords:{},pending:[],counter:null,evadeSource:null,
          maxMana:MANA[h.id].max,mana:MANA[h.id].max,manaRegen:MANA[h.id].regen,usedThisTurn:0,lastTurnUsed:0,...passives,
          deck:this.shuffle(h.deck.map((c,i)=>({...copy(c),uid:`${h.id}-${i}`}))),hand:[],discard:[],exhaust:[],slots:[]};
      });
      const {name,maxHp,speed,symbol,portrait,sprite,passives}=this.encounter;
      this.boss={id:'boss',name,symbol,portrait,sprite,hp:maxHp,maxHp,speed:[...speed],passives:copy(passives??[]),keywords:{},pending:[],counter:null,evadeSource:null,intents:[]};
      this.note('전투 시작! 각 캐릭터의 고정 덱으로 보스에 대응하세요.');
      for(const unit of this.allies){for(const c of [...unit.deck])this.runEffects(c,'ON_BATTLE_START',unit,unit,{silent:true});this.passive(unit,'ON_BATTLE_START');}
      this.passive(this.boss,'ON_BATTLE_START');
      this.startTurn();
    }
    note(s){this.log.push({turn:this.turn,text:s});}
    emit(type, data={}) {
      const event={turn:this.turn,order:++this.serial,type,...data};
      this.events.push(event);
      return event;
    }

    getUnit(id){return id==='boss'?this.boss:this.allies.find(u=>u.id===id);}
    kw(unit,id){return unit.keywords[id]?.potency||0;}
    apply(unit: Combatant,id: KeywordId,application: KeywordApplication={}) {
      if(!unit||unit.hp<=0)return;
      if(id==='TAUNT'){
        // Most recent reservation always wins; no restoration if source dies.
        unit.pending=unit.pending.filter(p=>p.id!=='TAUNT');
        unit.pending.push({id,potency:1,count:null,sourceId:application.sourceId});
        this.note(`${unit.name}: ${application.sourceId??'알 수 없는 대상'} 도발 예약`);return;
      }
      if(id==='HASTE'||id==='BIND'||id==='LOCKDOWN'){
        const current=unit.pending.find(p=>p.id===id);
        if(current){current.potency=boundedKeyword(current.potency+(application.potency??0));current.count=boundedKeyword((current.count??0)+(application.count??0));}
        else unit.pending.push({id,potency:boundedKeyword(application.potency??1),count:boundedKeyword(application.count??1)});
        this.note(`${unit.name}: ${K[id]} ${application.potency??(current?0:1)} 예약 (다음 턴)`);
        return;
      }
      if(id==='EVADE'){
        const p=boundedKeyword(application.potency??1);
        const old=this.kw(unit,'EVADE');
        if(p>old)unit.keywords.EVADE={potency:p,count:null};
        this.note(`${unit.name}: 회피 ${this.kw(unit,'EVADE')} 활성화 (높은 값 유지)`);
        return;
      }
      if(id==='SHIELD'){
        const p=boundedKeyword(application.potency??0);
        unit.keywords.SHIELD={potency:boundedKeyword(this.kw(unit,'SHIELD')+p),count:null};
        this.note(`${unit.name}: 방어막 +${p} (총 ${this.kw(unit,'SHIELD')})`);
        return;
      }
      if(id==='MARK'){
        const key=`MARK:${application.sourceId??'unknown'}`;
        const old=unit.keywords[key];
        if(old){old.potency=boundedKeyword(old.potency+(application.potency??0));if(application.count!==undefined)old.count=boundedKeyword((old.count??0)+application.count);}
        else unit.keywords[key]={potency:boundedKeyword(application.potency??1),count:boundedKeyword(application.count??1),sourceId:application.sourceId};
        return;
      }
      if(SINGLE.has(id)){
        const old=unit.keywords[id];
        const delta=application.potency??application.count??1;
        unit.keywords[id]={potency:boundedKeyword((old?.potency??0)+delta),count:null};return;
      }
      const old=unit.keywords[id];
      if(old){old.potency=boundedKeyword(old.potency+(application.potency??0)); old.count=boundedKeyword((old.count??0)+(application.count??0));}
      else unit.keywords[id]={potency:boundedKeyword(application.potency??1),count:boundedKeyword(application.count??1)};
      this.note(`${unit.name}: ${K[id]||id} [위력 ${unit.keywords[id].potency} / 횟수 ${unit.keywords[id].count}]`);
    }
    activatePending(unit: Combatant){
      const pending=unit.pending;unit.pending=[];
      for(const k of pending){
        if(k.id==='TAUNT'){
          const source=this.getUnit(k.sourceId);
          if(!source||source.hp<=0){delete unit.keywords.TAUNT;this.note(`${unit.name}: 도발 부여자 전투 불능 → 도발 무효`);continue;}
          unit.keywords.TAUNT={potency:1,count:null,sourceId:k.sourceId};continue;
        }
        if(k.id==='LOCKDOWN'){unit.keywords.LOCKDOWN={potency:1,count:null};continue;}
        const old=unit.keywords[k.id];
        if(old){old.potency=boundedKeyword(old.potency+k.potency);old.count=boundedKeyword((old.count??0)+(k.count??0));}
        else unit.keywords[k.id]={potency:boundedKeyword(k.potency),count:k.count===null?null:boundedKeyword(k.count)};
        this.note(`${unit.name}: 예약된 ${K[k.id]} ${k.potency} 활성화`);
      }
    }
    manaCost(unit:Combatant,c:CardDefinition):number {
      return Math.max(0,(c.manaCost??0)+this.kw(unit,'MANA_LEAK')-this.kw(unit,'MANA_EFFICIENCY')+(c.costModifier??0));
    }
    moveUsedCard(unit:Combatant,c:CardDefinition):void {
      if(c.generated && !c.recycleGenerated){(unit.exhaust??=[]).push(c);this.note(`${unit.name}: 생성 카드 [${c.name}] 소멸`);}
      else unit.discard.push(c);
    }
    newCard(unit:Combatant,template:CardDefinition,options:any={}):CardDefinition {
      const c=copy(template);c.uid=`generated-${unit.id}-${++this.uidCounter}`;c.generated=true;
      c.recycleGenerated=!!options.recycleGenerated;return c;
    }
    // Explicit card changes are per physical card copy, not per template.
    createCard(unit:Combatant,template:CardDefinition,options:any={}):CardDefinition {
      if(unit.id==='boss')throw new Error('보스 손패에는 카드를 생성할 수 없습니다.');
      const c=this.newCard(unit,template,options);
      const place=options.destination??'HAND';
      if(place==='DECK')unit.deck.push(c);else if(place==='DISCARD')unit.discard.push(c);else unit.hand.push(c);
      this.emit('CARD_CREATED',{ownerId:unit.id,cardUid:c.uid,destination:place});return c;
    }
    chooseDiscard(ownerId:string,cardUid:string):{ok:boolean;reason?:string} {
      const req=this.pendingDiscards[0];
      if(!req||req.ownerId!==ownerId)return {ok:false,reason:'선택 대기 중인 버리기 효과가 없습니다.'};
      const unit=this.getUnit(ownerId);
      const result=this.discardCards(unit,1,'CHOOSE',[cardUid]);
      if(!result)return {ok:false,reason:'현재 선택할 수 없는 카드입니다.'};
      req.remaining--;
      const selectable=unit.hand.filter(c=>!unit.slots?.some(s=>s.cardUid===c.uid));
      if(req.remaining<=0||!selectable.length)this.pendingDiscards.shift();
      return {ok:true};
    }
    discardCards(unit:Combatant,n:number,selection:'RANDOM'|'CHOOSE'='RANDOM',uids:string[]=[]):number {
      if(!unit.hand)return 0;
      let count=0;
      const candidates=selection==='CHOOSE'?uids.slice():[];
      for(let i=0;i<Math.max(0,Math.trunc(n));i++){
        const available=unit.hand.filter(c=>!unit.slots?.some(s=>s.cardUid===c.uid));
        if(!available.length)break;
        const c=selection==='CHOOSE'?available.find(x=>x.uid===candidates[i]):available[this.randint(0,available.length-1)];
        if(!c)break;
        unit.hand.splice(unit.hand.indexOf(c),1);unit.discard.push(c);count++;
        this.emit('CARD_DISCARDED',{ownerId:unit.id,cardUid:c.uid});
      }
      return count;
    }
    replenishHand(unit:Combatant):number {
      let count=0;
      while(unit.hp>0&&unit.hand.length<3&&unit.mana>0&&(unit.deck.length||unit.discard.length)){
        const before=unit.hand.length;this.draw(unit,1);
        if(unit.hand.length===before)break;
        unit.mana--;count++;
      }
      if(count){this.note(`${unit.name}: 손패 최소 보충 ${count}장 (마력 -${count})`);this.emit('HAND_REPLENISHED',{ownerId:unit.id,count});}
      return count;
    }
    speedFor(unit){return this.kw(unit,'LOCKDOWN')>0?1:Math.max(1,this.randint(unit.speed[0],unit.speed[1])+this.kw(unit,'HASTE')-this.kw(unit,'BIND'));}

    draw(unit,n){
      for(let i=0;i<n;i++){
        if(!unit.deck.length){if(!unit.discard.length)break;unit.deck=this.shuffle(unit.discard.splice(0));}
        unit.hand.push(unit.deck.pop());
      }
    }
    // Special cards are played directly from the owner's hand during planning.
    // They consume mana and discard immediately without claiming an action slot.
    playSpecial(ownerId:string, cardUid:string, targetId?:string) {
      if(this.status!=='PLANNING')return {ok:false,reason:'행동 지정 단계에서만 사용할 수 있습니다.'};
      if(this.pendingDiscards.length)return {ok:false,reason:'먼저 버릴 카드를 선택해야 합니다.'};
      const owner=this.allies.find(u=>u.id===ownerId);
      if(!owner||owner.hp<=0)return {ok:false,reason:'특수 카드를 사용할 캐릭터가 없습니다.'};
      const c=owner.hand.find(x=>x.uid===cardUid);
      if(!c||c.type!=='SPECIAL')return {ok:false,reason:'손패의 특수 카드만 즉시 사용할 수 있습니다.'};
      const targeting=c.specialTarget??'SELF';
      const target=targeting==='SELF'?owner:targetId?this.getUnit(targetId):null;
      if(!target||target.hp<=0)return {ok:false,reason:'유효한 대상이 필요합니다.'};
      if(targeting==='ALLY' && !this.allies.includes(target))return {ok:false,reason:'아군을 지정해야 합니다.'};
      if(targeting==='ENEMY' && target!==this.boss)return {ok:false,reason:'적을 지정해야 합니다.'};
      if(targeting==='ANY' && target!==this.boss && !this.allies.includes(target))return {ok:false,reason:'아군 또는 적을 지정해야 합니다.'};
      // Never make already-equipped cards unaffordable due to immediate spending.
      const available=owner.mana-this.totalPlannedMana(owner);
      const cost=this.manaCost(owner,c);
      if(cost>available)return {ok:false,reason:`마력이 부족합니다. 사용 가능 ${available} / 소모 ${cost} (예약 마력 제외)`};
      owner.mana-=cost;
      owner.usedThisTurn=(owner.usedThisTurn??0)+1;
      const index=owner.hand.findIndex(x=>x.uid===cardUid);
      owner.hand.splice(index,1);
      this.moveUsedCard(owner,c);
      this.note(`${owner.name}: 특수 카드 [${c.name}] 즉시 사용 (마력 -${cost})`);
      this.emit('SPECIAL_PLAYED',{ownerId:owner.id,cardId:c.id,targetId:target.id});
      // activate invokes ON_USE and owner passive exactly once.
      this.activate(c,owner,target);
      if(this.boss.hp<=0){this.status='WON';this.note(`🏆 레이드 성공! ${this.boss.name} 격파`);}
      else if(!this.allies.some(a=>a.hp>0)){this.status='LOST';this.note('☠ 레이드 실패! 모든 아군이 쓰러졌습니다.');}
      return {ok:true};
    }
    // Only physical card copies in hand may be assigned to a slot.
    discardHandOverflow(unit:Combatant) {
      if(!unit.hand)return 0;
      let count=0;
      while(unit.hand.length>7){
        const index=this.randint(0,unit.hand.length-1);
        const [removed]=unit.hand.splice(index,1);
        unit.discard.push(removed);
        this.note(`${unit.name}: 손패 7장 초과 → [${removed.name}] 무작위 버림`);
        this.emit('HAND_OVERFLOW_DISCARDED',{ownerId:unit.id,cardId:removed.id,cardUid:removed.uid});
        count++;
      }
      return count;
    }
    startTurn(){
      if(this.status==='WON'||this.status==='LOST')return;
      this.turn++;this.effectBudget=0;this.status='PLANNING';this.phase=this.encounter.phaseFor?.(this)??1;
      this.note(`──── ${this.turn}턴 시작 / 보스 ${this.phase}페이즈 ────`);
      this.emit('TURN_START',{turn:this.turn});
      for(const u of [...this.allies,this.boss])this.activatePending(u);
      if(this.turn>1)for(const unit of this.allies)if(unit.hp>0){
        const actual=this.restoreMana(unit,unit.manaRegen);
        this.note(`${unit.name}: 자연 마력 회복 +${actual} (${unit.mana}/${unit.maxMana})`);
      }
      this.tickStartKeywords();
      if(this.boss.hp<=0){this.status='WON';this.note('🏆 보스가 턴 시작 상태 효과로 쓰러졌습니다.');return;}
      if(!this.allies.some(a=>a.hp>0)){this.status='LOST';this.note('☠ 모든 아군이 턴 시작 상태 효과로 쓰러졌습니다.');return;}
      const taunt=this.boss.keywords.TAUNT;
      if(taunt && (!this.getUnit(taunt.sourceId)||this.getUnit(taunt.sourceId).hp<=0))delete this.boss.keywords.TAUNT;
      this.phase=this.encounter.phaseFor?.(this)??1;
      this.runLifecycleEffects('ON_TURN_START');
      for(const unit of [...this.allies,this.boss])this.passive(unit,'ON_TURN_START');
      const count=this.allies.length;
      const minimum=Math.floor(this.maxPartySize/count), extra=this.maxPartySize%count;
      for(const [index,unit] of this.allies.entries()){
        const slotCount=minimum+(index<extra?1:0);
        unit.slots=unit.hp>0?Array.from({length:slotCount},(_,i)=>({id:`${unit.id}-t${this.turn}-s${i}`,ownerId:unit.id,speed:this.speedFor(unit),cardUid:null,targetIntentId:null})):[];
        unit.usedThisTurn=0;
        if(unit.hp>0){
          const n=this.turn===1?unit.slots.length+2:unit.lastTurnUsed;
          this.draw(unit,n);
          this.replenishHand(unit);
          this.note(`${unit.name}: ${n}장 드로우 요청 (손패 ${unit.hand.length}장)`);
        }
      }
      const taunter=this.getUnit(this.boss.keywords.TAUNT?.sourceId);
      const forcedTarget=taunter?.hp>0?taunter:null;
      this.boss.intents=Array.from({length:this.encounter.slotCount(this)},(_,i)=>{
        const m=copy(this.encounter.pickMove(this,i));
        const living=this.allies.filter(a=>a.hp>0);
        const target=m.type==='GUARD'?'boss':(forcedTarget??living[this.randint(0,living.length-1)])?.id??'boss';
        return {id:`boss-t${this.turn}-s${i}`,ownerId:'boss',speed:this.speedFor(this.boss),card:m,targetId:target};
      });
    }
    cardForSlot(slot){let hero=this.getUnit(slot.ownerId);return hero?.hand.find(c=>c.uid===slot.cardUid)||null;}
    assignCard(slotId,cardUid){
      if(this.status!=='PLANNING')return {ok:false,reason:'현재는 행동 배치 단계가 아닙니다.'};
      if(this.pendingDiscards.length)return {ok:false,reason:'먼저 버릴 카드를 선택해야 합니다.'};
      const hero=this.allies.find(u=>u.slots.some(s=>s.id===slotId));
      if(!hero||hero.hp<=0)return {ok:false,reason:'선택할 수 없는 슬롯입니다.'};
      const c=hero.hand.find(x=>x.uid===cardUid);
      if(!c)return {ok:false,reason:'해당 카드가 손패에 없습니다.'};
      if(c.type==='SPECIAL')return {ok:false,reason:'특수 카드는 슬롯에 장착하지 않고 즉시 사용합니다.'};
      const proposed=this.totalPlannedMana(hero,slotId)+this.manaCost(hero,c);
      // Moving the same physical card from another slot is free of double reservation.
      const previous=hero.slots.find(s=>s.cardUid===cardUid && s.id!==slotId);
      const net=proposed-(previous?this.manaCost(hero,c):0);
      if(net>hero.mana)return {ok:false,reason:`마력이 부족합니다. 배치 비용 ${net} / 보유 ${hero.mana}`};
      for(const s of hero.slots)if(s.cardUid===cardUid){s.cardUid=null;s.targetIntentId=null;}
      let slot=hero.slots.find(s=>s.id===slotId);
      slot.cardUid=cardUid;slot.targetIntentId=null;
      return {ok:true};
    }
    unassign(slotId){for(const u of this.allies)for(const s of u.slots)if(s.id===slotId){s.cardUid=null;s.targetIntentId=null;return;}}
    linkIntent(slotId,intentId){
      if(this.status!=='PLANNING')return {ok:false,reason:'행동 배치 단계가 아닙니다.'};
      const slot=this.allies.flatMap(u=>u.slots).find(s=>s.id===slotId);
      if(!slot||!slot.cardUid)return {ok:false,reason:'먼저 슬롯에 카드를 배치하세요.'};
      if(this.cardForSlot(slot)?.type==='SPECIAL')return {ok:false,reason:'특수 카드는 합을 진행하지 않습니다.'};
      const intent=this.boss.intents.find(x=>x.id===intentId);
      if(!intent||!['ATTACK','MULTI_ATTACK'].includes(intent.card.type))return {ok:false,reason:'공격 행동 슬롯만 직접 대응할 수 있습니다.'};
      const existing=this.allies.flatMap(u=>u.slots).find(s=>s.id!==slotId&&s.targetIntentId===intentId&&s.cardUid);
      if(existing)return {ok:false,reason:'이 보스 행동에는 이미 다른 아군이 대응하고 있습니다.'};
      if(intent.targetId!==slot.ownerId&&slot.speed<=intent.speed){return {ok:false,reason:'가로채기 실패: 아군 슬롯 속도가 보스 속도보다 높아야 합니다.'};}
      slot.targetIntentId=intentId;
      return {ok:true};
    }
    unlink(slotId){const slot=this.allies.flatMap(u=>u.slots).find(s=>s.id===slotId);if(slot)slot.targetIntentId=null;}
    finalPower(unit,c){
      const typeBonus=(c.type==='ATTACK'||c.type==='MULTI_ATTACK')?this.kw(unit,'ATTACK_UP')-this.kw(unit,'ATTACK_DOWN'):
        ['GUARD','EVADE','COUNTER'].includes(c.type)?this.kw(unit,'DEFENSE_UP')-this.kw(unit,'DEFENSE_DOWN'):0;
      return Math.max(0,c.power+typeBonus+this.kw(unit,'POWER_UP')-this.kw(unit,'POWER_DOWN')+(c.type==='SPECIAL'?0:this.kw(unit,'FOCUS')-this.kw(unit,'DISTRACTION')-10*(this.kw(unit,'PARALYSIS')>0?1:0))); 
    }
    // Opt-in passive effects: only scope:'OWNED' subscriptions, once per card
    // definition per owner. Default card effects fire only when a card is used.
    runLifecycleEffects(trigger) {
      for(const owner of [...this.allies,this.boss]) {
        if(owner.hp<=0)continue;
        const owned=owner.id==='boss'?this.encounter.moves:owner.deck.concat(owner.hand,owner.discard);
        const seen=new Set();
        for(const c of owned){
          if(seen.has(c.id))continue;
          seen.add(c.id);
          this.runEffects(c,trigger,owner,owner,{passiveOnly:true});
        }
      }
    }
    // Effects are declarative: event -> optional conditions -> ordered actions.
    // Priority: higher first; original order breaks ties, for deterministic replay.
    effectConditionsMet(conditions,owner,target,extra: any={}) {
      return (conditions||[]).every(condition=>{
        const unit=condition.target==='TARGET'?target:owner;
        if(!unit)return false;
        switch(condition.kind){
          case 'HAS_KEYWORD': return this.kw(unit,condition.keyword)>=(condition.min??1);
          case 'MISSING_KEYWORD': return this.kw(unit,condition.keyword)===0;
          case 'HP_AT_MOST_PERCENT': return unit.hp*100<=unit.maxHp*condition.value;
          case 'HP_AT_LEAST_PERCENT': return unit.hp*100>=unit.maxHp*condition.value;
          case 'DAMAGE_AT_LEAST': return (extra.hpDamage??0)>=condition.value;
          case 'SHIELD_AT_LEAST': return this.kw(unit,'SHIELD')>=condition.value;
          case 'TURN_AT_LEAST': return this.turn>=condition.value;
          case 'TURN_AT_MOST': return this.turn<=condition.value;
          case 'KEYWORD_COUNT_AT_LEAST': return (unit.keywords[condition.keyword]?.count??0)>=condition.value;
          case 'TARGET_ALIVE': return unit.hp>0;
          default: return false; // Unknown conditions must not silently pass.
        }
      });
    }
    modifyKeyword(unit: Combatant,id: KeywordId,change: KeywordApplication={}) {
      const current=unit?.keywords[id];
      if(!current)return;
      if(change.potency!==undefined)current.potency=boundedKeyword(current.potency+change.potency);
      if(change.count!==undefined && current.count!=null)current.count=boundedKeyword(current.count+change.count);
      if(current.potency===0 || current.count===0){
        delete unit.keywords[id];
        if(id==='EVADE')unit.evadeSource=null;
      }
      this.note(`${unit.name}: ${K[id]||id} 변경 (위력 ${this.kw(unit,id)}, 횟수 ${unit.keywords[id]?.count??'없음'})`);
    }
    resolveEffectTargets(mode,owner,target,extra: any={}) {
      switch(mode||'SELF') {
        case 'SELF': return [owner];
        case 'TARGET': return target?[target]:[];
        case 'ATTACKER': return extra.attacker?[extra.attacker]:[];
        case 'ALL_ALLIES': return owner.id==='boss'?[this.boss]:this.allies.filter(u=>u.hp>0);
        case 'ALL_ENEMIES': return owner.id==='boss'?this.allies.filter(u=>u.hp>0):this.boss.hp>0?[this.boss]:[];
        default: return [];
      }
    }
    // Effect damage is a separate damage instance, not a new card hit.
    // This avoids recursive ON_HIT and counter chains. It respects protect,
    // vulnerable and shield, but does not trigger attack-specific effects.
    dealEffectDamage(source,target,amount,fx: any={}) {
      if(!target||target.hp<=0)return;
      const base=Math.max(0,Math.floor(amount));
      const mult=fx.ignoreMitigation?1:Math.max(0,1+.1*(this.kw(target,'VULNERABLE')-this.kw(target,'PROTECTION')));
      const damage=Math.max(0,Math.floor(base*mult+1e-9));
      const blocked=fx.ignoreShield?0:Math.min(damage,this.kw(target,'SHIELD'));
      if(blocked){target.keywords.SHIELD.potency-=blocked;if(target.keywords.SHIELD.potency<=0)delete target.keywords.SHIELD;}
      const hpDamage=damage-blocked;
      target.hp=Math.max(0,target.hp-hpDamage);
      this.note(`${source.name}의 추가 효과 → ${target.name}: 피해 ${damage}, 방어막 -${blocked}, 체력 -${hpDamage}`);
      this.emit('EFFECT_DAMAGE',{ownerId:source.id,targetId:target.id,damage,blocked,hpDamage});
      if(hpDamage>0)this.emit('HP_DAMAGED',{targetId:target.id,amount:hpDamage,source:'EFFECT'});
      if(target.hp===0)this.note(`✦ ${target.name} 전투 불능`);
    }
    executeEffectAction(fx,owner,target,extra: any={}) {
      const destinations=this.resolveEffectTargets(fx.target,owner,target,extra);
      for(const dst of destinations) {
        if(!dst)continue;
        switch(fx.action){
          case 'APPLY_KEYWORD':
            this.apply(dst,fx.keyword,{potency:fx.potency,count:fx.count,sourceId:owner.id});break;
          case 'MODIFY_KEYWORD':
            this.modifyKeyword(dst,fx.keyword,{potency:fx.potency,count:fx.count});break;
          case 'REMOVE_KEYWORD':
            delete dst.keywords[fx.keyword];
            if(fx.keyword==='EVADE')dst.evadeSource=null;
            this.note(`${dst.name}: ${K[fx.keyword]||fx.keyword} 제거`);break;
          case 'RESTORE_MANA': {
            if(dst.id==='boss'||dst.hp<=0)break;
            const restored=this.restoreMana(dst,fx.value??0);
            this.note(`${dst.name}: 마력 +${restored} (${dst.mana}/${dst.maxMana})`);
            this.emit('MANA_RESTORED',{ownerId:owner.id,targetId:dst.id,amount:restored});
            break;
          }
          case 'HEAL': {
            if(dst.hp<=0)break;
            const healed=Math.min(Math.max(0,Math.floor(fx.value??0)),dst.maxHp-dst.hp);
            dst.hp+=healed;
            this.note(`${dst.name}: 체력 +${healed}`);
            this.emit('HEALED',{ownerId:owner.id,targetId:dst.id,amount:healed});
            break;
          }
          case 'DRAW_CARDS': {
            if(dst.id==='boss'||dst.hp<=0)break;
            const count=Math.max(0,Math.min(20,Math.floor(fx.value??1)));
            const before=dst.hand.length;
            this.draw(dst,count);
            this.note(`${dst.name}: 카드 ${dst.hand.length-before}장 드로우`);
            this.emit('CARDS_DRAWN',{ownerId:owner.id,targetId:dst.id,count:dst.hand.length-before});
            break;
          }
          case 'DISCARD_CARDS': {
            if(dst.id!=='boss'){
              if(fx.selection==='CHOOSE'&&!fx.cardUids?.length){
                const available=dst.hand.filter(c=>!dst.slots?.some(s=>s.cardUid===c.uid));
                if(available.length)this.pendingDiscards.push({ownerId:dst.id,remaining:Math.min(available.length,Math.max(0,Math.floor(fx.value??1)))});
              }else this.discardCards(dst,fx.value??1,fx.selection??'RANDOM',fx.cardUids??[]);
            }
            break;
          }
          case 'CREATE_CARD':{
            if(dst.id!=='boss'&&fx.card)this.createCard(dst,fx.card,{destination:fx.destination,recycleGenerated:fx.recycleGenerated});
            break;
          }
          case 'EXHAUST_CARD':{
            if(dst.id==='boss')break;
            const index=dst.hand.findIndex(c=>c.uid===(fx.cardUid??extra.cardUid));
            if(index>=0)(dst.exhaust??=[]).push(...dst.hand.splice(index,1));
            break;
          }
          case 'TRANSFORM_CARD':{
            if(dst.id==='boss'||!fx.card)break;
            const existing=dst.hand.find(c=>c.uid===(fx.cardUid??extra.cardUid));
            if(existing){const oldUid=existing.uid;Object.assign(existing,copy(fx.card),{uid:oldUid});}
            break;
          }
          case 'MODIFY_CARD_POWER':case 'MODIFY_CARD_COST':{
            if(dst.id==='boss')break;
            const existing=dst.hand.find(c=>c.uid===(fx.cardUid??extra.cardUid));
            if(existing){if(fx.action==='MODIFY_CARD_POWER')existing.power=Math.max(0,existing.power+(fx.value??0));
              else existing.costModifier=(existing.costModifier??0)+(fx.value??0);}
            break;
          }
          case 'SPEND_MANA': {
            if(dst.id!=='boss'&&dst.mana>=Math.max(0,fx.value??0))dst.mana-=Math.max(0,fx.value??0);
            break;
          }
          case 'DEAL_DAMAGE':
            this.dealEffectDamage(owner,dst,fx.value??0,fx);break;
          default:
            this.emit('INVALID_EFFECT_ACTION',{cardId:extra.cardId??null,action:fx.action});
            this.note(`알 수 없는 효과 명령: ${fx.action}`);
        }
      }
    }
    runEffects(c,trigger,owner,target,extra: any={}) {
      if(!c?.effects)return;
      const effects=c.effects.map((fx,index)=>({fx,index}))
        .filter(({fx})=>fx.trigger===trigger && (!extra.passiveOnly || fx.scope==='OWNED') && (extra.passiveOnly || fx.scope!=='OWNED'))
        .sort((a,b)=>(b.fx.priority??0)-(a.fx.priority??0)||a.index-b.index);
      if(!effects.length)return;
      if(this.effectDepth>=16 || this.effectBudget>=500){
        this.emit('EFFECT_LIMIT',{trigger,cardId:c.id});
        this.note('연쇄 효과 실행 제한에 도달해 추가 발동을 중단했습니다.');
        return;
      }
      this.effectDepth++;
      try {
        for(const {fx} of effects){
          if(this.effectBudget>=500){this.emit('EFFECT_LIMIT',{trigger,cardId:c.id});break;}
          if(!this.effectConditionsMet(fx.conditions,owner,target,extra))continue;
          this.effectBudget++;
          this.emit('EFFECT_TRIGGERED',{trigger,cardId:c.id,ownerId:owner.id});
          const actions=fx.actions??[fx];
          for(const action of actions){
            this.executeEffectAction({...fx,...action},owner,target,{...extra,cardId:c.id});
          }
        }
      } finally {this.effectDepth--;}
    }
    activate(c,owner,target){
      this.note(`${owner.name}: [${c.name}] 사용`);
      this.emit('CARD_USED',{ownerId:owner.id,cardId:c.id,targetId:target?.id??null});
      this.runEffects(c,'ON_USE',owner,target);
      this.passive(owner,'ON_USE',target);
      const power=this.finalPower(owner,c);
      if(c.type==='GUARD')this.apply(owner,'SHIELD',{potency:power});
      if(c.type==='EVADE'){
        const prev=this.kw(owner,'EVADE');
        this.apply(owner,'EVADE',{potency:power});
        if(power>=prev)owner.evadeSource={card:c,ownerId:owner.id};
      }
      if(['GUARD','EVADE','COUNTER','SPECIAL'].includes(c.type))this.triggerUseStatuses(owner);
      if(c.type==='COUNTER'){
        owner.counter={card:c,remaining:1,powerAtActivation:power};
        this.note(`${owner.name}: 반격 대기 (턴당 1회)`);
      }
      return power;
    }
    consumePowerStatuses(unit:Combatant,c:CardDefinition):void {
      if(c.type==='SPECIAL')return;
      if(this.kw(unit,'PARALYSIS')>0)this.modifyKeyword(unit,'PARALYSIS',{potency:-1});
      for(const id of ['FOCUS','DISTRACTION'])delete unit.keywords[id];
    }
    evade(owner,incomingPower){
      if(!this.kw(owner,'EVADE'))return false;
      const ownPower=this.kw(owner,'EVADE');
      const source=owner.evadeSource?.card;
      if(ownPower>=incomingPower){
        this.note(`${owner.name}: 회피 성공 (${ownPower} ≥ ${incomingPower})`);
        this.emit('EVADE_SUCCESS',{ownerId:owner.id,incomingPower});
        this.runEffects(source,'ON_EVADE_SUCCESS',owner,owner);
        this.passive(owner,'ON_EVADE_SUCCESS',owner);
        return true;
      }
      this.note(`${owner.name}: 회피 실패 (${ownPower} < ${incomingPower}) → 회피 소멸`);
      this.emit('EVADE_FAIL',{ownerId:owner.id,incomingPower});
      delete owner.keywords.EVADE;owner.evadeSource=null;
      this.runEffects(source,'ON_EVADE_FAIL',owner,owner);
      this.passive(owner,'ON_EVADE_FAIL',owner);
      return false;
    }
    triggerUseStatuses(unit:Combatant):boolean {
      if(unit.hp<=0)return false;
      const bleeding=this.kw(unit,'BLEED');
      if(bleeding){this.dealEffectDamage(unit,unit,bleeding,{ignoreMitigation:true});this.modifyKeyword(unit,'BLEED',{count:-1});}
      this.growPoison(unit);
      return unit.hp>0;
    }
    growPoison(unit:Combatant):void {
      const instance=unit.keywords.POISON;
      if(!instance||instance.count===null||instance.count<=0)return;
      const sum=instance.potency+instance.count;
      const chance=Math.min(50,sum)/100;
      if(this.rng()<chance){
        const growth=Math.min(5,Math.floor(sum/10)+1);
        instance.potency=boundedKeyword(instance.potency+growth);
        instance.count=boundedKeyword(instance.count+growth);
        this.emit('POISON_GREW',{ownerId:unit.id,growth});
      }
    }
    splitPower(power:number,hits:number):number[]{
      const n=clamp(Math.trunc(hits),1,20),p=Math.max(0,Math.floor(power));
      const base=Math.floor(p/n),rem=p%n;
      return Array.from({length:n},(_,i)=>base+(i>=n-rem?1:0));
    }
    // Per-hit bleeding is resolved immediately before the hit, but that hit
    // still executes even if bleeding kills its attacker. Later hits stop.
    dealAttackSequence(attacker:Combatant,target:Combatant,c:CardDefinition,options:any={}):void {
      if(attacker.hp<=0||target.hp<=0)return;
      const hits=c.type==='MULTI_ATTACK'?(c.hitCount??1):1;
      this.runEffects(c,'ON_ATTACK',attacker,target,{attacker});
      this.runEffects(c,'BEFORE_ATTACK',attacker,target,{attacker});
      const distributed=this.splitPower(options.forcedPower??this.finalPower(attacker,c),hits);
      for(let i=0;i<distributed.length;i++){
        if(attacker.hp<=0||target.hp<=0)break;
        if(!options.isCounter)this.triggerUseStatuses(attacker);
        // The attacker may die to bleeding; this hit must still resolve.
        this.performHit(attacker,target,c,{...options,hitIndex:i,hitCount:hits,hitPower:distributed[i],allowDeadAttacker:true});
      }
      this.runEffects(c,'ON_ATTACK_END',attacker,target,{attacker});
    }
    reactionCards(unit) {
      const sources=[unit.evadeSource?.card,unit.counter?.card].filter(Boolean);
      return sources.filter((card,i)=>sources.findIndex(c=>c.id===card.id)===i);
    }
    dealAttack(attacker,target,c,options: {isCounter?:boolean;forcedPower?:number}={}) {
      this.dealAttackSequence(attacker,target,c,options);
    }
    performHit(attacker,target,c,options: {isCounter?:boolean;hitIndex?:number;hitCount?:number;hitPower?:number;allowDeadAttacker?:boolean;forcedPower?:number}={}) {
      if((attacker.hp<=0&&!options.allowDeadAttacker)||target.hp<=0)return;
      // ON_USE and clash effects have already fired. Recalculate live power
      // immediately before the damage step, per the agreed combat rule.
      // A multi-attack's distributed total is computed once after clash.
      const power=options.hitPower??this.finalPower(attacker,c);
      this.emit('HIT_START',{attackerId:attacker.id,targetId:target.id,cardId:c.id,hitIndex:options.hitIndex??0});
      this.runEffects(c,'ON_HIT_START',attacker,target,{attacker,hitIndex:options.hitIndex??0});
      this.emit('ATTACK_INCOMING',{attackerId:attacker.id,targetId:target.id,cardId:c.id,power});
      // The target is about to be attacked; pre-hit reactions may change state.
      for(const reaction of this.reactionCards(target))this.runEffects(reaction,'ON_ATTACKED',target,attacker,{attacker});
      if(this.evade(target,power)){
        this.note(`${attacker.name}의 [${c.name}] 공격 무효화`);
        this.emit('ATTACK_EVADED',{attackerId:attacker.id,targetId:target.id,cardId:c.id});
        return;
      }
      if(this.kw(target,'BLESSING')>0){
        this.modifyKeyword(target,'BLESSING',{potency:-1});
        this.note(`${target.name}: 가호로 ${options.hitIndex??0}번째 타격 완전 무효`);
        this.emit('HIT_NEGATED',{targetId:target.id,cardId:c.id,hitIndex:options.hitIndex??0});return;
      }
      this.runEffects(c,'BEFORE_DAMAGE',attacker,target,{attacker});
      // Re-evaluate after BEFORE_DAMAGE effects so they can influence power.
      const damagePower=options.hitCount===1&&!options.isCounter?this.finalPower(attacker,c):(options.hitPower??this.finalPower(attacker,c));
      const outgoing=Math.max(0,1+0.1*(this.kw(attacker,'DAMAGE_UP')-this.kw(attacker,'DAMAGE_DOWN')));
      let critical=false;
      const breath=this.kw(attacker,'BREATH');
      if(breath>0 && c.type!=='GUARD'&&c.type!=='EVADE' && this.rng()<Math.min(1,breath*0.05)){
        critical=true;this.modifyKeyword(attacker,'BREATH',{count:-1});
      }
      const multiplier=Math.max(0,1+0.1*(this.kw(target,'VULNERABLE')-this.kw(target,'PROTECTION')));
      const damage=Math.max(0,Math.floor(damagePower*outgoing*(critical?1.2:1)*multiplier+1e-9));
      const shield=this.kw(target,'SHIELD');
      const blocked=Math.min(damage,shield);
      if(blocked){target.keywords.SHIELD.potency-=blocked;if(target.keywords.SHIELD.potency<=0)delete target.keywords.SHIELD;}
      const hpDamage=damage-blocked;
      target.hp=Math.max(0,target.hp-hpDamage);
      this.note(`${attacker.name} → ${target.name}: [${c.name}] 위력 ${damagePower}, 배율 ${multiplier.toFixed(2)}, 방어막 -${blocked}, 체력 -${hpDamage}`);
      this.emit('HIT',{attackerId:attacker.id,targetId:target.id,cardId:c.id,hitIndex:options.hitIndex??0,damage,blocked,hpDamage,critical});
      if(this.kw(target,'RUPTURE')>0){
        const n=this.kw(target,'RUPTURE');
        this.dealEffectDamage(attacker,target,n,{ignoreMitigation:true});
        this.modifyKeyword(target,'RUPTURE',{count:-1});
      }
      if(hpDamage>0 && attacker.hp>0 && this.kw(attacker,'LIFESTEAL')>0){
        const healed=Math.min(attacker.maxHp-attacker.hp,Math.floor(hpDamage*this.kw(attacker,'LIFESTEAL')/10));
        if(healed>0){attacker.hp+=healed;this.emit('LIFESTEAL_HEALED',{ownerId:attacker.id,amount:healed});}
      }
      // ON_HIT occurs AFTER the current hit's damage. Newly applied
      // vulnerability affects only subsequent damage instances.
      const extra={attacker,hpDamage,blocked,damage};
      this.runEffects(c,'ON_HIT',attacker,target,extra);
      this.passive(attacker,'ON_HIT',target,extra);
      for(const reaction of this.reactionCards(target))this.runEffects(reaction,'ON_HIT_TAKEN',target,attacker,extra);
      if(hpDamage>0){
        this.emit('HP_DAMAGED',{targetId:target.id,amount:hpDamage});
        for(const reaction of this.reactionCards(target))this.runEffects(reaction,'ON_DAMAGED',target,attacker,extra);
      }
      this.runEffects(c,'AFTER_DAMAGE',attacker,target,extra);
      if(target.hp<=0)this.runEffects(c,'ON_KILL',attacker,target,extra);
      if(target.hp<=0)this.note(`✦ ${target.name} 전투 불능`);
      // A hit that deals 0 HP damage through a shield still triggers counter.
      if(!options.isCounter&&target.hp>0&&attacker.hp>0&&target.counter?.remaining>0){
        const counter=target.counter;
        counter.remaining=0;
        this.note(`${target.name}: 반격 발동 → ${attacker.name}`);
        this.emit('COUNTER_TRIGGERED',{ownerId:target.id,attackerId:attacker.id});
        this.dealAttack(target,attacker,counter.card,{isCounter:true,forcedPower:counter.powerAtActivation});
      }
    }
    finishConsumed(slot:any) {
      const hero=this.getUnit(slot.ownerId),c=slot._executingCard;
      if(!hero||!c)return;
      const idx=hero.hand.findIndex(x=>x.uid===c.uid);
      if(idx>=0){hero.hand.splice(idx,1);this.moveUsedCard(hero,c);}
      delete slot._executingCard;
    }
    resolveLinked(allySlot,intent){
      const hero=this.getUnit(allySlot.ownerId),c=this.cardForSlot(allySlot),boss=this.boss;
      if(!hero||!c||hero.hp<=0)return this.resolveBoss(intent);
      if(boss.hp<=0)return;
      this.note(`▸ SPD ${Math.max(allySlot.speed,intent.speed)}: ${hero.name} [${c.name}] ↔ 보스 [${intent.card.name}] 연결`);
      // The linked action runs at higher speed, even when ally slot itself is slower.
      this.activate(c,hero,boss);
      this.activate(intent.card,boss,hero);
      if(c.type==='ATTACK'||c.type==='MULTI_ATTACK'){
        const ap=this.finalPower(hero,c),bp=this.finalPower(boss,intent.card);
        this.runEffects(c,'ON_CLASH_START',hero,boss);
        this.runEffects(intent.card,'ON_CLASH_START',boss,hero);
        // After clash-start effects, recompute for clash.
        const a=this.finalPower(hero,c),b=this.finalPower(boss,intent.card);
        this.note(`⚔ 합 판정 ${hero.name} ${a} : ${b} 보스`);
        this.emit('CLASH',{allyId:hero.id,allyPower:a,bossPower:b,allyCardId:c.id,bossCardId:intent.card.id,result:a>b?'WIN':a<b?'LOSE':'DRAW'});
        if(a>b){
          this.note('합 승리! 보스의 공격 취소');
          this.runEffects(c,'ON_CLASH_WIN',hero,boss);
          this.passive(hero,'ON_CLASH_WIN',boss);
          this.runEffects(intent.card,'ON_CLASH_LOSE',boss,hero);
          this.dealAttack(hero,boss,c);
        }else if(a<b){
          this.note('합 패배! 아군의 공격 취소');
          this.runEffects(c,'ON_CLASH_LOSE',hero,boss);
          this.passive(hero,'ON_CLASH_LOSE',boss);
          this.runEffects(intent.card,'ON_CLASH_WIN',boss,hero);
          this.dealAttack(boss,hero,intent.card);
        }else{
          this.note('합 무승부! 양쪽 공격 모두 취소');
          this.runEffects(c,'ON_CLASH_DRAW',hero,boss);
          this.passive(hero,'ON_CLASH_DRAW',boss);
          this.runEffects(intent.card,'ON_CLASH_DRAW',boss,hero);
        }
      } else {
        // Guard/Evade/Counter are activated immediately at clash time.
        this.dealAttack(boss,hero,intent.card);
      }
      this.consumePowerStatuses(hero,c);
    }
    resolveAlly(slot){
      const owner=this.getUnit(slot.ownerId),c=this.cardForSlot(slot);
      if(!owner||owner.hp<=0||!c||this.boss.hp<=0)return;
      this.note(`▸ SPD ${slot.speed}: ${owner.name}의 독립 행동`);
      this.activate(c,owner,this.boss);
      if(c.type==='ATTACK'||c.type==='MULTI_ATTACK')this.dealAttack(owner,this.boss,c);
      this.consumePowerStatuses(owner,c);
    }
    resolveBoss(intent){
      const boss=this.boss;if(boss.hp<=0)return;
      const target=this.getUnit(intent.targetId),c=intent.card;
      this.note(`▸ SPD ${intent.speed}: 보스 [${c.name}]`);
      this.activate(c,boss,target);
      if(c.type==='ATTACK'||c.type==='MULTI_ATTACK'){
        if(target?.hp>0)this.dealAttack(boss,target,c);
        else this.note('공격 대상이 전투 불능이므로 공격 실패');
      }
      this.consumePowerStatuses(boss,c);
    }
    resolveTurn(){
      if(this.status!=='PLANNING'||this.pendingDiscards.length)return;
      this.status='RESOLVING';
      const assigned=this.allies.flatMap(u=>u.slots).filter(s=>s.cardUid);
      const matched=new Map(assigned.filter(s=>s.targetIntentId).map(s=>[s.targetIntentId,s]));
      const events: any[]=[];
      for(const intent of this.boss.intents){
        const pair=matched.get(intent.id);
        events.push({kind:pair?'LINKED':'BOSS',speed:Math.max(intent.speed,pair?.speed??0),intent,pair,tie:this.rng()});
      }
      for(const slot of assigned)if(!slot.targetIntentId)events.push({kind:'ALLY',speed:slot.speed,slot,tie:this.rng()});
      events.sort((a,b)=>b.speed-a.speed||a.tie-b.tie);
      for(const event of events){
        if(this.boss.hp<=0||!this.allies.some(a=>a.hp>0))break;
        if(event.kind==='LINKED'){
          if(this.consumeAction(event.pair)){this.resolveLinked(event.pair,event.intent);this.finishConsumed(event.pair);}
          else this.resolveBoss(event.intent);
        }
        if(event.kind==='BOSS')this.resolveBoss(event.intent);
        if(event.kind==='ALLY'){
          if(this.consumeAction(event.slot)){this.resolveAlly(event.slot);this.finishConsumed(event.slot);}
        }
      }
      for(const unit of this.allies){
        // Unused cards stay in hand; only cards actually used move to discard.
        unit.lastTurnUsed=unit.usedThisTurn;
        unit.slots=[];
      }
      this.endTurn();
      if(this.boss.hp<=0){this.status='WON';this.note(`🏆 레이드 성공! ${this.boss.name} 격파`);}
      else if(!this.allies.some(a=>a.hp>0)){this.status='LOST';this.note('☠ 레이드 실패! 모든 아군이 쓰러졌습니다.');}
      else this.status='REVIEW';
    }
    tickStartKeywords():void {
      for(const u of [...this.allies,this.boss])if(u.hp>0){
        for(const [id,mode] of [['CORROSION','DAMAGE'],['REGEN','HEAL']] as const){
          const n=this.kw(u,id);if(!n)continue;
          const amount=Math.floor(u.maxHp*n/100);
          if(mode==='DAMAGE'){u.hp=Math.max(0,u.hp-amount);this.emit('CORROSION_DAMAGE',{targetId:u.id,hpDamage:amount});}
          else u.hp=Math.min(u.maxHp,u.hp+amount);
          this.modifyKeyword(u,id,{potency:-1});
        }
      }
    }
    tickEndKeywords():void {
      for(const u of [...this.allies,this.boss])if(u.hp>0){
        const burn=this.kw(u,'BURN'),poison=this.kw(u,'POISON');
        if(burn)this.dealEffectDamage(u,u,burn,{ignoreMitigation:true});
        if(poison)this.dealEffectDamage(u,u,poison,{ignoreMitigation:true,ignoreShield:true});
      }
    }
    endTurn(){
      this.note('──── 턴 종료: 키워드 정리 ────');
      this.emit('TURN_END',{turn:this.turn});
      this.tickEndKeywords();
      this.runLifecycleEffects('ON_TURN_END');
      for(const unit of [...this.allies,this.boss])this.passive(unit,'ON_TURN_END');
      for(const unit of [...this.allies,this.boss]){
        for(const [id,k] of Object.entries(unit.keywords)){
          if(NO_DECAY.has(id)||['CORROSION','REGEN','PARALYSIS'].includes(id))continue;
          if(id==='MANA_BACKFLOW'){
            k.potency=Math.max(0,k.potency-1);
            if(!k.potency)delete unit.keywords[id];
            continue;
          }
          if(k.count===null || k.count===undefined){delete unit.keywords[id];continue;}
          k.count--;
          if(k.count<=0)delete unit.keywords[id];
        }
        unit.counter=null;unit.evadeSource=null;
      }
      // After all end-of-turn effects and keyword cleanup, randomly discard excess hand cards.
      for(const unit of this.allies)this.discardHandOverflow(unit);
    }
    nextTurn(){if(this.status==='REVIEW'&&!this.pendingDiscards.length)this.startTurn();}
  }
  // Lightweight data validation before adding authored cards to fixed decks.
  const CARD_TYPES=new Set(Object.keys(T));
  const TRIGGERS=new Set(['ON_BATTLE_START','ON_TURN_START','ON_TURN_END','ON_USE','ON_CLASH_START','ON_CLASH_WIN','ON_CLASH_LOSE','ON_CLASH_DRAW','BEFORE_ATTACK','BEFORE_DAMAGE','ON_HIT','AFTER_DAMAGE','ON_ATTACKED','ON_HIT_TAKEN','ON_DAMAGED','ON_EVADE_SUCCESS','ON_EVADE_FAIL','ON_KILL','ON_ATTACK','ON_ATTACK_END','ON_HIT_START']);
  const ACTIONS=new Set(['APPLY_KEYWORD','MODIFY_KEYWORD','REMOVE_KEYWORD','HEAL','DRAW_CARDS','DEAL_DAMAGE','RESTORE_MANA','SPEND_MANA','DISCARD_CARDS','CREATE_CARD','EXHAUST_CARD','TRANSFORM_CARD','MODIFY_CARD_POWER','MODIFY_CARD_COST']);
  const TARGETS=new Set(['SELF','TARGET','ATTACKER','ALL_ALLIES','ALL_ENEMIES']);
  function validateCard(c){
    const errors=[];
    if(!c||typeof c!=='object')return ['카드 데이터가 객체가 아닙니다.'];
    if(typeof c.id!=='string'||!c.id)errors.push('id가 필요합니다.');
    if(!CARD_TYPES.has(c.type))errors.push(`알 수 없는 타입: ${c.type}`);
    if(!Number.isFinite(c.power)||c.power<0)errors.push('power는 0 이상의 유한 숫자여야 합니다.');
    if(c.manaCost!==undefined && (!Number.isInteger(c.manaCost)||c.manaCost<0))errors.push('manaCost는 0 이상의 정수여야 합니다.');
    if(c.type==='MULTI_ATTACK'&&(!Number.isInteger(c.hitCount)||c.hitCount<2||c.hitCount>20))errors.push('연속 공격은 hitCount 2~20 필요');
    if(c.specialTarget!==undefined && !['SELF','ALLY','ENEMY','ANY'].includes(c.specialTarget))errors.push('specialTarget 값이 올바르지 않습니다.');
    if(!Array.isArray(c.effects))errors.push('effects는 배열이어야 합니다.');
    else c.effects.forEach((e,i)=>{
      if(!TRIGGERS.has(e.trigger))errors.push(`effects[${i}] 잘못된 trigger: ${e.trigger}`);
      if(e.scope!==undefined && e.scope!=='OWNED')errors.push(`effects[${i}] 잘못된 scope`);
      if(e.priority!==undefined && !Number.isFinite(e.priority))errors.push(`effects[${i}] 잘못된 priority`);
      const acts=Array.isArray(e.actions)?e.actions:[e];
      if(!acts.length)errors.push(`effects[${i}] 비어 있는 actions`);
      acts.forEach((a,j)=>{
        if(!ACTIONS.has(a.action))errors.push(`effects[${i}].actions[${j}] 알 수 없는 action: ${a.action}`);
        const target=a.target??e.target??'SELF';
        if(!TARGETS.has(target))errors.push(`effects[${i}].actions[${j}] 알 수 없는 target: ${target}`);
        if(['APPLY_KEYWORD','MODIFY_KEYWORD','REMOVE_KEYWORD'].includes(a.action)&&typeof (a.keyword??e.keyword)!=='string')errors.push(`effects[${i}].actions[${j}] keyword 필요`);
        if(['DEAL_DAMAGE','HEAL','DRAW_CARDS','RESTORE_MANA','DISCARD_CARDS','SPEND_MANA'].includes(a.action)&&(!Number.isFinite(a.value??e.value)||(a.value??e.value)<0))errors.push(`effects[${i}].actions[${j}] value는 0 이상의 숫자여야 함`);
      });
    });
    return errors;
  }
  const api={RaidBattle,HEROES,PASSIVES,BOSS_MOVES,K,T,passiveList,validateCard,boundedKeyword,sortSlotsBySpeed};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.RaidEngine=api;
})(typeof window!=='undefined'?window:globalThis);
