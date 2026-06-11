import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mermaid from 'mermaid'
import { isValidElement, useEffect, useId, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'

mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict', suppressErrorRendering: true })

export const slug = (text: string): string =>
  text.toLowerCase().replace(/[`*]/g, '').trim().replace(/[^\p{L}\p{N}]+/gu, '-')

const heading = (Tag: 'h1' | 'h2' | 'h3' | 'h4') =>
  function Heading({ children }: { children?: ReactNode }) {
    const text = typeof children === 'string' ? children : Array.isArray(children) ? children.join('') : ''
    return <Tag id={slug(String(text))}>{children}</Tag>
  }

function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  useEffect(() => {
    let cancelled = false
    setError(null)
    mermaid
      .render(`mmd${id}`, code)
      .then(({ svg }) => {
        // mermaid が生成した SVG の挿入。markdown 由来の生 HTML は通さない（securityLevel: strict）
        if (!cancelled && ref.current) ref.current.innerHTML = svg
      })
      .catch((e: unknown) => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [code, id])
  if (error) {
    return (
      <div>
        <span className="badge warn">Mermaid 描画失敗 — 生コード表示（情報無欠落フォールバック）</span>
        <pre><code>{code}</code></pre>
      </div>
    )
  }
  return <div className="mermaid-block" ref={ref} />
}

function Pre({ children }: { children?: ReactNode }) {
  if (isValidElement(children)) {
    const child = children as ReactElement<{ className?: string; children?: ReactNode }>
    if (child.props.className?.includes('language-mermaid')) {
      return <MermaidBlock code={String(child.props.children ?? '').trimEnd()} />
    }
  }
  return <pre>{children}</pre>
}

/** 構造化パースの対象外コンテンツを安全に描画する raw markdown フォールバック */
export function Md({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ h1: heading('h1'), h2: heading('h2'), h3: heading('h3'), h4: heading('h4'), pre: Pre }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
