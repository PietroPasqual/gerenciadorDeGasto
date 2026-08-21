import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

/**
 * Bottom sheet — o Dialog do Radix ancorado embaixo, que é onde o polegar
 * alcança. Reaproveita o mesmo primitivo do Dialog (foco preso, Esc, overlay),
 * então não entra dependência nova.
 *
 * Arrastar para baixo fecha: como o conteúdo pode rolar, o arrasto só conta
 * quando começa na alça ou com a área de conteúdo já no topo — senão fechar a
 * sheet brigaria com a rolagem da lista.
 */
const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { alcaClassName?: string }
>(({ className, children, alcaClassName, ...props }, ref) => {
  const painelRef = React.useRef<HTMLDivElement | null>(null)
  const rolagemRef = React.useRef<HTMLDivElement | null>(null)
  const inicioY = React.useRef<number | null>(null)
  const [arrasto, setArrasto] = React.useState(0)

  const podeArrastar = (alvo: EventTarget | null) => {
    const rolagem = rolagemRef.current
    if (!rolagem) return true
    // Começou na alça? sempre pode. Senão, só se a lista já está no topo.
    if (alvo instanceof Node && !rolagem.contains(alvo)) return true
    return rolagem.scrollTop <= 0
  }

  // Botão Close invisível: fechar clicando nele deixa o Radix cuidar de
  // devolver o foco e rodar a animação de saída.
  const fecharRef = React.useRef<HTMLButtonElement | null>(null)

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        ref={(no) => {
          painelRef.current = no as HTMLDivElement | null
          if (typeof ref === 'function') ref(no)
          else if (ref) (ref as { current: unknown }).current = no
        }}
        style={arrasto ? { transform: `translateY(${arrasto}px)` } : undefined}
        onTouchStart={(e) => {
          if (!podeArrastar(e.target)) return
          inicioY.current = e.touches[0].clientY
        }}
        onTouchMove={(e) => {
          if (inicioY.current === null) return
          const delta = e.touches[0].clientY - inicioY.current
          setArrasto(Math.max(0, delta))
        }}
        onTouchEnd={() => {
          // Passou de ~1/4 da altura? fecha. Senão volta ao lugar.
          const altura = painelRef.current?.offsetHeight ?? 0
          if (arrasto > Math.max(96, altura * 0.25)) fecharRef.current?.click()
          inicioY.current = null
          setArrasto(0)
        }}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-3xl border-t border-border bg-card',
          'pb-[env(safe-area-inset-bottom)] shadow-2',
          arrasto ? 'duration-0' : 'duration-300',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Close ref={fecharRef} className="sr-only">
          Fechar
        </DialogPrimitive.Close>

        {/* Alça: sinaliza que dá para arrastar e é a área de arrasto garantida */}
        <div className={cn('flex shrink-0 justify-center pb-1 pt-3', alcaClassName)}>
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <div ref={rolagemRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})
SheetContent.displayName = 'SheetContent'

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('titulo-serif text-secao', className)} {...props} />
))
SheetTitle.displayName = DialogPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
SheetDescription.displayName = DialogPrimitive.Description.displayName

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription }
