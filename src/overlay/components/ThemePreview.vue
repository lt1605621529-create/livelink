<script setup lang="ts">
import { computed } from 'vue'
import type { DanmuBoardConfig } from '../../shared/danmu-display'
import DanmuBoard from './DanmuBoard.vue'
import ViewerEnterBanner from './ViewerEnterBanner.vue'
import LotteryCard from './LotteryCard.vue'
import VotingCard from './VotingCard.vue'
import SuperChatBanner from './SuperChatBanner.vue'

const props = defineProps<{ board: DanmuBoardConfig }>()
const sampleBoard = computed(() => ({ ...props.board, maxLines: 4, width: Math.min(props.board.width, 360) }))
const sampleDeadline = Date.now() + 3600_000
</script>

<template>
  <main class="theme-preview">
    <header>
      <p>OBS 主题预览 · 示例内容</p>
      <ViewerEnterBanner text="欢迎 糖糖 进入直播间" />
    </header>
    <div class="samples">
      <DanmuBoard :config="sampleBoard" preview-full />
      <LotteryCard prize="直播间纪念礼物" keyword="参与" :winner-count="3" :participant-count="12" :ends-at="sampleDeadline" />
      <VotingCard title="下一场玩什么？" :options="[{ key: 'A', label: '赛马' }, { key: 'B', label: '点歌' }]"
        :counts="{ A: 8, B: 4 }" :total-votes="12" :ends-at="sampleDeadline" />
      <SuperChatBanner uname="糖糖" message="今天的直播真开心！" :price="30" />
    </div>
  </main>
</template>

<style scoped>
.theme-preview { height: 100%; overflow: auto; padding: 16px; background: #141720; color: #f8fafc; }
.theme-preview header { display: grid; justify-items: start; gap: 8px; margin-bottom: 16px; }
.theme-preview :deep(.enter-banner) { animation: none; }
.samples { display: flex; flex-wrap: wrap; align-items: start; gap: 16px; }
.samples > * { max-width: 100%; }
.samples :deep(.lottery-card), .samples :deep(.voting-card), .samples :deep(.sc-card) { max-width: min(360px, calc(100vw - 32px)); }
</style>
