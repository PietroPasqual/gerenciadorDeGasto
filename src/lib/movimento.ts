/**
 * A escala de movimento do app, do lado do JavaScript.
 *
 * O Framer Motion não lê CSS variables, então os mesmos três degraus de
 * `--mov-rapido/normal/lento` do themes.css existem aqui. Mudar um deles
 * significa mudar nos dois lugares — o preço de ter animação em CSS e em JS,
 * e mais barato do que as nove durações soltas que havia antes (0,22s, 0,25s,
 * 0,3s três vezes, 0,4s, 0,5s duas vezes, 0,6s), nenhuma escolhida em relação
 * às outras.
 *
 * Em segundos porque é a unidade do Framer; o CSS usa ms.
 */
export const MOV = {
  rapido: 0.15,
  normal: 0.25,
  lento: 0.4,
} as const

/**
 * Sai rápido e desacelera — o conteúdo parece ter chegado, não ter sido
 * empurrado. Mesmo par de valores do `--mov-easing`.
 */
export const EASING = [0.22, 1, 0.36, 1] as const

/** A transição padrão de entrada de conteúdo. */
export const TRANSICAO = { duration: MOV.normal, ease: EASING }
