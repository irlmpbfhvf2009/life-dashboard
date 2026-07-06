import type { EventData } from '../types'

// 第一版 10 種地圖事件（最終版 30+）。danger=1 受平衡規則管制（balance.EVENT_RULES）。
export const EVENTS: EventData[] = [
  { id: 'coin_rain', name: '金幣雨', description: '這一波金幣掉落 +60%', danger: 0, weight: 10, minWave: 3, mods: { coinMult: 1.6 } },
  { id: 'stampede', name: '怪物暴走', description: '怪物移速 +25%，但獎勵 +40%', danger: 1, weight: 8, minWave: 5, mods: { enemySpeedMult: 1.25, rewardMult: 1.4 } },
  { id: 'poison_edge', name: '毒霧擴散', description: '地圖邊緣被毒霧吞噬，靠近會持續扣血', danger: 1, weight: 8, minWave: 6, hook: 'edgePoison' },
  { id: 'chest_fever', name: '寶箱狂熱', description: '本波額外生成 2 個寶箱', danger: 0, weight: 7, minWave: 4, mods: { chestBonus: 2 } },
  { id: 'darkness', name: '黑暗降臨', description: '視野大幅縮小，小心腳下', danger: 1, weight: 7, minWave: 7, hook: 'darkness' },
  { id: 'thunderstorm', name: '雷雨天', description: '隨機落雷轟炸戰場（有紅圈預警）', danger: 1, weight: 7, minWave: 7, hook: 'lightning' },
  { id: 'lava_floor', name: '火山地板', description: '地面隨機噴發岩漿（踩到會燙）', danger: 1, weight: 7, minWave: 8, hook: 'fireFloor' },
  { id: 'sale', name: '商店特價', description: '下一輪商店全品項 7 折', danger: 0, weight: 8, minWave: 3, mods: { shopDiscount: 0.3 } },
  { id: 'elite_invasion', name: '菁英入侵', description: '菁英怪出現率大增，獎勵也更好', danger: 1, weight: 6, minWave: 8, mods: { eliteChanceMult: 3, rewardMult: 1.3 } },
  { id: 'spring', name: '補血泉', description: '地圖中央湧出治療泉水', danger: 0, weight: 8, minWave: 4, hook: 'healFountain' },
  { id: 'blessing', name: '豐收祝福', description: '本波經驗與金幣雙豐收（+40%）', danger: 0, weight: 7, minWave: 3, mods: { coinMult: 1.4, rewardMult: 1.4 } },
  { id: 'frenzy_night', name: '狂亂之夜', description: '怪物又快又多，但金幣與掉落大增', danger: 1, weight: 5, minWave: 9, mods: { enemySpeedMult: 1.2, coinMult: 1.6, dropMult: 1.5 } },
  { id: 'meteor_shower', name: '流星雨', description: '天降流星轟炸戰場（有紅圈預警）', danger: 1, weight: 6, minWave: 8, hook: 'lightning' },
]

export const EVENT_MAP = new Map(EVENTS.map(e => [e.id, e]))
