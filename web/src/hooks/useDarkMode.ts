import { useEffect, useState } from 'react'

const KEY = 'nimbus:theme'

export function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(KEY)
    if (saved) return saved === 'dark'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  useEffect(() => {
    const root = document.documentElement
    if (dark) { root.classList.add('dark'); localStorage.setItem(KEY,'dark') }
    else { root.classList.remove('dark'); localStorage.setItem(KEY,'light') }
  }, [dark])

  return { dark, setDark, toggle: () => setDark(v => !v) }
}

