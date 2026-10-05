import Anthropic from '@anthropic-ai/sdk';
import { registry } from '../../utils/circuitBreaker.js';
import logger from '../../utils/logger.js';
import { LLMProvider } from './LLMProvider.js';

const DEFAULT_MODELS = [
  {
    modelId: 'claude-sonnet-4-5-20250929',
    slug: 'claude-sonnet-4-5',
    config: { maxTokens: 6000, timeoutMs: 90000, temperature: 0.3 },
  },
];

export class AnthropicProvider extends LLMProvider {
  constructor(apiKey, modelsConfig = null) {
    super('Anthropic');
    if (!apiKey) throw new Error('[AnthropicProvider] API key required');
    this.client = new Anthropic({ apiKey });
    this.models = modelsConfig?.length ? modelsConfig : DEFAULT_MODELS;
    this.circuits = this.models.map(m => registry.getBreaker(`anthropic-${m.slug}`, {
      failureThreshold: 3,
      timeout: m.config?.timeoutMs || 90000,
      name: m.slug,
    }));
  }

  isHealthy() { return this.circuits.some(c => c.isHealthy()); }

  async validateKey() {
    const res = await this.client.messages.create({
      model: this.models[0].modelId,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Reply OK.' }],
    });
    if (!res.content?.[0]?.text) throw new Error('Empty validation response');
    return { valid: true };
  }

  async generateText(prompt, systemPrompt, opts = {}) {
    for (let i = 0; i < this.models.length; i++) {
      const model = this.models[i];
      if (!this.circuits[i].isHealthy()) continue;
      try {
        return await this.circuits[i].execute(() => this._call(model, prompt, systemPrompt, opts));
      } catch (err) {
        logger.warn('Anthropic model failed, trying next', { modelId: model.modelId, error: err.message });
      }
    }
    throw new Error('All Anthropic models exhausted');
  }

  async _call(model, prompt, systemPrompt, opts) {
    const timeoutMs = opts.timeoutMs ?? model.config?.timeoutMs ?? 90000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await this.client.messages.create({
        model: model.modelId,
        system: systemPrompt,
        max_tokens: opts.maxTokens ?? model.config?.maxTokens ?? 6000,
        temperature: opts.temperature ?? model.config?.temperature ?? 0.3,
        messages: [{ role: 'user', content: prompt }],
      }, { signal: controller.signal });
      const content = res.content?.filter(block => block.type === 'text').map(block => block.text).join('');
      if (!content) throw new Error(`Anthropic [${model.modelId}] returned empty content`);
      return content;
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ABORT_ERR') throw new Error(`Anthropic timeout after ${timeoutMs / 1000}s`);
      throw err;
    } finally { clearTimeout(timer); }
  }
}
