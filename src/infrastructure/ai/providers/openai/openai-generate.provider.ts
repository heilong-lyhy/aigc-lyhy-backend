import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OpenAiCompatibleChatCompletionBase,
  type OpenAiCompatibleProviderConfigPaths,
} from '../base/openai-compatible-chat-completion.base';

@Injectable()
export class OpenAiGenerateProvider extends OpenAiCompatibleChatCompletionBase {
  readonly name = 'openai';

  protected readonly configPaths: OpenAiCompatibleProviderConfigPaths = {
    baseUrl: 'aiWorker.openai.baseUrl',
    apiKey: 'aiWorker.openai.apiKey',
    generateTimeoutMs: 'aiWorker.openai.generateTimeoutMs',
  };

  constructor(httpService: HttpService, configService: ConfigService) {
    super(configService, httpService);
  }
}
