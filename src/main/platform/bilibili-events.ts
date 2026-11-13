import type { MsgHandler, User } from 'blive-message-listener'
import type { StandardEvent, UserInfo } from './adapter'

function toUserInfo(u: User, currentRoomId: number | null): UserInfo {
  const badge = u.badge
  // is_same_room 由 lib 自己算好（badge.anchor.is_same_room 可能 undefined 在老版本里），
  // 兜底比对 anchor.room_id === currentRoomId
  const isAnchor =
    badge?.anchor?.is_same_room ??
    (currentRoomId != null && badge?.anchor?.room_id === currentRoomId) ??
    false
  return {
    uid: String(u.uid),
    uname: u.uname,
    avatar: u.face,
    isAdmin: u.identity?.room_admin ?? false,
    guardLevel: u.identity?.guard_level ?? 0,
    fansMedal: badge
      ? {
          level: badge.level ?? 0,
          name: badge.name ?? '',
          isAnchor: Boolean(isAnchor),
          isLighted: badge.active ?? false
        }
      : undefined
  }
}

export function createBilibiliRuleHandlers(roomId: number, emit: (event: StandardEvent) => void): MsgHandler {
  return {
      onIncomeDanmu: (msg) => {
        emit({
          kind: 'danmu.received',
          platform: 'bilibili',
          timestamp: msg.timestamp,
          user: toUserInfo(msg.body.user, roomId),
          payload: { content: msg.body.content }
        })
      },

      onUserAction: (msg) => {
        // blive-message-listener 把进房 / 关注 / 分享 / 点赞合到一个 hook
        const action = msg.body.action
        if (action === 'enter') {
          emit({
            kind: 'viewer.enter',
            platform: 'bilibili',
            timestamp: msg.body.timestamp ?? msg.timestamp,
            user: toUserInfo(msg.body.user, roomId),
            payload: {}
          })
        } else if (action === 'follow') {
          emit({
            kind: 'follow.received',
            platform: 'bilibili',
            timestamp: msg.body.timestamp ?? msg.timestamp,
            user: toUserInfo(msg.body.user, roomId),
            payload: {}
          })
        }
        // share / like / unknown 不映射，留 P1+ 扩展
      },

      onGift: (msg) => {
        emit({
          kind: 'gift.received',
          platform: 'bilibili',
          timestamp: msg.timestamp,
          user: toUserInfo(msg.body.user, roomId),
          payload: {
            giftId: msg.body.gift_id,
            giftName: msg.body.gift_name,
            num: msg.body.amount,
            price: msg.body.price / 1000, // lib 给的 price 是 *1000
            coinType: msg.body.coin_type
          }
        })
      },

      onGuardBuy: (msg) => {
        emit({
          kind: 'guard.bought',
          platform: 'bilibili',
          timestamp: msg.timestamp,
          user: toUserInfo(msg.body.user, roomId),
          payload: {
            guardLevel: msg.body.guard_level,
            price: msg.body.price,
            giftName: msg.body.gift_name
          }
        })
      },

      onIncomeSuperChat: (msg) => {
        emit({
          kind: 'super.chat',
          platform: 'bilibili',
          timestamp: msg.timestamp,
          user: toUserInfo(msg.body.user, roomId),
          payload: {
            message: msg.body.content,
            price: msg.body.price,
            durationSec: msg.body.time
          }
        })
      },

  }
}

export function mapBlindBoxEvent(data: unknown, roomId: number): StandardEvent | null {
    if (!data || typeof data !== 'object') return null
    const d = data as Record<string, unknown>
    const blind = d['blind_gift']
    if (!blind || typeof blind !== 'object') return null
    const b = blind as Record<string, unknown>

    const blindBoxId = num(b['original_gift_id']) ?? num(b['blind_gift_id']) ?? 0
    const blindBoxName = str(b['original_gift_name']) ?? '盲盒'
    const costRaw = num(b['original_gift_price']) ?? num(b['price']) ?? 0
    const rewardGiftId = num(d['gift_id']) ?? 0
    const rewardGiftName = str(d['gift_name']) ?? '未知礼物'
    const rewardPriceRaw = num(d['price']) ?? 0
    const rewardNum = num(d['num']) ?? num(d['amount']) ?? 1

    // 价格 B 站统一 ×1000，除以 1000 还原成 RMB
    const costPerBox = costRaw / 1000
    const rewardPricePerItem = rewardPriceRaw / 1000
    const netGainPerBox = rewardPricePerItem * rewardNum - costPerBox

    // user 来自 SEND_GIFT.data 顶层字段，没有完整 badge 信息但 uid/uname 总是有
    const uid = String(num(d['uid']) ?? 0)
    const uname = str(d['uname']) ?? '观众'
    const face = str(d['face']) ?? undefined
    // medal_info 是 B 站协议里 SEND_GIFT 携带的礼物粉丝牌信息，用它构造 fansMedal
    const medalInfo = d['medal_info']
    const medal =
      medalInfo && typeof medalInfo === 'object' ? (medalInfo as Record<string, unknown>) : null
    const medalLevel = medal ? (num(medal['medal_level']) ?? 0) : 0
    const medalName = medal ? (str(medal['medal_name']) ?? '') : ''
    const medalAnchorRoom = medal ? (num(medal['anchor_roomid']) ?? 0) : 0
    const medalLighted = medal ? Boolean(num(medal['is_lighted'])) : false

    return {
      kind: 'blindbox.opened',
      platform: 'bilibili',
      timestamp: num(d['timestamp']) ? num(d['timestamp'])! * 1000 : Date.now(),
      user: {
        uid,
        uname,
        avatar: face,
        guardLevel: num(d['guard_level']) ?? 0,
        fansMedal: medal
          ? {
              level: medalLevel,
              name: medalName,
              isAnchor: medalAnchorRoom > 0 && medalAnchorRoom === roomId,
              isLighted: medalLighted
            }
          : undefined
      },
      payload: {
        blindBoxId,
        blindBoxName,
        costPerBox,
        rewardGiftId,
        rewardGiftName,
        rewardPricePerItem,
        rewardNum,
        netGainPerBox
      }
    }
  }

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return undefined
}
function str(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  return undefined
}
