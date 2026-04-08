# PM2 Uptime Playbook (ARIA Local)

Este guia evita que `aria-web` e `aria-api` fiquem offline em ambiente local Windows.

## Escopo

- Projeto: `C:\Users\erick\Projects\aios-core`
- Processos: `aria-web`, `aria-api`
- Orquestração: PM2 + Task Scheduler

## 1) Subir serviços com PM2

```powershell
pm2.cmd start C:\Users\erick\Projects\aios-core\aria\ecosystem.config.js --only aria-web
pm2.cmd start C:\Users\erick\Projects\aios-core\aria\ecosystem.config.js --only aria-api
```

## 2) Persistir estado atual do PM2

```powershell
pm2.cmd save
```

Isso salva a lista de processos em `C:\Users\erick\.pm2\dump.pm2`.

## 3) Criar auto-recuperacao a cada 5 minutos

```powershell
schtasks.exe /Create /TN "ARIA - Ensure PM2 Running" /TR "cmd.exe /c C:\Users\erick\Projects\aios-core\ensure-pm2.bat" /SC MINUTE /MO 5 /F /RL LIMITED
```

## 4) Disparar uma execucao imediata (validacao)

```powershell
schtasks.exe /Run /TN "ARIA - Ensure PM2 Running"
```

## 5) Verificacoes operacionais

```powershell
pm2.cmd list
schtasks.exe /Query /TN "ARIA - Ensure PM2 Running" /V /FO LIST
Invoke-WebRequest -UseBasicParsing http://localhost:3001/health
```

Sinais esperados:
- `aria-web` = `online`
- `aria-api` = `online`
- Tarefa = `Enabled` e `Last Result: 0`
- Health local retorna JSON com `"status":"ok"`

## Observacoes

- Erro `Unexpected token 'I', "Internal S"...` na web normalmente indica API offline.
- Se precisar executar com privilegio elevado (RunLevel Highest), registrar a tarefa em PowerShell aberto como Administrador.
