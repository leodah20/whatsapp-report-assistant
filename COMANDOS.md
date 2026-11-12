# Glossário de comandos utilitários

Use o **PowerShell**, de preferência no terminal integrado do VS Code. Os comandos abaixo partem da raiz deste repositório, a pasta que contém o `package.json`. Execute apenas o comando da tarefa que você quer fazer.

[VS Code e OpenCode](#vs-code-e-opencode) · [Painel e coletor](#painel-e-coletor) · [Documentação pública](#documentação-pública) · [Diagnóstico e testes](#diagnóstico-e-testes) · [Git](#git)

## VS Code e OpenCode

**Abrir o projeto no VS Code**, a partir da raiz:

```powershell
code .
```

**Abrir o OpenCode com o modelo gratuito configurado**, no terminal integrado do VS Code:

```powershell
.\scripts\windows\opencode.ps1
```

O script confere se o modelo configurado ainda aparece no catálogo. Se ele não estiver disponível, o script para sem escolher outro. Confira se o modelo ainda está identificado como gratuito antes de usar.

**Abrir o OpenCode e escolher o modelo manualmente:**

```powershell
opencode
```

Dentro do OpenCode, digite `/models`. Abrir o OpenCode não inicia o coletor. Um modelo remoto usado para programar não precisa de acesso ao arquivo privado nem ao MCP.

## Painel e coletor

Se o coletor já estiver rodando, basta abrir a [Central de chamados](http://127.0.0.1:8767/chamados). Não inicie outra instância.

| O que você quer fazer | Comando no PowerShell |
| --- | --- |
| Retomar uma instalação já autorizada no terminal | `npm run resume` |
| Acionar a supervisão em segundo plano e abrir o painel | `.\scripts\windows\start.ps1` |
| Acionar a supervisão sem abrir o navegador | `.\scripts\windows\start.ps1 -Background` |
| Reiniciar o coletor se travar, preservando a sessão | `.\scripts\windows\restart.ps1` |

Para uma instalação do zero, siga o [passo a passo do README](README.md#instalação-local--windows--powershell).

## Documentação pública

| O que você quer fazer | Comando no PowerShell |
| --- | --- |
| Gerar o site estático de arquitetura e estudos | `npm run site` |

O comando grava apenas `site/`, que não é versionado, e não consulta banco, sessão, QR, mensagens ou logs. A publicação em https://leodah20.github.io/whatsapp-report-assistant/ é feita pelo workflow `.github/workflows/pages.yml` após push na `main`. O site é documentação estática: não é o painel do coletor e não deve receber dados operacionais.

## Diagnóstico e testes

| O que você quer fazer | Comando no PowerShell |
| --- | --- |
| Conferir dependências e a configuração local | `npm run doctor` |
| Rodar os testes automatizados com dados sintéticos | `npm test` |
| Testar as telas em tamanhos de desktop e celular, com Chrome/Chromium instalado | `node scripts/ui-smoke.mjs` |
| Verificar espaços e quebras problemáticos nas alterações não preparadas para commit | `git diff --check` |

## Git

| O que você quer fazer | Comando no PowerShell |
| --- | --- |
| Ver em que pasta fica a raiz do repositório | `git rev-parse --show-toplevel` |
| Ver a branch e as alterações locais | `git status -sb` |
| Conferir o repositório remoto | `git remote -v` |
| Ver os últimos cinco commits | `git log -5 --oneline` |
| Atualizar sem criar um merge (depois de salvar o trabalho local) | `git pull --ff-only` |

Ao registrar outro comando, inclua para que serve, onde rodar e qualquer cuidado necessário. Não coloque aqui credenciais, identificadores privados nem caminhos pessoais.
