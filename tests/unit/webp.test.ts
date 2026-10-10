import { afterEach, expect, it, vi } from 'vitest'
import { loadImage } from '../../src/upload/loadImage'
afterEach(()=>vi.unstubAllGlobals())
function webp(kind:string,payload:number[]) {
  const chunk=Buffer.alloc(8+payload.length+(payload.length%2));chunk.write(kind);chunk.writeUInt32LE(payload.length,4);chunk.set(payload,8)
  const header=Buffer.alloc(12);header.write('RIFF');header.writeUInt32LE(chunk.length+4,4);header.write('WEBP',8)
  return Buffer.concat([header,chunk])
}
it.each([
  ['VP8L',[0x2f,0x3f,0xc0,0x0f,0]], // 64 x 64
  ['VP8 ',[0,0,0,0x9d,1,0x2a,64,0,64,0]],
])('accepts %s by content despite wrong filename/MIME',async(kind,payload)=>{
  vi.stubGlobal('createImageBitmap',vi.fn().mockResolvedValue({width:64,height:64,close:vi.fn()}))
  await expect(loadImage(new File([webp(kind,payload as number[])],'wrong.txt',{type:'text/plain'}))).resolves.toMatchObject({width:64,height:64})
})
it.each([
  webp('VP8L',[0x2f,0xff,0xff,0xff,0x0f]),
  webp('VP8 ',[0,0,0,0x9d,1,0x2a,0xff,0x3f,0xff,0x3f]),
])('rejects oversized compressed dimensions before decoding',async bytes=>{
  const decode=vi.fn();vi.stubGlobal('createImageBitmap',decode)
  await expect(loadImage(new File([bytes],'oversized.webp'))).rejects.toThrow(/6000|20 Мп/)
  expect(decode).not.toHaveBeenCalled()
})
it('rejects animation before decoding',async()=>{
  vi.stubGlobal('createImageBitmap',vi.fn())
  await expect(loadImage(new File([webp('VP8X',[2,0,0,0,63,0,0,63,0,0])],'animation.webp'))).rejects.toThrow('Анимация')
})
it.each([webp('VP8L',[0x2f]),webp('VP8 ',[0,0,0,1,2,3,64,0,64,0]),webp('JUNK',[1,2]),webp('VP8L',[0x2f,0,0,0,0]).subarray(0,15)])('rejects damaged WebP containers',async bytes=>{
  vi.stubGlobal('createImageBitmap',vi.fn())
  await expect(loadImage(new File([bytes],'bad.webp'))).rejects.toThrow('Повреждённое')
})
it('rejects native decoding failures for valid containers',async()=>{
  vi.stubGlobal('createImageBitmap',vi.fn().mockRejectedValue(new Error('bad payload')))
  await expect(loadImage(new File([webp('VP8L',[0x2f,0x3f,0xc0,0x0f,0])],'bad.webp'))).rejects.toThrow('Повреждённое')
})
