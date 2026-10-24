import { Global, Logger, Module } from '@nestjs/common';
import { DisabledProvider } from './disabled.provider';
import { LLM_PROVIDER, LlmProvider } from './llm-provider';
import { OllamaProvider } from './ollama.provider';

/** Picks the model backend from `LLM_PROVIDER`; add cloud providers here as new cases. */
export function createLlmProvider(env: NodeJS.ProcessEnv = process.env): LlmProvider {
  const choice = (env.LLM_PROVIDER || 'ollama').toLowerCase();
  switch (choice) {
    case 'ollama':
      return new OllamaProvider(env);
    case 'none':
      return new DisabledProvider();
    default:
      new Logger('LlmModule').warn(`Unknown LLM_PROVIDER "${choice}" — AI summaries disabled`);
      return new DisabledProvider(`unknown LLM_PROVIDER "${choice}"`);
  }
}

@Global()
@Module({
  providers: [{ provide: LLM_PROVIDER, useFactory: () => createLlmProvider() }],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
