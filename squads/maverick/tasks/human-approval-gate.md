# Task: Human Approval Gate (Revisão de Estratégia)

## Contexto
O **Maverick Strategist** acabou de gerar o "Plano de Ação Maverick" (Markdown). Antes de gastarmos tokens gerando roteiros completos e designs, um humano (o Especialista/Usuário) precisa validar se a estratégia faz sentido.

## Objetivo
Parar o fluxo de execução, apresentar o Plano de Ação e aguardar um comando explícito de aprovação ou refação.

## Comportamento do Agente

1.  **Estado de Espera:**
    *   O agente exibe o Plano de Ação no chat.
    *   O agente exibe um menu de opções (Botões ou Texto):
        *   `[ APROVAR ]` -> Segue para a task `write-creative-script`.
        *   `[ AJUSTAR ]` -> Solicita feedback em texto.
        *   `[ CANCELAR ]` -> Aborta o fluxo.

2.  **Tratamento de Ajustes:**
    *   Se o usuário pedir ajuste (ex: "Mude o pilar 2 para focar em Vendas"), o Agente deve acionar o **Strategist** novamente para regenerar o Markdown com o feedback aplicado.
    *   O fluxo retorna para este Gate após a regeneração.

3.  **Gatilho de Continuidade:**
    *   SOMENTE após receber o input positivo ("Aprovado", "Pode seguir", "Ok"), o agente libera os dados para o **Copywriter**.

## Regras de Interface
*   Não gerar nenhum roteiro final nesta etapa.
*   O tom deve ser consultivo: "Esta estratégia faz sentido para você? Posso prosseguir para os roteiros?"

## Exemplo de Interação

> **🤖 Maverick:** *[Exibe o Markdown do Plano]*
>
> **🤖 Maverick:** "Erick, analise o plano acima. Ele resolve o gap do perfil? Se sim, digite **'Aprovado'** para eu escrever os roteiros."
>
> **👤 Usuário:** "Muda o tópico 3, quero algo mais polêmico."
>
> **🤖 Maverick:** "Entendido. Voltando para o Strategist... *[Regenera plano]* ... E agora?"
>
> **👤 Usuário:** "Aprovado."
>
> **🤖 Maverick:** "Ótimo. Iniciando Copywriter..."

## Output
*   Status booleano: `approved: true` ou `false`.
*   Feedback string (se houver).
