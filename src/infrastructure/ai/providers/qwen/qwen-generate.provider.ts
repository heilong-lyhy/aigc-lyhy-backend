import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OpenAiCompatibleChatCompletionBase,
  type OpenAiCompatibleProviderConfigPaths,
} from '../base/openai-compatible-chat-completion.base';

@Injectable()
export class QwenGenerateProvider extends OpenAiCompatibleChatCompletionBase {
  readonly name = 'qwen';

  protected readonly configPaths: OpenAiCompatibleProviderConfigPaths = {
    baseUrl: 'aiWorker.qwen.baseUrl',
    apiKey: 'aiWorker.qwen.apiKey',
    generateTimeoutMs: 'aiWorker.qwen.generateTimeoutMs',
  };

  constructor(httpService: HttpService, configService: ConfigService) {
    super(configService, httpService);
  }
}
