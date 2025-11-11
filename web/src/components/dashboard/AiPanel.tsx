import { useState } from 'react'

type Msg = { role: 'user'|'assistant', text: string }

async function askAi(prompt: string): Promise<string> {
  await new Promise(r => setTimeout(r, 400))
  if (/budget/i.test(prompt)) return 'Try setting a weekly grocery envelope of 60–70 € based on your last month.'
  if (/invest/i.test(prompt)) return 'Consider DCA into a broad market ETF; keep 3–6 months cash buffer.'
  return 'Got it! I can help you analyze spending trends, budgets, or savings goals.'
}

export default function AiPanel() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    const me: Msg = { role: 'user', text: input.trim() }
    setMsgs(m => [...m, me]); setBusy(true); setInput('')
    const reply = await askAi(me.text)
    setMsgs(m => [...m, { role: 'assistant', text: reply }]); setBusy(false)
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800 flex flex-col">
      <div className="font-semibold mb-3">Ask Nimbus AI</div>
      <div className="min-h-[160px] max-h-64 overflow-auto space-y-2 border dark:border-neutral-800 rounded-xl p-3">
        {msgs.length === 0 && <div className="text-sm text-neutral-500 dark:text-neutral-400">Ask about budgets, trends, or goals…</div>}
        {msgs.map((m,i)=>(
          <div key={i} className={`text-sm p-2 rounded-xl ${m.role==='user'?'bg-neutral-100 dark:bg-neutral-800 self-end':'bg-blue-50 dark:bg-neutral-800/50'}`}>
            {m.text}
          </div>
        ))}
      </div>
      <form onSubmit={onSend} className="mt-3 flex gap-2">
        <input
          className="flex-1 px-3 py-2 rounded-xl border dark:border-neutral-800 bg-white dark:bg-neutral-900"
          placeholder={busy ? 'Thinking…' : 'Ask anything about your finances'}
          value={input}
          onChange={e=>setInput(e.target.value)}
          disabled={busy}
          aria-label="AI prompt"
        />
        <button disabled={busy} className="px-3 py-2 rounded-xl bg-nimbus-primary text-white hover:opacity-95">Send</button>
      </form>
    </div>
  )
}
