import type { HistoryState } from './types'
export const TEXTURE_MEMORY_LIMIT=128*1024*1024
export function collectTextures(assets:Map<string,ImageBitmap>,history:HistoryState|null,previewId?:string) {
  const keep=new Set<string>(previewId?[previewId]:[])
  if(history) for(const doc of [...history.past,history.present,...history.future])
    for(const item of doc.annotations) if(item.kind==='texture') keep.add(item.assetId)
  for(const [id,bitmap] of assets) if(!keep.has(id)) {bitmap.close();assets.delete(id)}
}
export function clearTextures(assets:Map<string,ImageBitmap>) {
  for(const bitmap of assets.values()) bitmap.close()
  assets.clear()
}
