import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail').email('E-mail inválido'),
  senha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres'),
})

export const cadastroSchema = z
  .object({
    nome: z.string().min(2, 'Como podemos te chamar?'),
    email: z.string().min(1, 'Informe seu e-mail').email('E-mail inválido'),
    senha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres'),
    confirmarSenha: z.string(),
  })
  .refine((dados) => dados.senha === dados.confirmarSenha, {
    message: 'As senhas não conferem',
    path: ['confirmarSenha'],
  })

export type LoginForm = z.infer<typeof loginSchema>
export type CadastroForm = z.infer<typeof cadastroSchema>
