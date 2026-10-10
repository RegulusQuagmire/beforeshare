import { readFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadImage, validateDimensions } from '../../src/upload/loadImage'

const fixture = (name: string) => new File([readFileSync(new URL(`../fixtures/${name}`, import.meta.url))], name)
const bitmap = (width = 320, height = 180) => ({ width, height, close: vi.fn() })
afterEach(() => vi.unstubAllGlobals())

describe('dimensions (inclusive limits, without huge fixtures)', () => {
  it.each([[6000, 1], [1, 6000], [5000, 4000], [4000, 5000]])('accepts %i × %i', (w, h) => {
    expect(() => validateDimensions(w, h)).not.toThrow()
  })
  it.each([[6001, 1], [1, 6001], [5000, 4001], [0, 100], [NaN, 100], [1.5, 1]])('rejects %i × %i', (w, h) => {
    expect(() => validateDimensions(w, h)).toThrow()
  })
})

describe('file validation and resource ownership (decoder mocked, not decoding proof)', () => {
  it.each(['ordinary.png', 'transparent.png', 'ordinary.jpg', 'orientation-6.jpg', 'ordinary.webp'])('accepts the signature of %s, regardless of MIME or extension', async name => {
    const decoded = bitmap()
    const decode = vi.fn().mockResolvedValue(decoded)
    vi.stubGlobal('createImageBitmap', decode)
    const data = await fixture(name).arrayBuffer()
    const loaded = await loadImage(new File([data], 'misleading.txt', { type: 'text/plain' }))
    expect(loaded.bitmap).toBe(decoded)
    expect(decoded.close).not.toHaveBeenCalled()
    expect(decode).toHaveBeenCalledWith(expect.any(Blob), { imageOrientation: 'from-image' })
  })
  it('accepts exactly 20 MiB', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap()))
    const data = new Uint8Array(20 * 1024 * 1024)
    data.set(new Uint8Array(await fixture('ordinary.png').arrayBuffer()))
    await expect(loadImage(new File([data], 'boundary.png'))).resolves.toMatchObject({ width: 320 })
  })
  it('rejects 20 MiB + 1 before reading or decoding', async () => {
    const file = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.png')
    const read = vi.spyOn(file, 'arrayBuffer')
    const decode = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)
    await expect(loadImage(file)).rejects.toThrow('20 MiB')
    expect(read).not.toHaveBeenCalled()
    expect(decode).not.toHaveBeenCalled()
  })
  it('rejects APNG before decoding', async () => {
    const decode = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)
    await expect(loadImage(fixture('animated.png'))).rejects.toThrow('Анимация')
    expect(decode).not.toHaveBeenCalled()
  })
  it.each([[], [71, 73, 70, 56, 57, 97], [60, 115, 118, 103, 62]].map(bytes => ({ bytes })))('rejects foreign/empty bytes even with PNG MIME ($bytes)', async ({ bytes }) => {
    await expect(loadImage(new File([new Uint8Array(bytes)], 'fake.png', { type: 'image/png' }))).rejects.toThrow('PNG, JPEG или WebP')
  })
  it('reports read failure', async () => {
    const file = fixture('ordinary.png')
    vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new Error('read failed'))
    await expect(loadImage(file)).rejects.toThrow('прочитать')
  })
  it('reports decoding failure without leaking implementation details', async () => {
    const decode = vi.fn().mockRejectedValue(new Error('decoder internals'))
    vi.stubGlobal('createImageBitmap', decode)
    await expect(loadImage(fixture('ordinary.png'))).rejects.toThrow('Повреждённое')
    expect(decode).toHaveBeenCalledOnce()
  })
  it('closes decoded bitmap when dimensions exceed limits', async () => {
    const decoded = bitmap(6001, 100)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(decoded))
    await expect(loadImage(fixture('ordinary.jpg'))).rejects.toThrow('6000')
    expect(decoded.close).toHaveBeenCalledOnce()
  })
  it('rejects a truncated PNG structure before decoding', async () => {
    const data = await fixture('ordinary.png').arrayBuffer()
    await expect(loadImage(new File([data.slice(0, 26)], 'truncated.png'))).rejects.toThrow('Повреждённое')
  })
})

