// src/modules/account/account-field-encryption.registrar.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { registerEncryptedField } from '@app-types/common/field-encryption.metadata';
import { UserInfoEntity } from './base/entities/user-info.entity';

@Injectable()
export class AccountFieldEncryptionRegistrar implements OnModuleInit {
  onModuleInit(): void {
    registerEncryptedField(UserInfoEntity, 'metaDigest');
  }
}
