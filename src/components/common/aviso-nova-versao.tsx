import * as React from 'react'
import { registerSW } from 'virtual:pwa-register'
import { Button } from '@/components/ui/button'
import { RefreshCw, WifiOff } from 'lucide-react'

/**
 * Registra o service worker e avisa quando há versão nova.
 *
 * `registerType: 'prompt'` e não `autoUpdate`: recarregar sozinho enquanto
 * alguém está no meio de digitar um gasto perde o que foi digitado. O app
 * avisa e deixa a pessoa escolher a hora — se ela ignorar, a versão nova entra
 * na próxima vez que o app abrir.
 *
 * O aviso é discreto de propósito: é uma informação, não um problema.
 */
export function AvisoNovaVersao() {
  const [temNova, setTemNova] = React.useState(false)
  const [offline, setOffline] = React.useState(() => !navigator.onLine)
  const atualizarRef = React.useRef<(recarregar?: boolean) => Promise<void>>()

  React.useEffect(() => {
    atualizarRef.current = registerSW({
      onNeedRefresh: () => setTemNova(true),
    })
  }, [])

  React.useEffect(() => {
    const mudou = () => setOffline(!navigator.onLine)
    window.addEventListener('online', mudou)
    window.addEventListener('offline', mudou)
    return () => {
      window.removeEventListener('online', mudou)
      window.removeEventListener('offline', mudou)
    }
  }, [])

  if (!temNova && !offline) return null

  return (
    <div
      role="status"
      // Acima da barra inferior do celular (que é fixa) e fora do caminho do
      // polegar; no desktop, canto inferior esquerdo, longe dos toasts.
      className="fixed bottom-[5.5rem] left-1/2 z-40 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border bg-card p-3 shadow-lg sm:bottom-4 sm:left-4 sm:translate-x-0"
    >
      {offline ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
          Sem internet — mostrando o que já estava salvo. Novos lançamentos precisam de rede.
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-sm">Uma versão nova do finZ está pronta.</p>
          <Button
            size="sm"
            className="min-h-11 shrink-0 sm:min-h-0"
            onClick={() => void atualizarRef.current?.(true)}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Atualizar
          </Button>
        </div>
      )}
    </div>
  )
}
