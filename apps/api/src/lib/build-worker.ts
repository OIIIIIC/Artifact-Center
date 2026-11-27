import { processBuildQueue } from './build-workflow.js'
import { processBuildPublications } from './build-publication.js'

/** 数据库保存任务与租约；服务重启后自动恢复。构建同步和文件导入互不阻塞。 */
export function startBuildWorker() {
  let syncing = false,
    importing = false
  const tick = () => {
    if (!syncing) {
      syncing = true
      void processBuildQueue()
        .catch(() => console.warn('[build-worker] sync unavailable'))
        .finally(() => {
          syncing = false
        })
    }
    if (!importing) {
      importing = true
      void processBuildPublications()
        .catch(() => console.warn('[build-worker] publication unavailable'))
        .finally(() => {
          importing = false
        })
    }
  }
  tick()
  const timer = setInterval(tick, 5000)
  timer.unref()
  return () => clearInterval(timer)
}