describe('PNG structural integrity with a permissive browser decoder',()=>{
  it('rejects broken compressed data before a lenient decoder can replace current work',async()=>{
    const decode=vi.fn().mockResolvedValue(bitmap())
    vi.stubGlobal('createImageBitmap',decode)
    await expect(loadImage(fixture('corrupt.png'))).rejects.toThrow('Повреждённое')
    expect(decode).not.toHaveBeenCalled()
  })
  it('rejects altered IDAT bytes even when the browser would return a bitmap',async()=>{
    const bytes=new Uint8Array(await fixture('ordinary.png').arrayBuffer())
    const view=new DataView(bytes.buffer)
    for(let offset=8;offset+12<=bytes.length;) {
      const length=view.getUint32(offset)
      if(String.fromCharCode(...bytes.subarray(offset+4,offset+8))==='IDAT') {bytes[offset+8+length-1]^=1;break}
      offset+=length+12
    }
    vi.stubGlobal('createImageBitmap',vi.fn().mockResolvedValue(bitmap()))
    await expect(loadImage(new File([bytes],'damaged-checksum.png'))).rejects.toThrow('Повреждённое')
  })
})

function pngChunk(type:string,data:Uint8Array):Buffer {
  const content=Buffer.concat([Buffer.from(type),data]);let crc=0xffffffff
  for(const byte of content){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
  const header=Buffer.alloc(4),tail=Buffer.alloc(4);header.writeUInt32BE(data.length);tail.writeUInt32BE((crc^0xffffffff)>>>0)
  return Buffer.concat([header,content,tail])
}
it('accepts a valid PNG with split IDAT and unused trailing IDAT bytes',async()=>{
  const header=Buffer.alloc(13);header.writeUInt32BE(1);header.writeUInt32BE(1,4);header[8]=8;header[9]=6
  const compressed=deflateSync(Buffer.from([0,255,0,0,255]))
  const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',compressed.subarray(0,1)),pngChunk('IDAT',Buffer.concat([compressed.subarray(1),Buffer.from([0,0,0])])),pngChunk('IEND',Buffer.alloc(0))])
  vi.stubGlobal('createImageBitmap',vi.fn().mockResolvedValue(bitmap(1,1)))
  await expect(loadImage(new File([bytes],'trailing-idat.png'))).resolves.toMatchObject({width:1,height:1})
})

describe('reject oversized compressed raster headers before allocating a bitmap',()=>{
  it.each([[12000,12000],[5000,4001]])('rejects PNG %i × %i before native decoding',async(width,height)=>{
    const source=new Uint8Array(await fixture('ordinary.png').arrayBuffer())
    const ihdr=source.slice(16,29),view=new DataView(ihdr.buffer)
    view.setUint32(0,width);view.setUint32(4,height)
    const bytes=Buffer.concat([source.slice(0,8),pngChunk('IHDR',ihdr),source.slice(33)])
    const decode=vi.fn().mockResolvedValue(bitmap(width,height));vi.stubGlobal('createImageBitmap',decode)
    await expect(loadImage(new File([bytes],'oversized.png'))).rejects.toThrow(/6000|20 Мп/)
    expect(decode).not.toHaveBeenCalled()
  })
  it.each([[12000,12000],[5000,4001]])('rejects JPEG SOF %i × %i before native decoding',async(width,height)=>{
    const header=Buffer.from([0xff,0xd8,0xff,0xe0,0,2,0xff,0xc2,0,11,8,0,0,0,0,1,1,0x11,0,0xff,0xd9])
    header.writeUInt16BE(height,11);header.writeUInt16BE(width,13)
    const decode=vi.fn().mockResolvedValue(bitmap(width,height));vi.stubGlobal('createImageBitmap',decode)
    await expect(loadImage(new File([header],'oversized.jpg'))).rejects.toThrow(/6000|20 Мп/)
    expect(decode).not.toHaveBeenCalled()
  })
  it('rejects deferred JPEG height before passing unknown raster size to native decoder',async()=>{
    const header=Buffer.from([0xff,0xd8,0xff,0xc0,0,11,8,0,0,1,0,1,1,0x11,0,0xff,0xd9])
    const decode=vi.fn().mockResolvedValue(bitmap());vi.stubGlobal('createImageBitmap',decode)
    await expect(loadImage(new File([header],'deferred.jpg'))).rejects.toThrow('отложенной высотой')
    expect(decode).not.toHaveBeenCalled()
  })
})
