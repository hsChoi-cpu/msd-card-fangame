/* Raid Card Prototype - standalone deterministic-ish turn battle engine.
   No dependencies. CommonJS export for tests and browser global for UI. */
(function (root) {
  'use strict';
  const K = {
    ATTACK_UP:'공격력 증가', ATTACK_DOWN:'공격력 감소', DEFENSE_UP:'방어력 증가', DEFENSE_DOWN:'방어력 감소',
    POWER_UP:'위력 증가', POWER_DOWN:'위력 감소', HASTE:'신속', BIND:'속박',
    PROTECTION:'보호', VULNERABLE:'취약', EVADE:'회피', SHIELD:'방어막'
  };
  const T = { ATTACK:'공격', GUARD:'방어', EVADE:'회피', COUNTER:'반격', SPECIAL:'특수' };
  const eff = (trigger, keyword, potency, count, target='SELF') => ({trigger,action:'APPLY_KEYWORD',keyword,potency,count,target});
  const card = (id,name,type,power,description='',effects=[]) => ({id,name,type,power,description,effects});
  const HEROES = [
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
      card('r4','급소 절단','ATTACK',16,'강력한 공격'),
      card('r5','허점 찌르기','ATTACK',9,'적중 시 취약 3',[eff('ON_HIT','VULNERABLE',3,undefined,'TARGET')]),
      card('r6','교란','ATTACK',10,'적중 시 대상에게 속박 2 예약',[eff('ON_HIT','BIND',2,undefined,'TARGET')]),
      card('r7','반격 자세','COUNTER',13,'피격 시 반격'),
      card('r8','집중 검무','ATTACK',12,'사용 시 공격력 증가 2',[eff('ON_USE','ATTACK_UP',2)])
    ]},
    {id:'mage',name:'비전술사',role:'약화 · 공격',symbol:'🔮',maxHp:82,speed:[3,7],color:'#e7a46e',deck:[
      card('m1','비전 화살','ATTACK',14,'기본 마법 공격'),
      card('m2','마력 집중','ATTACK',9,'사용 시 위력 증가 3',[eff('ON_USE','POWER_UP',3)]),
      card('m3','봉인술','ATTACK',10,'적중 시 적 공격력 감소 3 · 횟수 2',[eff('ON_HIT','ATTACK_DOWN',3,2,'TARGET')]),
      card('m4','마력 파장','ATTACK',13,'합 승리 시 대상에게 취약 2 · 횟수 2',[eff('ON_CLASH_WIN','VULNERABLE',2,2,'TARGET')]),
      card('m5','비전 장벽','GUARD',13,'사용 시 자신에게 방어막 부여'),
      card('m6','예지','EVADE',12,'발동 시 회피 부여'),
      card('m7','역류 반격','COUNTER',16,'피격 시 마법 반격'),
      card('m8','쇠약의 파동','ATTACK',11,'적중 시 대상에게 위력 감소 2',[eff('ON_HIT','POWER_DOWN',2,undefined,'TARGET')])
    ]}
  ];
  const BOSS_MOVES = [
    card('b1','심연의 참격','ATTACK',15,'단일 공격'),
    card('b2','파쇄 일격','ATTACK',19,'강한 단일 공격'),
    card('b3','침식의 발톱','ATTACK',12,'적중 시 취약 1 · 횟수 2',[eff('ON_HIT','VULNERABLE',1,2,'TARGET')]),
    card('b4','압도적인 일격','ATTACK',23,'강력한 단일 공격'),
    card('b5','심연의 가호','GUARD',12,'방어막을 생성하고 보호 1 획득',[eff('ON_USE','PROTECTION',1)]),
    card('b6','파멸의 일격','ATTACK',26,'2페이즈 강공격')
  ];
  const copy = x => JSON.parse(JSON.stringify(x));
  const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
  class RaidBattle {
    constructor(rng=Math.random) { this.rng=rng; this.reset(); }
    randint(min,max) { return Math.floor(this.rng()*(max-min+1))+min; }
    shuffle(arr) { for(let i=arr.length-1;i>0;i--){let j=this.randint(0,i);[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
    reset() {
      this.turn=0;this.serial=0;this.log=[];this.events=[];this.status='PLANNING';this.phase=1;
      this.allies=HEROES.map(h=>({id:h.id,name:h.name,role:h.role,symbol:h.symbol,color:h.color,hp:h.maxHp,maxHp:h.maxHp,speed:[...h.speed],keywords:{},pending:[],counter:null,evadeSource:null,deck:this.shuffle(h.deck.map((c,i)=>({...copy(c),uid:`${h.id}-${i}`}))),hand:[],discard:[],slots:[]}));
      this.boss={id:'boss',name:'심연의 군주',symbol:'👁️',hp:260,maxHp:260,speed:[3,8],keywords:{},pending:[],counter:null,evadeSource:null,intents:[]};
      this.note('전투 시작! 각 캐릭터의 고정 덱으로 보스에 대응하세요.');
      for(const unit of this.allies){for(const c of [...unit.deck])this.runEffects(c,'ON_BATTLE_START',unit,unit,{silent:true});}
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
    apply(unit,id,application={}) {
      if(!unit||unit.hp<=0)return;
      if(id==='HASTE'||id==='BIND'){
        const current=unit.pending.find(p=>p.id===id);
        if(current){current.potency+=application.potency??0;current.count+=application.count??0;}
        else unit.pending.push({id,potency:application.potency??1,count:application.count??1});
        this.note(`${unit.name}: ${K[id]} ${application.potency??(current?0:1)} 예약 (다음 턴)`);
        return;
      }
      if(id==='EVADE'){
        const p=application.potency??1;
        const old=this.kw(unit,'EVADE');
        if(p>old)unit.keywords.EVADE={potency:p,count:null};
        this.note(`${unit.name}: 회피 ${this.kw(unit,'EVADE')} 활성화 (높은 값 유지)`);
        return;
      }
      if(id==='SHIELD'){
        const p=application.potency??0;
        unit.keywords.SHIELD={potency:this.kw(unit,'SHIELD')+p,count:null};
        this.note(`${unit.name}: 방어막 +${p} (총 ${this.kw(unit,'SHIELD')})`);
        return;
      }
      const old=unit.keywords[id];
      if(old){old.potency+=application.potency??0; old.count+=application.count??0;}
      else unit.keywords[id]={potency:application.potency??1,count:application.count??1};
      this.note(`${unit.name}: ${K[id]||id} [위력 ${unit.keywords[id].potency} / 횟수 ${unit.keywords[id].count}]`);
    }
    activatePending(unit){
      const pending=unit.pending;unit.pending=[];
      for(const k of pending){
        const old=unit.keywords[k.id];
        if(old){old.potency+=k.potency;old.count+=k.count;}
        else unit.keywords[k.id]={potency:k.potency,count:k.count};
        this.note(`${unit.name}: 예약된 ${K[k.id]} ${k.potency} 활성화`);
      }
    }
    speedFor(unit){return Math.max(1,this.randint(...unit.speed)+this.kw(unit,'HASTE')-this.kw(unit,'BIND'));}
    draw(unit,n){
      for(let i=0;i<n;i++){
        if(!unit.deck.length){if(!unit.discard.length)break;unit.deck=this.shuffle(unit.discard.splice(0));}
        unit.hand.push(unit.deck.pop());
      }
    }
    startTurn(){
      if(this.status==='WON'||this.status==='LOST')return;
      this.turn++;this.status='PLANNING';this.phase=this.boss.hp<=130?2:1;
      this.note(`──── ${this.turn}턴 시작 / 보스 ${this.phase}페이즈 ────`);
      this.emit('TURN_START',{turn:this.turn});
      for(const u of [...this.allies,this.boss])this.activatePending(u);
      for(const unit of this.allies){
        unit.slots=unit.hp>0?Array.from({length:2},(_,i)=>({id:`${unit.id}-t${this.turn}-s${i}`,ownerId:unit.id,speed:this.speedFor(unit),cardUid:null,targetIntentId:null})):[];
        if(unit.hp>0)this.draw(unit,4);
      }
      const phase=this.phase;
      this.boss.intents=Array.from({length:phase===1?3:4},(_,i)=>{
        let pool=phase===1?[0,0,1,2,2,4]:[0,1,1,2,3,3,4,5];
        const m=copy(BOSS_MOVES[pool[this.randint(0,pool.length-1)]]);
        const living=this.allies.filter(a=>a.hp>0);
        const target=m.type==='GUARD'?'boss':living[this.randint(0,living.length-1)].id;
        return {id:`boss-t${this.turn}-s${i}`,ownerId:'boss',speed:this.speedFor(this.boss),card:m,targetId:target};
      });
    }
    cardForSlot(slot){let hero=this.getUnit(slot.ownerId);return hero?.hand.find(c=>c.uid===slot.cardUid)||null;}
    assignCard(slotId,cardUid){
      if(this.status!=='PLANNING')return {ok:false,reason:'현재는 행동 배치 단계가 아닙니다.'};
      const hero=this.allies.find(u=>u.slots.some(s=>s.id===slotId));
      if(!hero||hero.hp<=0)return {ok:false,reason:'선택할 수 없는 슬롯입니다.'};
      const c=hero.hand.find(x=>x.uid===cardUid);
      if(!c)return {ok:false,reason:'해당 카드가 손패에 없습니다.'};
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
      const intent=this.boss.intents.find(x=>x.id===intentId);
      if(!intent||intent.card.type!=='ATTACK')return {ok:false,reason:'공격 행동 슬롯만 직접 대응할 수 있습니다.'};
      const existing=this.allies.flatMap(u=>u.slots).find(s=>s.id!==slotId&&s.targetIntentId===intentId&&s.cardUid);
      if(existing)return {ok:false,reason:'이 보스 행동에는 이미 다른 아군이 대응하고 있습니다.'};
      if(intent.targetId!==slot.ownerId&&slot.speed<=intent.speed){return {ok:false,reason:'가로채기 실패: 아군 슬롯 속도가 보스 속도보다 높아야 합니다.'};}
      slot.targetIntentId=intentId;
      return {ok:true};
    }
    unlink(slotId){const slot=this.allies.flatMap(u=>u.slots).find(s=>s.id===slotId);if(slot)slot.targetIntentId=null;}
    finalPower(unit,c){
      const typeBonus=c.type==='ATTACK'?this.kw(unit,'ATTACK_UP')-this.kw(unit,'ATTACK_DOWN'):
        ['GUARD','EVADE','COUNTER'].includes(c.type)?this.kw(unit,'DEFENSE_UP')-this.kw(unit,'DEFENSE_DOWN'):0;
      return Math.max(0,c.power+typeBonus+this.kw(unit,'POWER_UP')-this.kw(unit,'POWER_DOWN'));
    }
    // Effects are declarative: event -> optional conditions -> ordered actions.
    // Priority: higher first; original order breaks ties, for deterministic replay.
    effectConditionsMet(conditions,owner,target,extra={}) {
      return (conditions||[]).every(condition=>{
        const unit=condition.target==='TARGET'?target:owner;
        if(!unit)return false;
        switch(condition.kind){
          case 'HAS_KEYWORD': return this.kw(unit,condition.keyword)>=(condition.min??1);
          case 'MISSING_KEYWORD': return this.kw(unit,condition.keyword)===0;
          case 'HP_AT_MOST_PERCENT': return unit.hp*100<=unit.maxHp*condition.value;
          case 'HP_AT_LEAST_PERCENT': return unit.hp*100>=unit.maxHp*condition.value;
          case 'DAMAGE_AT_LEAST': return (extra.hpDamage??0)>=condition.value;
          default: return false; // Unknown conditions must not silently pass.
        }
      });
    }
    modifyKeyword(unit,id,change={}) {
      const current=unit?.keywords[id];
      if(!current)return;
      if(change.potency!==undefined)current.potency=Math.max(0,current.potency+change.potency);
      if(change.count!==undefined && current.count!=null)current.count=Math.max(0,current.count+change.count);
      if(current.potency===0 || current.count===0){
        delete unit.keywords[id];
        if(id==='EVADE')unit.evadeSource=null;
      }
      this.note(`${unit.name}: ${K[id]||id} 변경 (위력 ${this.kw(unit,id)}, 횟수 ${unit.keywords[id]?.count??'없음'})`);
    }
    executeEffectAction(fx,owner,target,extra={}) {
      const dst=fx.target==='TARGET'?target:fx.target==='ATTACKER'?extra.attacker:owner;
      if(!dst)return;
      if(fx.action==='APPLY_KEYWORD')this.apply(dst,fx.keyword,{potency:fx.potency,count:fx.count});
      else if(fx.action==='MODIFY_KEYWORD')this.modifyKeyword(dst,fx.keyword,{potency:fx.potency,count:fx.count});
      else if(fx.action==='REMOVE_KEYWORD'){
        delete dst.keywords[fx.keyword];
        if(fx.keyword==='EVADE')dst.evadeSource=null;
        this.note(`${dst.name}: ${K[fx.keyword]||fx.keyword} 제거`);
      }else if(fx.action==='HEAL'){
        if(dst.hp<=0)return; // Healing cannot revive a defeated unit.
        const amount=Math.max(0,fx.value||0);
        const healed=Math.min(amount,dst.maxHp-dst.hp);
        dst.hp+=healed;
        this.note(`${dst.name}: 체력 +${healed}`);
      }
    }
    runEffects(c,trigger,owner,target,extra={}) {
      if(!c?.effects)return;
      const effects=c.effects.map((fx,index)=>({fx,index}))
        .filter(({fx})=>fx.trigger===trigger)
        .sort((a,b)=>(b.fx.priority??0)-(a.fx.priority??0)||a.index-b.index);
      for(const {fx} of effects){
        if(!this.effectConditionsMet(fx.conditions,owner,target,extra))continue;
        this.emit('EFFECT_TRIGGERED',{trigger,cardId:c.id,ownerId:owner.id});
        const actions=fx.actions??[fx];
        for(const action of actions){
          // Parent-level target is inherited by actions unless overridden.
          this.executeEffectAction({...fx,...action},owner,target,extra);
        }
      }
    }
    activate(c,owner,target){
      this.note(`${owner.name}: [${c.name}] 사용`);
      this.emit('CARD_USED',{ownerId:owner.id,cardId:c.id,targetId:target?.id??null});
      this.runEffects(c,'ON_USE',owner,target);
      const power=this.finalPower(owner,c);
      if(c.type==='GUARD')this.apply(owner,'SHIELD',{potency:power});
      if(c.type==='EVADE'){
        const prev=this.kw(owner,'EVADE');
        this.apply(owner,'EVADE',{potency:power});
        if(power>=prev)owner.evadeSource={card:c,ownerId:owner.id};
      }
      if(c.type==='COUNTER'){
        owner.counter={card:c,remaining:1};
        this.note(`${owner.name}: 반격 대기 (턴당 1회)`);
      }
      return power;
    }
    evade(owner,incomingPower){
      if(!this.kw(owner,'EVADE'))return false;
      const ownPower=this.kw(owner,'EVADE');
      const source=owner.evadeSource?.card;
      if(ownPower>=incomingPower){
        this.note(`${owner.name}: 회피 성공 (${ownPower} ≥ ${incomingPower})`);
        this.emit('EVADE_SUCCESS',{ownerId:owner.id,incomingPower});
        this.runEffects(source,'ON_EVADE_SUCCESS',owner,owner);
        return true;
      }
      this.note(`${owner.name}: 회피 실패 (${ownPower} < ${incomingPower}) → 회피 소멸`);
      this.emit('EVADE_FAIL',{ownerId:owner.id,incomingPower});
      delete owner.keywords.EVADE;owner.evadeSource=null;
      this.runEffects(source,'ON_EVADE_FAIL',owner,owner);
      return false;
    }
    reactionCards(unit) {
      const sources=[unit.evadeSource?.card,unit.counter?.card].filter(Boolean);
      return sources.filter((card,i)=>sources.findIndex(c=>c.id===card.id)===i);
    }
    dealAttack(attacker,target,c,options={}) {
      if(attacker.hp<=0||target.hp<=0)return;
      // ON_USE and clash effects have already fired. Recalculate live power
      // immediately before the damage step, per the agreed combat rule.
      this.runEffects(c,'BEFORE_ATTACK',attacker,target,{attacker});
      const power=this.finalPower(attacker,c);
      this.emit('ATTACK_INCOMING',{attackerId:attacker.id,targetId:target.id,cardId:c.id,power});
      // The target is about to be attacked; pre-hit reactions may change state.
      for(const reaction of this.reactionCards(target))this.runEffects(reaction,'ON_ATTACKED',target,attacker,{attacker});
      if(this.evade(target,power)){
        this.note(`${attacker.name}의 [${c.name}] 공격 무효화`);
        this.emit('ATTACK_EVADED',{attackerId:attacker.id,targetId:target.id,cardId:c.id});
        return;
      }
      this.runEffects(c,'BEFORE_DAMAGE',attacker,target,{attacker});
      // Re-evaluate after BEFORE_DAMAGE effects so they can influence power.
      const damagePower=this.finalPower(attacker,c);
      const multiplier=Math.max(0,1+0.1*(this.kw(target,'VULNERABLE')-this.kw(target,'PROTECTION')));
      const damage=Math.max(0,Math.floor(damagePower*multiplier+1e-9));
      const shield=this.kw(target,'SHIELD');
      const blocked=Math.min(damage,shield);
      if(blocked){target.keywords.SHIELD.potency-=blocked;if(target.keywords.SHIELD.potency<=0)delete target.keywords.SHIELD;}
      const hpDamage=damage-blocked;
      target.hp=Math.max(0,target.hp-hpDamage);
      this.note(`${attacker.name} → ${target.name}: [${c.name}] 위력 ${damagePower}, 배율 ${multiplier.toFixed(2)}, 방어막 -${blocked}, 체력 -${hpDamage}`);
      this.emit('HIT',{attackerId:attacker.id,targetId:target.id,cardId:c.id,damage,blocked,hpDamage});
      // ON_HIT occurs AFTER the current hit's damage. Newly applied
      // vulnerability affects only subsequent damage instances.
      const extra={attacker,hpDamage,blocked,damage};
      this.runEffects(c,'ON_HIT',attacker,target,extra);
      for(const reaction of this.reactionCards(target))this.runEffects(reaction,'ON_HIT_TAKEN',target,attacker,extra);
      if(hpDamage>0){
        this.emit('HP_DAMAGED',{targetId:target.id,amount:hpDamage});
        for(const reaction of this.reactionCards(target))this.runEffects(reaction,'ON_DAMAGED',target,attacker,extra);
      }
      this.runEffects(c,'AFTER_DAMAGE',attacker,target,extra);
      if(target.hp<=0)this.note(`✦ ${target.name} 전투 불능`);
      // A hit that deals 0 HP damage through a shield still triggers counter.
      if(!options.isCounter&&target.hp>0&&attacker.hp>0&&target.counter?.remaining>0){
        const counter=target.counter;
        counter.remaining=0;
        this.note(`${target.name}: 반격 발동 → ${attacker.name}`);
        this.emit('COUNTER_TRIGGERED',{ownerId:target.id,attackerId:attacker.id});
        this.dealAttack(target,attacker,counter.card,{isCounter:true});
      }
    }
    resolveLinked(allySlot,intent){
      const hero=this.getUnit(allySlot.ownerId),c=this.cardForSlot(allySlot),boss=this.boss;
      if(!hero||!c||hero.hp<=0)return this.resolveBoss(intent);
      if(boss.hp<=0)return;
      this.note(`▸ SPD ${Math.max(allySlot.speed,intent.speed)}: ${hero.name} [${c.name}] ↔ 보스 [${intent.card.name}] 연결`);
      // The linked action runs at higher speed, even when ally slot itself is slower.
      this.activate(c,hero,boss);
      this.activate(intent.card,boss,hero);
      if(c.type==='ATTACK'){
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
          this.runEffects(intent.card,'ON_CLASH_LOSE',boss,hero);
          this.dealAttack(hero,boss,c);
        }else if(a<b){
          this.note('합 패배! 아군의 공격 취소');
          this.runEffects(c,'ON_CLASH_LOSE',hero,boss);
          this.runEffects(intent.card,'ON_CLASH_WIN',boss,hero);
          this.dealAttack(boss,hero,intent.card);
        }else{
          this.note('합 무승부! 양쪽 공격 모두 취소');
          this.runEffects(c,'ON_CLASH_DRAW',hero,boss);
          this.runEffects(intent.card,'ON_CLASH_DRAW',boss,hero);
        }
      } else {
        // Guard/Evade/Counter are activated immediately at clash time.
        this.dealAttack(boss,hero,intent.card);
      }
    }
    resolveAlly(slot){
      const owner=this.getUnit(slot.ownerId),c=this.cardForSlot(slot);
      if(!owner||owner.hp<=0||!c||this.boss.hp<=0)return;
      this.note(`▸ SPD ${slot.speed}: ${owner.name}의 독립 행동`);
      this.activate(c,owner,this.boss);
      if(c.type==='ATTACK')this.dealAttack(owner,this.boss,c);
    }
    resolveBoss(intent){
      const boss=this.boss;if(boss.hp<=0)return;
      const target=this.getUnit(intent.targetId),c=intent.card;
      this.note(`▸ SPD ${intent.speed}: 보스 [${c.name}]`);
      this.activate(c,boss,target);
      if(c.type==='ATTACK'){
        if(target?.hp>0)this.dealAttack(boss,target,c);
        else this.note('공격 대상이 전투 불능이므로 공격 실패');
      }
    }
    resolveTurn(){
      if(this.status!=='PLANNING')return;
      this.status='RESOLVING';
      const assigned=this.allies.flatMap(u=>u.slots).filter(s=>s.cardUid);
      const matched=new Map(assigned.filter(s=>s.targetIntentId).map(s=>[s.targetIntentId,s]));
      const events=[];
      for(const intent of this.boss.intents){
        const pair=matched.get(intent.id);
        events.push({kind:pair?'LINKED':'BOSS',speed:Math.max(intent.speed,pair?.speed??0),intent,pair,tie:this.rng()});
      }
      for(const slot of assigned)if(!slot.targetIntentId)events.push({kind:'ALLY',speed:slot.speed,slot,tie:this.rng()});
      events.sort((a,b)=>b.speed-a.speed||a.tie-b.tie);
      for(const event of events){
        if(this.boss.hp<=0||!this.allies.some(a=>a.hp>0))break;
        if(event.kind==='LINKED')this.resolveLinked(event.pair,event.intent);
        if(event.kind==='BOSS')this.resolveBoss(event.intent);
        if(event.kind==='ALLY')this.resolveAlly(event.slot);
      }
      for(const unit of this.allies){
        // Used and unused cards are discarded after each turn, fixed deck unchanged.
        unit.discard.push(...unit.hand);unit.hand=[];
        unit.slots=[];
      }
      this.endTurn();
      if(this.boss.hp<=0){this.status='WON';this.note('🏆 레이드 성공! 심연의 군주를 격파했습니다.');}
      else if(!this.allies.some(a=>a.hp>0)){this.status='LOST';this.note('☠ 레이드 실패! 모든 아군이 쓰러졌습니다.');}
      else this.status='REVIEW';
    }
    endTurn(){
      this.note('──── 턴 종료: 키워드 정리 ────');
      this.emit('TURN_END',{turn:this.turn});
      for(const unit of [...this.allies,this.boss]){
        for(const [id,k] of Object.entries(unit.keywords)){
          if(k.count===null || k.count===undefined){delete unit.keywords[id];continue;}
          k.count--;
          if(k.count<=0)delete unit.keywords[id];
        }
        unit.counter=null;unit.evadeSource=null;
      }
    }
    nextTurn(){if(this.status==='REVIEW')this.startTurn();}
  }
  const api={RaidBattle,HEROES,K,T};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.RaidEngine=api;
})(typeof window!=='undefined'?window:globalThis);
