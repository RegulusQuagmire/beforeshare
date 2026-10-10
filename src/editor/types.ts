export type Point = { x: number; y: number }
export type Rect = { x: number; y: number; width: number; height: number }
export type Tool = 'redact' | 'arrow' | 'number' | 'crop' | 'texture'
export type Annotation =
  | { id: string; kind: 'redact'; rect: Rect; color?: string }
  | TextureAnnotation
  | { id: string; kind: 'arrow'; from: Point; to: Point }
  | { id: string; kind: 'number'; at: Point; value: number }
export type TextureAnnotation = { id: string; kind: 'texture'; rect: Rect; assetId: string }
export type EditorDocument = { crop: Rect; annotations: Annotation[] }
export type LoadedImage = { bitmap: ImageBitmap; width: number; height: number }
export type HistoryState = { past: EditorDocument[]; present: EditorDocument; future: EditorDocument[] }
