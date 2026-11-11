export function intakeText(item){
  if(!/^R-[A-F0-9]{8}$/.test(item.code))throw Error('Chamado inválido');
  return `Assistente do relatório [${item.code}]\nNovo chamado recebido e registrado.`+(item.missing.length?' Os esclarecimentos pendentes serão enviados em seguida.':' Sem dúvida de contexto neste momento.');
}
export function isIntakeText(text){return /^Assistente do relatório \[R-[A-F0-9]{8}\]\nNovo chamado recebido e registrado\. (Os esclarecimentos pendentes serão enviados em seguida\.|Sem dúvida de contexto neste momento\.)$/.test(text);}
