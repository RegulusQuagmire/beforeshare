import type { LoadedImage } from '../editor/types'

const MAX_BYTES = 20 * 1024 * 1024
const crcTable=Uint32Array.from({length:256},(_,value)=>{
  for(let bit=0;bit<8;bit++) value=(value>>>1)^((value&1)?0xedb88320:0)
  return value>>>0
})

const damaged = () => new Error('Повреждённое изображение или ошибка декодирования. Выберите другой файл.')

export function validateDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw damaged()
  if (width > 6000 || height > 6000) throw new Error('Размер изображения превышает 6000 px по стороне.')
  if (width * height > 20_000_000) throw new Error('Размер изображения превышает 20 Мп.')
}

// Read dimensions before native decoding can allocate the full raster.
// EXIF rotation swaps the axes but preserves both side limits and pixel count.
function validateJpegHeader(bytes: Uint8Array): void {
  let offset = 2
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) throw damaged()
    while (offset < bytes.length && bytes[offset] === 0xff) offset++
    if (offset >= bytes.length) throw damaged()
    const marker = bytes[offset++]
    if (marker === 0xd9 || marker === 0xda) throw damaged()
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue
    if (offset + 2 > bytes.length) throw damaged()
    const length = (bytes[offset] << 8) | bytes[offset + 1]
    if (length < 2 || length > bytes.length - offset) throw damaged()
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (length < 8) throw damaged()
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4]
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6]
      if (height === 0) throw new Error('JPEG с отложенной высотой не поддерживается. Пересохраните его как обычный JPEG или PNG.')
      validateDimensions(width, height)
      return
    }
    offset += length
  }
  throw damaged()
}

// RIFF bounds and both extended canvas and compressed frame sizes are checked.
// Native decoding remains responsible for validating the compressed bitstream.
function validateWebp(data:ArrayBuffer):void {
  const bytes=new Uint8Array(data),view=new DataView(data)
  if(bytes.length<20||view.getUint32(4,true)+8!==bytes.length)throw damaged()
  const fourCC=(offset:number)=>String.fromCharCode(...bytes.subarray(offset,offset+4))
  const uint24=(offset:number)=>bytes[offset]+bytes[offset+1]*256+bytes[offset+2]*65536
  let offset=12,frame=false,extended=false,canvasWidth=0,canvasHeight=0
  while(offset+8<=bytes.length) {
    const kind=fourCC(offset),length=view.getUint32(offset+4,true),start=offset+8
    if(length>bytes.length-start||start+length+(length%2)>bytes.length)throw damaged()
    if(length%2&&bytes[start+length]!==0)throw damaged()
    if(kind==='ANIM'||kind==='ANMF')throw new Error('Анимация WebP не поддерживается. Выберите статичный WebP, PNG или JPEG.')
    if(kind==='VP8X') {
      if(length!==10||offset!==12||extended)throw damaged()
      if(bytes[start]&2)throw new Error('Анимация WebP не поддерживается. Выберите статичный WebP, PNG или JPEG.')
      if((bytes[start]&0xc1)||bytes[start+1]||bytes[start+2]||bytes[start+3])throw damaged()
      canvasWidth=uint24(start+4)+1;canvasHeight=uint24(start+7)+1
      validateDimensions(canvasWidth,canvasHeight);extended=true
    }
    if(kind==='VP8 '||kind==='VP8L') {
      if(frame)throw damaged()
      let width:number,height:number
      if(kind==='VP8L') {
        if(length<5||bytes[start]!==0x2f)throw damaged()
        const bits=view.getUint32(start+1,true)
        if(bits>>>29)throw damaged()
        width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1
      } else {
        if(length<10||(bytes[start]&1)||fourCC(start+3).slice(0,3)!=='\u009d\u0001\u002a')throw damaged()
        width=view.getUint16(start+6,true)&0x3fff;height=view.getUint16(start+8,true)&0x3fff
      }
      validateDimensions(width,height)
      if(extended&&(width!==canvasWidth||height!==canvasHeight))throw damaged()
      frame=true
    }
    offset=start+length+(length%2)
  }
  if(offset!==bytes.length||!frame)throw damaged()
}

function detectFormat(data: ArrayBuffer): 'image/png' | 'image/jpeg' | 'image/webp' {
  const bytes = new Uint8Array(data)
  if(String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP') {
    validateWebp(data);return 'image/webp'
  }
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) {
    const view = new DataView(data)
    let offset = 8
    let first = true
    const zlibHeader:number[]=[]
    let compressedBytes=0
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset)
      if (length > bytes.length - offset - 12) throw damaged()
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
      // Firefox may return a partial bitmap for corrupt data; verify PNG chunks
      // and the zlib header before allowing replacement of the current document.
      let crc=0xffffffff
      for(let i=offset+4;i<offset+8+length;i++) crc=(crc>>>8)^crcTable[(crc^bytes[i])&255]
      if(((crc^0xffffffff)>>>0)!==view.getUint32(offset+8+length)) throw damaged()
      if(type==='IDAT') {
        compressedBytes+=length
        for(let i=offset+8;i<offset+8+length && zlibHeader.length<2;i++) zlibHeader.push(bytes[i])
      }
      if (first) {
        if (type !== 'IHDR' || length !== 13) throw damaged()
        validateDimensions(view.getUint32(offset + 8), view.getUint32(offset + 12))
      }
      first = false
      if (type === 'acTL') throw new Error('Анимация не поддерживается. Выберите обычный PNG или JPEG.')
      if (type === 'IEND') {
        if (length !== 0 || compressedBytes<6 || zlibHeader.length<2) throw damaged()
        const [cmf,flg]=zlibHeader
        if((cmf&15)!==8 || (cmf>>>4)>7 || ((cmf<<8)|flg)%31!==0 || (flg&32)!==0) throw damaged()
        return 'image/png'
      }
      offset += length + 12
    }
    throw damaged()
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    validateJpegHeader(bytes)
    return 'image/jpeg'
  }
  throw new Error('Поддерживаются PNG или JPEG, а также WebP. Формат проверяется по содержимому файла.')
}

export async function loadImage(file: File): Promise<LoadedImage> {
  if (file.size > MAX_BYTES) throw new Error('Файл превышает 20 MiB. Выберите изображение поменьше.')
  let data: ArrayBuffer
  try { data = await file.arrayBuffer() } catch { throw new Error('Не удалось прочитать файл. Попробуйте выбрать его снова.') }
  const type = detectFormat(data)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(new Blob([data], { type }), { imageOrientation: 'from-image' })
  } catch { throw damaged() }
  try { validateDimensions(bitmap.width, bitmap.height) } catch (error) { bitmap.close(); throw error }
  return { bitmap, width: bitmap.width, height: bitmap.height }
}
