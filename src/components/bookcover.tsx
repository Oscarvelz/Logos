import { useEffect, useState } from 'react'
import { getBookCover, type BookMeta } from '../lib/books.ts'

const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }

/** The book's own cover, or a drawn one: deep colour, gold rule, serif title. */
export function BookCover({ meta, small = false }: { meta: Pick<BookMeta, 'id' | 'title' | 'author' | 'cover' | 'format'>; small?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    // The list's metas are cover-free since the M-11 cure (the Blob
    // lives only in the full record): a meta that still carries its
    // cover uses it at once; otherwise the cover is fetched for this
    // book alone, and a coverless book simply stays drawn.
    if (meta.cover) {
      const u = URL.createObjectURL(meta.cover)
      setUrl(u)
      return () => URL.revokeObjectURL(u)
    }
    if (!meta.id) { setUrl(null); return }
    let live = true
    let made: string | null = null
    void getBookCover(meta.id).then((b) => {
      if (!live || !b) return
      made = URL.createObjectURL(b)
      setUrl(made)
    })
    return () => { live = false; if (made) URL.revokeObjectURL(made) }
  }, [meta.cover, meta.id])
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
