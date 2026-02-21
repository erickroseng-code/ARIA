import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntentParser } from './IntentParser';

describe('IntentParser', () => {
  let parser: IntentParser;

  beforeEach(() => {
    parser = new IntentParser();
  });

  describe('fallback parsing - PLAN_OF_ATTACK_CREATE with generate action', () => {
    it('should detect "pronto" as generate action', () => {
      const result = parser['fallbackParse']('pronto');
      expect(result.intent).toBe('PLAN_OF_ATTACK_CREATE');
      expect(result.action).toBe('generate');
    });

    it('should detect "gerar plano" as generate action', () => {
      const result = parser['fallbackParse']('gerar plano');
      expect(result.intent).toBe('PLAN_OF_ATTACK_CREATE');
      expect(result.action).toBe('generate');
    });

    it('should detect "criar plano" as generate action', () => {
      const result = parser['fallbackParse']('criar plano');
      expect(result.intent).toBe('PLAN_OF_ATTACK_CREATE');
      expect(result.action).toBe('generate');
    });

    it('should detect "análise" as generate action', () => {
      const result = parser['fallbackParse']('análise');
      expect(result.intent).toBe('PLAN_OF_ATTACK_CREATE');
      expect(result.action).toBe('generate');
    });
  });

  describe('fallback parsing - PLAN_OF_ATTACK_CREATE with confirm action', () => {
    it('should detect "confirma" as confirm action', () => {
      const result = parser['fallbackParse']('confirma');
      expect(result.intent).toBe('PLAN_OF_ATTACK_CREATE');
      expect(result.action).toBe('confirm');
    });

    it('should detect "confirmar" as confirm action', () => {
      const result = parser['fallbackParse']('confirmar');
      expect(result.intent).toBe('PLAN_OF_ATTACK_CREATE');
      expect(result.action).toBe('confirm');
    });

    it('should detect "sim" as confirm action', () => {
      const result = parser['fallbackParse']('sim');
      expect(result.intent).toBe('PLAN_OF_ATTACK_CREATE');
      expect(result.action).toBe('confirm');
    });

    it('should detect "pode criar" as confirm action', () => {
      const result = parser['fallbackParse']('pode criar');
      expect(result.intent).toBe('PLAN_OF_ATTACK_CREATE');
      expect(result.action).toBe('confirm');
    });

    it('should detect "cria no notion" as confirm action', () => {
      const result = parser['fallbackParse']('cria no notion');
      expect(result.intent).toBe('PLAN_OF_ATTACK_CREATE');
      expect(result.action).toBe('confirm');
    });

    it('should detect "ok cria" as confirm action', () => {
      const result = parser['fallbackParse']('ok cria');
      expect(result.intent).toBe('PLAN_OF_ATTACK_CREATE');
      expect(result.action).toBe('confirm');
    });

    it('should detect "yes" as confirm action', () => {
      const result = parser['fallbackParse']('yes');
      expect(result.intent).toBe('PLAN_OF_ATTACK_CREATE');
      expect(result.action).toBe('confirm');
    });

    it('should detect "vai" as confirm action', () => {
      const result = parser['fallbackParse']('vai');
      expect(result.intent).toBe('PLAN_OF_ATTACK_CREATE');
      expect(result.action).toBe('confirm');
    });
  });

  describe('other intents', () => {
    it('should detect CLIENT_LOOKUP', () => {
      const result = parser['fallbackParse']('cliente: Empresa X');
      expect(result.intent).toBe('CLIENT_LOOKUP');
      expect(result.entities.clientName).toBe('Empresa X');
    });

    it('should detect TASK_CREATE', () => {
      const result = parser['fallbackParse']('criar tarefa Nova Tarefa');
      expect(result.intent).toBe('TASK_CREATE');
    });

    it('should detect STATUS_CHECK', () => {
      const result = parser['fallbackParse']('qual é o status?');
      expect(result.intent).toBe('STATUS_CHECK');
    });

    it('should default to CHAT for unknown input', () => {
      const result = parser['fallbackParse']('Olá, como você está?');
      expect(result.intent).toBe('CHAT');
    });
  });

  describe('fallback parsing - DOCUMENT_LABEL', () => {
    it('should detect "rótulo" pattern', () => {
      const result = parser['fallbackParse']('rótulo Setor Comercial');
      expect(result.intent).toBe('DOCUMENT_LABEL');
      expect(result.entities.documentLabel).toBe('Setor Comercial');
      expect(result.entities.documentIndex).toBe(-1); // Last document
    });

    it('should detect "renomear para" pattern', () => {
      const result = parser['fallbackParse']('renomear para Relatório Financeiro');
      expect(result.intent).toBe('DOCUMENT_LABEL');
      expect(result.entities.documentLabel).toBe('Relatório Financeiro');
    });

    it('should detect "mudar nome" pattern', () => {
      const result = parser['fallbackParse']('mudar nome para Marketing Analysis');
      expect(result.intent).toBe('DOCUMENT_LABEL');
      expect(result.entities.documentLabel).toBe('Marketing Analysis');
    });

    it('should detect document index from "doc 1"', () => {
      const result = parser['fallbackParse']('doc 1 é Comercial');
      expect(result.intent).toBe('DOCUMENT_LABEL');
      expect(result.entities.documentIndex).toBe(0); // 0-based
      expect(result.entities.documentLabel).toBe('Comercial');
    });

    it('should detect document index from "doc 2"', () => {
      const result = parser['fallbackParse']('doc 2 é Marketing');
      expect(result.intent).toBe('DOCUMENT_LABEL');
      expect(result.entities.documentIndex).toBe(1);
      expect(result.entities.documentLabel).toBe('Marketing');
    });

    it('should extract label from "é" pattern', () => {
      const result = parser['fallbackParse']('primeiro é Relatório RH');
      expect(result.intent).toBe('DOCUMENT_LABEL');
      expect(result.entities.documentLabel).toBe('Relatório RH');
    });

    it('should handle "segundo é" pattern', () => {
      const result = parser['fallbackParse']('segundo é Financial Report');
      expect(result.intent).toBe('DOCUMENT_LABEL');
      expect(result.entities.documentLabel).toBe('Financial Report');
    });
  });

  describe('confidence levels', () => {
    it('should have high confidence for PLAN_OF_ATTACK_CREATE', () => {
      const result = parser['fallbackParse']('confirma');
      expect(result.confidence).toBe(0.95);
    });

    it('should have high confidence for CLIENT_LOOKUP', () => {
      const result = parser['fallbackParse']('cliente: Test');
      expect(result.confidence).toBe(0.8);
    });

    it('should have maximum confidence for CHAT fallback', () => {
      const result = parser['fallbackParse']('random text');
      expect(result.confidence).toBe(1.0);
    });
  });
});
