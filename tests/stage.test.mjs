import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyStage,currentStage} from '../src/cases/stage.mjs';

const source=(text,timestamp=1700000000)=>({text,timestamp});
test('explicit stage and dependency are grounded in literal text',()=>{
  for(const [text,status] of [
    ['Equipe está no local. Atendimento em andamento.','open'],
    ['Aguardando a administração adquirir a controladora.','pending'],
    ['Visita reagendada para sexta-feira.','rescheduled'],
    ['O atendimento foi cancelado a pedido da gerência.','cancelled'],
    ['O equipamento voltou a operar após reinício.','completed'],
    ['Status: concluído','completed'],
    ['Status: abortado. Aguardando a liberação do acesso.','pending']
  ])assert.equal(classifyStage(text)?.status,status,text);
});
test('negation, hypotheses, partial repairs and ambiguous aborts do not close a ticket',()=>{
  for(const text of ['Status: abortado','Não voltou a operar','Se voltar a operar, avisamos','O equipamento voltou a funcionar temporariamente','Cancelamento solicitado','Troca da fonte','Atendimento concluído; serviço cancelado']){
    assert.equal(currentStage({},[source(text)]).status,'unconfirmed',text);
  }
});
test('later clear update supersedes earlier automatic evidence, without overwriting a manual decision',()=>{
  const earlier=source('Aguardando a chegada da peça.');
  const later=source('Atendimento concluído.',earlier.timestamp+60);
  assert.equal(currentStage({},[later,earlier,source('',later.timestamp+1)]).status,'completed');
  assert.equal(currentStage({status:'cancelled',stageReason:'Cancelado pela administração.'},[later]).origin,'manual');
  assert.equal(currentStage({},[later,source('Voltou a falhar.',later.timestamp+1)]).status,'unconfirmed');
  assert.equal(currentStage({},[earlier,source('Status: abortado',later.timestamp+1)]).status,'pending');
  assert.equal(currentStage({tasks:[{text:'Teste de validação ainda necessário'}]},[later]).status,'pending');
});
