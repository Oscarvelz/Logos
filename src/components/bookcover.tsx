import { useEffect, useState } from 'react'
import type { BookMeta } from '../lib/books.ts'

const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }

/** The book's own cover, or a drawn one: deep colour, gold rule, serif title. */
export function BookCover({ meta, small = false }: { meta: Pick<BookMeta, 'title' | 'author' | 'cover' | 'format'>; small?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!meta.cover) { setUrl(null); return }
    const u = URL.createObjectURL(meta.cover)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [meta.cover])
  const h = hash(meta.title + meta.author)
  const hue = [212, 168, 338, 26, 262, 192, 8, 140][h % 8]
  const style = { '--c-h': hue } as React.CSSProperties
  return (
    <div className={`bcover ${small ? 'small' : ''} ${url ? 'img' : 'drawn'}`} style={style}>
      {url ? <img src={url} alt="" loading="lazy" decoding="async" /> : (
        <div className="bcover-art">
          <span className="bcover-rule" />
          <span className="bcover-title">{meta.title}</span>
          {meta.author && <span className="bcover-author">{meta.author}</span>}
          <span className="bcover-mark">λ</span>
        </div>
      )}
      <span className="bcover-spine" />
    </div>
  )
}
