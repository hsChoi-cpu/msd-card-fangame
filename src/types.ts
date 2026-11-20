/** Shared combat domain declarations for the TypeScript engine. */
type CardType = 'ATTACK'|'GUARD'|'EVADE'|'COUNTER'|'SPECIAL'|'MULTI_ATTACK';
type KeywordId = 'ATTACK_UP'|'ATTACK_DOWN'|'DEFENSE_UP'|'DEFENSE_DOWN'|'POWER_UP'|'POWER_DOWN'|'HASTE'|'BIND'|'PROTECTION'|'VULNERABLE'|'EVADE'|'SHIELD' | (string & {});
type BattleStatus = 'PLANNING'|'RESOLVING'|'REVIEW'|'WON'|'LOST';
type EffectTrigger = 'ON_BATTLE_START'|'ON_TURN_START'|'ON_TURN_END'|'ON_USE'|'ON_CLASH_START'|'ON_CLASH_WIN'|'ON_CLASH_LOSE'|'ON_CLASH_DRAW'|'BEFORE_ATTACK'|'BEFORE_DAMAGE'|'ON_HIT'|'AFTER_DAMAGE'|'ON_ATTACKED'|'ON_HIT_TAKEN'|'ON_DAMAGED'|'ON_EVADE_SUCCESS'|'ON_EVADE_FAIL'|'ON_KILL'|'ON_ATTACK'|'ON_ATTACK_END'|'ON_HIT_START';
type EffectCommand = 'APPLY_KEYWORD'|'MODIFY_KEYWORD'|'REMOVE_KEYWORD'|'HEAL'|'DRAW_CARDS'|'DEAL_DAMAGE'|'RESTORE_MANA'|'SPEND_MANA'|'DISCARD_CARDS'|'CREATE_CARD'|'EXHAUST_CARD'|'TRANSFORM_CARD'|'MODIFY_CARD_POWER'|'MODIFY_CARD_COST';
type EffectTarget = 'SELF'|'TARGET'|'ATTACKER'|'ALL_ALLIES'|'ALL_ENEMIES';
interface KeywordInstance {potency:number;count:number|null;sourceId?:string}
interface KeywordApplication {potency?:number;count?:number;sourceId?:string}
interface PendingKeyword extends KeywordInstance {id:KeywordId}
interface EffectAction {action:EffectCommand;target?:EffectTarget;keyword?:KeywordId;potency?:number;count?:number;value?:number;selection?:'RANDOM'|'CHOOSE';cardUids?:string[];cardUid?:string;card?:CardDefinition;destination?:'HAND'|'DECK'|'DISCARD';recycleGenerated?:boolean;ignoreMitigation?:boolean;ignoreShield?:boolean}
interface CardEffect extends Partial<EffectAction> {trigger:EffectTrigger;scope?:'OWNED';priority?:number;conditions?:Array<Record<string,any>>;actions?:EffectAction[]}
interface CardDefinition {id:string;name:string;type:CardType;power:number;manaCost?:number;description?:string;effects:CardEffect[];uid?:string;image?:string|null;hitCount?:number;generated?:boolean;recycleGenerated?:boolean;costModifier?:number;specialTarget?:'SELF'|'ALLY'|'ENEMY'|'ANY'}
interface HeroTemplate {id:string;name:string;role:string;symbol:string;maxHp:number;speed:number[];color:string;deck:CardDefinition[]}
interface BattleEvent {type:string;turn:number;order:number;[key:string]:any}
// UI and battle logic share the following run-time shape; further refinement is safe as rules stabilize.
interface Combatant {id:string;name:string;hp:number;maxHp:number;speed:number[];keywords:Record<string,KeywordInstance>;pending:PendingKeyword[];counter:any;evadeSource:any;deck?:CardDefinition[];hand?:CardDefinition[];discard?:CardDefinition[];exhaust?:CardDefinition[];slots?:any[];intents?:any[];role?:string;symbol?:string;color?:string;maxMana?:number;mana?:number;manaRegen?:number;usedThisTurn?:number;lastTurnUsed?:number;passive?:CardDefinition;[key:string]:any}
